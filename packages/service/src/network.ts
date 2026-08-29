import type { AxiosInstance } from 'axios'
import type { NetworkInterfaceConfig, NetworkInterfaceUpdate, WifiScanResult } from './types.js'

// The network domain = NimoOS core's /v2/nimoos/network/* (NimoOS/route/v2/network.go).
//
// ⚠️ Envelope: **bare JSON, zero unwrap layers**. Everything in that file is c.JSON(status, payload):
//    success bodies are the array/object directly, error bodies are {"error": "..."} — NOT the system-wide
//    Result{Success,Message,Data}. So error paths rely on axios rejecting on HTTP status,
//    **never pass through unwrap()** (it would always throw). Use networkErrorText below to get the backend error text.
//
// ⚠️ Both GETs may return HTTP 200 + body `null` (Go nil slice):
//    - interfaces: when network-config.json is an empty map
//    - wifi/scan: when `iw dev X scan` fails (NIC missing / ethernet port / AP mode not supporting scans,
//      NimoOS-Common/pkg/network/wifi.go:32-35 explicitly return nil, nil)
//    → always guard with Array.isArray and return [], so consumers need not guard again.
export function createNetwork(http: AxiosInstance) {
  return {
    /** GET /v2/nimoos/network/interfaces — persisted config (reads /etc/nimoos/network-config.json).
     *  Note this contains **only NICs that have been configured**; the UI's interface list must use /v1/sys/utilization's net as its source.
     *  Also: mac / state / speed / ports are never filled by the backend (GetAllInterfaceConfigs only builds
     *  name/type/is_virtual/ipv4/zone/wireless/hybridCapable). */
    async getInterfaces(): Promise<NetworkInterfaceConfig[]> {
      const res = await http.get('/v2/nimoos/network/interfaces')
      return Array.isArray(res.data) ? (res.data as NetworkInterfaceConfig[]) : []
    },

    /** PUT /v2/nimoos/network/interfaces — success returns {"message":"success"}, no data.
     *  ⚠️ At the end of this handler the backend **unconditionally** runs ApplyGatewayConfig() (rewrites dnsmasq / nftables /
     *  ip_forward) — a destructive write, regardless of whether the target NIC is plugged in. Callers must confirm user intent first. */
    async updateInterface(cfg: NetworkInterfaceUpdate): Promise<void> {
      await http.put('/v2/nimoos/network/interfaces', cfg)
    },

    /** GET /v2/nimoos/network/wifi/scan?iface=… — measured ~2.3s, callers need a loading state.
     *  Missing iface → 400; name not matching ^[a-zA-Z][a-zA-Z0-9_-]{0,15}$ → 500; both rejected by axios. */
    async scanWifi(iface: string): Promise<WifiScanResult[]> {
      const res = await http.get('/v2/nimoos/network/wifi/scan', { params: { iface } })
      return Array.isArray(res.data) ? (res.data as WifiScanResult[]) : []
    },
  }
}

/** Extract the network domain's backend text from an axios error.
 *  The response interceptor in http.ts does error.message = response.data.**message**,
 *  but the network domain's error key is **error** → err.message never carries the backend text.
 *  Dialogs that want to "prefer the backend message" must go through this function. */
export function networkErrorText(e: unknown): string | undefined {
  const data = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data
  if (data && typeof data === 'object') {
    const raw = (data as { error?: unknown }).error
    if (typeof raw === 'string' && raw.trim()) return raw.trim()
  }
  return undefined
}
