import type { AxiosInstance } from 'axios'
import { unwrap } from './unwrap.js'

export function createDisks(http: AxiosInstance) {
  return {
    // GET /v1/disks — physical disk list (envelope Data = array)
    async getDiskList(params?: Record<string, unknown>): Promise<unknown> {
      const res = await http.get('/disks', { params })
      const d = res.data
      return Array.isArray(d) ? d : unwrap<unknown>(d)
    },
    // DELETE /v1/disks — unmount disk (body passed through, same shape as Vue2 disks.umount)
    async umount(data: unknown): Promise<unknown> {
      const res = await http.delete('/disks', { data })
      return unwrap<unknown>(res.data)
    },
    // GET /v1/disks/usb — USB device list
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
