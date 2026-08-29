// Form state and PUT payload construction for the interface config dialog.
// Maps line-by-line to Vue2 NetworkIfaceConfigModal.vue's watch.iface (:191-299) and
// save() (:359-422).
//
// Why everything is extracted into pure functions: PUT /v2/nimoos/network/interfaces
// can **never actually be sent** on this dev machine (NimoOS/route/v2/network.go:88
// unconditionally calls ApplyGatewayConfig() at the end, rewriting dnsmasq / nftables /
// ip_forward, and this machine's SSH lifeline enp2s0 is exactly the NIC being configured)
// -> the write path's correctness can only be covered by the unit tests here.
//
// Porting discipline #1 (on record): Vue2's WifiForm / HotspotForm each hold their own
// dnsString (child component data), initialized from formData.ipv4.dns in created();
// user edits are **never written back to the parent**, while save() uses the parent's
// copy -> **DNS entered in advanced settings is silently dropped**. Here DNS is held
// solely by form.dnsText, the child forms bind to it directly, and no second copy exists.
import type { NetworkInterfaceUpdate } from '@nimotech/nimoos-service'
import type { MergedIface } from './netMerge'

/** Vue2's hotspot defaults (NetworkIfaceConfigModal.vue:260 / 267-268 / 306 / 309-310). */
export const AP_DEFAULTS = {
  ssid: 'NimoOS-Hotspot',
  address: '192.168.22.1',
  netmask: '255.255.255.0',
} as const

export interface IfaceFormState {
  name: string
  zone: string
  ipv4: { method: string; address: string; netmask: string; gateway: string }
  /** DNS is a single comma-separated text line in the form, only split on submit (equivalent to Vue2's dnsString) */
  dnsText: string
  wireless: { mode: string; ssid: string; apSsid: string; password: string; apPassword: string; channel: number }
}

export type HydrateOpts = { switchMode?: 'ap' | 'client' | 'concurrent'; switchTab?: 'hybrid' }

export type BuildResult =
  | { ok: true; payload: NetworkInterfaceUpdate }
  | { ok: false; reason: 'nothing-to-save' }

/** Following Vue2's `/^wl|^wlan/i` (the two branches are equivalent to ^wl; semantics kept as-is). */
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

  // AP forces LAN; client / concurrent default to WAN when zone is unset.
  // ⚠️ This Vue2 block **ignores isWifi** (it only checks whether config has wireless) -- copied as-is, do not "fix".
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

  // User explicitly switches mode (ap<->client): clear the previous mode's fields
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

  // Hybrid mode: keep data on both sides (Vue2 comment "Keep existing data on both sides")
  if (opts.switchTab === 'hybrid') {
    f.wireless.mode = 'concurrent'
    f.zone = 'wan'
  }

  // Fill defaults per the final mode (order follows Vue2 :259-287)
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
  // client is always DHCP + WAN -- clear static IP / zone left over from AP mode
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
    // Ethernet, or wifi client mode
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
