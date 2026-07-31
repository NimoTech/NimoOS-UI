// 接口列表的数据装配层(spec §1.7 / §5.3)。
//
// 为什么列表源是 /v1/sys/utilization 的 net 而不是 /v2/nimoos/network/interfaces:
// 后者只有**配置过**的网卡(读 /etc/nimoos/network-config.json),本机的 wlp1s0 就不在里面;
// 前者是实时枚举(GetNet(true) = 只物理口)。照 Vue2 SettingsPanel.vue:2134-2176 的做法,
// **不要"优化"成直接列 config**,否则 Wi-Fi 卡会整个从界面消失。
//
// config 只用来按 name 匹配后补 zone / type / ipv4 / wireless / hybridCapable,
// 并在静态 IP 时覆盖显示地址。
import type { NetworkInterfaceConfig, NetworkIPv4Config, NetworkWirelessConfig } from '@nimotech/nimoos-service'

/** concurrent 模式下后端造出来的虚拟 AP 口(NimoOS-Common/pkg/network/wifi_mode.go:15
 *  VirtualApIfacePrefix = "wlan_ap"),界面上不作为独立网卡展示。 */
export const VIRTUAL_AP_IFACE = 'wlan_ap'

/** /v1/sys/utilization 的 net 数组里我们要用的字段(对位 NimoOS model.IOCountersStat)。
 *  其余流量计数字段(bytesSent 等)本期界面不用,不进类型。 */
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

/** 共享包的 `Utilization.net` 类型是 `Record<string, unknown> | null`,而真实值是**数组**
 *  (parseUtil 的 jget 里 `typeof [] === 'object'` 原样透过)。这里收窄。
 *  **不要去改共享包那个宽类型** —— 主页/小组件都在吃它,改了波及面大。 */
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

/** 记住每张网卡的 max_speed。
 *  ⚠️ 为什么需要:同一份 net 数据两条腿字段不一致 ——
 *    HTTP  `/v1/sys/utilization`(NimoOS/route/v1/system.go:388)**有** item.MaxSpeed;
 *    MessageBus 5 秒推送(NimoOS/route/periodical.go:44-47)**没有那一行** → max_speed 恒 0
 *    (socket.io 实证 2026-07-31)。
 *  速率标签是 `maxSpeed > speed ? "1 Gbps / 2.5 Gbps" : "1 Gbps"`,若直接吃推送值,
 *  2.5G 网卡协商在 1G 时标签会每 5 秒在两种形态之间闪。所以只在拿到非零值时更新。 */
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

/** 前端按名字前缀判定虚拟网卡 —— **不用后端的 is_virtual 字段**(照 Vue2 L2149)。
 *  注:`data.net` 来自 GetNet(true)=只物理口,所以这个分支在本机不可达;
 *  别的机器(装了 ZeroTier 等)未必如此,故照抄保留。 */
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

    // 静态 IP 时以 config 的 address 覆盖显示;但 concurrent 模式的静态 IP 属于虚拟 AP 口,
    // 物理口自己是 DHCP 客户端 → 不覆盖(Vue2 L2152 的 mode !== 'concurrent' 条件)。
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
