import type { AxiosInstance } from 'axios'
import type { CloudMount } from './types.js'
import { unwrap } from './unwrap.js'

interface RawCloud { fs: string; name: string; icon: string; mount_point: string }

export function createCloud(http: AxiosInstance) {
  return {
    async list(): Promise<CloudMount[]> {
      const res = await http.get('/cloud')
      const arr = Array.isArray(res.data) ? (res.data as RawCloud[]) : unwrap<RawCloud[]>(res.data)
      return (arr ?? []).map((c) => ({ fs: c.fs, name: c.name, icon: c.icon, mountPoint: c.mount_point }))
    },
    async umount(mountPoint: string): Promise<void> {
      await http.delete('/cloud', { data: { mount_point: mountPoint } })
    },
  }
}
