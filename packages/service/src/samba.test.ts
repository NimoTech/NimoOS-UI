import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createSamba } from './samba'

describe('createSamba', () => {
  it('listConnections 标准信封 → 映射 mount_point→mountPoint', async () => {
    const http = { get: async () => ({ data: { success: 200, data: [
      { id: 1, host: '192.168.1.10', mount_point: '/mnt/192.168.1.10', username: 'u' },
    ] } }) } as unknown as AxiosInstance
    const res = await createSamba(http).listConnections()
    expect(res).toEqual([{ id: 1, host: '192.168.1.10', mountPoint: '/mnt/192.168.1.10' }])
  })

  it('listConnections 裸数组容错(防信封漂移)', async () => {
    const http = { get: async () => ({ data: [{ id: 2, host: 'h', mount_point: '/mnt/h' }] }) } as unknown as AxiosInstance
    const res = await createSamba(http).listConnections()
    expect(res).toEqual([{ id: 2, host: 'h', mountPoint: '/mnt/h' }])
  })

  it('createConnection POST + 返回 mountPoint', async () => {
    let body: unknown
    const http = { post: async (_u: string, b: unknown) => { body = b; return { data: { success: 200, data: { id: 5, host: 'h', mount_point: '/mnt/h' } } } } } as unknown as AxiosInstance
    const res = await createSamba(http).createConnection({ host: 'h', username: 'u', password: 'p' })
    expect(body).toEqual({ host: 'h', username: 'u', password: 'p' })
    expect(res).toEqual({ mountPoint: '/mnt/h' })
  })

  it('deleteConnection 打到 /samba/connections/:id', async () => {
    let url = ''
    const http = { delete: async (u: string) => { url = u; return { data: { success: 200, data: '5' } } } } as unknown as AxiosInstance
    await createSamba(http).deleteConnection(5)
    expect(url).toBe('/samba/connections/5')
  })

  it('listShares 标准信封 → {id,path}[]', async () => {
    const http = { get: async () => ({ data: { success: 200, data: [
      { id: 1, path: '/DATA/Documents' }, { id: 2, path: '/DATA/Gallery' },
    ] } }) } as unknown as AxiosInstance
    const res = await createSamba(http).listShares()
    expect(res).toEqual([{ id: 1, path: '/DATA/Documents' }, { id: 2, path: '/DATA/Gallery' }])
  })

  it('listShares 裸数组容错(防信封漂移)', async () => {
    const http = { get: async () => ({ data: [{ id: 3, path: '/DATA/x' }] }) } as unknown as AxiosInstance
    expect(await createSamba(http).listShares()).toEqual([{ id: 3, path: '/DATA/x' }])
  })

  it('createShare POST 载荷 = [{path,anonymous:true}]', async () => {
    let body: unknown
    const http = { post: async (_u: string, b: unknown) => { body = b; return { data: { success: 200, data: '' } } } } as unknown as AxiosInstance
    await createSamba(http).createShare(['/DATA/a', '/DATA/b'])
    expect(body).toEqual([{ path: '/DATA/a', anonymous: true }, { path: '/DATA/b', anonymous: true }])
  })

  it('deleteShare 打到 /samba/shares/:id', async () => {
    let url = ''
    const http = { delete: async (u: string) => { url = u; return { data: { success: 200, data: '' } } } } as unknown as AxiosInstance
    await createSamba(http).deleteShare(7)
    expect(url).toBe('/samba/shares/7')
  })
})
