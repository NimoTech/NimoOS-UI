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

describe('photos places', () => {
  it('listAssetsByPlace conditional params: spotKey and spot_lat/lon are only included as a pair (matches Vue2 comment: centroid pins down the precise spot cluster)', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.listAssetsByPlace('cn-hz')
    expect(calls[0]).toMatchObject({ url: '/photos/assets', params: { place_key: 'cn-hz', limit: 500 } })
    await p.listAssetsByPlace('cn-hz', 's1', 100, 30.2, 120.1)
    expect(calls[1].params).toEqual({ place_key: 'cn-hz', limit: 100, spot_key: 's1', spot_lat: 30.2, spot_lon: 120.1 })
    await p.listAssetsByPlace('cn-hz', '', 100, 30.2, 120.1) // coordinates are omitted when there is no spotKey
    expect(calls[2].params).toEqual({ place_key: 'cn-hz', limit: 100 })
  })
  it('detail / cover candidates / set and reset cover', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.listPlaces({ q: '杭' })
    await p.getPlace('cn-hz')
    await p.placeCoverCandidates('cn-hz', { tab: 'best', q: '塔', page: 2 })
    await p.setPlaceCover('cn-hz', 'a1')
    await p.resetPlaceCover('cn-hz')
    expect(calls[0]).toMatchObject({ url: '/photos/places', params: { q: '杭' } })
    expect(calls[1]).toMatchObject({ url: '/photos/places/cn-hz' })
    expect(calls[2]).toMatchObject({ url: '/photos/places/cn-hz/cover-candidates', params: { tab: 'best', q: '塔', page: 2 } })
    expect(calls[3]).toMatchObject({ method: 'put', url: '/photos/places/cn-hz/cover', body: { assetId: 'a1' } })
    expect(calls[4]).toMatchObject({ method: 'delete', url: '/photos/places/cn-hz/cover' })
  })
  it('spot naming: set goes through a PUT body, reset goes through DELETE with spotKey in the request body (api.delete(url,data) semantics)', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.setSpotName('cn-hz', 's1', '西湖')
    await p.resetSpotName('cn-hz', 's1')
    expect(calls[0]).toMatchObject({ method: 'put', url: '/photos/places/cn-hz/spot-name', body: { spotKey: 's1', name: '西湖' } })
    expect(calls[1].method).toBe('delete')
    expect((calls[1].cfg as { data?: unknown })?.data).toEqual({ spotKey: 's1' })
  })
  it('createPlaceAlbum defaults from/to to empty strings', async () => {
    const { http, calls } = capture()
    await createPhotos(http, noToken).createPlaceAlbum('cn-hz', { name: '杭州行' })
    expect(calls[0]).toMatchObject({ method: 'post', url: '/photos/places/cn-hz/album', body: { name: '杭州行', from: '', to: '' } })
  })
})
