import type { AxiosInstance } from 'axios'
import type { FolderListing } from './types.js'
import { unwrap } from './unwrap.js'

export function createFolder(http: AxiosInstance) {
  return {
    async getList(path: string): Promise<FolderListing> {
      const res = await http.get('/folder', { params: { path } })
      return unwrap<FolderListing>(res.data)
    },
    async create(path: string): Promise<unknown> {
      const res = await http.post('/folder', { path })
      return unwrap<unknown>(res.data)
    },
    async rename(oldPath: string, newPath: string): Promise<unknown> {
      const res = await http.put('/folder/name', { old_path: oldPath, new_path: newPath })
      return unwrap<unknown>(res.data)
    },
    async getFolderSize(path: string): Promise<number> {
      // The backend walks the entire subtree on every call (no caching);
      // large trees on spinning disks can take minutes. The axios default
      // timeout (60s, http.ts) would cut that off, so this request gets
      // its own 5-minute budget.
      const res = await http.get('/folder/size', { params: { path }, timeout: 300000 })
      return unwrap<number>(res.data)
    },
    async getFolderCount(path: string): Promise<unknown> {
      const res = await http.get('/folder/count', { params: { path } })
      return unwrap<unknown>(res.data)
    },
  }
}
