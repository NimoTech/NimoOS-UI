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

  it('getFolderSize hits /folder/size with path, a 5-minute timeout, and returns the byte count', async () => {
    let url = ''
    let cfg: { params?: unknown; timeout?: number } | undefined
    // Real device envelope: data is the raw int64 byte count, not an object.
    const http = {
      get: async (u: string, c?: { params?: unknown; timeout?: number }) => {
        url = u; cfg = c
        return { data: { success: 200, message: 'ok', data: 123456789 } }
      },
    } as unknown as import('axios').AxiosInstance
    const bytes = await createFolder(http).getFolderSize('/DATA/x')
    expect(url).toBe('/folder/size')
    expect(cfg?.params).toEqual({ path: '/DATA/x' })
    expect(cfg?.timeout).toBe(300000)
    expect(bytes).toBe(123456789)
  })

  it('getFolderSize forwards an AbortSignal to axios so the caller can cancel the walk', async () => {
    let cfg: { signal?: AbortSignal } | undefined
    const http = {
      get: async (_u: string, c?: { signal?: AbortSignal }) => {
        cfg = c
        return { data: { success: 200, message: 'ok', data: 1 } }
      },
    } as unknown as import('axios').AxiosInstance
    const controller = new AbortController()
    await createFolder(http).getFolderSize('/DATA/x', { signal: controller.signal })
    expect(cfg?.signal).toBe(controller.signal)
  })

  it('getFolderCount hits /folder/count with path', async () => {
    let url = ''
    let params: unknown
    const http = {
      get: async (u: string, c?: { params?: unknown }) => {
        url = u; params = c?.params
        return { data: { success: 200, message: 'ok', data: 42 } }
      },
    } as unknown as import('axios').AxiosInstance
    await createFolder(http).getFolderCount('/DATA/x')
    expect(url).toBe('/folder/count')
    expect(params).toEqual({ path: '/DATA/x' })
  })

  it('the entry\'s size field is preserved (the OSSelector custom area needs to display file size)', async () => {
    const http = { get: vi.fn().mockResolvedValue({ data: { success: 200, data: { content: [
      { name: 'alpine.iso', path: '/DATA/alpine.iso', is_dir: false, is_symlink: false, size: 1048576 },
    ] } } }) }
    const folder = createFolder(http as never)
    const listing = await folder.getList('/DATA')
    expect(listing.content[0].size).toBe(1048576)
  })
})
