// SP15-P2b-T1: the two album <-> smart-view conversion endpoints. Verified against
// NimoOS-Photos/route/v1/smartviews.go (FromAlbum) and route/v1/albums.go
// (FromSmartView): both return the full new object, not a change count, and the
// album-name collision surfaces as HTTP 409.
import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPhotos } from './photos.js'

type Call = { method: string; url: string; body?: unknown }

function harness(reply: unknown = {}) {
  const calls: Call[] = []
  const http = {
    post: async (url: string, body?: unknown) => { calls.push({ method: 'post', url, body }); return { data: reply } },
  } as unknown as AxiosInstance
  return { calls, photos: createPhotos(http, () => 'TOK') }
}

describe('album <-> smart view conversion API', () => {
  it('convertAlbumToSmart posts albumId alongside the payload and returns the new smart view', async () => {
    const a = harness({ id: 'sv-new', name: 'Trip' })
    const out = await a.photos.convertAlbumToSmart('al-1', { description: 'sunsets', threshold: 80 })
    expect(out).toEqual({ id: 'sv-new', name: 'Trip' })
    expect(a.calls[0]).toMatchObject({
      method: 'post',
      url: '/photos/smart-views/from-album',
      body: { albumId: 'al-1', description: 'sunsets', threshold: 80 },
    })
  })

  it('convertAlbumToSmart keeps a numeric album id intact in the body', async () => {
    const a = harness({ id: 'sv-new' })
    await a.photos.convertAlbumToSmart(7, { description: 'x', threshold: 60 })
    expect((a.calls[0].body as { albumId: unknown }).albumId).toBe(7)
  })

  it('convertAlbumToSmart forwards the optional fields when given', async () => {
    const a = harness({ id: 'sv-new' })
    await a.photos.convertAlbumToSmart('al-1', {
      description: 'x', threshold: 70, name: 'N', conds: ['scene: sunset'], includeVideos: true,
    })
    expect(a.calls[0].body).toEqual({
      albumId: 'al-1', description: 'x', threshold: 70, name: 'N', conds: ['scene: sunset'], includeVideos: true,
    })
  })

  it('convertSmartToAlbum posts only smartViewId and returns the new album', async () => {
    const a = harness({ id: 'al-new', name: 'Trip' })
    const out = await a.photos.convertSmartToAlbum('sv-1')
    expect(out).toEqual({ id: 'al-new', name: 'Trip' })
    expect(a.calls[0]).toMatchObject({
      method: 'post', url: '/photos/albums/from-smartview', body: { smartViewId: 'sv-1' },
    })
  })
})
