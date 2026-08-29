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

    /** Raw compose YAML of a store app (the input for install). Accept yaml → bare text;
     *  transformResponse is cleared to stop axios from mis-parsing YAML as JSON. */
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

    /** Register a third-party store source. The url goes in a query param (openapi AppStoreURL), no body;
     *  registration is an async task, completion arrives via MessageBus app-store:register-end/-error (consumed by P7). */
    async registerSource(url: string): Promise<void> {
      await http.post(`${BASE}/appstore`, undefined, { params: { url } })
    },

    async unregisterSource(id: number): Promise<void> {
      await http.delete(`${BASE}/appstore/${id}`)
    },

    /** GET /v2/app_management/apps/{id}/stable/{serviceName} (v2 envelope). Only store apps have a value; returns null on failure. */
    async stableTag(id: string, serviceName: string): Promise<string | null> {
      try {
        const res = await http.get(`${BASE}/apps/${encodeURIComponent(id)}/stable/${encodeURIComponent(serviceName)}`)
        const d = v2Data<{ tag?: string }>(res.data)
        return d?.tag ?? null
      } catch { return null }
    },
  }
}
