import type { AxiosInstance } from 'axios'
import { unwrap } from './unwrap.js'

export function createDisks(http: AxiosInstance) {
  return {
    // GET /v1/disks — 物理盘列表(信封 Data = 数组)
    async getDiskList(params?: Record<string, unknown>): Promise<unknown> {
      const res = await http.get('/disks', { params })
      const d = res.data
      return Array.isArray(d) ? d : unwrap<unknown>(d)
    },
    // DELETE /v1/disks — 卸载盘(body 透传,Vue2 disks.umount 同形)
    async umount(data: unknown): Promise<unknown> {
      const res = await http.delete('/disks', { data })
      return unwrap<unknown>(res.data)
    },
    // GET /v1/disks/usb — USB 设备列表
    async getUsbs(): Promise<unknown> {
      const res = await http.get('/disks/usb')
      const d = res.data
      return Array.isArray(d) ? d : unwrap<unknown>(d)
    },
    async umountUsb(mountPoint: string): Promise<void> {
      await http.delete('/disks/usb', { data: { mount_point: mountPoint } })
    },
    async list(): Promise<unknown> {
      const res = await http.get('/disks')
      const d = res.data
      return Array.isArray(d) ? d : unwrap<unknown>(d)
    },
  }
}
