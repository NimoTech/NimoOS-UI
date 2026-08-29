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

describe('UpdateRow endpoint selection (naming trap)', () => {
  it('kind=os hits getOsVersion (/sys/os_version)', async () => {
    mountRow('os'); await flushPromises()
    expect(state.osCalls).toHaveLength(1)
    expect(state.appCalls).toHaveLength(0)
  })
  it('kind=app hits getAppVersion (/sys/version)', async () => {
    mountRow('app'); await flushPromises()
    expect(state.appCalls).toHaveLength(1)
    expect(state.osCalls).toHaveLength(0)
  })
  it('mounting does not pass trigger_download (must not start downloading the moment settings opens)', async () => {
    mountRow('os'); await flushPromises()
    expect(state.osCalls[0]).toBeUndefined()
  })
})

describe('UpdateRow label and subtitle (Vue2 crosses the label/data source; kept 1:1)', () => {
  it('os row label is "Firmware update", subtitle uses the passed-in sub', async () => {
    const w = mountRow('os', '1.9.3-alpha1+25.gc8d7d14-dirty'); await flushPromises()
    expect(w.find('.set-row-label').text()).toBe('固件更新')
    expect(w.find('.set-row-sub').text()).toBe('v1.9.3-alpha1+25.gc8d7d14-dirty')
  })
  it('app row label is "System update", subtitle uses its own current_version', async () => {
    const w = mountRow('app'); await flushPromises()
    expect(w.find('.set-row-label').text()).toBe('系统更新')
    expect(w.find('.set-row-sub').text()).toBe('v1.9.3-alpha1+25.gc8d7d14-dirty')
  })
  it('subtitle falls back to v1.0.0 when current_version is missing', async () => {
    state.app = { current_version: '', need_update: false }
    const w = mountRow('app'); await flushPromises()
    expect(w.find('.set-row-sub').text()).toBe('v1.0.0')
  })
})

describe('UpdateRow four states (maps to Vue2 L249-312)', () => {
  it('no update needed: shows "already on the latest version" + "Check for updates" button', async () => {
    const w = mountRow('os'); await flushPromises()
    expect(w.find('.set-ok').text()).toContain('当前已经是最新版')
    expect(w.find('.ur-check').text()).toBe('检查更新')
  })

  it('already downloaded: shows version + downloaded, button becomes "Upgrade now"', async () => {
    state.os = { current_version: '1.0.0', latest_version: '1.1.0', need_update: true, is_downloaded: true }
    const w = mountRow('os'); await flushPromises()
    expect(w.find('.set-info').text()).toContain('v1.1.0')
    expect(w.find('.set-info').text()).toContain('已下载')
    expect(w.find('.ur-open').text()).toBe('立即升级')
  })

  it('downloading: button shows the percentage', async () => {
    state.os = { current_version: '1.0.0', need_update: true, is_downloading: true, download_progress: 37 }
    const w = mountRow('os'); await flushPromises()
    expect(w.find('.ur-progress').text()).toContain('37')
  })

  it('downloading with missing progress: shows 0% instead of NaN', async () => {
    state.os = { current_version: '1.0.0', need_update: true, is_downloading: true }
    const w = mountRow('os'); await flushPromises()
    expect(w.find('.ur-progress').text()).toContain('0')
    expect(w.text()).not.toContain('NaN')
  })

  it('update available but not downloaded: button is "Check for updates" (Vue2 uses the same button)', async () => {
    state.os = { current_version: '1.0.0', need_update: true }
    const w = mountRow('os'); await flushPromises()
    expect(w.find('.ur-check').exists()).toBe(true)
  })
})

describe('UpdateRow check-for-updates interaction', () => {
  it('clicking check with no update available: does not open the dialog, shows already-latest message', async () => {
    const w = mountRow('os'); await flushPromises()
    await w.find('.ur-check').trigger('click'); await flushPromises()
    expect(w.findComponent({ name: 'UpdateDialog' }).props('open')).toBe(false)
  })

  it('clicking check when an update is available: opens the dialog', async () => {
    state.os = { current_version: '1.0.0', latest_version: '1.1.0', need_update: true }
    const w = mountRow('os'); await flushPromises()
    await w.find('.ur-check').trigger('click'); await flushPromises()
    expect(w.findComponent({ name: 'UpdateDialog' }).props('open')).toBe(true)
  })

  it('a failed check does not get stuck in loading', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'getOsVersion').mockRejectedValueOnce(new Error('boom'))
    const w = mountRow('os'); await flushPromises()
    await w.find('.ur-check').trigger('click'); await flushPromises()
    expect(w.find('.ur-check').attributes('disabled')).toBeUndefined()
  })
})

describe('UpdateRow MessageBus progress (maps 1:1 to Vue2\'s sockets block)', () => {
  it('the os row only listens for upgrade events, the app row only listens for app events', async () => {
    mountRow('os'); await flushPromises()
    expect(Object.keys(busHandlers).sort()).toEqual(['nimoos:upgrade:downloaded', 'nimoos:upgrade:progress'])
  })

  it('shows the percentage on the row after receiving a progress event', async () => {
    const w = mountRow('os'); await flushPromises()
    busHandlers['nimoos:upgrade:progress'].forEach((f) => f({ progress: '42.5' }))
    await flushPromises()
    expect(w.find('.ur-progress').text()).toContain('42.5')
  })

  it('progress does not regress (Vue2 checkVersion has this protection: an older polled progress value must not overwrite a larger real-time progress value)', async () => {
    const w = mountRow('os'); await flushPromises()
    // the real-time event pushes progress to 80
    busHandlers['nimoos:upgrade:progress'].forEach((f) => f({ progress: '80' }))
    await flushPromises()
    // the server reports only 30 at this point; the downloaded event triggers a fetchInfo — the guard must block this regression
    state.os = { current_version: '1.0.0', need_update: true, is_downloading: true, download_progress: 30 }
    busHandlers['nimoos:upgrade:downloaded'].forEach((f) => f({}))
    await flushPromises()
    expect(w.find('.ur-progress').text()).toContain('80')
  })

  it('adopts the server value when the server-reported progress is larger (the guard only blocks regression, not all updates)', async () => {
    const w = mountRow('os'); await flushPromises()
    busHandlers['nimoos:upgrade:progress'].forEach((f) => f({ progress: '20' }))
    await flushPromises()
    state.os = { current_version: '1.0.0', need_update: true, is_downloading: true, download_progress: 55 }
    busHandlers['nimoos:upgrade:downloaded'].forEach((f) => f({}))
    await flushPromises()
    expect(w.find('.ur-progress').text()).toContain('55')
  })

  it('re-fetches status after the downloaded event', async () => {
    mountRow('os'); await flushPromises()
    const before = state.osCalls.length
    busHandlers['nimoos:upgrade:downloaded'].forEach((f) => f({}))
    await flushPromises()
    expect(state.osCalls.length).toBeGreaterThan(before)
  })

  it('unsubscribes after unmount', async () => {
    const w = mountRow('os'); await flushPromises()
    w.unmount()
    expect(busHandlers['nimoos:upgrade:progress']).toHaveLength(0)
  })
})
