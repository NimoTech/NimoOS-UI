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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    listPlaces: vi.fn(),
    getPlace: vi.fn().mockResolvedValue({}),
    thumbnailUrl: vi.fn((id: string | number, size?: string) => `mock://thumb/${id}/${size ?? ''}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosPlaces from '../PhotosPlaces.vue'
import photosPlacesRaw from '../PhotosPlaces.vue?raw'
import PlacesRail from '../../photos/components/PlacesRail.vue'
import PlacesMap from '../../photos/components/PlacesMap.vue'
import PlacesThemeMenu from '../../photos/components/PlacesThemeMenu.vue'
import { usePhotosPlaces } from '../../photos/stores/places'
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

async function mountView() {
  const router = makeRouter()
  router.push('/photos/places')
  await router.isReady()
  const w = mount(PhotosPlaces, { global: { plugins: [i18n, router] } })
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
})
afterEach(() => {
  vi.restoreAllMocks()
})

// 一次性把在途动画“瞬移”到终点(ease(k=1)):真实场景下 420ms 后必然到达,这里跳过等待。
function flushAnim(): void {
  const cbs = rafCallbacks.splice(0)
  for (const cb of cbs) cb(performance.now() + 100000)
}

describe('壳', () => {
  it('AreaShell title 为「地点」,PhotosSidebar 存在', async () => {
    const { w } = await mountView()
    expect(w.find('.area-title').text()).toBe('地点')
    expect(w.find('.photos-sidebar').exists()).toBe(true)
  })
})

describe('首屏加载 + 自动选中', () => {
  it('onMounted 调 fetchPlaces;加载完自动选中第一个地点', async () => {
    const { w } = await mountView()
    expect(svc.photos.listPlaces).toHaveBeenCalledTimes(1)
    expect(w.findComponent(PlacesRail).props('activeId')).toBe('1')
    expect(w.findComponent(PlacesMap).props('activeId')).toBe('1')
  })

  it('自动选中后 autoPanTo 被调用,入参是第一个地点(TOKYO)——按 view 的 tx/ty/scale 精确核验', async () => {
    const { w } = await mountView()
    // autoPanTo → centerOn → animateView 已经同步排了一个 raf 回调,flush 它让缓动直接到终点。
    expect(rafCallbacks.length).toBeGreaterThan(0)
    flushAnim()
    await w.vm.$nextTick()
    const view = w.findComponent(PlacesMap).props('view') as { tx: number, ty: number, scale: number }
    // centerOn(wx,wy,scale) 的换算:c = visibleCenterVb()(hasDetailPanel 恒 false → 正中心),
    // scale = max(1, 1.8) = 1.8,tx = c.x - wx*scale,ty = c.y - wy*scale。
    const { x: wx, y: wy } = project(TOKYO.lon, TOKYO.lat)
    expect(view.scale).toBeCloseTo(1.8, 5)
    expect(view.tx).toBeCloseTo(MAP_W / 2 - wx * 1.8, 3)
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

describe('路由 + 侧栏(只追加,不重排)', () => {
  it('侧栏 NAV 顺序为 library, albums, people, places, favorites, trash', async () => {
    const { w } = await mountView()
    const ids = w.findAll('.side-item').map((n) => n.find('.side-name').text())
    // 侧栏渲染的是 i18n 标签文字,直接比对文案序列(与 photosLibrary/.../photosTrash 的
    // zh_CN 字典值一一对应),不需要额外解析源码——这就是"侧栏真的按此顺序渲染"的直接证据。
    expect(ids).toEqual(['照片库', '相册', '人物', '地点', '收藏', '最近删除'])
  })
})
