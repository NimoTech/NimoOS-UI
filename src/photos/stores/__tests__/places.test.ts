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

/* The raw response shape as captured from a real device (Photos v1 has no envelope,
   listPlaces is an object wrapper). Warning: a recurring pitfall with hand-written
   fixtures -- this shape has been checked field-by-field against
   NimoOS-Photos/service/places_types.go:36-40's PlacesResponse -- key is a number,
   thumbs can be null. */
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
  it('unwraps the object wrapper, normalizes ids, defaults null slices, and only sets placesLoaded on success', async () => {
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

  it('keeps the previous data on failure, does not regress placesLoaded, and does not throw', async () => {
    listPlaces.mockResolvedValueOnce(RESP)
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    listPlaces.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(s.fetchPlaces()).resolves.toBeUndefined()
    expect(s.places).toHaveLength(2)          // previous data is still there
    expect(s.placesLoaded).toBe(true)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('leaves placesLoaded false when the first fetch fails (retryable)', async () => {
    listPlaces.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    expect(s.placesLoaded).toBe(false)
    spy.mockRestore()
  })

  it('does not auto-select the first place (that is the view layer\'s responsibility)', async () => {
    listPlaces.mockResolvedValue(RESP)
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    expect(s.detail).toBeNull()
  })

  it('defaults regions/stats to [] / all-zero stats when the fields are missing', async () => {
    listPlaces.mockResolvedValue({ places: [] })
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    expect(s.regions).toEqual([])
    expect(s.stats).toEqual({ cities: 0, countries: 0, photos: 0 })
    expect(s.placesLoaded).toBe(true)
  })

  it('loading is true during the request and falls back to false afterward', async () => {
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

describe('loadDetail seq race guard', () => {
  it('the earlier response must not overwrite the newer detail when the later request resolves first', async () => {
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
    // B (issued second) resolves first
    resolveB({ key: 8, city: 'Kyoto', country: 'Japan', count: 5, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    await pB
    expect(s.detail?.city).toBe('Kyoto')
    // A (issued first) resolves after — must be discarded
    resolveA({ key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 2, spots: [], insights: [], visits: [], recent: [] })
    await pA
    expect(s.detail?.city).toBe('Kyoto')
  })

  it('a stale request\'s catch must not null out the newer detail', async () => {
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
    expect(s.detail?.city).toBe('Kyoto')      // not cleared by the stale catch
    spy.mockRestore()
  })

  it('passing null clears the detail immediately without issuing a request', async () => {
    const s = usePhotosPlaces()
    await s.loadDetail(null)
    expect(s.detail).toBeNull()
    expect(getPlace).not.toHaveBeenCalled()
  })

  it('calls the API with the backend\'s raw numeric key when the list is already loaded (not the normalized string id)', async () => {
    listPlaces.mockResolvedValue(RESP)
    getPlace.mockResolvedValue({ key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 2, spots: [], insights: [], visits: [], recent: [] })
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    await s.loadDetail('7')
    expect(getPlace).toHaveBeenCalledWith(7)
  })

  it('falls back to the passed-in id when the list is not loaded (deep link)', async () => {
    getPlace.mockResolvedValue({ key: 7, city: 'X', country: 'Y', count: 1, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    const s = usePhotosPlaces()
    await s.loadDetail('7')
    expect(getPlace).toHaveBeenCalledWith('7')
  })

  it('normal success: the response is normalized into PlaceDetail with home/coverAssetId/thumbs defaulted when missing', async () => {
    getPlace.mockResolvedValue({ key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 2, spots: [], insights: [], visits: [], recent: [] })
    const s = usePhotosPlaces()
    await s.loadDetail('7')
    expect(s.detail).toEqual({
      id: '7', city: 'Hangzhou', country: 'China', count: 40, trips: 2,
      home: false, coverAssetId: '', thumbs: [], spots: [], insights: [], visits: [], recent: [],
    })
  })

  it('detailLoading is true during the request and falls back to false afterward', async () => {
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
  it('clears the detail immediately', async () => {
    getPlace.mockResolvedValue({ key: 7, city: 'X', country: 'Y', count: 1, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    const s = usePhotosPlaces()
    await s.loadDetail('7')
    expect(s.detail).not.toBeNull()
    s.clearDetail()
    expect(s.detail).toBeNull()
  })

  it('invalidates an in-flight loadDetail: a stale response arriving after clearDetail must not write detail back to a non-null value', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    getPlace.mockReturnValueOnce(new Promise((r) => { resolveFn = r }))
    const s = usePhotosPlaces()
    const p = s.loadDetail('7')
    s.clearDetail()
    resolveFn({ key: 7, city: 'X', country: 'Y', count: 1, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    await p
    expect(s.detail).toBeNull()
  })

  // Regression case I1 (real bug): loadDetail(null) only does seq++ + clears detail; if it
  // doesn't unconditionally reset detailLoading, the in-flight request's `if (mine === seq)`
  // check in its finally block will always be false once seq has advanced, so it never gets a
  // chance to reset it — detailLoading stays stuck at true forever, which shows up as the
  // loading indicator spinning forever after the detail has been cleared.
  it('I1: calling loadDetail(null) while loadDetail is in flight resets detailLoading immediately and is not skewed by the stale response', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    getPlace.mockReturnValueOnce(new Promise((r) => { resolveFn = r }))
    const s = usePhotosPlaces()
    const p = s.loadDetail('7')
    expect(s.detailLoading).toBe(true)
    await s.loadDetail(null)
    expect(s.detailLoading).toBe(false)
    // The stale response comes back: it should neither revive detail nor flip the
    // already-reset detailLoading back on (its finally checks `if (mine === seq)`, which
    // seq has already advanced past, so it doesn't match and the state stays as-is).
    resolveFn({ key: 7, city: 'X', country: 'Y', count: 1, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    await p
    expect(s.detailLoading).toBe(false)
    expect(s.detail).toBeNull()
  })

  // Same as above, but through the other cancellation entry point, clearDetail() — the two
  // cancellation entry points are two separate production code paths, tested separately rather
  // than merged into one (to avoid repeating the old problem where removing several things
  // together masked a blind spot).
  it('I1: calling clearDetail() while loadDetail is in flight resets detailLoading immediately and is not skewed by the stale response', async () => {
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

describe('cover and spot renaming', () => {
  it('setPlaceCover writes back to both detail and places on success', async () => {
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

  it('resetPlaceCover writes an empty string back to both places', async () => {
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

  it('each of the three submit paths short-circuits its own in-flight call: the second reentrant call does not hit the backend', async () => {
    setPlaceCoverApi.mockReturnValue(new Promise(() => {}))   // never settles
    const s = usePhotosPlaces()
    void s.setPlaceCover('7', 'a')
    void s.setPlaceCover('7', 'b')
    expect(setPlaceCoverApi).toHaveBeenCalledTimes(1)
  })

  // Review correction: the title used to read "shares coverBusy with setPlaceCover", but the
  // assertion only verified self-reentrancy, not the "sharing" itself — the title has been
  // changed to accurately reflect that, and the evidence for "sharing" moved to the two I2 cases below.
  it('resetPlaceCover short-circuits its own reentrant call', async () => {
    resetPlaceCoverApi.mockReturnValue(new Promise(() => {}))
    const s = usePhotosPlaces()
    void s.resetPlaceCover('7')
    void s.resetPlaceCover('7')
    expect(resetPlaceCoverApi).toHaveBeenCalledTimes(1)
  })

  it('setSpotName short-circuits reentrant calls (spotBusy is independent)', async () => {
    setSpotNameApi.mockReturnValue(new Promise(() => {}))
    const s = usePhotosPlaces()
    void s.setSpotName('7', 's1', 'a')
    void s.setSpotName('7', 's1', 'b')
    expect(setSpotNameApi).toHaveBeenCalledTimes(1)
  })

  // Coverage gap I2: coverBusy is **shared** between setPlaceCover/resetPlaceCover
  // — this is a deliberate design (mutually exclusive writes on the same "cover" resource), but
  // until now there was no test proving the "sharing" itself, only each one's own self-reentrancy.
  // If this is ever split into two independent locks, the following two cases must fail. One case
  // for each direction.
  it('I2: resetPlaceCover is blocked by coverBusy while setPlaceCover is in flight and does not hit the backend', async () => {
    setPlaceCoverApi.mockReturnValue(new Promise(() => {}))   // never settles, holds coverBusy
    const s = usePhotosPlaces()
    void s.setPlaceCover('7', 'a')
    void s.resetPlaceCover('7')
    expect(resetPlaceCoverApi).not.toHaveBeenCalled()
  })

  it('I2: setPlaceCover is blocked by coverBusy while resetPlaceCover is in flight and does not hit the backend (reverse direction)', async () => {
    resetPlaceCoverApi.mockReturnValue(new Promise(() => {}))   // never settles, holds coverBusy
    const s = usePhotosPlaces()
    void s.resetPlaceCover('7')
    void s.setPlaceCover('7', 'a')
    expect(setPlaceCoverApi).not.toHaveBeenCalled()
  })

  it('coverBusy and spotBusy do not block each other: setSpotName can still fire while setPlaceCover is in flight', async () => {
    setPlaceCoverApi.mockReturnValue(new Promise(() => {}))   // never settles, holds coverBusy
    setSpotNameApi.mockResolvedValue(undefined)
    const s = usePhotosPlaces()
    void s.setPlaceCover('7', 'a')
    await s.setSpotName('7', 's1', 'new-name')
    expect(setSpotNameApi).toHaveBeenCalledTimes(1)
  })

  it('always rethrows on failure (the view layer owns the toast): setPlaceCover', async () => {
    setPlaceCoverApi.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosPlaces()
    await expect(s.setPlaceCover('7', 'a')).rejects.toThrow('boom')
    spy.mockRestore()
  })

  it('always rethrows on failure (the view layer owns the toast): resetPlaceCover', async () => {
    resetPlaceCoverApi.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosPlaces()
    await expect(s.resetPlaceCover('7')).rejects.toThrow('boom')
    spy.mockRestore()
  })

  it('always rethrows on failure (the view layer owns the toast): setSpotName', async () => {
    setSpotNameApi.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosPlaces()
    await expect(s.setSpotName('7', 's1', 'x')).rejects.toThrow('boom')
    spy.mockRestore()
  })

  it('setSpotName only updates the matched object\'s name on success, without refetching the detail', async () => {
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

  it('setSpotName only updates the matched spot, leaving the rest untouched', async () => {
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

  it('setPlaceCover/resetPlaceCover/setSpotName only write back to places and do not crash when detail is null', async () => {
    listPlaces.mockResolvedValue(RESP)
    setPlaceCoverApi.mockResolvedValue(undefined)
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    await expect(s.setPlaceCover('7', 'asset-9')).resolves.toBeUndefined()
    expect(s.detail).toBeNull()
    expect(s.places.find(p => p.id === '7')?.coverAssetId).toBe('asset-9')
  })
})

describe('resetSpotName', () => {
  it('calls service.photos.resetSpotName with the backend\'s raw numeric key', async () => {
    listPlaces.mockResolvedValue(RESP)
    getPlace.mockResolvedValue({ key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 2, spots: [], insights: [], visits: [], recent: [] })
    resetSpotNameApi.mockResolvedValue(undefined)
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    await s.resetSpotName('7', 'spot-1')
    expect(resetSpotNameApi).toHaveBeenCalledWith(7, 'spot-1')
  })

  it('refetches the detail on success (the backend-assigned name can\'t be computed on the frontend), and the matched spot in detail.spots gets the new name', async () => {
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

  it('shares spotBusy with setSpotName: calling resetSpotName while setSpotName is in flight returns immediately with zero calls to the resetSpotName API', async () => {
    setSpotNameApi.mockReturnValue(new Promise(() => {})) // never settles
    const s = usePhotosPlaces()
    void s.setSpotName('7', 'spot-1', 'x')
    await s.resetSpotName('7', 'spot-1')
    expect(resetSpotNameApi).not.toHaveBeenCalled()
  })

  it('failure: console.error is called, the error is rethrown, and spotBusy resets to false', async () => {
    resetSpotNameApi.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosPlaces()
    await expect(s.resetSpotName('7', 'spot-1')).rejects.toThrow('boom')
    expect(spy).toHaveBeenCalled()
    // spotBusy reset: the immediately following setSpotName should be able to fire normally (not stuck locked)
    setSpotNameApi.mockResolvedValue(undefined)
    await s.setSpotName('7', 'spot-1', 'y')
    expect(setSpotNameApi).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})

describe('createPlaceAlbum', () => {
  it('defaults from/to to empty strings when not passed (matches Vue2 :738-740)', async () => {
    createPlaceAlbumApi.mockResolvedValue({ albumId: 1, name: '杭州', count: 10 })
    const s = usePhotosPlaces()
    await s.createPlaceAlbum('7', { name: '杭州' })
    expect(createPlaceAlbumApi).toHaveBeenCalledWith('7', { name: '杭州', from: '', to: '' })
  })

  it('return normalization: albumId/count are normalized to string/number', async () => {
    createPlaceAlbumApi.mockResolvedValue({ albumId: 12, name: '杭州', count: '30' })
    const s = usePhotosPlaces()
    const r = await s.createPlaceAlbum('7', { name: '杭州', from: '', to: '' })
    expect(r).toEqual({ albumId: '12', name: '杭州', count: 30 })
  })

  it('reentrancy: the second call is rejected with message albumBusy while the first is in flight, and the API is called only once', async () => {
    createPlaceAlbumApi.mockReturnValue(new Promise(() => {})) // never settles
    const s = usePhotosPlaces()
    void s.createPlaceAlbum('7', { name: 'a' })
    await expect(s.createPlaceAlbum('7', { name: 'b' })).rejects.toThrow('albumBusy')
    expect(createPlaceAlbumApi).toHaveBeenCalledTimes(1)
  })

  it('rethrows on failure and resets albumBusy', async () => {
    createPlaceAlbumApi.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosPlaces()
    await expect(s.createPlaceAlbum('7', { name: 'a' })).rejects.toThrow('boom')
    // albumBusy reset: the immediately following call should be able to fire normally
    createPlaceAlbumApi.mockResolvedValueOnce({ albumId: 1, name: 'a', count: 0 })
    await s.createPlaceAlbum('7', { name: 'a' })
    expect(createPlaceAlbumApi).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
})

describe('fetchCoverCandidates', () => {
  it('normalizes the response fields on success', async () => {
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

  it('resets to an empty structure on failure (a one-off query inside the popover, unlike the main data\'s keep-on-failure semantics)', async () => {
    placeCoverCandidates.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosPlaces()
    await s.fetchCoverCandidates('7', { tab: 'recent', q: '', page: 0 })
    expect(s.coverCandidates).toEqual({ tabs: [], items: [], page: 0, totalPages: 1, total: 0 })
    spy.mockRestore()
  })

  it('seq guard: firing twice back-to-back, the final result is the later one when it resolves first', async () => {
    let resolveA: (v: unknown) => void = () => {}
    let resolveB: (v: unknown) => void = () => {}
    placeCoverCandidates
      .mockReturnValueOnce(new Promise((r) => { resolveA = r }))
      .mockReturnValueOnce(new Promise((r) => { resolveB = r }))
    const s = usePhotosPlaces()
    const pA = s.fetchCoverCandidates('7', { tab: 'recent' })
    const pB = s.fetchCoverCandidates('7', { tab: 'favorites' })
    // B (issued second) resolves first
    resolveB({ tabs: [], items: ['b1'], page: 0, totalPages: 1, total: 1 })
    await pB
    expect(s.coverCandidates.items).toEqual(['b1'])
    // A (issued first) resolves after — must be discarded, must not overwrite B's result
    resolveA({ tabs: [], items: ['a1'], page: 0, totalPages: 1, total: 1 })
    await pA
    expect(s.coverCandidates.items).toEqual(['b1'])
  })

  it('seq guard failure path: a stale request\'s catch must not clear the newer result', async () => {
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
    expect(s.coverCandidates.items).toEqual(['b1']) // not cleared by the stale catch
    spy.mockRestore()
  })
})

describe('localStorage persistence', () => {
  it('mapTheme falls back to default outside the whitelist, and a custom color not in #RRGGBB format falls back to default', () => {
    localStorage.setItem('nimo_places_map_theme', JSON.stringify({ mapTheme: 'rainbow', customDotColor: 'red', customCityColor: '#ABCDEF' }))
    const s = usePhotosPlaces()
    expect(s.themePrefs.mapTheme).toBe('default')
    expect(s.themePrefs.customDotColor).toBe('#6E5BFF')
    expect(s.themePrefs.customCityColor).toBe('#ABCDEF')
  })

  it('does not throw on bad JSON and falls back to all defaults', () => {
    localStorage.setItem('nimo_places_map_theme', '{not json')
    const s = usePhotosPlaces()
    expect(s.themePrefs.mapTheme).toBe('default')
  })

  // Task 6 (Plan E, 2026-08-15): customCityColor is a rename of customGridColor (same reason
  // Vue2 PR #106 sub-commit 3 renamed its own field — the value now feeds the city-light dot,
  // never a grid line). Vue2's own commit message is explicit that the old localStorage value
  // is NOT migrated — a stored blob shaped like the pre-rename field just doesn't have the new
  // field, so it falls back to the default like any other missing field. This proves the same
  // no-migration behavior here rather than assuming it.
  it('the legacy customGridColor field\'s stored value is not migrated; the new customCityColor field falls straight back to default (same no-migration behavior as Vue2)', () => {
    localStorage.setItem('nimo_places_map_theme', JSON.stringify({ mapTheme: 'ocean', customDotColor: '#111111', customGridColor: '#ABCDEF' }))
    const s = usePhotosPlaces()
    expect(s.themePrefs.mapTheme).toBe('ocean') // unchanged field reads in as usual
    expect(s.themePrefs.customDotColor).toBe('#111111') // unchanged field reads in as usual
    expect(s.themePrefs.customCityColor).toBe('#9C8EFF') // the old key name is "never written" for the new field, so it falls back to default
    expect((s.themePrefs as unknown as Record<string, unknown>).customGridColor).toBeUndefined() // the old field name is not retained in the result
  })

  it('uses the default values when nothing has ever been saved', () => {
    const s = usePhotosPlaces()
    expect(s.themePrefs).toEqual({ mapTheme: 'default', customDotColor: '#6E5BFF', customCityColor: '#9C8EFF' })
  })

  // Persisting to disk is now debounced by 250ms (see the persistTheme() comment in
  // src/photos/stores/places.ts, ported from Vue2 PR #106's own perf sub-commit) — the
  // in-memory `themePrefs` is still updated synchronously (the first expect below should
  // already be true without advancing the timer); only the actual localStorage write is
  // coalesced.
  it('setMapTheme / setCustomColors update themePrefs synchronously, with the disk write debounced and coalesced into one write after 250ms', () => {
    vi.useFakeTimers()
    const s = usePhotosPlaces()
    s.setMapTheme('ocean')
    expect(s.themePrefs.mapTheme).toBe('ocean') // in-memory state is synchronous, no need to wait for the timer
    expect(localStorage.getItem('nimo_places_map_theme')).toBeNull() // but not written to disk yet
    s.setCustomColors('#111111', '#222222')
    expect(localStorage.getItem('nimo_places_map_theme')).toBeNull() // the second call is still within the debounce window
    vi.advanceTimersByTime(250)
    const saved = JSON.parse(localStorage.getItem('nimo_places_map_theme')!)
    expect(saved).toMatchObject({ mapTheme: 'custom', customDotColor: '#111111', customCityColor: '#222222' })
    vi.useRealTimers()
  })

  it('unmount flush: flushThemePersist() writes the debounced value to disk immediately and clears the timer (no second write follows)', () => {
    vi.useFakeTimers()
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const s = usePhotosPlaces()
    s.setMapTheme('sand')
    expect(setItemSpy).not.toHaveBeenCalled()
    s.flushThemePersist()
    expect(setItemSpy).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem('nimo_places_map_theme')!).mapTheme).toBe('sand')
    // The timer has already been cleared by the flush, so advancing time won't trigger a second write.
    vi.advanceTimersByTime(1000)
    expect(setItemSpy).toHaveBeenCalledTimes(1)
    setItemSpy.mockRestore()
    vi.useRealTimers()
  })

  it('flushThemePersist() is a safe no-op when there is nothing pending to persist', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const s = usePhotosPlaces()
    s.flushThemePersist()
    expect(setItemSpy).not.toHaveBeenCalled()
    setItemSpy.mockRestore()
  })

  it('railCollapsed is normalized with map(String) on read', () => {
    localStorage.setItem('nimo_places_rail_collapsed', JSON.stringify(['asia', 123]))
    const s = usePhotosPlaces()
    expect(s.railCollapsed).toEqual(['asia', '123'])
  })

  it('railCollapsed falls back to an empty array when it is not an array', () => {
    localStorage.setItem('nimo_places_rail_collapsed', JSON.stringify({ asia: true }))
    expect(usePhotosPlaces().railCollapsed).toEqual([])
  })

  it('toggleRegionFold toggles both directions and persists', () => {
    const s = usePhotosPlaces()
    s.toggleRegionFold('asia')
    expect(s.railCollapsed).toEqual(['asia'])
    expect(JSON.parse(localStorage.getItem('nimo_places_rail_collapsed')!)).toEqual(['asia'])
    s.toggleRegionFold('asia')
    expect(s.railCollapsed).toEqual([])
  })

  it('isRegionCollapsed: search state overrides collapse (a match is never hidden)', () => {
    const s = usePhotosPlaces()
    s.toggleRegionFold('asia')
    expect(s.isRegionCollapsed('asia', false)).toBe(true)
    expect(s.isRegionCollapsed('asia', true)).toBe(false)
  })

  it('isRegionCollapsed is always false for an uncollapsed region', () => {
    const s = usePhotosPlaces()
    expect(s.isRegionCollapsed('asia', false)).toBe(false)
  })
})

describe('__resetForTest', () => {
  it('clears all state and re-reads the localStorage defaults', async () => {
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
    // setMapTheme/toggleRegionFold above have already been persisted, and __resetForTest reads
    // back in from localStorage, so this isn't cleared to an empty value — it reads back what was
    // just persisted, confirming that it doesn't bypass localStorage and zero it out directly.
    expect(s.themePrefs.mapTheme).toBe('ocean')
    expect(s.railCollapsed).toEqual(['asia'])
  })

  it('__resetForTest does not introduce a seq aliasing conflict: a stale pre-reset request does not pollute the new load after reset', async () => {
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
    expect(s.detail?.city).toBe('Kyoto') // must not be overwritten by the pre-reset request (would surface here if seq were reset to 0)
  })
})
