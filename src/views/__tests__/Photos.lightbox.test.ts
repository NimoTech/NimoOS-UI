// Task 9: Photos.vue 灯箱接线——照 Photos.integration.test.ts 的 mock/mount 套路
// (svc.photos hoisted mock、useMessageBus mock),补齐 useLightbox 单例所需的
// service.photos.recordView/getAsset/getAssetOcr/listFavoriteIds(PhotoLightbox
// 真实挂载后 openAt/hydrateDetail/reconcileFav 会真的调它们)。
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
    // Task 9: 灯箱「加入相册」→ AlbumPickerDialog 真实挂载,走 usePhotosAlbums()。
    listAlbums: vi.fn().mockResolvedValue([]),
    batchAddToAlbum: vi.fn().mockResolvedValue(undefined),
    // Task 8: delete-toast Undo restores through the trash store's real
    // restore() action (restoreTrashBatch + fetchTrash + refresh timeline).
    restoreTrashBatch: vi.fn().mockResolvedValue(undefined),
    listTrash: vi.fn().mockResolvedValue([]),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// jsdom 无媒体栈(PhotoLightbox 起播位续播用得到)。
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

describe('Photos.vue 灯箱接线', () => {
  it('点开一张图 → 灯箱打开,翻页集 = 当前 tab(默认 photo)过滤后的集合', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    store.timelineGroups = [
      { year: 2026, month: 7, assets: [asset('a'), asset('b', { mimeType: 'video/mp4' }), asset('c')] },
    ]
    await flushPromises()
    await w.vm.$nextTick()

    // 默认 tab='photo':只有 a、c 是非视频、非 OCR 的静图,b 是视频被滤掉。
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

  it('tab=video 时打开某视频 → 翻页集只含 isVideo', async () => {
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

  it('灯箱 emit delete(id) → store.deleteAssets(["id"]) + photosToast(trash+Undo)', async () => {
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
    await w.find('.trash-btn-cta-danger').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(deleteSpy).toHaveBeenCalledWith(['a'])
    // PhotoLightbox 自己在 doDelete 里已经 close 了,Photos.vue 不重复关。
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

  // Task 9: 灯箱 emit add-to-album(id) → Photos.vue 打开 AlbumPickerDialog,assetIds=[id]。
  it('灯箱「加入相册」→ picker 打开且 assetIds=[当前项 id]', async () => {
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
    // 灯箱本身不因加入相册而关闭(照 Vue2:emit 后由宿主开面板,灯箱保持打开)。
    expect(lb.open.value).toBe(true)

    const item = w.find('[data-test="album-picker-item"]')
    await item.trigger('click')
    await flushPromises()

    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledWith(9, ['a'])
  })
})

// Fix-4 item 1 (owner acceptance, 2026-08-13; same F1/F2 lesson class, found here on the
// timeline page): AlbumPickerDialog used to be a template-root SIBLING of `.photos-root` instead
// of its DOM descendant, so `.photos-root .album-picker-panel`'s `background: var(--surface-2)`
// (a `.photos-root`-local custom property with no global fallback, vue2-parity/
// photos.scss:1072-1102) resolved to nothing outside it — the picker panel likely rendered with
// a transparent background. Same fix as Fix-1 item 3 / Fix-2 item 5: nest it back inside
// `.photos-root`.
//
// PhotoLightbox was ALSO nested here by that same fix, on the same reasoning -- Fix-8 round 4
// (2026-08-14) found that reasoning didn't hold for this one component specifically (see that
// test's own comment below) and un-nested it again. The two now have opposite intended
// positions, which is why they are asserted separately below rather than as one shared case.
describe('Fix-4 item 1 / Fix-8 round 4: the album picker is a real descendant of .photos-root; the lightbox is deliberately NOT', () => {
  it('the album picker overlay renders inside .photos-root (so parity .album-picker-panel can match)', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 9, name: 'Solo', assetCount: 0 }])
    const w = await mountPhotos()
    const store = useTimelineStore()
    store.timelineGroups = [{ year: 2026, month: 7, assets: [asset('a')] }]
    await flushPromises()
    await w.vm.$nextTick()

    await w.find('.tile').trigger('click')
    await flushPromises()
    await w.find('.lb-add-album').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    const overlay = w.get('[data-test="album-picker-overlay"]').element
    expect(overlay.closest('.photos-root')).not.toBeNull()
  })

  // Fix-8 round 4 (owner acceptance, 2026-08-14): this case used to assert the OPPOSITE (F4
  // item 1 nested `<PhotoLightbox>` inside `.photos-root` alongside AlbumPickerDialog, on the
  // stated belief that "this move changes nothing about how the lightbox itself renders" --
  // that belief was wrong. Nesting it activates parity's own `.photos-root .lightbox`/`.lb-*`
  // rule family (vue2-parity/photos.scss:499-1061+), which targets a *future* Plan-F re-skin
  // describing a different DOM/CSS shape (a CSS Grid with named grid-area children) than this
  // component's own current, self-contained flex layout -- every colliding selector ties in
  // specificity, so which one wins is bundler-order-dependent, and if parity's `display: grid`
  // wins for the outer `.lightbox` container, none of this component's real children carry the
  // grid-area names parity's layout expects, collapsing/hiding the whole overlay. Confirmed by
  // real-device evidence: `lb.openAt`'s network calls fired (state opened) but the lightbox
  // never became visible. Flipped to the corrected, intended structure -- a sibling of
  // `.photos-root`, same as before F4 item 1 first nested it (see acceptance-fix-report.md
  // §F8-r4 for the full collision list and sweep). Do not flip this back before Plan F's own
  // lightbox re-skin actually ports the DOM/CSS parity's rules describe.
  it('the lightbox renders OUTSIDE .photos-root (parity\'s future-re-skin .lightbox/.lb-* rules must not match this component yet)', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    store.timelineGroups = [{ year: 2026, month: 7, assets: [asset('a')] }]
    await flushPromises()
    await w.vm.$nextTick()

    await w.find('.tile').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    const lightbox = w.get('.lightbox').element
    expect(lightbox.closest('.photos-root')).toBeNull()
  })
})
