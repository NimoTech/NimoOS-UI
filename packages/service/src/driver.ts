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

    // Google Drive BYO: submit the user's own client_id/client_secret in exchange for an auth URL carrying a one-time sid
    // (still contains the ${HOST} placeholder, replaced by the frontend's buildAuthUrl). Success is the standard envelope (verified via curl);
    // when params are missing the backend has a malformed ctx.JSON(4000,...) path → HTTP 200 empty body, caught by unwrap throwing,
    // and callers treat it as a generic failure (frontend non-empty trim validation makes it normally unreachable).
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
