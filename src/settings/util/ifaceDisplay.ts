// Display derivations for interface rows / dialog titles. Everything returns **i18n
// keys** (not translated text) and lets the component layer call t(), which eases unit
// testing and language switching.
// Maps to Vue2 SettingsPanel.vue's getIfaceTypeName (:2178) / wirelessModeLabel (:2190) /
// formatSpeed (:2236) and WifiForm.vue's signalIconHtml (:110).
import type { NetworkWirelessConfig } from '@nimotech/nimoos-service'
import type { MergedIface } from './netMerge'

/** Verbatim from the Vue 2 panel's src/components/settings/signalBars.js */
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

/** Vue2 does the bare division `${speedMbps / 1000} Gbps` -- 2500 -> "2.5 Gbps",
 *  1000 -> "1 Gbps". Copied as-is (no toFixed, otherwise 1000 would become "1.0 Gbps",
 *  diverging from Vue2). */
export function formatSpeed(mbps: number): string {
  if (!mbps || !Number.isFinite(mbps) || mbps <= 0) return ''
  if (mbps >= 1000) return `${mbps / 1000} Gbps`
  return `${mbps} Mbps`
}

/** Template L514-516: when speed is 0 the whole label disappears via v-if; when maxSpeed is larger, show both parts. */
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
