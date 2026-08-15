// Plan F Task 6: PhotosPlaces.vue mounted <PhotoLightbox> with NO event listeners at all
// (delete/add-to-album silently no-op'd — the confirm dialog runs to completion, the lightbox
// closes, exactly as if the delete had succeeded, while nothing actually happened server-side).
// Same false-success bug class Plan F Task 5's fix round 1 found and fixed on PhotosSearch.vue
// (see PhotosSearch.lightbox.test.ts, the direct style/fixture reference for this file).
//
// This file uses the REAL useLightbox()/usePhotosPlaces()/useTimelineStore()/usePhotosTrash()
// singletons (not mocked) to prove the wiring is real, same split PhotosSearch.vue's own
// PhotosSearch.lightbox.test.ts / Photos.vue's own Photos.lightbox.test.ts use: the main
// PhotosPlaces.test.ts file already covers ~40 other assertions with its own service mock: this
// dedicated file only adds what Task 6 introduces.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

const svc = vi.hoisted(() => ({
  photos: {
    listPlaces: vi.fn(),
    getPlace: vi.fn(),
    thumbnailUrl: vi.fn((id: string | number, size?: string) => `mock://thumb/${id}/${size ?? ''}`),
    setPlaceCover: vi.fn().mockResolvedValue(undefined),
    resetPlaceCover: vi.fn().mockResolvedValue(undefined),
    setSpotName: vi.fn().mockResolvedValue(undefined),
    resetSpotName: vi.fn().mockResolvedValue(undefined),
    createPlaceAlbum: vi.fn().mockResolvedValue({ albumId: 'al1', name: 'x', count: 1 }),
    placeCoverCandidates: vi.fn().mockResolvedValue({ tabs: [], items: [], page: 0, totalPages: 1, total: 0 }),
    getAsset: vi.fn().mockResolvedValue({}),
    getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
    recordView: vi.fn().mockResolvedValue(undefined),
    listFavoriteIds: vi.fn().mockResolvedValue([]),
    originalUrl: vi.fn((id: string | number) => `mock://original/${id}`),
    liveUrl: vi.fn((id: string | number) => `mock://live/${id}`),
    // Task 6: real @delete/Undo pathway (timeline.deleteAssets -> service.photos.deleteAsset,
    // Undo -> trash.restore -> service.photos.restoreTrashBatch), same mock shape
    // PhotosSearch.lightbox.test.ts already established for this exact pathway.
    deleteAsset: vi.fn().mockResolvedValue(undefined),
    restoreTrashBatch: vi.fn().mockResolvedValue(undefined),
    listTrash: vi.fn().mockResolvedValue([]),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

;(HTMLMediaElement.prototype as unknown as { play: () => Promise<void> }).play = vi.fn(() => Promise.resolve())
;(HTMLMediaElement.prototype as unknown as { pause: () => void }).pause = vi.fn()

import PhotosPlaces from '../PhotosPlaces.vue'
import PlaceDetailPanel from '../../photos/components/PlaceDetailPanel.vue'
import { usePhotosPlaces } from '../../photos/stores/places'
import { useTimelineStore } from '../../photos/stores/timeline'
import { usePhotosToast } from '../../photos/composables/usePhotosToast'
import { useLightbox } from '../../photos/lightbox/useLightbox'

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/photos/places', name: 'photos-places', component: PhotosPlaces },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/photos/places')
  await router.isReady()
  const w = mount(PhotosPlaces, { global: { plugins: [router] } })
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

const TOKYO = { key: 7, region: 'asia', country: 'Japan', city: 'Tokyo', lon: 139.7, lat: 35.7, count: 3, recent: false, last: 'Jan 5, 2026', trips: 1, home: false, thumbs: ['t1'], coverAssetId: '' }

function okListPlaces() {
  return Promise.resolve({ places: [TOKYO], regions: [{ id: 'asia', label: 'Asia', count: 1 }], stats: { cities: 1, countries: 1, photos: 3 } })
}

function rawDetail(overrides: Record<string, unknown> = {}) {
  return {
    key: 7, city: 'Tokyo', country: 'Japan', count: 3, trips: 1, home: false,
    coverAssetId: '', thumbs: [], spots: [], insights: [], visits: [],
    recent: ['a', 'b'],
    ...overrides,
  }
}

let rafCallbacks: FrameRequestCallback[]
beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  rafCallbacks = []
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
    rafCallbacks.push(cb)
    return rafCallbacks.length
  })
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
  svc.photos.listPlaces.mockReset().mockImplementation(okListPlaces)
  svc.photos.getPlace.mockReset().mockResolvedValue(rawDetail())
  svc.photos.deleteAsset.mockClear().mockResolvedValue(undefined)
  svc.photos.restoreTrashBatch.mockClear().mockResolvedValue(undefined)
  svc.photos.listTrash.mockClear().mockResolvedValue([])
  useLightbox().__resetForTest()
  usePhotosToast().__resetForTests()
})
afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

const body = () => new DOMWrapper(document.body)

describe('PhotosPlaces.vue 灯箱「删除」接线(Task 6:补真删,原先 @delete 无监听,静默假成功)', () => {
  it('确认删除 → 调 timeline.deleteAssets(真删路径)+ 重新拉取该地点详情(loadDetail 再次调用 getPlace)', async () => {
    const { w } = await mountView()
    const timeline = useTimelineStore()
    const deleteSpy = vi.spyOn(timeline, 'deleteAssets').mockResolvedValue(1)
    const getPlaceCallsBefore = svc.photos.getPlace.mock.calls.length

    await w.findComponent(PlaceDetailPanel).vm.$emit('open-photo', 'a', ['a', 'b'])
    await w.vm.$nextTick()
    expect(w.find('.lightbox').exists()).toBe(true)

    await w.get('.lb-delete').trigger('click')
    await w.vm.$nextTick()
    await w.get('.trash-btn-cta-danger').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(deleteSpy).toHaveBeenCalledWith(['a'])
    // Lightbox already closes itself on confirm (PhotoLightbox.vue's own doDelete).
    expect(useLightbox().open.value).toBe(false)
    // Full-refetch fallback (documented in PhotosPlaces.vue's onLightboxDelete comment): the
    // place detail's several id arrays carry server-computed counts/thumb picks, so this page
    // re-runs loadDetail (getPlace) instead of a local splice.
    expect(svc.photos.getPlace.mock.calls.length).toBeGreaterThan(getPlaceCallsBefore)
  })

  it('删除后弹出带 Undo 的 photosToast,且 PhotosToastHost 真的挂载渲染(不是状态翻了但界面看不到)', async () => {
    const { w } = await mountView()
    vi.spyOn(useTimelineStore(), 'deleteAssets').mockResolvedValue(1)
    const photosToast = usePhotosToast()

    await w.findComponent(PlaceDetailPanel).vm.$emit('open-photo', 'a', ['a'])
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
    expect(body().find('[data-role="photos-toast-action"]').exists()).toBe(true)
  })

  it('点 Undo → trash.restore(真实还原路径)+ 再次刷新该地点详情', async () => {
    const { w } = await mountView()
    vi.spyOn(useTimelineStore(), 'deleteAssets').mockResolvedValue(1)

    await w.findComponent(PlaceDetailPanel).vm.$emit('open-photo', 'a', ['a'])
    await w.vm.$nextTick()
    await w.get('.lb-delete').trigger('click')
    await w.vm.$nextTick()
    await w.get('.trash-btn-cta-danger').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    const getPlaceCallsBeforeUndo = svc.photos.getPlace.mock.calls.length
    await body().get('[data-role="photos-toast-action"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(svc.photos.restoreTrashBatch).toHaveBeenCalledWith(['a'])
    expect(svc.photos.getPlace.mock.calls.length).toBeGreaterThan(getPlaceCallsBeforeUndo)
  })
})

describe('PhotosPlaces.vue 灯箱「加入相册」接线(Task 6:补真挂载,原先 @add-to-album 无监听)', () => {
  it('灯箱「加入相册」→ AlbumPickerDialog 打开(单张场景,同 PhotosSearch.vue 先例)', async () => {
    const { w } = await mountView()
    await w.findComponent(PlaceDetailPanel).vm.$emit('open-photo', 'a', ['a'])
    await w.vm.$nextTick()

    await w.get('.lb-add-album').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.album-picker-overlay').exists()).toBe(true)
  })
})
