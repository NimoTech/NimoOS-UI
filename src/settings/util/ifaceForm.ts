// 接口配置弹窗的表单状态与 PUT payload 构造。
// 逐条对位 Vue2 NetworkIfaceConfigModal.vue 的 watch.iface(:191-299)与 save()(:359-422)。
//
// 为什么全抽成纯函数:PUT /v2/nimoos/network/interfaces 在这台开发机上**一次都不能真发**
// (NimoOS/route/v2/network.go:88 在末尾无条件 ApplyGatewayConfig() 重写 dnsmasq / nftables /
//  ip_forward,而这台机器的 SSH 生命线 enp2s0 就是被配置的那张网卡)
// → 写路径的正确性只能靠这里的单测(见台账 .superpowers/sdd/sp9/03-p2.md 债务 D18)。
//
// 移植纪律 #1(登记):Vue2 的 WifiForm / HotspotForm 各自持有一份 dnsString(子组件 data),
// created() 从 formData.ipv4.dns 初始化,用户改了**从不回写父层**;而 save() 用的是父层那份
// → **高级设置里填的 DNS 被静默丢弃**。这里 DNS 统一由 form.dnsText 持有,子表单直接绑它,
// 不再有第二份。
import type { NetworkInterfaceUpdate } from '@nimotech/nimoos-service'
import type { MergedIface } from './netMerge'

/** Vue2 的热点默认值(NetworkIfaceConfigModal.vue:260 / 267-268 / 306 / 309-310)。 */
export const AP_DEFAULTS = {
  ssid: 'NimoOS-Hotspot',
  address: '192.168.22.1',
  netmask: '255.255.255.0',
} as const

export interface IfaceFormState {
  name: string
  zone: string
  ipv4: { method: string; address: string; netmask: string; gateway: string }
  /** DNS 在表单里是一行逗号分隔文本,只在下发时才 split(等同 Vue2 的 dnsString) */
  dnsText: string
  wireless: { mode: string; ssid: string; apSsid: string; password: string; apPassword: string; channel: number }
}

export type HydrateOpts = { switchMode?: 'ap' | 'client' | 'concurrent'; switchTab?: 'hybrid' }

export type BuildResult =
  | { ok: true; payload: NetworkInterfaceUpdate }
  | { ok: false; reason: 'nothing-to-save' }

/** 照 Vue2 `/^wl|^wlan/i`(两个分支等价于 ^wl,原样保留语义)。 */
export function isWifiName(name: string): boolean {
  return /^wl/i.test(name || '')
}

export function isThunderboltType(type: string): boolean {
  return type === 'thunderbolt'
}

export function parseDnsList(text: string): string[] {
  return (text || '').split(',').map((s) => s.trim()).filter((s) => s)
}

export function formatDnsList(dns?: string[] | null): string {
  return (dns || []).join(', ')
}

export function createFormState(): IfaceFormState {
  return {
    name: '',
    zone: '',
    ipv4: { method: 'dhcp', address: '', netmask: '', gateway: '' },
    dnsText: '',
    wireless: { mode: '', ssid: '', apSsid: '', password: '', apPassword: '', channel: 0 },
  }
}

export function hydrateForm(iface: MergedIface, opts: HydrateOpts = {}): IfaceFormState {
  const f = createFormState()
  const isWifi = isWifiName(iface.name)

  f.name = iface.name
  f.zone = iface.zone || ''

  // AP 强制 LAN;client / concurrent 在 zone 未设时默认 WAN。
  // ⚠️ Vue2 这一段**不看 isWifi**(只看 config 里有没有 wireless)—— 照抄,别"修正"。
  if (iface.wireless) {
    if (iface.wireless.mode === 'ap') {
      f.zone = 'lan'
    } else if ((iface.wireless.mode === 'client' || iface.wireless.mode === 'concurrent') && !f.zone) {
      f.zone = 'wan'
    }
  }

  if (iface.ipv4) {
    f.ipv4.method = iface.ipv4.method || 'dhcp'
    f.ipv4.address = iface.ipv4.address || ''
    f.ipv4.netmask = iface.ipv4.netmask || ''
    f.ipv4.gateway = iface.ipv4.gateway || ''
    f.dnsText = formatDnsList(iface.ipv4.dns)
  }

  if (isWifi && iface.wireless) {
    f.wireless.mode = iface.wireless.mode || ''
    f.wireless.ssid = iface.wireless.ssid || ''
    f.wireless.apSsid = iface.wireless.apSsid || ''
    f.wireless.password = iface.wireless.password || ''
    f.wireless.apPassword = iface.wireless.apPassword || ''
    f.wireless.channel = iface.wireless.channel || 0
  }

  // 用户显式切模式(ap↔client):清掉上一个模式的字段
  if (opts.switchMode) {
    f.wireless.mode = opts.switchMode
    f.wireless.ssid = ''
    f.wireless.password = ''
    f.wireless.apSsid = ''
    f.wireless.apPassword = ''
    f.wireless.channel = 0
    if (opts.switchMode === 'client') {
      f.ipv4.method = 'dhcp'
      f.ipv4.address = ''
      f.ipv4.netmask = ''
      f.ipv4.gateway = ''
      f.dnsText = ''
    }
    if (opts.switchMode === 'ap') f.zone = 'lan'
    else if (opts.switchMode === 'concurrent') f.zone = 'wan'
  }

  // 混合模式:两边数据都保留(Vue2 注释 "Keep existing data on both sides")
  if (opts.switchTab === 'hybrid') {
    f.wireless.mode = 'concurrent'
    f.zone = 'wan'
  }

  // 按最终模式补默认值(顺序照 Vue2 :259-287)
  if (f.wireless.mode === 'ap' && !f.wireless.apSsid) {
    f.wireless.apSsid = AP_DEFAULTS.ssid
    f.wireless.apPassword = ''
  }
  if (f.wireless.mode === 'ap' || f.wireless.mode === 'concurrent') {
    f.zone = f.wireless.mode === 'ap' ? 'lan' : 'wan'
    f.ipv4.method = 'static'
    if (!f.ipv4.address) {
      f.ipv4.address = AP_DEFAULTS.address
      f.ipv4.netmask = AP_DEFAULTS.netmask
    }
  }
  // client 恒 DHCP + WAN —— 清掉从 AP 模式残留的静态 IP / zone
  if (f.wireless.mode === 'client') {
    f.zone = 'wan'
    f.ipv4.method = 'dhcp'
    f.ipv4.address = ''
    f.ipv4.netmask = ''
    f.ipv4.gateway = ''
    f.dnsText = ''
  }

  return f
}

export function buildUpdatePayload(form: IfaceFormState, iface: Pick<MergedIface, 'name' | 'type'>): BuildResult {
  const isWifi = isWifiName(iface.name)
  const isTb = isThunderboltType(iface.type)
  const payload: NetworkInterfaceUpdate = { name: form.name, zone: form.zone }

  if (isWifi) {
    const mode = form.wireless.mode
    if (!mode || mode === 'manual') return { ok: false, reason: 'nothing-to-save' }
    payload.wireless = { mode }
  }

  const dns = parseDnsList(form.dnsText)

  if (isTb) {
    payload.ipv4 = {
      method: 'static',
      address: form.ipv4.address,
      netmask: form.ipv4.netmask,
      gateway: form.ipv4.gateway,
      dns,
    }
  } else if (isWifi && (form.wireless.mode === 'ap' || form.wireless.mode === 'concurrent')) {
    payload.ipv4 = {
      method: 'static',
      address: form.ipv4.address || AP_DEFAULTS.address,
      netmask: form.ipv4.netmask || AP_DEFAULTS.netmask,
      gateway: form.ipv4.gateway,
      dns,
    }
  } else {
    // 以太网,或 wifi client 模式
    payload.ipv4 = { method: form.ipv4.method }
    if (form.ipv4.method === 'static') {
      payload.ipv4.address = form.ipv4.address
      payload.ipv4.netmask = form.ipv4.netmask
      payload.ipv4.gateway = form.ipv4.gateway
      payload.ipv4.dns = dns
    }
  }

  if (isWifi && payload.wireless) {
    if (form.wireless.mode === 'client' || form.wireless.mode === 'concurrent') {
      payload.wireless.ssid = form.wireless.ssid || ''
      payload.wireless.password = form.wireless.password || ''
    }
    if (form.wireless.mode === 'ap' || form.wireless.mode === 'concurrent') {
      payload.wireless.apSsid = form.wireless.apSsid
      payload.wireless.apPassword = form.wireless.apPassword || ''
      if (form.wireless.channel > 0) payload.wireless.channel = form.wireless.channel
    }
  }

  return { ok: true, payload }
}
