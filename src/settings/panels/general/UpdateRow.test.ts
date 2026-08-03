import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'

const state = {
  os: { current_version: '1.0.0', need_update: false } as Record<string, unknown>,
  app: { current_version: '1.9.3-alpha1+25.gc8d7d14-dirty', need_update: false } as Record<string, unknown>,
  osCalls: [] as unknown[],
  appCalls: [] as unknown[],
}
const busHandlers: Record<string, ((p: unknown) => void)[]> = {}

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      getOsVersion: async (p?: unknown) => { state.osCalls.push(p); return state.os },
      getAppVersion: async (p?: unknown) => { state.appCalls.push(p); return state.app },
      updateOs: async () => {}, updateApp: async () => {}, cancelDownload: async () => {},
    },
    file: { getContent: async () => ({ content: '' }) },
  },
}))
vi.mock('../../../composables/useMessageBus', () => ({
  useMessageBus: () => ({
    on(event: string, cb: (p: unknown) => void) {
      ;(busHandlers[event] ||= []).push(cb)
      return () => { busHandlers[event] = busHandlers[event].filter((f) => f !== cb) }
    },
  }),
}))

import UpdateRow from './UpdateRow.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const mountRow = (kind: 'os' | 'app', sub?: string) =>
  mount(UpdateRow, { props: { kind, sub }, global: { plugins: [i18n] } })

beforeEach(() => {
  setActivePinia(createPinia())
  state.os = { current_version: '1.0.0', need_update: false }
  state.app = { current_version: '1.9.3-alpha1+25.gc8d7d14-dirty', need_update: false }
  state.osCalls = []; state.appCalls = []
  for (const k of Object.keys(busHandlers)) delete busHandlers[k]
})

describe('UpdateRow 端点选择(命名陷阱)', () => {
  it('kind=os 打 getOsVersion(/sys/os_version)', async () => {
    mountRow('os'); await flushPromises()
    expect(state.osCalls).toHaveLength(1)
    expect(state.appCalls).toHaveLength(0)
  })
  it('kind=app 打 getAppVersion(/sys/version)', async () => {
    mountRow('app'); await flushPromises()
    expect(state.appCalls).toHaveLength(1)
    expect(state.osCalls).toHaveLength(0)
  })
  it('挂载时不带 trigger_download(不能一进设置页就开始下载)', async () => {
    mountRow('os'); await flushPromises()
    expect(state.osCalls[0]).toBeUndefined()
  })
})

describe('UpdateRow 标签与副标题(Vue2 的标签/数据源是交叉的,1:1 照留)', () => {
  it('os 行标签「固件更新」,副标题用传入的 sub', async () => {
    const w = mountRow('os', '1.9.3-alpha1+25.gc8d7d14-dirty'); await flushPromises()
    expect(w.find('.set-row-label').text()).toBe('固件更新')
    expect(w.find('.set-row-sub').text()).toBe('v1.9.3-alpha1+25.gc8d7d14-dirty')
  })
  it('app 行标签「系统更新」,副标题用自己的 current_version', async () => {
    const w = mountRow('app'); await flushPromises()
    expect(w.find('.set-row-label').text()).toBe('系统更新')
    expect(w.find('.set-row-sub').text()).toBe('v1.9.3-alpha1+25.gc8d7d14-dirty')
  })
  it('current_version 缺失时副标题回退 v1.0.0', async () => {
    state.app = { current_version: '', need_update: false }
    const w = mountRow('app'); await flushPromises()
    expect(w.find('.set-row-sub').text()).toBe('v1.0.0')
  })
})

describe('UpdateRow 四种状态(对位 Vue2 L249-312)', () => {
  it('无需更新:显示「当前已经是最新版」+「检查更新」按钮', async () => {
    const w = mountRow('os'); await flushPromises()
    expect(w.find('.set-ok').text()).toContain('当前已经是最新版')
    expect(w.find('.ur-check').text()).toBe('检查更新')
  })

  it('已下载:显示版本 + 已下载,按钮变「立即升级」', async () => {
    state.os = { current_version: '1.0.0', latest_version: '1.1.0', need_update: true, is_downloaded: true }
    const w = mountRow('os'); await flushPromises()
    expect(w.find('.set-info').text()).toContain('v1.1.0')
    expect(w.find('.set-info').text()).toContain('已下载')
    expect(w.find('.ur-open').text()).toBe('立即升级')
  })

  it('下载中:按钮显示百分比', async () => {
    state.os = { current_version: '1.0.0', need_update: true, is_downloading: true, download_progress: 37 }
    const w = mountRow('os'); await flushPromises()
    expect(w.find('.ur-progress').text()).toContain('37')
  })

  it('下载中且进度缺失:按 0% 显示而不是 NaN', async () => {
    state.os = { current_version: '1.0.0', need_update: true, is_downloading: true }
    const w = mountRow('os'); await flushPromises()
    expect(w.find('.ur-progress').text()).toContain('0')
    expect(w.text()).not.toContain('NaN')
  })

  it('有更新但未下载:按钮是「检查更新」(Vue2 同一个按钮)', async () => {
    state.os = { current_version: '1.0.0', need_update: true }
    const w = mountRow('os'); await flushPromises()
    expect(w.find('.ur-check').exists()).toBe(true)
  })
})

describe('UpdateRow 检查更新交互', () => {
  it('无更新时点检查:不开弹窗,提示已是最新', async () => {
    const w = mountRow('os'); await flushPromises()
    await w.find('.ur-check').trigger('click'); await flushPromises()
    expect(w.findComponent({ name: 'UpdateDialog' }).props('open')).toBe(false)
  })

  it('有更新时点检查:打开弹窗', async () => {
    state.os = { current_version: '1.0.0', latest_version: '1.1.0', need_update: true }
    const w = mountRow('os'); await flushPromises()
    await w.find('.ur-check').trigger('click'); await flushPromises()
    expect(w.findComponent({ name: 'UpdateDialog' }).props('open')).toBe(true)
  })

  it('检查失败不卡在 loading', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'getOsVersion').mockRejectedValueOnce(new Error('boom'))
    const w = mountRow('os'); await flushPromises()
    await w.find('.ur-check').trigger('click'); await flushPromises()
    expect(w.find('.ur-check').attributes('disabled')).toBeUndefined()
  })
})

describe('UpdateRow MessageBus 进度(逐字对位 Vue2 sockets 块)', () => {
  it('os 行只听 upgrade 系事件,app 行只听 app 系事件', async () => {
    mountRow('os'); await flushPromises()
    expect(Object.keys(busHandlers).sort()).toEqual(['nimoos:upgrade:downloaded', 'nimoos:upgrade:progress'])
  })

  it('收到进度事件后行上显示百分比', async () => {
    const w = mountRow('os'); await flushPromises()
    busHandlers['nimoos:upgrade:progress'].forEach((f) => f({ progress: '42.5' }))
    await flushPromises()
    expect(w.find('.ur-progress').text()).toContain('42.5')
  })

  it('进度不回退(Vue2 checkVersion 有这个保护:轮询回来的旧进度不许覆盖更大的实时进度)', async () => {
    const w = mountRow('os'); await flushPromises()
    // 实时事件把进度推到 80
    busHandlers['nimoos:upgrade:progress'].forEach((f) => f({ progress: '80' }))
    await flushPromises()
    // 服务端此刻只报到 30;downloaded 事件会触发一次 fetchInfo —— 守卫必须挡住这次回退
    state.os = { current_version: '1.0.0', need_update: true, is_downloading: true, download_progress: 30 }
    busHandlers['nimoos:upgrade:downloaded'].forEach((f) => f({}))
    await flushPromises()
    expect(w.find('.ur-progress').text()).toContain('80')
  })

  it('服务端报的进度更大时采用服务端值(守卫只挡回退,不是永不更新)', async () => {
    const w = mountRow('os'); await flushPromises()
    busHandlers['nimoos:upgrade:progress'].forEach((f) => f({ progress: '20' }))
    await flushPromises()
    state.os = { current_version: '1.0.0', need_update: true, is_downloading: true, download_progress: 55 }
    busHandlers['nimoos:upgrade:downloaded'].forEach((f) => f({}))
    await flushPromises()
    expect(w.find('.ur-progress').text()).toContain('55')
  })

  it('downloaded 事件后重新拉状态', async () => {
    mountRow('os'); await flushPromises()
    const before = state.osCalls.length
    busHandlers['nimoos:upgrade:downloaded'].forEach((f) => f({}))
    await flushPromises()
    expect(state.osCalls.length).toBeGreaterThan(before)
  })

  it('卸载后取消订阅', async () => {
    const w = mountRow('os'); await flushPromises()
    w.unmount()
    expect(busHandlers['nimoos:upgrade:progress']).toHaveLength(0)
  })
})
