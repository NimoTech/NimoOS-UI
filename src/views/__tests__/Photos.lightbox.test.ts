// Task 9: Photos.vue lightbox wiring — follows Photos.integration.test.ts's mock/mount
// pattern (svc.photos hoisted mock, useMessageBus mock), filling in the
// service.photos.recordView/getAsset/getAssetOcr/listFavoriteIds that the useLightbox
// singleton needs (once PhotoLightbox is really mounted, openAt/hydrateDetail/reconcileFav
// really call them).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'
import { useLightbox } from '../../photos/lightbox/useLightbox'

const svc = vi.hoisted(() => ({
  photos: {
    getTimeline: vi.fn().mockResolvedValue([]),
    getStatus: vi.fn().mockResolvedValue({}),
    listTasks: vi.fn().mockResolvedValue({ tasks: [] }),
    deleteAsset: vi.fn().mockResolvedValue(undefined),
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
    previewUrl: vi.fn((id: string | number) => `mock://preview/${id}`),
    originalUrl: vi.fn((id: string | number) => `mock://original/${id}`),
    liveUrl: vi.fn((id: string | number) => `mock://live/${id}`),
    spriteUrl: vi.fn((id: string | number) => `mock://sprite/${id}`),
    spriteMeta: vi.fn(),
    recordView: vi.fn().mockResolvedValue(undefined),
    getAsset: vi.fn().mockRejectedValue(new Error('no hydrate in test')),
    getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
    listFavoriteIds: vi.fn().mockResolvedValue([]),
    favorite: vi.fn().mockResolvedValue(undefined),
    unfavorite: vi.fn().mockResolvedValue(undefined),
    // Task 9: the lightbox's "add to album" -> AlbumPickerDialog is really mounted, going through usePhotosAlbums().
    listAlbums: vi.fn().mockResolvedValue([]),
    batchAddToAlbum: vi.fn().mockResolvedValue(undefined),
    // Task 8: delete-toast Undo restores through the trash store's real
    // restore() action (restoreTrashBatch + fetchTrash + refresh timeline).
    restoreTrashBatch: vi.fn().mockResolvedValue(undefined),
    listTrash: vi.fn().mockResolvedValue([]),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// jsdom has no media stack (PhotoLightbox uses this for resuming playback position).
;(HTMLMediaElement.prototype as unknown as { play: () => Promise<void> }).play = vi.fn(() => Promise.resolve())
;(HTMLMediaElement.prototype as unknown as { pause: () => void }).pause = vi.fn()

const busOn = vi.hoisted(() => vi.fn((_event: string, _cb: (...a: unknown[]) => void) => () => {}))
vi.mock('../../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: busOn }) }))

import Photos from '../Photos.vue'
import { useTimelineStore } from '../../photos/stores/timeline'
import { usePhotosToast } from '../../photos/composables/usePhotosToast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [{ path: '/photos', name: 'photos', component: Photos }],
  })
}

async function mountPhotos() {
  const router = makeRouter()
  router.push('/photos')
  await router.isReady()
  const w = mount(Photos, { global: { plugins: [i18n, router] } })
  await flushPromises()
  return w
}

function asset(id: string, opts: Partial<{ mimeType: string }> = {}) {
  return { id, mimeType: opts.mimeType || 'image/jpeg', originalName: `${id}.jpg` }
}

const lb = useLightbox()

beforeEach(() => {
  setActivePinia(createPinia())
  busOn.mockClear()
  svc.photos.getTimeline.mockClear().mockResolvedValue([])
  svc.photos.getStatus.mockClear().mockResolvedValue({})
  svc.photos.listTasks.mockClear().mockResolvedValue({ tasks: [] })
  svc.photos.deleteAsset.mockClear().mockResolvedValue(undefined)
  svc.photos.recordView.mockClear().mockResolvedValue(undefined)
  svc.photos.listFavoriteIds.mockClear().mockResolvedValue([])
  svc.photos.listAlbums.mockClear().mockResolvedValue([])
  svc.photos.batchAddToAlbum.mockClear().mockResolvedValue(undefined)
  svc.photos.restoreTrashBatch.mockClear().mockResolvedValue(undefined)
  svc.photos.listTrash.mockClear().mockResolvedValue([])
  lb.__resetForTest()
  usePhotosToast().__resetForTests()
})

afterEach(() => {
  vi.useRealTimers()
  lb.__resetForTest()
})

describe('Photos.vue lightbox wiring', () => {
  it('opening a photo -> the lightbox opens, the paging set = the collection filtered by the current tab (default photo)', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    store.timelineGroups = [
      { year: 2026, month: 7, assets: [asset('a'), asset('b', { mimeType: 'video/mp4' }), asset('c')] },
    ]
    await flushPromises()
    await w.vm.$nextTick()

    // Default tab='photo': only a and c are non-video, non-OCR stills; b is a video and gets filtered out.
    const tile = w.find('.tile')
    expect(tile.exists()).toBe(true)
    await tile.trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(lb.open.value).toBe(true)
    expect(lb.list.value).toHaveLength(2)
    expect(lb.list.value[0].id).toBe('a')
    expect(lb.list.value.map((p) => p.id)).not.toContain('b')
  })

  it('opening a video while tab=video -> the paging set only contains isVideo items', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    store.timelineGroups = [
      { year: 2026, month: 7, assets: [asset('a'), asset('b', { mimeType: 'video/mp4' }), asset('c', { mimeType: 'video/mp4' })] },
    ]
    await flushPromises()
    await w.vm.$nextTick()

    const videoTab = w.findAll('.tab').find((btn) => btn.text() === '视频')
    expect(videoTab).toBeTruthy()
    await videoTab!.trigger('click')
    await w.vm.$nextTick()

    const tile = w.find('.tile')
    expect(tile.exists()).toBe(true)
    await tile.trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(lb.open.value).toBe(true)
    expect(lb.list.value).toHaveLength(2)
    expect(lb.list.value.every((p) => p.isVideo)).toBe(true)
  })

  it('the lightbox emits delete(id) -> store.deleteAssets(["id"]) + photosToast(trash+Undo)', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    const photosToast = usePhotosToast()
    const deleteSpy = vi.spyOn(store, 'deleteAssets').mockResolvedValue(1)
    store.timelineGroups = [{ year: 2026, month: 7, assets: [asset('a')] }]
    await flushPromises()
    await w.vm.$nextTick()

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
    // PhotoLightbox already closes itself inside doDelete; Photos.vue doesn't close it again.
    expect(lb.open.value).toBe(false)

    // Task 8: same Photos-private toast + Undo as the batch-delete path
    // (Vue2 lightbox delete reuses onBatchDelete([id]) — PhotosTimeline.vue:1138).
    expect(photosToast.toasts.value).toHaveLength(1)
    const toastItem = photosToast.toasts.value[0]
    expect(toastItem.icon).toBe('trash')
    expect(toastItem.text).toContain('1')
    expect(toastItem.action?.label).toBeTruthy()

    // Undo → trash store restores the single deleted id and the timeline
    // refetches; no second toast (Vue2 parity).
    const fetchTimelineSpy = vi.spyOn(store, 'fetchTimeline')
    const body = new DOMWrapper(document.body)
    const undoBtn = body.find('[data-role="photos-toast-action"]')
    expect(undoBtn.exists()).toBe(true)
    await undoBtn.trigger('click')
    await flushPromises()

    expect(svc.photos.restoreTrashBatch).toHaveBeenCalledWith(['a'])
    expect(fetchTimelineSpy).toHaveBeenCalled()
    expect(photosToast.toasts.value).toHaveLength(0)
  })

  // Task 9: the lightbox emits add-to-album(id) -> Photos.vue opens AlbumPickerDialog, assetIds=[id].
  it('lightbox "add to album" -> the picker opens with assetIds=[the current item id]', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 9, name: 'Solo', assetCount: 0 }])
    const w = await mountPhotos()
    const store = useTimelineStore()
    store.timelineGroups = [{ year: 2026, month: 7, assets: [asset('a')] }]
    await flushPromises()
    await w.vm.$nextTick()

    await w.find('.tile').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    expect(lb.open.value).toBe(true)

    await w.find('.lb-add-album').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(w.find('[data-test="album-picker-overlay"]').exists()).toBe(true)
    // The lightbox itself doesn't close because of adding to an album (matching Vue2: after the emit, the host opens the panel and the lightbox stays open).
    expect(lb.open.value).toBe(true)

    const item = w.find('[data-test="album-picker-item"]')
    await item.trigger('click')
    await flushPromises()

    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledWith(9, ['a'])
  })
})
