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

// curl 实证 2026-07-31 的两条(GET /v2/nimoos/network/wifi/scan?iface=wlp1s0)
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

describe('WifiForm —— 扫描列表(对位 Vue2 WifiForm.vue L3-39)', () => {
  it('列出每个 SSID + 信号条', () => {
    const { w } = mountForm()
    const rows = w.findAll('.set-wifi-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('NIMO_Network')
    expect(rows[0].get('.set-wifi-bar').text()).toBe('▅') // -45 → 满格
    expect(rows[1].get('.set-wifi-bar').text()).toBe('▃') // -70 → 三格
  })

  it('点某一行把 ssid 写进 form(共享对象,不是自己的副本)', async () => {
    const { w, form } = mountForm()
    await w.findAll('.set-wifi-row')[0].trigger('click')
    expect(form.wireless.ssid).toBe('NIMO_Network')
    expect(w.findAll('.set-wifi-row')[0].classes()).toContain('on')
  })

  it('扫描按钮 emit scan;scanning 时按钮禁用且文案变「扫描中...」', async () => {
    const { w } = mountForm()
    await w.get('.set-net-scan-btn').trigger('click')
    expect(w.emitted('scan')).toBeTruthy()

    const busy = mountForm({ scanning: true }).w
    expect(busy.get('.set-net-scan-btn').attributes('disabled')).toBeDefined()
    expect(busy.get('.set-net-scan-btn').text()).toBe('扫描中...')
  })

  it('空列表且不在扫描 → 提示「点击扫描查看可用网络」;扫描中 → 提示「扫描中...」', () => {
    expect(mountForm({ networks: [] }).w.text()).toContain('点击扫描查看可用网络')
    const busy = mountForm({ networks: [], scanning: true }).w
    expect(busy.get('.set-wifi-empty').text()).toContain('扫描中...')
  })

  it('已连接的网络显示「已连接」+ 断开按钮,点它 emit disconnect(不冒泡去选中)', async () => {
    const connected: WifiScanResult[] = [{ ...NETS[0], connected: true }]
    const { w, form } = mountForm({ networks: connected })
    expect(w.get('.set-wifi-flag').text()).toBe('已连接')
    await w.get('.set-wifi-disconnect').trigger('click')
    expect(w.emitted('disconnect')).toBeTruthy()
    expect(form.wireless.ssid).toBe('') // 点断开不该顺手把这个 SSID 选中
  })

  it('未连接但加密的网络显示锁标记(带 aria-label)', () => {
    const { w } = mountForm()
    expect(w.get('.set-wifi-lock').attributes('aria-label')).toBe('加密')
  })

  it('同名 SSID 不炸(key 用 bssid;实测扫描里有 ssid="00:00:00:00:00:00" 这种)', () => {
    const dup: WifiScanResult[] = [
      { ssid: '00:00:00:00:00:00', bssid: '10:5f:02:5b:e7:f8', signal: -52, channel: 11, secure: true, connected: false },
      { ssid: '00:00:00:00:00:00', bssid: '12:5f:02:9b:e7:f8', signal: -65, channel: 52, secure: true, connected: false },
    ]
    expect(mountForm({ networks: dup }).w.findAll('.set-wifi-row')).toHaveLength(2)
  })
})

describe('WifiForm —— 密码与高级设置', () => {
  it('选了 SSID 才出现密码框,写进 form.wireless.password', async () => {
    const { w, form } = mountForm()
    expect(w.find('.set-net-password').exists()).toBe(false)
    await w.findAll('.set-wifi-row')[0].trigger('click')
    const pw = w.get('.set-net-password')
    await pw.setValue('secret')
    expect(form.wireless.password).toBe('secret')
  })

  it('client 模式才有高级设置区;concurrent 模式没有(Vue2 L48 的条件)', () => {
    const client = mountForm().w
    expect(client.find('.set-net-adv').exists()).toBe(true)

    const conc = hydrateForm(wifiIface('concurrent'))
    expect(mountForm({ form: conc }).w.find('.set-net-adv').exists()).toBe(false)
  })

  it('高级设置默认折叠,点开出现 zone / IPv4 分配', async () => {
    const { w } = mountForm()
    expect(w.find('.set-net-zone').exists()).toBe(false)
    await w.get('.set-net-adv').trigger('click')
    expect(w.find('.set-net-zone').exists()).toBe(true)
    // client 模式的 zone 只有 无 / WAN 两项(Vue2 L56-59,没有 LAN)
    const opts = w.get('.set-net-zone').findAll('option').map((o) => o.text())
    expect(opts).toEqual(['无', 'WAN'])
  })

  it('选 static 才出现四个 IP 字段,DNS 直接写进 form.dnsText —— 移植纪律 #1', async () => {
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
    expect(form.dnsText).toBe('8.8.8.8, 1.1.1.1') // ← Vue2 这里是子组件私有 ref,保存时丢掉
  })
})
