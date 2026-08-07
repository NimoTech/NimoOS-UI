import type { AxiosInstance } from 'axios'
import { unwrap } from './unwrap.js'

export function createBatch(http: AxiosInstance, getToken: () => string | null) {
  return {
    async download(format: string, files: string): Promise<unknown> {
      const res = await http.get('/batch', { params: { format, files } })
      return unwrap<unknown>(res.data)
    },
    async task(data: unknown): Promise<unknown> {
      const res = await http.post('/batch/task', data)
      return unwrap<unknown>(res.data)
    },
    async deleteTask(id: string | number): Promise<unknown> {
      const res = await http.delete(`/batch/${id}/task`)
      return unwrap<unknown>(res.data)
    },
    async delete(files: unknown): Promise<unknown> {
      const res = await http.delete('/batch', { data: files })
      return unwrap<unknown>(res.data)
    },
    batchUrl(files: string): string {
      const t = getToken()
      const tok = t ? `token=${encodeURIComponent(t)}&` : ''
      return `/v1/batch?${tok}files=${encodeURIComponent(files)}`
    },
  }
}
