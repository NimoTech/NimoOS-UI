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

  it('getDiskList unwraps the real {disks, avail} envelope (2026-08-11 真机形状:含 raid/disk_by_id/children mount_point+used_bytes)', async () => {
    const data = {
      disks: [{
        name: 'sda', path: '/dev/sda', size: 1000204886016, model: 'WDC', serial: 'WD-1',
        disk_by_id: 'ata-WDC_WD-1', health: 'true', temperature: 47, power_on_time: 2494,
        disk_type: 'HDD', need_format: false,
        children: [{ name: 'md127', size: 1, format: 'btrfs', supported: false, mount_point: '/media/RAID_raid10', used_bytes: 42 }],
        raid: { role: 'member', array_name: 'raid10', array_uuid: 'u', level: 'raid10', md_device: '/dev/md127', registered: true, active: true },
      }],
      avail: [{
        name: 'sdb', path: '/dev/sdb', size: 1, model: 'WDC', serial: 'WD-2', health: '',
        temperature: 41, power_on_time: 148, disk_type: 'HDD', need_format: true,
        raid: { role: 'residue', array_name: 'zimaos:fc56', array_uuid: 'u2', level: 'raid5', registered: false, active: false, created_at: 'Thu Aug  6 21:54:49 2026', updated_at: 'Fri Aug  7 00:29:17 2026' },
      }],
    }
    const http = { get: async () => ({ data: { success: 200, data } }) } as unknown as AxiosInstance
    const res = await createDisks(http).getDiskList()
    expect(res).toEqual(data)
    expect(res.avail[0].raid?.role).toBe('residue')
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
