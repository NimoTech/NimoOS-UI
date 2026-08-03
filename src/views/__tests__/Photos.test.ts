// SP7-P7b-T4: 时间线页 EXIF 筛选接线——FilterBar 挂进 PhotosToolbar#after-tabs,
// 三处同源逻辑(gridMonths 网格数据源 / filteredCount 顶栏计数 / onOpenTile 灯箱翻页集)
// 全部改用 EXIF 筛后的月份集合;FilterBar 自身的 facet 源 (:photos) 恒取全库
// store.allPhotos,不随 gridMonths 收窄——照 Vue2 PhotosTimeline.vue facet 源是
// displayMonths 而非过滤后的 gridMonths 同一约束。
// mount 脚手架照 Photos.integration.test.ts 的套路(svc.photos hoisted mock、
// useMessageBus mock、i18n 单例 + router stub)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

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
    listAlbums: vi.fn().mockResolvedValue([]),
    batchAddToAlbum: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

const busOn = vi.hoisted(() => vi.fn((_event: string, _cb: (...a: unknown[]) => void) => () => {}))
vi.mock('../../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: busOn }) }))

import Photos from '../Photos.vue'
import PhotosFilterBar from '../../photos/components/PhotosFilterBar.vue'
import PhotosGrid from '../../photos/components/PhotosGrid.vue'
import PhotosToolbar from '../../photos/components/PhotosToolbar.vue'
import { useTimelineStore } from '../../photos/stores/timeline'

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [{ path: '/photos', name: 'photos', component: Photos }],
  })
}

// 不另建 createI18n(...) 实例(vitest.setup.ts 已把 src/i18n 的单例装进
// config.global.plugins,对每次 mount 生效)——另建会与它重复安装,每条用例刷出
// 一批 `[Vue warn]` component/directive already registered(本期 T3 已踩过并修掉)。
async function mountPhotos() {
  const router = makeRouter()
  router.push('/photos')
  await router.isReady()
  const w = mount(Photos, { global: { plugins: [router] } })
  await flushPromises()
  return w
}

// 夹具:两个月份跨两个年份。2023-06 三张(全都命中 years:['2023']),
// 2024-01 两张(全都不命中 —— 筛完整月清空,验证「空月份被丢掉」)。
function asset(
  id: string,
  opts: Partial<{ mimeType: string; takenAt: string; placeName: string; make: string; model: string }> = {},
) {
  return {
    id,
    mimeType: opts.mimeType || 'image/jpeg',
    originalName: `${id}.jpg`,
    takenAt: opts.takenAt,
    placeName: opts.placeName,
    make: opts.make,
    model: opts.model,
  }
}

function seedTimeline(store: ReturnType<typeof useTimelineStore>) {
  store.timelineGroups = [
    {
      year: 2023,
      month: 6,
      assets: [
        asset('a1', { takenAt: '2023-06-01T10:00:00Z', placeName: 'Paris, France', make: 'Canon', model: 'EOS R5' }),
        asset('a2', { takenAt: '2023-06-15T10:00:00Z', placeName: 'Paris, France', make: 'Canon', model: 'EOS R5' }),
        asset('a3', { takenAt: '2023-06-20T10:00:00Z', placeName: 'Paris, France', make: 'Canon', model: 'EOS R5' }),
      ],
    },
    {
      year: 2024,
      month: 1,
      assets: [
        asset('b1', { takenAt: '2024-01-05T10:00:00Z', placeName: 'Tokyo, Japan', make: 'Sony', model: 'A7' }),
        asset('b2', { takenAt: '2024-01-20T10:00:00Z', placeName: 'Tokyo, Japan', make: 'Sony', model: 'A7' }),
      ],
    },
  ]
}

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
})

afterEach(() => {
  vi.useRealTimers()
})

describe('P7b-T4: EXIF 筛选接线', () => {
  it('工具栏 after-tabs 槽位里挂着 PhotosFilterBar', async () => {
    const w = await mountPhotos()
    expect(w.findComponent(PhotosFilterBar).exists()).toBe(true)
  })

  it('FilterBar 的 facet 源是全库 allPhotos,不随已生效的筛选收窄', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    seedTimeline(store)
    await flushPromises()
    await w.vm.$nextTick()

    const bar = w.findComponent(PhotosFilterBar)
    const before = (bar.props('photos') as unknown[]).length
    expect(before).toBe(5) // 全库:2023-06 三张 + 2024-01 两张

    await bar.vm.$emit('update:filter', { years: ['2023'], places: [], cameras: [] })
    await w.vm.$nextTick()

    expect((w.findComponent(PhotosFilterBar).props('photos') as unknown[]).length).toBe(before)
  })

  it('筛选生效后网格只拿到命中的照片,且空月份被丢掉', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    seedTimeline(store)
    await flushPromises()
    await w.vm.$nextTick()

    await w.findComponent(PhotosFilterBar).vm.$emit(
      'update:filter', { years: ['2023'], places: [], cameras: [] },
    )
    await w.vm.$nextTick()

    const months = w.findComponent(PhotosGrid).props('months') as Array<{ photos: unknown[] }>
    // 2024-01 整月不命中 years:['2023'],月份本身应被丢掉——只剩 2023-06 一个月。
    expect(months).toHaveLength(1)
    expect(months.every((m) => m.photos.length > 0)).toBe(true)
    // 2023-06 三张全命中(它们的 takenAt 都在 2023 年),2024-01 的两张全部消失。
    expect(months.flatMap((m) => m.photos)).toHaveLength(3)
  })

  it('D20:顶栏计数跟着 EXIF 筛选减', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    seedTimeline(store)
    await flushPromises()
    await w.vm.$nextTick()

    const countBefore = w.findComponent(PhotosToolbar).props('count') as number
    expect(countBefore).toBe(5)

    await w.findComponent(PhotosFilterBar).vm.$emit(
      'update:filter', { years: ['2023'], places: [], cameras: [] },
    )
    await w.vm.$nextTick()

    const countAfter = w.findComponent(PhotosToolbar).props('count') as number
    expect(countAfter).toBeLessThan(countBefore)
    expect(countAfter).toBe(3)
  })
})
