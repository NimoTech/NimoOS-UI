import { describe, it, expect } from 'vitest'
import {
  createFormState, hydrateForm, buildUpdatePayload, isWifiName, isThunderboltType,
  parseDnsList, formatDnsList, AP_DEFAULTS,
} from './ifaceForm'
import type { MergedIface } from './netMerge'

function iface(p: Partial<MergedIface> = {}): MergedIface {
  return {
    name: 'enp2s0', state: 'up', speed: 1000, maxSpeed: 1000, addr: '192.168.1.10', dhcp: true,
    isVirtual: false, zone: '', type: 'ethernet', ipv4: null, wireless: null, hybridCapable: false,
    ...p,
  }
}

describe('isWifiName / isThunderboltType', () => {
  it('matches Vue2 /^wl|^wlan/i —— case-insensitive', () => {
    expect(isWifiName('wlp1s0')).toBe(true)
    expect(isWifiName('wlan0')).toBe(true)
    expect(isWifiName('WLP1S0')).toBe(true)
    expect(isWifiName('enp2s0')).toBe(false)
    expect(isWifiName('')).toBe(false)
  })
  it('thunderbolt goes by the config type field', () => {
    expect(isThunderboltType('thunderbolt')).toBe(true)
    expect(isThunderboltType('ethernet')).toBe(false)
    expect(isThunderboltType('')).toBe(false)
  })
})

describe('parseDnsList / formatDnsList', () => {
  it('comma-separated, trims whitespace, drops empty entries', () => {
    expect(parseDnsList('8.8.8.8, 1.1.1.1')).toEqual(['8.8.8.8', '1.1.1.1'])
    expect(parseDnsList(' 8.8.8.8 ,, ')).toEqual(['8.8.8.8'])
    expect(parseDnsList('')).toEqual([])
  })
  it('displayed value joins with ", ", null/undefined → empty string', () => {
    expect(formatDnsList(['8.8.8.8', '1.1.1.1'])).toBe('8.8.8.8, 1.1.1.1')
    expect(formatDnsList([])).toBe('')
    expect(formatDnsList(null)).toBe('')
    expect(formatDnsList(undefined)).toBe('')
  })
})

describe('hydrateForm —— ethernet (the only form actually clickable on this machine)', () => {
  it('ethernet with dhcp in config: carried over as-is, zone empty, wireless.mode empty', () => {
    const f = hydrateForm(iface({ ipv4: { method: 'dhcp' } }))
    expect(f.name).toBe('enp2s0')
    expect(f.zone).toBe('')
    expect(f.ipv4).toEqual({ method: 'dhcp', address: '', netmask: '', gateway: '' })
    expect(f.dnsText).toBe('')
    expect(f.wireless.mode).toBe('')
  })

  it('ethernet with static IP: all four fields plus DNS are carried over', () => {
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

  it('this interface is entirely absent from config (ipv4=null): method falls back to dhcp, no crash', () => {
    const f = hydrateForm(iface({ name: 'wlp1s0', ipv4: null, type: '' }))
    expect(f.ipv4.method).toBe('dhcp')
    expect(f.wireless.mode).toBe('')
  })

  it("falls back to dhcp when ipv4.method is an empty string (Vue2 `|| 'dhcp'`)", () => {
    const f = hydrateForm(iface({ ipv4: { method: '' } }))
    expect(f.ipv4.method).toBe('dhcp')
  })
})

describe('hydrateForm —— Wi-Fi three-mode zone/IP defaults (Vue2 :199-287, line by line)', () => {
  it('ap: zone forced to lan, method forced to static, missing address defaults to 192.168.22.1/24, missing SSID defaults to NimoOS-Hotspot', () => {
    const f = hydrateForm(iface({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'ap' } }))
    expect(f.zone).toBe('lan')
    expect(f.ipv4.method).toBe('static')
    expect(f.ipv4.address).toBe(AP_DEFAULTS.address)
    expect(f.ipv4.netmask).toBe(AP_DEFAULTS.netmask)
    expect(f.wireless.apSsid).toBe(AP_DEFAULTS.ssid)
    expect(f.wireless.apPassword).toBe('')
  })

  it('ap: does not override when apSsid / address are already set', () => {
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

  it('client: zone forced to wan, IP forced back to dhcp and static leftovers cleared (handles dirty values left over when switching back from ap)', () => {
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

  it('concurrent: zone=wan and method=static (that static IP belongs to the virtual AP interface)', () => {
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

  it('a non-wifi interface never reads wireless in, even if config carries a wireless block (Vue2 `isWifi && val.wireless`)', () => {
    const f = hydrateForm(iface({ name: 'enp2s0', wireless: { mode: 'ap', apSsid: 'X' } }))
    expect(f.wireless.mode).toBe('')
    expect(f.wireless.apSsid).toBe('')
    // But the zone block in Vue2 **ignores isWifi** -- ap still forces zone to lan; copied as-is
    expect(f.zone).toBe('lan')
  })
})

describe('hydrateForm —— mode-switch entry points (_switchMode / _switchTab)', () => {
  it('switchMode=ap: clears the old mode fields, zone=lan, applies AP defaults', () => {
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

  it('switchMode=client: clears AP fields + IP back to dhcp + zone=wan', () => {
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

  it('switchTab=hybrid: mode=concurrent, zone=wan, **existing data on both sides is preserved**', () => {
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

  it('createFormState initial values match Vue2 data()', () => {
    expect(createFormState()).toEqual({
      name: '', zone: '',
      ipv4: { method: 'dhcp', address: '', netmask: '', gateway: '' },
      dnsText: '',
      wireless: { mode: '', ssid: '', apSsid: '', password: '', apPassword: '', channel: 0 },
    })
  })
})

describe('buildUpdatePayload —— ethernet', () => {
  it('dhcp: only emits name/zone/ipv4.method, no static fields, no wireless', () => {
    const f = hydrateForm(iface({ ipv4: { method: 'dhcp' } }))
    const r = buildUpdatePayload(f, iface({}))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.payload).toEqual({ name: 'enp2s0', zone: '', ipv4: { method: 'dhcp' } })
    expect('wireless' in r.payload).toBe(false)
  })

  it('static: carries address/netmask/gateway/dns', () => {
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

  it('DNS entered by the user in advanced settings is actually emitted —— porting discipline #1 (Vue2 silently dropped it here)', () => {
    const f = hydrateForm(iface({ ipv4: { method: 'static', address: '10.0.0.2', netmask: '255.255.255.0' } }))
    f.dnsText = ' 9.9.9.9 , 1.1.1.1 '
    const r = buildUpdatePayload(f, iface({}))
    if (!r.ok) throw new Error('should build')
    expect(r.payload.ipv4?.dns).toEqual(['9.9.9.9', '1.1.1.1'])
  })
})

describe('buildUpdatePayload —— Thunderbolt', () => {
  it('always static, all four fields + dns are emitted, no wireless', () => {
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

describe('buildUpdatePayload —— Wi-Fi three modes', () => {
  const wifi = iface({ name: 'wlp1s0', type: 'wifi' })

  it('client: wireless only carries mode/ssid/password; ipv4 goes by method (dhcp)', () => {
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

  it('ap: ipv4 forced to static and empty values default to 192.168.22.1/24; wireless carries apSsid/apPassword', () => {
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

  it('ap: channel is only emitted when > 0 (0=auto, Vue2 checks `> 0`)', () => {
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

  it('concurrent: client and AP field groups are emitted **at the same time**, ipv4 static', () => {
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

  it('wifi but mode is empty / manual → no payload built (UI shows: nothing to save)', () => {
    const empty = buildUpdatePayload(hydrateForm(wifi), wifi)
    expect(empty).toEqual({ ok: false, reason: 'nothing-to-save' })

    const manual = hydrateForm(wifi)
    manual.wireless.mode = 'manual'
    expect(buildUpdatePayload(manual, wifi)).toEqual({ ok: false, reason: 'nothing-to-save' })
  })

  it("in client mode, an empty ssid/password still emits an empty string (Vue2 `|| ''`, used for the disconnect semantics)", () => {
    const f = hydrateForm(iface({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } }))
    const r = buildUpdatePayload(f, wifi)
    if (!r.ok) throw new Error('should build')
    expect(r.payload.wireless).toEqual({ mode: 'client', ssid: '', password: '' })
  })
})
