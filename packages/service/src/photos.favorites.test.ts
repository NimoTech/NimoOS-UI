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

describe('photos search + favorites', () => {
  it('smartSearch sends POST /photos/search/smart with all params', async () => {
    const { http, calls } = capture()
    await createPhotos(http, noToken).smartSearch('猫', 50, 100, { type: 'image' })
    expect(calls[0]).toMatchObject({ method: 'post', url: '/photos/search/smart' })
    expect(calls[0].body).toEqual({ query: '猫', limit: 50, offset: 100, filters: { type: 'image' } })
  })
  it('searchFaces sends GET /photos/search/faces/:personId with paging', async () => {
    const { http, calls } = capture()
    await createPhotos(http, noToken).searchFaces('p1', 50, 0)
    expect(calls[0]).toMatchObject({ url: '/photos/search/faces/p1', params: { limit: 50, offset: 0 } })
  })
  it('listFavorites omits params when there is no limit, includes paging when there is (matches Vue2 conditional params)', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.listFavorites()
    expect(calls[0].params).toEqual({})
    await p.listFavorites(60, 120)
    expect(calls[1].params).toEqual({ limit: 60, offset: 120 })
  })
  it('topFavorites passes correct params (fixes Vue2 mistakenly wrapping it as {params:{limit}})', async () => {
    const { http, calls } = capture()
    await createPhotos(http, noToken).topFavorites(8)
    expect(calls[0]).toMatchObject({ url: '/photos/favorites/top', params: { limit: 8 } })
  })
  it.each([
    ['listFavoriteIds', 'get', '/photos/favorites/ids'],
  ] as const)('%s sends %s %s', async (m, verb, url) => {
    const { http, calls } = capture()
    await (createPhotos(http, noToken) as never as Record<string, () => Promise<unknown>>)[m]()
    expect(calls[0]).toMatchObject({ method: verb, url })
  })
  it('listFavoriteIds passes the bare array straight through (backend never wraps it in an envelope)', async () => {
    const { http } = capture(['a1'])
    const r = await createPhotos(http, noToken).listFavoriteIds()
    expect(r).toEqual(['a1'])
  })
  it('favorite/unfavorite/recordView route correctly', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.favorite('a1'); await p.unfavorite('a1'); await p.recordView('a1')
    expect(calls[0]).toMatchObject({ method: 'post', url: '/photos/favorites/a1' })
    expect(calls[1]).toMatchObject({ method: 'delete', url: '/photos/favorites/a1' })
    expect(calls[2]).toMatchObject({ method: 'post', url: '/photos/views/a1' })
  })
  it('exportFavoritesUrl uses the injected getToken (does not read localStorage)', () => {
    const p = createPhotos({} as AxiosInstance, () => 'T1')
    expect(p.exportFavoritesUrl()).toBe('/v1/photos/favorites/export?token=T1')
  })
})
