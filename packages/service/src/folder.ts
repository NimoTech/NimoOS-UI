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
    async getFolderSize(path: string): Promise<unknown> {
      const res = await http.get('/folder/size', { params: { path } })
      return unwrap<unknown>(res.data)
    },
    async getFolderCount(path: string): Promise<unknown> {
      const res = await http.get('/folder/count', { params: { path } })
      return unwrap<unknown>(res.data)
    },
  }
}
