import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount, DOMWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'

const state = {
  os: { current_version: '1.0.0', need_update: true, latest_version: '1.1.0' } as Record<string, unknown>,
  versionCalls: [] as unknown[],
  updateOsCalls: 0, cancelCalls: 0, logContent: 'step 1\nstep 2',
  updateOsFail: false,
}
const busHandlers: Record<string, ((p: unknown) => void)[]> = {}

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      getOsVersion: async (p?: unknown) => { state.versionCalls.push(p); return state.os },
      getAppVersion: async (p?: unknown) => { state.versionCalls.push(p); return state.os },
      updateOs: async () => { state.updateOsCalls++; if (state.updateOsFail) throw new Error('boom') },
      updateApp: async () => { state.updateOsCalls++ },
      cancelDownload: async () => { state.cancelCalls++ },
    },
    file: { getContent: async () => ({ content: state.logContent }) },
  },
}))
vi.mock('../../composables/useMessageBus', () => ({
  useMessageBus: () => ({
    on(event: string, cb: (p: unknown) => void) {
      ;(busHandlers[event] ||= []).push(cb)
      return () => { busHandlers[event] = busHandlers[event].filter((f) => f !== cb) }
    },
  }),
}))

import UpdateDialog from './UpdateDialog.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const INFO = { current_version: '1.0.0', need_update: true, latest_version: '1.1.0', version: { change_log: '## 更新内容\n- 修了个 bug' } }
// 任务简报给的这份测试原文直接 mount() 后就地 w.find(...) —— 但 Dialog.vue(共享文件,
// 本任务不可改)经由 reka-ui 的 DialogPortal 把内容 Teleport 到 <body>,不在 mount()
// 返回的 wrapper 自己的 DOM 子树内(同 DeviceInfoDialog.test.ts / ShareLinkDialog.test.ts
// 记录的既有坑)。原文若逐字照搬,18 个用例会全部因"空 DOMWrapper"报错,不是本实现的锅。
// 这里补 attachTo: document.body + 对 document.body 取 DOMWrapper 查询,断言内容不变。
// 每个用例结束都要把上一个实例真正 unmount(不只是擦掉 DOM)——UpdateDialog 自己
// 起了 setInterval + MessageBus 订阅,只清 document.body.innerHTML 不会触发
// onBeforeUnmount,残留的定时器/订阅会串到下一个用例,把假计时器/spy 计数搅乱。
let activeWrapper: ReturnType<typeof mount> | null = null
const mountIt = (props: Record<string, unknown> = {}) => {
  activeWrapper = mount(UpdateDialog, {
    props: { open: true, kind: 'os', info: INFO, ...props },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  return activeWrapper
}
const body = () => new DOMWrapper(document.body)

beforeEach(() => {
  setActivePinia(createPinia())
  // state.os 是跨用例共享的可变对象;个别用例(如"触发下载时若后端直接报已下载")
  // 会就地改写它模拟后端返回,若不在每个用例前复位,改写会漏到下一个用例里。
  state.os = { current_version: '1.0.0', need_update: true, latest_version: '1.1.0' }
  state.versionCalls = []; state.updateOsCalls = 0; state.cancelCalls = 0
  state.updateOsFail = false
  for (const k of Object.keys(busHandlers)) delete busHandlers[k]
  // vi.spyOn 对同一方法二次调用会复用已有的 spy(不重新包一层),它的
  // mock.calls 会跨用例累积——两个"日志路径"用例都对 service.file.getContent
  // spyOn,若不清空,后一个用例读到的 calls[0] 会是前一个用例留下的记录。
  vi.clearAllMocks()
  vi.useFakeTimers()
})
afterEach(() => {
  activeWrapper?.unmount()
  activeWrapper = null
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('UpdateDialog 默认态', () => {
  it('标题带版本号', async () => {
    mountIt()
    await nextTick()
    expect(body().text()).toContain('v1.1.0')
  })
  it('渲染 changelog 的 markdown(html:false,v-html 安全)', async () => {
    mountIt()
    await nextTick()
    expect(body().find('.upd-log').html()).toContain('<h2>')
    expect(body().find('.upd-log').text()).toContain('修了个 bug')
  })
  it('changelog 缺失时不炸', async () => {
    mountIt({ info: { current_version: '1.0.0', need_update: true } })
    await nextTick()
    expect(body().find('.upd-log').exists()).toBe(true)
  })
  it('未下载时按钮是「立即下载」', async () => {
    mountIt()
    await nextTick()
    expect(body().find('.upd-download').text()).toBe('立即下载')
  })
  it('已下载时按钮是「立即更新」', async () => {
    mountIt({ info: { ...INFO, is_downloaded: true } })
    await nextTick()
    expect(body().find('.upd-upgrade').text()).toBe('立即更新')
  })
})

describe('UpdateDialog 下载', () => {
  it('点下载时带 trigger_download:1', async () => {
    mountIt()
    await nextTick()
    await body().find('.upd-download').trigger('click'); await flushPromises()
    expect(state.versionCalls[0]).toEqual({ trigger_download: 1 })
  })

  it('进入下载态后显示进度条与取消按钮', async () => {
    mountIt()
    await nextTick()
    await body().find('.upd-download').trigger('click'); await flushPromises()
    expect(body().find('.upd-bar').exists()).toBe(true)
    expect(body().find('.upd-cancel').exists()).toBe(true)
  })

  it('MessageBus 进度推进进度条', async () => {
    mountIt()
    await nextTick()
    await body().find('.upd-download').trigger('click'); await flushPromises()
    busHandlers['nimoos:upgrade:progress'].forEach((f) => f({ progress: '66' }))
    await flushPromises()
    expect(body().find('.upd-bar').attributes('aria-valuenow')).toBe('66')
  })

  it('kind=os 忽略 app 系进度事件(串台会显示错的百分比)', async () => {
    mountIt()
    await nextTick()
    await body().find('.upd-download').trigger('click'); await flushPromises()
    expect(busHandlers['nimoos:app:download:progress']).toBeUndefined()
  })

  // 评审 fix round 2 · Important:此前失败只 toast.show(...),但 toast 容器
  // z-index:60 被弹窗自己 z-index:1000 + backdrop blur 的遮罩糊住,用户什么都看不见。
  // 现在改成跟 WebUiHttpsDialog.vue 一样内联展示,且优先展示后端信封的 message。
  it('触发下载失败:内联显示后端的失败消息(不是不可见的 toast)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'getOsVersion').mockRejectedValueOnce(new Error('upgrade already running'))
    mountIt()
    await nextTick()
    await body().find('.upd-download').trigger('click'); await flushPromises()
    expect(body().find('.set-danger').text()).toContain('upgrade already running')
  })

  it('触发下载时若后端直接报已下载,收弹窗并 emit changed', async () => {
    state.os = { current_version: '1.0.0', need_update: true, is_downloaded: true }
    const w = mountIt()
    await nextTick()
    await body().find('.upd-download').trigger('click'); await flushPromises()
    expect(w.emitted('update:open')).toEqual([[false]])
    expect(w.emitted('changed')).toBeTruthy()
  })

  it('downloaded 事件到达时收弹窗并 emit changed', async () => {
    const w = mountIt()
    await nextTick()
    await body().find('.upd-download').trigger('click'); await flushPromises()
    busHandlers['nimoos:upgrade:downloaded'].forEach((f) => f({}))
    await flushPromises()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('点取消:调 cancelDownload,收弹窗并 emit changed', async () => {
    const w = mountIt()
    await nextTick()
    await body().find('.upd-download').trigger('click'); await flushPromises()
    await body().find('.upd-cancel').trigger('click'); await flushPromises()
    expect(state.cancelCalls).toBe(1)
    expect(w.emitted('changed')).toBeTruthy()
  })

  it('currentlyDownloading=true:一打开就是下载态', async () => {
    mountIt({ info: { ...INFO, is_downloading: true, download_progress: 55 }, currentlyDownloading: true })
    await nextTick()
    expect(body().find('.upd-bar').attributes('aria-valuenow')).toBe('55')
    expect(body().find('.upd-cancel').exists()).toBe(true)
  })
})

describe('UpdateDialog 升级', () => {
  it('kind=os 点升级调 updateOs 并进入日志态', async () => {
    mountIt({ info: { ...INFO, is_downloaded: true } })
    await nextTick()
    await body().find('.upd-upgrade').trigger('click'); await flushPromises()
    expect(state.updateOsCalls).toBe(1)
    expect(body().find('.upd-logs').exists()).toBe(true)
  })

  it('日志按 2 秒轮询,读的是 os 的日志路径', async () => {
    const svc = await import('@nimotech/nimoos-service')
    const spy = vi.spyOn(svc.service.file, 'getContent')
    mountIt({ info: { ...INFO, is_downloaded: true } })
    await nextTick()
    await body().find('.upd-upgrade').trigger('click'); await flushPromises()
    await vi.advanceTimersByTimeAsync(2000); await flushPromises()
    expect(spy.mock.calls[0][0]).toBe('/var/log/nimoos/upgrade.log')
  })

  it('kind=app 读的是 app 的日志路径', async () => {
    const svc = await import('@nimotech/nimoos-service')
    const spy = vi.spyOn(svc.service.file, 'getContent')
    mountIt({ kind: 'app', info: { ...INFO, is_downloaded: true } })
    await nextTick()
    await body().find('.upd-upgrade').trigger('click'); await flushPromises()
    await vi.advanceTimersByTimeAsync(2000); await flushPromises()
    expect(spy.mock.calls[0][0]).toBe('/var/log/nimoos_app_upgrade.log')
  })

  it('升级接口失败:退出日志态,回到可再试的样子', async () => {
    state.updateOsFail = true
    mountIt({ info: { ...INFO, is_downloaded: true } })
    await nextTick()
    await body().find('.upd-upgrade').trigger('click'); await flushPromises()
    expect(body().find('.upd-logs').exists()).toBe(false)
    expect(body().find('.upd-upgrade').exists()).toBe(true)
  })

  // 评审 fix round 2 · Important:同上,升级失败这条路径也改成内联展示,
  // 且后端信封的 message('boom',state.updateOsFail 那个 mock 抛的)要能看到。
  it('升级失败:内联显示后端的失败消息(不是不可见的 toast)', async () => {
    state.updateOsFail = true
    mountIt({ info: { ...INFO, is_downloaded: true } })
    await nextTick()
    await body().find('.upd-upgrade').trigger('click'); await flushPromises()
    expect(body().find('.set-danger').text()).toContain('boom')
  })

  it('弹窗关闭后停掉日志轮询(不留定时器)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    const spy = vi.spyOn(svc.service.file, 'getContent')
    const w = mountIt({ info: { ...INFO, is_downloaded: true } })
    await nextTick()
    await body().find('.upd-upgrade').trigger('click'); await flushPromises()
    await vi.advanceTimersByTimeAsync(2000); await flushPromises()
    const before = spy.mock.calls.length
    w.unmount()
    await vi.advanceTimersByTimeAsync(6000)
    expect(spy.mock.calls.length).toBe(before)
  })
})

// 评审 fix round 1 · Important:UpdateRow.vue 把 <UpdateDialog> 常驻挂载,只切换
// :open —— 生产环境走的关闭路径是 watch(open) 分支里的 stopLogs()/unbind(),
// onBeforeUnmount 在生产里从不会触发。上面几个"卸载后 XX"用例只覆盖了 unmount 路径,
// 对真正会跑的 prop-close 路径完全没有保护。这里补上:关闭/重开都走 setProps,
// 不调用 unmount(),专门盯 watch(open) 分支。
describe('UpdateDialog 通过 prop 关闭(不 unmount)时的清理 —— 生产实际走的路径', () => {
  it('日志轮询在 prop 关闭后停止(不是只在 unmount 时才停)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    const spy = vi.spyOn(svc.service.file, 'getContent')
    const w = mountIt({ info: { ...INFO, is_downloaded: true } })
    await nextTick()
    await body().find('.upd-upgrade').trigger('click'); await flushPromises()
    await vi.advanceTimersByTimeAsync(2000); await flushPromises()
    const before = spy.mock.calls.length
    await w.setProps({ open: false })
    await flushPromises()
    await vi.advanceTimersByTimeAsync(6000); await flushPromises()
    expect(spy.mock.calls.length).toBe(before)
  })

  it('MessageBus 订阅在 prop 关闭后释放(不是只在 unmount 时才释放)', async () => {
    mountIt()
    await nextTick()
    expect(Object.keys(busHandlers).sort()).toEqual(['nimoos:upgrade:downloaded', 'nimoos:upgrade:progress'])
    await activeWrapper!.setProps({ open: false })
    await flushPromises()
    expect(busHandlers['nimoos:upgrade:progress']).toHaveLength(0)
    expect(busHandlers['nimoos:upgrade:downloaded']).toHaveLength(0)
  })

  it('关闭后再打开会重新订阅,进度事件依旧生效(钉住 bind/unbind 的配对)', async () => {
    const w = mountIt()
    await nextTick()
    await w.setProps({ open: false })
    await flushPromises()
    await w.setProps({ open: true })
    await flushPromises()
    busHandlers['nimoos:upgrade:progress'].forEach((f) => f({ progress: '73' }))
    await flushPromises()
    expect(body().find('.upd-bar').attributes('aria-valuenow')).toBe('73')
  })
})
