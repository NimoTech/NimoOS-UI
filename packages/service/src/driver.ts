import type { AxiosInstance } from 'axios'
import type { CloudDriver } from './types.js'
import { unwrap } from './unwrap.js'

interface RawDriver { name: string; icon: string; auth_url: string }

export function createDriver(http: AxiosInstance) {
  return {
    async listDrivers(): Promise<CloudDriver[]> {
      const res = await http.get('/driver')
      const arr = Array.isArray(res.data) ? (res.data as RawDriver[]) : unwrap<RawDriver[]>(res.data)
      return (arr ?? []).map((d) => ({ name: d.name, icon: d.icon, authUrl: d.auth_url }))
    },

    // Google Drive BYO:提交用户自建的 client_id/client_secret,换取带一次性 sid 的授权 URL
    // (仍含 ${HOST} 占位符,由前端 buildAuthUrl 替换)。成功是标准信封(curl 实证);
    // 参数缺失时后端有 ctx.JSON(4000,…) 畸形路径 → HTTP 200 空 body,经 unwrap 抛错兜住,
    // 调用方按通用失败处理(前端 trim 非空校验使其正常不可达)。
    async googleDriveCustomAuth(clientId: string, clientSecret: string): Promise<string> {
      const res = await http.post('/driver/google_drive/auth', {
        client_id: clientId,
        client_secret: clientSecret,
      })
      const data = unwrap<{ auth_url?: string }>(res.data)
      if (!data?.auth_url) throw new Error('google_drive/auth: empty auth_url')
      return data.auth_url
    },
  }
}
