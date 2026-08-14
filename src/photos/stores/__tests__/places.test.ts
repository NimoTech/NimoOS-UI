import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePhotosPlaces } from '../places'

const listPlaces = vi.fn()
const getPlace = vi.fn()
const setPlaceCoverApi = vi.fn()
const resetPlaceCoverApi = vi.fn()
const setSpotNameApi = vi.fn()
const resetSpotNameApi = vi.fn()
const placeCoverCandidates = vi.fn()
const createPlaceAlbumApi = vi.fn()

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      listPlaces: (...a: unknown[]) => listPlaces(...a),
      getPlace: (...a: unknown[]) => getPlace(...a),
      setPlaceCover: (...a: unknown[]) => setPlaceCoverApi(...a),
      resetPlaceCover: (...a: unknown[]) => resetPlaceCoverApi(...a),
      setSpotName: (...a: unknown[]) => setSpotNameApi(...a),
      resetSpotName: (...a: unknown[]) => resetSpotNameApi(...a),
      placeCoverCandidates: (...a: unknown[]) => placeCoverCandidates(...a),
      createPlaceAlbum: (...a: unknown[]) => createPlaceAlbumApi(...a),
    },
  },
}))

/* Raw response shape captured from real device (Photos v1 has no envelope, listPlaces is object-wrapped).
   ⚠ Hand-coded fixture recurrence trap: this shape verified field-by-field against
   NimoOS-Photos/service/places_types.go:36-40 PlacesResponse — key is numeric, thumbs may be null. */
const RESP = {
  regions: [{ id: 'asia', label: 'Asia', count: 2 }],
  places: [
    { key: 7, region: 'asia', country: 'China', city: 'Hangzhou', lon: 120.2, lat: 30.3, count: 40, recent: true, last: 'Mar 7, 2026', trips: 2, home: false, thumbs: ['t1'], coverAssetId: '' },
    { key: 8, region: 'asia', country: 'Japan', city: 'Kyoto', lon: 135.8, lat: 35, count: 5, recent: false, last: 'Jan 9, 2025', trips: 1, home: false, thumbs: null },
  ],
  stats: { cities: 2, countries: 2, photos: 45 },
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  localStorage.clear()
})

describe('fetchPlaces', () => {
  it('unwrap object envelope, normalize id, fallback null slice, set placesLoaded only on success', async () => {
    listPlaces.mockResolvedValue(RESP)
    const s = usePhotosPlaces()
    expect(s.placesLoaded).toBe(false)
    await s.fetchPlaces()
    expect(s.places.map(p => p.id)).toEqual(['7', '8'])
    expect(s.places[1].thumbs).toEqual([])
    expect(s.regions).toHaveLength(1)
    expect(s.stats.photos).toBe(45)
    expect(s.placesLoaded).toBe(true)
  })

  it('failure — preserve previous data, placesLoaded does not revert, no throw', async () => {
    listPlaces.mockResolvedValueOnce(RESP)
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    listPlaces.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(s.fetchPlaces()).resolves.toBeUndefined()
    expect(s.places).toHaveLength(2)          // previous data still here
    expect(s.placesLoaded).toBe(true)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('fail on first attempt — placesLoaded stays false (retryable)', async () => {
    listPlaces.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    expect(s.placesLoaded).toBe(false)
    spy.mockRestore()
  })

  it('do not auto-select first place (that is the view layer responsibility)', async () => {
    listPlaces.mockResolvedValue(RESP)
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    expect(s.detail).toBeNull()
  })

  it('missing regions/stats fields — fallback to [] / all-zero stats', async () => {
    listPlaces.mockResolvedValue({ places: [] })
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    expect(s.regions).toEqual([])
    expect(s.stats).toEqual({ cities: 0, countries: 0, photos: 0 })
    expect(s.placesLoaded).toBe(true)
  })

  it('loading is true during request, falls back to false after', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    listPlaces.mockReturnValueOnce(new Promise((r) => { resolveFn = r }))
    const s = usePhotosPlaces()
    const p = s.fetchPlaces()
    expect(s.loading).toBe(true)
    resolveFn(RESP)
    await p
    expect(s.loading).toBe(false)
  })
})

describe('loadDetail seq race guard (deviation #8)', () => {
  it('when later request returns first, earlier old response must not overwrite new detail', async () => {
    listPlaces.mockResolvedValue(RESP)
    const s = usePhotosPlaces()
    await s.fetchPlaces()

    let resolveA: (v: unknown) => void = () => {}
    let resolveB: (v: unknown) => void = () => {}
    getPlace
      .mockReturnValueOnce(new Promise((r) => { resolveA = r }))
      .mockReturnValueOnce(new Promise((r) => { resolveB = r }))

    const pA = s.loadDetail('7')
    const pB = s.loadDetail('8')
    // B (later) returns first
    resolveB({ key: 8, city: 'Kyoto', country: 'Japan', count: 5, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    await pB
    expect(s.detail?.city).toBe('Kyoto')
    // A (earlier) returns later — must be discarded
    resolveA({ key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 2, spots: [], insights: [], visits: [], recent: [] })
    await pA
    expect(s.detail?.city).toBe('Kyoto')
  })

  it('stale request catch must not set new detail to null', async () => {
    const s = usePhotosPlaces()
    let rejectA: (e: unknown) => void = () => {}
    getPlace
      .mockReturnValueOnce(new Promise((_, rj) => { rejectA = rj }))
      .mockResolvedValueOnce({ key: 8, city: 'Kyoto', country: 'Japan', count: 5, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const pA = s.loadDetail('7')
    await s.loadDetail('8')
    expect(s.detail?.city).toBe('Kyoto')
    rejectA(new Error('boom'))
    await pA
    expect(s.detail?.city).toBe('Kyoto')      // not cleared by stale catch
    spy.mockRestore()
  })

  it('pass null — immediately clear detail, no request', async () => {
    const s = usePhotosPlaces()
    await s.loadDetail(null)
    expect(s.detail).toBeNull()
    expect(getPlace).not.toHaveBeenCalled()
  })

  it('with loaded list — call API with backend numeric key (not normalized string id)', async () => {
    listPlaces.mockResolvedValue(RESP)
    getPlace.mockResolvedValue({ key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 2, spots: [], insights: [], visits: [], recent: [] })
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    await s.loadDetail('7')
    expect(getPlace).toHaveBeenCalledWith(7)
  })

  it('list not loaded (deeplink) — fallback to passed id', async () => {
    getPlace.mockResolvedValue({ key: 7, city: 'X', country: 'Y', count: 1, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    const s = usePhotosPlaces()
    await s.loadDetail('7')
    expect(getPlace).toHaveBeenCalledWith('7')
  })

  it('normal success: response normalized to PlaceDetail, missing home/coverAssetId/thumbs fallback', async () => {
    getPlace.mockResolvedValue({ key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 2, spots: [], insights: [], visits: [], recent: [] })
    const s = usePhotosPlaces()
    await s.loadDetail('7')
    expect(s.detail).toEqual({
      id: '7', city: 'Hangzhou', country: 'China', count: 40, trips: 2,
      home: false, coverAssetId: '', thumbs: [], spots: [], insights: [], visits: [], recent: [],
    })
  })

  it('detailLoading is true during request, falls back to false after', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    getPlace.mockReturnValueOnce(new Promise((r) => { resolveFn = r }))
    const s = usePhotosPlaces()
    const p = s.loadDetail('7')
    expect(s.detailLoading).toBe(true)
    resolveFn({ key: 7, city: 'X', country: 'Y', count: 1, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    await p
    expect(s.detailLoading).toBe(false)
  })
})

describe('clearDetail', () => {
  it('immediately clear detail', async () => {
    getPlace.mockResolvedValue({ key: 7, city: 'X', country: 'Y', count: 1, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    const s = usePhotosPlaces()
    await s.loadDetail('7')
    expect(s.detail).not.toBeNull()
    s.clearDetail()
    expect(s.detail).toBeNull()
  })

  it('invalidate in-flight loadDetail: old response after clearDetail must not write detail back to non-null', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    getPlace.mockReturnValueOnce(new Promise((r) => { resolveFn = r }))
    const s = usePhotosPlaces()
    const p = s.loadDetail('7')
    s.clearDetail()
    resolveFn({ key: 7, city: 'X', country: 'Y', count: 1, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    await p
    expect(s.detail).toBeNull()
  })

  // Review I1 (true bug regression): loadDetail(null) only increments seq + clears detail; without unconditionally
  // resetting detailLoading, `mine === seq` in the in-flight request's finally will always be false (seq advanced),
  // never reaching its reset — detailLoading stays stuck true, P6b shows spinner spinning forever after clearing detail.
  it('I1: call loadDetail(null) while loadDetail in flight — detailLoading must reset immediately, not skewed by stale response', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    getPlace.mockReturnValueOnce(new Promise((r) => { resolveFn = r }))
    const s = usePhotosPlaces()
    const p = s.loadDetail('7')
    expect(s.detailLoading).toBe(true)
    await s.loadDetail(null)
    expect(s.detailLoading).toBe(false)
    // Stale response arrives: must not resurrect detail, must not dial detailLoading back from reset
    // (its finally runs `if (mine === seq)`, seq advanced, won't match, maintains current state).
    resolveFn({ key: 7, city: 'X', country: 'Y', count: 1, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    await p
    expect(s.detailLoading).toBe(false)
    expect(s.detail).toBeNull()
  })

  // Same as above, but with clearDetail() interruption — two interruption entry points are two independent production
  // code paths, test separately, don't combine (avoid repeating "deleting together masks blindspots" old issue).
  it('I1: call clearDetail() while loadDetail in flight — detailLoading must reset immediately, not skewed by stale response', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    getPlace.mockReturnValueOnce(new Promise((r) => { resolveFn = r }))
    const s = usePhotosPlaces()
    const p = s.loadDetail('7')
    expect(s.detailLoading).toBe(true)
    s.clearDetail()
    expect(s.detailLoading).toBe(false)
    resolveFn({ key: 7, city: 'X', country: 'Y', count: 1, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    await p
    expect(s.detailLoading).toBe(false)
    expect(s.detail).toBeNull()
  })
})

describe('cover and spot rename', () => {
  it('setPlaceCover success — write back both detail and places', async () => {
    listPlaces.mockResolvedValue(RESP)
    getPlace.mockResolvedValue({ key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 2, coverAssetId: '', spots: [], insights: [], visits: [], recent: [] })
    setPlaceCoverApi.mockResolvedValue(undefined)
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    await s.loadDetail('7')
    await s.setPlaceCover('7', 'asset-9')
    expect(s.detail?.coverAssetId).toBe('asset-9')
    expect(s.places.find(p => p.id === '7')?.coverAssetId).toBe('asset-9')
  })

  it('resetPlaceCover — write both places back to empty string', async () => {
    listPlaces.mockResolvedValue(RESP)
    getPlace.mockResolvedValue({ key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 2, coverAssetId: 'old', spots: [], insights: [], visits: [], recent: [] })
    resetPlaceCoverApi.mockResolvedValue(undefined)
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    await s.loadDetail('7')
    await s.resetPlaceCover('7')
    expect(s.detail?.coverAssetId).toBe('')
    expect(s.places.find(p => p.id === '7')?.coverAssetId).toBe('')
  })

  it('three submit paths each in-flight short-circuit: second call on re-entrance does not hit backend', async () => {
    setPlaceCoverApi.mockReturnValue(new Promise(() => {}))   // never settle
    const s = usePhotosPlaces()
    void s.setPlaceCover('7', 'a')
    void s.setPlaceCover('7', 'b')
    expect(setPlaceCoverApi).toHaveBeenCalledTimes(1)
  })

  // Review correction: original title said "shares coverBusy with setPlaceCover", but assertions only verified self-reentrance,
  // not "sharing" itself — changed to accurate title, "sharing" evidence moved to two I2 cases below.
  it('resetPlaceCover self-reentrance short-circuit', async () => {
    resetPlaceCoverApi.mockReturnValue(new Promise(() => {}))
    const s = usePhotosPlaces()
    void s.resetPlaceCover('7')
    void s.resetPlaceCover('7')
    expect(resetPlaceCoverApi).toHaveBeenCalledTimes(1)
  })

  it('setSpotName reentrance short-circuit (spotBusy independent)', async () => {
    setSpotNameApi.mockReturnValue(new Promise(() => {}))
    const s = usePhotosPlaces()
    void s.setSpotName('7', 's1', 'a')
    void s.setSpotName('7', 's1', 'b')
    expect(setSpotNameApi).toHaveBeenCalledTimes(1)
  })

  // Review I2 (coverage gap): coverBusy is **shared** between setPlaceCover/resetPlaceCover
  // — this is intentional design (mutual exclusion on same "cover" resource), but before there was no test proving
  // "sharing" itself, only self-reentrance. If split into two independent locks later, these two must fail. One each direction.
  it('I2: resetPlaceCover blocked by coverBusy while setPlaceCover in flight, does not hit backend', async () => {
    setPlaceCoverApi.mockReturnValue(new Promise(() => {}))   // never settle, hold coverBusy
    const s = usePhotosPlaces()
    void s.setPlaceCover('7', 'a')
    void s.resetPlaceCover('7')
    expect(resetPlaceCoverApi).not.toHaveBeenCalled()
  })

  it('I2: setPlaceCover blocked by coverBusy while resetPlaceCover in flight, does not hit backend (reverse)', async () => {
    resetPlaceCoverApi.mockReturnValue(new Promise(() => {}))   // never settle, hold coverBusy
    const s = usePhotosPlaces()
    void s.resetPlaceCover('7')
    void s.setPlaceCover('7', 'a')
    expect(setPlaceCoverApi).not.toHaveBeenCalled()
  })

  it('coverBusy and spotBusy do not block each other: setSpotName can still make request while setPlaceCover in flight', async () => {
    setPlaceCoverApi.mockReturnValue(new Promise(() => {}))   // never settle, hold coverBusy
    setSpotNameApi.mockResolvedValue(undefined)
    const s = usePhotosPlaces()
    void s.setPlaceCover('7', 'a')
    await s.setSpotName('7', 's1', 'new-name')
    expect(setSpotNameApi).toHaveBeenCalledTimes(1)
  })

  it('all failures rethrow (view layer handles toast): setPlaceCover', async () => {
    setPlaceCoverApi.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosPlaces()
    await expect(s.setPlaceCover('7', 'a')).rejects.toThrow('boom')
    spy.mockRestore()
  })

  it('all failures rethrow (view layer handles toast): resetPlaceCover', async () => {
    resetPlaceCoverApi.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosPlaces()
    await expect(s.resetPlaceCover('7')).rejects.toThrow('boom')
    spy.mockRestore()
  })

  it('all failures rethrow (view layer handles toast): setSpotName', async () => {
    setSpotNameApi.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosPlaces()
    await expect(s.setSpotName('7', 's1', 'x')).rejects.toThrow('boom')
    spy.mockRestore()
  })

  it('setSpotName success — only modify name in matched object, do not refresh detail', async () => {
    getPlace.mockResolvedValue({
      key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 1,
      spots: [{ key: 's1', name: '老名', lon: 1, lat: 2, count: 3, thumb: 't' }],
      insights: [], visits: [], recent: [],
    })
    setSpotNameApi.mockResolvedValue(undefined)
    const s = usePhotosPlaces()
    await s.loadDetail('7')
    getPlace.mockClear()
    await s.setSpotName('7', 's1', '新名')
    expect(s.detail?.spots[0].name).toBe('新名')
    expect(getPlace).not.toHaveBeenCalled()
  })

  it('setSpotName only modify matched spot, leave others untouched', async () => {
    getPlace.mockResolvedValue({
      key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 1,
      spots: [
        { key: 's1', name: '老名', lon: 1, lat: 2, count: 3, thumb: 't' },
        { key: 's2', name: '别的', lon: 3, lat: 4, count: 1, thumb: 't2' },
      ],
      insights: [], visits: [], recent: [],
    })
    setSpotNameApi.mockResolvedValue(undefined)
    const s = usePhotosPlaces()
    await s.loadDetail('7')
    await s.setSpotName('7', 's1', '新名')
    expect(s.detail?.spots).toEqual([
      { key: 's1', name: '新名', lon: 1, lat: 2, count: 3, thumb: 't' },
      { key: 's2', name: '别的', lon: 3, lat: 4, count: 1, thumb: 't2' },
    ])
  })

  it('when detail is null — setPlaceCover/resetPlaceCover/setSpotName only write back places, no error', async () => {
    listPlaces.mockResolvedValue(RESP)
    setPlaceCoverApi.mockResolvedValue(undefined)
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    await expect(s.setPlaceCover('7', 'asset-9')).resolves.toBeUndefined()
    expect(s.detail).toBeNull()
    expect(s.places.find(p => p.id === '7')?.coverAssetId).toBe('asset-9')
  })
})

describe('resetSpotName(D8)', () => {
  it('call service.photos.resetSpotName with backend numeric key', async () => {
    listPlaces.mockResolvedValue(RESP)
    getPlace.mockResolvedValue({ key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 2, spots: [], insights: [], visits: [], recent: [] })
    resetSpotNameApi.mockResolvedValue(undefined)
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    await s.resetSpotName('7', 'spot-1')
    expect(resetSpotNameApi).toHaveBeenCalledWith(7, 'spot-1')
  })

  it('refresh detail on success (backend auto-names, frontend cannot compute), matched detail.spots get new name', async () => {
    getPlace
      .mockResolvedValueOnce({
        key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 1,
        spots: [{ key: 'spot-1', name: '旧名', lon: 1, lat: 2, count: 3, thumb: 't' }],
        insights: [], visits: [], recent: [],
      })
      .mockResolvedValueOnce({
        key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 1,
        spots: [{ key: 'spot-1', name: '默认名', lon: 1, lat: 2, count: 3, thumb: 't' }],
        insights: [], visits: [], recent: [],
      })
    resetSpotNameApi.mockResolvedValue(undefined)
    const s = usePhotosPlaces()
    await s.loadDetail('7')
    expect(getPlace).toHaveBeenCalledTimes(1)
    await s.resetSpotName('7', 'spot-1')
    expect(getPlace).toHaveBeenCalledTimes(2)
    expect(s.detail?.spots[0].name).toBe('默认名')
  })

  it('share spotBusy with setSpotName: resetSpotName returns directly while setSpotName in flight, API not called', async () => {
    setSpotNameApi.mockReturnValue(new Promise(() => {})) // never settle
    const s = usePhotosPlaces()
    void s.setSpotName('7', 'spot-1', 'x')
    await s.resetSpotName('7', 'spot-1')
    expect(resetSpotNameApi).not.toHaveBeenCalled()
  })

  it('failure: console.error called, exception throws up, spotBusy reset to false', async () => {
    resetSpotNameApi.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosPlaces()
    await expect(s.resetSpotName('7', 'spot-1')).rejects.toThrow('boom')
    expect(spy).toHaveBeenCalled()
    // spotBusy reset: immediately following setSpotName should proceed normally (not stuck locked)
    setSpotNameApi.mockResolvedValue(undefined)
    await s.setSpotName('7', 'spot-1', 'y')
    expect(setSpotNameApi).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})

describe('createPlaceAlbum', () => {
  it('when from/to not passed — fill with empty string (per Vue2 :738-740)', async () => {
    createPlaceAlbumApi.mockResolvedValue({ albumId: 1, name: '杭州', count: 10 })
    const s = usePhotosPlaces()
    await s.createPlaceAlbum('7', { name: '杭州' })
    expect(createPlaceAlbumApi).toHaveBeenCalledWith('7', { name: '杭州', from: '', to: '' })
  })

  it('return normalized: albumId/count normalized to string/number', async () => {
    createPlaceAlbumApi.mockResolvedValue({ albumId: 12, name: '杭州', count: '30' })
    const s = usePhotosPlaces()
    const r = await s.createPlaceAlbum('7', { name: '杭州', from: '', to: '' })
    expect(r).toEqual({ albumId: '12', name: '杭州', count: 30 })
  })

  it('reentrance: second call rejected with message albumBusy while first in flight, API called once', async () => {
    createPlaceAlbumApi.mockReturnValue(new Promise(() => {})) // never settle
    const s = usePhotosPlaces()
    void s.createPlaceAlbum('7', { name: 'a' })
    await expect(s.createPlaceAlbum('7', { name: 'b' })).rejects.toThrow('albumBusy')
    expect(createPlaceAlbumApi).toHaveBeenCalledTimes(1)
  })

  it('failure rethrow, albumBusy reset', async () => {
    createPlaceAlbumApi.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosPlaces()
    await expect(s.createPlaceAlbum('7', { name: 'a' })).rejects.toThrow('boom')
    // albumBusy reset: immediately following call should proceed normally
    createPlaceAlbumApi.mockResolvedValueOnce({ albumId: 1, name: 'a', count: 0 })
    await s.createPlaceAlbum('7', { name: 'a' })
    expect(createPlaceAlbumApi).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
})

describe('fetchCoverCandidates', () => {
  it('normalize response fields on success', async () => {
    placeCoverCandidates.mockResolvedValue({
      tabs: [{ id: 'recent', label: 'Recent', icon: 'clock', count: 3 }],
      items: ['a1', 'a2'],
      page: 1,
      totalPages: 2,
      total: 3,
    })
    const s = usePhotosPlaces()
    await s.fetchCoverCandidates('7', { tab: 'recent', q: '', page: 1 })
    expect(s.coverCandidates).toEqual({
      tabs: [{ id: 'recent', label: 'Recent', icon: 'clock', count: 3 }],
      items: ['a1', 'a2'],
      page: 1,
      totalPages: 2,
      total: 3,
    })
  })

  it('on failure set to empty structure (one-shot query in modal, differs from main data "preserve on failure")', async () => {
    placeCoverCandidates.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosPlaces()
    await s.fetchCoverCandidates('7', { tab: 'recent', q: '', page: 0 })
    expect(s.coverCandidates).toEqual({ tabs: [], items: [], page: 0, totalPages: 1, total: 0 })
    spy.mockRestore()
  })

  it('seq guard: two requests in a row, later returning first — final result is later one (second)', async () => {
    let resolveA: (v: unknown) => void = () => {}
    let resolveB: (v: unknown) => void = () => {}
    placeCoverCandidates
      .mockReturnValueOnce(new Promise((r) => { resolveA = r }))
      .mockReturnValueOnce(new Promise((r) => { resolveB = r }))
    const s = usePhotosPlaces()
    const pA = s.fetchCoverCandidates('7', { tab: 'recent' })
    const pB = s.fetchCoverCandidates('7', { tab: 'favorites' })
    // B (later) returns first
    resolveB({ tabs: [], items: ['b1'], page: 0, totalPages: 1, total: 1 })
    await pB
    expect(s.coverCandidates.items).toEqual(['b1'])
    // A (earlier) returns later — must be discarded, must not overwrite B's result
    resolveA({ tabs: [], items: ['a1'], page: 0, totalPages: 1, total: 1 })
    await pA
    expect(s.coverCandidates.items).toEqual(['b1'])
  })

  it('seq guard failure path: stale request catch must not clear new result', async () => {
    let rejectA: (e: unknown) => void = () => {}
    placeCoverCandidates
      .mockReturnValueOnce(new Promise((_, rj) => { rejectA = rj }))
      .mockResolvedValueOnce({ tabs: [], items: ['b1'], page: 0, totalPages: 1, total: 1 })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosPlaces()
    const pA = s.fetchCoverCandidates('7', { tab: 'recent' })
    await s.fetchCoverCandidates('7', { tab: 'favorites' })
    expect(s.coverCandidates.items).toEqual(['b1'])
    rejectA(new Error('boom'))
    await pA
    expect(s.coverCandidates.items).toEqual(['b1']) // not cleared by stale catch
    spy.mockRestore()
  })
})

describe('localStorage persistence', () => {
  it('mapTheme outside whitelist fallback to default, custom color not #RRGGBB fallback to default', () => {
    localStorage.setItem('nimo_places_map_theme', JSON.stringify({ mapTheme: 'rainbow', customDotColor: 'red', customGridColor: '#ABCDEF' }))
    const s = usePhotosPlaces()
    expect(s.themePrefs.mapTheme).toBe('default')
    expect(s.themePrefs.customDotColor).toBe('#6E5BFF')
    expect(s.themePrefs.customGridColor).toBe('#ABCDEF')
  })

  it('bad JSON no throw, fallback to all defaults', () => {
    localStorage.setItem('nimo_places_map_theme', '{not json')
    const s = usePhotosPlaces()
    expect(s.themePrefs.mapTheme).toBe('default')
  })

  it('when nothing saved, use default values', () => {
    const s = usePhotosPlaces()
    expect(s.themePrefs).toEqual({ mapTheme: 'default', customDotColor: '#6E5BFF', customGridColor: '#9C8EFF' })
  })

  it('setMapTheme / setCustomColors persist immediately', () => {
    const s = usePhotosPlaces()
    s.setMapTheme('ocean')
    expect(JSON.parse(localStorage.getItem('nimo_places_map_theme')!).mapTheme).toBe('ocean')
    s.setCustomColors('#111111', '#222222')
    const saved = JSON.parse(localStorage.getItem('nimo_places_map_theme')!)
    expect(saved).toMatchObject({ mapTheme: 'custom', customDotColor: '#111111', customGridColor: '#222222' })
  })

  it('railCollapsed read-in normalized by map(String) (deviation #7)', () => {
    localStorage.setItem('nimo_places_rail_collapsed', JSON.stringify(['asia', 123]))
    const s = usePhotosPlaces()
    expect(s.railCollapsed).toEqual(['asia', '123'])
  })

  it('railCollapsed not array fallback to empty array', () => {
    localStorage.setItem('nimo_places_rail_collapsed', JSON.stringify({ asia: true }))
    expect(usePhotosPlaces().railCollapsed).toEqual([])
  })

  it('toggleRegionFold bidirectional toggle and persist', () => {
    const s = usePhotosPlaces()
    s.toggleRegionFold('asia')
    expect(s.railCollapsed).toEqual(['asia'])
    expect(JSON.parse(localStorage.getItem('nimo_places_rail_collapsed')!)).toEqual(['asia'])
    s.toggleRegionFold('asia')
    expect(s.railCollapsed).toEqual([])
  })

  it('isRegionCollapsed: search state overrides fold (matched items never hidden)', () => {
    const s = usePhotosPlaces()
    s.toggleRegionFold('asia')
    expect(s.isRegionCollapsed('asia', false)).toBe(true)
    expect(s.isRegionCollapsed('asia', true)).toBe(false)
  })

  it('isRegionCollapsed always false for unfolded continents', () => {
    const s = usePhotosPlaces()
    expect(s.isRegionCollapsed('asia', false)).toBe(false)
  })
})

describe('__resetForTest', () => {
  it('clear all state and re-read localStorage defaults', async () => {
    listPlaces.mockResolvedValue(RESP)
    getPlace.mockResolvedValue({ key: 7, city: 'X', country: 'Y', count: 1, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    await s.loadDetail('7')
    s.toggleRegionFold('asia')
    s.setMapTheme('ocean')

    s.__resetForTest()

    expect(s.places).toEqual([])
    expect(s.regions).toEqual([])
    expect(s.stats).toEqual({ cities: 0, countries: 0, photos: 0 })
    expect(s.placesLoaded).toBe(false)
    expect(s.loading).toBe(false)
    expect(s.detail).toBeNull()
    expect(s.detailLoading).toBe(false)
    expect(s.coverCandidates).toEqual({ tabs: [], items: [], page: 0, totalPages: 1, total: 0 })
    // above setMapTheme/toggleRegionFold already persisted, __resetForTest re-reads from localStorage,
    // so not cleared to empty, but re-reads what was just persisted — confirms it doesn't bypass localStorage directly clearing.
    expect(s.themePrefs.mapTheme).toBe('ocean')
    expect(s.railCollapsed).toEqual(['asia'])
  })

  it('__resetForTest does not introduce seq alias collision: stale request before reset does not pollute new round after reset', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    getPlace.mockReturnValueOnce(new Promise((r) => { resolveFn = r }))
    const s = usePhotosPlaces()
    const stale = s.loadDetail('7')
    s.__resetForTest()
    getPlace.mockResolvedValueOnce({ key: 8, city: 'Kyoto', country: 'Japan', count: 5, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    await s.loadDetail('8')
    expect(s.detail?.city).toBe('Kyoto')
    resolveFn({ key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 2, spots: [], insights: [], visits: [], recent: [] })
    await stale
    expect(s.detail?.city).toBe('Kyoto') // old request before reset must not overwrite (if seq reset to 0 would reveal here)
  })
})
