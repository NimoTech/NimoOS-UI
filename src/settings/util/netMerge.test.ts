import { describe, it, expect } from 'vitest'
import { normalizeNetStats, mergeInterfaces, MaxSpeedMemo, VIRTUAL_AP_IFACE } from './netMerge'
import type { NetworkInterfaceConfig } from '@nimotech/nimoos-service'

// ── fixture A: data.net from GET /v1/sys/utilization (verified via curl, 2026-07-31) ──
// Note 3 interfaces: enp2s0 up, enp4s0 down, wlp1s0 down (**wlp1s0 is not in config**).
// And on this HTTP leg, max_speed is a real value: 1000.
const HTTP_NET = [
  { name: 'enp2s0', bytesSent: 7285564882, bytesRecv: 5743660811, packetsSent: 9428871, packetsRecv: 9033514,
    errin: 0, errout: 0, dropin: 0, dropout: 0, fifoin: 0, fifoout: 0,
    state: 'up', time: 1785507566, addr: '192.168.1.143', speed: 1000, max_speed: 1000 },
  { name: 'enp4s0', bytesSent: 0, bytesRecv: 0, packetsSent: 0, packetsRecv: 0,
    errin: 0, errout: 0, dropin: 0, dropout: 0, fifoin: 0, fifoout: 0,
    state: 'down', time: 1785507566, addr: '', speed: 0, max_speed: 1000 },
  { name: 'wlp1s0', bytesSent: 0, bytesRecv: 0, packetsSent: 0, packetsRecv: 0,
    errin: 0, errout: 0, dropin: 0, dropout: 0, fifoin: 0, fifoout: 0,
    state: 'down', time: 1785507566, addr: '', speed: 0, max_speed: 0 },
]

// ── fixture B: sys_net from the MessageBus nimoos:system:utilization push (verified via socket.io, 2026-07-31) ──
// **Same machine, same interface, max_speed is all 0** — periodical.go doesn't have the item.MaxSpeed line.
const SOCKET_NET = [
  { name: 'enp2s0', bytesSent: 7412676226, bytesRecv: 5750617476, packetsSent: 9538769, packetsRecv: 9103377,
    errin: 0, errout: 0, dropin: 0, dropout: 0, fifoin: 0, fifoout: 0,
    state: 'up', time: 1785508147, addr: '192.168.1.143', speed: 1000, max_speed: 0 },
]

// ── fixture C: GET /v2/nimoos/network/interfaces (verified via curl, 2026-07-31) ──
const CONFIGS: NetworkInterfaceConfig[] = [
  { name: 'enp2s0', type: 'ethernet', is_virtual: false, mac: '', state: '', ipv4: { method: 'dhcp' } },
  { name: 'enp4s0', type: 'ethernet', is_virtual: false, mac: '', state: '', ipv4: { method: 'dhcp' } },
]

describe('normalizeNetStats', () => {
  it('narrows the wide type (Record|null) from the shared package into an array', () => {
    expect(normalizeNetStats(HTTP_NET)).toHaveLength(3)
    expect(normalizeNetStats(HTTP_NET)[0]).toMatchObject({ name: 'enp2s0', state: 'up', speed: 1000 })
  })

  it('null / undefined / object / string all degrade to an empty array', () => {
    expect(normalizeNetStats(null)).toEqual([])
    expect(normalizeNetStats(undefined)).toEqual([])
    expect(normalizeNetStats({ enp2s0: {} })).toEqual([])
    expect(normalizeNetStats('[]')).toEqual([])
  })

  it('drops entries without a name; missing fields get default values', () => {
    const out = normalizeNetStats([{ name: 'x' }, { state: 'up' }, null, 42])
    expect(out).toEqual([{ name: 'x', state: '', addr: '', speed: 0, max_speed: 0 }])
  })
})

describe('mergeInterfaces —— the list source is utilization, config only supplements', () => {
  it('all three interfaces appear, including wlp1s0 which is not in config', () => {
    const rows = mergeInterfaces(HTTP_NET, CONFIGS)
    expect(rows.map((r) => r.name)).toEqual(['enp2s0', 'enp4s0', 'wlp1s0'])
  })

  it('state normalizes to up/down (case and whitespace handling matches Vue2 trim+toLowerCase)', () => {
    const rows = mergeInterfaces([
      { name: 'a', state: ' UP ' }, { name: 'b', state: 'down' }, { name: 'c', state: '' },
    ], [])
    expect(rows.map((r) => r.state)).toEqual(['up', 'down', 'down'])
  })

  it('runtime addr / speed / maxSpeed come from utilization', () => {
    const [eth] = mergeInterfaces(HTTP_NET, CONFIGS)
    expect(eth.addr).toBe('192.168.1.143')
    expect(eth.speed).toBe(1000)
    expect(eth.maxSpeed).toBe(1000)
  })

  it('zone / type / ipv4 / wireless / hybridCapable come from config', () => {
    const cfg: NetworkInterfaceConfig[] = [{
      name: 'wlp1s0', type: 'wifi', is_virtual: false, mac: '', state: '',
      zone: 'wan', ipv4: { method: 'dhcp' }, wireless: { mode: 'client', ssid: 'NIMO_Network' },
      hybridCapable: true,
    }]
    const [wifi] = mergeInterfaces([{ name: 'wlp1s0', state: 'up', addr: '10.0.0.5', speed: 0, max_speed: 0 }], cfg)
    expect(wifi.zone).toBe('wan')
    expect(wifi.type).toBe('wifi')
    expect(wifi.wireless).toEqual({ mode: 'client', ssid: 'NIMO_Network' })
    expect(wifi.hybridCapable).toBe(true)
  })

  it('interface not in config: zone/type empty, ipv4/wireless null, hybridCapable false, dhcp true', () => {
    const wlan = mergeInterfaces(HTTP_NET, CONFIGS)[2]
    expect(wlan.name).toBe('wlp1s0')
    expect(wlan.zone).toBe('')
    expect(wlan.type).toBe('')
    expect(wlan.ipv4).toBeNull()
    expect(wlan.wireless).toBeNull()
    expect(wlan.hybridCapable).toBe(false)
    expect(wlan.dhcp).toBe(true) // Vue2:cfg.ipv4 ? method!=='static' : true
  })

  it('static IP: config address overrides the displayed value, dhcp=false', () => {
    const cfg: NetworkInterfaceConfig[] = [{
      name: 'enp2s0', type: 'ethernet', is_virtual: false, mac: '', state: '',
      ipv4: { method: 'static', address: '192.168.1.250', netmask: '255.255.255.0' },
    }]
    const [row] = mergeInterfaces(
      [{ name: 'enp2s0', state: 'up', addr: '192.168.1.143', speed: 1000, max_speed: 1000 }], cfg)
    expect(row.addr).toBe('192.168.1.250')
    expect(row.dhcp).toBe(false)
  })

  it('static but config has no address → falls back to the runtime addr', () => {
    const cfg: NetworkInterfaceConfig[] = [
      { name: 'enp2s0', type: 'ethernet', is_virtual: false, mac: '', state: '', ipv4: { method: 'static' } },
    ]
    const [row] = mergeInterfaces(
      [{ name: 'enp2s0', state: 'up', addr: '192.168.1.143', speed: 0, max_speed: 0 }], cfg)
    expect(row.addr).toBe('192.168.1.143')
  })

  it('concurrent mode does not override even when method=static (that static IP belongs to the virtual AP interface)', () => {
    // Copied from Vue2 L2152's `&& cfg.wireless?.mode !== 'concurrent'`
    const cfg: NetworkInterfaceConfig[] = [{
      name: 'wlp1s0', type: 'wifi', is_virtual: false, mac: '', state: '',
      ipv4: { method: 'static', address: '192.168.22.1' }, wireless: { mode: 'concurrent' },
    }]
    const [row] = mergeInterfaces([{ name: 'wlp1s0', state: 'up', addr: '192.168.1.77', speed: 0, max_speed: 0 }], cfg)
    expect(row.addr).toBe('192.168.1.77')
    expect(row.dhcp).toBe(false) // the dhcp label still goes by method (Vue2 keeps these two checks separate)
  })

  it('skips the virtual AP interface wlan_ap', () => {
    const rows = mergeInterfaces([{ name: VIRTUAL_AP_IFACE, state: 'up' }, { name: 'enp2s0', state: 'up' }], [])
    expect(rows.map((r) => r.name)).toEqual(['enp2s0'])
  })

  it('isVirtual is determined by name prefix (not by the backend is_virtual field)', () => {
    // Backend is_virtual is deliberately set to false, but the frontend should still classify it as virtual — copied from Vue2 L2149
    const cfg: NetworkInterfaceConfig[] = [
      { name: 'docker0', type: 'bridge', is_virtual: false, mac: '', state: '' },
    ]
    const rows = mergeInterfaces([
      { name: 'zt5u4ycmnw', state: 'up' }, { name: 'docker0', state: 'up' },
      { name: 'br-571abdff3f8c', state: 'up' }, { name: 'vethd8ccc13', state: 'up' },
      { name: 'enp2s0', state: 'up' }, { name: 'wlp1s0', state: 'down' },
    ], cfg)
    expect(rows.filter((r) => r.isVirtual).map((r) => r.name))
      .toEqual(['zt5u4ycmnw', 'docker0', 'br-571abdff3f8c', 'vethd8ccc13'])
    expect(rows.filter((r) => !r.isVirtual).map((r) => r.name)).toEqual(['enp2s0', 'wlp1s0'])
  })
})

describe('MaxSpeedMemo —— the MessageBus push has no max_speed, the label must not flicker', () => {
  it('consumes HTTP first (real value), then socket (all 0): maxSpeed stays unchanged', () => {
    const memo = new MaxSpeedMemo()
    const first = mergeInterfaces(HTTP_NET, CONFIGS, memo)
    expect(first[0].maxSpeed).toBe(1000)

    // 5 seconds later the socket push arrives — max_speed is 0
    const second = mergeInterfaces(SOCKET_NET, CONFIGS, memo)
    expect(second[0].speed).toBe(1000)
    expect(second[0].maxSpeed).toBe(1000) // ← key: it did not drop to 0
  })

  it('updates when a larger real value comes in later (renegotiated to 2.5G after a cable swap)', () => {
    const memo = new MaxSpeedMemo()
    mergeInterfaces([{ name: 'enp2s0', state: 'up', addr: '', speed: 1000, max_speed: 1000 }], [], memo)
    const out = mergeInterfaces([{ name: 'enp2s0', state: 'up', addr: '', speed: 1000, max_speed: 2500 }], [], memo)
    expect(out[0].maxSpeed).toBe(2500)
  })

  it('without a memo, passes through the original value (the pure function can be used standalone)', () => {
    expect(mergeInterfaces(SOCKET_NET, [])[0].maxSpeed).toBe(0)
  })

  it('memo tracks per interface name, no cross-contamination', () => {
    const memo = new MaxSpeedMemo()
    mergeInterfaces(HTTP_NET, [], memo)
    const out = mergeInterfaces([
      { name: 'enp2s0', state: 'up', addr: '', speed: 1000, max_speed: 0 },
      { name: 'wlp1s0', state: 'down', addr: '', speed: 0, max_speed: 0 },
    ], [], memo)
    expect(out[0].maxSpeed).toBe(1000) // enp2s0 was recorded
    expect(out[1].maxSpeed).toBe(0)    // wlp1s0 was 0 to begin with
  })
})
