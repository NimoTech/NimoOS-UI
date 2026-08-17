// Task 11(SP7-P6a 地点·地图主视图,本期收官): PhotosPlaces.vue —— 容器,把前 10 个任务的
// 产物接成一个可用页面。逐条对应 task-11-brief.md 的「必含测试清单」+ 6 处删码验证。
//
// 挂 Pinia + i18n + 真实 router(spy push 不需要,AreaShell/PhotosSidebar 都用 useRouter(),
// 照 PhotosAlbums.test.ts/PhotosPeople.test.ts 的既有挂载套路),mock 共享包 photos 方法。
//
// pick-pin/hover-pin 两个交互直接对 PlacesMap 子组件 `vm.$emit(...)`,不依赖 SVG 内部的
// buildPins/clusterByOverlap 几何排布去反查某个具体图钉的 DOM 位置——那层几何已经在
// PlacesMap.test.ts/placesMap.test.ts 各自的单测里覆盖过,这里只验证"容器收到 emit 之后
// 接线是否正确",避免把聚类算法的实现细节耦合进这份集成测试里造成脆弱。
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    listPlaces: vi.fn(),
    getPlace: vi.fn().mockResolvedValue({}),
    thumbnailUrl: vi.fn((id: string | number, size?: string) => `mock://thumb/${id}/${size ?? ''}`),
    setPlaceCover: vi.fn().mockResolvedValue(undefined),
    resetPlaceCover: vi.fn().mockResolvedValue(undefined),
    setSpotName: vi.fn().mockResolvedValue(undefined),
    resetSpotName: vi.fn().mockResolvedValue(undefined),
    createPlaceAlbum: vi.fn().mockResolvedValue({ albumId: 'al1', name: 'x', count: 1 }),
    placeCoverCandidates: vi.fn().mockResolvedValue({ tabs: [], items: [], page: 0, totalPages: 1, total: 0 }),
    // ── P6b-T8: PhotoLightbox 挂载 + useLightbox.openAt() 链路需要(D9)。 ──
    getAsset: vi.fn().mockResolvedValue({}),
    getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
    recordView: vi.fn().mockResolvedValue(undefined),
    listFavoriteIds: vi.fn().mockResolvedValue([]),
    originalUrl: vi.fn((id: string | number) => `mock://original/${id}`),
    liveUrl: vi.fn((id: string | number) => `mock://live/${id}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// jsdom 无媒体栈(PhotoLightbox 挂载即引用,同 PhotosPersonDetail.test.ts 前置)。
;(HTMLMediaElement.prototype as unknown as { play: () => Promise<void> }).play = vi.fn(() => Promise.resolve())
;(HTMLMediaElement.prototype as unknown as { pause: () => void }).pause = vi.fn()

import PhotosPlaces from '../PhotosPlaces.vue'
import photosPlacesRaw from '../PhotosPlaces.vue?raw'
import PlacesRail from '../../photos/components/PlacesRail.vue'
import PlacesMap from '../../photos/components/PlacesMap.vue'
import PlacesZoomBar from '../../photos/components/PlacesZoomBar.vue'
import PlacesFilterMenu from '../../photos/components/PlacesFilterMenu.vue'
import PlacesThemeMenu from '../../photos/components/PlacesThemeMenu.vue'
import PlaceDetailPanel from '../../photos/components/PlaceDetailPanel.vue'
import PlaceCoverPicker from '../../photos/components/PlaceCoverPicker.vue'
import { usePhotosPlaces } from '../../photos/stores/places'
import { useLightbox } from '../../photos/lightbox/useLightbox'
import { useToast } from '../../stores/toast'
import { usePhotosToast } from '../../photos/composables/usePhotosToast'
import { extractStyleBlock, parseCssRules } from '../../photos/components/__tests__/cssCascade'
import { MAP_H, MAP_W, project } from '../../photos/util/worldMap'
import type { Pin } from '../../photos/util/placesMap'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/photos/places', name: 'photos-places', component: PhotosPlaces },
    ],
  })
}

// Fix-1 item 5 fallout fix (2026-08-16): `createAlbum()` now fires a real
// `usePhotosToast().show()` — unlike the generic Pinia-scoped `useToast()` this replaced,
// `usePhotosToast()`'s underlying `toasts` ref is a true module-level singleton, shared by
// EVERY `mountView()` call in this file. None of this file's ~40+ `mountView()` calls were
// ever explicitly unmounted (the shared `afterEach` below only wiped `document.body.innerHTML`
// for PlaceCoverPicker's Teleport target, never called `.unmount()`) — harmless as long as
// nothing ever mutated a truly-global ref that those abandoned instances' own `<PhotosToastHost/>`
// (Teleported to `document.body`) were still reactively watching. The album-toast tests below
// are the first thing in this file to actually mutate that global ref for real, which woke up
// every previously-abandoned instance's reactive effect on the very next render tick — each
// tried to patch back into a `document.body` that a *later* test's `afterEach` had already
// wiped out from under it (`Cannot read properties of null (reading 'insertBefore')`,
// surfacing in the unrelated "三浮层同开时一次 Esc" test purely by being next in file order).
// Fix: track every mounted wrapper and actually unmount it after each test, closing the leak
// at its source instead of only patching around the one symptom.
const mountedWrappers: Array<{ unmount: () => void }> = []
async function mountView() {
  const router = makeRouter()
  router.push('/photos/places')
  await router.isReady()
  const w = mount(PhotosPlaces, { global: { plugins: [i18n, router] } })
  mountedWrappers.push(w)
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

// ── 地点原始(后端)fixture ──────────────────────────────────────────────────
// TOKYO(9990)+PARIS(2345)+CLUSTER_A(5)+CLUSTER_B(5) = 12345,专为「toLocaleString 千分位」
// 用例凑的总数;CLUSTER_A/CLUSTER_B 坐标极近(同 PlacesMap.test.ts 的既有先例),用于
// zoomToCluster 集成场景下 splitScaleFor 有真实可裂的两个成员。
const TOKYO = { key: 1, region: 'asia', country: 'Japan', city: 'Tokyo', lon: 139.7, lat: 35.7, count: 9990, recent: false, last: 'Jan 5, 2026', trips: 2, home: false, thumbs: ['t1'], coverAssetId: '' }
const PARIS = { key: 2, region: 'europe', country: 'France', city: 'Paris', lon: 2.35, lat: 48.85, count: 2345, recent: true, last: 'Jun 10, 2026', trips: 1, home: false, thumbs: ['t2'], coverAssetId: 'p2' }
const CLUSTER_A = { key: 3, region: 'americas', country: 'X', city: 'Cluster A', lon: 10, lat: 10, count: 5, recent: false, last: 'Feb 1, 2026', trips: 1, home: false, thumbs: [], coverAssetId: '' }
const CLUSTER_B = { key: 4, region: 'americas', country: 'X', city: 'Cluster B', lon: 10.01, lat: 10.01, count: 5, recent: false, last: 'Feb 2, 2026', trips: 1, home: false, thumbs: [], coverAssetId: '' }
const RAW_PLACES = [TOKYO, PARIS, CLUSTER_A, CLUSTER_B]
const REGIONS = [
  { id: 'asia', label: 'Asia', count: 1 },
  { id: 'europe', label: 'Europe', count: 1 },
  { id: 'americas', label: 'Americas', count: 2 },
]

function okListPlaces() {
  return Promise.resolve({ places: RAW_PLACES, regions: REGIONS, stats: { cities: 4, countries: 3, photos: 12345 } })
}

// ---- 假 requestAnimationFrame:收集回调,手动以任意大的 now 一次性 flush 到动画终点
// (同 usePlacesView.test.ts 的既有先例,不用 vi.useFakeTimers() 驱动)。----
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
  svc.photos.getPlace.mockReset().mockResolvedValue({})
  svc.photos.thumbnailUrl.mockClear()
  svc.photos.setPlaceCover.mockReset().mockResolvedValue(undefined)
  svc.photos.resetPlaceCover.mockReset().mockResolvedValue(undefined)
  svc.photos.setSpotName.mockReset().mockResolvedValue(undefined)
  svc.photos.resetSpotName.mockReset().mockResolvedValue(undefined)
  svc.photos.createPlaceAlbum.mockReset().mockResolvedValue({ albumId: 'al1', name: 'x', count: 1 })
  svc.photos.placeCoverCandidates.mockReset().mockResolvedValue({ tabs: [], items: [], page: 0, totalPages: 1, total: 0 })
  useLightbox().__resetForTest()
  // Fix-1 item 5: usePhotosToast() is a module-level singleton (same pattern as
  // useLightbox() above) — reset between tests so one test's queued toast doesn't leak
  // into the next test's assertions.
  usePhotosToast().__resetForTests()
})
afterEach(() => {
  vi.restoreAllMocks()
  // Fix-1 item 5 fallout fix: actually unmount every wrapper `mountView()` created THIS test
  // (see that function's own comment for why this matters now) — must run before the
  // `document.body.innerHTML` wipe below, not after, so `.unmount()` gets a chance to tear
  // down each instance's own Teleport content cleanly first.
  for (const w of mountedWrappers.splice(0)) w.unmount()
  // Task 2 (Plan E): PlaceCoverPicker now Teleports to `document.body` — clear it between
  // tests so a still-open picker from one test doesn't leak into the next test's queries.
  document.body.innerHTML = ''
})

// PlaceCoverPicker Teleports its content to `document.body` (Task 2, Plan E) — queries for
// its own DOM (e.g. `[data-test="cp-scrim"]`) must go through `document.body` directly, not
// through the page wrapper's own subtree (same PhotosToastHost.test.ts idiom).
const body = () => new DOMWrapper(document.body)

// 一次性把在途动画“瞬移”到终点(ease(k=1)):真实场景下 420ms 后必然到达,这里跳过等待。
function flushAnim(): void {
  const cbs = rafCallbacks.splice(0)
  for (const cb of cbs) cb(performance.now() + 100000)
}

// Task 1 (Plan E re-shell): brief's Step 1 RED test — the transitional AreaShell/.photos-layout
// shell has been swapped for the same `.photos-root > .app[data-collapsed] > PhotosSidebar +
// main.main > PhotosTopbar + .photos-main` structure every other re-shelled Photos page uses
// (PhotosPeople.vue/PhotosAlbums.vue's own precedent, PhotosPeople.test.ts's own re-shell test
// as the style reference).
describe('PhotosPlaces.vue —— 换壳(Plan E Task 1)', () => {
  it('mounts the app shell: .photos-root .app exists, PhotosTopbar title/sub, FilterMenu/ThemeMenu inside root, lightbox outside', async () => {
    const { w } = await mountView()
    expect(w.find('.photos-root .app').exists()).toBe(true)

    const topbar = w.findComponent({ name: 'PhotosTopbar' })
    expect(topbar.exists()).toBe(true)
    expect(topbar.props('title')).toBe(zh.photosPlaces)
    // sub mirrors Vue2 PhotosPlacesTopbar.vue's own subtitle (cities/countries counts)
    expect(String(topbar.props('sub'))).toContain('城市')
    expect(String(topbar.props('sub'))).toContain('国家')

    // PlacesFilterMenu/PlacesThemeMenu were already rendered in-tree before the re-shell —
    // still true afterwards, now as descendants of `.photos-root` (inside `.photos-main`).
    const root = w.find('.photos-root')
    expect(root.findComponent(PlacesFilterMenu).exists()).toBe(true)
    expect(root.findComponent(PlacesThemeMenu).exists()).toBe(true)

    // Plan F Task 5 (2026-08-15): PhotoLightbox re-nested INSIDE .photos-root -- the re-skin
    // (Tasks 3-4) removed the scoped-vs-parity cascade tie that made nesting unsafe (F8-r4).
    const rootEl = w.find('.photos-root').element
    const lbComp = w.findComponent({ name: 'PhotoLightbox' })
    expect(rootEl.contains(lbComp.element)).toBe(true)
  })
})

describe('首屏加载 + 自动选中', () => {
  it('onMounted 调 fetchPlaces;加载完自动选中第一个地点', async () => {
    const { w } = await mountView()
    expect(svc.photos.listPlaces).toHaveBeenCalledTimes(1)
    expect(w.findComponent(PlacesRail).props('activeId')).toBe('1')
    expect(w.findComponent(PlacesMap).props('activeId')).toBe('1')
  })

  // P6b-T8 评审修复:hasDetailPanel 换真实状态后,首屏自动选中即让 activePlace 命中
  // (place 存在即 hasPanel=true),原先假定"正中心"的数值不再成立——wrapEl 是真实 DOM
  // 节点,jsdom 默认 getBoundingClientRect 恒返回全 0,`420/0=Infinity` 被
  // `Math.min(0.55, …)` 钳到 0.55(不是 T8 新增的两条 usePlacesView 用例里手算的
  // 0.42——那两条显式 mock 了 wrapEl 宽 1000)。tx 的换算随之改用 panelFrac=0.55 时的
  // c.x=225;ty 公式不受影响(panelFrac 只改 x,见 usePlacesView.ts:98-99)。
  it('自动选中后 autoPanTo 被调用,入参是第一个地点(TOKYO)——按 view 的 tx/ty/scale 精确核验', async () => {
    const { w } = await mountView()
    // autoPanTo → centerOn → animateView 已经同步排了一个 raf 回调,flush 它让缓动直接到终点。
    expect(rafCallbacks.length).toBeGreaterThan(0)
    flushAnim()
    await w.vm.$nextTick()
    const view = w.findComponent(PlacesMap).props('view') as { tx: number, ty: number, scale: number }
    // centerOn(wx,wy,scale) 的换算:c = visibleCenterVb()(hasDetailPanel 此刻为真——首屏
    // 自动选中的地点即是 activePlace;wrapEl 未 mock 宽度,panelFrac 钳到 0.55,
    // c.x = 1000*(1-0.55)/2 = 225,c.y 仍是 MAP_H/2),scale = max(1, 1.8) = 1.8,
    // tx = c.x - wx*scale,ty = c.y - wy*scale。
    const { x: wx, y: wy } = project(TOKYO.lon, TOKYO.lat)
    expect(view.scale).toBeCloseTo(1.8, 5)
    expect(view.tx).toBeCloseTo(225 - wx * 1.8, 3)
    expect(view.ty).toBeCloseTo(MAP_H / 2 - wy * 1.8, 3)
  })
})

describe('activeId 切换 → loadDetail(P6b 接缝守卫)', () => {
  it('切换到另一个地点时 loadDetail 用解析出的后端 key 调用 getPlace', async () => {
    const { w } = await mountView()
    await flushPromises()
    expect(svc.photos.getPlace).toHaveBeenCalledWith(1) // 首屏自动选中 TOKYO(key=1)
    svc.photos.getPlace.mockClear()

    const pin: Pin = { id: '2', x: 0, y: 0, r: 10, hitR: 10, count: PARIS.count, city: PARIS.city, country: PARIS.country, thumbs: PARIS.thumbs, coverAssetId: PARIS.coverAssetId, recent: PARIS.recent, cluster: false, active: false }
    await w.findComponent(PlacesMap).vm.$emit('pick-pin', pin, new MouseEvent('click'))
    await flushPromises()
    expect(w.findComponent(PlacesRail).props('activeId')).toBe('2')
    expect(svc.photos.getPlace).toHaveBeenCalledWith(2) // PARIS(key=2)
  })
})

describe('过滤联动:rail 与 map 收到同一份过滤后地点,rail 的搜索不影响 map', () => {
  it('minCount=50 之后,rail 与 map 的 places 都从 4 个收窄到 2 个', async () => {
    const { w } = await mountView()
    expect(w.findComponent(PlacesRail).props('places')).toHaveLength(4)
    expect(w.findComponent(PlacesMap).props('places')).toHaveLength(4)

    await w.find('[data-test="pfm-chip"]').trigger('click')
    const btns = w.findAll('[data-test="pfm-mincount-btn"]')
    await btns[2].trigger('click') // MIN_COUNT_STEPS = [0,10,50,100,200],下标 2 = 50

    expect(w.findComponent(PlacesRail).props('places')).toHaveLength(2)
    expect(w.findComponent(PlacesMap).props('places')).toHaveLength(2)
  })

  it('rail 内部搜索词变化,map 的 places prop 不变(核 Vue2 :229/:237)', async () => {
    const { w } = await mountView()
    const before = w.findComponent(PlacesMap).props('places')
    await w.find('.map-search input').setValue('nonexistent-city-xyz')
    await w.vm.$nextTick()
    expect(w.findComponent(PlacesMap).props('places')).toBe(before)
    expect(w.findComponent(PlacesMap).props('places')).toHaveLength(4)
  })

  // 评审 I3:rail 的空态分流靠容器传的 totalPlaces(未过滤全量)——筛选条件把
  // filteredPlaces 收窄到零之后,totalPlaces 仍必须是全量长度,不能跟着筛选结果一起归零
  // (否则 rail 会分流错分支,显示"还没有位置数据"而不是"没有符合当前筛选条件的城市")。
  it('minCount + regionFilter 叠加收窄到零结果后,rail 收到的 totalPlaces 仍是全量长度(4)', async () => {
    const { w } = await mountView()
    await w.find('[data-test="pfm-chip"]').trigger('click')
    const btns = w.findAll('[data-test="pfm-mincount-btn"]')
    // MIN_COUNT_STEPS = [0,10,50,100,200],下标 4 = 200:先把 CLUSTER_A/B(count=5)收窄掉,
    // 留下 TOKYO(9990)/PARIS(2345)。
    await btns[4].trigger('click')
    // 再叠加大洲筛选到 americas——TOKYO 是 asia、PARIS 是 europe,两者都不是 americas,
    // 与上面的 minCount 条件取交集后四个 fixture 全部被过滤掉,filteredPlaces 归零。
    await w.find('[data-test="pfm-region-btn"][data-region-id="americas"]').trigger('click')
    expect(w.findComponent(PlacesRail).props('places')).toHaveLength(0)
    expect(w.findComponent(PlacesRail).props('totalPlaces')).toBe(4)
  })
})

describe('pick-pin 接线(Vue2 :736-743)', () => {
  it('簇图钉 → zoomToCluster 被调(view.scale 变化,以 CLUSTER_A/B 两个真实成员驱动 splitScaleFor)', async () => {
    const { w } = await mountView()
    flushAnim() // 先把首屏自动选中触发的那次缓动清空,避免混进下面的断言
    await w.vm.$nextTick()

    const store = usePhotosPlaces()
    const memberA = store.places.find((p) => p.id === '3')!
    const memberB = store.places.find((p) => p.id === '4')!
    const clusterPin: Pin = {
      id: 'cluster:3', x: 0, y: 0, r: 10, hitR: 10, count: 10,
      city: 'Cluster A', country: 'X', thumbs: [], coverAssetId: '',
      recent: false, cluster: true, active: false, members: [memberA, memberB],
    }
    await w.findComponent(PlacesMap).vm.$emit('pick-pin', clusterPin, new MouseEvent('click'))
    expect(rafCallbacks.length).toBeGreaterThan(0)
    flushAnim()
    await w.vm.$nextTick()

    const view = w.findComponent(PlacesMap).props('view') as { scale: number }
    // 当前 scale 是 1(容器初始值,前一次 autoPan 已被上面 flushAnim 清空未产生新调用——
    // 实际上此刻 view.scale 已经是 1.8,zoomToCluster 的目标是 max(currentScale+0.01, splitScaleFor(...))
    // >= 1.81,断言"确实继续变大了"即可,不依赖 splitScaleFor 的具体数值(那是 T2/T7 自己的单测范围)。
    expect(view.scale).toBeGreaterThan(1.8)
    // activeId 不应该因为点了簇而改变(簇没有单一 id)。
    expect(w.findComponent(PlacesRail).props('activeId')).toBe('1')
  })

  it('非簇图钉 → activeId 变成 pin.id', async () => {
    const { w } = await mountView()
    const pin: Pin = { id: '2', x: 0, y: 0, r: 10, hitR: 10, count: PARIS.count, city: PARIS.city, country: PARIS.country, thumbs: PARIS.thumbs, coverAssetId: PARIS.coverAssetId, recent: PARIS.recent, cluster: false, active: false }
    await w.findComponent(PlacesMap).vm.$emit('pick-pin', pin, new MouseEvent('click'))
    expect(w.findComponent(PlacesRail).props('activeId')).toBe('2')
    expect(w.findComponent(PlacesMap).props('activeId')).toBe('2')
  })
})

describe('悬停卡片(Vue2 :1013-1028,tip 定位用显式 wrapEl,偏离登记 10)', () => {
  function mockCurrentTarget(): Element {
    const el = document.createElement('div')
    el.getBoundingClientRect = () => ({ left: 100, top: 200, right: 110, bottom: 210, width: 10, height: 10, x: 100, y: 200, toJSON: () => ({}) }) as DOMRect
    return el
  }
  function pinFor(raw: typeof PARIS, id: string): Pin {
    return { id, x: 0, y: 0, r: 10, hitR: 10, count: raw.count, city: raw.city, country: raw.country, thumbs: raw.thumbs, coverAssetId: raw.coverAssetId, recent: raw.recent, cluster: false, active: false }
  }

  it('hover 非选中地点 → tip 出现,文案含城市/国家/照片数', async () => {
    const { w } = await mountView() // 首屏已自动选中 '1'(TOKYO)
    const ev = { currentTarget: mockCurrentTarget() } as unknown as MouseEvent
    await w.findComponent(PlacesMap).vm.$emit('hover-pin', pinFor(PARIS, '2'), ev)
    await w.vm.$nextTick()
    const tip = w.find('[data-test="map-tip"]')
    expect(tip.exists()).toBe(true)
    expect(tip.text()).toContain('Paris')
    expect(tip.text()).toContain('France')
    expect(tip.text()).toContain('2345 张照片') // photosPlacesPhotoCount({n: 2345}),不走 toLocaleString(照 Vue2 :1025)
  })

  it('hover 当前选中地点 → tip 不出现', async () => {
    const { w } = await mountView() // activeId 已是 '1'
    const ev = { currentTarget: mockCurrentTarget() } as unknown as MouseEvent
    await w.findComponent(PlacesMap).vm.$emit('hover-pin', pinFor(TOKYO as unknown as typeof PARIS, '1'), ev)
    await w.vm.$nextTick()
    expect(w.find('[data-test="map-tip"]').exists()).toBe(false)
  })

  it('hover-clear → tip 消失', async () => {
    const { w } = await mountView()
    const ev = { currentTarget: mockCurrentTarget() } as unknown as MouseEvent
    await w.findComponent(PlacesMap).vm.$emit('hover-pin', pinFor(PARIS, '2'), ev)
    await w.vm.$nextTick()
    expect(w.find('[data-test="map-tip"]').exists()).toBe(true)
    await w.findComponent(PlacesMap).vm.$emit('hover-clear')
    await w.vm.$nextTick()
    expect(w.find('[data-test="map-tip"]').exists()).toBe(false)
  })
})

describe('图例 + 统计', () => {
  it('图例四组齐备;第四组文案是 i18n 字典真实值「本次旅行」(brief 转述"当前行程"与字面值有出入,已回源确认);三个数字字面量都在', async () => {
    const { w } = await mountView()
    const legend = w.find('[data-test="map-legend"]')
    expect(legend.findAll('.grp')).toHaveLength(4)
    expect(legend.text()).toContain('< 40')
    expect(legend.text()).toContain('40–100')
    expect(legend.text()).toContain('100+')
    expect(legend.text()).toContain('本次旅行')
  })

  it('统计三项;照片数走 toLocaleString(总数 12345 → 出现千分位 "12,345")', async () => {
    const { w } = await mountView()
    const stats = w.find('[data-test="map-stats"]')
    const values = stats.findAll('.v').map((n) => n.text())
    expect(values).toEqual(['4', '3', '12,345'])
  })

  // 评审 M3:第四组绿色不能靠"恰好写在样式块后面"赢过基类 `.map-legend .dot`——两条选择器
  // 的优先级必须真的不相等(第四组选择器多带一个 class),不依赖源码书写顺序。
  it('第四组的选择器优先级真的高于基类 .map-legend .dot(不靠源码顺序苟活)', () => {
    const rules = parseCssRules(extractStyleBlock(photosPlacesRaw))
    const classCount = (selector: string) => (selector.match(/\.[\w-]+/g) ?? []).length
    const base = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.map-legend .dot')
    const trip = rules.find((r) => r.selectors.some((s) => s.includes('dot-trip')))
    expect(base, '基类 .map-legend .dot 规则未找到').toBeTruthy()
    expect(trip, '第四组 dot-trip 规则未找到').toBeTruthy()
    const tripSelector = trip!.selectors.find((s) => s.includes('dot-trip'))!
    expect(classCount(tripSelector)).toBeGreaterThan(classCount(base!.selectors[0]))
  })
})

describe('加载失败态', () => {
  it('fetchPlaces 失败 → 出现失败文案 + 重试按钮;点重试再调一次 fetchPlaces', async () => {
    svc.photos.listPlaces.mockRejectedValueOnce(new Error('network down'))
    const { w } = await mountView()
    expect(w.find('[data-test="places-failed"]').exists()).toBe(true)
    expect(w.text()).toContain('地点加载失败')
    expect(w.find('[data-test="places-skeleton"]').exists()).toBe(false)

    svc.photos.listPlaces.mockImplementationOnce(okListPlaces)
    await w.find('[data-test="places-retry"]').trigger('click')
    await flushPromises()
    expect(svc.photos.listPlaces).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="places-failed"]').exists()).toBe(false)
  })

  // 评审 I4:Vue2 把"没有选中项就选 places[0]"放在 loadPlaces() 内部,所以每一次成功加载
  // (不只是第一次)都会自动选中并 autoPan、触发 loadDetail。retryLoad 之前只调
  // store.fetchPlaces(),漏了这一步——首屏失败、点重试后第二次成功,会出现"rail 列满
  // 城市、地图画出图钉,但没有任何城市被选中"的落点不一致。
  it('首次 fetchPlaces 失败 → 点重试 → 第二次成功后自动选中第一个地点并调用 loadDetail', async () => {
    svc.photos.listPlaces.mockRejectedValueOnce(new Error('network down'))
    const { w } = await mountView()
    expect(w.find('[data-test="places-failed"]').exists()).toBe(true)
    expect(svc.photos.getPlace).not.toHaveBeenCalled()

    svc.photos.listPlaces.mockImplementationOnce(okListPlaces)
    await w.find('[data-test="places-retry"]').trigger('click')
    await flushPromises()

    expect(w.find('[data-test="places-failed"]').exists()).toBe(false)
    expect(w.findComponent(PlacesRail).props('activeId')).toBe('1') // TOKYO(key=1)是 fixture 里第一个
    expect(svc.photos.getPlace).toHaveBeenCalledWith(1)
  })
})

// 评审 M2:失败态条件必须带 `attempted` 收紧,否则"还没请求过"(onMounted 的异步
// fetchPlaces 尚未真正跑起来那一瞬)会被误判成"请求过且失败了"。
//
// 排雷记录(TDD 过程中的真实教训,留着防止以后有人"优化"成 helper 又踩回去):这个用例
// 起初把 `mount()` 包进一个 `async function mountFresh() { ...; return { w } }` 再
// `await mountFresh()`,结果无论有没有修 M2 都测不出区别——原因是 async 函数 return 出的
// Promise,哪怕函数体里再没有别的 await,await 它本身也一定会让出一次微任务;而
// `attempted.value = true` 这行在 onMounted 里是**同步**执行的(它前面没有任何 await),
// Vue 的响应式调度器早在 mount() 内部就把这次变化排进了微任务队列——那次多余的 await
// 恰好把断言推到了"Vue 已经重渲染过一轮"之后,永远看不到真正的第一帧。改成不包 helper、
// mount() 之后不打任何 await 就立刻断言,才是真的卡在第一帧上(已用 w.html() 手工核对过
// 两种写法在"删掉 attempted 收紧"这个变异下的真实差异,见任务报告 M2 节)。
describe('首帧门控(评审 M2:区分"还没请求过"与"请求过且失败了")', () => {
  it('首帧(onMounted 的异步 fetchPlaces 尚未落地)显示骨架,不是失败态', async () => {
    const router = makeRouter()
    router.push('/photos/places')
    await router.isReady() // 这个 await 在 mount() 之前,不影响下面要卡住的那一帧
    const w = mount(PhotosPlaces, { global: { plugins: [i18n, router] } })
    // mount() 之后立刻断言,中间不能有任何 await——见上方注释。
    expect(w.find('[data-test="places-skeleton"]').exists()).toBe(true)
    expect(w.find('[data-test="places-failed"]').exists()).toBe(false)
  })
})

describe('pointer 手势透传(评审 I1:容器 ↔ composable 之间唯一没有断言保护的接线)', () => {
  it('svg 上按下拖动 → PlacesMap 的 view.tx 跟着变(usePlacesView.ts:201-206 的位移换算)', async () => {
    const { w } = await mountView()
    flushAnim() // 先清空首屏自动选中触发的那次缓动,不让它混进 tx 的前后对比
    await w.vm.$nextTick()
    const before = (w.findComponent(PlacesMap).props('view') as { tx: number }).tx

    const svg = w.find('svg.map-canvas')
    await svg.trigger('pointerdown', { clientX: 100, clientY: 100, pointerId: 1, bubbles: true })
    await svg.trigger('pointermove', { clientX: 180, clientY: 100, pointerId: 1, bubbles: true })

    const after = (w.findComponent(PlacesMap).props('view') as { tx: number }).tx
    expect(after).not.toBeCloseTo(before, 5)
  })

  it('pointerup 之后再 pointermove 不再平移(drag 状态已清)', async () => {
    const { w } = await mountView()
    flushAnim()
    await w.vm.$nextTick()
    const svg = w.find('svg.map-canvas')
    await svg.trigger('pointerdown', { clientX: 100, clientY: 100, pointerId: 1, bubbles: true })
    await svg.trigger('pointerup', { clientX: 100, clientY: 100, pointerId: 1, bubbles: true })
    const afterUp = (w.findComponent(PlacesMap).props('view') as { tx: number }).tx

    await svg.trigger('pointermove', { clientX: 400, clientY: 400, pointerId: 1, bubbles: true })
    const afterMove = (w.findComponent(PlacesMap).props('view') as { tx: number }).tx
    expect(afterMove).toBeCloseTo(afterUp, 5)
  })

  it('从图钉(.geo-pin)上按下不会平移地图(usePlacesView.ts:189-192 的 closest 守卫)', async () => {
    const { w } = await mountView()
    flushAnim()
    await w.vm.$nextTick()
    const before = (w.findComponent(PlacesMap).props('view') as { tx: number }).tx

    const pin = w.find('.geo-pin')
    await pin.trigger('pointerdown', { clientX: 50, clientY: 50, pointerId: 1, bubbles: true })
    await w.find('svg.map-canvas').trigger('pointermove', { clientX: 250, clientY: 50, pointerId: 1, bubbles: true })

    const after = (w.findComponent(PlacesMap).props('view') as { tx: number }).tx
    expect(after).toBeCloseTo(before, 5)
  })
})

describe('wheel 显式 addEventListener 注册(偏离登记 11-⑤)', () => {
  it('svgEl.addEventListener("wheel", ..., { passive: false });卸载后 removeEventListener 被调', async () => {
    const addSpy = vi.spyOn(SVGSVGElement.prototype, 'addEventListener')
    const removeSpy = vi.spyOn(SVGSVGElement.prototype, 'removeEventListener')
    const { w } = await mountView()
    const wheelCall = addSpy.mock.calls.find((c) => c[0] === 'wheel')
    expect(wheelCall).toBeTruthy()
    expect(wheelCall?.[2]).toEqual({ passive: false })

    w.unmount()
    const wheelRemoveCall = removeSpy.mock.calls.find((c) => c[0] === 'wheel')
    expect(wheelRemoveCall).toBeTruthy()
    expect(wheelRemoveCall?.[1]).toBe(wheelCall?.[1]) // 摘的必须正好是挂的那同一个函数引用
  })
})

describe('两个弹层的 Esc 互不干扰(P5-T10 的 bug 形态)', () => {
  it('Filters 与地图主题弹层同时打开,按一次 Esc 两个都关', async () => {
    const { w } = await mountView()
    await w.find('[data-test="pfm-chip"]').trigger('click')
    await w.find('[data-test="mtm-chip"]').trigger('click')
    expect(w.find('[data-test="pfm-pop"]').exists()).toBe(true)
    expect(w.find('[data-test="mtm-pop"]').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()

    expect(w.find('[data-test="pfm-pop"]').exists()).toBe(false)
    expect(w.find('[data-test="mtm-pop"]').exists()).toBe(false)
  })
})

describe('地图主题弹层接线(评审 M1:分流逻辑是容器独有的决策,T1-T10 都没覆盖过)', () => {
  it('点预设 → store.themePrefs.mapTheme 变,PlacesMap 的 themeVars.background 跟着变', async () => {
    const { w } = await mountView()
    const before = (w.findComponent(PlacesMap).props('themeVars') as { background: string }).background

    await w.find('[data-test="mtm-chip"]').trigger('click')
    await w.find('[data-theme-id="ocean"]').trigger('click')

    const store = usePhotosPlaces()
    expect(store.themePrefs.mapTheme).toBe('ocean')
    const after = (w.findComponent(PlacesMap).props('themeVars') as { background: string }).background
    expect(after).not.toBe(before)
  })

  it('改取色器 → mapTheme 落成 custom,customDotColor 落盘(不是无条件走 setMapTheme 把颜色丢了)', async () => {
    const { w } = await mountView()
    await w.find('[data-test="mtm-chip"]').trigger('click')
    const dotInput = w.find('[data-test="mtm-dot-input"]')
    await dotInput.setValue('#123456')

    const store = usePhotosPlaces()
    expect(store.themePrefs.mapTheme).toBe('custom')
    expect(store.themePrefs.customDotColor).toBe('#123456')
    // 主题弹层的 selection prop 直连 store.themePrefs(消歧义 3:读永远走 store),这里顺带
    // 验证回填也生效,不是"写完 store、界面读的却是旧值"的单向断link。
    expect(w.findComponent(PlacesThemeMenu).props('selection')).toMatchObject({ mapTheme: 'custom', customDotColor: '#123456' })
  })
})

describe('.map-toolbar 的 pointer-events 守卫(程序化断言,防重塑时丢掉导致拖不动地图)', () => {
  it('pointer-events:none 与 > * 的 auto 都在样式块里', () => {
    const style = extractStyleBlock(photosPlacesRaw)
    expect(/\.map-toolbar\s*\{[^}]*pointer-events:\s*none/.test(style)).toBe(true)
    expect(/\.map-toolbar\s*>\s*\*\s*\{[^}]*pointer-events:\s*auto/.test(style)).toBe(true)
  })
})

// 真机验收反馈 2:「filter 弹窗会挡住地图缩放的那个 +- 条」——Vue2 把 .map-toolbar 与
// .map-zoombar 都设成 z-index:4,toolbar 自成层叠上下文致内部弹层的 z-index:30 跨不过
// 同级的 zoombar,DOM 顺序又让 zoombar 排在 toolbar 之后,于是缩放条画在 Filters/主题
// 弹层上面(见 .map-toolbar 上方登记)。这里钉的是"工具栏在这些浮层之上"这条不变量本身
// (toolbar z-index 严格大于 legend/stats/tip 与 zoombar 里的最大值),不是写死数值 7——
// 任何等效的层级调整都放行,把 toolbar 降回 4 就会红。
//
// Plan E Task 3 update(shadowing cleanup): `.map-zoombar`'s z-index used to live in
// PlacesZoomBar.vue's own `<style scoped>` block; that whole block has since been deleted
// (parity governs 100% of `.map-zoombar` now, and this component no longer carries a
// `<style>` tag at all — `extractStyleBlock` would throw "未找到样式块" on it). Read the
// same rule from the shared parity stylesheet instead, which is now the *only* place this
// value lives — same source of truth the app itself renders from.
describe('.map-toolbar 层叠顺序守卫(真机验收反馈 2:弹层不应被缩放条穿透)', () => {
  function zIndexOf(rules: ReturnType<typeof parseCssRules>, selector: string): number {
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === selector)
    if (!rule) throw new Error(`未找到规则:${selector}`)
    const m = /z-index:\s*(-?\d+)/.exec(rule.body)
    if (!m) throw new Error(`规则 ${selector} 没有 z-index 声明`)
    return Number(m[1])
  }

  it('.map-toolbar 的 z-index 严格大于容器内其它浮层(.map-legend/.map-stats/.map-tip)与 parity 的 .map-zoombar', () => {
    const containerRules = parseCssRules(extractStyleBlock(photosPlacesRaw))
    const toolbarZ = zIndexOf(containerRules, '.map-toolbar')
    const othersInContainer = ['.map-legend', '.map-stats', '.map-tip'].map((s) => zIndexOf(containerRules, s))
    // Strip comments first (same as extractStyleBlock does for <style> blocks) — parseCssRules'
    // simple regex has no notion of nesting, so an un-stripped leading `/* comment */` right
    // above `.map-zoombar {` gets folded into the captured selector text and breaks the exact
    // `r.selectors[0] === '.map-zoombar'` match below.
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos-places.scss', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    const zoombarRules = parseCssRules(parityScss)
    const zoombarZ = zIndexOf(zoombarRules, '.map-zoombar')
    const maxOther = Math.max(...othersInContainer, zoombarZ)
    expect(toolbarZ).toBeGreaterThan(maxOther)
  })
})

describe('路由 + 侧栏(只追加,不重排)', () => {
  // SP7-P7a-T4:NAV 新增 smart-views,插在 places 之后、favorites 之前——回归更新
  // (PhotosSidebar.vue 改动的必然连带,不在本文件所属任务范围内,顺手同步断言)。
  // SP15-P2b Task 5:该条目的标签从「智能视图」改为「为你推荐」(id/route 不变,页面已
  // 收窄成 Moments-only「为你推荐」页,智能相册迁进了 Albums)——同步更新第 5 项文案。
  it('侧栏 NAV 顺序为 library, albums, people, places, smart-views, favorites, trash', async () => {
    const { w } = await mountView()
    // Task 3(壳 + 侧栏重刻)把导航项类名从 `.side-item`/`.side-name` 换成 Vue2 的
    // `.nav-item`(单个裸 <span> 装标签文字,没有专门的 name 子类——与 Vue2 源码一致)。
    // 这里跟着改选择器,不是本文件所属任务的功能改动。
    const ids = w.findAll('.nav-item').map((n) => n.text())
    // 侧栏渲染的是 i18n 标签文字,直接比对文案序列(与 photosLibrary/.../photosTrash 的
    // zh_CN 字典值一一对应),不需要额外解析源码——这就是"侧栏真的按此顺序渲染"的直接证据。
    expect(ids).toEqual(['照片库', '相册', '人物', '地点', '为你推荐', '收藏', '最近删除'])
  })
})

// ════════════════════════════════════════════════════════════════════════════
// P6b-T8: 容器接线 —— 详情面板/封面弹层/spot/灯箱/相册 toast/跳库导航
// ════════════════════════════════════════════════════════════════════════════

describe('P6b-T8: 面板显隐', () => {
  it('activeId 命中列表项 → PlaceDetailPanel 挂载;activeId=null → 卸载', async () => {
    const { w } = await mountView() // 首屏已自动选中 TOKYO
    expect(w.findComponent(PlaceDetailPanel).exists()).toBe(true)
    await w.findComponent(PlacesRail).vm.$emit('pick', null)
    await w.vm.$nextTick()
    expect(w.findComponent(PlaceDetailPanel).exists()).toBe(false)
  })

  it('点面板的 close → activeId 变 null 且 loadDetail(null) 被调', async () => {
    const { w } = await mountView()
    const store = usePhotosPlaces()
    const loadDetailSpy = vi.spyOn(store, 'loadDetail')
    await w.findComponent(PlaceDetailPanel).vm.$emit('close')
    await w.vm.$nextTick()
    expect(w.findComponent(PlacesRail).props('activeId')).toBe(null)
    expect(loadDetailSpy).toHaveBeenCalledWith(null)
    expect(w.findComponent(PlaceDetailPanel).exists()).toBe(false)
  })
})

// Fix-1 item 2 (owner acceptance, 2026-08-16): the cover picker's head thumbnail
// (`.cp-head-thumb`) rendered empty. Root cause: this container's `current-asset-id` prop
// binding only read `activeDetail?.coverAssetId ?? ''` — missing the `thumbs[0]` fallback
// Vue2's own `currentHero` computed applies (PhotosPlacesView.vue:310-314: `this.activeDetail.
// coverAssetId || (this.activeDetail.thumbs || [])[0] || ''`). Most places have no *explicit*
// coverAssetId (only set once a user actually picks one via this same dialog) and fall back to
// their first thumb for a cover — exactly the common case this bug always showed empty for.
describe('Fix-1 item 2: 封面弹层头部缩略图跟随 activeDetail.thumbs[0] 兜底(照 Vue2 currentHero)', () => {
  it('activeDetail.coverAssetId 为空但 thumbs 非空 → PlaceCoverPicker 的 current-asset-id 落到 thumbs[0]', async () => {
    const { w } = await mountView() // 首屏已自动选中 TOKYO(id=1)
    const store = usePhotosPlaces()
    store.detail = {
      id: '1', city: 'Tokyo', country: 'Japan', count: 9990, trips: 2, home: false,
      coverAssetId: '', thumbs: ['fallback-thumb-1', 'fallback-thumb-2'],
      spots: [], insights: [], visits: [], recent: [],
    }
    await w.vm.$nextTick()
    const panel = w.findComponent(PlaceDetailPanel)
    await panel.vm.$emit('open-cover-picker')
    await w.vm.$nextTick()
    expect(w.findComponent(PlaceCoverPicker).props('currentAssetId')).toBe('fallback-thumb-1')
  })

  it('activeDetail.coverAssetId 非空 → current-asset-id 优先用 coverAssetId,不落 thumbs[0]', async () => {
    const { w } = await mountView()
    const store = usePhotosPlaces()
    store.detail = {
      id: '1', city: 'Tokyo', country: 'Japan', count: 9990, trips: 2, home: false,
      coverAssetId: 'explicit-cover', thumbs: ['fallback-thumb-1'],
      spots: [], insights: [], visits: [], recent: [],
    }
    await w.vm.$nextTick()
    const panel = w.findComponent(PlaceDetailPanel)
    await panel.vm.$emit('open-cover-picker')
    await w.vm.$nextTick()
    expect(w.findComponent(PlaceCoverPicker).props('currentAssetId')).toBe('explicit-cover')
  })
})

describe('P6b-T8: 偏离登记 4 守卫(切城市后详情不认上一城市)', () => {
  it('store.detail 是 B 城的、activeId 是 A 城 → 面板的 detail prop 为 null、place prop 是 A 城', async () => {
    const { w } = await mountView() // activeId = '1'(TOKYO)
    const store = usePhotosPlaces()
    // 模拟"上一个城市(PARIS,id=2)的详情响应还没被新请求覆盖"这个竞态窗口。
    store.detail = {
      id: '2', city: 'Paris', country: 'France', count: 1, trips: 1, home: false,
      coverAssetId: '', thumbs: [], spots: [], insights: [], visits: [], recent: [],
    }
    await w.vm.$nextTick()
    const panel = w.findComponent(PlaceDetailPanel)
    expect(panel.props('detail')).toBe(null)
    expect(panel.props('place')?.id).toBe('1')
    expect(panel.props('place')?.city).toBe('Tokyo')
  })
})

describe('P6b-T8: hasDetailPanel 真实化(P6a 接缝二 —— panelFrac 首次真正生效)', () => {
  it('面板打开与关闭时,同一 setScale 调用的落点不同(wrapEl 宽 1000 → panelFrac=0.42 → 中心 x=290 而非 500)', async () => {
    const { w } = await mountView() // 首屏已自动选中 TOKYO,hasPanel = true
    flushAnim()
    await w.vm.$nextTick()

    // 钉住 wrapEl 宽度,让 panelFrac 落在未钳制区间(与 usePlacesView.test.ts 的既定 mock
    // 值 1000 一致),而不是 jsdom 默认 0 宽度被钳到的 0.55。
    const wrap = w.find('.map-canvas-wrap').element as HTMLElement
    wrap.getBoundingClientRect = () => ({ width: 1000, height: 500, left: 0, top: 0, right: 1000, bottom: 500, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect

    // 面板打开态:先 reset 到已知基线(tx=0,ty=0,scale=1),再 setScale(4)。
    await w.findComponent(PlacesZoomBar).vm.$emit('reset')
    flushAnim()
    await w.vm.$nextTick()
    await w.findComponent(PlacesZoomBar).vm.$emit('set-scale', 4)
    await w.vm.$nextTick()
    const txOpen = (w.findComponent(PlacesMap).props('view') as { tx: number }).tx
    // 手算:panelFrac = min(0.55, 420/1000) = 0.42 → c.x = 1000*(1-0.42)/2 = 290。
    // applyZoom(4, 290, 250) 从 {tx:0,ty:0,scale:1}:wx=(290-0)/1=290,
    // tx_new = 290 - 290*4 = -870。
    expect(txOpen).toBeCloseTo(290 - 290 * 4, 5)

    // 面板关闭态:同一基线、同一 setScale(4),但 hasPanel = false → panelFrac = 0 → c.x=500。
    await w.findComponent(PlaceDetailPanel).vm.$emit('close')
    await w.vm.$nextTick()
    expect(w.findComponent(PlaceDetailPanel).exists()).toBe(false)
    await w.findComponent(PlacesZoomBar).vm.$emit('reset')
    flushAnim()
    await w.vm.$nextTick()
    await w.findComponent(PlacesZoomBar).vm.$emit('set-scale', 4)
    await w.vm.$nextTick()
    const txClosed = (w.findComponent(PlacesMap).props('view') as { tx: number }).tx
    expect(txClosed).toBeCloseTo(500 - 500 * 4, 5)

    expect(txOpen).not.toBeCloseTo(txClosed, 5)
  })
})

describe('P6b-T8: 切城市重置封面/spot 状态(照 Vue2 :295-301)', () => {
  it('打开封面弹层 + 选中 spot + 翻到第 2 页,再改 activeId → 全部复位', async () => {
    const { w } = await mountView() // TOKYO
    const panel = w.findComponent(PlaceDetailPanel)
    await panel.vm.$emit('open-cover-picker')
    await panel.vm.$emit('pick-spot', { key: 's1', name: 'Spot', lon: 0, lat: 0, count: 1, thumb: '' })
    await w.vm.$nextTick()
    const picker = w.findComponent(PlaceCoverPicker)
    await picker.vm.$emit('update:page', 2)
    await w.vm.$nextTick()
    expect(w.findComponent(PlaceCoverPicker).props('open')).toBe(true)
    expect(w.findComponent(PlaceCoverPicker).props('page')).toBe(2)
    expect(w.findComponent(PlaceDetailPanel).props('activeSpotKey')).toBe('s1')

    await w.findComponent(PlacesRail).vm.$emit('pick', '2') // 切到 PARIS
    await w.vm.$nextTick()

    expect(w.findComponent(PlaceCoverPicker).props('open')).toBe(false)
    expect(w.findComponent(PlaceCoverPicker).props('tab')).toBe('recent')
    expect(w.findComponent(PlaceCoverPicker).props('search')).toBe('')
    expect(w.findComponent(PlaceCoverPicker).props('page')).toBe(0)
    expect(w.findComponent(PlaceDetailPanel).props('activeSpotKey')).toBe(null)
  })
})

describe('P6b-T8: 封面候选拉取(前置条件 activeId && coverOpen,删码清单⑧)', () => {
  it('openCoverPicker 拉一次;改 tab/搜索词/翻页各拉一次;coverOpen=false 时改 tab 不拉', async () => {
    const { w } = await mountView()
    svc.photos.placeCoverCandidates.mockClear()
    const panel = w.findComponent(PlaceDetailPanel)

    await panel.vm.$emit('open-cover-picker')
    await w.vm.$nextTick()
    expect(svc.photos.placeCoverCandidates).toHaveBeenCalledTimes(1)
    expect(svc.photos.placeCoverCandidates).toHaveBeenLastCalledWith(1, { tab: 'recent', q: '', page: 0 })

    const picker = w.findComponent(PlaceCoverPicker)
    await picker.vm.$emit('update:tab', 'top')
    await w.vm.$nextTick()
    expect(svc.photos.placeCoverCandidates).toHaveBeenCalledTimes(2)
    expect(w.findComponent(PlaceCoverPicker).props('page')).toBe(0) // 改 tab → page 归 0

    await picker.vm.$emit('update:search', 'xyz')
    await w.vm.$nextTick()
    expect(svc.photos.placeCoverCandidates).toHaveBeenCalledTimes(3)

    await picker.vm.$emit('update:page', 1)
    await w.vm.$nextTick()
    expect(svc.photos.placeCoverCandidates).toHaveBeenCalledTimes(4)

    // 关闭弹层后改 tab 不应再拉——只通过弹层自己的 close 关闭 coverOpen(不碰 activeId,
    // 否则 fetchCandidatesIfOpen 里的 `!activeId.value` 早退会掩盖 coverOpen 前置条件
    // 本身有没有被真的删掉,删码验证会测不出差异)。
    await w.findComponent(PlaceCoverPicker).vm.$emit('close')
    await w.vm.$nextTick()
    svc.photos.placeCoverCandidates.mockClear()
    await w.findComponent(PlaceCoverPicker).vm.$emit('update:tab', 'fav')
    await w.vm.$nextTick()
    expect(svc.photos.placeCoverCandidates).not.toHaveBeenCalled()
  })
})

describe('P6b-T8: 封面提交', () => {
  it('点 cell(pick)→ 弹层先关、setPlaceCover 被调;失败 → toast「封面更新失败」', async () => {
    const { w } = await mountView()
    const toastStore = useToast()
    const showSpy = vi.spyOn(toastStore, 'show')
    await w.findComponent(PlaceDetailPanel).vm.$emit('open-cover-picker')
    await w.vm.$nextTick()
    expect(w.findComponent(PlaceCoverPicker).props('open')).toBe(true)

    await w.findComponent(PlaceCoverPicker).vm.$emit('pick', 'asset-9')
    await w.vm.$nextTick()
    expect(w.findComponent(PlaceCoverPicker).props('open')).toBe(false) // 先关弹层
    expect(svc.photos.setPlaceCover).toHaveBeenCalledWith(1, 'asset-9')

    svc.photos.setPlaceCover.mockRejectedValueOnce(new Error('boom'))
    await w.findComponent(PlaceDetailPanel).vm.$emit('open-cover-picker')
    await w.vm.$nextTick()
    await w.findComponent(PlaceCoverPicker).vm.$emit('pick', 'asset-10')
    await flushPromises()
    expect(showSpy).toHaveBeenCalledWith('封面更新失败')
  })

  it('reset 同形:弹层先关、resetPlaceCover 被调;失败 → toast「封面更新失败」', async () => {
    const { w } = await mountView()
    const toastStore = useToast()
    const showSpy = vi.spyOn(toastStore, 'show')
    await w.findComponent(PlaceDetailPanel).vm.$emit('open-cover-picker')
    await w.vm.$nextTick()

    await w.findComponent(PlaceCoverPicker).vm.$emit('reset')
    await w.vm.$nextTick()
    expect(w.findComponent(PlaceCoverPicker).props('open')).toBe(false)
    expect(svc.photos.resetPlaceCover).toHaveBeenCalledWith(1)

    svc.photos.resetPlaceCover.mockRejectedValueOnce(new Error('boom'))
    await w.findComponent(PlaceDetailPanel).vm.$emit('open-cover-picker')
    await w.vm.$nextTick()
    await w.findComponent(PlaceCoverPicker).vm.$emit('reset')
    await flushPromises()
    expect(showSpy).toHaveBeenCalledWith('封面更新失败')
  })
})

describe('P6b-T8: spot 三个动作', () => {
  it('emit pick-spot → 面板收到的 activeSpotKey 是 String(spot.key)', async () => {
    const { w } = await mountView()
    await w.findComponent(PlaceDetailPanel).vm.$emit('pick-spot', { key: 42, name: 'S', lon: 0, lat: 0, count: 1, thumb: '' })
    await w.vm.$nextTick()
    expect(w.findComponent(PlaceDetailPanel).props('activeSpotKey')).toBe('42')
  })

  it('emit rename → setSpotName 被调且没有额外的 loadDetail(偏离 7 守卫)', async () => {
    const { w } = await mountView()
    const store = usePhotosPlaces()
    await w.findComponent(PlaceDetailPanel).vm.$emit('pick-spot', { key: 's1', name: 'Old', lon: 0, lat: 0, count: 1, thumb: '' })
    await w.vm.$nextTick()
    const loadDetailSpy = vi.spyOn(store, 'loadDetail')
    await w.findComponent(PlaceDetailPanel).vm.$emit('rename', 'New Name')
    await flushPromises()
    expect(svc.photos.setSpotName).toHaveBeenCalledWith(1, 's1', 'New Name')
    expect(loadDetailSpy).not.toHaveBeenCalled()
  })

  it('emit reset-name → resetSpotName 被调', async () => {
    const { w } = await mountView()
    await w.findComponent(PlaceDetailPanel).vm.$emit('pick-spot', { key: 's1', name: 'Old', lon: 0, lat: 0, count: 1, thumb: '' })
    await w.vm.$nextTick()
    await w.findComponent(PlaceDetailPanel).vm.$emit('reset-name')
    await flushPromises()
    expect(svc.photos.resetSpotName).toHaveBeenCalledWith(1, 's1')
  })

  it('rename/reset-name 失败各弹一次 toast', async () => {
    const { w } = await mountView()
    const toastStore = useToast()
    const showSpy = vi.spyOn(toastStore, 'show')
    await w.findComponent(PlaceDetailPanel).vm.$emit('pick-spot', { key: 's1', name: 'Old', lon: 0, lat: 0, count: 1, thumb: '' })
    await w.vm.$nextTick()

    svc.photos.setSpotName.mockRejectedValueOnce(new Error('boom'))
    await w.findComponent(PlaceDetailPanel).vm.$emit('rename', 'X')
    await flushPromises()
    expect(showSpy).toHaveBeenCalledWith('地点重命名失败')

    svc.photos.resetSpotName.mockRejectedValueOnce(new Error('boom'))
    await w.findComponent(PlaceDetailPanel).vm.$emit('reset-name')
    await flushPromises()
    expect(showSpy).toHaveBeenCalledTimes(2)
    expect(showSpy).toHaveBeenLastCalledWith('地点重命名失败')
  })
})

describe('P6b-T8: 相册与 toast', () => {
  it('emit save-album → createPlaceAlbum 收到 { name: 城市名 }', async () => {
    const { w } = await mountView() // TOKYO
    await w.findComponent(PlaceDetailPanel).vm.$emit('save-album')
    await flushPromises()
    expect(svc.photos.createPlaceAlbum).toHaveBeenCalledWith(1, { name: 'Tokyo', from: '', to: '' })
  })

  it('emit save-trip → createPlaceAlbum 收到 `城市 · when` + from/to', async () => {
    const { w } = await mountView()
    await w.findComponent(PlaceDetailPanel).vm.$emit('save-trip', { when: '2026 春', from: '2026-01-01', to: '2026-01-10', current: false, days: 9, photos: 5, faces: [], spots: 2, thumbs: [] })
    await flushPromises()
    expect(svc.photos.createPlaceAlbum).toHaveBeenCalledWith(1, { name: 'Tokyo · 2026 春', from: '2026-01-01', to: '2026-01-10' })
  })

  // Fix-1 item 5 (owner acceptance, 2026-08-16): switched from the generic app-wide
  // `useToast()` (a plain gray pill) to `usePhotosToast()` (the photos-styled toast every
  // other Places/library flow already uses) — see createAlbum()'s own comment in
  // PhotosPlaces.vue for the full account. These two tests replace (not merely rename) the
  // old `useToast()`-spying assertions below them.
  it('成功 → photosToast 队列收到 icon:album + 文案含相册名与张数 + action,5000ms;点 action → router.push 到相册详情', async () => {
    svc.photos.createPlaceAlbum.mockResolvedValueOnce({ albumId: 'al-9', name: 'Tokyo', count: 3 })
    const { w, router } = await mountView()
    const photosToast = usePhotosToast()
    const pushSpy = vi.spyOn(router, 'push')
    await w.findComponent(PlaceDetailPanel).vm.$emit('save-album')
    await flushPromises()
    // usePhotosToast() is a module-level singleton — its returned `show` function is a fresh
    // closure per call (only the underlying `toasts` ref is shared), so spying on a
    // locally-obtained instance's `.show` never sees the component's own internal call.
    // Assert against the shared queue instead (established pattern: Photos.integration.
    // test.ts's delete-toast assertion, PhotosAlbumDetail.test.ts, PhotosSmartViewDetail.test.ts).
    expect(photosToast.toasts.value).toHaveLength(1)
    const toastItem = photosToast.toasts.value[0]
    expect(toastItem.icon).toBe('album')
    expect(toastItem.text).toContain('Tokyo')
    expect(toastItem.text).toContain('3')
    expect(toastItem.action?.label).toBe('打开')
    toastItem.action?.onClick()
    expect(pushSpy).toHaveBeenCalledWith('/photos/albums/al-9')
    // Generic app toast must NOT also fire — this is a full switch, not an additional one.
    const genericShowSpy = vi.spyOn(useToast(), 'show')
    expect(genericShowSpy).not.toHaveBeenCalled()
  })

  it('失败 → photosToast 队列收到失败文案;albumBusy 错误不弹 toast', async () => {
    const { w } = await mountView()
    const photosToast = usePhotosToast()

    svc.photos.createPlaceAlbum.mockRejectedValueOnce(new Error('network down'))
    await w.findComponent(PlaceDetailPanel).vm.$emit('save-album')
    await flushPromises()
    expect(photosToast.toasts.value).toHaveLength(1)
    expect(photosToast.toasts.value[0].text).toBe('相册创建失败')

    photosToast.__resetForTests()
    svc.photos.createPlaceAlbum.mockRejectedValueOnce(new Error('albumBusy'))
    await w.findComponent(PlaceDetailPanel).vm.$emit('save-album')
    await flushPromises()
    expect(photosToast.toasts.value).toHaveLength(0)
  })
})

describe('P6b-T8: 灯箱(D9)', () => {
  it("emit open-photo('b', ['a','b','c']) → lb.openAt 收到的 list 长度 3、当前项 id 是 'b'", async () => {
    const { w } = await mountView()
    const lb = useLightbox()
    await w.findComponent(PlaceDetailPanel).vm.$emit('open-photo', 'b', ['a', 'b', 'c'])
    expect(lb.list.value).toHaveLength(3)
    expect(String(lb.current.value?.id)).toBe('b')
    expect(lb.open.value).toBe(true)
  })

  it("emit open-photo('x', []) → list 长度 1", async () => {
    const { w } = await mountView()
    const lb = useLightbox()
    await w.findComponent(PlaceDetailPanel).vm.$emit('open-photo', 'x', [])
    expect(lb.list.value).toHaveLength(1)
    expect(String(lb.current.value?.id)).toBe('x')
  })
})

// Fix-1 item 4 (owner acceptance, 2026-08-16): both handlers now navigate to the actual photo
// library (`/photos`) with the place's city name carried through a `?libraryPlace=` query key
// (consumed once by Photos.vue's own `onMounted`, see that file's comment) instead of the
// standalone place-assets page — owner's explicit, binding instruction, matching Vue2's own
// `onPlacesOpenLibrary`/`onPlacesOpenSpot` city-level EXIF-facet jump (PhotosTimeline.vue:
// 767-793). The old `/photos/places/:key` assertions below are replaced, not merely renamed —
// this is a genuine navigation-target change, not a refactor.
describe('Fix-1 item 4: 跳库导航改落到图书馆(带 ?libraryPlace= 城市名),不再落到独立地点页', () => {
  it('emit open-library → router.push 到 /photos?libraryPlace=<city>(用地点的 city,不是 key/id)', async () => {
    const { w, router } = await mountView()
    const store = usePhotosPlaces()
    store.places.push({
      id: 'weird-id', key: 7, region: 'asia', country: 'X', city: 'Weird City',
      lon: 0, lat: 0, count: 1, recent: false, last: '', lastDate: null,
      trips: 0, home: false, thumbs: [], coverAssetId: '',
    })
    await w.findComponent(PlacesRail).vm.$emit('pick', 'weird-id')
    await w.vm.$nextTick()
    const pushSpy = vi.spyOn(router, 'push')
    await w.findComponent(PlaceDetailPanel).vm.$emit('open-library')
    expect(pushSpy).toHaveBeenCalledWith({ path: '/photos', query: { libraryPlace: 'Weird City' } })
  })

  it('emit open-spot-library → 同样落到 /photos?libraryPlace=<city>(spot 精度在图书馆现有筛选系统里无落点,降级成同城过滤,登记但非疏漏)+ activeSpotKey 被清空', async () => {
    const { w, router } = await mountView()
    const store = usePhotosPlaces()
    store.places.push({
      id: 'weird-id', key: 7, region: 'asia', country: 'X', city: 'Weird City',
      lon: 0, lat: 0, count: 1, recent: false, last: '', lastDate: null,
      trips: 0, home: false, thumbs: [], coverAssetId: '',
    })
    await w.findComponent(PlacesRail).vm.$emit('pick', 'weird-id')
    await w.vm.$nextTick()
    store.detail = {
      id: 'weird-id', city: 'Weird City', country: 'X', count: 1, trips: 0, home: false,
      coverAssetId: '', thumbs: [], insights: [], visits: [], recent: [],
      spots: [{ key: '42', name: 'Spot', lon: 11, lat: 22, count: 1, thumb: '' }],
    }
    await w.vm.$nextTick()
    await w.findComponent(PlaceDetailPanel).vm.$emit('pick-spot', { key: '42', name: 'Spot', lon: 11, lat: 22, count: 1, thumb: '' })
    await w.vm.$nextTick()
    expect(w.findComponent(PlaceDetailPanel).props('activeSpotKey')).toBe('42')

    const pushSpy = vi.spyOn(router, 'push')
    await w.findComponent(PlaceDetailPanel).vm.$emit('open-spot-library')
    expect(pushSpy).toHaveBeenCalledWith({ path: '/photos', query: { libraryPlace: 'Weird City' } })
    await w.vm.$nextTick()
    expect(w.findComponent(PlaceDetailPanel).props('activeSpotKey')).toBe(null)
  })
})

describe('P6b-T8: 三浮层同开时一次 Esc 三者都关(P5-T10 的 bug 形态)', () => {
  it('Filters + 主题 + 封面弹层同时打开,按一次 Esc 三者都关', async () => {
    const { w } = await mountView()
    await w.find('[data-test="pfm-chip"]').trigger('click')
    await w.find('[data-test="mtm-chip"]').trigger('click')
    await w.findComponent(PlaceDetailPanel).vm.$emit('open-cover-picker')
    await w.vm.$nextTick()

    expect(w.find('[data-test="pfm-pop"]').exists()).toBe(true)
    expect(w.find('[data-test="mtm-pop"]').exists()).toBe(true)
    expect(body().find('[data-test="cp-scrim"]').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()

    expect(w.find('[data-test="pfm-pop"]').exists()).toBe(false)
    expect(w.find('[data-test="mtm-pop"]').exists()).toBe(false)
    expect(body().find('[data-test="cp-scrim"]').exists()).toBe(false)
  })
})
