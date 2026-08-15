// Plan F Task 5: PhotosSearch.vue never mounted a <PhotoLightbox> at all before this task --
// `onOpen`'s `lb.openAt(...)` call fired into a dangling singleton with no overlay component
// anywhere in this page's tree to render it (the exact F8 bug class other host pages already hit
// and fixed once, per acceptance-fix-report.md §F8). This file verifies the mount + wiring fix
// directly against the real `useLightbox()` singleton, the same split PhotosSearch.test.ts's own
// lbMock note points to (mirrors Photos.vue/Photos.lightbox.test.ts's own split: the main test
// file mocks useLightbox to a dumb, permanently-closed stub for its ~100 unrelated assertions;
// this dedicated file uses the real thing to prove the lightbox actually opens).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'
import { useLightbox } from '../../photos/lightbox/useLightbox'

const svc = vi.hoisted(() => ({
  photos: {
    smartSearch: vi.fn().mockResolvedValue([]),
    listPersons: vi.fn().mockResolvedValue({ persons: [], facesIndexedUpTo: null }),
    listAlbums: vi.fn().mockResolvedValue([]),
    getAlbum: vi.fn().mockResolvedValue({ assets: [] }),
    createSmartView: vi.fn(),
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
    personFaceThumbnailUrl: vi.fn((id: string | number, ver: unknown) => `mock://face/${id}/${ver}`),
    originalUrl: vi.fn((id: string | number) => `mock://original/${id}`),
    liveUrl: vi.fn((id: string | number) => `mock://live/${id}`),
    // PhotoLightbox 真实挂载后 openAt/hydrateDetail/reconcileFav 会真的调它们
    // (同 Photos.lightbox.test.ts 的既有 svc mock 清单)。
    recordView: vi.fn().mockResolvedValue(undefined),
    getAsset: vi.fn().mockRejectedValue(new Error('no hydrate in test')),
    getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
    listFavoriteIds: vi.fn().mockResolvedValue([]),
    favorite: vi.fn().mockResolvedValue(undefined),
    unfavorite: vi.fn().mockResolvedValue(undefined),
    batchAddToAlbum: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// jsdom 无媒体栈(PhotoLightbox 起播位续播用得到,同 Photos.lightbox.test.ts 先例)。
;(HTMLMediaElement.prototype as unknown as { play: () => Promise<void> }).play = vi.fn(() => Promise.resolve())
;(HTMLMediaElement.prototype as unknown as { pause: () => void }).pause = vi.fn()

import PhotosSearch from '../PhotosSearch.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter(initial = '/photos/search') {
  const router = createRouter({
    history: createWebHashHistory('/app/'),
    routes: [{ path: '/photos/search', name: 'photos-search', component: PhotosSearch }],
  })
  router.push(initial)
  return router
}

function rawAsset(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    takenAt: '2026-01-10T10:00:00Z',
    mimeType: 'image/jpeg',
    originalName: `${id}.jpg`,
    matchScore: 0.9,
    faces: [] as string[],
    hasOcr: false,
    belowCut: false,
    ...overrides,
  }
}

const lb = useLightbox()

async function mountSearch(path = '/photos/search?q=receipt') {
  const router = makeRouter(path)
  await router.isReady()
  const w = mount(PhotosSearch, { global: { plugins: [i18n, router] } })
  await flushPromises()
  await w.vm.$nextTick()
  return w
}

beforeEach(() => {
  setActivePinia(createPinia())
  svc.photos.smartSearch.mockClear().mockResolvedValue([])
  svc.photos.listPersons.mockClear().mockResolvedValue({ persons: [], facesIndexedUpTo: null })
  svc.photos.listAlbums.mockClear().mockResolvedValue([])
  svc.photos.recordView.mockClear().mockResolvedValue(undefined)
  svc.photos.listFavoriteIds.mockClear().mockResolvedValue([])
  lb.__resetForTest()
})

afterEach(() => {
  vi.useRealTimers()
  lb.__resetForTest()
})

describe('PhotosSearch.vue 灯箱接线(Plan F Task 5:新增挂载,补 F8 类缺口)', () => {
  it('点开一张搜索结果 → 灯箱真实打开(此前 lb.openAt 打进一个没有挂载点的空单例)', async () => {
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a'), rawAsset('b')])
    const w = await mountSearch('/photos/search?q=receipt')

    expect(w.find('.lightbox').exists()).toBe(false) // 打开前不渲染
    const tile = w.get('.tile')
    await tile.trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(lb.open.value).toBe(true)
    expect(w.find('.lightbox').exists()).toBe(true) // 真实渲染,不再是"状态开了但没有覆盖层"
  })

  it('灯箱翻页集 = onOpen 传入的 sortedResults 映射数组', async () => {
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a'), rawAsset('b')])
    const w = await mountSearch('/photos/search?q=receipt')
    await w.get('.tile').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(lb.list.value.map((p) => p.id)).toEqual(expect.arrayContaining(['a', 'b']))
  })

  it('Escape 关闭灯箱', async () => {
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a')])
    const w = await mountSearch('/photos/search?q=receipt')
    await w.get('.tile').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    expect(lb.open.value).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(lb.open.value).toBe(false)
  })

  it('灯箱「加入相册」→ AlbumPickerDialog 打开(同 PhotosMomentDetail.vue 单张场景,无需清空选择态)', async () => {
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a')])
    const w = await mountSearch('/photos/search?q=receipt')
    await w.get('.tile').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    await w.get('.lb-add-album').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.album-picker-overlay').exists()).toBe(true)
  })
})
