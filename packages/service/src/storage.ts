import type { AxiosInstance } from 'axios'
import { unwrap } from './unwrap.js'

export function createStorage(http: AxiosInstance) {
  return {
    async list(params?: Record<string, unknown>): Promise<unknown> {
      const res = await http.get('/storage', { params })
      const d = res.data
      return Array.isArray(d) ? d : unwrap<unknown>(d)
    },
    async create(data: unknown): Promise<unknown> {
      const res = await http.post('/storage', data)
      return unwrap<unknown>(res.data)
    },
    async format(data: unknown): Promise<unknown> {
      const res = await http.put('/storage', data)
      return unwrap<unknown>(res.data)
    },
    async delete(data: unknown): Promise<unknown> {
      const res = await http.delete('/storage', { data })
      return unwrap<unknown>(res.data)
    },
  }
}
