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

describe('photos persons', () => {
  it('list / detail / update / cover', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.listPersons()
    await p.getPerson('p1')
    await p.updatePerson('p1', { name: '张三' })
    await p.setPersonCover('p1', 'a1')
    await p.resetPersonCover('p1')
    expect(calls[0]).toMatchObject({ method: 'get', url: '/photos/persons' })
    expect(calls[1]).toMatchObject({ method: 'get', url: '/photos/persons/p1' })
    expect(calls[2]).toMatchObject({ method: 'put', url: '/photos/persons/p1', body: { name: '张三' } })
    expect(calls[3]).toMatchObject({ method: 'put', url: '/photos/persons/p1/cover', body: { assetId: 'a1' } })
    expect(calls[4]).toMatchObject({ method: 'delete', url: '/photos/persons/p1/cover' })
  })
  it('delete / purge (?purge=true in the URL) / restore', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.deletePerson('p1'); await p.purgePerson('p1'); await p.restorePerson('p1')
    expect(calls[0]).toMatchObject({ method: 'delete', url: '/photos/persons/p1' })
    expect(calls[1]).toMatchObject({ method: 'delete', url: '/photos/persons/p1?purge=true' })
    expect(calls[2]).toMatchObject({ method: 'post', url: '/photos/persons/p1/restore' })
  })
  // Task 7 (Plan D, SP7-P5 People): hidePerson/listHiddenPersons — the literal counterpart
  // endpoints of Vue2 src/service/photos.js:78-79.
  it('hide a person / fetch the hidden-person list', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.hidePerson('p1')
    await p.listHiddenPersons()
    expect(calls[0]).toMatchObject({ method: 'post', url: '/photos/persons/p1/hide', body: {} })
    expect(calls[1]).toMatchObject({ method: 'get', url: '/photos/persons/hidden' })
  })
  it('asset paging / relations / places', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.getPersonAssets('p1', 100, 200)
    await p.personRelations('p1')
    await p.personPlaces('p1')
    expect(calls[0]).toMatchObject({ url: '/photos/persons/p1/assets', params: { limit: 100, offset: 200 } })
    expect(calls[1]).toMatchObject({ url: '/photos/persons/p1/relations' })
    expect(calls[2]).toMatchObject({ url: '/photos/persons/p1/places' })
  })
  it('merge-suggestions flow (snake_case request body matches the backend) with recluster/detach', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.mergePersons('p1', 'p2')
    await p.mergeSuggestions()
    await p.rejectMergeSuggestion('p1', 'p2')
    await p.reclusterFaces()
    await p.detachAssetsFromPerson('p1', ['a1'])
    expect(calls[0]).toMatchObject({ method: 'post', url: '/photos/persons/merge', body: { from_id: 'p1', into_id: 'p2' } })
    expect(calls[1]).toMatchObject({ method: 'get', url: '/photos/persons/merge-suggestions' })
    expect(calls[2]).toMatchObject({ method: 'post', url: '/photos/persons/merge-suggestions/reject', body: { from_id: 'p1', into_id: 'p2' } })
    expect(calls[3]).toMatchObject({ method: 'post', url: '/photos/persons/recluster' })
    expect(calls[4]).toMatchObject({ method: 'post', url: '/photos/persons/p1/detach', body: { assetIds: ['a1'] } })
  })
  it('personFaceThumbnailUrl includes token', () => {
    const p = createPhotos({} as AxiosInstance, () => 'T1')
    expect(p.personFaceThumbnailUrl('p1')).toBe('/v1/photos/persons/p1/face-thumbnail?token=T1')
  })
  it('personFaceThumbnailUrl appends ?v= when ver is given, and token switches to &', () => {
    const p = createPhotos({} as AxiosInstance, () => 'T1')
    expect(p.personFaceThumbnailUrl('p1', 'face9')).toBe('/v1/photos/persons/p1/face-thumbnail?v=face9&token=T1')
  })
  it('ver of 0 is treated as valid (not a default/omission)', () => {
    const p = createPhotos({} as AxiosInstance, () => 'T1')
    expect(p.personFaceThumbnailUrl('p1', 0)).toBe('/v1/photos/persons/p1/face-thumbnail?v=0&token=T1')
  })
  it('ver omitted/empty string matches the old signature exactly (backward compatible)', () => {
    const p = createPhotos({} as AxiosInstance, () => 'T1')
    expect(p.personFaceThumbnailUrl('p1')).toBe('/v1/photos/persons/p1/face-thumbnail?token=T1')
    expect(p.personFaceThumbnailUrl('p1', '')).toBe('/v1/photos/persons/p1/face-thumbnail?token=T1')
  })
})
