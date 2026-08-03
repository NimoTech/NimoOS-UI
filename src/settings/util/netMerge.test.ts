import { describe, it, expect } from 'vitest'
import { normalizeNetStats, mergeInterfaces, MaxSpeedMemo, VIRTUAL_AP_IFACE } from './netMerge'
import type { NetworkInterfaceConfig } from '@nimotech/nimoos-service'

// ── fixture A:GET /v1/sys/utilization 的 data.net(curl 实证 2026-07-31)──
// 注意 3 个口:enp2s0 up、enp4s0 down、wlp1s0 down(**wlp1s0 不在 config 里**)。
// 且 HTTP 这条腿 max_speed 是真值 1000。
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

// ── fixture B:MessageBus nimoos:system:utilization 推送里的 sys_net(socket.io 实证 2026-07-31)──
// **同一台机器同一个口,max_speed 全是 0** —— periodical.go 没有 item.MaxSpeed 那一行。
const SOCKET_NET = [
  { name: 'enp2s0', bytesSent: 7412676226, bytesRecv: 5750617476, packetsSent: 9538769, packetsRecv: 9103377,
    errin: 0, errout: 0, dropin: 0, dropout: 0, fifoin: 0, fifoout: 0,
    state: 'up', time: 1785508147, addr: '192.168.1.143', speed: 1000, max_speed: 0 },
]

// ── fixture C:GET /v2/nimoos/network/interfaces(curl 实证 2026-07-31)──
const CONFIGS: NetworkInterfaceConfig[] = [
  { name: 'enp2s0', type: 'ethernet', is_virtual: false, mac: '', state: '', ipv4: { method: 'dhcp' } },
  { name: 'enp4s0', type: 'ethernet', is_virtual: false, mac: '', state: '', ipv4: { method: 'dhcp' } },
]

describe('normalizeNetStats', () => {
  it('把共享包的宽类型(Record|null)收窄成数组', () => {
    expect(normalizeNetStats(HTTP_NET)).toHaveLength(3)
    expect(normalizeNetStats(HTTP_NET)[0]).toMatchObject({ name: 'enp2s0', state: 'up', speed: 1000 })
  })

  it('null / undefined / 对象 / 字符串 一律退化成空数组', () => {
    expect(normalizeNetStats(null)).toEqual([])
    expect(normalizeNetStats(undefined)).toEqual([])
    expect(normalizeNetStats({ enp2s0: {} })).toEqual([])
    expect(normalizeNetStats('[]')).toEqual([])
  })

  it('丢掉没有 name 的条目,缺字段补默认值', () => {
    const out = normalizeNetStats([{ name: 'x' }, { state: 'up' }, null, 42])
    expect(out).toEqual([{ name: 'x', state: '', addr: '', speed: 0, max_speed: 0 }])
  })
})

describe('mergeInterfaces —— 列表源是 utilization,config 只做补充', () => {
  it('三个口全出现,包括 config 里没有的 wlp1s0', () => {
    const rows = mergeInterfaces(HTTP_NET, CONFIGS)
    expect(rows.map((r) => r.name)).toEqual(['enp2s0', 'enp4s0', 'wlp1s0'])
  })

  it('state 归一成 up/down(大小写与空白照 Vue2 trim+toLowerCase)', () => {
    const rows = mergeInterfaces([
      { name: 'a', state: ' UP ' }, { name: 'b', state: 'down' }, { name: 'c', state: '' },
    ], [])
    expect(rows.map((r) => r.state)).toEqual(['up', 'down', 'down'])
  })

  it('运行时 addr / speed / maxSpeed 取 utilization', () => {
    const [eth] = mergeInterfaces(HTTP_NET, CONFIGS)
    expect(eth.addr).toBe('192.168.1.143')
    expect(eth.speed).toBe(1000)
    expect(eth.maxSpeed).toBe(1000)
  })

  it('zone / type / ipv4 / wireless / hybridCapable 取 config', () => {
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

  it('config 里没有的口:zone/type 空、ipv4/wireless null、hybridCapable false、dhcp true', () => {
    const wlan = mergeInterfaces(HTTP_NET, CONFIGS)[2]
    expect(wlan.name).toBe('wlp1s0')
    expect(wlan.zone).toBe('')
    expect(wlan.type).toBe('')
    expect(wlan.ipv4).toBeNull()
    expect(wlan.wireless).toBeNull()
    expect(wlan.hybridCapable).toBe(false)
    expect(wlan.dhcp).toBe(true) // Vue2:cfg.ipv4 ? method!=='static' : true
  })

  it('静态 IP:用 config 的 address 覆盖显示,dhcp=false', () => {
    const cfg: NetworkInterfaceConfig[] = [{
      name: 'enp2s0', type: 'ethernet', is_virtual: false, mac: '', state: '',
      ipv4: { method: 'static', address: '192.168.1.250', netmask: '255.255.255.0' },
    }]
    const [row] = mergeInterfaces(
      [{ name: 'enp2s0', state: 'up', addr: '192.168.1.143', speed: 1000, max_speed: 1000 }], cfg)
    expect(row.addr).toBe('192.168.1.250')
    expect(row.dhcp).toBe(false)
  })

  it('静态但 config 没写 address → 回落运行时 addr', () => {
    const cfg: NetworkInterfaceConfig[] = [
      { name: 'enp2s0', type: 'ethernet', is_virtual: false, mac: '', state: '', ipv4: { method: 'static' } },
    ]
    const [row] = mergeInterfaces(
      [{ name: 'enp2s0', state: 'up', addr: '192.168.1.143', speed: 0, max_speed: 0 }], cfg)
    expect(row.addr).toBe('192.168.1.143')
  })

  it('concurrent 模式即使 method=static 也不覆盖(那个静态 IP 是虚拟 AP 口的)', () => {
    // 照抄 Vue2 L2152 的 `&& cfg.wireless?.mode !== 'concurrent'`
    const cfg: NetworkInterfaceConfig[] = [{
      name: 'wlp1s0', type: 'wifi', is_virtual: false, mac: '', state: '',
      ipv4: { method: 'static', address: '192.168.22.1' }, wireless: { mode: 'concurrent' },
    }]
    const [row] = mergeInterfaces([{ name: 'wlp1s0', state: 'up', addr: '192.168.1.77', speed: 0, max_speed: 0 }], cfg)
    expect(row.addr).toBe('192.168.1.77')
    expect(row.dhcp).toBe(false) // dhcp 标签仍按 method 判(Vue2 两个判断是分开的)
  })

  it('跳过虚拟 AP 口 wlan_ap', () => {
    const rows = mergeInterfaces([{ name: VIRTUAL_AP_IFACE, state: 'up' }, { name: 'enp2s0', state: 'up' }], [])
    expect(rows.map((r) => r.name)).toEqual(['enp2s0'])
  })

  it('isVirtual 按名字前缀判定(不用后端的 is_virtual 字段)', () => {
    // 后端 is_virtual 故意给成 false,前端仍要判成虚拟 —— 照抄 Vue2 L2149
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

describe('MaxSpeedMemo —— MessageBus 推送没有 max_speed,不能让标签闪', () => {
  it('先吃 HTTP(有真值)再吃 socket(全 0):maxSpeed 保持不变', () => {
    const memo = new MaxSpeedMemo()
    const first = mergeInterfaces(HTTP_NET, CONFIGS, memo)
    expect(first[0].maxSpeed).toBe(1000)

    // 5 秒后 socket 推送到达 —— max_speed 是 0
    const second = mergeInterfaces(SOCKET_NET, CONFIGS, memo)
    expect(second[0].speed).toBe(1000)
    expect(second[0].maxSpeed).toBe(1000) // ← 关键:没有掉成 0
  })

  it('后来拿到更大的真值时会更新(换网线协商到 2.5G)', () => {
    const memo = new MaxSpeedMemo()
    mergeInterfaces([{ name: 'enp2s0', state: 'up', addr: '', speed: 1000, max_speed: 1000 }], [], memo)
    const out = mergeInterfaces([{ name: 'enp2s0', state: 'up', addr: '', speed: 1000, max_speed: 2500 }], [], memo)
    expect(out[0].maxSpeed).toBe(2500)
  })

  it('不传 memo 时按原值走(纯函数可单独使用)', () => {
    expect(mergeInterfaces(SOCKET_NET, [])[0].maxSpeed).toBe(0)
  })

  it('memo 按网卡名分别记,不串味', () => {
    const memo = new MaxSpeedMemo()
    mergeInterfaces(HTTP_NET, [], memo)
    const out = mergeInterfaces([
      { name: 'enp2s0', state: 'up', addr: '', speed: 1000, max_speed: 0 },
      { name: 'wlp1s0', state: 'down', addr: '', speed: 0, max_speed: 0 },
    ], [], memo)
    expect(out[0].maxSpeed).toBe(1000) // enp2s0 记过
    expect(out[1].maxSpeed).toBe(0)    // wlp1s0 本来就是 0
  })
})
