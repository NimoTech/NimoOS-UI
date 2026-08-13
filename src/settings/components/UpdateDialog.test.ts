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
// The task brief's original test did mount() then w.find(...) in place — but Dialog.vue
// (a shared file this task must not modify) teleports its content to <body> via reka-ui's
// DialogPortal, outside the mount() wrapper's own DOM subtree (same known pitfall recorded
// in DeviceInfoDialog.test.ts / ShareLinkDialog.test.ts). Copied verbatim, all 18 cases
// would fail on an "empty DOMWrapper" — not this implementation's fault.
// Here we add attachTo: document.body + query via a DOMWrapper over document.body; assertions unchanged.
// Each case must truly unmount the previous instance (not just wipe the DOM) — UpdateDialog
// starts its own setInterval + MessageBus subscriptions, and clearing document.body.innerHTML
// doesn't trigger onBeforeUnmount; leftover timers/subscriptions would leak into the next case
// and corrupt fake-timer/spy counts.
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
  // state.os is a mutable object shared across cases; some cases (e.g. "backend reports
  // already-downloaded on trigger") mutate it in place to simulate backend responses —
  // without a reset before each case the mutation leaks into the next one.
  state.os = { current_version: '1.0.0', need_update: true, latest_version: '1.1.0' }
  state.versionCalls = []; state.updateOsCalls = 0; state.cancelCalls = 0
  state.updateOsFail = false
  for (const k of Object.keys(busHandlers)) delete busHandlers[k]
  // vi.spyOn on the same method reuses the existing spy (no re-wrapping), so its
  // mock.calls accumulate across cases — both "log path" cases spyOn
  // service.file.getContent; without clearing, the later case's calls[0] would be
  // a record left over from the earlier case.
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

  // Review fix round 2 · Important: failures previously only did toast.show(...), but the
  // toast container at z-index:60 is covered by the dialog's own z-index:1000 + backdrop-blur
  // overlay — the user sees nothing. Now shown inline like WebUiHttpsDialog.vue, preferring
  // the backend envelope's message.
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

  // Review fix round 2 · Important: same as above — the upgrade-failure path is also
  // switched to inline display, and the backend envelope's message ('boom', thrown by
  // the state.updateOsFail mock) must be visible.
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

// Review fix round 1 · Important: UpdateRow.vue keeps <UpdateDialog> permanently mounted
// and only toggles :open — in production the close path is stopLogs()/unbind() inside the
// watch(open) branch; onBeforeUnmount never fires in production. The "after unmount"
// cases above only cover the unmount path and leave the actually-exercised prop-close path
// unprotected. Added here: close/reopen via setProps, never calling unmount(), specifically
// targeting the watch(open) branch.
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
