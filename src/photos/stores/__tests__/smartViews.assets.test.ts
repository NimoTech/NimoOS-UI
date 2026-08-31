// Tests for the smart view manual asset actions on the store.
// Two things are deliberately different from Vue 2 and are asserted here:
//  1) the post-write statistics refetch lives inside each action rather than at
//     the call sites — Vue 2 shipped #82 precisely because a call site forgot it;
//  2) an empty id list is rejected locally, because the backend answers 400.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const listSmartViews = vi.fn()
const getSmartView = vi.fn()
const pinSmartViewAssets = vi.fn()
const removeSmartViewAssets = vi.fn()
const restoreSmartViewAssets = vi.fn()
const getSmartViewExcluded = vi.fn()

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      listSmartViews: (...a: unknown[]) => listSmartViews(...a),
      getSmartView: (...a: unknown[]) => getSmartView(...a),
      pinSmartViewAssets: (...a: unknown[]) => pinSmartViewAssets(...a),
      removeSmartViewAssets: (...a: unknown[]) => removeSmartViewAssets(...a),
      restoreSmartViewAssets: (...a: unknown[]) => restoreSmartViewAssets(...a),
      getSmartViewExcluded: (...a: unknown[]) => getSmartViewExcluded(...a),
      thumbnailUrl: (id: string, size: string) => `mock://${id}/${size}`,
    },
  },
}))

import { usePhotosSmartViews } from '../smartViews'

const RAW_SV = { id: 'sv1', name: 'Hiking', conds: ['a'], threshold: 80, count: 10, median: 5, storageBytes: 100 }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  listSmartViews.mockResolvedValue([RAW_SV])
})

describe('pinAssets', () => {
  it('returns the added count and refetches the view so the header and card both follow', async () => {
    pinSmartViewAssets.mockResolvedValue({ added: 2 })
    getSmartView.mockResolvedValue({ ...RAW_SV, count: 12 })
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()

    expect(await s.pinAssets('sv1', ['x', 'y'])).toBe(2)
    expect(pinSmartViewAssets).toHaveBeenCalledWith('sv1', ['x', 'y'])
    expect(getSmartView).toHaveBeenCalledWith('sv1')
    expect(s.byId('sv1')?.count).toBe(12)
  })

  it('sends no request for an empty list — the backend answers 400 for one', async () => {
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(await s.pinAssets('sv1', [])).toBe(0)
    expect(pinSmartViewAssets).not.toHaveBeenCalled()
  })

  it('rethrows on failure and leaves the stored view untouched', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    pinSmartViewAssets.mockRejectedValue(new Error('nope'))
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await expect(s.pinAssets('sv1', ['x'])).rejects.toThrow()
    expect(s.byId('sv1')?.count).toBe(10)
    spy.mockRestore()
  })

  it('a failing refetch does not turn a successful write into a failure', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    pinSmartViewAssets.mockResolvedValue({ added: 1 })
    getSmartView.mockRejectedValue(new Error('stats down'))
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(await s.pinAssets('sv1', ['x'])).toBe(1)
    expect(s.byId('sv1')?.count).toBe(10)
    spy.mockRestore()
  })
})

describe('removeAssets', () => {
  it('returns both tiers and refetches the view', async () => {
    removeSmartViewAssets.mockResolvedValue({ unpinned: 1, excluded: 2 })
    getSmartView.mockResolvedValue({ ...RAW_SV, count: 7 })
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()

    expect(await s.removeAssets('sv1', ['x'])).toEqual({ unpinned: 1, excluded: 2 })
    expect(s.byId('sv1')?.count).toBe(7)
  })

  it('defaults both counters to 0 when the backend omits them', async () => {
    removeSmartViewAssets.mockResolvedValue({})
    getSmartView.mockResolvedValue(RAW_SV)
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(await s.removeAssets('sv1', ['x'])).toEqual({ unpinned: 0, excluded: 0 })
  })

  it('sends no request for an empty list', async () => {
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(await s.removeAssets('sv1', [])).toEqual({ unpinned: 0, excluded: 0 })
    expect(removeSmartViewAssets).not.toHaveBeenCalled()
  })
})

describe('restoreAssets', () => {
  it('returns the restored count and refetches the view', async () => {
    restoreSmartViewAssets.mockResolvedValue({ restored: 3 })
    getSmartView.mockResolvedValue({ ...RAW_SV, count: 13 })
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(await s.restoreAssets('sv1', ['x'])).toBe(3)
    expect(s.byId('sv1')?.count).toBe(13)
  })
})

// Final review, finding 5 + the coverage hole beside it. `assetBusy` guards the three write
// actions against each other, and nothing tested it at all — removing the flag entirely left
// the suite green. It also used to make a dropped call indistinguishable from a real zero:
// the view then announced "pinned 0 items to this view" and closed the picker over a request that was
// never sent. `null` is now the dropped-because-busy answer; an empty list still answers 0.
describe('assetBusy mutual exclusion', () => {
  // A write is parked in flight so the second call lands while the flag is up.
  function hangingPin() {
    let release: (v: unknown) => void = () => {}
    pinSmartViewAssets.mockImplementationOnce(() => new Promise((r) => { release = r }))
    return { release: () => release({ added: 1 }) }
  }

  it('drops a second write while one is in flight, and says so with null rather than a zero', async () => {
    getSmartView.mockResolvedValue(RAW_SV)
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    const h = hangingPin()

    const inFlight = s.pinAssets('sv1', ['x'])
    expect(s.assetBusy).toBe(true)

    // All three actions share the one flag, so all three are refused.
    expect(await s.removeAssets('sv1', ['y'])).toBeNull()
    expect(await s.restoreAssets('sv1', ['y'])).toBeNull()
    expect(await s.pinAssets('sv1', ['y'])).toBeNull()
    expect(removeSmartViewAssets).not.toHaveBeenCalled()
    expect(restoreSmartViewAssets).not.toHaveBeenCalled()
    expect(pinSmartViewAssets).toHaveBeenCalledTimes(1)

    h.release()
    expect(await inFlight).toBe(1)
    expect(s.assetBusy).toBe(false)

    // And the flag really does clear — the next write goes through.
    pinSmartViewAssets.mockResolvedValue({ added: 4 })
    expect(await s.pinAssets('sv1', ['z'])).toBe(4)
  })

  it('an empty list is still a real zero, not the dropped-call sentinel', async () => {
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(await s.pinAssets('sv1', [])).toBe(0)
    expect(await s.restoreAssets('sv1', [])).toBe(0)
    expect(await s.removeAssets('sv1', [])).toEqual({ unpinned: 0, excluded: 0 })
  })

  it('clears the flag after a failure so the next write is not locked out', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    pinSmartViewAssets.mockRejectedValue(new Error('nope'))
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await expect(s.pinAssets('sv1', ['x'])).rejects.toThrow()
    expect(s.assetBusy).toBe(false)
    spy.mockRestore()
  })
})

describe('loadExcluded', () => {
  it('normalises the bare array through assetToPhoto', async () => {
    getSmartViewExcluded.mockResolvedValue([{ id: 'a1', originalName: 'a.jpg' }])
    const s = usePhotosSmartViews()
    await s.loadExcluded('sv1')
    expect(s.excluded).toHaveLength(1)
    expect(s.excluded[0].id).toBe('a1')
  })

  it('leaves the list empty and does not throw when the very first request fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    getSmartViewExcluded.mockRejectedValue(new Error('nope'))
    const s = usePhotosSmartViews()
    await s.loadExcluded('sv1')
    expect(s.excluded).toEqual([])
    expect(s.excludedLoading).toBe(false)
    spy.mockRestore()
  })

  // Final review, finding 6: the list used to be blanked unconditionally before awaiting, so
  // a transient 500 on a refetch made the whole "Excluded (N)" band vanish — the user was shown
  // that the exclusions were gone while they were still on the server, with no error anywhere.
  // A refetch of the same view now keeps what is on screen until a newer list actually lands.
  it('keeps the loaded list when a refetch of the same view fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    getSmartViewExcluded.mockResolvedValueOnce([{ id: 'a1' }, { id: 'a2' }])
    const s = usePhotosSmartViews()
    await s.loadExcluded('sv1')
    expect(s.excluded).toHaveLength(2)

    getSmartViewExcluded.mockRejectedValueOnce(new Error('boom'))
    await s.loadExcluded('sv1')

    expect(s.excluded.map((p) => String(p.id))).toEqual(['a1', 'a2'])
    expect(s.excludedLoading).toBe(false)
    spy.mockRestore()
  })

  // The other half of the same rule: a *different* view must still blank before awaiting,
  // or view A's exclusions sit on screen under view B's heading while B loads.
  it('blanks the band when the view changes, even before the new list arrives', async () => {
    getSmartViewExcluded.mockResolvedValueOnce([{ id: 'a1' }])
    const s = usePhotosSmartViews()
    await s.loadExcluded('sv1')
    expect(s.excluded).toHaveLength(1)

    let release: (v: unknown) => void = () => {}
    getSmartViewExcluded.mockImplementationOnce(() => new Promise((r) => { release = r }))
    const p = s.loadExcluded('sv2')
    expect(s.excluded).toEqual([]) // blanked immediately, not after the await
    release([{ id: 'b1' }])
    await p
    expect(s.excluded.map((p2) => String(p2.id))).toEqual(['b1'])
  })

  it('carries a staleness guard: when two loads interleave, the later one wins', async () => {
    let resolveA: (v: unknown) => void = () => {}
    getSmartViewExcluded.mockImplementationOnce(() => new Promise((r) => { resolveA = r }))
    getSmartViewExcluded.mockResolvedValueOnce([{ id: 'second' }])

    const s = usePhotosSmartViews()
    const pA = s.loadExcluded('sv1')   // fired first, left hanging
    const pB = s.loadExcluded('sv2')   // fired second, resolves immediately
    await pB
    resolveA([{ id: 'first' }])        // the first one lands late
    await pA

    expect(s.excluded.map((p) => String(p.id))).toEqual(['second'])
  })
})
