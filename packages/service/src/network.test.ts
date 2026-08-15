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

  it('把标准信封误当数据时也不炸(异形退化)', async () => {
    const { http } = stub({ '/v2/nimoos/network/interfaces': { success: 200, data: [] } })
    expect(await createNetwork(http).getInterfaces()).toEqual([])
  })
})

describe('createNetwork.updateInterface', () => {
  it('PUT 到同一个 URL,body 原样下发', async () => {
    const { http, calls } = stub()
    await createNetwork(http).updateInterface({ name: 'wlp1s0', wireless: { mode: 'client' } })
    expect(calls[0].url).toBe('/v2/nimoos/network/interfaces')
    expect(calls[0].body).toEqual({ name: 'wlp1s0', wireless: { mode: 'client' } })
  })
})

describe('createNetwork.scanWifi', () => {
  // curl 实证 2026-07-31:GET /v2/nimoos/network/wifi/scan?iface=wlp1s0(取两条)
  const REAL = [
    { ssid: 'NIMO_Network', bssid: '60:a3:e3:a9:db:05', signal: -45, channel: 11, secure: true, connected: false },
    { ssid: 'TP-LINK_12E0', bssid: '9c:bf:cd:12:0d:d0', signal: -38, channel: 6, secure: true, connected: false },
  ]

  it('iface 走 params(axios 负责编码),返回数组', async () => {
    const { http, calls } = stub({ '/v2/nimoos/network/wifi/scan': REAL })
    const nets = await createNetwork(http).scanWifi('wlp1s0')
    expect(calls[0].url).toBe('/v2/nimoos/network/wifi/scan')
    expect(calls[0].params).toEqual({ iface: 'wlp1s0' })
    expect(nets[0].bssid).toBe('60:a3:e3:a9:db:05')
    expect(nets[0].signal).toBe(-45)
  })

  it('扫描失败时后端返回 HTTP 200 + null → 退化空数组(不是错误)', async () => {
    // 实证:iface=nosuch0 / 以太网口 / AP 模式 → 200 body=null(wifi.go:32 return nil, nil)
    const { http } = stub({ '/v2/nimoos/network/wifi/scan': null })
    expect(await createNetwork(http).scanWifi('nosuch0')).toEqual([])
  })
})

describe('networkErrorText', () => {
  it('从 {"error": …} 里取后端文本(network 域的错误体不是 message)', () => {
    // 实证:缺 iface → 400 {"error":"iface parameter is required"}
    //       名字非法 → 500 {"error":"invalid interface name: \"0bad\""}
    expect(networkErrorText({ response: { data: { error: 'iface parameter is required' } } }))
      .toBe('iface parameter is required')
    expect(networkErrorText({ response: { data: { error: 'invalid interface name: "0bad"' } } }))
      .toBe('invalid interface name: "0bad"')
  })

  it('没有可用文本时返回 undefined,让调用方用自己的兜底文案', () => {
    expect(networkErrorText({ response: { data: { message: 'ok' } } })).toBeUndefined()
    expect(networkErrorText({ response: { data: { error: '   ' } } })).toBeUndefined()
    expect(networkErrorText(new Error('boom'))).toBeUndefined()
    expect(networkErrorText(null)).toBeUndefined()
    expect(networkErrorText(undefined)).toBeUndefined()
  })
})
