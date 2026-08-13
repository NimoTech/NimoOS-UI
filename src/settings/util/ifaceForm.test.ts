import { describe, it, expect } from 'vitest'
import {
  createFormState, hydrateForm, buildUpdatePayload, isWifiName, isThunderboltType,
  parseDnsList, formatDnsList, AP_DEFAULTS,
} from './ifaceForm'
import type { MergedIface } from './netMerge'

function iface(p: Partial<MergedIface> = {}): MergedIface {
  return {
    name: 'enp2s0', state: 'up', speed: 1000, maxSpeed: 1000, addr: '192.168.1.143', dhcp: true,
    isVirtual: false, zone: '', type: 'ethernet', ipv4: null, wireless: null, hybridCapable: false,
    ...p,
  }
}

describe('isWifiName / isThunderboltType', () => {
  it('照 Vue2 的 /^wl|^wlan/i —— 大小写不敏感', () => {
    expect(isWifiName('wlp1s0')).toBe(true)
    expect(isWifiName('wlan0')).toBe(true)
    expect(isWifiName('WLP1S0')).toBe(true)
    expect(isWifiName('enp2s0')).toBe(false)
    expect(isWifiName('')).toBe(false)
  })
  it('thunderbolt 看 config 的 type 字段', () => {
    expect(isThunderboltType('thunderbolt')).toBe(true)
    expect(isThunderboltType('ethernet')).toBe(false)
    expect(isThunderboltType('')).toBe(false)
  })
})

describe('parseDnsList / formatDnsList', () => {
  it('逗号分隔、去空白、丢空项', () => {
    expect(parseDnsList('8.8.8.8, 1.1.1.1')).toEqual(['8.8.8.8', '1.1.1.1'])
    expect(parseDnsList(' 8.8.8.8 ,, ')).toEqual(['8.8.8.8'])
    expect(parseDnsList('')).toEqual([])
  })
  it('回显用 ", " 连接,null/undefined → 空串', () => {
    expect(formatDnsList(['8.8.8.8', '1.1.1.1'])).toBe('8.8.8.8, 1.1.1.1')
    expect(formatDnsList([])).toBe('')
    expect(formatDnsList(null)).toBe('')
    expect(formatDnsList(undefined)).toBe('')
  })
})

describe('hydrateForm —— 以太网(本机唯一真能点开的形态)', () => {
  it('config 里是 dhcp 的以太网:原样带出,zone 空,wireless.mode 空', () => {
    const f = hydrateForm(iface({ ipv4: { method: 'dhcp' } }))
    expect(f.name).toBe('enp2s0')
    expect(f.zone).toBe('')
    expect(f.ipv4).toEqual({ method: 'dhcp', address: '', netmask: '', gateway: '' })
    expect(f.dnsText).toBe('')
    expect(f.wireless.mode).toBe('')
  })

  it('静态 IP 的以太网:四个字段 + DNS 全部带出', () => {
    const f = hydrateForm(iface({
      zone: 'lan',
      ipv4: {
        method: 'static', address: '192.168.1.250', netmask: '255.255.255.0',
        gateway: '192.168.1.1', dns: ['8.8.8.8', '1.1.1.1'],
      },
    }))
    expect(f.zone).toBe('lan')
    expect(f.ipv4).toEqual({
      method: 'static', address: '192.168.1.250', netmask: '255.255.255.0', gateway: '192.168.1.1',
    })
    expect(f.dnsText).toBe('8.8.8.8, 1.1.1.1')
  })

  it('config 里完全没有这张网卡(ipv4=null):method 兜底 dhcp,不炸', () => {
    const f = hydrateForm(iface({ name: 'wlp1s0', ipv4: null, type: '' }))
    expect(f.ipv4.method).toBe('dhcp')
    expect(f.wireless.mode).toBe('')
  })

  it("ipv4.method 是空串时兜底 dhcp(Vue2 `|| 'dhcp'`)", () => {
    const f = hydrateForm(iface({ ipv4: { method: '' } }))
    expect(f.ipv4.method).toBe('dhcp')
  })
})

describe('hydrateForm —— Wi-Fi 三种模式的 zone/IP 默认值(Vue2 :199-287 逐条)', () => {
  it('ap:zone 强制 lan、method 强制 static、缺地址时给 192.168.22.1/24、缺 SSID 时给 NimoOS-Hotspot', () => {
    const f = hydrateForm(iface({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'ap' } }))
    expect(f.zone).toBe('lan')
    expect(f.ipv4.method).toBe('static')
    expect(f.ipv4.address).toBe(AP_DEFAULTS.address)
    expect(f.ipv4.netmask).toBe(AP_DEFAULTS.netmask)
    expect(f.wireless.apSsid).toBe(AP_DEFAULTS.ssid)
    expect(f.wireless.apPassword).toBe('')
  })

  it('ap:已有 apSsid / 地址时不覆盖', () => {
    const f = hydrateForm(iface({
      name: 'wlp1s0', type: 'wifi',
      ipv4: { method: 'static', address: '10.9.8.1', netmask: '255.255.255.0' },
      wireless: { mode: 'ap', apSsid: 'MyAP', apPassword: 'secret', channel: 6 },
    }))
    expect(f.wireless.apSsid).toBe('MyAP')
    expect(f.wireless.apPassword).toBe('secret')
    expect(f.wireless.channel).toBe(6)
    expect(f.ipv4.address).toBe('10.9.8.1')
  })

  it('client:zone 强制 wan、IP 强制回 dhcp 并清空静态残留(处理从 ap 切回来的脏值)', () => {
    const f = hydrateForm(iface({
      name: 'wlp1s0', type: 'wifi', zone: 'lan',
      ipv4: {
        method: 'static', address: '192.168.22.1', netmask: '255.255.255.0',
        gateway: '1.1.1.1', dns: ['8.8.8.8'],
      },
      wireless: { mode: 'client', ssid: 'NIMO_Network', password: 'p' },
    }))
    expect(f.zone).toBe('wan')
    expect(f.ipv4).toEqual({ method: 'dhcp', address: '', netmask: '', gateway: '' })
    expect(f.dnsText).toBe('')
    expect(f.wireless.ssid).toBe('NIMO_Network')
    expect(f.wireless.password).toBe('p')
  })

  it('concurrent:zone=wan 且 method=static(那个静态 IP 是虚拟 AP 口的)', () => {
    const f = hydrateForm(iface({
      name: 'wlp1s0', type: 'wifi',
      wireless: { mode: 'concurrent', ssid: 'up', apSsid: 'down' },
    }))
    expect(f.zone).toBe('wan')
    expect(f.ipv4.method).toBe('static')
    expect(f.ipv4.address).toBe(AP_DEFAULTS.address)
    expect(f.wireless.ssid).toBe('up')
    expect(f.wireless.apSsid).toBe('down')
  })

  it('非 wifi 网卡即使 config 里带 wireless 也不读进 wireless(Vue2 `isWifi && val.wireless`)', () => {
    const f = hydrateForm(iface({ name: 'enp2s0', wireless: { mode: 'ap', apSsid: 'X' } }))
    expect(f.wireless.mode).toBe('')
    expect(f.wireless.apSsid).toBe('')
    // But the zone block in Vue2 **ignores isWifi** -- ap still forces zone to lan; copied as-is
    expect(f.zone).toBe('lan')
  })
})

describe('hydrateForm —— 切模式入口(_switchMode / _switchTab)', () => {
  it('switchMode=ap:清空旧模式字段,zone=lan,给 AP 默认值', () => {
    const f = hydrateForm(
      iface({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client', ssid: 'old', password: 'oldpw' } }),
      { switchMode: 'ap' },
    )
    expect(f.wireless.mode).toBe('ap')
    expect(f.wireless.ssid).toBe('')
    expect(f.wireless.password).toBe('')
    expect(f.zone).toBe('lan')
    expect(f.wireless.apSsid).toBe(AP_DEFAULTS.ssid)
    expect(f.ipv4.method).toBe('static')
  })

  it('switchMode=client:清空 AP 字段 + IP 回 dhcp + zone=wan', () => {
    const f = hydrateForm(
      iface({
        name: 'wlp1s0', type: 'wifi', zone: 'lan',
        ipv4: { method: 'static', address: '192.168.22.1', netmask: '255.255.255.0' },
        wireless: { mode: 'ap', apSsid: 'MyAP', apPassword: 'pw', channel: 36 },
      }),
      { switchMode: 'client' },
    )
    expect(f.wireless.mode).toBe('client')
    expect(f.wireless.apSsid).toBe('')
    expect(f.wireless.apPassword).toBe('')
    expect(f.wireless.channel).toBe(0)
    expect(f.zone).toBe('wan')
    expect(f.ipv4).toEqual({ method: 'dhcp', address: '', netmask: '', gateway: '' })
  })

  it('switchTab=hybrid:mode=concurrent、zone=wan,**两边已有数据都保留**', () => {
    const f = hydrateForm(
      iface({
        name: 'wlp1s0', type: 'wifi',
        wireless: { mode: 'client', ssid: 'NIMO_Network', password: 'pw', apSsid: 'MyAP', apPassword: 'appw' },
      }),
      { switchTab: 'hybrid' },
    )
    expect(f.wireless.mode).toBe('concurrent')
    expect(f.zone).toBe('wan')
    expect(f.wireless.ssid).toBe('NIMO_Network')
    expect(f.wireless.password).toBe('pw')
    expect(f.wireless.apSsid).toBe('MyAP')
    expect(f.wireless.apPassword).toBe('appw')
  })

  it('createFormState 的初值与 Vue2 data() 一致', () => {
    expect(createFormState()).toEqual({
      name: '', zone: '',
      ipv4: { method: 'dhcp', address: '', netmask: '', gateway: '' },
      dnsText: '',
      wireless: { mode: '', ssid: '', apSsid: '', password: '', apPassword: '', channel: 0 },
    })
  })
})

describe('buildUpdatePayload —— 以太网', () => {
  it('dhcp:只下发 name/zone/ipv4.method,不带静态字段,也不带 wireless', () => {
    const f = hydrateForm(iface({ ipv4: { method: 'dhcp' } }))
    const r = buildUpdatePayload(f, iface({}))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.payload).toEqual({ name: 'enp2s0', zone: '', ipv4: { method: 'dhcp' } })
    expect('wireless' in r.payload).toBe(false)
  })

  it('static:带 address/netmask/gateway/dns', () => {
    const f = hydrateForm(iface({
      zone: 'lan',
      ipv4: {
        method: 'static', address: '192.168.1.250', netmask: '255.255.255.0',
        gateway: '192.168.1.1', dns: ['8.8.8.8'],
      },
    }))
    const r = buildUpdatePayload(f, iface({}))
    if (!r.ok) throw new Error('should build')
    expect(r.payload).toEqual({
      name: 'enp2s0', zone: 'lan',
      ipv4: {
        method: 'static', address: '192.168.1.250', netmask: '255.255.255.0',
        gateway: '192.168.1.1', dns: ['8.8.8.8'],
      },
    })
  })

  it('用户在高级设置里填的 DNS 会真的下发 —— 移植纪律 #1(Vue2 这里静默丢了)', () => {
    const f = hydrateForm(iface({ ipv4: { method: 'static', address: '10.0.0.2', netmask: '255.255.255.0' } }))
    f.dnsText = ' 9.9.9.9 , 1.1.1.1 '
    const r = buildUpdatePayload(f, iface({}))
    if (!r.ok) throw new Error('should build')
    expect(r.payload.ipv4?.dns).toEqual(['9.9.9.9', '1.1.1.1'])
  })
})

describe('buildUpdatePayload —— Thunderbolt', () => {
  it('恒 static,四字段 + dns 全下发,不带 wireless', () => {
    const tb = iface({ name: 'tb0', type: 'thunderbolt' })
    const f = hydrateForm(tb)
    f.ipv4.address = '169.254.1.1'
    f.ipv4.netmask = '255.255.0.0'
    f.ipv4.gateway = '0.0.0.0'
    f.dnsText = '8.8.8.8'
    const r = buildUpdatePayload(f, tb)
    if (!r.ok) throw new Error('should build')
    expect(r.payload.ipv4).toEqual({
      method: 'static', address: '169.254.1.1', netmask: '255.255.0.0', gateway: '0.0.0.0', dns: ['8.8.8.8'],
    })
    expect('wireless' in r.payload).toBe(false)
  })
})

describe('buildUpdatePayload —— Wi-Fi 三种模式', () => {
  const wifi = iface({ name: 'wlp1s0', type: 'wifi' })

  it('client:wireless 只带 mode/ssid/password;ipv4 走 method(dhcp)', () => {
    const f = hydrateForm(iface({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } }))
    f.wireless.ssid = 'NIMO_Network'
    f.wireless.password = 'pw'
    const r = buildUpdatePayload(f, wifi)
    if (!r.ok) throw new Error('should build')
    expect(r.payload).toEqual({
      name: 'wlp1s0', zone: 'wan',
      ipv4: { method: 'dhcp' },
      wireless: { mode: 'client', ssid: 'NIMO_Network', password: 'pw' },
    })
  })

  it('ap:ipv4 强制 static 并对空值兜底 192.168.22.1/24;wireless 带 apSsid/apPassword', () => {
    const f = hydrateForm(iface({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'ap' } }))
    f.ipv4.address = '' // The user cleared the address
    f.ipv4.netmask = ''
    const r = buildUpdatePayload(f, wifi)
    if (!r.ok) throw new Error('should build')
    expect(r.payload.ipv4).toEqual({
      method: 'static', address: '192.168.22.1', netmask: '255.255.255.0', gateway: '', dns: [],
    })
    expect(r.payload.wireless).toEqual({ mode: 'ap', apSsid: 'NimoOS-Hotspot', apPassword: '' })
  })

  it('ap:channel > 0 才下发(0=自动,Vue2 判 `> 0`)', () => {
    const f = hydrateForm(iface({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'ap', apSsid: 'X' } }))
    f.wireless.channel = 0
    const auto = buildUpdatePayload(f, wifi)
    if (!auto.ok) throw new Error('should build')
    expect('channel' in (auto.payload.wireless ?? {})).toBe(false)

    f.wireless.channel = 36
    const fixed = buildUpdatePayload(f, wifi)
    if (!fixed.ok) throw new Error('should build')
    expect(fixed.payload.wireless?.channel).toBe(36)
  })

  it('concurrent:client 与 AP 两组字段**同时**下发,ipv4 static', () => {
    const f = hydrateForm(iface({
      name: 'wlp1s0', type: 'wifi',
      wireless: { mode: 'concurrent', ssid: 'NIMO_Network', password: 'cpw', apSsid: 'MyAP', apPassword: 'appw' },
    }))
    const r = buildUpdatePayload(f, wifi)
    if (!r.ok) throw new Error('should build')
    expect(r.payload.wireless).toEqual({
      mode: 'concurrent', ssid: 'NIMO_Network', password: 'cpw', apSsid: 'MyAP', apPassword: 'appw',
    })
    expect(r.payload.ipv4?.method).toBe('static')
    expect(r.payload.zone).toBe('wan')
  })

  it('wifi 但 mode 为空 / manual → 不构造 payload(界面提示「没有可保存的配置」)', () => {
    const empty = buildUpdatePayload(hydrateForm(wifi), wifi)
    expect(empty).toEqual({ ok: false, reason: 'nothing-to-save' })

    const manual = hydrateForm(wifi)
    manual.wireless.mode = 'manual'
    expect(buildUpdatePayload(manual, wifi)).toEqual({ ok: false, reason: 'nothing-to-save' })
  })

  it("client 模式下 ssid/password 为空也下发空串(Vue2 `|| ''`,用于断连语义)", () => {
    const f = hydrateForm(iface({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } }))
    const r = buildUpdatePayload(f, wifi)
    if (!r.ok) throw new Error('should build')
    expect(r.payload.wireless).toEqual({ mode: 'client', ssid: '', password: '' })
  })
})
