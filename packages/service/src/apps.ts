import type { AxiosInstance } from 'axios'
import type { AppGridItem } from './types.js'
import { unwrap } from './unwrap.js'

export function createApps(http: AxiosInstance) {
  return {
    async getGrid(): Promise<AppGridItem[]> {
      const res = await http.get('/v2/app_management/web/appgrid')
      const raw = res.data
      // Bare array: use as-is
      if (Array.isArray(raw)) return raw as AppGridItem[]
      // In production, appgrid returns a bare envelope {data:[...], message} without a success field,
      // so unwrap must not run first (it would throw on success!==200) — hit on a real device 2026-07-15
      const direct = (raw as { data?: unknown } | null)?.data
      if (Array.isArray(direct)) return direct as AppGridItem[]
      const data = unwrap<unknown>(raw)
      if (Array.isArray(data)) return data as AppGridItem[]
      const nested = (data as { data?: unknown } | null)?.data
      return Array.isArray(nested) ? (nested as AppGridItem[]) : []
    },

    /** Start a stopped app. v2 compose apps and v1/bare containers use different endpoints.
     *  The backend changes state asynchronously; callers must poll getGrid themselves until status==='running'. */
    async start(app: Pick<AppGridItem, 'name' | 'app_type'>): Promise<void> {
      if (app.app_type === 'v2app') {
        // The RequestComposeAppStatus body is a bare JSON string ("start");
        // passing 'start' directly makes axios send it as text/plain and echo's Bind fails to parse
        await http.put(`/v2/app_management/compose/${encodeURIComponent(app.name)}/status`, '"start"', {
          headers: { 'Content-Type': 'application/json' },
        })
        return
      }
      await http.put(`/v1/container/${encodeURIComponent(app.name)}/state`, { state: 'start' })
    },
  }
}
