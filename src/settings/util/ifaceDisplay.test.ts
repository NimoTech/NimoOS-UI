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

describe('ifaceTypeKey —— 对位 Vue2 getIfaceTypeName(SettingsPanel.vue:2178-2188)', () => {
  it('虚拟口优先(先判 isVirtual,再判名字)', () => {
    expect(ifaceTypeKey(row({ name: 'docker0', isVirtual: true, type: 'bridge' }))).toBe('settingsNetTypeVirtual')
    expect(ifaceTypeKey(row({ name: 'wlx00', isVirtual: true }))).toBe('settingsNetTypeVirtual')
  })

  it('wl / wlan 前缀 → 按 wireless.mode 分 Wi-Fi / 热点 / Wi-Fi+热点', () => {
    expect(ifaceTypeKey(row({ name: 'wlp1s0' }))).toBe('settingsNetTypeWifi')
    expect(ifaceTypeKey(row({ name: 'wlp1s0', wireless: { mode: 'client' } }))).toBe('settingsNetTypeWifi')
    expect(ifaceTypeKey(row({ name: 'wlp1s0', wireless: { mode: 'ap' } }))).toBe('settingsNetTypeHotspot')
    expect(ifaceTypeKey(row({ name: 'wlan0', wireless: { mode: 'concurrent' } }))).toBe('settingsNetTypeWifiHotspot')
  })

  it('大写网卡名也认(Vue2 先 toLowerCase)', () => {
    expect(ifaceTypeKey(row({ name: 'WLP1S0' }))).toBe('settingsNetTypeWifi')
  })

  it('type=thunderbolt → Thunderbolt;其余一律以太网', () => {
    expect(ifaceTypeKey(row({ name: 'thunderbolt0', type: 'thunderbolt' }))).toBe('settingsNetTypeThunderbolt')
    expect(ifaceTypeKey(row({ name: 'enp2s0', type: 'ethernet' }))).toBe('settingsNetTypeEthernet')
    expect(ifaceTypeKey(row({ name: 'enp4s0', type: '' }))).toBe('settingsNetTypeEthernet')
  })
})

describe('formatSpeed / speedLabel —— 对位 Vue2 formatSpeed(:2236)+ 模板 L514-516', () => {
  it('≥1000 换 Gbps(整除时不留小数,Vue2 是裸除法)', () => {
    expect(formatSpeed(1000)).toBe('1 Gbps')
    expect(formatSpeed(2500)).toBe('2.5 Gbps')
    expect(formatSpeed(10000)).toBe('10 Gbps')
  })
  it('<1000 用 Mbps', () => {
    expect(formatSpeed(100)).toBe('100 Mbps')
    expect(formatSpeed(1)).toBe('1 Mbps')
  })
  it('0 / 负数 / NaN → 空串(模板靠 v-if 隐藏整个标签)', () => {
    expect(formatSpeed(0)).toBe('')
    expect(formatSpeed(-1)).toBe('')
    expect(formatSpeed(Number.NaN)).toBe('')
  })
  it('maxSpeed 更大时显示「协商速率 / 上限」', () => {
    expect(speedLabel(1000, 2500)).toBe('1 Gbps / 2.5 Gbps')
  })
  it('maxSpeed 不大于 speed 时只显示 speed(本机 1000/1000 就是这条)', () => {
    expect(speedLabel(1000, 1000)).toBe('1 Gbps')
    expect(speedLabel(1000, 0)).toBe('1 Gbps')
  })
  it('speed 为 0 时整体空串(down 的口不显示速率标签)', () => {
    expect(speedLabel(0, 1000)).toBe('')
  })
})

describe('wirelessModeKey —— 对位 Vue2 wirelessModeLabel(:2190)', () => {
  it('三种模式各自的 key,未知/无线为空 → 空串', () => {
    expect(wirelessModeKey({ mode: 'client' })).toBe('settingsNetModeClient')
    expect(wirelessModeKey({ mode: 'ap' })).toBe('settingsNetModeAp')
    expect(wirelessModeKey({ mode: 'concurrent' })).toBe('settingsNetModeHybrid')
    expect(wirelessModeKey({ mode: 'manual' })).toBe('')
    expect(wirelessModeKey(null)).toBe('')
  })
})

describe('signalBar —— 对位 Vue2 signalIconHtml(WifiForm.vue:110-118)', () => {
  it('5 档阈值逐字照抄(用绝对值分档)', () => {
    expect(signalBar(0)).toBe(SIGNAL_BARS[4])   // >=0 → 满格
    expect(signalBar(-45)).toBe(SIGNAL_BARS[4]) // 实测 NIMO_Network
    expect(signalBar(-50)).toBe(SIGNAL_BARS[4]) // 边界:<=50
    expect(signalBar(-55)).toBe(SIGNAL_BARS[3]) // 实测 TP-LINK_12E0-5G
    expect(signalBar(-60)).toBe(SIGNAL_BARS[3]) // 边界
    expect(signalBar(-70)).toBe(SIGNAL_BARS[2]) // 边界 & 实测 ChinaNet-D2yt
    expect(signalBar(-75)).toBe(SIGNAL_BARS[1])
    expect(signalBar(-80)).toBe(SIGNAL_BARS[1]) // 边界
    expect(signalBar(-95)).toBe(SIGNAL_BARS[0])
  })
  it('五个字符就是 Vue2 的那五个(signalBars.js 逐字)', () => {
    expect(SIGNAL_BARS).toEqual(['▁', '▂', '▃', '▄', '▅'])
  })
})

describe('switchTargetKey —— 确认框里的目标模式名(Vue2 labels 表 :2200-2204)', () => {
  it('三个目标各自的 key', () => {
    expect(switchTargetKey('ap')).toBe('settingsNetTargetAp')
    expect(switchTargetKey('client')).toBe('settingsNetTargetClient')
    expect(switchTargetKey('concurrent')).toBe('settingsNetTargetHybrid')
  })
})
