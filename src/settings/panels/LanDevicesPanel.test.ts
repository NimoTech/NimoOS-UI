import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LanDevicesPanel from './LanDevicesPanel.vue'

const getLanDiscovery = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { sys: { getLanDiscovery: () => getLanDiscovery() } },
}))

// Shape matches the endpoint's response.
const FIXTURE = {
  devices: [
    { ip: '192.168.1.11', hostname: 'NimoOS', version: 'dev', self: false },
    { ip: '192.168.1.10', hostname: 'NimoOS', version: '1.0.0', self: true },
    { ip: '192.168.1.12', hostname: '', version: '', self: false },
  ],
  truncated: false,
}

// vitest.setup.ts already installs the app's default i18n globally (zh_cn + zh_cn.sp9
// merged, see src/i18n/index.ts) for every mount -- passing a second local i18n instance
// here would double-install the vue-i18n plugin onto the same test app and trigger
// "already registered" warnings for the i18n-t/i18n-n/i18n-d components and the t
// directive. No local plugin needed.
const mountPanel = () => mount(LanDevicesPanel)

describe('LanDevicesPanel', () => {
  beforeEach(() => { getLanDiscovery.mockReset() })

  it('renders one row per device and falls back for empty hostname/version', async () => {
    getLanDiscovery.mockResolvedValue(FIXTURE)
    const w = mountPanel()
    await flushPromises()
    const rows = w.findAll('.set-lan-row')
    expect(rows).toHaveLength(3)
    expect(rows[2].text()).toContain('NimoOS 设备')
    expect(rows[2].text()).toContain('未知版本')
  })

  it('marks the local device and refuses to open it', async () => {
    getLanDiscovery.mockResolvedValue(FIXTURE)
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const w = mountPanel()
    await flushPromises()
    const rows = w.findAll('.set-lan-row')
    expect(rows[1].text()).toContain('当前设备')
    await rows[1].trigger('click')
    expect(open).not.toHaveBeenCalled()
    await rows[0].trigger('click')
    expect(open).toHaveBeenCalledWith('http://192.168.1.11/', '_blank', 'noopener')
    open.mockRestore()
  })

  it('refuses to open anything that is not a plain IPv4 address', async () => {
    getLanDiscovery.mockResolvedValue({ devices: [
      { ip: 'evil.example.com', hostname: 'x', version: '1', self: false },
      { ip: '10.0.0.1/../x', hostname: 'y', version: '1', self: false },
    ], truncated: false })
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const w = mountPanel()
    await flushPromises()
    for (const row of w.findAll('.set-lan-row')) await row.trigger('click')
    expect(open).not.toHaveBeenCalled()
    open.mockRestore()
  })

  it('warns when the scan range was truncated', async () => {
    getLanDiscovery.mockResolvedValue({ ...FIXTURE, truncated: true })
    const w = mountPanel()
    await flushPromises()
    expect(w.find('.set-lan-warn').exists()).toBe(true)
  })

  it('shows the empty state when the network really has no other device', async () => {
    getLanDiscovery.mockResolvedValue({ devices: [], truncated: false })
    const w = mountPanel()
    await flushPromises()
    expect(w.find('.set-lan-empty').exists()).toBe(true)
    expect(w.find('.set-lan-error').exists()).toBe(false)
  })

  it('shows an error line instead of the empty state when the request fails', async () => {
    // Vue2 swallows the failure and renders "no devices found", which tells the user
    // the network is empty when the request never came back.
    getLanDiscovery.mockRejectedValue(new Error('boom'))
    const w = mountPanel()
    await flushPromises()
    expect(w.find('.set-lan-error').exists()).toBe(true)
    expect(w.find('.set-lan-empty').exists()).toBe(false)
  })

  it('drops a slow first scan when a second one has already been started', async () => {
    let resolveFirst: (v: unknown) => void = () => {}
    getLanDiscovery
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
      .mockResolvedValueOnce({ devices: [
        { ip: '192.168.1.200', hostname: 'second', version: '2', self: false },
      ], truncated: false })
    const w = mountPanel()             // scan #1 -- still pending
    await w.find('.set-lan-refresh').trigger('click') // scan #2
    await flushPromises()
    resolveFirst(FIXTURE)              // #1 lands late, must be discarded
    await flushPromises()
    const rows = w.findAll('.set-lan-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('second')
  })
})
