// Plan F Task 6: PhotosPlaceAssets.vue mounted <PhotoLightbox> with NO event listeners at all
// (delete/add-to-album silently no-op'd — same false-success bug class Plan F Task 5's fix
// round 1 found and fixed on PhotosSearch.vue; see PhotosSearch.lightbox.test.ts, the direct
// style/fixture reference for this file).
//
// Uses the REAL useLightbox()/usePlaceAssets()/useTimelineStore()/usePhotosTrash() singletons
// (not mocked) to prove the wiring is real, same split as every other *.lightbox.test.ts file
// in this fleet. The main PhotosPlaceAssets.test.ts file already covers the page's re-shell/
// route/breadcrumb assertions with its own service mock — this file only adds what Task 6
// introduces.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

const svc = vi.hoisted(() => ({
  photos: {
    getPlace: vi.fn(),
    listAssetsByPlace: vi.fn(),
    thumbnailUrl: vi.fn((id: string | number, size?: string) => `mock://thumb/${id}/${size ?? 'large'}`),
    previewUrl: vi.fn((id: string | number) => `mock://preview/${id}`),
    spriteUrl: vi.fn((id: string | number) => `mock://sprite/${id}`),
    originalUrl: vi.fn((id: string | number) => `mock://original/${id}`),
    liveUrl: vi.fn((id: string | number) => `mock://live/${id}`),
    spriteMeta: vi.fn().mockRejectedValue(new Error('no video in test')),
    getAsset: vi.fn().mockRejectedValue(new Error('no hydrate in test')),
    getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
    recordView: vi.fn().mockResolvedValue(undefined),
    listFavoriteIds: vi.fn().mockResolvedValue([]),
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

import PhotosPlaceAssets from '../PhotosPlaceAssets.vue'
import { usePhotosPlaces } from '../../photos/stores/places'
import { useTimelineStore } from '../../photos/stores/timeline'
import { usePhotosToast } from '../../photos/composables/usePhotosToast'
import { useLightbox } from '../../photos/lightbox/useLightbox'

function rawPlace(key: string | number) {
  return {
    key, city: 'Tokyo', country: 'Japan', count: 2, trips: 1, home: false,
    coverAssetId: '', thumbs: [], spots: [], insights: [], visits: [], recent: [],
  }
}

function asset(id: string | number, takenAt = '2026-05-01T10:00:00Z') {
  return { id, takenAt, mimeType: 'image/jpeg', originalName: `${id}.jpg` }
}

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/'),
    routes: [
      { path: '/photos/places', name: 'photos-places', component: { template: '<div/>' } },
      { path: '/photos/places/:key', name: 'photos-place-assets', component: PhotosPlaceAssets },
    ],
  })
}

async function mountView(path: string) {
  const router = makeRouter()
  await router.push(path)
  await router.isReady()
  const w = mount(PhotosPlaceAssets, { global: { plugins: [router] } })
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

const body = () => new DOMWrapper(document.body)

beforeEach(() => {
  setActivePinia(createPinia())
  usePhotosPlaces().__resetForTest()
  useLightbox().__resetForTest()
  usePhotosToast().__resetForTests()
  svc.photos.getPlace.mockReset().mockResolvedValue(rawPlace('7'))
  svc.photos.listAssetsByPlace.mockReset().mockResolvedValue({ assets: [asset('a1'), asset('a2')] })
  svc.photos.deleteAsset.mockClear().mockResolvedValue(undefined)
  svc.photos.restoreTrashBatch.mockClear().mockResolvedValue(undefined)
  svc.photos.listTrash.mockClear().mockResolvedValue([])
})

afterEach(() => {
  vi.restoreAllMocks()
  useLightbox().__resetForTest()
  document.body.innerHTML = ''
})

describe('PhotosPlaceAssets.vue 灯箱「删除」接线(Task 6:补真删,原先 @delete 无监听,静默假成功)', () => {
  it('确认删除 → 调 timeline.deleteAssets(真删路径)+ 从渲染出的网格里移除该项', async () => {
    const { w } = await mountView('/photos/places/7')
    const timeline = useTimelineStore()
    const deleteSpy = vi.spyOn(timeline, 'deleteAssets').mockResolvedValue(1)

    expect(w.findAll('.tile')).toHaveLength(2)
    await w.get('.tile').trigger('click') // opens 'a1' (first tile)
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.find('.lightbox').exists()).toBe(true)

    await w.get('.lb-delete').trigger('click')
    await w.vm.$nextTick()
    await w.get('.trash-btn-cta-danger').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(deleteSpy).toHaveBeenCalledWith(['a1'])
    expect(useLightbox().open.value).toBe(false)
    // Local removal (documented in PhotosPlaceAssets.vue's onLightboxDelete comment): this
    // page's data source is usePlaceAssets()'s flat `photos` ref, no derived counts layered on
    // top, so a precise local filter is both correct and preserves EXIF-filter/scroll state.
    expect(w.findAll('.tile')).toHaveLength(1)
  })

  it('删除后弹出带 Undo 的 photosToast,且 PhotosToastHost 真的挂载渲染', async () => {
    const { w } = await mountView('/photos/places/7')
    vi.spyOn(useTimelineStore(), 'deleteAssets').mockResolvedValue(1)
    const photosToast = usePhotosToast()

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
    expect(body().find('[data-role="photos-toast-action"]').exists()).toBe(true)
  })

  it('点 Undo → trash.restore(真实还原路径)+ 重新按当前地点/spot 拉一次资产(带回结果)', async () => {
    const { w } = await mountView('/photos/places/7')
    vi.spyOn(useTimelineStore(), 'deleteAssets').mockResolvedValue(1)

    await w.get('.tile').trigger('click') // 'a1'
    await flushPromises()
    await w.vm.$nextTick()
    await w.get('.lb-delete').trigger('click')
    await w.vm.$nextTick()
    await w.get('.trash-btn-cta-danger').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.findAll('.tile')).toHaveLength(1)

    svc.photos.listAssetsByPlace.mockClear().mockResolvedValue({ assets: [asset('a1'), asset('a2')] })
    await body().get('[data-role="photos-toast-action"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(svc.photos.restoreTrashBatch).toHaveBeenCalledWith(['a1'])
    expect(svc.photos.listAssetsByPlace).toHaveBeenCalled()
    expect(w.findAll('.tile')).toHaveLength(2)
  })
})

describe('PhotosPlaceAssets.vue 灯箱「加入相册」接线(Task 6:补真挂载,原先 @add-to-album 无监听)', () => {
  it('灯箱「加入相册」→ AlbumPickerDialog 打开(单张场景,同 PhotosSearch.vue 先例)', async () => {
    const { w } = await mountView('/photos/places/7')
    await w.get('.tile').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    await w.get('.lb-add-album').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.album-picker-overlay').exists()).toBe(true)
  })
})
