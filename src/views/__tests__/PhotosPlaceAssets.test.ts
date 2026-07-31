// P6b-T9(SP7 相册「地点」详情,本期最后一任务): PhotosPlaceAssets.vue ——
// `/photos/places/:key` 地点照片页:按月分组网格 + 灯箱 + 面包屑「城市 › spot」+ 三态门控。
// D10:跳库页最小面,不接多选/批操作(selectable=false)。
//
// 评审转来的两条硬要求(比 brief 更强,必须在本文件体现):
//  1) 路由必须真注册且测试要真解析——不能只 spy router.push。见 describe('路由注册与解析')
//     里对**真实应用路由**(`import { router as appRouter } from '../../router'`)的
//     resolve() 断言,以及本文件其余用例统一用真实 router 实例 push/replace(不 mock router)。
//  2) 面包屑的城市名/spot 名必须从 key + spot query 回源导出(store.detail),不能指望 URL
//     里带 city/spotName——本文件的 fixture 里 URL 上从不带这两个字符串,全部从 mock 的
//     getPlace 响应里读。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
// 源文件文本(Vite `?raw` 导入,见 node_modules/vite/client.d.ts:243——不需要 @types/node,
// 本仓本就没有装它)。用途见下方"追加不重排"用例的注释。
import routerSource from '../../router/index.ts?raw'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    getPlace: vi.fn(),
    listAssetsByPlace: vi.fn(),
    // PhotosGrid + 灯箱的既有依赖(同 PhotosAlbumDetail.test.ts/PhotosPersonDetail.test.ts
    // 前例——缺 mock 会在 hover/openAt 路径上抛未捕获异常,污染测试运行,不影响断言但需堵上)。
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
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

;(HTMLMediaElement.prototype as unknown as { play: () => Promise<void> }).play = vi.fn(() => Promise.resolve())
;(HTMLMediaElement.prototype as unknown as { pause: () => void }).pause = vi.fn()

import PhotosPlaceAssets from '../PhotosPlaceAssets.vue'
import PhotosGrid from '../../photos/components/PhotosGrid.vue'
import { usePhotosPlaces } from '../../photos/stores/places'
import { useLightbox } from '../../photos/lightbox/useLightbox'
import { router as appRouter } from '../../router'

const lb = useLightbox()
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function rawPlace(key: string | number, overrides: Record<string, unknown> = {}) {
  return {
    key,
    city: overrides.city ?? 'Tokyo',
    country: overrides.country ?? 'Japan',
    count: overrides.count ?? 42,
    trips: overrides.trips ?? 2,
    home: overrides.home ?? false,
    coverAssetId: overrides.coverAssetId ?? '',
    thumbs: overrides.thumbs ?? [],
    spots: overrides.spots ?? [],
    insights: overrides.insights ?? [],
    visits: overrides.visits ?? [],
    recent: overrides.recent ?? [],
    ...overrides,
  }
}

function asset(id: string | number, takenAt = '2026-05-01T10:00:00Z') {
  return { id, takenAt, mimeType: 'image/jpeg', originalName: `${id}.jpg` }
}

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
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
  const w = mount(PhotosPlaceAssets, { global: { plugins: [i18n, router] } })
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  usePhotosPlaces().__resetForTest()
  lb.__resetForTest()
  svc.photos.getPlace.mockReset().mockResolvedValue(rawPlace('7'))
  svc.photos.listAssetsByPlace.mockReset().mockResolvedValue({ assets: [asset('a1'), asset('a2')] })
  svc.photos.thumbnailUrl.mockClear()
  svc.photos.recordView.mockClear()
  svc.photos.listFavoriteIds.mockClear()
})

afterEach(() => {
  lb.__resetForTest()
})

describe('路由注册与解析(T8 评审硬要求 1:必须真注册、测试要真解析)', () => {
  it('真实应用路由把 /photos/places/7 解析到 name=photos-place-assets,且组件已挂上', () => {
    const match = appRouter.resolve('/photos/places/7')
    expect(match.matched.length).toBeGreaterThan(0)
    expect(match.name).toBe('photos-place-assets')
    expect(match.matched[0]?.components?.default).toBeTruthy()
  })

  // 实测纠正(brief 数值/断言有误,以源码/运行时实况为准并登记):vue-router 4 的
  // `getRoutes()` 按自己的打分算法排序匹配表(动态段路由被整体挪到列表靠前的一段),
  // **不是**声明顺序——实测本仓路由表里 `photos-place-assets` 会排在 `photos-places`
  // **之前**(因为前者带 `:key` 动态段),用 `getRoutes()` 下标断言"排在之后"必然是假的
  // 红灯,与"追加不重排"这条硬约束本身无关(那是源文件层面的要求,为了 rebase 冲突最小化,
  // 不是运行时匹配优先级)。改为在**源文件文本**里断言:`/photos/places/:key` 那一行确实
  // 在 `/photos/places` 那一行之后追加,且两条都还在(没有被移动到别处)。
  it('源文件里 /photos/places/:key 追加在 /photos/places 那一行之后(不重排既有路由)', () => {
    const placesLine = routerSource.indexOf("path: '/photos/places',")
    const assetsLine = routerSource.indexOf("path: '/photos/places/:key',")
    expect(placesLine).toBeGreaterThanOrEqual(0)
    expect(assetsLine).toBeGreaterThan(placesLine)
  })

  it('真实 push 到 /photos/places/9 之后 currentRoute.name 确实是 photos-place-assets(不是仅 spy push)', async () => {
    const router = makeRouter()
    await router.push('/photos/places/9')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('photos-place-assets')
    expect(router.currentRoute.value.params.key).toBe('9')
  })
})

describe('挂载即编排数据(参数归一 + T8 硬要求 2:面包屑从 key/spot 回源,不吃 URL 上的旧字符串)', () => {
  it('无 query → loadDetail("7") 与 assets.load("7", "", null, null)', async () => {
    await mountView('/photos/places/7')
    expect(svc.photos.getPlace).toHaveBeenCalledWith('7')
    expect(svc.photos.listAssetsByPlace).toHaveBeenCalledWith('7', '', 500, null, null)
  })

  it('带 spot/lat/lon query → assets.load("7", "s1", 30.1, 120.2)', async () => {
    svc.photos.getPlace.mockResolvedValue(rawPlace('7', {
      spots: [{ key: 's1', name: 'Shibuya Crossing', lat: 30.1, lon: 120.2, count: 5, thumb: '' }],
    }))
    await mountView('/photos/places/7?spot=s1&lat=30.1&lon=120.2')
    expect(svc.photos.listAssetsByPlace).toHaveBeenCalledWith('7', 's1', 500, 30.1, 120.2)
  })

  it('lat 非数字(lat=abc)→ 传 null,不把 NaN 带给后端', async () => {
    svc.photos.getPlace.mockResolvedValue(rawPlace('7', {
      spots: [{ key: 's1', name: 'Shibuya Crossing', lat: 30.1, lon: 120.2, count: 5, thumb: '' }],
    }))
    await mountView('/photos/places/7?spot=s1&lat=abc&lon=120.2')
    expect(svc.photos.listAssetsByPlace).toHaveBeenCalledWith('7', 's1', 500, null, 120.2)
  })

  it('标题:AreaShell 的 title 是 store.detail 回源的城市名(URL 上从不带 city 字符串)', async () => {
    svc.photos.getPlace.mockResolvedValue(rawPlace('7', { city: 'Kyoto' }))
    const { w } = await mountView('/photos/places/7')
    expect(w.find('.area-title').text()).toBe('Kyoto')
  })

  it('标题:详情尚未到位时回落 t("photosPlaces")("地点")', async () => {
    svc.photos.getPlace.mockReturnValue(new Promise(() => {})) // 永不 resolve
    const router = makeRouter()
    await router.push('/photos/places/7')
    await router.isReady()
    const w = mount(PhotosPlaceAssets, { global: { plugins: [i18n, router] } })
    await w.vm.$nextTick()
    expect(w.find('.area-title').text()).toBe(zh.photosPlaces)
  })
})

describe('路由参数变化重跑(SP6-P5.5 第 6 条教训:hash 路由同组件不重建,缺 watcher 会渲染陈旧数据)', () => {
  it('key 从 7 改到 9 → loadDetail/assets.load 各再调一次,且旧数据不残留', async () => {
    svc.photos.getPlace.mockImplementation((key: string) =>
      Promise.resolve(rawPlace(key, { city: key === '7' ? 'Tokyo' : 'Osaka' })))
    svc.photos.listAssetsByPlace.mockImplementation((key: string) => {
      if (key === '7') return Promise.resolve({ assets: [asset('a1'), asset('a2')] })
      return Promise.resolve({ assets: [asset('b1'), asset('b2'), asset('b3')] })
    })
    const { w, router } = await mountView('/photos/places/7')
    expect(w.findAll('.tile')).toHaveLength(2)
    expect(w.find('.area-title').text()).toBe('Tokyo')

    const getPlaceCallsBefore = svc.photos.getPlace.mock.calls.length
    const listCallsBefore = svc.photos.listAssetsByPlace.mock.calls.length

    await router.push('/photos/places/9')
    await flushPromises()
    await w.vm.$nextTick()

    expect(svc.photos.getPlace.mock.calls.length).toBe(getPlaceCallsBefore + 1)
    expect(svc.photos.listAssetsByPlace.mock.calls.length).toBe(listCallsBefore + 1)
    expect(svc.photos.getPlace).toHaveBeenLastCalledWith('9')
    expect(svc.photos.listAssetsByPlace).toHaveBeenLastCalledWith('9', '', 500, null, null)
    // 旧数据(2 张 a1/a2)不残留,网格换成新地点的 3 张 b1/b2/b3。
    expect(w.findAll('.tile')).toHaveLength(3)
    expect(w.find('.area-title').text()).toBe('Osaka')
  })
})

describe('面包屑(照 Vue2 PhotosTimeline.vue:1073-1090 的信息层级)', () => {
  it('无 spot → 城市段是 span(不是 button)', async () => {
    const { w } = await mountView('/photos/places/7')
    expect(w.find('[data-test="place-crumb-city-span"]').exists()).toBe(true)
    expect(w.find('[data-test="place-crumb-city-btn"]').exists()).toBe(false)
    expect(w.find('[data-test="place-crumb-spot"]').exists()).toBe(false)
  })

  it('有 spot 且详情里能按 key 找到 → 城市段是 button + spot 名 + 右尖角', async () => {
    svc.photos.getPlace.mockResolvedValue(rawPlace('7', {
      spots: [{ key: 's1', name: 'Shibuya Crossing', lat: 30.1, lon: 120.2, count: 5, thumb: '' }],
    }))
    const { w } = await mountView('/photos/places/7?spot=s1&lat=30.1&lon=120.2')
    expect(w.find('[data-test="place-crumb-city-btn"]').exists()).toBe(true)
    expect(w.find('[data-test="place-crumb-city-span"]').exists()).toBe(false)
    expect(w.find('[data-test="place-crumb-spot"]').text()).toBe('Shibuya Crossing')
    expect(w.find('.crumb-chev').exists()).toBe(true)
  })

  it('点城市段 → router.replace 到无 query 的同 path', async () => {
    svc.photos.getPlace.mockResolvedValue(rawPlace('7', {
      spots: [{ key: 's1', name: 'Shibuya Crossing', lat: 30.1, lon: 120.2, count: 5, thumb: '' }],
    }))
    const { w, router } = await mountView('/photos/places/7?spot=s1&lat=30.1&lon=120.2')
    await w.find('[data-test="place-crumb-city-btn"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos/places/7')
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('照片计数 = photosPlacesPhotoCount({n: photos.length})', async () => {
    svc.photos.listAssetsByPlace.mockResolvedValue({ assets: [asset('a1'), asset('a2')] })
    const { w } = await mountView('/photos/places/7')
    expect(w.find('[data-test="place-crumb-count"]').text()).toBe('2 张照片')
  })
})

describe('spot 找不到时静默降级(照 Vue2 PhotosTimeline.vue:547-551,不弹 toast)', () => {
  it('query 有 spot=zzz、详情 spots 里没有 → 不出现 spot 段,router.replace 清掉 spot/lat/lon', async () => {
    svc.photos.getPlace.mockResolvedValue(rawPlace('7', {
      spots: [{ key: 's1', name: 'Shibuya Crossing', lat: 30.1, lon: 120.2, count: 5, thumb: '' }],
    }))
    const { w, router } = await mountView('/photos/places/7?spot=zzz&lat=1&lon=2')
    await flushPromises()
    expect(w.find('[data-test="place-crumb-spot"]').exists()).toBe(false)
    expect(w.find('[data-test="place-crumb-city-span"]').exists()).toBe(true) // 已降级为整城 leaf
    expect(router.currentRoute.value.query.spot).toBeUndefined()
    expect(router.currentRoute.value.query.lat).toBeUndefined()
    expect(router.currentRoute.value.query.lon).toBeUndefined()
  })
})

describe('三态门控', () => {
  it('loading && !loaded → 骨架', async () => {
    svc.photos.listAssetsByPlace.mockReturnValue(new Promise(() => {}))
    const router = makeRouter()
    await router.push('/photos/places/7')
    await router.isReady()
    const w = mount(PhotosPlaceAssets, { global: { plugins: [i18n, router] } })
    await w.vm.$nextTick()
    expect(w.find('[data-test="place-assets-skeleton"]').exists()).toBe(true)
    expect(w.find('[data-test="place-assets-failed"]').exists()).toBe(false)
    expect(w.find('[data-test="place-assets-empty"]').exists()).toBe(false)
  })

  it('failed → 失败文案 + 重试钮,点重试再调 load', async () => {
    svc.photos.listAssetsByPlace.mockRejectedValueOnce(new Error('network down'))
    const { w } = await mountView('/photos/places/7')
    expect(w.find('[data-test="place-assets-failed"]').exists()).toBe(true)
    expect(w.text()).toContain(zh.photosPlacesLoadFailed)

    const before = svc.photos.listAssetsByPlace.mock.calls.length
    svc.photos.listAssetsByPlace.mockResolvedValue({ assets: [asset('a1')] })
    await w.find('[data-test="place-assets-retry"]').trigger('click')
    await flushPromises()
    expect(svc.photos.listAssetsByPlace.mock.calls.length).toBe(before + 1)
    expect(w.find('[data-test="place-assets-failed"]').exists()).toBe(false)
    expect(w.findAll('.tile')).toHaveLength(1)
  })

  it('loaded 且零照片 → 复用既有空态文案', async () => {
    svc.photos.listAssetsByPlace.mockResolvedValue({ assets: [] })
    const { w } = await mountView('/photos/places/7')
    expect(w.find('[data-test="place-assets-empty"]').exists()).toBe(true)
    expect(w.text()).toContain(zh.photosNoPhotos)
    expect(w.text()).toContain(zh.photosNoPhotosHint)
  })
})

describe('网格 + 灯箱', () => {
  it('months 透传给 PhotosGrid;selectable 传的是 false(D10:不接多选)', async () => {
    const { w } = await mountView('/photos/places/7')
    const grid = w.findComponent(PhotosGrid)
    expect(grid.exists()).toBe(true)
    expect(grid.props('selectable')).toBe(false)
    const months = grid.props('months') as Array<{ photos: Array<{ id: string | number }> }>
    expect(months.flatMap((m) => m.photos).map((p) => p.id)).toEqual(['a1', 'a2'])
  })

  it('不传 selectable 时本页也确实不渲染复选框(D10 落地断言)', async () => {
    const { w } = await mountView('/photos/places/7')
    expect(w.find('.tile-check').exists()).toBe(false)
  })

  it('PhotosGrid emit open → lb.openAt 收到的 list 是整页 photos(D9 翻页集)', async () => {
    const { w } = await mountView('/photos/places/7')
    await w.find('.tile').trigger('click')
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.list.value.map((p) => p.id)).toEqual(['a1', 'a2'])
  })
})
