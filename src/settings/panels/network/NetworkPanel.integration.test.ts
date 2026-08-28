import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount, DOMWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'
import type { NetworkInterfaceConfig, NetworkInterfaceUpdate } from '@nimotech/nimoos-service'

// ── real-device fixture (verified via curl, 2026-07-31; only the fields the UI uses are kept) ────────────────────
const HTTP_NET = [
  { name: 'enp2s0', state: 'up', addr: '192.168.1.10', speed: 1000, max_speed: 1000 },
  { name: 'enp4s0', state: 'down', addr: '', speed: 0, max_speed: 1000 },
  { name: 'wlp1s0', state: 'down', addr: '', speed: 0, max_speed: 0 },
]
const CONFIGS: NetworkInterfaceConfig[] = [
  { name: 'enp2s0', type: 'ethernet', is_virtual: false, mac: '', state: '', ipv4: { method: 'dhcp' } },
  { name: 'enp4s0', type: 'ethernet', is_virtual: false, mac: '', state: '', ipv4: { method: 'dhcp' } },
]

const api = {
  configs: CONFIGS as NetworkInterfaceConfig[] | null,
  net: HTTP_NET as unknown,
  getCalls: 0,
  putCalls: [] as NetworkInterfaceUpdate[],
  putError: null as unknown,
}
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    network: {
      getInterfaces: async () => { api.getCalls++; return Array.isArray(api.configs) ? api.configs : [] },
      updateInterface: async (cfg: NetworkInterfaceUpdate) => {
        api.putCalls.push(cfg)
        if (api.putError) throw api.putError
      },
      scanWifi: async () => [],
    },
    sys: {
      getUtilization: async () => ({ cpu: null, mem: null, disk: null, gpu: null, net: api.net, usb: null }),
    },
  },
  parseUtil: (raw: Record<string, unknown>) => ({
    cpu: null, mem: null, disk: null, gpu: null, usb: null,
    net: typeof raw.sys_net === 'string' ? JSON.parse(raw.sys_net as string) : raw.sys_net,
  }),
  networkErrorText: (e: unknown) =>
    (e as { response?: { data?: { error?: string } } })?.response?.data?.error,
}))

// MessageBus: capture the registered handler so the test can manually feed it pushes
let busHandler: ((props: unknown) => void) | null = null
vi.mock('../../../composables/useMessageBus', () => ({
  useMessageBus: () => ({
    on: (_e: string, cb: (props: unknown) => void) => { busHandler = cb; return () => { busHandler = null } },
  }),
}))

import NetworkPanel from '../NetworkPanel.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const body = () => new DOMWrapper(document.body)
const mountIt = () => mount(NetworkPanel, { global: { plugins: [i18n] }, attachTo: document.body })

beforeEach(() => {
  setActivePinia(createPinia())
  api.configs = CONFIGS; api.net = HTTP_NET; api.getCalls = 0; api.putCalls = []; api.putError = null
  busHandler = null
  document.body.innerHTML = ''
})

describe('NetworkPanel —— list assembly', () => {
  it('three rows: enp2s0 (up/1 Gbps/DHCP+IP), enp4s0 (down), wlp1s0 (must appear even though not in config)', async () => {
    const w = mountIt(); await flushPromises()
    const rows = w.findAll('.set-net-row')
    expect(rows).toHaveLength(3)
    expect(rows[0].text()).toContain('enp2s0')
    expect(rows[0].text()).toContain('1 Gbps')
    expect(rows[0].text()).toContain('192.168.1.10')
    expect(rows[0].get('.set-net-dot').classes()).toContain('up')
    expect(rows[2].text()).toContain('wlp1s0')
    expect(rows[2].text()).toContain('Wi-Fi')
    w.unmount()
  })

  it('subtitle reads "连接"', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.text()).toContain('连接')
    w.unmount()
  })

  it('does not crash when the config endpoint returns null; the list still renders (degraded mode)', async () => {
    api.configs = null
    const w = mountIt(); await flushPromises()
    expect(w.findAll('.set-net-row')).toHaveLength(3)
    expect(w.find('.set-net-empty').exists()).toBe(false)
    w.unmount()
  })
})

describe('NetworkPanel —— 5-second live stream (user signed off on wiring this up, 2026-07-31)', () => {
  it('IP / state update once the push arrives', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.findAll('.set-net-row')[1].text()).not.toContain('10.0.0.9')

    busHandler!({ sys_net: JSON.stringify([
      { name: 'enp2s0', state: 'up', addr: '192.168.1.10', speed: 1000, max_speed: 0 },
      { name: 'enp4s0', state: 'up', addr: '10.0.0.9', speed: 100, max_speed: 0 },
      { name: 'wlp1s0', state: 'down', addr: '', speed: 0, max_speed: 0 },
    ]) })
    await flushPromises()
    const rows = w.findAll('.set-net-row')
    expect(rows[1].text()).toContain('10.0.0.9')
    expect(rows[1].get('.set-net-dot').classes()).toContain('up')
    w.unmount()
  })

  it('⚠️ max_speed is always 0 in the push, the speed label **must not** distort (MaxSpeedMemo takes effect)', async () => {
    // Construct an interface with a 2.5G cap negotiated down to 1G — a shape this machine can't reveal but other machines will definitely flicker on
    api.net = [{ name: 'enp2s0', state: 'up', addr: '192.168.1.10', speed: 1000, max_speed: 2500 }]
    const w = mountIt(); await flushPromises()
    expect(w.findAll('.set-net-row')[0].text()).toContain('1 Gbps / 2.5 Gbps')

    busHandler!({ sys_net: JSON.stringify([
      { name: 'enp2s0', state: 'up', addr: '192.168.1.10', speed: 1000, max_speed: 0 },
    ]) })
    await flushPromises()
    expect(w.findAll('.set-net-row')[0].text()).toContain('1 Gbps / 2.5 Gbps')
    w.unmount()
  })
})

describe('NetworkPanel —— two-step mode-switch flow (Vue2 switchWifiMode :2199-2234)', () => {
  const WIFI_CFG: NetworkInterfaceConfig[] = [
    ...CONFIGS,
    {
      name: 'wlp1s0', type: 'wifi', is_virtual: false, mac: '', state: '', zone: 'wan',
      ipv4: { method: 'dhcp' }, wireless: { mode: 'client' }, hybridCapable: true,
    },
  ]

  async function openSwitchConfirm(target: 'ap' | 'concurrent' = 'ap') {
    api.configs = WIFI_CFG
    const w = mountIt(); await flushPromises()
    // The reka menu is awkward to actually open in jsdom → fire the child component event directly (the third row is wlp1s0)
    const row = w.findAllComponents({ name: 'NetworkIfaceRow' })[2]
    row.vm.$emit('switchMode', target)
    await flushPromises()
    return w
  }

  it('pops the confirmation dialog first, with copy carrying the target mode and interface name', async () => {
    const w = await openSwitchConfirm()
    expect(body().text()).toContain('切换模式')
    expect(body().text()).toContain('切换到 热点？这将改变 wlp1s0 的工作模式。')
    expect(api.putCalls).toEqual([])
    w.unmount()
  })

  it('clicking cancel: no PUT is sent, the config dialog does not open', async () => {
    const w = await openSwitchConfirm()
    await body().findAll('.ui-dialog-footer .ui-btn')[0].trigger('click') // the first one is Cancel
    await flushPromises()
    expect(api.putCalls).toEqual([])
    expect(body().find('.set-net-save').exists()).toBe(false)
    w.unmount()
  })

  it('clicking confirm: first flips the bare {name, wireless:{mode}}, then opens the config dialog and refetches config', async () => {
    const w = await openSwitchConfirm()
    const before = api.getCalls
    await body().findAll('.ui-dialog-footer .ui-btn')[1].trigger('click')
    await flushPromises()
    expect(api.putCalls).toEqual([{ name: 'wlp1s0', wireless: { mode: 'ap' } }])
    expect(api.getCalls).toBeGreaterThan(before)
    expect(body().find('.set-net-save').exists()).toBe(true)   // the config dialog opened
    expect(body().find('.set-net-apssid').exists()).toBe(true) // and it's already the hotspot form
    w.unmount()
  })

  it('bare-flip fails: **the config dialog does not open** —— porting discipline #3 (Vue2 just console.errors and keeps going)', async () => {
    api.putError = { response: { data: { error: 'failed to apply gateway rules' } } }
    const w = await openSwitchConfirm()
    await body().findAll('.ui-dialog-footer .ui-btn')[1].trigger('click')
    await flushPromises()
    expect(body().find('.set-net-save').exists()).toBe(false)
    w.unmount()
  })

  it('switching to hybrid mode: the config dialog opens with the concurrent dual-tab layout', async () => {
    const w = await openSwitchConfirm('concurrent')
    await body().findAll('.ui-dialog-footer .ui-btn')[1].trigger('click')
    await flushPromises()
    expect(api.putCalls).toEqual([{ name: 'wlp1s0', wireless: { mode: 'concurrent' } }])
    expect(body().findAll('.set-net-tab').map((t) => t.text())).toEqual(['Wi-Fi', '热点'])
    w.unmount()
  })
})

describe('NetworkPanel —— edit and refresh after save', () => {
  it('a row\'s edit event opens the config dialog (title is derived from the type)', async () => {
    const w = mountIt(); await flushPromises()
    w.findAllComponents({ name: 'NetworkIfaceRow' })[0].vm.$emit('edit')
    await flushPromises()
    expect(body().get('.ui-dialog-title').text()).toBe('以太网 - enp2s0')
    w.unmount()
  })

  it('dialog saved: refetches config (no more of Vue2\'s 4×2s polling —— the live stream is already refreshing addr)', async () => {
    const w = mountIt(); await flushPromises()
    const before = api.getCalls
    w.findComponent({ name: 'NetworkIfaceConfigDialog' }).vm.$emit('saved')
    await flushPromises()
    expect(api.getCalls).toBe(before + 1)
    w.unmount()
  })
})

describe('NetworkPanel —— empty state', () => {
  it('shows "未找到网络接口" when utilization does not supply net', async () => {
    api.net = null
    const w = mountIt(); await flushPromises()
    expect(w.get('.set-net-empty').text()).toContain('未找到网络接口')
    w.unmount()
  })
})
