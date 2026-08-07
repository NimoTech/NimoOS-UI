import type { AxiosInstance } from 'axios'
import type { AppCategory, StoreAppCatalog, StoreAppInfo, UpgradableAppInfo, AppStoreSource } from './types.js'
import { v2Data } from './v2.js'

const BASE = '/v2/app_management'

export function createAppstore(http: AxiosInstance) {
  return {
    async categories(): Promise<AppCategory[]> {
      const res = await http.get(`${BASE}/categories`)
      return v2Data<AppCategory[]>(res.data) ?? []
    },

    async listApps(params?: { category?: string; authorType?: string; recommend?: boolean }): Promise<StoreAppCatalog> {
      const res = await http.get(`${BASE}/apps`, {
        params: { category: params?.category, author_type: params?.authorType, recommend: params?.recommend },
      })
      const d = v2Data<Partial<StoreAppCatalog>>(res.data)
      return { installed: d?.installed ?? [], list: d?.list ?? {} }
    },

    async getApp(id: string): Promise<StoreAppInfo | undefined> {
      const res = await http.get(`${BASE}/apps/${encodeURIComponent(id)}`)
      return v2Data<StoreAppInfo>(res.data)
    },

    /** 商店应用的 compose YAML 原文(安装的输入)。Accept yaml → 裸文本;
     *  transformResponse 置空防 axios 把 YAML 误当 JSON 解析。 */
    async getAppCompose(id: string): Promise<string> {
      const res = await http.get(`${BASE}/apps/${encodeURIComponent(id)}/compose`, {
        headers: { Accept: 'application/yaml' },
        responseType: 'text',
        transformResponse: [(d: unknown) => d],
      })
      return res.data as string
    },

    async upgradable(): Promise<UpgradableAppInfo[]> {
      const res = await http.get(`${BASE}/apps/upgradable`)
      return v2Data<UpgradableAppInfo[]>(res.data) ?? []
    },

    async listSources(): Promise<AppStoreSource[]> {
      const res = await http.get(`${BASE}/appstore`)
      return v2Data<AppStoreSource[]>(res.data) ?? []
    },

    /** 注册第三方商店源。url 走 query 参数(openapi AppStoreURL),无 body;
     *  注册是异步任务,完成经 MessageBus app-store:register-end/-error(P7 消费)。 */
    async registerSource(url: string): Promise<void> {
      await http.post(`${BASE}/appstore`, undefined, { params: { url } })
    },

    async unregisterSource(id: number): Promise<void> {
      await http.delete(`${BASE}/appstore/${id}`)
    },

    /** GET /v2/app_management/apps/{id}/stable/{serviceName}(v2 信封)。仅商店应用有值;失败返 null。 */
    async stableTag(id: string, serviceName: string): Promise<string | null> {
      try {
        const res = await http.get(`${BASE}/apps/${encodeURIComponent(id)}/stable/${encodeURIComponent(serviceName)}`)
        const d = v2Data<{ tag?: string }>(res.data)
        return d?.tag ?? null
      } catch { return null }
    },
  }
}
