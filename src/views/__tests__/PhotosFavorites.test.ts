// Task 8 (SP7-P3): PhotosFavorites.vue —— 挂 Pinia + i18n + router stub,mock 共享包
// 收藏方法(参照 favorites.test.ts 的 mock 形状 + Photos.lightbox.test.ts/
// Photos.integration.test.ts 的挂载套路)。覆盖 brief 的 5 条测试要点:空态门控、
// 非空渲染网格+导出按钮启用、点导出→exportZip+toast、grid emit open→灯箱翻页集按 tab
// 过滤、灯箱 delete→时间线 store.deleteAssets + fav.fetchFavorites 刷新。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    listFavoriteIds: vi.fn().mockResolvedValue([]),
    listFavorites: vi.fn().mockResolvedValue([]),
    favorite: vi.fn().mockResolvedValue(undefined),
    unfavorite: vi.fn().mockResolvedValue(undefined),
    recordView: vi.fn().mockResolvedValue(undefined),
    exportFavoritesUrl: vi.fn(() => '/v1/photos/favorites/export?token=T1'),
    deleteAsset: vi.fn().mockResolvedValue(undefined),
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
    previewUrl: vi.fn((id: string | number) => `mock://preview/${id}`),
    originalUrl: vi.fn((id: string | number) => `mock://original/${id}`),
    liveUrl: vi.fn((id: string | number) => `mock://live/${id}`),
    spriteUrl: vi.fn((id: string | number) => `mock://sprite/${id}`),
    spriteMeta: vi.fn(),
    getAsset: vi.fn().mockRejectedValue(new Error('no hydrate in test')),
    getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// jsdom 无媒体栈(PhotoLightbox 起播位续播用得到,同 Photos.lightbox.test.ts 的前置)。
;(HTMLMediaElement.prototype as unknown as { play: () => Promise<void> }).play = vi.fn(() => Promise.resolve())
;(HTMLMediaElement.prototype as unknown as { pause: () => void }).pause = vi.fn()

import PhotosFavorites from '../PhotosFavorites.vue'
import { usePhotosFavorites } from '../../photos/stores/favorites'
import { useTimelineStore } from '../../photos/stores/timeline'
import { useToast } from '../../stores/toast'
import { useLightbox } from '../../photos/lightbox/useLightbox'

const lb = useLightbox()

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [{ path: '/photos/favorites', name: 'photos-favorites', component: PhotosFavorites }],
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/photos/favorites')
  await router.isReady()
  const w = mount(PhotosFavorites, { global: { plugins: [i18n, router] } })
  await flushPromises()
  await w.vm.$nextTick()
  return w
}

function photo(id: string, opts: Partial<{ takenAt: string; mimeType: string }> = {}) {
  return {
    id,
    takenAt: opts.takenAt || '2026-07-01T00:00:00Z',
    mimeType: opts.mimeType || 'image/jpeg',
    originalName: `${id}.jpg`,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  svc.photos.listFavoriteIds.mockClear().mockResolvedValue([])
  svc.photos.listFavorites.mockClear().mockResolvedValue([])
  svc.photos.exportFavoritesUrl.mockClear().mockReturnValue('/v1/photos/favorites/export?token=T1')
  svc.photos.deleteAsset.mockClear().mockResolvedValue(undefined)
  svc.photos.recordView.mockClear().mockResolvedValue(undefined)
  lb.__resetForTest()
})

afterEach(() => {
  vi.useRealTimers()
  lb.__resetForTest()
})

describe('PhotosFavorites.vue', () => {
  it('favoritesLoaded 且列表空 → 渲染空态,不渲染 PhotosGrid', async () => {
    const w = await mountView()
    const fav = usePhotosFavorites()
    expect(fav.favoritesLoaded).toBe(true)
    expect(w.find('[data-test="fav-empty"]').exists()).toBe(true)
    expect(w.text()).toContain('暂无收藏')
    expect(w.find('.photos-grid-root').exists()).toBe(false)
    expect(w.find('.fav-export').attributes('disabled')).toBeDefined()
  })

  it('列表非空 → 渲染 PhotosGrid(:months = favoritesMonths),导出按钮启用', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a'), photo('b')])
    const w = await mountView()
    expect(w.find('[data-test="fav-empty"]').exists()).toBe(false)
    expect(w.find('.photos-grid-root').exists()).toBe(true)
    expect(w.findAll('.tile')).toHaveLength(2)
    expect(w.find('.fav-export').attributes('disabled')).toBeUndefined()
  })

  it('点导出按钮 → fav.exportZip 被调 + toast', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a')])
    const w = await mountView()
    const fav = usePhotosFavorites()
    const toast = useToast()
    const exportSpy = vi.spyOn(fav, 'exportZip')
    const showSpy = vi.spyOn(toast, 'show')

    await w.find('.fav-export').trigger('click')
    await w.vm.$nextTick()

    expect(exportSpy).toHaveBeenCalledTimes(1)
    expect(showSpy).toHaveBeenCalledWith(expect.any(String), 4000)
  })

  it('PhotosGrid emit open → 灯箱打开,翻页集为 tab 过滤后收藏集(默认 tab=all,不过滤)', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a'), photo('b', { mimeType: 'video/mp4' }), photo('c')])
    const w = await mountView()

    const tiles = w.findAll('.tile')
    expect(tiles).toHaveLength(3) // 默认 tab='all',全展示(与时间线默认 'photo' 不同)
    await tiles[0].trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(lb.open.value).toBe(true)
    expect(lb.list.value).toHaveLength(3)
    expect(lb.list.value.map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('PhoteLightbox emit delete(id) → store.deleteAssets(["id"]) + fav.fetchFavorites 刷新', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a')])
    const w = await mountView()
    const store = useTimelineStore()
    const fav = usePhotosFavorites()
    const deleteSpy = vi.spyOn(store, 'deleteAssets').mockResolvedValue(1)
    const fetchFavSpy = vi.spyOn(fav, 'fetchFavorites')
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    await w.find('.tile').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    expect(lb.open.value).toBe(true)

    await w.find('.lb-delete').trigger('click')
    await w.vm.$nextTick()
    await w.find('.lb-confirm-ok').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(deleteSpy).toHaveBeenCalledWith(['a'])
    expect(showSpy).toHaveBeenCalledWith(expect.any(String), 4000)
    expect(fetchFavSpy).toHaveBeenCalled()
    expect(lb.open.value).toBe(false) // PhotoLightbox 自己已在 doDelete 里 close
  })
})
