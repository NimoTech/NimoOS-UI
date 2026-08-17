// Plan F Task 5: PhotosSearch.vue never mounted a <PhotoLightbox> at all before this task --
// `onOpen`'s `lb.openAt(...)` call fired into a dangling singleton with no overlay component
// anywhere in this page's tree to render it (the exact F8 bug class other host pages already hit
// and fixed once, per acceptance-fix-report.md §F8). This file verifies the mount + wiring fix
// directly against the real `useLightbox()` singleton, the same split PhotosSearch.test.ts's own
// lbMock note points to (mirrors Photos.vue/Photos.lightbox.test.ts's own split: the main test
// file mocks useLightbox to a dumb, permanently-closed stub for its ~100 unrelated assertions;
// this dedicated file uses the real thing to prove the lightbox actually opens).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
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
    // Fix round 1 (review): real @delete wiring needs the same delete/restore pathway
    // Photos.vue's own onLightboxDelete uses (timeline.deleteAssets -> service.photos.deleteAsset,
    // Undo -> trash.restore -> service.photos.restoreTrashBatch).
    deleteAsset: vi.fn().mockResolvedValue(undefined),
    restoreTrashBatch: vi.fn().mockResolvedValue(undefined),
    listTrash: vi.fn().mockResolvedValue([]),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// jsdom 无媒体栈(PhotoLightbox 起播位续播用得到,同 Photos.lightbox.test.ts 先例)。
;(HTMLMediaElement.prototype as unknown as { play: () => Promise<void> }).play = vi.fn(() => Promise.resolve())
;(HTMLMediaElement.prototype as unknown as { pause: () => void }).pause = vi.fn()

import PhotosSearch from '../PhotosSearch.vue'
import { useTimelineStore } from '../../photos/stores/timeline'
import { usePhotosToast } from '../../photos/composables/usePhotosToast'

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
  svc.photos.deleteAsset.mockClear().mockResolvedValue(undefined)
  svc.photos.restoreTrashBatch.mockClear().mockResolvedValue(undefined)
  svc.photos.listTrash.mockClear().mockResolvedValue([])
  lb.__resetForTest()
  usePhotosToast().__resetForTests()
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

// Fix round 1 (review, 2026-08-15): `@delete` used to be a no-op -- the button + confirm dialog
// rendered unconditionally, so the user could complete the whole confirm flow (dialog + lightbox
// close, exactly as on a real success) while nothing was actually deleted. Vue2's own
// search-opened lightbox has a WORKING delete (shared single lightbox instance, wired the same as
// every other entry point), so function parity requires the same here -- mirrors Photos.vue's
// `onLightboxDelete` (Photos.vue:221-236: timeline.deleteAssets + photosToast Undo).
describe('PhotosSearch.vue 灯箱「删除」(Fix round 1:补真删,不再是隐形 no-op)', () => {
  it('确认删除 → 调 timeline.deleteAssets(真删路径)+ 从渲染结果里移除该项', async () => {
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a'), rawAsset('b')])
    const w = await mountSearch('/photos/search?q=receipt')
    const timeline = useTimelineStore()
    const deleteSpy = vi.spyOn(timeline, 'deleteAssets').mockResolvedValue(1)

    expect(w.findAll('.tile')).toHaveLength(2)
    await w.get('.tile').trigger('click') // 打开第一张(id='a')
    await flushPromises()
    await w.vm.$nextTick()
    expect(lb.open.value).toBe(true)

    await w.get('.lb-delete').trigger('click')
    await w.vm.$nextTick()
    await w.get('.trash-btn-cta-danger').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    // 真删路径被调用,不再是空 no-op。
    expect(deleteSpy).toHaveBeenCalledWith(['a'])
    // 灯箱自己在 doDelete 里已经 close(PhotoLightbox.vue 既有行为)。
    expect(lb.open.value).toBe(false)
    // 结果从渲染出的搜索结果里真的消失了(不是"看起来成功但其实没变")。
    expect(w.findAll('.tile')).toHaveLength(1)
    expect(w.find('.tile').exists()).toBe(true)
  })

  it('删除后弹出带 Undo 的 photosToast(同 Photos.vue 的 trash 图标 + Undo 文案)', async () => {
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a')])
    const w = await mountSearch('/photos/search?q=receipt')
    const photosToast = usePhotosToast()
    vi.spyOn(useTimelineStore(), 'deleteAssets').mockResolvedValue(1)

    await w.get('.tile').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    await w.get('.lb-delete').trigger('click')
    await w.vm.$nextTick()
    await w.get('.trash-btn-cta-danger').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(photosToast.toasts.value).toHaveLength(1)
    const toastItem = photosToast.toasts.value[0]
    expect(toastItem.icon).toBe('trash')
    expect(toastItem.text).toContain('1')
    expect(toastItem.action?.label).toBeTruthy()

    // Toast 真的有地方渲染(PhotosToastHost 已挂载),不是状态翻了但界面上什么都看不到。
    const body = new DOMWrapper(document.body)
    expect(body.find('[data-role="photos-toast-action"]').exists()).toBe(true)
  })

  it('点 Undo → trash.restore(真实还原路径)+ 重新按当前 query 搜一次(带回结果)', async () => {
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a')])
    const w = await mountSearch('/photos/search?q=receipt')
    vi.spyOn(useTimelineStore(), 'deleteAssets').mockResolvedValue(1)

    await w.get('.tile').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    await w.get('.lb-delete').trigger('click')
    await w.vm.$nextTick()
    await w.get('.trash-btn-cta-danger').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.findAll('.tile')).toHaveLength(0)

    svc.photos.smartSearch.mockClear().mockResolvedValue([rawAsset('a')]) // Undo 重搜命中同一张
    const body = new DOMWrapper(document.body)
    await body.get('[data-role="photos-toast-action"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(svc.photos.restoreTrashBatch).toHaveBeenCalledWith(['a'])
    // Deviation (documented in PhotosSearch.vue's onLightboxDelete comment): this page's results
    // are a search snapshot, not the timeline store trash.restore() already refreshes -- Undo
    // re-runs the same query to bring the restored item back, the controller-approved fallback.
    const calls = svc.photos.smartSearch.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall?.[0]).toBe('receipt')
    expect(w.findAll('.tile')).toHaveLength(1)
  })
})
