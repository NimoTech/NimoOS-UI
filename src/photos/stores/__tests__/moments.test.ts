// SP15-P1-T3: moments store. Cross-checked against the momentResponse shape in
// NimoOS-Photos/route/v1/moments.go:39-73 — featured_asset_ids / added_this_week /
// cover_ratio are always emitted; cover_asset_id / time_from / time_to / place /
// sort_order carry `omitempty` and may be absent; **updated_at is never sent by the
// backend at all** (see plan Global Constraints).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const listMoments = vi.fn()
const getMomentAssets = vi.fn()
const pinMomentAssets = vi.fn()
const excludeMomentAssets = vi.fn()
const deleteMoment = vi.fn()
const exportMomentAlbum = vi.fn()
const reorderMoments = vi.fn()

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      listMoments: (...a: unknown[]) => listMoments(...a),
      getMomentAssets: (...a: unknown[]) => getMomentAssets(...a),
      pinMomentAssets: (...a: unknown[]) => pinMomentAssets(...a),
      excludeMomentAssets: (...a: unknown[]) => excludeMomentAssets(...a),
      deleteMoment: (...a: unknown[]) => deleteMoment(...a),
      exportMomentAlbum: (...a: unknown[]) => exportMomentAlbum(...a),
      reorderMoments: (...a: unknown[]) => reorderMoments(...a),
      thumbnailUrl: (id: string, size: string) => `mock://${id}/${size}`,
    },
  },
}))

import { usePhotosMoments } from '../moments'

const RAW = {
  id: 'm1', title: 'Bozeman', subtitle: 'Nov 2016', cover_asset_id: 'c1',
  asset_count: 42, time_from: '2016-11-20T00:46:46Z', time_to: '2016-11-22T04:04:35Z',
  place: 'Bozeman', recipe_key: 'trip:1', named_by_llm: false, sort_order: 0,
  featured_asset_ids: ['f1', 'f2'], added_this_week: 3, cover_ratio: 1.5,
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('normalisation', () => {
  it('converts snake_case fields to camelCase field by field', async () => {
    listMoments.mockResolvedValue([RAW])
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(s.moments[0]).toEqual({
      id: 'm1', title: 'Bozeman', subtitle: 'Nov 2016', place: 'Bozeman',
      recipeKey: 'trip:1', coverAssetId: 'c1', featuredAssetIds: ['f1', 'f2'],
      assetCount: 42, addedThisWeek: 3, coverRatio: 1.5,
      timeFrom: '2016-11-20T00:46:46Z', timeTo: '2016-11-22T04:04:35Z', updatedAt: '',
    })
  })

  it('defaults absent omitempty fields instead of leaving them undefined', async () => {
    listMoments.mockResolvedValue([{ id: 'm2', title: 'T', asset_count: 0, recipe_key: 'theme:food', featured_asset_ids: [], added_this_week: 0, cover_ratio: 0 }])
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(s.moments[0]).toMatchObject({ subtitle: '', place: '', coverAssetId: '', timeFrom: '', timeTo: '', updatedAt: '' })
  })

  it('normalises id to String unconditionally (a numeric backend id must not blow up)', async () => {
    listMoments.mockResolvedValue([{ ...RAW, id: 7 }])
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(s.moments[0].id).toBe('7')
  })
})

describe('list and sizeMap', () => {
  it('sizeMap tracks moments and is the result of assignMomentSizes', async () => {
    listMoments.mockResolvedValue([RAW])
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(s.sizeMap.m1).toEqual({ size: 'standard', template: 'T1' })
  })

  it('keeps the old list and still sets listLoaded when fetchMoments fails, instead of clearing the view', async () => {
    listMoments.mockResolvedValueOnce([RAW])
    const s = usePhotosMoments()
    await s.fetchMoments()
    listMoments.mockRejectedValueOnce(new Error('boom'))
    await s.fetchMoments()
    expect(s.moments).toHaveLength(1)
    expect(s.listLoaded).toBe(true)
  })

  it('ensureLoaded only fetches once; byId returns undefined before load', async () => {
    listMoments.mockResolvedValue([RAW])
    const s = usePhotosMoments()
    expect(s.byId('m1')).toBeUndefined()
    await s.ensureLoaded()
    await s.ensureLoaded()
    expect(listMoments).toHaveBeenCalledTimes(1)
    expect(s.byId('m1')?.title).toBe('Bozeman')
  })
})

describe('reordering', () => {
  it('applies the optimistic reorder up front and keeps it on success', async () => {
    listMoments.mockResolvedValue([RAW, { ...RAW, id: 'm2' }])
    reorderMoments.mockResolvedValue({})
    const s = usePhotosMoments()
    await s.fetchMoments()
    const ok = await s.reorder(['m2', 'm1'])
    expect(ok).toBe(true)
    expect(s.moments.map((m) => m.id)).toEqual(['m2', 'm1'])
    expect(reorderMoments).toHaveBeenCalledWith(['m2', 'm1'])
  })

  it('refetches the list to fully revert on failure, and returns false', async () => {
    listMoments.mockResolvedValue([RAW, { ...RAW, id: 'm2' }])
    reorderMoments.mockRejectedValue(new Error('nope'))
    const s = usePhotosMoments()
    await s.fetchMoments()
    const ok = await s.reorder(['m2', 'm1'])
    expect(ok).toBe(false)
    expect(s.moments.map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('bails out conservatively when ids do not match the current list, sending no request and dropping no entries', async () => {
    listMoments.mockResolvedValue([RAW, { ...RAW, id: 'm2' }])
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(await s.reorder(['m2'])).toBe(false)
    expect(await s.reorder(['m2', 'nope'])).toBe(false)
    expect(reorderMoments).not.toHaveBeenCalled()
    expect(s.moments.map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('rejects a duplicate id instead of silently dropping the entry it displaces', async () => {
    listMoments.mockResolvedValue([RAW, { ...RAW, id: 'm2' }])
    const s = usePhotosMoments()
    await s.fetchMoments()
    // Same length as the current list (2), every id individually known, but 'm1'
    // appears twice — a naive length-only check would let this through and 'm2'
    // would vanish from state with no error.
    expect(await s.reorder(['m1', 'm1'])).toBe(false)
    expect(reorderMoments).not.toHaveBeenCalled()
    expect(s.moments.map((m) => m.id)).toEqual(['m1', 'm2'])
  })
})

describe('detail assets', () => {
  it('loadDetail parses {assets,members,places} and camel-cases members', async () => {
    getMomentAssets.mockResolvedValue({
      assets: [{ id: 'a1', takenAt: '2016-11-20T00:00:00Z' }],
      members: [{ asset_id: 'a1', manual: true, featured: true }],
      places: [{ name: 'Bozeman', count: 323 }],
    })
    const s = usePhotosMoments()
    const d = await s.loadDetail('m1')
    expect(getMomentAssets).toHaveBeenCalledWith('m1', true, true)
    expect(d.members).toEqual([{ assetId: 'a1', manual: true, featured: true }])
    expect(d.places).toEqual([{ name: 'Bozeman', count: 323 }])
    expect(d.assets).toHaveLength(1)
  })

  it('tolerates the older backend bare-array shape (members/places default to empty arrays)', async () => {
    getMomentAssets.mockResolvedValue([{ id: 'a1' }])
    const s = usePhotosMoments()
    const d = await s.loadDetail('m1')
    expect(d.members).toEqual([])
    expect(d.places).toEqual([])
    expect(d.assets).toHaveLength(1)
  })

  it('loadAll requests without featured/withMembers and returns a flat Photo array', async () => {
    getMomentAssets.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }])
    const s = usePhotosMoments()
    const list = await s.loadAll('m1')
    expect(getMomentAssets).toHaveBeenCalledWith('m1', false, false)
    expect(list).toHaveLength(2)
  })
})

describe('write operations', () => {
  it('pin writes the returned asset_count back onto the list item on success', async () => {
    listMoments.mockResolvedValue([RAW])
    pinMomentAssets.mockResolvedValue({ ok: true, asset_count: 50 })
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(await s.pin('m1', ['x'])).toBe(50)
    expect(s.byId('m1')?.assetCount).toBe(50)
  })

  it('exclude behaves the same way', async () => {
    listMoments.mockResolvedValue([RAW])
    excludeMomentAssets.mockResolvedValue({ ok: true, asset_count: 41 })
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(await s.exclude('m1', ['x'])).toBe(41)
    expect(s.byId('m1')?.assetCount).toBe(41)
  })

  it('keeps the previous value instead of writing undefined when the backend omits asset_count', async () => {
    listMoments.mockResolvedValue([RAW])
    pinMomentAssets.mockResolvedValue({ ok: true })
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(await s.pin('m1', ['x'])).toBeNull()
    expect(s.byId('m1')?.assetCount).toBe(42)
  })

  it('remove drops the entry from the list on success, and sizeMap recomputes accordingly', async () => {
    listMoments.mockResolvedValue([RAW, { ...RAW, id: 'm2' }])
    deleteMoment.mockResolvedValue({})
    const s = usePhotosMoments()
    await s.fetchMoments()
    await s.remove('m1')
    expect(s.moments.map((m) => m.id)).toEqual(['m2'])
    expect(s.sizeMap.m1).toBeUndefined()
  })

  it('remove throws and leaves the list untouched on failure', async () => {
    listMoments.mockResolvedValue([RAW])
    deleteMoment.mockRejectedValue(new Error('nope'))
    const s = usePhotosMoments()
    await s.fetchMoments()
    await expect(s.remove('m1')).rejects.toThrow()
    expect(s.moments).toHaveLength(1)
  })

  it('exportAlbum passes {albumId,name,count} through unchanged', async () => {
    exportMomentAlbum.mockResolvedValue({ albumId: 'al1', name: 'Bozeman', count: 42 })
    const s = usePhotosMoments()
    expect(await s.exportAlbum('m1')).toEqual({ albumId: 'al1', name: 'Bozeman', count: 42 })
  })
})

describe('staleness guard under concurrency', () => {
  it('when two fetchMoments calls interleave, the later call wins (the late-arriving earlier response is discarded)', async () => {
    let resolveA: (v: unknown) => void = () => {}
    listMoments.mockImplementationOnce(() => new Promise((r) => { resolveA = r }))
    listMoments.mockResolvedValueOnce([{ ...RAW, id: 'second' }])

    const s = usePhotosMoments()
    const pA = s.fetchMoments()   // fired first, stays pending
    const pB = s.fetchMoments()   // fired second, resolves immediately
    await pB
    resolveA([{ ...RAW, id: 'first' }])  // the first call's response arrives late
    await pA

    expect(s.moments.map((m) => m.id)).toEqual(['second'])
  })
})
