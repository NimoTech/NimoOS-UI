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

describe('photos 搜索+收藏', () => {
  it('smartSearch 发 POST /photos/search/smart 全参', async () => {
    const { http, calls } = capture()
    await createPhotos(http, noToken).smartSearch('猫', 50, 100, { type: 'image' })
    expect(calls[0]).toMatchObject({ method: 'post', url: '/photos/search/smart' })
    expect(calls[0].body).toEqual({ query: '猫', limit: 50, offset: 100, filters: { type: 'image' } })
  })
  it('searchFaces 发 GET /photos/search/faces/:personId 带分页', async () => {
    const { http, calls } = capture()
    await createPhotos(http, noToken).searchFaces('p1', 50, 0)
    expect(calls[0]).toMatchObject({ url: '/photos/search/faces/p1', params: { limit: 50, offset: 0 } })
  })
  it('listFavorites 无 limit 不带 params,有 limit 带分页(对齐 Vue2 条件参数)', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.listFavorites()
    expect(calls[0].params).toEqual({})
    await p.listFavorites(60, 120)
    expect(calls[1].params).toEqual({ limit: 60, offset: 120 })
  })
  it('topFavorites 传正确 params(修正 Vue2 的 {params:{limit}} 误包一层)', async () => {
    const { http, calls } = capture()
    await createPhotos(http, noToken).topFavorites(8)
    expect(calls[0]).toMatchObject({ url: '/photos/favorites/top', params: { limit: 8 } })
  })
  it.each([
    ['listFavoriteIds', 'get', '/photos/favorites/ids'],
  ] as const)('%s 发 %s %s', async (m, verb, url) => {
    const { http, calls } = capture()
    await (createPhotos(http, noToken) as never as Record<string, () => Promise<unknown>>)[m]()
    expect(calls[0]).toMatchObject({ method: verb, url })
  })
  it('listFavoriteIds 裸数组直接透传(后端从不包信封)', async () => {
    const { http } = capture(['a1'])
    const r = await createPhotos(http, noToken).listFavoriteIds()
    expect(r).toEqual(['a1'])
  })
  it('favorite/unfavorite/recordView 路由正确', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.favorite('a1'); await p.unfavorite('a1'); await p.recordView('a1')
    expect(calls[0]).toMatchObject({ method: 'post', url: '/photos/favorites/a1' })
    expect(calls[1]).toMatchObject({ method: 'delete', url: '/photos/favorites/a1' })
    expect(calls[2]).toMatchObject({ method: 'post', url: '/photos/views/a1' })
  })
  it('exportFavoritesUrl 用注入 getToken(不读 localStorage)', () => {
    const p = createPhotos({} as AxiosInstance, () => 'T1')
    expect(p.exportFavoritesUrl()).toBe('/v1/photos/favorites/export?token=T1')
  })
})
