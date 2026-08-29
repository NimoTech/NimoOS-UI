import { describe, it, expect } from 'vitest'
import {
  ifaceTypeKey, formatSpeed, speedLabel, wirelessModeKey, signalBar, switchTargetKey, SIGNAL_BARS,
} from './ifaceDisplay'
import type { MergedIface } from './netMerge'

function row(p: Partial<MergedIface>): MergedIface {
  return {
    name: 'enp2s0', state: 'up', speed: 0, maxSpeed: 0, addr: '', dhcp: true,
    isVirtual: false, zone: '', type: '', ipv4: null, wireless: null, hybridCapable: false,
    ...p,
  }
}

describe('ifaceTypeKey — maps to Vue2 getIfaceTypeName (SettingsPanel.vue:2178-2188)', () => {
  it('virtual interfaces take priority (checks isVirtual first, then the name)', () => {
    expect(ifaceTypeKey(row({ name: 'docker0', isVirtual: true, type: 'bridge' }))).toBe('settingsNetTypeVirtual')
    expect(ifaceTypeKey(row({ name: 'wlx00', isVirtual: true }))).toBe('settingsNetTypeVirtual')
  })

  it('wl / wlan prefix → split by wireless.mode into Wi-Fi / hotspot / Wi-Fi+hotspot', () => {
    expect(ifaceTypeKey(row({ name: 'wlp1s0' }))).toBe('settingsNetTypeWifi')
    expect(ifaceTypeKey(row({ name: 'wlp1s0', wireless: { mode: 'client' } }))).toBe('settingsNetTypeWifi')
    expect(ifaceTypeKey(row({ name: 'wlp1s0', wireless: { mode: 'ap' } }))).toBe('settingsNetTypeHotspot')
    expect(ifaceTypeKey(row({ name: 'wlan0', wireless: { mode: 'concurrent' } }))).toBe('settingsNetTypeWifiHotspot')
  })

  it('uppercase interface names are also recognized (Vue2 does toLowerCase first)', () => {
    expect(ifaceTypeKey(row({ name: 'WLP1S0' }))).toBe('settingsNetTypeWifi')
  })

  it('type=thunderbolt → Thunderbolt; everything else is Ethernet', () => {
    expect(ifaceTypeKey(row({ name: 'thunderbolt0', type: 'thunderbolt' }))).toBe('settingsNetTypeThunderbolt')
    expect(ifaceTypeKey(row({ name: 'enp2s0', type: 'ethernet' }))).toBe('settingsNetTypeEthernet')
    expect(ifaceTypeKey(row({ name: 'enp4s0', type: '' }))).toBe('settingsNetTypeEthernet')
  })
})

describe('formatSpeed / speedLabel — maps to Vue2 formatSpeed (:2236) + template L514-516', () => {
  it('≥1000 switches to Gbps (no decimals when evenly divisible, Vue2 uses raw division)', () => {
    expect(formatSpeed(1000)).toBe('1 Gbps')
    expect(formatSpeed(2500)).toBe('2.5 Gbps')
    expect(formatSpeed(10000)).toBe('10 Gbps')
  })
  it('<1000 uses Mbps', () => {
    expect(formatSpeed(100)).toBe('100 Mbps')
    expect(formatSpeed(1)).toBe('1 Mbps')
  })
  it('0 / negative / NaN → empty string (the template hides the whole label via v-if)', () => {
    expect(formatSpeed(0)).toBe('')
    expect(formatSpeed(-1)).toBe('')
    expect(formatSpeed(Number.NaN)).toBe('')
  })
  it('shows "negotiated rate / cap" when maxSpeed is larger', () => {
    expect(speedLabel(1000, 2500)).toBe('1 Gbps / 2.5 Gbps')
  })
  it('shows only speed when maxSpeed is not greater than speed (this device\'s 1000/1000 is this case)', () => {
    expect(speedLabel(1000, 1000)).toBe('1 Gbps')
    expect(speedLabel(1000, 0)).toBe('1 Gbps')
  })
  it('empty string overall when speed is 0 (a down interface shows no speed label)', () => {
    expect(speedLabel(0, 1000)).toBe('')
  })
})

describe('wirelessModeKey — maps to Vue2 wirelessModeLabel (:2190)', () => {
  it('the key for each of the three modes; unknown/no wireless → empty string', () => {
    expect(wirelessModeKey({ mode: 'client' })).toBe('settingsNetModeClient')
    expect(wirelessModeKey({ mode: 'ap' })).toBe('settingsNetModeAp')
    expect(wirelessModeKey({ mode: 'concurrent' })).toBe('settingsNetModeHybrid')
    expect(wirelessModeKey({ mode: 'manual' })).toBe('')
    expect(wirelessModeKey(null)).toBe('')
  })
})

describe('signalBar — maps to Vue2 signalIconHtml (WifiForm.vue:110-118)', () => {
  it('the 5-tier thresholds copied verbatim (tiers by absolute value)', () => {
    expect(signalBar(0)).toBe(SIGNAL_BARS[4])   // >=0 -> full bars
    expect(signalBar(-45)).toBe(SIGNAL_BARS[4]) // measured: NIMO_Network
    expect(signalBar(-50)).toBe(SIGNAL_BARS[4]) // boundary: <=50
    expect(signalBar(-55)).toBe(SIGNAL_BARS[3]) // measured: TP-LINK_12E0-5G
    expect(signalBar(-60)).toBe(SIGNAL_BARS[3]) // boundary
    expect(signalBar(-70)).toBe(SIGNAL_BARS[2]) // boundary & measured: ChinaNet-D2yt
    expect(signalBar(-75)).toBe(SIGNAL_BARS[1])
    expect(signalBar(-80)).toBe(SIGNAL_BARS[1]) // boundary
    expect(signalBar(-95)).toBe(SIGNAL_BARS[0])
  })
  it('the five characters are exactly Vue2\'s five (signalBars.js verbatim)', () => {
    expect(SIGNAL_BARS).toEqual(['▁', '▂', '▃', '▄', '▅'])
  })
})

describe('switchTargetKey — target mode name shown in the confirmation dialog (Vue2 labels table :2200-2204)', () => {
  it('the key for each of the three targets', () => {
    expect(switchTargetKey('ap')).toBe('settingsNetTargetAp')
    expect(switchTargetKey('client')).toBe('settingsNetTargetClient')
    expect(switchTargetKey('concurrent')).toBe('settingsNetTargetHybrid')
  })
})
