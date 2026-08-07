import { describe, it, expect, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createFolder } from './folder'

describe('createFolder', () => {
  it('getList passes path param and unwraps content', async () => {
    let seenParams: unknown
    const http = {
      get: async (_url: string, cfg?: { params?: unknown }) => {
        seenParams = cfg?.params
        return { data: { success: 200, data: { content: [{ name: 'a', path: '/DATA/a', is_dir: true }] } } }
      },
    } as unknown as AxiosInstance
    const f = createFolder(http)
    const listing = await f.getList('/DATA')
    expect(seenParams).toEqual({ path: '/DATA' })
    expect(listing.content[0].name).toBe('a')
  })

  it('create posts path to /folder', async () => {
    let seen: unknown
    const http = { post: async (_u: string, b?: unknown) => { seen = b; return { data: { success: 200, data: {} } } } } as unknown as import('axios').AxiosInstance
    await createFolder(http).create('/DATA/nf')
    expect(seen).toEqual({ path: '/DATA/nf' })
  })

  it('rename puts old/new to /folder/name', async () => {
    let url = ''; let body: unknown
    const http = { put: async (u: string, b?: unknown) => { url = u; body = b; return { data: { success: 200, data: {} } } } } as unknown as import('axios').AxiosInstance
    await createFolder(http).rename('/DATA/a', '/DATA/b')
    expect(url).toBe('/folder/name')
    expect(body).toEqual({ old_path: '/DATA/a', new_path: '/DATA/b' })
  })

  it('getFolderSize / getFolderCount hit /folder/size and /folder/count with path', async () => {
    const urls: string[] = []; const params: unknown[] = []
    const http = { get: async (u: string, cfg?: { params?: unknown }) => { urls.push(u); params.push(cfg?.params); return { data: { success: 200, data: { size: 1 } } } } } as unknown as import('axios').AxiosInstance
    const f = createFolder(http)
    await f.getFolderSize('/DATA/x'); await f.getFolderCount('/DATA/x')
    expect(urls).toEqual(['/folder/size', '/folder/count'])
    expect(params).toEqual([{ path: '/DATA/x' }, { path: '/DATA/x' }])
  })

  it('条目的 size 字段被保留(OSSelector 自定义区要显示文件大小)', async () => {
    const http = { get: vi.fn().mockResolvedValue({ data: { success: 200, data: { content: [
      { name: 'alpine.iso', path: '/DATA/alpine.iso', is_dir: false, is_symlink: false, size: 1048576 },
    ] } } }) }
    const folder = createFolder(http as never)
    const listing = await folder.getList('/DATA')
    expect(listing.content[0].size).toBe(1048576)
  })
})
