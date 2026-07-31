// 接口行 / 弹窗标题的展示派生。全部返回 **i18n key**(不返回已翻译文本),
// 让组件层去 t(),便于单测与语言切换。
// 对位 Vue2 SettingsPanel.vue 的 getIfaceTypeName(:2178)/ wirelessModeLabel(:2190)/
// formatSpeed(:2236)与 WifiForm.vue 的 signalIconHtml(:110)。
import type { NetworkWirelessConfig } from '@nimotech/nimoos-service'
import type { MergedIface } from './netMerge'

/** 逐字照 NimoOS-UI/src/components/settings/signalBars.js */
export const SIGNAL_BARS = ['▁', '▂', '▃', '▄', '▅'] as const

type IfaceLike = Pick<MergedIface, 'name' | 'type' | 'isVirtual' | 'wireless'>

export function ifaceTypeKey(iface: IfaceLike): string {
  if (iface.isVirtual) return 'settingsNetTypeVirtual'
  const name = (iface.name || '').toLowerCase()
  if (name.startsWith('wl') || name.startsWith('wlan')) {
    if (iface.wireless?.mode === 'ap') return 'settingsNetTypeHotspot'
    if (iface.wireless?.mode === 'concurrent') return 'settingsNetTypeWifiHotspot'
    return 'settingsNetTypeWifi'
  }
  if (iface.type === 'thunderbolt') return 'settingsNetTypeThunderbolt'
  return 'settingsNetTypeEthernet'
}

/** Vue2 是 `${speedMbps / 1000} Gbps` 的裸除法 —— 2500 → "2.5 Gbps"、1000 → "1 Gbps"。
 *  照抄(不加 toFixed,否则 1000 会变成 "1.0 Gbps",与 Vue2 不一致)。 */
export function formatSpeed(mbps: number): string {
  if (!mbps || !Number.isFinite(mbps) || mbps <= 0) return ''
  if (mbps >= 1000) return `${mbps / 1000} Gbps`
  return `${mbps} Mbps`
}

/** 模板 L514-516:speed 为 0 时整个标签靠 v-if 消失;maxSpeed 更大时显示两段。 */
export function speedLabel(speed: number, maxSpeed: number): string {
  const cur = formatSpeed(speed)
  if (!cur) return ''
  return maxSpeed > speed ? `${cur} / ${formatSpeed(maxSpeed)}` : cur
}

export function wirelessModeKey(wireless: NetworkWirelessConfig | null): string {
  if (!wireless) return ''
  if (wireless.mode === 'concurrent') return 'settingsNetModeHybrid'
  if (wireless.mode === 'client') return 'settingsNetModeClient'
  if (wireless.mode === 'ap') return 'settingsNetModeAp'
  return ''
}

export function signalBar(signal: number): string {
  if (signal >= 0) return SIGNAL_BARS[4]
  const abs = Math.abs(signal)
  if (abs <= 50) return SIGNAL_BARS[4]
  if (abs <= 60) return SIGNAL_BARS[3]
  if (abs <= 70) return SIGNAL_BARS[2]
  if (abs <= 80) return SIGNAL_BARS[1]
  return SIGNAL_BARS[0]
}

export function switchTargetKey(mode: 'ap' | 'client' | 'concurrent'): string {
  if (mode === 'ap') return 'settingsNetTargetAp'
  if (mode === 'client') return 'settingsNetTargetClient'
  return 'settingsNetTargetHybrid'
}
