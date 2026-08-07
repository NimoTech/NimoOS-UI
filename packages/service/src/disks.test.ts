import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createDisks } from './disks'

describe('createDisks', () => {
  it('umountUsb 发 DELETE /disks/usb + body {mount_point}', async () => {
    let url = ''; let cfg: { data?: unknown } | undefined
    const http = { delete: async (u: string, c?: { data?: unknown }) => { url = u; cfg = c; return { data: { success: 200, data: {} } } } } as unknown as AxiosInstance
    await createDisks(http).umountUsb('/media/usb1')
    expect(url).toBe('/disks/usb')
    expect(cfg?.data).toEqual({ mount_point: '/media/usb1' })
  })

  it('getDiskList forwards params and unwraps envelope', async () => {
    let seen: unknown
    const http = { get: async (_u: string, cfg?: { params?: unknown }) => { seen = cfg?.params; return { data: { success: 200, data: [{ path: '/dev/sda' }] } } } } as unknown as AxiosInstance
    const res = await createDisks(http).getDiskList({ type: 'all' })
    expect(seen).toEqual({ type: 'all' })
    expect(res).toEqual([{ path: '/dev/sda' }])
  })

  it('umount deletes /disks with body; getUsbs gets /disks/usb and unwraps', async () => {
    const log: Array<[string, string, unknown]> = []
    const http = {
      get: async (u: string) => { log.push(['get', u, undefined]); return { data: { success: 200, data: [{ name: 'usb0' }] } } },
      delete: async (u: string, cfg?: { data?: unknown }) => { log.push(['delete', u, cfg?.data]); return { data: { success: 200, data: 'ok' } } },
    } as unknown as AxiosInstance
    const d = createDisks(http)
    await d.umount({ path: '/dev/sda' })
    const usbs = await d.getUsbs()
    expect(log).toEqual([['delete', '/disks', { path: '/dev/sda' }], ['get', '/disks/usb', undefined]])
    expect(usbs).toEqual([{ name: 'usb0' }])
  })

  it('list 发 GET /disks,数组体原样返回', async () => {
    let url = ''
    const arr = [{ path: '/dev/sda', size: 1000 }]
    const http = { get: async (u: string) => { url = u; return { data: arr } } } as unknown as AxiosInstance
    const res = await createDisks(http).list()
    expect(url).toBe('/disks')
    expect(res).toEqual(arr)
  })

  it('list 发 GET /disks,信封体走 unwrap', async () => {
    const http = { get: async () => ({ data: { success: 200, data: [{ path: '/dev/sdb' }] } }) } as unknown as AxiosInstance
    const res = await createDisks(http).list()
    expect(res).toEqual([{ path: '/dev/sdb' }])
  })
})
