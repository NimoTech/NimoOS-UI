import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePhotosSmartViews } from '../smartViews'
import { usePhotosAlbums } from '../albums'

const listSmartViews = vi.fn()
const createSmartViewApi = vi.fn()
const updateSmartViewApi = vi.fn()
const deleteSmartViewApi = vi.fn()
const duplicateSmartViewApi = vi.fn()
const getSmartViewAssets = vi.fn()
const getSmartViewActivity = vi.fn()
const previewSmartViewApi = vi.fn()
const exportSmartViewAlbumApi = vi.fn()
const convertAlbumToSmartApi = vi.fn()

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      listSmartViews: (...a: unknown[]) => listSmartViews(...a),
      createSmartView: (...a: unknown[]) => createSmartViewApi(...a),
      updateSmartView: (...a: unknown[]) => updateSmartViewApi(...a),
      deleteSmartView: (...a: unknown[]) => deleteSmartViewApi(...a),
      duplicateSmartView: (...a: unknown[]) => duplicateSmartViewApi(...a),
      getSmartViewAssets: (...a: unknown[]) => getSmartViewAssets(...a),
      getSmartViewActivity: (...a: unknown[]) => getSmartViewActivity(...a),
      previewSmartView: (...a: unknown[]) => previewSmartViewApi(...a),
      exportSmartViewAlbum: (...a: unknown[]) => exportSmartViewAlbumApi(...a),
      convertAlbumToSmart: (...a: unknown[]) => convertAlbumToSmartApi(...a),
    },
  },
}))

/* Source verification (NimoOS-Photos/service/smartview.go:21-34 SmartView struct):
   id/name/description/conds/threshold/live/includeVideos/count/addedThisWeek/seeds
   always present (count/addedThisWeek/conds/seeds have no omitempty), median/storageBytes/distribution/
   evaluatedAt has omitempty and may be omitted. */
const FULL_SV = {
  id: 'sv-1', name: 'Foo', description: 'Bar',
  conds: ['a', 'b'], threshold: 80, live: true, includeVideos: false,
  count: 40, addedThisWeek: 3, seeds: ['s1'],
  median: 55, storageBytes: 1024, distribution: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  evaluatedAt: '2026-01-01T00:00:00Z', createdAt: '2025-12-31T00:00:00Z',
}
const MINIMAL_SV = {
  id: 7, name: 'X', conds: null, threshold: 50, live: true, includeVideos: false,
  count: 1, addedThisWeek: 0,
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('fetchSmartViews', () => {
  it('backend returns null → [] and listLoaded is true', async () => {
    listSmartViews.mockResolvedValue(null)
    const s = usePhotosSmartViews()
    expect(s.listLoaded).toBe(false)
    await s.fetchSmartViews()
    expect(s.smartViews).toEqual([])
    expect(s.listLoaded).toBe(true)
  })

  it('returns two items → length 2, id converted via String()', async () => {
    listSmartViews.mockResolvedValue([FULL_SV, MINIMAL_SV])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(s.smartViews).toHaveLength(2)
    expect(s.smartViews.map(v => v.id)).toEqual(['sv-1', '7'])
  })

  it('throws error → smartViews keeps original value (not cleared), listLoaded still false, console.error called', async () => {
    listSmartViews.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(s.smartViews).toEqual([])
    expect(s.listLoaded).toBe(false)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('on error, retains previously loaded data', async () => {
    listSmartViews.mockResolvedValueOnce([FULL_SV])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    listSmartViews.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await s.fetchSmartViews()
    expect(s.smartViews).toHaveLength(1)
    expect(s.listLoaded).toBe(true)
    spy.mockRestore()
  })
})

describe('toSmartView fallback', () => {
  it('omitting median/storageBytes/distribution/evaluatedAt → 0/0/length-10 all-zeros array/""', async () => {
    listSmartViews.mockResolvedValue([MINIMAL_SV])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    const v = s.smartViews[0]
    expect(v.median).toBe(0)
    expect(v.storageBytes).toBe(0)
    expect(v.distribution).toEqual(new Array(10).fill(0))
    expect(v.evaluatedAt).toBe('')
  })

  it('conds: null → []', async () => {
    listSmartViews.mockResolvedValue([MINIMAL_SV])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(s.smartViews[0].conds).toEqual([])
  })

  it('seeds missing → []', async () => {
    listSmartViews.mockResolvedValue([MINIMAL_SV])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(s.smartViews[0].seeds).toEqual([])
  })

  it('distribution length < 10 also falls back entirely to all 0s (intentionally stricter, not copying Vue2 PhotosSmartViewDetail.vue:316 — where [1,2] would remain unchanged)', async () => {
    listSmartViews.mockResolvedValue([{ ...MINIMAL_SV, distribution: [1, 2] }])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(s.smartViews[0].distribution).toEqual(new Array(10).fill(0))
  })

  it('complete fields normalized as-is (number → string id, numbers/booleans passed through)', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(s.smartViews[0]).toEqual({
      id: 'sv-1', name: 'Foo', description: 'Bar',
      conds: ['a', 'b'], threshold: 80, live: true, includeVideos: false,
      count: 40, addedThisWeek: 3, seeds: ['s1'],
      median: 55, storageBytes: 1024, distribution: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      evaluatedAt: '2026-01-01T00:00:00Z', createdAt: '2025-12-31T00:00:00Z',
    })
  })

  it('createdAt is normalised off the wire and falls back to an empty string when absent', async () => {
    // The backend has always returned it (NimoOS-Photos service/smartview.go:23); the
    // front-end type simply never carried it until the global album sort needed it.
    listSmartViews.mockResolvedValue([
      { ...MINIMAL_SV, createdAt: '2026-01-02T03:04:05Z' },
      MINIMAL_SV,
    ])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(s.smartViews[0].createdAt).toBe('2026-01-02T03:04:05Z')
    expect(s.smartViews[1].createdAt).toBe('')
  })
})

describe('byId (structural fix)', () => {
  it('when backend id is number 7, byId(\'7\') hits (String normalization main guard)', async () => {
    listSmartViews.mockResolvedValue([MINIMAL_SV])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(s.byId('7')?.name).toBe('X')
  })

  it('does not exist → null', async () => {
    listSmartViews.mockResolvedValue([MINIMAL_SV])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(s.byId('does-not-exist')).toBeNull()
  })
})

describe('createSmartView', () => {
  const input = {
    name: 'New', description: 'd', conds: ['a'],
    threshold: 70, live: true, includeVideos: false,
  }

  // fix round 1 · C1(Critical, source-verified): backend Create(smartview.go:65-68) returns 400
  // for empty id, route handler never generates one — the original assertion "no id" locked in
  // a wrong contract that would fail 100% on real hardware. Changed to assert request body **must**
  // have an id with `sv-` prefix.
  it('request body contains condsRaw and not conds, id has sv- prefix (C1 source fix)', async () => {
    createSmartViewApi.mockResolvedValue({ ...FULL_SV, id: 'sv-new' })
    const s = usePhotosSmartViews()
    await s.createSmartView(input)
    expect(createSmartViewApi).toHaveBeenCalledTimes(1)
    const arg = createSmartViewApi.mock.calls[0][0] as Record<string, unknown>
    expect(arg).toEqual(expect.objectContaining({ condsRaw: ['a'] }))
    expect(arg).not.toHaveProperty('conds')
    expect(String(arg.id)).toMatch(/^sv-/)
  })

  it('two consecutive create calls generate different ids (C1: use uuid not Date.now(), avoid same-millisecond collision)', async () => {
    createSmartViewApi.mockResolvedValue({ ...FULL_SV, id: 'sv-new' })
    const s = usePhotosSmartViews()
    await s.createSmartView(input)
    await s.createSmartView(input)
    const id1 = (createSmartViewApi.mock.calls[0][0] as Record<string, unknown>).id
    const id2 = (createSmartViewApi.mock.calls[1][0] as Record<string, unknown>).id
    expect(id1).not.toBe(id2)
  })

  it('success → new item at array start', async () => {
    createSmartViewApi.mockResolvedValue({ ...FULL_SV, id: 'sv-new', name: 'New' })
    const s = usePhotosSmartViews()
    listSmartViews.mockResolvedValue([FULL_SV])
    await s.fetchSmartViews()
    await s.createSmartView(input)
    expect(s.smartViews[0].id).toBe('sv-new')
    expect(s.smartViews).toHaveLength(2)
  })

  it('second call during createBusy returns null directly, backend called only once', async () => {
    createSmartViewApi.mockReturnValue(new Promise(() => {})) // never settles
    const s = usePhotosSmartViews()
    void s.createSmartView(input)
    const second = await s.createSmartView(input)
    expect(second).toBeNull()
    expect(createSmartViewApi).toHaveBeenCalledTimes(1)
  })

  it('failure → rethrow and array length unchanged (reverse assertion Vue2\'s optimistic lie was not copied)', async () => {
    createSmartViewApi.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    await expect(s.createSmartView(input)).rejects.toThrow('boom')
    expect(s.smartViews).toHaveLength(0)
    spy.mockRestore()
  })

  it('createBusy resets after failure, next call proceeds normally', async () => {
    createSmartViewApi.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    await expect(s.createSmartView(input)).rejects.toThrow('boom')
    createSmartViewApi.mockResolvedValueOnce({ ...FULL_SV, id: 'sv-2' })
    await s.createSmartView(input)
    expect(createSmartViewApi).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
})

describe('updateSmartView', () => {
  it('patch.conds renamed to condsRaw when sent', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    updateSmartViewApi.mockResolvedValue(undefined)
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await s.updateSmartView('sv-1', { conds: ['x', 'y'] })
    expect(updateSmartViewApi).toHaveBeenCalledTimes(1)
    const [id, body] = updateSmartViewApi.mock.calls[0] as [string, Record<string, unknown>]
    expect(id).toBe('sv-1')
    expect(body).toEqual(expect.objectContaining({ condsRaw: ['x', 'y'] }))
    expect(body).not.toHaveProperty('conds')
  })

  it('response with body → list item replaced entirely and position unchanged (item originally at index 1 stays at index 1 after change)', async () => {
    listSmartViews.mockResolvedValue([FULL_SV, { ...MINIMAL_SV, id: 'sv-2' }])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    const updated = { ...FULL_SV, id: 'sv-2', name: 'Renamed' }
    updateSmartViewApi.mockResolvedValue(updated)
    await s.updateSmartView('sv-2', { name: 'Renamed' })
    expect(s.smartViews[1].id).toBe('sv-2')
    expect(s.smartViews[1].name).toBe('Renamed')
    expect(s.smartViews).toHaveLength(2)
  })

  it('response without body → merge patch in place', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    updateSmartViewApi.mockResolvedValue(undefined)
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await s.updateSmartView('sv-1', { name: 'Merged Name' })
    expect(s.smartViews[0].name).toBe('Merged Name')
    expect(s.smartViews[0].id).toBe('sv-1')
    expect(s.smartViews[0].conds).toEqual(['a', 'b']) // fields not in patch are unaffected
  })

  it('failure → rethrow and list item not modified locally', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    updateSmartViewApi.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await expect(s.updateSmartView('sv-1', { name: 'Should Not Apply' })).rejects.toThrow('boom')
    expect(s.smartViews[0].name).toBe('Foo')
    spy.mockRestore()
  })

  it('second call during patchBusy short-circuits, backend called only once', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    updateSmartViewApi.mockReturnValue(new Promise(() => {}))
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    void s.updateSmartView('sv-1', { name: 'a' })
    void s.updateSmartView('sv-1', { name: 'b' })
    expect(updateSmartViewApi).toHaveBeenCalledTimes(1)
  })

  it('patchBusy resets to false after failure', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    updateSmartViewApi.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await expect(s.updateSmartView('sv-1', { name: 'x' })).rejects.toThrow()
    updateSmartViewApi.mockResolvedValueOnce(undefined)
    await s.updateSmartView('sv-1', { name: 'y' })
    expect(updateSmartViewApi).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
})

describe('deleteSmartView / restoreSmartView', () => {
  it('delete non-existent id → null and backend not called', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    const r = await s.deleteSmartView('nope')
    expect(r).toBeNull()
    expect(deleteSmartViewApi).not.toHaveBeenCalled()
  })

  it('delete success → return { sv, index } and remove from array', async () => {
    listSmartViews.mockResolvedValue([FULL_SV, { ...MINIMAL_SV, id: 'sv-2' }])
    deleteSmartViewApi.mockResolvedValue(undefined)
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    const r = await s.deleteSmartView('sv-1')
    expect(r).toEqual({ sv: expect.objectContaining({ id: 'sv-1' }), index: 0 })
    expect(s.smartViews).toHaveLength(1)
    expect(s.smartViews[0].id).toBe('sv-2')
  })

  // fix round 1 · I1 (Important, interleaving scenario reproduced for review): deleteBusy does not
  // block fetchSmartViews; when a delete is in-flight and the list is re-sorted/inserted, the
  // pre-calculated index points to a different item. Must recalculate index by id. Interleaving
  // path: send delete(sv-2) → before its await resolves, let fetchSmartViews re-sort the list
  // (another client created a new view inserted at front) → then delete's network call resolves.
  // Assert that the deleted item is sv-2 (the one the user clicked), not sv-1 (now at misaligned
  // original index 1 after re-sort); the returned { sv, index } must also correspond to sv-2's
  // real position in the re-sorted list.
  it('concurrent interleaving: delete in-flight when fetchSmartViews re-sorts list, deleted item must still match by id', async () => {
    listSmartViews.mockResolvedValueOnce([
      { ...FULL_SV, id: 'sv-1' }, { ...FULL_SV, id: 'sv-2' }, { ...FULL_SV, id: 'sv-3' },
    ])
    let resolveDelete: () => void = () => {}
    deleteSmartViewApi.mockReturnValueOnce(new Promise<void>((r) => { resolveDelete = r }))
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(s.smartViews.map(v => v.id)).toEqual(['sv-1', 'sv-2', 'sv-3'])

    const pDelete = s.deleteSmartView('sv-2') // user clicked sv-2 (currently at index 1)

    // while the delete network request has not resolved, another client created a new
    // view, fetchSmartViews re-sorted sv-2 to index 2 (no longer at index 1).
    listSmartViews.mockResolvedValueOnce([
      { ...FULL_SV, id: 'sv-0' }, { ...FULL_SV, id: 'sv-1' },
      { ...FULL_SV, id: 'sv-2' }, { ...FULL_SV, id: 'sv-3' },
    ])
    await s.fetchSmartViews()
    expect(s.smartViews.map(v => v.id)).toEqual(['sv-0', 'sv-1', 'sv-2', 'sv-3'])

    resolveDelete()
    const result = await pDelete

    // must delete sv-2 (the item the user clicked), not sv-1 (now at old index 1 after re-sort)
    expect(s.smartViews.map(v => v.id)).toEqual(['sv-0', 'sv-1', 'sv-3'])
    expect(result?.sv.id).toBe('sv-2')
    expect(result?.index).toBe(2) // sv-2's true index in the re-sorted list, not the original 1
  })

  it('restore inserts it back at original index, request body includes id', async () => {
    listSmartViews.mockResolvedValue([FULL_SV, { ...MINIMAL_SV, id: 'sv-2' }])
    deleteSmartViewApi.mockResolvedValue(undefined)
    createSmartViewApi.mockResolvedValue(undefined)
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    const deleted = await s.deleteSmartView('sv-1')
    expect(deleted).not.toBeNull()
    await s.restoreSmartView(deleted!)
    expect(s.smartViews.map(v => v.id)).toEqual(['sv-1', 'sv-2'])
    const arg = createSmartViewApi.mock.calls[0][0] as Record<string, unknown>
    expect(arg.id).toBe('sv-1')
  })

  it('index out of bounds (e.g. 99) → inserted at end (clamped)', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    createSmartViewApi.mockResolvedValue(undefined)
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await s.restoreSmartView({ sv: { ...FULL_SV, id: 'sv-late' }, index: 99 })
    expect(s.smartViews.map(v => v.id)).toEqual(['sv-1', 'sv-late'])
  })

  // Test registration note: `Math.min(index, length)` itself is not falsifiable for the
  // "out-of-bounds" case — JS native `Array.prototype.splice` already has built-in semantics
  // that clamp to array length when start > length (`[1].splice(99,0,'x')` is equivalent to
  // `splice(1,0,'x')`), so removing Math.min doesn't break this test. The real necessity is
  // `Math.max(0, …)` — splice's semantics for **negative** start is "count from end", not
  // clamp to 0 (`[1,2,3].splice(-1,0,'y')` inserts at second-to-last position, not at front),
  // so this honest substitute test locks down Math.max.
  it('index is negative → clamped to 0 (inserted at front), not splice\'s native "count from end" semantics', async () => {
    listSmartViews.mockResolvedValue([FULL_SV, { ...MINIMAL_SV, id: 'sv-2' }])
    createSmartViewApi.mockResolvedValue(undefined)
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await s.restoreSmartView({ sv: { ...FULL_SV, id: 'sv-early' }, index: -1 })
    expect(s.smartViews.map(v => v.id)).toEqual(['sv-early', 'sv-1', 'sv-2'])
  })

  it('during deleteBusy, second delete call returns null immediately, backend called only once (shared lock)', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    deleteSmartViewApi.mockReturnValue(new Promise(() => {}))
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    void s.deleteSmartView('sv-1')
    const second = await s.deleteSmartView('sv-1')
    expect(second).toBeNull()
    expect(deleteSmartViewApi).toHaveBeenCalledTimes(1)
  })

  it('deleteSmartView failure → rethrow (error not swallowed)', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    deleteSmartViewApi.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await expect(s.deleteSmartView('sv-1')).rejects.toThrow('boom')
    expect(s.smartViews).toHaveLength(1) // not removed
    spy.mockRestore()
  })

  it('deleteBusy resets to false after failure', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    deleteSmartViewApi.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await expect(s.deleteSmartView('sv-1')).rejects.toThrow()
    deleteSmartViewApi.mockResolvedValueOnce(undefined)
    const r = await s.deleteSmartView('sv-1')
    expect(r).not.toBeNull()
    expect(deleteSmartViewApi).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
})

describe('duplicateSmartView', () => {
  it('during duplicateBusy, second call short-circuits, backend called only once', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    duplicateSmartViewApi.mockReturnValue(new Promise(() => {}))
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    void s.duplicateSmartView('sv-1')
    void s.duplicateSmartView('sv-1')
    expect(duplicateSmartViewApi).toHaveBeenCalledTimes(1)
  })

  it('on success, returned object inserted into list', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    duplicateSmartViewApi.mockResolvedValue({ ...FULL_SV, id: 'sv-1-copy', name: 'Foo (copy)' })
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await s.duplicateSmartView('sv-1')
    expect(s.smartViews.map(v => v.id)).toContain('sv-1-copy')
    expect(s.smartViews).toHaveLength(2)
  })

  it('failure → rethrow, duplicateBusy resets', async () => {
    duplicateSmartViewApi.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    await expect(s.duplicateSmartView('sv-1')).rejects.toThrow('boom')
    duplicateSmartViewApi.mockResolvedValueOnce({ ...FULL_SV, id: 'sv-1-copy2' })
    await s.duplicateSmartView('sv-1')
    expect(duplicateSmartViewApi).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
})

describe('convertFromAlbum', () => {
  it('unshifts the new smart view and returns it', async () => {
    convertAlbumToSmartApi.mockResolvedValue({ id: 'sv-new', name: 'N', createdAt: '2026-02-01T00:00:00Z' })
    const s = usePhotosSmartViews()
    const sv = await s.convertFromAlbum('al-1', { description: 'sunsets', threshold: 80 })
    expect(sv.id).toBe('sv-new')
    expect(s.smartViews[0].id).toBe('sv-new')
  })

  it('rethrows so the caller can keep its dialog open', async () => {
    convertAlbumToSmartApi.mockRejectedValueOnce(new Error('boom'))
    const s = usePhotosSmartViews()
    await expect(s.convertFromAlbum('al-1', { description: 'x', threshold: 80 })).rejects.toBeTruthy()
    expect(s.smartViews).toHaveLength(0)
  })

  // Mirror of the albums store's own case: the backend deletes the source
  // album, so it must leave the albums store too. Without this, albums.albumsLoaded stays true,
  // PhotosAlbumDetail.vue:442 skips its own fetch, and one browser Back press lands on a fully
  // interactive detail page for an album the server has already deleted.
  it('evicts the source album from the albums store', async () => {
    convertAlbumToSmartApi.mockResolvedValue({ id: 'sv-new', name: 'N' })
    const albums = usePhotosAlbums()
    albums.albums = [{ id: 'al-1', name: 'A' }, { id: 'al-2', name: 'B' }]
    const s = usePhotosSmartViews()
    await s.convertFromAlbum('al-1', { description: 'sunsets', threshold: 80 })
    expect(albums.albums.map((a) => a.id)).toEqual(['al-2'])
    expect(s.smartViews[0].id).toBe('sv-new')
  })

  it('leaves the source album alone when the conversion fails', async () => {
    convertAlbumToSmartApi.mockRejectedValueOnce(new Error('boom'))
    const albums = usePhotosAlbums()
    albums.albums = [{ id: 'al-1', name: 'A' }]
    const s = usePhotosSmartViews()
    await expect(s.convertFromAlbum('al-1', { description: 'x', threshold: 80 })).rejects.toBeTruthy()
    expect(albums.albums.map((a) => a.id)).toEqual(['al-1'])
  })
})

describe('loadDetail: three requests in parallel + seq race guard', () => {
  it('three requests\' parameters asserted verbatim', async () => {
    getSmartViewAssets.mockResolvedValue([])
    getSmartViewActivity.mockResolvedValue([])
    const s = usePhotosSmartViews()
    await s.loadDetail('sv-1')
    expect(getSmartViewAssets).toHaveBeenNthCalledWith(1, 'sv-1', { limit: 60, offset: 0 })
    expect(getSmartViewAssets).toHaveBeenNthCalledWith(2, 'sv-1', { limit: 12, offset: 0, recent: true })
    expect(getSmartViewActivity).toHaveBeenCalledWith('sv-1', 10)
  })

  // fix round 1 · I2 (Important, reviewed with mutation test: deleting assetIds fallback +
  // hardcoding occurredAt to 'MUTATED' — all 46 cases still pass, indicating toActivity had
  // zero discriminatory power before). Backend SmartViewActivity.AssetIDs(smartview.go:731)
  // has omitempty, Go nil slice ⇒ entire field omitted from response; T8 activity feed
  // v-for's this array, undefined crashes the component.
  it('toActivity normalization: all fields missing + id is number → fallback each field (lock down detail/assetIds/occurredAt fallback, prevent silent weakening)', async () => {
    getSmartViewAssets.mockResolvedValue([])
    getSmartViewActivity.mockResolvedValue([{ id: 9, eventType: 'matched' }])
    const s = usePhotosSmartViews()
    await s.loadDetail('sv-1')
    expect(s.activity).toEqual([
      { id: '9', eventType: 'matched', detail: '', assetIds: [], occurredAt: '' },
    ])
  })

  it('late-arriving response resolves first: A(id=1) slow, B(id=2) fast → final data is B\'s', async () => {
    let resolveAllA: (v: unknown) => void = () => {}
    let resolveAllB: (v: unknown) => void = () => {}
    getSmartViewAssets
      .mockReturnValueOnce(new Promise((r) => { resolveAllA = r })) // A all
      .mockResolvedValueOnce([]) // A recent
      .mockReturnValueOnce(new Promise((r) => { resolveAllB = r })) // B all
      .mockResolvedValueOnce([]) // B recent
    getSmartViewActivity.mockResolvedValue([])
    const s = usePhotosSmartViews()

    const pA = s.loadDetail('1')
    const pB = s.loadDetail('2')
    // B (later-arriving) resolves first
    resolveAllB([{ id: 'b1' }])
    await pB
    expect(s.matchedAssets.map(p => p.id)).toEqual(['b1'])
    // A (earlier-arriving) resolves later — must be discarded
    resolveAllA([{ id: 'a1' }])
    await pA
    expect(s.matchedAssets.map(p => p.id)).toEqual(['b1'])
  })

  it('first-arriving response resolves first: A sent early and fast, B sent late and slow → A\'s finally must not reset still-in-flight detailLoading to false, final result is B\'s data and detailLoading ends false (lock down mine === seq guard in finally)', async () => {
    let resolveAllB: (v: unknown) => void = () => {}
    getSmartViewAssets
      .mockResolvedValueOnce([{ id: 'a1' }]) // A all (resolves immediately)
      .mockResolvedValueOnce([]) // A recent
      .mockReturnValueOnce(new Promise((r) => { resolveAllB = r })) // B all (pending)
      .mockResolvedValueOnce([]) // B recent
    getSmartViewActivity.mockResolvedValue([])
    const s = usePhotosSmartViews()

    // A and B sent back-to-back (B sent before A's Promise.all resolves, detailSeq advanced to B)
    const pA = s.loadDetail('1')
    const pB = s.loadDetail('2')
    // A resolves first, but now mine(A) !== detailSeq (already advanced to B) — A's finally
    // must abandon reset, detailLoading should still be true (B in flight), not reset by A
    await pA
    expect(s.detailLoading).toBe(true)
    expect(s.matchedAssets).toEqual([]) // A's data must also not be written (mine !== detailSeq)

    resolveAllB([{ id: 'b1' }])
    await pB
    expect(s.matchedAssets.map(p => p.id)).toEqual(['b1'])
    expect(s.detailLoading).toBe(false)
  })

  it('clear old data: on second loadDetail, matchedAssets is already [] before its await resolves', async () => {
    getSmartViewAssets
      .mockResolvedValueOnce([{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }])
      .mockResolvedValueOnce([])
    getSmartViewActivity.mockResolvedValue([])
    const s = usePhotosSmartViews()
    await s.loadDetail('1')
    expect(s.matchedAssets).toHaveLength(3)

    let resolveAllSecond: (v: unknown) => void = () => {}
    getSmartViewAssets.mockReturnValueOnce(new Promise((r) => { resolveAllSecond = r }))
    const p2 = s.loadDetail('2')
    // not yet awaited — clearing must have already happened
    expect(s.matchedAssets).toEqual([])
    expect(s.recentAssets).toEqual([])
    expect(s.activity).toEqual([])
    resolveAllSecond([])
    await p2
  })

  it('on failure, console.error called and detailLoading resets', async () => {
    getSmartViewAssets.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    await s.loadDetail('1')
    expect(spy).toHaveBeenCalled()
    expect(s.detailLoading).toBe(false)
    spy.mockRestore()
  })
})

describe('refreshPreview: 300ms debounce + seq guard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('calling 3 times in a row sends only 1 request (debounce)', async () => {
    previewSmartViewApi.mockResolvedValue({ count: 1, seeds: [], thresholdActive: true })
    const s = usePhotosSmartViews()
    s.refreshPreview({ description: '', conds: ['a'], threshold: 50, includeVideos: false })
    s.refreshPreview({ description: '', conds: ['a', 'b'], threshold: 50, includeVideos: false })
    s.refreshPreview({ description: '', conds: ['a', 'b', 'c'], threshold: 50, includeVideos: false })
    await vi.advanceTimersByTimeAsync(300)
    expect(previewSmartViewApi).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('two calls over 300ms apart, first response slower — old response must not overwrite new result (seq guard)', async () => {
    let resolveA: (v: unknown) => void = () => {}
    let resolveB: (v: unknown) => void = () => {}
    previewSmartViewApi
      .mockReturnValueOnce(new Promise((r) => { resolveA = r }))
      .mockReturnValueOnce(new Promise((r) => { resolveB = r }))
    const s = usePhotosSmartViews()
    s.refreshPreview({ description: '', conds: ['a'], threshold: 50, includeVideos: false })
    await vi.advanceTimersByTimeAsync(300)
    s.refreshPreview({ description: '', conds: ['b'], threshold: 50, includeVideos: false })
    await vi.advanceTimersByTimeAsync(300)
    // B (later-arriving) resolves first
    resolveB({ count: 2, seeds: ['s2'], thresholdActive: true })
    await Promise.resolve()
    await Promise.resolve()
    expect(s.preview.count).toBe(2)
    // A (earlier-arriving) resolves later — must be discarded
    resolveA({ count: 999, seeds: ['s1'], thresholdActive: false })
    await Promise.resolve()
    await Promise.resolve()
    expect(s.preview.count).toBe(2)
    vi.useRealTimers()
  })

  it('response missing thresholdActive → thresholdActive === true', async () => {
    previewSmartViewApi.mockResolvedValue({ count: 1, seeds: [] })
    const s = usePhotosSmartViews()
    s.refreshPreview({ description: '', conds: ['a'], threshold: 50, includeVideos: false })
    await vi.advanceTimersByTimeAsync(300)
    expect(s.preview.thresholdActive).toBe(true)
    vi.useRealTimers()
  })

  it('explicit false → false', async () => {
    previewSmartViewApi.mockResolvedValue({ count: 1, seeds: [], thresholdActive: false })
    const s = usePhotosSmartViews()
    s.refreshPreview({ description: '', conds: ['a'], threshold: 50, includeVideos: false })
    await vi.advanceTimersByTimeAsync(300)
    expect(s.preview.thresholdActive).toBe(false)
    vi.useRealTimers()
  })

  it('on failure, preview retains previous value', async () => {
    previewSmartViewApi.mockResolvedValueOnce({ count: 5, seeds: ['x'], thresholdActive: true })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    s.refreshPreview({ description: '', conds: ['a'], threshold: 50, includeVideos: false })
    await vi.advanceTimersByTimeAsync(300)
    expect(s.preview.count).toBe(5)

    previewSmartViewApi.mockRejectedValueOnce(new Error('boom'))
    s.refreshPreview({ description: '', conds: ['b'], threshold: 50, includeVideos: false })
    await vi.advanceTimersByTimeAsync(300)
    expect(s.preview.count).toBe(5) // not cleared
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
    vi.useRealTimers()
  })
})

// New in T5 (create dialog), controller authorization: when closing dialog, clear triggered
// timers + invalidate in-flight responses. See comments above cancelPreview in smartViews.ts.
describe('cancelPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('called when timer not yet fired → timer cleared, backend request not sent at all', async () => {
    const s = usePhotosSmartViews()
    s.refreshPreview({ description: '', conds: ['a'], threshold: 50, includeVideos: false })
    s.cancelPreview()
    await vi.advanceTimersByTimeAsync(300)
    expect(previewSmartViewApi).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('called while request in flight → on response, preview not updated (closed, in-flight response must not overwrite)', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    previewSmartViewApi.mockReturnValueOnce(new Promise((r) => { resolveFn = r }))
    const s = usePhotosSmartViews()
    s.refreshPreview({ description: '', conds: ['a'], threshold: 50, includeVideos: false })
    await vi.advanceTimersByTimeAsync(300)
    expect(previewSmartViewApi).toHaveBeenCalledTimes(1)
    // request already sent, still in flight — at this point close the dialog
    s.cancelPreview()
    resolveFn({ count: 999, seeds: ['stale'], thresholdActive: false })
    await Promise.resolve()
    await Promise.resolve()
    expect(s.preview).toEqual({ count: 0, seeds: [], thresholdActive: true })
    vi.useRealTimers()
  })

  it('calling refreshPreview again afterwards works normally (seq counter not destroyed)', async () => {
    const s = usePhotosSmartViews()
    s.refreshPreview({ description: '', conds: ['a'], threshold: 50, includeVideos: false })
    s.cancelPreview()
    previewSmartViewApi.mockResolvedValueOnce({ count: 7, seeds: ['x'], thresholdActive: true })
    s.refreshPreview({ description: '', conds: ['b'], threshold: 50, includeVideos: false })
    await vi.advanceTimersByTimeAsync(300)
    await Promise.resolve()
    await Promise.resolve()
    expect(s.preview.count).toBe(7)
    vi.useRealTimers()
  })
})

describe('exportAlbum', () => {
  it('during exportBusy, second call short-circuits, backend called only once', async () => {
    exportSmartViewAlbumApi.mockReturnValue(new Promise(() => {}))
    const s = usePhotosSmartViews()
    void s.exportAlbum('sv-1')
    void s.exportAlbum('sv-1')
    expect(exportSmartViewAlbumApi).toHaveBeenCalledTimes(1)
  })

  it('failure → rethrow (view layer handles toast text), exportBusy resets', async () => {
    exportSmartViewAlbumApi.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    await expect(s.exportAlbum('sv-1')).rejects.toThrow('boom')
    exportSmartViewAlbumApi.mockResolvedValueOnce(undefined)
    await s.exportAlbum('sv-1')
    expect(exportSmartViewAlbumApi).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
})

describe('__resetForTest', () => {
  it('resets all refs', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    getSmartViewAssets.mockResolvedValue([{ id: 'a1' }])
    getSmartViewActivity.mockResolvedValue([{ id: 'act1', eventType: 'created', occurredAt: '2026-01-01' }])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await s.loadDetail('sv-1')

    s.__resetForTest()

    expect(s.smartViews).toEqual([])
    expect(s.listLoaded).toBe(false)
    expect(s.listLoading).toBe(false)
    expect(s.matchedAssets).toEqual([])
    expect(s.recentAssets).toEqual([])
    expect(s.activity).toEqual([])
    expect(s.detailLoading).toBe(false)
    expect(s.preview).toEqual({ count: 0, seeds: [], thresholdActive: true })
    expect(s.createBusy).toBe(false)
    expect(s.patchBusy).toBe(false)
    expect(s.deleteBusy).toBe(false)
    expect(s.duplicateBusy).toBe(false)
    expect(s.exportBusy).toBe(false)
  })
})
