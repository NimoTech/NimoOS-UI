// Data assembly layer for the interface list (spec §1.7 / §5.3).
//
// Why the list source is the `net` field of /v1/sys/utilization instead of
// /v2/nimoos/network/interfaces:
// The latter only has **configured** NICs (read from /etc/nimoos/network-config.json),
// so the local machine's wlp1s0 wouldn't be in there; the former is a live enumeration
// (GetNet(true) = physical interfaces only). Following Vue2 SettingsPanel.vue:2134-2176,
// **don't "optimize" this into listing config directly**, or the Wi-Fi card will
// disappear from the UI entirely.
//
// config is only used to match by name and then fill in zone / type / ipv4 / wireless /
// hybridCapable, and to override the displayed address when static IP is set.
import type { NetworkInterfaceConfig, NetworkIPv4Config, NetworkWirelessConfig } from '@nimotech/nimoos-service'

/** The virtual AP interface the backend creates in concurrent mode
 *  (NimoOS-Common/pkg/network/wifi_mode.go:15 VirtualApIfacePrefix = "wlan_ap");
 *  not shown as a standalone NIC in the UI. */
export const VIRTUAL_AP_IFACE = 'wlan_ap'

/** The fields we use from the `net` array of /v1/sys/utilization (maps to NimoOS
 *  model.IOCountersStat). Other traffic-counter fields (bytesSent etc.) aren't used
 *  by this milestone's UI, so they aren't part of the type. */
export interface NetRuntimeStat {
  name: string
  state: string
  addr: string
  speed: number
  max_speed: number
}

export interface MergedIface {
  name: string
  state: 'up' | 'down'
  speed: number
  maxSpeed: number
  addr: string
  dhcp: boolean
  isVirtual: boolean
  zone: string
  type: string
  ipv4: NetworkIPv4Config | null
  wireless: NetworkWirelessConfig | null
  hybridCapable: boolean
}

function numOr0(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}
function strOr(v: unknown, dflt = ''): string {
  return typeof v === 'string' ? v : dflt
}

/** The shared package's `Utilization.net` type is `Record<string, unknown> | null`,
 *  but the real value is an **array** (jget's `typeof [] === 'object'` in parseUtil
 *  passes it through as-is). We narrow it here.
 *  **Don't change that wide type in the shared package** — it's consumed by the
 *  home screen and widgets too; changing it has a wide blast radius. */
export function normalizeNetStats(net: unknown): NetRuntimeStat[] {
  if (!Array.isArray(net)) return []
  const out: NetRuntimeStat[] = []
  for (const raw of net) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const name = strOr(r.name)
    if (!name) continue
    out.push({
      name,
      state: strOr(r.state),
      addr: strOr(r.addr),
      speed: numOr0(r.speed),
      max_speed: numOr0(r.max_speed),
    })
  }
  return out
}

/** Remember each NIC's max_speed.
 *  ⚠️ Why this is needed: the same `net` data comes from two paths whose fields
 *    disagree —
 *    HTTP `/v1/sys/utilization` (NimoOS/route/v1/system.go:388) **has** item.MaxSpeed;
 *    the MessageBus 5-second push (NimoOS/route/periodical.go:44-47) **is missing that
 *    line** → max_speed is always 0 (verified via socket.io on 2026-07-31).
 *  The speed label is `maxSpeed > speed ? "1 Gbps / 2.5 Gbps" : "1 Gbps"`; if we fed it
 *  the push value directly, a 2.5G NIC negotiated down to 1G would flicker between the
 *  two label forms every 5 seconds. So we only update when we get a non-zero value. */
export class MaxSpeedMemo {
  private m = new Map<string, number>()
  remember(stats: NetRuntimeStat[]): void {
    for (const s of stats) {
      if (s.max_speed > 0) this.m.set(s.name, s.max_speed)
    }
  }
  get(name: string): number {
    return this.m.get(name) ?? 0
  }
}

/** The frontend determines virtual NICs by name prefix — **not the backend's
 *  is_virtual field** (following Vue2 L2149).
 *  Note: `data.net` comes from GetNet(true) = physical interfaces only, so this
 *  branch is unreachable on this machine; other machines (with ZeroTier etc.
 *  installed) may differ, so it's kept as-is for parity. */
function isVirtualName(name: string): boolean {
  return name.startsWith('zt') || name === 'docker0' || name.startsWith('br-') || name.startsWith('veth')
}

export function mergeInterfaces(
  net: unknown,
  configs: NetworkInterfaceConfig[] | null | undefined,
  memo?: MaxSpeedMemo,
): MergedIface[] {
  const stats = normalizeNetStats(net)
  memo?.remember(stats)
  const cfgs = Array.isArray(configs) ? configs : []

  const rows: MergedIface[] = []
  for (const s of stats) {
    if (s.name === VIRTUAL_AP_IFACE) continue
    const cfg = cfgs.find((c) => c && c.name === s.name)

    // Override the displayed address with config's address for static IP; but in
    // concurrent mode, the static IP belongs to the virtual AP interface — the
    // physical interface itself is a DHCP client → don't override (matches the
    // mode !== 'concurrent' condition in Vue2 L2152).
    const isStatic = !!cfg?.ipv4 && cfg.ipv4.method === 'static' && cfg.wireless?.mode !== 'concurrent'
    const addr = isStatic ? (cfg?.ipv4?.address || s.addr || '') : (s.addr || '')

    rows.push({
      name: s.name,
      state: s.state.trim().toLowerCase() === 'up' ? 'up' : 'down',
      speed: s.speed,
      maxSpeed: s.max_speed > 0 ? s.max_speed : (memo?.get(s.name) ?? 0),
      addr,
      dhcp: cfg?.ipv4 ? cfg.ipv4.method !== 'static' : true,
      isVirtual: isVirtualName(s.name),
      zone: cfg?.zone || '',
      type: cfg?.type || '',
      ipv4: cfg?.ipv4 ?? null,
      wireless: cfg?.wireless ?? null,
      hybridCapable: cfg?.hybridCapable || false,
    })
  }
  return rows
}
