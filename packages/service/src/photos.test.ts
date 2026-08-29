import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPhotos } from './photos'

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

describe('createPhotos', () => {
  it('listAssets passes limit/offset and returns a bare array', async () => {
    let seen: unknown
    const http = { get: async (_u: string, cfg?: { params?: unknown }) => { seen = cfg?.params; return { data: [{ id: 1 }] } } } as unknown as AxiosInstance
    const p = createPhotos(http, () => 'tok')
    expect(await p.listAssets(10, 5)).toEqual([{ id: 1 }])
    expect(seen).toEqual({ limit: 10, offset: 5 })
  })
  it('thumbnailUrl embeds size and url-encoded token', () => {
    const p = createPhotos({} as AxiosInstance, () => 'a/b c')
    expect(p.thumbnailUrl('42')).toBe('/v1/photos/assets/42/thumbnail?size=small&token=a%2Fb%20c')
    expect(p.thumbnailUrl('42', 'large')).toContain('size=large')
  })
  it('thumbnailUrl omits token when none', () => {
    const p = createPhotos({} as AxiosInstance, () => null)
    expect(p.thumbnailUrl('7')).toBe('/v1/photos/assets/7/thumbnail?size=small')
  })
  it('originalUrl builds the original path', () => {
    const p = createPhotos({} as AxiosInstance, () => 't')
    expect(p.originalUrl('9')).toBe('/v1/photos/assets/9/original?token=t')
  })
  it('listAssets unwraps an envelope', async () => {
    const http = { get: async () => ({ data: { success: 200, data: [{ id: 9 }] } }) } as unknown as AxiosInstance
    const p = createPhotos(http, () => null)
    expect(await p.listAssets()).toEqual([{ id: 9 }])
  })
  it('getTimelineBuckets hits the bucket directory endpoint with no params', async () => {
    const { http, calls } = capture([{ year: 2026, month: 8, count: 3, videoCount: 1 }])
    const p = createPhotos(http, noToken)
    expect(await p.getTimelineBuckets()).toEqual([{ year: 2026, month: 8, count: 3, videoCount: 1 }])
    expect(calls[0]).toMatchObject({ method: 'get', url: '/photos/timeline/buckets' })
    expect(calls[0].params).toBeUndefined()
  })
  it('getTimelineBucket passes year/month/limit/offset', async () => {
    const { http, calls } = capture([])
    const p = createPhotos(http, noToken)
    await p.getTimelineBucket(2026, 8, 500, 1000)
    expect(calls[0].url).toBe('/photos/timeline/bucket')
    expect(calls[0].params).toEqual({ year: 2026, month: 8, limit: 500, offset: 1000 })
  })
  it('getTimelineBucket defaults to the backend page cap and offset 0', async () => {
    const { http, calls } = capture([])
    const p = createPhotos(http, noToken)
    await p.getTimelineBucket(0, 0)
    expect(calls[0].params).toEqual({ year: 0, month: 0, limit: 500, offset: 0 })
  })
  it('listTrash omits paging params when limit is 0 and passes them when set', async () => {
    const { http, calls } = capture([])
    const p = createPhotos(http, noToken)
    await p.listTrash()
    expect(calls[0].params).toEqual({})
    await p.listTrash(500, 500)
    expect(calls[1].params).toEqual({ limit: 500, offset: 500 })
  })
})

describe('photos core block', () => {
  it('getAsset sends GET /photos/assets/:id and unwraps the envelope', async () => {
    const { http, calls } = capture({ id: 'a1' })
    const r = await createPhotos(http, noToken).getAsset('a1')
    expect(calls[0]).toMatchObject({ method: 'get', url: '/photos/assets/a1' })
    expect(r).toEqual({ id: 'a1' })
  })
  it('getAssetOcr passes params when given q, no params when q is omitted', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.getAssetOcr('a1', '猫')
    expect(calls[0]).toMatchObject({ url: '/photos/assets/a1/ocr', params: { q: '猫' } })
    await p.getAssetOcr('a1')
    expect(calls[1].params).toBeUndefined()
  })
  it('deleteAsset sends DELETE /photos/assets/:id', async () => {
    const { http, calls } = capture()
    await createPhotos(http, noToken).deleteAsset('a1')
    expect(calls[0]).toMatchObject({ method: 'delete', url: '/photos/assets/a1' })
  })
  it('deleteAsset 204 empty body → resolves undefined (backend NoContent, matches the unfavorite pattern)', async () => {
    const http = { delete: async () => ({ data: '', headers: {} }) } as unknown as AxiosInstance
    const r = await createPhotos(http, noToken).deleteAsset('a1')
    expect(r).toBeUndefined()
  })
  it('updateConfig only includes non-empty fields (matches Vue2 field-by-field emptiness checks)', async () => {
    const { http, calls } = capture()
    await createPhotos(http, noToken).updateConfig(['/DATA/Gallery'], 30, null, { ocrEnabled: true })
    expect(calls[0]).toMatchObject({ method: 'put', url: '/photos/config' })
    expect(calls[0].body).toEqual({ watchDirs: ['/DATA/Gallery'], retentionDays: 30, ocrEnabled: true })
  })
  it.each([
    ['getConfig', 'get', '/photos/config'],
    ['getStorage', 'get', '/photos/storage'],
    ['getAbout', 'get', '/photos/about'],
    ['getStatus', 'get', '/photos/status'],
    ['listTasks', 'get', '/photos/tasks'],
    ['pruneCache', 'post', '/photos/cache/prune'],
    ['rebuildIndex', 'post', '/photos/index/rebuild'],
    ['triggerScan', 'post', '/photos/scan'],
  ] as const)('%s sends %s %s', async (m, verb, url) => {
    const { http, calls } = capture()
    await (createPhotos(http, noToken) as never as Record<string, () => Promise<unknown>>)[m]()
    expect(calls[0]).toMatchObject({ method: verb, url })
  })
  it('envelope throws when success !== 200', async () => {
    const http = { get: async () => ({ data: { success: 500, message: '炸了' } }) } as unknown as AxiosInstance
    await expect(createPhotos(http, noToken).getConfig()).rejects.toThrow('炸了')
  })
  it('originalUrl/liveUrl consistently append token, omit when there is none', () => {
    const p = createPhotos({} as AxiosInstance, () => 'T&1')
    expect(p.originalUrl('a1')).toBe('/v1/photos/assets/a1/original?token=T%261')
    expect(p.liveUrl('a1')).toBe('/v1/photos/assets/a1/live?token=T%261')
    const p2 = createPhotos({} as AxiosInstance, noToken)
    expect(p2.originalUrl('a1')).toBe('/v1/photos/assets/a1/original')
  })
})
