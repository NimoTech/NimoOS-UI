import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'
import WifiForm from './WifiForm.vue'
import { hydrateForm, type IfaceFormState } from '../../util/ifaceForm'
import type { WifiScanResult } from '@nimotech/nimoos-service'
import type { MergedIface } from '../../util/netMerge'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

// Two entries verified via curl on 2026-07-31 (GET /v2/nimoos/network/wifi/scan?iface=wlp1s0)
const NETS: WifiScanResult[] = [
  { ssid: 'NIMO_Network', bssid: '60:a3:e3:a9:db:05', signal: -45, channel: 11, secure: true, connected: false },
  { ssid: 'ChinaNet-D2yt', bssid: '84:f5:eb:1d:4a:c2', signal: -70, channel: 11, secure: true, connected: false },
]

function wifiIface(mode = 'client'): MergedIface {
  return {
    name: 'wlp1s0', state: 'down', speed: 0, maxSpeed: 0, addr: '', dhcp: true, isVirtual: false,
    zone: 'wan', type: 'wifi', ipv4: { method: 'dhcp' }, wireless: { mode }, hybridCapable: false,
  }
}

function mountForm(over: { form?: IfaceFormState; networks?: WifiScanResult[]; scanning?: boolean } = {}) {
  const form = over.form ?? hydrateForm(wifiIface())
  const w = mount(WifiForm, {
    props: { form, networks: over.networks ?? NETS, scanning: over.scanning ?? false },
    global: { plugins: [i18n] },
  })
  return { w, form }
}

describe('WifiForm — scan list (parity with Vue2 WifiForm.vue L3-39)', () => {
  it('lists each SSID + signal bar', () => {
    const { w } = mountForm()
    const rows = w.findAll('.set-wifi-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('NIMO_Network')
    expect(rows[0].get('.set-wifi-bar').text()).toBe('▅') // -45 → full bar
    expect(rows[1].get('.set-wifi-bar').text()).toBe('▃') // -70 → three bars
  })

  it('clicking a row writes ssid into form (shared object, not its own copy)', async () => {
    const { w, form } = mountForm()
    await w.findAll('.set-wifi-row')[0].trigger('click')
    expect(form.wireless.ssid).toBe('NIMO_Network')
    expect(w.findAll('.set-wifi-row')[0].classes()).toContain('on')
  })

  it('scan button emits scan; while scanning the button is disabled and its label changes to "Scanning..."', async () => {
    const { w } = mountForm()
    await w.get('.set-net-scan-btn').trigger('click')
    expect(w.emitted('scan')).toBeTruthy()

    const busy = mountForm({ scanning: true }).w
    expect(busy.get('.set-net-scan-btn').attributes('disabled')).toBeDefined()
    expect(busy.get('.set-net-scan-btn').text()).toBe('扫描中...')
  })

  it('empty list and not scanning → shows "click Scan to see available networks"; while scanning → shows "Scanning..."', () => {
    expect(mountForm({ networks: [] }).w.text()).toContain('点击扫描查看可用网络')
    const busy = mountForm({ networks: [], scanning: true }).w
    expect(busy.get('.set-wifi-empty').text()).toContain('扫描中...')
  })

  it('a connected network shows "Connected" + a disconnect button; clicking it emits disconnect (without bubbling up to select it)', async () => {
    const connected: WifiScanResult[] = [{ ...NETS[0], connected: true }]
    const { w, form } = mountForm({ networks: connected })
    expect(w.get('.set-wifi-flag').text()).toBe('已连接')
    await w.get('.set-wifi-disconnect').trigger('click')
    expect(w.emitted('disconnect')).toBeTruthy()
    expect(form.wireless.ssid).toBe('') // Clicking disconnect shouldn't incidentally select this SSID
  })

  it('an unconnected but encrypted network shows a lock marker (with aria-label)', () => {
    const { w } = mountForm()
    expect(w.get('.set-wifi-lock').attributes('aria-label')).toBe('加密')
  })

  it('duplicate SSID names don\'t blow up (keyed by bssid; scans have been observed with ssid="00:00:00:00:00:00")', () => {
    const dup: WifiScanResult[] = [
      { ssid: '00:00:00:00:00:00', bssid: '10:5f:02:5b:e7:f8', signal: -52, channel: 11, secure: true, connected: false },
      { ssid: '00:00:00:00:00:00', bssid: '12:5f:02:9b:e7:f8', signal: -65, channel: 52, secure: true, connected: false },
    ]
    expect(mountForm({ networks: dup }).w.findAll('.set-wifi-row')).toHaveLength(2)
  })
})

describe('WifiForm — password and advanced settings', () => {
  it('the password box only appears once an SSID is selected, and writes into form.wireless.password', async () => {
    const { w, form } = mountForm()
    expect(w.find('.set-net-password').exists()).toBe(false)
    await w.findAll('.set-wifi-row')[0].trigger('click')
    const pw = w.get('.set-net-password')
    await pw.setValue('secret')
    expect(form.wireless.password).toBe('secret')
  })

  it('the advanced settings section only exists in client mode; not in concurrent mode (Vue2 L48\'s condition)', () => {
    const client = mountForm().w
    expect(client.find('.set-net-adv').exists()).toBe(true)

    const conc = hydrateForm(wifiIface('concurrent'))
    expect(mountForm({ form: conc }).w.find('.set-net-adv').exists()).toBe(false)
  })

  it('advanced settings is collapsed by default; opening it reveals zone / IPv4 assignment', async () => {
    const { w } = mountForm()
    expect(w.find('.set-net-zone').exists()).toBe(false)
    await w.get('.set-net-adv').trigger('click')
    expect(w.find('.set-net-zone').exists()).toBe(true)
    // In client mode, zone only has None / WAN (Vue2 L56-59, no LAN)
    const opts = w.get('.set-net-zone').findAll('option').map((o) => o.text())
    expect(opts).toEqual(['无', 'WAN'])
  })

  it('the four IP fields only appear when static is selected; DNS is written directly into form.dnsText — porting discipline #1', async () => {
    const { w, form } = mountForm()
    await w.get('.set-net-adv').trigger('click')
    expect(w.find('.set-net-ip').exists()).toBe(false)
    await w.get('.set-net-method').setValue('static')
    expect(form.ipv4.method).toBe('static')
    await w.get('.set-net-ip').setValue('10.0.0.9')
    await w.get('.set-net-mask').setValue('255.255.255.0')
    await w.get('.set-net-gw').setValue('10.0.0.1')
    await w.get('.set-net-dns').setValue('8.8.8.8, 1.1.1.1')
    expect(form.ipv4).toEqual({ method: 'static', address: '10.0.0.9', netmask: '255.255.255.0', gateway: '10.0.0.1' })
    expect(form.dnsText).toBe('8.8.8.8, 1.1.1.1') // ← In Vue2 this is a child component's private ref, discarded on save
  })
})
