import type { AxiosInstance } from 'axios'
import type { SambaConnection } from './types.js'
import { unwrap } from './unwrap.js'

interface RawConnection { id: number; host: string; mount_point: string }
interface RawShare { id: number; path: string }

export function createSamba(http: AxiosInstance) {
  return {
    async listConnections(): Promise<SambaConnection[]> {
      const res = await http.get('/samba/connections')
      const arr = Array.isArray(res.data) ? (res.data as RawConnection[]) : unwrap<RawConnection[]>(res.data)
      return (arr ?? []).map((c) => ({ id: c.id, host: c.host, mountPoint: c.mount_point }))
    },
    async createConnection(p: { host: string; username: string; password: string }): Promise<{ mountPoint: string }> {
      const res = await http.post('/samba/connections', p)
      const c = unwrap<RawConnection>(res.data)
      return { mountPoint: c.mount_point }
    },
    async deleteConnection(id: number): Promise<void> {
      await http.delete(`/samba/connections/${id}`)
    },
    async listShares(): Promise<{ id: number; path: string }[]> {
      const res = await http.get('/samba/shares')
      const arr = Array.isArray(res.data) ? (res.data as RawShare[]) : unwrap<RawShare[]>(res.data)
      return (arr ?? []).map((s) => ({ id: s.id, path: s.path }))
    },
    // create/delete 不 unwrap:core /v1/samba/shares 用真实 HTTP 状态报错(400/500,见 NimoOS/route/v1/samba.go),
    // axios 直接 reject,故无需查 success 信封。
    async createShare(paths: string[]): Promise<void> {
      await http.post('/samba/shares', paths.map((p) => ({ path: p, anonymous: true })))
    },
    async deleteShare(id: number): Promise<void> {
      await http.delete(`/samba/shares/${id}`)
    },
  }
}
