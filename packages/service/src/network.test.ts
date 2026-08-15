import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createNetwork, networkErrorText } from './network'
import type { NetworkInterfaceConfig } from './types.js'

// http stub that records calls: get returns by url, put records url + body
function stub(getMap: Record<string, unknown> = {}) {
  const calls: { url: string; body?: unknown; params?: unknown }[] = []
  const http = {
    get: async (url: string, cfg?: { params?: unknown }) => {
      calls.push({ url, params: cfg?.params })
      return { data: getMap[url] }
    },
    put: async (url: string, body: unknown) => {
      calls.push({ url, body })
      return { data: { message: 'success' } }
    },
  } as unknown as AxiosInstance
  return { http, calls }
}

describe('createNetwork.getInterfaces', () => {
  // Verified via curl on 2026-07-31: GET /v2/nimoos/network/interfaces → a bare array, mac/state are empty strings,
  // an interface that has never been configured (wlp1s0) isn't in there at all.
  const REAL: NetworkInterfaceConfig[] = [
    { name: 'enp2s0', type: 'ethernet', is_virtual: false, mac: '', state: '', ipv4: { method: 'dhcp' } },
    { name: 'enp4s0', type: 'ethernet', is_virtual: false, mac: '', state: '', ipv4: { method: 'dhcp' } },
  ]

  it('hits the /v2-prefixed bare JSON endpoint, no unwrap', async () => {
    const { http, calls } = stub({ '/v2/nimoos/network/interfaces': REAL })
    const list = await createNetwork(http).getInterfaces()
    expect(calls[0].url).toBe('/v2/nimoos/network/interfaces')
    expect(list).toHaveLength(2)
    expect(list[0].name).toBe('enp2s0')
    expect(list[0].ipv4?.method).toBe('dhcp')
  })

  it('degrades to an empty array when body is null (Go nil slice), never throws', async () => {
    // When network-config.json is an empty map, GetAllInterfaceConfigs returns a nil slice → c.JSON(200, nil) → null
    const { http } = stub({ '/v2/nimoos/network/interfaces': null })
    expect(await createNetwork(http).getInterfaces()).toEqual([])
  })

  it('does not blow up when a standard envelope is mistaken for data (malformed shape degrades gracefully)', async () => {
    const { http } = stub({ '/v2/nimoos/network/interfaces': { success: 200, data: [] } })
    expect(await createNetwork(http).getInterfaces()).toEqual([])
  })
})

describe('createNetwork.updateInterface', () => {
  it('PUT hits the same URL, body is passed through as-is', async () => {
    const { http, calls } = stub()
    await createNetwork(http).updateInterface({ name: 'wlp1s0', wireless: { mode: 'client' } })
    expect(calls[0].url).toBe('/v2/nimoos/network/interfaces')
    expect(calls[0].body).toEqual({ name: 'wlp1s0', wireless: { mode: 'client' } })
  })
})

describe('createNetwork.scanWifi', () => {
  // Verified via curl on 2026-07-31: GET /v2/nimoos/network/wifi/scan?iface=wlp1s0 (took two entries)
  const REAL = [
    { ssid: 'NIMO_Network', bssid: '60:a3:e3:a9:db:05', signal: -45, channel: 11, secure: true, connected: false },
    { ssid: 'TP-LINK_12E0', bssid: '9c:bf:cd:12:0d:d0', signal: -38, channel: 6, secure: true, connected: false },
  ]

  it('iface goes through params (axios handles encoding), returns an array', async () => {
    const { http, calls } = stub({ '/v2/nimoos/network/wifi/scan': REAL })
    const nets = await createNetwork(http).scanWifi('wlp1s0')
    expect(calls[0].url).toBe('/v2/nimoos/network/wifi/scan')
    expect(calls[0].params).toEqual({ iface: 'wlp1s0' })
    expect(nets[0].bssid).toBe('60:a3:e3:a9:db:05')
    expect(nets[0].signal).toBe(-45)
  })

  it('when scan fails, backend returns HTTP 200 + null → degrades to an empty array (not an error)', async () => {
    // Verified: iface=nosuch0 / ethernet port / AP mode → 200 body=null (wifi.go:32 return nil, nil)
    const { http } = stub({ '/v2/nimoos/network/wifi/scan': null })
    expect(await createNetwork(http).scanWifi('nosuch0')).toEqual([])
  })
})

describe('networkErrorText', () => {
  it('reads the backend text out of {"error": ...} (the network domain error body is not message)', () => {
    // Verified: missing iface → 400 {"error":"iface parameter is required"}
    //           invalid name → 500 {"error":"invalid interface name: \"0bad\""}
    expect(networkErrorText({ response: { data: { error: 'iface parameter is required' } } }))
      .toBe('iface parameter is required')
    expect(networkErrorText({ response: { data: { error: 'invalid interface name: "0bad"' } } }))
      .toBe('invalid interface name: "0bad"')
  })

  it('returns undefined when there is no usable text, letting the caller use its own fallback message', () => {
    expect(networkErrorText({ response: { data: { message: 'ok' } } })).toBeUndefined()
    expect(networkErrorText({ response: { data: { error: '   ' } } })).toBeUndefined()
    expect(networkErrorText(new Error('boom'))).toBeUndefined()
    expect(networkErrorText(null)).toBeUndefined()
    expect(networkErrorText(undefined)).toBeUndefined()
  })
})
