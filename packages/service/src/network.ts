import type { AxiosInstance } from 'axios'
import type { NetworkInterfaceConfig, NetworkInterfaceUpdate, WifiScanResult } from './types.js'

// network 域 = NimoOS core 的 /v2/nimoos/network/*(NimoOS/route/v2/network.go)。
//
// ⚠️ 信封:**裸 JSON,零层 unwrap**。该文件里全部是 c.JSON(status, payload):
//    成功体直接是数组/对象,错误体是 {"error": "..."} —— 不是全系统的
//    Result{Success,Message,Data}。所以错误路径靠 axios 的 HTTP 状态码 reject,
//    **不要过 unwrap()**(过了必抛)。取后端错误文本用下面的 networkErrorText。
//
// ⚠️ 两个 GET 都可能是 HTTP 200 + body `null`(Go nil slice):
//    - interfaces:network-config.json 为空 map 时
//    - wifi/scan:`iw dev X scan` 失败时(网卡不存在 / 以太网口 / AP 模式不支持扫描,
//      NimoOS-Common/pkg/network/wifi.go:32-35 明确 return nil, nil)
//    → 一律 Array.isArray 守卫后返回 [],消费方不必再守一遍。
export function createNetwork(http: AxiosInstance) {
  return {
    /** GET /v2/nimoos/network/interfaces —— 持久化配置(读 /etc/nimoos/network-config.json)。
     *  注意这里**只有配置过的网卡**;界面上的接口列表要以 /v1/sys/utilization 的 net 为源。
     *  另:mac / state / speed / ports 后端从不填(GetAllInterfaceConfigs 只构造
     *  name/type/is_virtual/ipv4/zone/wireless/hybridCapable)。 */
    async getInterfaces(): Promise<NetworkInterfaceConfig[]> {
      const res = await http.get('/v2/nimoos/network/interfaces')
      return Array.isArray(res.data) ? (res.data as NetworkInterfaceConfig[]) : []
    },

    /** PUT /v2/nimoos/network/interfaces —— 成功返回 {"message":"success"},无数据。
     *  ⚠️ 后端在这个 handler 末尾**无条件** ApplyGatewayConfig()(重写 dnsmasq / nftables /
     *  ip_forward),属破坏性写操作,且与目标网卡是否插线无关。调用方必须先确认用户意图。 */
    async updateInterface(cfg: NetworkInterfaceUpdate): Promise<void> {
      await http.put('/v2/nimoos/network/interfaces', cfg)
    },

    /** GET /v2/nimoos/network/wifi/scan?iface=… —— 实测耗时 ~2.3s,调用方要有 loading 态。
     *  缺 iface → 400;名字不合 ^[a-zA-Z][a-zA-Z0-9_-]{0,15}$ → 500;都由 axios reject。 */
    async scanWifi(iface: string): Promise<WifiScanResult[]> {
      const res = await http.get('/v2/nimoos/network/wifi/scan', { params: { iface } })
      return Array.isArray(res.data) ? (res.data as WifiScanResult[]) : []
    },
  }
}

/** 从 axios 错误里取 network 域的后端文本。
 *  http.ts 的响应拦截器做的是 error.message = response.data.**message**,
 *  而 network 域的错误键是 **error** → err.message 永远拿不到后端文本。
 *  弹窗要「优先显示后端 message」就得走这个函数。 */
export function networkErrorText(e: unknown): string | undefined {
  const data = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data
  if (data && typeof data === 'object') {
    const raw = (data as { error?: unknown }).error
    if (typeof raw === 'string' && raw.trim()) return raw.trim()
  }
  return undefined
}
