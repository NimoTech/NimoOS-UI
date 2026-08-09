// SP15-P2a-T1: smart-view manual asset HTTP layer. Re-verified against
// NimoOS-Photos/route/v1/smartviews.go — the request body key is "assetIds"
// (svAssetIDsReq), the three write endpoints return only change counts, and
// GET /excluded returns a bare array with no envelope key.
import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPhotos } from './photos.js'

type Call = { method: string; url: string; body?: unknown }

function harness(reply: unknown = {}) {
  const calls: Call[] = []
  const http = {
    get: async (url: string) => { calls.push({ method: 'get', url }); return { data: reply } },
    post: async (url: string, body?: unknown) => { calls.push({ method: 'post', url, body }); return { data: reply } },
  } as unknown as AxiosInstance
  return { calls, photos: createPhotos(http, () => 'TOK') }
}

describe('smart view manual asset API', () => {
  it('pinSmartViewAssets posts {assetIds} and returns the change count', async () => {
    const a = harness({ added: 3 })
    expect(await a.photos.pinSmartViewAssets('sv1', ['x', 'y'])).toEqual({ added: 3 })
    expect(a.calls[0]).toMatchObject({
      method: 'post', url: '/photos/smart-views/sv1/assets', body: { assetIds: ['x', 'y'] },
    })
  })

  it('removeSmartViewAssets hits the /remove suffix and returns both tiers', async () => {
    const a = harness({ unpinned: 2, excluded: 1 })
    expect(await a.photos.removeSmartViewAssets('sv1', ['x'])).toEqual({ unpinned: 2, excluded: 1 })
    expect(a.calls[0]).toMatchObject({
      method: 'post', url: '/photos/smart-views/sv1/assets/remove', body: { assetIds: ['x'] },
    })
  })

  it('restoreSmartViewAssets hits the /restore suffix', async () => {
    const a = harness({ restored: 4 })
    expect(await a.photos.restoreSmartViewAssets('sv1', ['x'])).toEqual({ restored: 4 })
    expect(a.calls[0]).toMatchObject({
      method: 'post', url: '/photos/smart-views/sv1/assets/restore', body: { assetIds: ['x'] },
    })
  })

  it('the three write methods fall back to an empty object when the body is absent', async () => {
    const a = harness(undefined)
    expect(await a.photos.pinSmartViewAssets('sv1', ['x'])).toEqual({})
    const b = harness(undefined)
    expect(await b.photos.removeSmartViewAssets('sv1', ['x'])).toEqual({})
    const c = harness(undefined)
    expect(await c.photos.restoreSmartViewAssets('sv1', ['x'])).toEqual({})
  })

  it('getSmartViewExcluded reads the bare array, defaulting to empty', async () => {
    const a = harness([{ id: 'a1' }])
    expect(await a.photos.getSmartViewExcluded('sv1')).toEqual([{ id: 'a1' }])
    expect(a.calls[0]).toMatchObject({ method: 'get', url: '/photos/smart-views/sv1/excluded' })

    const b = harness(undefined)
    expect(await b.photos.getSmartViewExcluded('sv1')).toEqual([])
  })
})
