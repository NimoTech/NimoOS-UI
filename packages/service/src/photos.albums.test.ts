import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPhotos } from './photos.js'

type Call = { method: string; url: string; params?: unknown; body?: unknown; cfg?: unknown }
function capture(data: unknown = []) {
  const calls: Call[] = []
  const ok = { data, headers: {} }
  const http = {
    get: async (url: string, cfg?: { params?: unknown }) => { calls.push({ method: 'get', url, params: cfg?.params, cfg }); return ok },
    post: async (url: string, body?: unknown, cfg?: unknown) => { calls.push({ method: 'post', url, body, cfg }); return ok },
    put: async (url: string, body?: unknown) => { calls.push({ method: 'put', url, body }); return ok },
    patch: async (url: string, body?: unknown) => { calls.push({ method: 'patch', url, body }); return ok },
    delete: async (url: string, cfg?: { data?: unknown }) => { calls.push({ method: 'delete', url, cfg }); return ok },
  } as unknown as AxiosInstance
  return { http, calls }
}
const noToken = () => null

describe('photos 相册', () => {
  it('CRUD 路由与请求体正确', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.listAlbums()
    await p.createAlbum('旅行')
    await p.getAlbum(3)
    await p.deleteAlbum(3)
    expect(calls[0]).toMatchObject({ method: 'get', url: '/photos/albums' })
    expect(calls[1]).toMatchObject({ method: 'post', url: '/photos/albums', body: { name: '旅行' } })
    expect(calls[2]).toMatchObject({ method: 'get', url: '/photos/albums/3' })
    expect(calls[3]).toMatchObject({ method: 'delete', url: '/photos/albums/3' })
  })
  it('资产增删/批量/排序/更名', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.addToAlbum(3, 'a1')
    await p.removeFromAlbum(3, 'a1')
    await p.batchAddToAlbum(3, ['a1', 'a2'])
    await p.updateAlbum(3, { name: '新名' })
    await p.reorderAlbumAssets(3, ['a2', 'a1'])
    expect(calls[0]).toMatchObject({ method: 'post', url: '/photos/albums/3/assets', body: { assetId: 'a1' } })
    expect(calls[1]).toMatchObject({ method: 'delete', url: '/photos/albums/3/assets/a1' })
    expect(calls[2]).toMatchObject({ method: 'post', url: '/photos/albums/3/assets/batch', body: { assetIds: ['a1', 'a2'] } })
    expect(calls[3]).toMatchObject({ method: 'patch', url: '/photos/albums/3', body: { name: '新名' } })
    expect(calls[4]).toMatchObject({ method: 'patch', url: '/photos/albums/3/assets/order', body: { assetIds: ['a2', 'a1'] } })
  })
})
