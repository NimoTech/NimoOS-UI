// SP15-P2a-T1: the smart view manual asset actions on the store.
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

describe('loadExcluded', () => {
  it('normalises the bare array through assetToPhoto', async () => {
    getSmartViewExcluded.mockResolvedValue([{ id: 'a1', originalName: 'a.jpg' }])
    const s = usePhotosSmartViews()
    await s.loadExcluded('sv1')
    expect(s.excluded).toHaveLength(1)
    expect(s.excluded[0].id).toBe('a1')
  })

  it('leaves the list empty and does not throw when the request fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    getSmartViewExcluded.mockRejectedValue(new Error('nope'))
    const s = usePhotosSmartViews()
    await s.loadExcluded('sv1')
    expect(s.excluded).toEqual([])
    expect(s.excludedLoading).toBe(false)
    spy.mockRestore()
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
