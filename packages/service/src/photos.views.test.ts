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

describe('photos smart views', () => {
  it('CRUD / duplicate', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.listSmartViews()
    await p.createSmartView({ name: '宝宝' })
    await p.getSmartView(5)
    await p.updateSmartView(5, { name: '娃' })
    await p.deleteSmartView(5)
    await p.duplicateSmartView(5)
    expect(calls[0]).toMatchObject({ method: 'get', url: '/photos/smart-views' })
    expect(calls[1]).toMatchObject({ method: 'post', url: '/photos/smart-views', body: { name: '宝宝' } })
    expect(calls[2]).toMatchObject({ method: 'get', url: '/photos/smart-views/5' })
    expect(calls[3]).toMatchObject({ method: 'put', url: '/photos/smart-views/5', body: { name: '娃' } })
    expect(calls[4]).toMatchObject({ method: 'delete', url: '/photos/smart-views/5' })
    expect(calls[5]).toMatchObject({ method: 'post', url: '/photos/smart-views/5/duplicate' })
  })
  it('assets / activity / preview / export', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.getSmartViewAssets(5, { limit: 30, offset: 60, recent: true })
    await p.getSmartViewActivity(5, 20)
    await p.previewSmartView({ condsRaw: 'x', description: 'd', threshold: 0.6, includeVideos: true })
    await p.exportSmartViewAlbum(5)
    expect(calls[0]).toMatchObject({ url: '/photos/smart-views/5/assets', params: { limit: 30, offset: 60, recent: true } })
    expect(calls[1]).toMatchObject({ url: '/photos/smart-views/5/activity', params: { limit: 20 } })
    expect(calls[2]).toMatchObject({ method: 'post', url: '/photos/smart-views/preview', body: { condsRaw: 'x', description: 'd', threshold: 0.6, includeVideos: true } })
    expect(calls[3]).toMatchObject({ method: 'post', url: '/photos/smart-views/5/export?format=album' })
  })
  it('exportSmartViewUrl includes format and token', () => {
    const p = createPhotos({} as AxiosInstance, () => 'T1')
    expect(p.exportSmartViewUrl(5, 'zip')).toBe('/v1/photos/smart-views/5/export?format=zip&token=T1')
  })
})
describe('photos trash', () => {
  it('list / single restore / batch / restore-all / purge / empty', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.listTrash()
    await p.restoreFromTrash('a1')
    await p.restoreTrashBatch(['a1', 'a2'])
    await p.restoreAllTrash()
    await p.purgeTrash('a1')
    await p.emptyTrash()
    expect(calls[0]).toMatchObject({ method: 'get', url: '/photos/trash' })
    expect(calls[1]).toMatchObject({ method: 'post', url: '/photos/trash/a1/restore' })
    expect(calls[2]).toMatchObject({ method: 'post', url: '/photos/trash/restore', body: { ids: ['a1', 'a2'] } })
    expect(calls[3]).toMatchObject({ method: 'post', url: '/photos/trash/restore', body: { ids: [] } })
    expect(calls[4]).toMatchObject({ method: 'delete', url: '/photos/trash/a1' })
    expect(calls[5]).toMatchObject({ method: 'post', url: '/photos/trash/empty' })
  })
})
