import type { AxiosInstance } from 'axios'
import type { AppGridItem } from './types.js'
import { unwrap } from './unwrap.js'

export function createApps(http: AxiosInstance) {
  return {
    async getGrid(): Promise<AppGridItem[]> {
      const res = await http.get('/v2/app_management/web/appgrid')
      const raw = res.data
      // 裸数组直接用
      if (Array.isArray(raw)) return raw as AppGridItem[]
      // appgrid 生产环境返回裸信封 {data:[...], message} 且无 success 字段,
      // 不能先走 unwrap(会因 success!==200 抛错)——真机踩坑 2026-07-15
      const direct = (raw as { data?: unknown } | null)?.data
      if (Array.isArray(direct)) return direct as AppGridItem[]
      const data = unwrap<unknown>(raw)
      if (Array.isArray(data)) return data as AppGridItem[]
      const nested = (data as { data?: unknown } | null)?.data
      return Array.isArray(nested) ? (nested as AppGridItem[]) : []
    },

    /** 启动一个已停止的应用。v2 compose 应用与 v1/裸容器走不同端点。
     *  后端异步变更状态,调用方需自行轮询 getGrid 直到 status==='running'。 */
    async start(app: Pick<AppGridItem, 'name' | 'app_type'>): Promise<void> {
      if (app.app_type === 'v2app') {
        // RequestComposeAppStatus 的 body 是裸 JSON 字符串("start"),
        // 直接传 'start' 会被 axios 当 text/plain 发出,echo Bind 解析失败
        await http.put(`/v2/app_management/compose/${encodeURIComponent(app.name)}/status`, '"start"', {
          headers: { 'Content-Type': 'application/json' },
        })
        return
      }
      await http.put(`/v1/container/${encodeURIComponent(app.name)}/state`, { state: 'start' })
    },
  }
}
