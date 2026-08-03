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
  it('exportZip 走 exportFavoritesUrl', () => {
    const s = usePhotosFavorites()
    s.exportZip()
    expect(service.photos.exportFavoritesUrl).toHaveBeenCalled()
  })
})
