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

  it('reconcileFavIds 播种 favIds(String 归一)、isFav 按值比较', async () => {
    const s = usePhotosFavorites()
    await s.reconcileFavIds()
    expect(s.isFav('a')).toBe(true)
    expect(s.isFav('zzz')).toBe(false)
  })
  it('reconcileFavIds 容忍 null(?? [])', async () => {
    ;(service.photos.listFavoriteIds as any).mockResolvedValueOnce(null)
    const s = usePhotosFavorites()
    await s.reconcileFavIds()
    expect(s.favIds.size).toBe(0)
  })
  it('toggle 乐观翻转 + 成功后失效 favoritesList', async () => {
    const s = usePhotosFavorites()
    await s.fetchFavorites()
    expect(s.favoritesLoaded).toBe(true)
    await s.toggle('a')
    expect(s.isFav('a')).toBe(true)
    expect(service.photos.favorite).toHaveBeenCalledWith('a')
    expect(s.favoritesLoaded).toBe(false) // 失效,下次重取
  })
  it('toggle 失败回滚', async () => {
    ;(service.photos.favorite as any).mockRejectedValueOnce(new Error('x'))
    const s = usePhotosFavorites()
    await s.toggle('new1')
    expect(s.isFav('new1')).toBe(false) // 回滚
  })
  it('recordView 60s 节流:窗口内同 id 只上报一次', () => {
    vi.useFakeTimers(); vi.setSystemTime(0)
    const s = usePhotosFavorites()
    s.recordView('a'); s.recordView('a')
    expect(service.photos.recordView).toHaveBeenCalledTimes(1)
    vi.setSystemTime(60_001)
    s.recordView('a')
    expect(service.photos.recordView).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
  it('recordView 节流边界:恰好 60_000ms 时应上报(< 而非 <=)', () => {
    vi.useFakeTimers(); vi.setSystemTime(0)
    const s = usePhotosFavorites()
    s.recordView('b')
    expect(service.photos.recordView).toHaveBeenCalledTimes(1)
    vi.setSystemTime(60_000) // 60000 - 0 = 60000, not < 60000 → should report
    s.recordView('b')
    expect(service.photos.recordView).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
  it('fetchFavorites 映射 assetToPhoto + favoritesMonths 分组', async () => {
    const s = usePhotosFavorites()
    await s.fetchFavorites()
    expect(s.favoritesList?.length).toBe(1)
    expect(s.favoritesMonths[0].key).toBe('2026-05')
  })
  it('fetchFavorites 失败:favoritesList 置空但 favoritesLoaded 保持 false(与"确认零收藏"可区分,留给视图重试)', async () => {
    ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('network'))
    const s = usePhotosFavorites()
    await s.fetchFavorites()
    expect(s.favoritesList).toEqual([])
    expect(s.favoritesLoaded).toBe(false)
  })
  // Task 9(P3 遗留收口):新增 loadError 标志,语义与 favoritesLoaded 完全独立——
  // 失败时 loadError=true 但 favoritesLoaded 仍保持 false(两者不可合并/不可互相替代)。
  it('fetchFavorites 失败:loadError 置真,favoritesLoaded 保持假(两者语义不同)', async () => {
    ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('network'))
    const s = usePhotosFavorites()
    await s.fetchFavorites()
    expect(s.loadError).toBe(true)
    expect(s.favoritesLoaded).toBe(false)
  })
  it('重试成功后 loadError 归假', async () => {
    ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('network'))
    const s = usePhotosFavorites()
    await s.fetchFavorites()
    expect(s.loadError).toBe(true)
    await s.fetchFavorites() // 重试:这次成功(mockRejectedValueOnce 只吃一次)
    expect(s.loadError).toBe(false)
    expect(s.favoritesLoaded).toBe(true)
  })
  it('成功路径 loadError 保持/归假(不会被残留的上次失败污染)', async () => {
    const s = usePhotosFavorites()
    await s.fetchFavorites()
    expect(s.loadError).toBe(false)
  })
  // 评审 Important 1 补的挡门用例:重试本身也失败——loadError 必须仍然是真(不能被"进入
  // 重试"这件事本身清空),favoritesList/favoritesLoaded 的状态也要与"一次都没成功过"一致。
  it('reject → retry → reject:结束后 loadError 仍为真,favoritesList/favoritesLoaded 与未成功过一致', async () => {
    ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('e1'))
    const s = usePhotosFavorites()
    await s.fetchFavorites()
    expect(s.loadError).toBe(true)

    ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('e2'))
    await s.fetchFavorites() // 重试,仍失败
    expect(s.loadError).toBe(true)
    expect(s.favoritesList).toEqual([])
    expect(s.favoritesLoaded).toBe(false)
  })
  it('exportZip 走 exportFavoritesUrl', () => {
    const s = usePhotosFavorites()
    s.exportZip()
    expect(service.photos.exportFavoritesUrl).toHaveBeenCalled()
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

    it('toggling a favorite resets the cursor so the next fetch starts from page one', async () => {
      const s = usePhotosFavorites()
      ;(service.photos.listFavorites as any).mockResolvedValueOnce(page(500))
      await s.fetchFavorites()
      expect(s.favoritesExhausted).toBe(false)
      await s.toggle('f0')
      // fetchFavorites always asks offset 0 regardless, but exhaustion must be reset
      // too so a stale "exhausted" flag doesn't hide the load-more button on next entry.
      expect(s.favoritesExhausted).toBe(false)
      ;(service.photos.listFavorites as any).mockResolvedValueOnce(page(500))
      await s.fetchFavorites()
      expect(service.photos.listFavorites).toHaveBeenLastCalledWith(500, 0)
    })
  })
})
