import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      getPerson: vi.fn(),
      getPersonAssets: vi.fn(),
      personPlaces: vi.fn(),
    },
  },
}))

import { service } from '@nimotech/nimoos-service'
import { usePersonDetail, groupPersonAssets } from '../usePersonDetail'
import type { Photo } from '../../util/assetToPhoto'

function makeDeferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

async function flush(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve()
}

function P(id: string | number, extra: Partial<Photo> = {}): Photo {
  return {
    id, title: id, file: '', date: '', time: '', takenAt: null, indexedAt: null,
    mimeType: '', fileSize: 0, isVideo: false, hasOcr: false, isNew: false,
    pinned: false,
    isLivePhoto: false, livePhotoVideoId: null, duration: null, durationMs: 0,
    fav: false, status: undefined, filePath: '', width: null, height: null,
    dim: null, size: '', latitude: null, longitude: null, coords: null,
    place: null, camera: null, iso: null, shutter: null, aperture: null,
    focal: null, orientation: null, videoCodec: null, audioCodec: null,
    frameRate: null, bitRate: null, rotation: 0, matchScore: null,
    matchedBy: null, belowCut: false, tags: [], scene: null, faces: [],
    ...extra,
  }
}

describe('usePersonDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('After load succeeds: person/relations/places/months all in place; getPersonAssets receives (id,300,0)', async () => {
    ;(service.photos.getPerson as any).mockResolvedValue({
      person: { id: '7', name: 'Alice' },
      relations: [{ personId: '9', name: 'Bob', count: 3 }],
    })
    ;(service.photos.personPlaces as any).mockResolvedValue([{ placeName: 'Paris' }])
    ;(service.photos.getPersonAssets as any).mockResolvedValue([
      { id: 'a1', takenAt: '2026-03-01T00:00:00Z' },
    ])

    const { person, relations, places, months, loading, failed, load } = usePersonDetail()
    await load('7')

    expect(person.value?.id).toBe('7')
    expect(person.value?.name).toBe('Alice')
    expect(relations.value).toEqual([{ personId: '9', name: 'Bob', count: 3 }])
    expect(places.value).toEqual([{ placeName: 'Paris' }])
    expect(months.value).toHaveLength(1)
    expect(months.value[0].key).toBe('2026-03')
    expect(loading.value).toBe(false)
    expect(failed.value).toBe(false)
    expect(service.photos.getPersonAssets).toHaveBeenCalledWith('7', 300, 0)
  })

  it('Seq race guard: load(a) then load(b), even if a responds late does not overwrite b (using controllable deferred promise)', async () => {
    const deferredA = makeDeferred<any>()
    const deferredB = makeDeferred<any>()
    ;(service.photos.getPerson as any).mockImplementation((id: string) =>
      id === 'a' ? deferredA.promise : deferredB.promise,
    )
    ;(service.photos.personPlaces as any).mockResolvedValue([])
    ;(service.photos.getPersonAssets as any).mockResolvedValue([])

    const { person, load } = usePersonDetail()

    const pa = load('a')
    const pb = load('b')

    // b (sent later) resolves first
    deferredB.resolve({ person: { id: 'b', name: 'B' }, relations: [] })
    await flush()
    await pb

    // a (sent first but slow) resolves now — must be discarded
    deferredA.resolve({ person: { id: 'a', name: 'A' }, relations: [] })
    await flush()
    await pa

    expect(person.value?.id).toBe('b')
  })

  it('Seq race guard checkpoint ②: a getPerson passes checkpoint ① first (writes a person/relations), but a Promise.all(places+assets) returns slower than b entirely → places/months still b, not overwritten by a stale data', async () => {
    // Different from previous: previous used deferred to control only getPerson, a was blocked at checkpoint ①,
    // never reached checkpoint ② (after Promise.all). This one specifically lets a *pass* checkpoint ①,
    // write person/relations to a, then gets stuck on Promise.all([personPlaces, getPersonAssets]) returning slower than b,
    // only checkpoint ② can stop this overwrite.
    const deferredAPlaces = makeDeferred<any>()
    const deferredAAssets = makeDeferred<any>()

    ;(service.photos.getPerson as any).mockImplementation((id: string) =>
      Promise.resolve(id === 'a'
        ? { person: { id: 'a', name: 'A' }, relations: [] }
        : { person: { id: 'b', name: 'B' }, relations: [] }),
    )
    ;(service.photos.personPlaces as any).mockImplementation((id: string) =>
      id === 'a' ? deferredAPlaces.promise : Promise.resolve([{ placeName: 'B-place' }]),
    )
    ;(service.photos.getPersonAssets as any).mockImplementation((id: string) =>
      id === 'a' ? deferredAAssets.promise : Promise.resolve([{ id: 'b1', takenAt: '2026-05-01T00:00:00Z' }]),
    )

    const { person, places, months, load } = usePersonDetail()

    const pa = load('a')
    await flush() // let a pass checkpoint ① (write person/relations to a), then get stuck on Promise.all
    expect(person.value?.id).toBe('a') // confirm a really passed checkpoint ① first, not blocked early

    const pb = load('b')
    await pb // b resolves immediately throughout, complete run: person/places/months all become b

    expect(person.value?.id).toBe('b')
    expect(places.value).toEqual([{ placeName: 'B-place' }])

    // a places/assets now resolve tardily — must be stopped by checkpoint ②, cannot overwrite b data
    deferredAPlaces.resolve([{ placeName: 'A-place-STALE' }])
    deferredAAssets.resolve([{ id: 'a1', takenAt: '2026-01-01T00:00:00Z' }])
    await flush()
    await pa

    expect(places.value).toEqual([{ placeName: 'B-place' }])
    expect(months.value.map((m) => m.key)).toEqual(['2026-05'])
  })

  it('getPerson throws → failed=true, loading=false, console.error called, four data refs stay empty', async () => {
    const err = new Error('boom')
    ;(service.photos.getPerson as any).mockRejectedValue(err)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { person, relations, places, months, loading, failed, load } = usePersonDetail()
    await load('7')

    expect(failed.value).toBe(true)
    expect(loading.value).toBe(false)
    expect(errSpy).toHaveBeenCalled()
    expect(person.value).toBeNull()
    expect(relations.value).toEqual([])
    expect(places.value).toEqual([])
    expect(months.value).toEqual([])
  })

  it('relations/places/assets return null (Go nil slice) → empty array does not crash', async () => {
    ;(service.photos.getPerson as any).mockResolvedValue({ person: { id: '7' }, relations: null })
    ;(service.photos.personPlaces as any).mockResolvedValue(null)
    ;(service.photos.getPersonAssets as any).mockResolvedValue(null)

    const { relations, places, months, failed, load } = usePersonDetail()
    await load('7')

    expect(failed.value).toBe(false)
    expect(relations.value).toEqual([])
    expect(places.value).toEqual([])
    expect(months.value).toEqual([])
  })

  describe('groupPersonAssets', () => {
    it('Bucket by first 7 chars of takenAt; month keys descending; missing takenAt goes to unknown bucket and sorts last; title uses monthKeyLabel', () => {
      const photos = [
        P('1', { takenAt: '2026-01-15T00:00:00Z' }),
        P('2', { takenAt: '2026-03-02T00:00:00Z' }),
        P('3', { takenAt: null }),
        P('4', { takenAt: '2026-03-20T00:00:00Z' }),
      ]
      const months = groupPersonAssets(photos)
      expect(months.map((m) => m.key)).toEqual(['2026-03', '2026-01', 'unknown'])
      expect(months.find((m) => m.key === '2026-03')?.title).toBe('March 2026')
      expect(months.find((m) => m.key === 'unknown')?.title).toBe('unknown')
      expect(months.find((m) => m.key === '2026-03')?.photos.map((p) => p.id)).toEqual(['2', '4'])
    })
  })

  describe('patchPerson', () => {
    it('When person is loaded: partial merge patch', async () => {
      ;(service.photos.getPerson as any).mockResolvedValue({ person: { id: '7', name: 'Alice' }, relations: [] })
      ;(service.photos.personPlaces as any).mockResolvedValue([])
      ;(service.photos.getPersonAssets as any).mockResolvedValue([])

      const { person, load, patchPerson } = usePersonDetail()
      await load('7')

      expect(patchPerson({ name: 'Alice2', favorite: true }, '7')).toBe(true)
      expect(person.value?.id).toBe('7') // fields not covered by patch fields keep original values
      expect(person.value?.name).toBe('Alice2')
      expect(person.value?.favorite).toBe(true)
    })

    it('When person is null (not yet loaded or load failed): no-op, does not crash', () => {
      const { person, patchPerson } = usePersonDetail()
      expect(person.value).toBeNull()
      // No load run yet ⇒ currentId still null ⇒ any expectId is stale.
      expect(patchPerson({ name: 'X' }, 'X')).toBe(false)
      expect(person.value).toBeNull()
    })

    // ── Review Important 3: identity guard ────────────────────────────────────────────
    it('When expectId does not match currently held person: entire write-back void (returns false, data unchanged)', async () => {
      ;(service.photos.getPerson as any).mockResolvedValue({ person: { id: '7', name: 'Alice' }, relations: [] })
      ;(service.photos.personPlaces as any).mockResolvedValue([])
      ;(service.photos.getPersonAssets as any).mockResolvedValue([])

      const { person, load, patchPerson, isCurrent } = usePersonDetail()
      await load('7')

      expect(isCurrent('7')).toBe(true)
      expect(isCurrent(7)).toBe(true)          // iron law: String() normalization, numeric ids also count as same person
      expect(isCurrent('8')).toBe(false)
      expect(patchPerson({ name: 'HIJACKED' }, '8')).toBe(false)
      expect(person.value?.name).toBe('Alice')
    })

    it('load(new id) swaps identity immediately on entry — without waiting for response, stale person in-flight write-back void immediately', () => {
      let resolveGet: ((v: unknown) => void) | undefined
      ;(service.photos.getPerson as any).mockImplementation(() => new Promise((r) => { resolveGet = r }))
      ;(service.photos.personPlaces as any).mockResolvedValue([])
      ;(service.photos.getPersonAssets as any).mockResolvedValue([])

      const { load, isCurrent } = usePersonDetail()
      void load('A')
      expect(isCurrent('A')).toBe(true)
      void load('B')                            // route changes, watch calls load
      expect(isCurrent('A')).toBe(false)        // A not yet resolved, identity already not A
      expect(isCurrent('B')).toBe(true)
      resolveGet?.({ person: { id: 'B' }, relations: [] })
    })
  })

  describe('removePhotosLocally / flatPhotos', () => {
    it('Remove by id (numeric id iron law), empty month disappears entirely; flatPhotos order = concatenate all months', async () => {
      ;(service.photos.getPerson as any).mockResolvedValue({ person: { id: '7' }, relations: [] })
      ;(service.photos.personPlaces as any).mockResolvedValue([])
      ;(service.photos.getPersonAssets as any).mockResolvedValue([
        { id: 1, takenAt: '2026-02-01T00:00:00Z' },
        { id: '2', takenAt: '2026-01-01T00:00:00Z' },
      ])

      const { months, load, removePhotosLocally, flatPhotos } = usePersonDetail()
      await load('7')

      expect(flatPhotos().map((p) => String(p.id))).toEqual(['1', '2'])

      // Month '1' (2026-02) has only one photo, id is numeric 1; remove with string '1', iron law requires hit
      removePhotosLocally(['1'])
      expect(months.value.map((m) => m.key)).toEqual(['2026-01'])
      expect(flatPhotos().map((p) => String(p.id))).toEqual(['2'])
    })
  })
})
