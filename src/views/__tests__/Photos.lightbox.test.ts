// Task 9: Photos.vue 灯箱接线——照 Photos.integration.test.ts 的 mock/mount 套路
// (svc.photos hoisted mock、useMessageBus mock),补齐 useLightbox 单例所需的
// service.photos.recordView/getAsset/getAssetOcr/listFavoriteIds(PhotoLightbox
// 真实挂载后 openAt/hydrateDetail/reconcileFav 会真的调它们)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
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
import { useToast } from '../../stores/toast'

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
  lb.__resetForTest()
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

  it('灯箱 emit delete(id) → store.deleteAssets(["id"]) + toast.show', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    const toast = useToast()
    const deleteSpy = vi.spyOn(store, 'deleteAssets').mockResolvedValue(1)
    const showSpy = vi.spyOn(toast, 'show')
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
    expect(showSpy).toHaveBeenCalledWith(expect.stringContaining('1'), 4000)
    // PhotoLightbox 自己在 doDelete 里已经 close 了,Photos.vue 不重复关。
    expect(lb.open.value).toBe(false)
  })
})
