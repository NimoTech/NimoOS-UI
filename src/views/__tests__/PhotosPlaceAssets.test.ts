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
import { createRouter, createWebHashHistory } from 'vue-router'
// 源文件文本(Vite `?raw` 导入,类型来自 node_modules/vite/client.d.ts:243,不依赖 @types/node)。
// 【SP8-P6 T10 订正】原文尾巴「本仓本就没有装它」已不成立 —— 合流后 `@types/node` 已装
// (devDependencies `^26.1.2`)。本行结论不变:`?raw` 对 **`.ts`/`.vue`** 有效且只需 vite/client;
// 换句话说这里用 `?raw` 不是被迫,而是够用。(⚠️ `?raw` 对 **`.css`/`.scss`** 才是恒空的坑。)
// 用途见下方"追加不重排"用例的注释。
import routerSource from '../../router/index.ts?raw'
// 评审 I1:面包屑图标 glyph 回源核对同样只能读源文件文本判定(同上一条 ?raw 手法)。
import photosPlaceAssetsRaw from '../PhotosPlaceAssets.vue?raw'
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
// P7b-T5:FilterBar 消费(D19)。
import PhotosFilterBar from '../../photos/components/PhotosFilterBar.vue'
import { usePhotosPlaces } from '../../photos/stores/places'
import { useLightbox } from '../../photos/lightbox/useLightbox'
import { router as appRouter } from '../../router'

const lb = useLightbox()
// P7b-T5(全局约束 4):不再自建 createI18n 实例——vitest.setup.ts 已把 src/i18n 单例装进
// config.global.plugins,对每次 mount 生效;这里此前另建的第二份实例会与它重复安装,
// 每条用例刷 7 条 [Vue warn](本期 T3/T4 已踩过、已修同款问题)。删掉后下面三处 mount 调用的
// `global.plugins` 也一并去掉这个局部 i18n,只留 router——locale 仍回落 zh_cn(jsdom 下
// localStorage 为空),既有中文文案断言不受影响。

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
  const w = mount(PhotosPlaceAssets, { global: { plugins: [router] } })
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

// Task 1 (Plan E re-shell): brief's Step 1 RED test — the transitional AreaShell/.photos-layout
// shell has been swapped for the same `.photos-root > .app[data-collapsed] > PhotosSidebar +
// main.main > PhotosTopbar + .photos-main` structure every other re-shelled Photos page uses
// (PhotosPeople.vue/PhotosAlbums.vue's own precedent, PhotosPeople.test.ts's own re-shell test
// as the style reference).
describe('PhotosPlaceAssets.vue —— 换壳(Plan E Task 1)', () => {
  it('mounts the app shell: .photos-root .app exists, PhotosTopbar title=city name with no sub, lightbox outside', async () => {
    svc.photos.getPlace.mockResolvedValue(rawPlace('7', { city: 'Kyoto' }))
    const { w } = await mountView('/photos/places/7')
    expect(w.find('.photos-root .app').exists()).toBe(true)

    const topbar = w.findComponent({ name: 'PhotosTopbar' })
    expect(topbar.exists()).toBe(true)
    expect(topbar.props('title')).toBe('Kyoto')
    // Vue2 has no dedicated topbar/sub for this detail context (see this file's own Task 1
    // header comment) — nothing is passed.
    expect(topbar.props('sub')).toBeUndefined()

    // PhotoLightbox stays a sibling of .photos-root (this app's standing exception, same rule
    // PhotosPeople.vue/PhotosPersonDetail.vue's own lightbox follows).
    const rootEl = w.find('.photos-root').element
    const lbComp = w.findComponent({ name: 'PhotoLightbox' })
    expect(rootEl.contains(lbComp.element)).toBe(false)
  })
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
  //
  // 评审 Minor(分工说明):`src/router/index.test.ts` 已有一条同款 `?raw` 源文本序断言,
  // 但它核的是**另一对**边界(`/photos/people/:id` → `/photos/places` → `/login`,P6a-T11
  // 那次追加时立的),从未覆盖本任务新增的 `/photos/places/:key` 落在哪——两条断言用的是
  // 同一种检验*手法*(`?raw` 文本序),但检验的是两次不同任务各自新增的路由边界,不是重复
  // 断言同一件事。刻意不去改 `router/index.test.ts`(不动既有断言),就近把这条放在本文件里。
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

  // 评审 I1:lat/lon 必须与 spotKey 成对,不能脱钩独立生效——照 Vue2
  // `_applyPlaceFromQuery`(PhotosTimeline.vue:538-545)只在 spot 命中时才赋坐标的语义。
  // 应用内导航碰不到这条(showWholeCity/spot 卡片都是三键一起清、一起带),但手改地址栏/
  // 旧书签会:`?lat=1&lon=2` 且**没有** `spot=` → lat/lon 必须都被压成 null,不能带着孤立坐标
  // 传给后端(违反共享包「lat/lon 与 spotKey 成对」的不变量)。
  it('有 lat/lon 但无 spot query → lat/lon 都被压成 null,spotKey 传空串', async () => {
    await mountView('/photos/places/7?lat=1&lon=2')
    expect(svc.photos.listAssetsByPlace).toHaveBeenCalledWith('7', '', 500, null, null)
  })

  it('标题:PhotosTopbar 的 title 是 store.detail 回源的城市名(URL 上从不带 city 字符串)', async () => {
    svc.photos.getPlace.mockResolvedValue(rawPlace('7', { city: 'Kyoto' }))
    const { w } = await mountView('/photos/places/7')
    expect(w.findComponent({ name: 'PhotosTopbar' }).props('title')).toBe('Kyoto')
  })

  it('标题:详情尚未到位时回落 t("photosPlaces")("地点")', async () => {
    svc.photos.getPlace.mockReturnValue(new Promise(() => {})) // 永不 resolve
    const router = makeRouter()
    await router.push('/photos/places/7')
    await router.isReady()
    const w = mount(PhotosPlaceAssets, { global: { plugins: [router] } })
    await w.vm.$nextTick()
    expect(w.findComponent({ name: 'PhotosTopbar' }).props('title')).toBe(zh.photosPlaces)
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
    expect(w.findComponent({ name: 'PhotosTopbar' }).props('title')).toBe('Tokyo')

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
    expect(w.findComponent({ name: 'PhotosTopbar' }).props('title')).toBe('Osaka')
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

describe('第二次加载期间旧数据不残留(评审 I2)', () => {
  it('key 从 7 改到 9,9 的响应还没到达前:页面走骨架分支,看不到 7 的旧照片网格', async () => {
    svc.photos.getPlace.mockImplementation((key: string) =>
      Promise.resolve(rawPlace(key, { city: key === '7' ? 'Tokyo' : 'Osaka' })))
    let resolveNine: (v: unknown) => void = () => {}
    svc.photos.listAssetsByPlace.mockImplementation((key: string) => {
      if (key === '7') return Promise.resolve({ assets: [asset('a1'), asset('a2')] })
      return new Promise((r) => { resolveNine = r })
    })
    const { w, router } = await mountView('/photos/places/7')
    expect(w.findAll('.tile')).toHaveLength(2)

    await router.push('/photos/places/9')
    await flushPromises()
    await w.vm.$nextTick()

    // 9 的响应还没到达——不该继续显示 7 的旧照片,应走骨架分支。
    expect(w.find('[data-test="place-assets-skeleton"]').exists()).toBe(true)
    expect(w.findAll('.tile')).toHaveLength(0)

    resolveNine({ assets: [asset('b1'), asset('b2'), asset('b3')] })
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.find('[data-test="place-assets-skeleton"]').exists()).toBe(false)
    expect(w.findAll('.tile')).toHaveLength(3)
  })
})

describe('面包屑图标 glyph 回源(评审 I1)', () => {
  it('.crumb-icon 是折叠地图(Vue2 PhotosIcon.vue name="map"),不是地图别针', () => {
    const m = /<svg class="crumb-icon"[^>]*>([\s\S]*?)<\/svg>/.exec(photosPlaceAssetsRaw)
    expect(m, '未找到 .crumb-icon 的 svg').not.toBeNull()
    expect(m![1]).toContain('M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z')
    expect(m![1]).toContain('M9 4v14M15 6v14')
    expect(m![1]).not.toContain('M12 21s-7-7.5-7-12')
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
    const w = mount(PhotosPlaceAssets, { global: { plugins: [router] } })
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

  // 评审 Minor 修正:原标题「不传 selectable 时…」措辞不准——本页模板其实**显式**传了
  // `:selectable="false"`(D10:不接多选),不是"没传"。这条断言真正验证的是 D10 语义本身
  // (复选框确实没渲染出来),标题改成反映这一点。
  it('D10 落地:本页显式传 selectable=false,复选框确实不渲染', async () => {
    const { w } = await mountView('/photos/places/7')
    expect(w.find('.tile-checkbox').exists()).toBe(false)
  })

  it('PhotosGrid emit open → lb.openAt 收到的 list 是整页 photos(D9 翻页集)', async () => {
    const { w } = await mountView('/photos/places/7')
    await w.find('.tile').trigger('click')
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.list.value.map((p) => p.id)).toEqual(['a1', 'a2'])
  })
})

// P7b-T5:跳库页接线 EXIF 筛选(D19:只留年份 + 相机两个胶囊,位置维度不出现——城市已经
// 被路由框定,再套一层位置文本筛选是误杀,回源 Vue2 PhotosTimeline.vue:167 spot 分支)。
describe('P7b-T5: EXIF 筛选接线(D19)', () => {
  // 夹具:两张照片跨两个年份(2023 / 2020),不落在任一测试断言用到的 1999 上——
  // 筛 years:['2023'] 命中 1 张(p1),筛 years:['1999'] 命中 0 张,地点总数恒为 2。
  // 复用既有 `asset()` 助手(id, takenAt)生产基础形状,再叠 placeName/make/model
  // (assetToPhoto.ts:319-321、367 分别读出 camera/place)。
  function placeFixtureAssets() {
    return [
      { ...asset('p1', '2023-06-15T10:00:00Z'), placeName: 'Tokyo', make: 'Canon', model: 'EOS R5' },
      { ...asset('p2', '2020-01-01T10:00:00Z'), placeName: 'Tokyo', make: 'Sony', model: 'A7' },
    ]
  }

  beforeEach(() => {
    svc.photos.listAssetsByPlace.mockReset().mockResolvedValue({ assets: placeFixtureAssets() })
  })

  // “已有助手”:brief 里的 `mountPlaceAssets()` 就是本文件既有的 `mountView(path)`——
  // 本文件历来没有一个叫 mountPlaceAssets 的助手,brief 用的是示意名,这里复用现成的那个,
  // 不新增并行的挂载脚手架。
  async function mountPlaceAssets() {
    return mountView('/photos/places/7')
  }

  it('D19:只渲染年份与相机两个胶囊,没有位置胶囊', async () => {
    const { w } = await mountPlaceAssets()
    const bar = w.findComponent(PhotosFilterBar)
    expect(bar.exists()).toBe(true)
    expect(bar.props('chipKeys')).toEqual(['years', 'cameras'])
    expect(w.find('[data-test="exif-chip-places"]').exists()).toBe(false)
    // fix round 1 必修 1(评审):props 断言逮不住"挂对了组件、挂错了位置"这类错误——
    // 把 <PhotosFilterBar> 挪到 .crumb-spacer 之前(实现者自己第一遍写错、靠肉眼对照 brief
    // 才发现的那个形态)上面三条断言依旧全绿,但界面上筛选条会从右侧跳到面包屑文字旁边:
    // .crumb-spacer{flex:1} 顶开的是"它之后"的内容,插在它之前 FilterBar 就贴着面包屑文字,
    // 不再贴着计数出现在右侧。用相邻兄弟选择器钉死 DOM 序:
    // .crumb-spacer 之后紧跟 .exif-filter(FilterBar 根节点),.exif-filter 之后紧跟
    // .crumb-count——中间的注释节点不影响 CSS 相邻兄弟选择器的判定。
    // 变异验证(已人工执行并复原,证据见 task-5-report.md「fix round 1」一节):把模板里
    // <PhotosFilterBar> 移到 <div class="crumb-spacer"> 之前 → 这两条断言双双转红
    // (crumb-spacer + exif-filter 与 exif-filter + crumb-count 均找不到匹配节点)→ 已复原。
    expect(w.find('.crumb-spacer + .exif-filter').exists()).toBe(true)
    expect(w.find('.exif-filter + .crumb-count').exists()).toBe(true)
  })

  // fix round(整期终审必修 I2):跳库页的 facet 源不变量此前一条断言都没有——时间线页
  // 那边(Photos.integration.test.ts「FilterBar 的 facet 源是全库 allPhotos,不随已生效的
  // 筛选收窄」)有专用回归锁,跳库页是裸的。`:photos="assets.photos.value"` 必须恒是未筛选
  // 集合,否则会出现计划书点名的那个 bug:筛掉一个年份后,该年份从下拉里消失、再也选不回来。
  // 与时间线页那条锁同型:先记下提交前的 facet 源长度,提交一次筛选,再确认 facet 源长度
  // 不变(FilterBar 收到的 photos prop 不随 gridMonths 收窄)。
  //
  // 变异验证(已人工执行并复原,证据见 task-5-report.md「整期终审修复波」一节):把模板里
  // PhotosFilterBar 的 `:photos="assets.photos.value"` 临时改成
  // `:photos="gridMonths.flatMap(m => m.photos)"` → 下面这条断言从 2 转红为 1(facet 源
  // 跟着筛选收窄了)→ 已复原。
  it('FilterBar 的 facet 源恒是未筛选的 assets.photos,不随已生效的筛选收窄', async () => {
    const { w } = await mountPlaceAssets()
    const bar = w.findComponent(PhotosFilterBar)
    const before = (bar.props('photos') as unknown[]).length
    expect(before).toBe(2) // 夹具算准:placeFixtureAssets() 两张。

    await bar.vm.$emit('update:filter', { years: ['2023'], places: [], cameras: [] })
    await w.vm.$nextTick()

    expect((w.findComponent(PhotosFilterBar).props('photos') as unknown[]).length).toBe(before)
  })

  // fix round(整期终审建议带上 M1):即便未来有代码(深链/store)往 exifFilter.places
  // 塞值,D19(跳库页只按年份/相机筛选)也必须在数据层自证——网格结果不能因为 places
  // 有值而收窄。回源 `PhotosPlaceAssets.vue` 的 gridMonths:改成显式投影
  // `{ years: exifFilter.value.years, cameras: exifFilter.value.cameras }` 之后,
  // `applyExifFilters` 根本读不到 places 键,即便它被塞值也不可能生效。
  it('M1:exifFilter.places 即便被塞值也不生效(D19 数据层自证,不只靠 UI 不渲染位置胶囊)', async () => {
    const { w } = await mountPlaceAssets()
    // 塞一个两张夹具资产的 place('Tokyo')都不匹配的值——若 places 被读取生效,结果会被
    // 筛成 0 张;若 places 被正确忽略(数据层自证),结果不受影响,仍是未筛选前的 2 张。
    await w.findComponent(PhotosFilterBar).vm.$emit(
      'update:filter', { years: [], places: ['某个不存在的地名'], cameras: [] })
    await w.vm.$nextTick()
    const months = w.findComponent(PhotosGrid).props('months') as Array<{ photos: unknown[] }>
    expect(months.flatMap((m) => m.photos)).toHaveLength(2) // 若 places 生效,这里会是 0。
  })

  it('筛选生效后网格只拿到命中的照片(空月份门控本身在这里是恒真——理由见下),灯箱翻页集也跟着收窄', async () => {
    // fix round 1 Minor 1(评审):原用例名承诺了"空月份被丢掉",但这是恒真断言——
    // groupPhotosByMonth(util/groupPhotosByMonth.ts:15-23)的桶遇到照片才创建,永不产出
    // 空桶,本页又是先筛后分组,PhotosPlaceAssets.vue 里那个 `.filter(m => m.photos.length
    // > 0)` 在这条调用链上结构性地不可能剔掉任何东西——删掉那个 .filter 这条用例也不会红。
    // 用例名已改口,不再承诺自己没验的事;下面 `months.every(...)` 这行仍然保留(它验证的
    // 是"命中的月份里确实有照片",不是"空月份被丢掉"这个不成立的命题)。
    const { w } = await mountPlaceAssets()
    await w.findComponent(PhotosFilterBar).vm.$emit(
      'update:filter', { years: ['2023'], places: [], cameras: [] })
    await w.vm.$nextTick()
    const months = w.findComponent(PhotosGrid).props('months') as Array<{ photos: unknown[] }>
    expect(months.every((m) => m.photos.length > 0)).toBe(true)
    // 夹具算准:2023 只命中 p1 一张(p2 是 2020)。
    expect(months.flatMap((m) => m.photos)).toHaveLength(1)

    // fix round 1 必修 2(评审,约束 5 / D9 同型的回归锁):灯箱翻页集必须跟着筛选收窄,
    // 不能是"筛选前"的整页 photos——p2(2020)被筛掉后,翻页集里不该还能翻到它。
    // 既有那条"emit open → list 是整页 photos"用例是零筛选场景,两张 asset 同月同桶,
    // assets.photos.value 与 gridMonths.flatMap 在该场景下同值同序,对这处改动不敏感,
    // 不能当作已有保护——这里补一条筛选生效后的直接断言。
    // 变异验证(已人工执行并复原,证据见 task-5-report.md):把 PhotosPlaceAssets.vue 里
    // onOpen 的 `gridMonths.value.flatMap(...)` 临时改回 `assets.photos.value` →
    // 下面这条断言从 `['p1']` 转红为 `['p1', 'p2']`(翻页集混入了被筛掉的 p2)→ 已复原。
    await w.find('.tile').trigger('click')
    await flushPromises()
    expect(lb.list.value.map((p) => p.id)).toEqual(['p1'])
  })

  // fix round(整期终审必修 I1,用例名改口):这条锁的是**门控走向**——筛到零时代码走的是
  // 下面的 v-else(PhotosGrid 自己渲染空网格),不经过 `place-assets-empty` 那个分支。但
  // 两条路径渲染出的空态文案逐字相同(都是 photosNoPhotos / photosNoPhotosHint,PhotosGrid
  // 自己的空态用的正是这两个键),用户看到的东西不会因为走哪条分支而不同——原用例名「不落到
  // 那个空态」暗示了"用户看到的不一样",这不成立,已改口。这条断言仍值得保留:它钉住的是
  // 「三态门控的空态判定必须读未筛选数据、不能因为筛选结果为空就误判整个地点没有资产」这个
  // 逻辑不变量,即便对用户不可见。
  it('筛到零时三态门控走 v-else(不经过 place-assets-empty 分支);面包屑计数仍是地点总数', async () => {
    const { w } = await mountPlaceAssets()
    await w.findComponent(PhotosFilterBar).vm.$emit(
      'update:filter', { years: ['1999'], places: [], cameras: [] })
    await w.vm.$nextTick()
    expect(w.find('[data-test="place-assets-empty"]').exists()).toBe(false)
    // fix round 1 Minor 2(评审):原来的 `.toContain('2')` 过松——夹具里 rawPlace() 默认
    // count:42(本文件 :66),如果计数被误改成读 store.detail.count 会渲染"42 张照片",
    // toContain('2') 仍然通过(因为 "42" 里含 "2")。改成精确匹配整串,钉死口径:计数读的
    // 必须是地点资产数组长度(2),不是详情里那个 count 字段。
    expect(w.get('[data-test="place-crumb-count"]').text()).toBe('2 张照片')
  })
})
