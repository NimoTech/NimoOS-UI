import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: {
    listFavoriteIds: vi.fn(() => Promise.resolve(['a', 'b'])),
    listFavorites: vi.fn(() => Promise.resolve([{ id: 'a', takenAt: '2026-05-01T00:00:00Z' }])),
    favorite: vi.fn(() => Promise.resolve()),
    unfavorite: vi.fn(() => Promise.resolve()),
    recordView: vi.fn(() => Promise.resolve()),
    exportFavoritesUrl: vi.fn(() => '/v1/photos/favorites/export?token=T1'),
    topFavorites: vi.fn(() => Promise.resolve([])),
  } },
}))
import { service } from '@nimotech/nimoos-service'
import { usePhotosFavorites } from '../favorites'

describe('photosFavorites store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // vi.restoreAllMocks() (afterEach) doesn't clear call counts on plain
    // vi.fn() mocks (only spies with an original impl to restore to) — clear
    // explicitly so call-count assertions (e.g. recordView throttling) don't
    // depend on test execution order.
    vi.clearAllMocks()
  })
  afterEach(() => vi.restoreAllMocks())

  it('reconcileFavIds seeds favIds (String normalized); isFav compares by value', async () => {
    const s = usePhotosFavorites()
    await s.reconcileFavIds()
    expect(s.isFav('a')).toBe(true)
    expect(s.isFav('zzz')).toBe(false)
  })
  it('reconcileFavIds tolerates null (?? [])', async () => {
    ;(service.photos.listFavoriteIds as any).mockResolvedValueOnce(null)
    const s = usePhotosFavorites()
    await s.reconcileFavIds()
    expect(s.favIds.size).toBe(0)
  })
  it('toggle flips optimistically + invalidates favoritesList on success', async () => {
    const s = usePhotosFavorites()
    await s.fetchFavorites()
    expect(s.favoritesLoaded).toBe(true)
    await s.toggle('a')
    expect(s.isFav('a')).toBe(true)
    expect(service.photos.favorite).toHaveBeenCalledWith('a')
    expect(s.favoritesLoaded).toBe(false) // invalidated, refetched next time
  })
  it('toggle rolls back on failure', async () => {
    ;(service.photos.favorite as any).mockRejectedValueOnce(new Error('x'))
    const s = usePhotosFavorites()
    await s.toggle('new1')
    expect(s.isFav('new1')).toBe(false) // rolled back
  })
  it('recordView 60s throttle: the same id within the window is only reported once', () => {
    vi.useFakeTimers(); vi.setSystemTime(0)
    const s = usePhotosFavorites()
    s.recordView('a'); s.recordView('a')
    expect(service.photos.recordView).toHaveBeenCalledTimes(1)
    vi.setSystemTime(60_001)
    s.recordView('a')
    expect(service.photos.recordView).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
  it('recordView throttle boundary: should report at exactly 60_000ms (< not <=)', () => {
    vi.useFakeTimers(); vi.setSystemTime(0)
    const s = usePhotosFavorites()
    s.recordView('b')
    expect(service.photos.recordView).toHaveBeenCalledTimes(1)
    vi.setSystemTime(60_000) // 60000 - 0 = 60000, not < 60000 -> should report
    s.recordView('b')
    expect(service.photos.recordView).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
  it('fetchFavorites maps through assetToPhoto + groups favoritesMonths', async () => {
    const s = usePhotosFavorites()
    await s.fetchFavorites()
    expect(s.favoritesList?.length).toBe(1)
    expect(s.favoritesMonths[0].key).toBe('2026-05')
  })
  it('fetchFavorites failure: favoritesList is cleared but favoritesLoaded stays false (distinguishable from "confirmed zero favorites", left for the view to retry)', async () => {
    ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('network'))
    const s = usePhotosFavorites()
    await s.fetchFavorites()
    expect(s.favoritesList).toEqual([])
    expect(s.favoritesLoaded).toBe(false)
  })
  // Task 9 (P3 leftover, closed out): added a loadError flag whose semantics are entirely
  // independent of favoritesLoaded -- on failure loadError=true while favoritesLoaded stays
  // false (the two must not be merged or substituted for each other).
  it('fetchFavorites failure: loadError becomes true, favoritesLoaded stays false (they have different semantics)', async () => {
    ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('network'))
    const s = usePhotosFavorites()
    await s.fetchFavorites()
    expect(s.loadError).toBe(true)
    expect(s.favoritesLoaded).toBe(false)
  })
  it('loadError becomes false again after a successful retry', async () => {
    ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('network'))
    const s = usePhotosFavorites()
    await s.fetchFavorites()
    expect(s.loadError).toBe(true)
    await s.fetchFavorites() // retry: succeeds this time (mockRejectedValueOnce only fires once)
    expect(s.loadError).toBe(false)
    expect(s.favoritesLoaded).toBe(true)
  })
  it('the success path keeps/resets loadError to false (not polluted by a leftover previous failure)', async () => {
    const s = usePhotosFavorites()
    await s.fetchFavorites()
    expect(s.loadError).toBe(false)
  })
  // Review Important 1's added guard case: the retry itself also fails -- loadError must
  // still be true (must not be cleared merely by "entering a retry"), and
  // favoritesList/favoritesLoaded's state must also be consistent with "never succeeded once".
  it('reject -> retry -> reject: loadError is still true afterward, favoritesList/favoritesLoaded are consistent with never having succeeded', async () => {
    ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('e1'))
    const s = usePhotosFavorites()
    await s.fetchFavorites()
    expect(s.loadError).toBe(true)

    ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('e2'))
    await s.fetchFavorites() // retry, still fails
    expect(s.loadError).toBe(true)
    expect(s.favoritesList).toEqual([])
    expect(s.favoritesLoaded).toBe(false)
  })
  it('exportZip goes through exportFavoritesUrl', () => {
    const s = usePhotosFavorites()
    s.exportZip()
    expect(service.photos.exportFavoritesUrl).toHaveBeenCalled()
  })

  // Task 4 (Plan H): server-ranked "most favorited" top-5 list (GET /favorites/top),
  // independent from the main favoritesList/favoritesLoaded pair -- see the comment on
  // fetchTopFavorites in favorites.ts for why it must not be conflated with them.
  it('fetchTopFavorites loads the server-ranked top-5 list and marks itself loaded', async () => {
    ;(service.photos.topFavorites as any).mockResolvedValueOnce([{ id: 'p1', mimeType: 'image/jpeg' }])
    const fav = usePhotosFavorites()
    expect(fav.topFavoritesLoaded).toBe(false)
    await fav.fetchTopFavorites()
    expect(service.photos.topFavorites).toHaveBeenCalledWith(5)
    expect(fav.topFavorites).toHaveLength(1)
    expect(fav.topFavorites[0]!.id).toBe('p1')
    expect(fav.topFavoritesLoaded).toBe(true)
  })

  it('fetchTopFavorites tolerates a rejected call (leaves topFavorites empty, does not throw)', async () => {
    ;(service.photos.topFavorites as any).mockRejectedValueOnce(new Error('boom'))
    const fav = usePhotosFavorites()
    await expect(fav.fetchTopFavorites()).resolves.toBeUndefined()
    expect(fav.topFavorites).toEqual([])
  })

  // Task 11 (SP15-P3): NimoOS-Photos#54 turned an absent limit from "everything" into
  // 500, so the favorites list has to be paged or it silently truncates.
  describe('pagination (Task 11)', () => {
    const A = (id: string) => ({ id, mimeType: 'image/jpeg' })
    const page = (n: number, from = 0) => Array.from({ length: n }, (_, i) => A(`f${from + i}`))

    it('fetchFavorites asks for one page and reports exhaustion on a short page', async () => {
      const s = usePhotosFavorites()
      ;(service.photos.listFavorites as any).mockResolvedValueOnce(page(3))
      await s.fetchFavorites()
      expect(service.photos.listFavorites).toHaveBeenCalledWith(500, 0)
      expect(s.favoritesExhausted).toBe(true)
    })

    it('loadMoreFavorites appends the next page and advances the offset', async () => {
      const s = usePhotosFavorites()
      ;(service.photos.listFavorites as any).mockResolvedValueOnce(page(500))
      await s.fetchFavorites()
      expect(s.favoritesExhausted).toBe(false)
      ;(service.photos.listFavorites as any).mockResolvedValueOnce(page(2, 500))
      await s.loadMoreFavorites()
      expect(service.photos.listFavorites).toHaveBeenLastCalledWith(500, 500)
      expect(s.favoritesList).toHaveLength(502)
      expect(s.favoritesExhausted).toBe(true)
    })

    it('refuses to page past the end', async () => {
      const s = usePhotosFavorites()
      ;(service.photos.listFavorites as any).mockResolvedValueOnce(page(3))
      await s.fetchFavorites()
      await s.loadMoreFavorites()
      expect(service.photos.listFavorites).toHaveBeenCalledTimes(1)
    })

    it('does not run two loadMore requests at once', async () => {
      const s = usePhotosFavorites()
      ;(service.photos.listFavorites as any).mockResolvedValueOnce(page(500))
      await s.fetchFavorites()
      ;(service.photos.listFavorites as any).mockResolvedValue(page(500, 500))
      await Promise.all([s.loadMoreFavorites(), s.loadMoreFavorites()])
      // first page (fetchFavorites) + exactly one loadMore — the second concurrent
      // call must be a no-op, not a second in-flight request.
      expect(service.photos.listFavorites).toHaveBeenCalledTimes(2)
    })

    it('discards a stale in-flight page after a refresh (interleaved)', async () => {
      const s = usePhotosFavorites()
      ;(service.photos.listFavorites as any).mockResolvedValueOnce(page(500))
      await s.fetchFavorites()
      let release: (v: unknown) => void = () => {}
      ;(service.photos.listFavorites as any).mockImplementationOnce(
        () => new Promise((r) => { release = r }),
      )
      const slow = s.loadMoreFavorites()
      ;(service.photos.listFavorites as any).mockResolvedValueOnce(page(1))
      await s.fetchFavorites() // generation bumps here
      release(page(500, 500)) // the slow page comes back afterwards
      await slow
      expect(s.favoritesList).toHaveLength(1)
      expect(s.loadingMore).toBe(false)
    })

    it('resets the cursor on a failed page so the next attempt does not skip rows', async () => {
      const s = usePhotosFavorites()
      ;(service.photos.listFavorites as any).mockResolvedValueOnce(page(500))
      await s.fetchFavorites()
      ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('boom'))
      await s.loadMoreFavorites()
      expect(s.loadingMore).toBe(false)
      ;(service.photos.listFavorites as any).mockResolvedValueOnce(page(1, 500))
      await s.loadMoreFavorites()
      expect(service.photos.listFavorites).toHaveBeenLastCalledWith(500, 500)
    })

    it('reports the exact total from the id list, and the loaded length before ids land', async () => {
      const s = usePhotosFavorites()
      ;(service.photos.listFavorites as any).mockResolvedValueOnce(page(500))
      await s.fetchFavorites()
      expect(s.favoritesTotal).toBe(500) // favIds not loaded yet: no flash of 0
      ;(service.photos.listFavoriteIds as any).mockResolvedValueOnce(
        Array.from({ length: 1234 }, (_, i) => `f${i}`),
      )
      await s.reconcileFavIds()
      expect(s.favoritesTotal).toBe(1234)
    })

    // Whole-branch review, Important 4: this used to assert that toggle() itself
    // reset the cursor/exhaustion flag. It does not any more, and it never needed
    // to — fetchFavorites() rewinds both unconditionally on every path, which is
    // what this test now pins. (The old version could not fail either way: its
    // first page was a full 500 rows, so `favoritesExhausted` was already false
    // before the toggle.)
    it('a refresh after a toggle starts from page one and re-decides exhaustion itself', async () => {
      const s = usePhotosFavorites()
      ;(service.photos.listFavorites as any).mockResolvedValueOnce(page(500))
      await s.fetchFavorites()
      await s.toggle('f0')
      ;(service.photos.listFavorites as any).mockResolvedValueOnce(page(3))
      await s.fetchFavorites()
      expect(service.photos.listFavorites).toHaveBeenLastCalledWith(500, 0)
      expect(s.favoritesList).toHaveLength(3)
      expect(s.favoritesExhausted).toBe(true)
    })

    // Whole-branch review, Important 4: the defect this replaces. With fewer than one
    // page of favorites the list is complete, and starring a photo must not make it
    // advertise itself as partial — the view's subset hint and "Load more" button are
    // both `v-if="!favoritesExhausted"`, and pressing that button re-requested (500, 0)
    // and appended a second copy of every row.
    it('a toggle on a complete list leaves it complete, with nothing more to load', async () => {
      const s = usePhotosFavorites()
      ;(service.photos.listFavorites as any).mockResolvedValueOnce(page(3))
      await s.fetchFavorites()
      expect(s.favoritesExhausted).toBe(true)

      await s.toggle('f0')
      expect(s.favoritesExhausted).toBe(true) // no bogus "Load more" / subset hint

      // Even if something did press it, the store refuses to page past the end, so no
      // duplicate rows can appear.
      ;(service.photos.listFavorites as any).mockClear()
      await s.loadMoreFavorites()
      expect(service.photos.listFavorites).not.toHaveBeenCalled()
      expect(s.favoritesList).toHaveLength(3)
    })

    // Review fix (Important 2): toggle()'s success path did not bump _generation, which a
    // purely sequential test cannot see. Interleave a slow loadMoreFavorites() with a
    // toggle() that lands first: the stale page must be dropped whole, or the list
    // silently duplicates rows.
    //
    // Whole-branch review, Important 4: toggle() no longer rewinds the cursor, so the tail
    // of this test now pins the cursor staying WHERE THE LIST ACTUALLY ENDS (page two)
    // instead of the rewound zero. The property under test is unchanged: the dropped page
    // must not have moved the cursor by its own row count.
    it('a toggle landing while loadMoreFavorites is in flight does not corrupt the cursor', async () => {
      const s = usePhotosFavorites()
      ;(service.photos.listFavorites as any).mockResolvedValueOnce(page(500))
      await s.fetchFavorites()

      let release: (v: unknown) => void = () => {}
      ;(service.photos.listFavorites as any).mockImplementationOnce(
        () => new Promise((r) => { release = r }),
      )
      const slow = s.loadMoreFavorites() // captures generation before toggle() bumps it

      await s.toggle('f0') // success: resets _offset/favoritesExhausted AND _generation

      release(page(500, 500)) // the slow page's response lands after the toggle
      await slow

      // The stale page must have been dropped whole: still exactly the first page, not
      // 1000 rows from a duplicate append.
      expect(s.favoritesList).toHaveLength(500)
      expect(s.loadingMore).toBe(false)

      // The cursor must not have been advanced by the stale page's `_offset +=
      // rows.length` — the next load-more asks for the page that follows the 500 rows the
      // list actually holds, not the 1000 the bug would have produced.
      ;(service.photos.listFavorites as any).mockResolvedValueOnce(page(1))
      await s.loadMoreFavorites()
      expect(service.photos.listFavorites).toHaveBeenLastCalledWith(500, 500)
    })

    // Review fix round 2: `loadingMore` must have a call-scoped owner, separate from
    // `_generation`. fetchFavorites() forces `loadingMore` false unconditionally (correct:
    // it is a full reset), which lets a *second* loadMoreFavorites() start and claim the
    // flag before the *first* one (still in flight from before the reset) settles. If the
    // first call's `finally` cleared `loadingMore` unconditionally — or gated only on
    // `_generation`, which by then both calls could share — it would clobber the second
    // call's flag while that call is genuinely still in flight, re-enabling the button mid
    // request. `_loadMoreSeq` gives each call its own claim so only the call that still owns
    // the flag may clear it.
    it('a delete-triggered fetchFavorites landing mid-flight does not let the stale loadMoreFavorites call clear a newer one\'s loadingMore', async () => {
      const s = usePhotosFavorites()
      ;(service.photos.listFavorites as any).mockResolvedValueOnce(page(500))
      await s.fetchFavorites()

      // Call A: load-more starts, held open (simulates the network still in flight when
      // the user deletes a favorited photo).
      let releaseA: (v: unknown) => void = () => {}
      ;(service.photos.listFavorites as any).mockImplementationOnce(
        () => new Promise((r) => { releaseA = r }),
      )
      const a = s.loadMoreFavorites()

      // The delete refreshes the list via fetchFavorites(), completing fully while A is
      // still pending — this is what onLightboxDelete/onBatchDelete do today.
      ;(service.photos.listFavorites as any).mockResolvedValueOnce(page(500, 500))
      await s.fetchFavorites()

      // The button is enabled again (fetchFavorites forced loadingMore false); the user
      // clicks it, starting call B, itself held open too.
      let releaseB: (v: unknown) => void = () => {}
      ;(service.photos.listFavorites as any).mockImplementationOnce(
        () => new Promise((r) => { releaseB = r }),
      )
      const b = s.loadMoreFavorites()
      expect(s.loadingMore).toBe(true) // B owns the flag now

      // A's stale page finally lands. It must be dropped (generation mismatch) — and,
      // the point of this test, must NOT clear loadingMore out from under B.
      releaseA(page(1, 900))
      await a
      expect(s.loadingMore).toBe(true) // still B's flag, not reset by stale A

      // Clean up: let B settle too, restoring the normal end state.
      releaseB(page(1, 1000))
      await b
      expect(s.loadingMore).toBe(false)
    })
  })
})
