// P6b-T2: one-time asset load for place detail panel "photos" tab.
// Following Vue2 PhotosTimeline.vue:819-841 (_loadPlaceAssets): limit always 500, clear on failure
// (intentionally different from store main data "keep on failure" policy — this is one-time query result,
// keeping previous would mislead user, see comment in usePlaceAssets.ts).
import { describe, expect, it, vi } from 'vitest'
import { usePlaceAssets } from '../usePlaceAssets'

const listAssetsByPlace = vi.fn()

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      listAssetsByPlace: (...a: unknown[]) => listAssetsByPlace(...a),
    },
  },
}))

function asset(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 'a1', mimeType: 'image/jpeg', takenAt: '2026-03-07T10:00:00Z', ...over }
}

describe('usePlaceAssets', () => {
  it('Both {assets:[...]} and bare array response shapes yield same photos.length', async () => {
    listAssetsByPlace.mockResolvedValueOnce({ assets: [asset({ id: 'a1' }), asset({ id: 'a2' })] })
    const s1 = usePlaceAssets()
    await s1.load('7', '', null, null)
    expect(s1.photos.value).toHaveLength(2)

    listAssetsByPlace.mockResolvedValueOnce([asset({ id: 'a1' }), asset({ id: 'a2' })])
    const s2 = usePlaceAssets()
    await s2.load('7', '', null, null)
    expect(s2.photos.value).toHaveLength(2)
  })

  it('null / {} response → photos is empty array, no throw', async () => {
    listAssetsByPlace.mockResolvedValueOnce(null)
    const s1 = usePlaceAssets()
    await expect(s1.load('7', '', null, null)).resolves.toBeUndefined()
    expect(s1.photos.value).toEqual([])

    listAssetsByPlace.mockResolvedValueOnce({})
    const s2 = usePlaceAssets()
    await s2.load('7', '', null, null)
    expect(s2.photos.value).toEqual([])
  })

  it('photos is product of assetToPhoto: isVideo derived from mimeType, takenAt preserved', async () => {
    listAssetsByPlace.mockResolvedValueOnce({ assets: [asset({ id: 'v1', mimeType: 'video/mp4', takenAt: '2026-01-05T00:00:00Z' })] })
    const s = usePlaceAssets()
    await s.load('7', '', null, null)
    expect(s.photos.value[0].isVideo).toBe(true)
    expect(s.photos.value[0].takenAt).toBe('2026-01-05T00:00:00Z')
  })

  it('months grouped by month in descending order', async () => {
    listAssetsByPlace.mockResolvedValueOnce({
      assets: [
        asset({ id: 'a1', takenAt: '2026-01-05T00:00:00Z' }),
        asset({ id: 'a2', takenAt: '2026-03-07T00:00:00Z' }),
        asset({ id: 'a3', takenAt: '2026-03-08T00:00:00Z' }),
      ],
    })
    const s = usePlaceAssets()
    await s.load('7', '', null, null)
    expect(s.months.value.map(m => m.key)).toEqual(['2026-03', '2026-01'])
    expect(s.months.value[0].photos).toHaveLength(2)
    expect(s.months.value[1].photos).toHaveLength(1)
  })

  it('spotKey empty string passes through as-is (not undefined); when spotKey non-empty and lat/lon not null, all four params pass through', async () => {
    listAssetsByPlace.mockResolvedValueOnce({ assets: [] })
    const s1 = usePlaceAssets()
    await s1.load('7', '', null, null)
    expect(listAssetsByPlace).toHaveBeenCalledWith('7', '', 500, null, null)

    listAssetsByPlace.mockResolvedValueOnce({ assets: [] })
    const s2 = usePlaceAssets()
    await s2.load('7', 'spot-1', 30.1, 120.2)
    expect(listAssetsByPlace).toHaveBeenCalledWith('7', 'spot-1', 500, 30.1, 120.2)
  })

  it('limit always 500', async () => {
    listAssetsByPlace.mockResolvedValueOnce({ assets: [] })
    const s = usePlaceAssets()
    await s.load('9', 'sx', 1, 2)
    expect(listAssetsByPlace).toHaveBeenCalledWith('9', 'sx', 500, 1, 2)
  })

  it('Race: send A (slow) then B (fast), B resolves first → final photos is B; A later resolve does not overwrite; loading finally false', async () => {
    let resolveA: (v: unknown) => void = () => {}
    let resolveB: (v: unknown) => void = () => {}
    listAssetsByPlace
      .mockReturnValueOnce(new Promise((r) => { resolveA = r }))
      .mockReturnValueOnce(new Promise((r) => { resolveB = r }))
    const s = usePlaceAssets()
    const pA = s.load('7', 'a', null, null)
    const pB = s.load('7', 'b', null, null)
    resolveB({ assets: [asset({ id: 'b1' })] })
    await pB
    expect(s.photos.value.map(p => p.id)).toEqual(['b1'])
    expect(s.loading.value).toBe(false)
    resolveA({ assets: [asset({ id: 'a1' })] })
    await pA
    expect(s.photos.value.map(p => p.id)).toEqual(['b1'])
    expect(s.loading.value).toBe(false)
  })

  it('finally seq guard: when old request (mine=1) resolves first, must not set loading back to false while new request (mine=2) still in flight', async () => {
    let resolveA: (v: unknown) => void = () => {}
    listAssetsByPlace
      .mockReturnValueOnce(new Promise((r) => { resolveA = r }))
      .mockReturnValueOnce(new Promise(() => {})) // B never resolves, simulate "still in flight"
    const s = usePlaceAssets()
    const pA = s.load('7', 'a', null, null)
    void s.load('7', 'b', null, null) // B in flight, do not await
    resolveA({ assets: [] })
    await pA
    // B still in flight — loading must still be true, cannot be set back to false early by A's finally (stale request)
    expect(s.loading.value).toBe(true)
  })

  it('Failure: photos cleared, failed is true, console.error called', async () => {
    listAssetsByPlace.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePlaceAssets()
    await s.load('7', '', null, null)
    expect(s.photos.value).toEqual([])
    expect(s.failed.value).toBe(true)
    expect(s.loading.value).toBe(false)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('loading/loaded lifecycle: loading true during request, after success loaded is true, failed is false', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    listAssetsByPlace.mockReturnValueOnce(new Promise((r) => { resolveFn = r }))
    const s = usePlaceAssets()
    const p = s.load('7', '', null, null)
    expect(s.loading.value).toBe(true)
    expect(s.loaded.value).toBe(false)
    resolveFn({ assets: [] })
    await p
    expect(s.loading.value).toBe(false)
    expect(s.loaded.value).toBe(true)
    expect(s.failed.value).toBe(false)
  })

  // ── Review I2: success path previously did not clear old data, photos from old spot/city still visible during second load() ──
  describe('Second load() does not leave old data (review I2)', () => {
    it('After second load() sent, before response arrives: photos cleared immediately, loaded immediately back to false (skeleton gate loading&&!loaded re-hits)', async () => {
      listAssetsByPlace.mockResolvedValueOnce({ assets: [asset({ id: 'a1' }), asset({ id: 'a2' })] })
      const s = usePlaceAssets()
      await s.load('7', 'spot-a', null, null)
      expect(s.photos.value.map(p => p.id)).toEqual(['a1', 'a2'])
      expect(s.loaded.value).toBe(true)

      let resolveSecond: (v: unknown) => void = () => {}
      listAssetsByPlace.mockReturnValueOnce(new Promise((r) => { resolveSecond = r }))
      const p2 = s.load('7', '', null, null) // showWholeCity: clear spot, back to whole city
      // Response not yet arrived — should not still see photos from previous spot (a1/a2).
      expect(s.photos.value).toEqual([])
      expect(s.loaded.value).toBe(false)
      expect(s.loading.value).toBe(true)

      resolveSecond({ assets: [asset({ id: 'city-1' })] })
      await p2
      expect(s.photos.value.map(p => p.id)).toEqual(['city-1'])
      expect(s.loaded.value).toBe(true)
    })

    it('Second load() failure also does not leave first load photos (failed branch already has clear, behavior consistent)', async () => {
      listAssetsByPlace.mockResolvedValueOnce({ assets: [asset({ id: 'a1' })] })
      const s = usePlaceAssets()
      await s.load('7', 'spot-a', null, null)
      expect(s.photos.value).toHaveLength(1)

      listAssetsByPlace.mockRejectedValueOnce(new Error('boom'))
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      await s.load('7', '', null, null)
      expect(s.photos.value).toEqual([])
      expect(s.failed.value).toBe(true)
      spy.mockRestore()
    })

    it('Stale response still not filled back: seq guard continues to work over clear (A slow/B fast, A arrives later does not overwrite B result)', async () => {
      let resolveA: (v: unknown) => void = () => {}
      let resolveB: (v: unknown) => void = () => {}
      listAssetsByPlace
        .mockReturnValueOnce(new Promise((r) => { resolveA = r }))
        .mockReturnValueOnce(new Promise((r) => { resolveB = r }))
      const s = usePlaceAssets()
      const pA = s.load('7', 'a', null, null)
      const pB = s.load('7', 'b', null, null)
      resolveB({ assets: [asset({ id: 'b1' })] })
      await pB
      expect(s.photos.value.map(p => p.id)).toEqual(['b1'])
      resolveA({ assets: [asset({ id: 'a1' })] })
      await pA
      // A is stale response, even if it resolves after B, it cannot overwrite/clear B's result.
      expect(s.photos.value.map(p => p.id)).toEqual(['b1'])
      expect(s.loaded.value).toBe(true)
    })
  })
})
