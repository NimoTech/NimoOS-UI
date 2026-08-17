import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      recordView: vi.fn(() => Promise.resolve()),
      getAsset: vi.fn(() => Promise.resolve({ id: 'x' })),
      getAssetOcr: vi.fn(() => Promise.resolve({ lines: [] })),
      listFavoriteIds: vi.fn(() => Promise.resolve([])),
      favorite: vi.fn(() => Promise.resolve()),
      unfavorite: vi.fn(() => Promise.resolve()),
    },
  },
}))
import { service } from '@nimotech/nimoos-service'
import { useLightbox } from '../useLightbox'
import { usePhotosFavorites } from '../../stores/favorites'
const P = (id: string, extra: Record<string, unknown> = {}) => ({ id, isVideo: false, ...extra }) as any

describe('useLightbox open/close/pagination', () => {
  let back: any, push: any
  beforeEach(() => {
    setActivePinia(createPinia())
    useLightbox().__resetForTest()
    back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    push = vi.spyOn(window.history, 'pushState')
  })
  afterEach(() => vi.restoreAllMocks())

  it('openAt opens, positions current item, pushState once, delegates to store.recordView (throttled)', () => {
    const fav = usePhotosFavorites()
    const spy = vi.spyOn(fav, 'recordView')
    const lb = useLightbox()
    lb.openAt(P('b'), [P('a'), P('b'), P('c')])
    expect(lb.open.value).toBe(true)
    expect(lb.index.value).toBe(1)
    expect(lb.current.value?.id).toBe('b')
    expect(push).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('b')
  })
  it('empty list degrades to single item', () => {
    const lb = useLightbox(); lb.openAt(P('x'), [])
    expect(lb.list.value.map((p) => p.id)).toEqual(['x'])
  })
  it('prev/next boundary clamping, does not pushState', () => {
    const lb = useLightbox(); lb.openAt(P('a'), [P('a'), P('b')])
    push.mockClear()
    lb.prev(); expect(lb.index.value).toBe(0) // already at head, no move
    lb.next(); expect(lb.index.value).toBe(1)
    lb.next(); expect(lb.index.value).toBe(1) // already at tail
    expect(push).not.toHaveBeenCalled()
  })
  it('close resets and history.back once', () => {
    const lb = useLightbox(); lb.openAt(P('a'), [P('a')])
    lb.close()
    expect(lb.open.value).toBe(false)
    expect(back).toHaveBeenCalledTimes(1)
  })
  it('popstate (back button) only closes lightbox, does not call history.back', () => {
    const lb = useLightbox(); lb.openAt(P('a'), [P('a')])
    back.mockClear()
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(lb.open.value).toBe(false)
    expect(back).not.toHaveBeenCalled()
  })
  it('video startMs only retained when isVideo && >0', () => {
    const lb = useLightbox()
    lb.openAt(P('v', { isVideo: true }), [], 4200); expect(lb.startMs.value).toBe(4200)
    lb.__resetForTest(); lb.openAt(P('p'), [], 4200); expect(lb.startMs.value).toBe(0)
  })
  it('query trim stored in searchQuery', () => {
    const lb = useLightbox(); lb.openAt(P('a'), [], 0, '  hello  ')
    expect(lb.searchQuery.value).toBe('hello')
  })

  describe('goTo jump', () => {
    it('in-range jump succeeds: goTo(2) with three-item list → index=2, current is third item', () => {
      const lb = useLightbox()
      lb.openAt(P('a'), [P('a'), P('b'), P('c')])
      push.mockClear()
      lb.goTo(2)
      expect(lb.index.value).toBe(2)
      expect(lb.current.value?.id).toBe('c')
      expect(push).not.toHaveBeenCalled()
    })
    it('out-of-bounds below goTo(-1) → index unchanged', () => {
      const lb = useLightbox()
      lb.openAt(P('a'), [P('a'), P('b')])
      push.mockClear()
      lb.goTo(-1)
      expect(lb.index.value).toBe(0)
      expect(push).not.toHaveBeenCalled()
    })
    it('out-of-bounds above goTo(99) → index unchanged', () => {
      const lb = useLightbox()
      lb.openAt(P('a'), [P('a'), P('b'), P('c')])
      push.mockClear()
      lb.goTo(99)
      expect(lb.index.value).toBe(0) // still at position after openAt
      expect(push).not.toHaveBeenCalled()
    })
  })
})

describe('useLightbox hydration + favorites', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useLightbox().__resetForTest()
    vi.spyOn(window.history, 'back').mockImplementation(() => {})
    vi.spyOn(window.history, 'pushState').mockImplementation(() => {})
    vi.mocked(service.photos.getAsset).mockReset().mockResolvedValue({ id: 'x' } as any)
    vi.mocked(service.photos.getAssetOcr).mockReset().mockResolvedValue({ lines: [] } as any)
    vi.mocked(service.photos.listFavoriteIds).mockReset().mockResolvedValue([])
    vi.mocked(service.photos.favorite).mockReset().mockResolvedValue(undefined as any)
    vi.mocked(service.photos.unfavorite).mockReset().mockResolvedValue(undefined as any)
  })
  afterEach(() => vi.restoreAllMocks())

  it('after openAt, detail initially equals current item, merges after getAsset arrives', async () => {
    vi.mocked(service.photos.getAsset).mockResolvedValue({ id: 'b', make: 'Nikon' } as any)
    const lb = useLightbox()
    lb.openAt(P('b'), [P('a'), P('b'), P('c')])
    // synchronously (before await resolves) detail already mirrors current
    expect(lb.detail.value?.id).toBe('b')
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(lb.detail.value?.camera).toBe('Nikon')
  })

  it('stale getAsset results dropped by seq guard on pagination (resolve stale first, current is new item → detail not overwritten by stale)', async () => {
    let resolveFirst: (v: any) => void = () => {}
    let resolveSecond: (v: any) => void = () => {}
    const firstPromise = new Promise((res) => { resolveFirst = res })
    const secondPromise = new Promise((res) => { resolveSecond = res })
    vi.mocked(service.photos.getAsset)
      .mockImplementationOnce(() => firstPromise as any)
      .mockImplementationOnce(() => secondPromise as any)

    const lb = useLightbox()
    lb.openAt(P('a'), [P('a'), P('b'), P('c')]) // issues first (slow) getAsset for 'a'
    lb.next() // issues second (fast) getAsset for 'b'

    // resolve the newer (second) call first, then the older (first) call after
    resolveSecond({ id: 'b', make: 'Sony' })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(lb.detail.value?.id).toBe('b')

    resolveFirst({ id: 'a', make: 'Nikon' }) // stale — must be dropped by seq guard
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(lb.detail.value?.id).toBe('b')
    expect(lb.detail.value?.camera).toBe('Sony')
  })

  it('empty searchQuery does not call getAssetOcr; non-empty and non-video calls it', async () => {
    const lb = useLightbox()
    lb.openAt(P('a'), [P('a')])
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(service.photos.getAssetOcr).not.toHaveBeenCalled()
    expect(lb.ocrLines.value).toEqual([])

    vi.mocked(service.photos.getAssetOcr).mockResolvedValue({ lines: [{ box: [1, 2, 3, 4] }] } as any)
    lb.__resetForTest()
    lb.openAt(P('a'), [P('a')], 0, 'hello')
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(service.photos.getAssetOcr).toHaveBeenCalledWith('a', 'hello')
    expect(lb.ocrLines.value).toEqual([{ box: [1, 2, 3, 4] }])

    vi.mocked(service.photos.getAssetOcr).mockClear()
    lb.__resetForTest()
    lb.openAt(P('v', { isVideo: true }), [P('v', { isVideo: true })], 0, 'hello')
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(service.photos.getAssetOcr).not.toHaveBeenCalled()
  })

  it('reconcileFav seeds favIds, isFav reflects current item', async () => {
    vi.mocked(service.photos.listFavoriteIds).mockResolvedValue(['a', 42])
    const lb = useLightbox()
    lb.openAt(P('a'), [P('a'), P(String(42))])
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(lb.isFav.value).toBe(true)
    lb.goTo(1)
    expect(lb.isFav.value).toBe(true)
  })

  it('toggleFav delegates to store.toggle', async () => {
    const fav = usePhotosFavorites()
    const spy = vi.spyOn(fav, 'toggle').mockResolvedValue()
    const lb = useLightbox()
    lb.openAt(P('a'), [P('a')])
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    await lb.toggleFav()
    expect(spy).toHaveBeenCalledWith('a')
  })

  it('toggleFav optimistically flips and calls favorite/unfavorite; rolls back on failure', async () => {
    vi.mocked(service.photos.listFavoriteIds).mockResolvedValue(['a'])
    const lb = useLightbox()
    lb.openAt(P('a'), [P('a')])
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(lb.isFav.value).toBe(true)

    vi.mocked(service.photos.unfavorite).mockRejectedValueOnce(new Error('boom'))
    await lb.toggleFav()
    expect(lb.isFav.value).toBe(true) // rolled back after rejection

    vi.mocked(service.photos.unfavorite).mockResolvedValue(undefined as any)
    await lb.toggleFav()
    expect(service.photos.unfavorite).toHaveBeenCalledWith('a')
    expect(lb.isFav.value).toBe(false)

    vi.mocked(service.photos.favorite).mockResolvedValue(undefined as any)
    await lb.toggleFav()
    expect(service.photos.favorite).toHaveBeenCalledWith('a')
    expect(lb.isFav.value).toBe(true)
  })

  it('seq guard isolates same-id re-visit race (seq isolation mechanism): openAt a → next b → prev a(same id!) → resolve new a then stale a, detail reflects new', async () => {
    // Goal: use two getAsset calls with same id to isolate seq guard.
    // Scenario: openAt(a) [call 0, pending] → next() [call 1, pending] → prev() [call 2, pending, same id 'a']
    // then resolve call 2(new) first → detail should be 'NEW', then resolve call 0(stale) → detail should still be 'NEW'
    // (cannot use id check to distinguish, since both have id='a'; must rely on seq mechanism to drop call 0)

    const deferreds: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = []
    let callCount = 0
    vi.mocked(service.photos.getAsset).mockImplementation(() => {
      const idx = callCount++
      let resolve: (v: any) => void = () => {}
      let reject: (e: any) => void = () => {}
      const promise = new Promise((res, rej) => {
        resolve = res
        reject = rej
      })
      deferreds[idx] = { resolve, reject }
      return promise as any
    })

    const lb = useLightbox()
    // call 0: openAt triggers hydrateDetail, starts getAsset('a'), remains pending
    lb.openAt(P('a'), [P('a'), P('b'), P('c')])
    // call 1: next triggers hydrateDetail, starts getAsset('b')
    lb.next()
    // call 2: prev triggers hydrateDetail, starts getAsset('a') — second call with same id!
    lb.prev()

    expect(lb.current.value?.id).toBe('a')

    // resolve call 2(newest) first with status='NEW' (status field preserved in assetToPhoto)
    deferreds[2].resolve({ id: 'a', status: 'NEW' } as any)
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(lb.detail.value?.id).toBe('a')
    expect(lb.detail.value?.status).toBe('NEW')

    // then resolve call 0(oldest) with status='STALE'
    // if seq check works, this result should be dropped; detail should still be 'NEW'
    deferreds[0].resolve({ id: 'a', status: 'STALE' } as any)
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()

    // critical assertion: detail still is NEW, will not be overwritten by STALE
    // (id check cannot distinguish, since both have id='a'; only seq check can drop call 0)
    expect(lb.detail.value?.id).toBe('a')
    expect(lb.detail.value?.status).toBe('NEW')
  })
})
