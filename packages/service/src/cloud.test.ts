import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createCloud } from './cloud'

describe('createCloud', () => {
  it('list standard envelope → maps mount_point→mountPoint', async () => {
    const http = { get: async () => ({ data: { success: 200, data: [
      { fs: 'gdrive:', name: 'MyDrive', icon: './img/driver/GoogleDrive.svg', mount_point: '/mnt/gdrive' },
    ] } }) } as unknown as AxiosInstance
    const res = await createCloud(http).list()
    expect(res).toEqual([{ fs: 'gdrive:', name: 'MyDrive', icon: './img/driver/GoogleDrive.svg', mountPoint: '/mnt/gdrive' }])
  })
  it('list tolerates a bare array', async () => {
    const http = { get: async () => ({ data: [{ fs: 'f', name: 'n', icon: 'i', mount_point: '/m' }] }) } as unknown as AxiosInstance
    expect(await createCloud(http).list()).toEqual([{ fs: 'f', name: 'n', icon: 'i', mountPoint: '/m' }])
  })
  it('umount DELETE /cloud + body {mount_point}', async () => {
    let url = ''; let cfg: { data?: unknown } | undefined
    const http = { delete: async (u: string, c?: { data?: unknown }) => { url = u; cfg = c; return { data: { success: 200, data: {} } } } } as unknown as AxiosInstance
    await createCloud(http).umount('/mnt/gdrive')
    expect(url).toBe('/cloud'); expect(cfg?.data).toEqual({ mount_point: '/mnt/gdrive' })
  })
})
