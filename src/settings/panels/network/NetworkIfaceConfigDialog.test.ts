import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount, DOMWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'
import type { WifiScanResult, NetworkInterfaceUpdate } from '@nimotech/nimoos-service'
import type { MergedIface } from '../../util/netMerge'

// Scan results verified via curl on 2026-07-31 (two entries)
const NETS: WifiScanResult[] = [
  { ssid: 'NIMO_Network', bssid: '60:a3:e3:a9:db:05', signal: -45, channel: 11, secure: true, connected: false },
  { ssid: 'tongda-zy', bssid: 'cc:ba:6f:ad:e6:6c', signal: -39, channel: 2, secure: true, connected: false },
]

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void }
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const net = {
  scanCalls: [] as string[],
  putCalls: [] as NetworkInterfaceUpdate[],
  scanResult: null as null | Promise<WifiScanResult[]>,
  putError: null as unknown,
  /** When non-null, PUT hangs on this promise, resolved manually by the test — used to verify "disabled while saving" */
  putGate: null as null | Promise<void>,
}
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    network: {
      scanWifi: (iface: string) => { net.scanCalls.push(iface); return net.scanResult ?? Promise.resolve(NETS) },
      updateInterface: async (cfg: NetworkInterfaceUpdate) => {
        net.putCalls.push(cfg)
        if (net.putGate) await net.putGate
        if (net.putError) throw net.putError
      },
    },
  },
  // Equivalent to the real implementation in the package (the network domain's error body is {"error": …})
  networkErrorText: (e: unknown) => {
    const d = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
    return typeof d === 'string' && d.trim() ? d.trim() : undefined
  },
}))

import NetworkIfaceConfigDialog from './NetworkIfaceConfigDialog.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
// The Dialog is teleported to body via reka's DialogPortal → attachTo + query document (same precedent as DeviceInfoDialog.test.ts)
const body = () => new DOMWrapper(document.body)

function iface(p: Partial<MergedIface> = {}): MergedIface {
  return {
    name: 'enp2s0', state: 'up', speed: 1000, maxSpeed: 1000, addr: '192.168.1.10', dhcp: true,
    isVirtual: false, zone: '', type: 'ethernet', ipv4: { method: 'dhcp' }, wireless: null, hybridCapable: false,
    ...p,
  }
}

function mountDlg(
  over: Partial<MergedIface> | null = {},
  opts: { switchMode?: 'ap' | 'client' | 'concurrent'; switchTab?: 'hybrid' } = {},
) {
  return mount(NetworkIfaceConfigDialog, {
    props: { open: true, iface: over === null ? null : iface(over), ...opts },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}

beforeEach(() => {
  net.scanCalls = []; net.putCalls = []; net.scanResult = null; net.putError = null; net.putGate = null
  document.body.innerHTML = ''
})

describe('title derived by type — porting discipline #5 (Vue2 hardcodes "Wi-Fi - <name>")', () => {
  it('ethernet → "以太网 - enp2s0"', async () => {
    const w = mountDlg(); await flushPromises()
    expect(body().get('.ui-dialog-title').text()).toBe('以太网 - enp2s0')
    w.unmount()
  })

  it('Wi-Fi client → "Wi-Fi - wlp1s0"', async () => {
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } }); await flushPromises()
    expect(body().get('.ui-dialog-title').text()).toBe('Wi-Fi - wlp1s0')
    w.unmount()
  })

  it('hotspot → "热点 - wlp1s0"; concurrent → "Wi-Fi + 热点 - wlp1s0"', async () => {
    const ap = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'ap' } }); await flushPromises()
    expect(body().get('.ui-dialog-title').text()).toBe('热点 - wlp1s0')
    ap.unmount()
    document.body.innerHTML = ''

    const cc = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'concurrent' } }); await flushPromises()
    expect(body().get('.ui-dialog-title').text()).toBe('Wi-Fi + 热点 - wlp1s0')
    cc.unmount()
  })
})

describe('branch rendering', () => {
  it('ethernet: three zone options + IPv4 assignment; picking static reveals four fields', async () => {
    const w = mountDlg(); await flushPromises()
    const zone = body().get('.set-net-zone')
    expect(zone.findAll('option').map((o) => o.text())).toEqual(['无', 'LAN', 'WAN'])
    expect(body().find('.set-net-ip').exists()).toBe(false)
    await body().get('.set-net-method').setValue('static')
    expect(body().find('.set-net-ip').exists()).toBe(true)
    expect(body().find('.set-net-dns').exists()).toBe(true)
    w.unmount()
  })

  it('Thunderbolt: has the static-IP note, four fields, and **no** IPv4 assignment dropdown', async () => {
    const w = mountDlg({ name: 'tb0', type: 'thunderbolt', ipv4: null }); await flushPromises()
    expect(body().text()).toContain('Thunderbolt 静态 IP 配置')
    expect(body().find('.set-net-method').exists()).toBe(false)
    expect(body().find('.set-net-ip').exists()).toBe(true)
    w.unmount()
  })

  it('Wi-Fi client: renders WifiForm and **auto-scans once** (Vue2 L289-292)', async () => {
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } }); await flushPromises()
    expect(net.scanCalls).toEqual(['wlp1s0'])
    expect(body().findAll('.set-wifi-row')).toHaveLength(2)
    w.unmount()
  })

  it('Wi-Fi ap: renders HotspotForm, **does not scan**', async () => {
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'ap' } }); await flushPromises()
    expect(net.scanCalls).toEqual([])
    expect(body().find('.set-net-apssid').exists()).toBe(true)
    w.unmount()
  })

  it('concurrent: two tabs, defaults to Wi-Fi; clicking the hotspot tab switches to HotspotForm', async () => {
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'concurrent' } }); await flushPromises()
    const tabs = body().findAll('.set-net-tab')
    expect(tabs.map((tb) => tb.text())).toEqual(['Wi-Fi', '热点'])
    expect(body().find('.set-wifi-list').exists()).toBe(true)
    await tabs[1].trigger('click')
    expect(body().find('.set-net-apssid').exists()).toBe(true)
    w.unmount()
  })

  it('unconfigured Wi-Fi: two onboarding buttons; clicking "connect WiFi" → switches to client and triggers a scan', async () => {
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: null, ipv4: null }); await flushPromises()
    expect(body().text()).toContain('此 Wi-Fi 接口尚未配置')
    const btns = body().findAll('.set-net-choose .set-btn')
    expect(btns.map((b) => b.text())).toEqual(['连接 WiFi', '创建热点'])
    await btns[0].trigger('click'); await flushPromises()
    expect(net.scanCalls).toEqual(['wlp1s0'])
    expect(body().find('.set-wifi-list').exists()).toBe(true)
    w.unmount()
  })

  it('unconfigured Wi-Fi: clicking "create hotspot" → switches to ap, pre-fills the default SSID, no scan', async () => {
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: null, ipv4: null }); await flushPromises()
    await body().findAll('.set-net-choose .set-btn')[1].trigger('click'); await flushPromises()
    expect(net.scanCalls).toEqual([])
    expect((body().get('.set-net-apssid').element as HTMLInputElement).value).toBe('NimoOS-Hotspot')
    w.unmount()
  })
})

describe('save', () => {
  it('ethernet dhcp: the PUT payload is {name, zone, ipv4:{method:"dhcp"}}, then emits saved and closes the dialog', async () => {
    const w = mountDlg(); await flushPromises()
    await body().get('.set-net-save').trigger('click'); await flushPromises()
    expect(net.putCalls).toEqual([{ name: 'enp2s0', zone: '', ipv4: { method: 'dhcp' } }])
    expect(w.emitted('saved')).toBeTruthy()
    const openEvents = w.emitted('update:open')!
    expect(openEvents[openEvents.length - 1]).toEqual([false])
    w.unmount()
  })

  it('failure: **inline in the dialog** .set-danger shows the backend error text, dialog stays open', async () => {
    net.putError = { response: { data: { error: 'failed to apply gateway rules: nft not found' } } }
    const w = mountDlg(); await flushPromises()
    await body().get('.set-net-save').trigger('click'); await flushPromises()
    expect(body().get('.set-danger').text()).toBe('failed to apply gateway rules: nft not found')
    expect(w.emitted('update:open')).toBeFalsy()
    expect(w.emitted('saved')).toBeFalsy()
    w.unmount()
  })

  it('failure but the backend gives no error text → falls back to the local copy', async () => {
    net.putError = new Error('network down')
    const w = mountDlg(); await flushPromises()
    await body().get('.set-net-save').trigger('click'); await flushPromises()
    expect(body().get('.set-danger').text()).toBe('应用设置失败')
    w.unmount()
  })

  it('clicking save in wifi unconfigured mode → inline "no config to save", **doesn\'t send a single PUT**', async () => {
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: null, ipv4: null }); await flushPromises()
    await body().get('.set-net-save').trigger('click'); await flushPromises()
    expect(net.putCalls).toEqual([])
    expect(body().get('.set-danger').text()).toBe('没有可保存的配置')
    w.unmount()
  })

  it('both buttons are disabled while a save is in flight (guards against a repeat PUT from double-clicking), restored once it settles', async () => {
    const gate = deferred<void>()
    net.putGate = gate.promise
    const w = mountDlg(); await flushPromises()
    expect(body().get('.set-net-save').attributes('disabled')).toBeUndefined()

    await body().get('.set-net-save').trigger('click'); await flushPromises()
    expect(body().get('.set-net-save').attributes('disabled')).toBeDefined()
    expect(body().get('.set-net-cancel').attributes('disabled')).toBeDefined()
    // Clicking again while in flight doesn't send a second PUT
    await body().get('.set-net-save').trigger('click'); await flushPromises()
    expect(net.putCalls).toHaveLength(1)

    gate.resolve(); await flushPromises()
    expect(w.emitted('saved')).toBeTruthy()
    w.unmount()
  })
})

describe('scan and disconnect', () => {
  it('scan failure: inline error, scanning resets (porting discipline #4: Vue2\'s early-return branch does not reset)', async () => {
    net.scanResult = Promise.reject({ response: { data: { error: 'invalid interface name: "0bad"' } } })
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } }); await flushPromises()
    expect(body().get('.set-danger').text()).toBe('invalid interface name: "0bad"')
    expect(body().get('.set-net-scan-btn').attributes('disabled')).toBeUndefined()
    w.unmount()
  })

  it('scan returns null (the package already degrades a backend 200+null to []) → empty-state hint, doesn\'t blow up', async () => {
    net.scanResult = Promise.resolve([])
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } }); await flushPromises()
    expect(body().text()).toContain('点击扫描查看可用网络')
    w.unmount()
  })

  it('the saved SSID doesn\'t appear in the scan results → add one pinned at top marked as connected (Vue2 L354-357)', async () => {
    const w = mountDlg({
      name: 'wlp1s0', type: 'wifi',
      wireless: { mode: 'client', ssid: 'HiddenNet', password: 'p' },
    })
    await flushPromises()
    const rows = body().findAll('.set-wifi-row')
    expect(rows[0].text()).toContain('HiddenNet')
    expect(rows[0].text()).toContain('已连接')
    expect(rows).toHaveLength(3)
    w.unmount()
  })

  it('⚠️ staleness guard: after switching to another interface and reopening, a late result from the previous interface\'s scan must not overwrite the new one (newui-async-stale-guard)', async () => {
    // Note: the scan button is disabled while a scan is in flight (VTU also won't dispatch events to a disabled element),
    // so "clicking scan twice on the same interface" isn't a real path. The real race is **closing the dialog and reopening it on a different interface**
    // (scanGen++ in the watch), while the previous 2.3-second scan is still in flight.
    const slow = deferred<WifiScanResult[]>()
    net.scanResult = slow.promise
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } })
    await flushPromises() // wlp1s0's scan is in flight, the list is still empty
    expect(body().findAll('.set-wifi-row')).toHaveLength(0)

    // Switch to another wifi card; this scan returns one entry immediately
    net.scanResult = Promise.resolve([NETS[1]])
    await w.setProps({ iface: iface({ name: 'wlp2s0', type: 'wifi', wireless: { mode: 'client' } }) })
    await flushPromises()
    expect(net.scanCalls).toEqual(['wlp1s0', 'wlp2s0'])
    expect(body().findAll('.set-wifi-row')).toHaveLength(1)
    expect(body().get('.set-wifi-ssid').text()).toBe('tongda-zy')

    // wlp1s0's result only settles now — it must not wipe out wlp2s0's result
    slow.resolve(NETS)
    await flushPromises()
    expect(body().findAll('.set-wifi-row')).toHaveLength(1)
    expect(body().get('.set-wifi-ssid').text()).toBe('tongda-zy')
    w.unmount()
  })

  it('disconnect: PUT sends out {mode:"client", ssid:"", password:""}, and clears the form SSID before rescanning', async () => {
    net.scanResult = Promise.resolve([{ ...NETS[0], connected: true }])
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client', ssid: 'NIMO_Network' } })
    await flushPromises()
    net.scanResult = Promise.resolve([])
    await body().get('.set-wifi-disconnect').trigger('click'); await flushPromises()
    expect(net.putCalls).toEqual([{ name: 'wlp1s0', wireless: { mode: 'client', ssid: '', password: '' } }])
    expect(net.scanCalls).toEqual(['wlp1s0', 'wlp1s0'])
    w.unmount()
  })

  it('disconnect failure: inline error', async () => {
    net.scanResult = Promise.resolve([{ ...NETS[0], connected: true }])
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client', ssid: 'NIMO_Network' } })
    await flushPromises()
    net.putError = { response: { data: { error: 'boom' } } }
    await body().get('.set-wifi-disconnect').trigger('click'); await flushPromises()
    expect(body().get('.set-danger').text()).toBe('boom')
    w.unmount()
  })
})

describe('reset on reopen', () => {
  it('when opened a second time for a different interface, both the form and error are reset (no stale values carried over)', async () => {
    net.putError = { response: { data: { error: 'boom' } } }
    const w = mountDlg(); await flushPromises()
    await body().get('.set-net-save').trigger('click'); await flushPromises()
    expect(body().find('.set-danger').exists()).toBe(true)

    await w.setProps({ open: false }); await flushPromises()
    await w.setProps({ open: true, iface: iface({ name: 'enp4s0', addr: '', state: 'down' }) })
    await flushPromises()
    expect(body().find('.set-danger').exists()).toBe(false)
    expect(body().get('.ui-dialog-title').text()).toBe('以太网 - enp4s0')
    w.unmount()
  })
})
