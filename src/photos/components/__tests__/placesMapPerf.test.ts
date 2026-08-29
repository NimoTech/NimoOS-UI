// Semantic port of the Vue 2 panel's own `tests/photosPlacesMapPerf.test.js` (8 cases, git show
// 78cf3335 — PR #106's perf sub-commit). NOT a line-for-line copy: Vue2 mounted one monolithic
// `PhotosPlacesView`
// component and measured re-renders via `$on('hook:beforeUpdate')`; New-UI already splits that
// same view into PlacesMap/PlacesThemeMenu/PlacesZoomBar/PhotosPlaces (container) + a Pinia
// store, and Vue3's `<script setup>` compiled output has no static `.render` method to spy on
// (the template is inlined into `setup()`'s return value per-instance), so "zero re-renders"
// is proven here via the actual CAUSAL mechanism instead: a component only updates when props
// it reads change (by reference, for objects/arrays) — so asserting the `dots` prop's object
// *identity* survives an unrelated reactive change is a strictly more precise proof of "this
// subtree did no Vue work" than a raw update-count spy would be.
//
// Task 6 (Plan E, 2026-08-15) update: this task's own brief scoped Task 5 to sub-commit 4 only
// (the render-isolation architecture) and explicitly deferred #106's sub-commits 1-3 (colour
// value/mapping fixes) plus the D5 signal-source revert to a later task — that later task is
// this one. Case 8's describe block below (and its two `it.each` cases) has been rewritten to
// assert the NOW-correct sub-commit-3 mapping (see src/photos/util/placesMapThemes.ts's own
// resolveMapTheme() comment) instead of the deliberately-deferred pre-#106 mapping the previous
// version of this file pinned down; two more cases were added directly below it proving the D5
// signal switch works in both directions (photos-private theme flips the map, global theme
// does not) — this is the RED-then-GREEN test Task 6's brief mandates for that switch.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../../i18n/zh_cn'
import PlacesMap from '../PlacesMap.vue'
import PlacesWorldDots from '../PlacesWorldDots.vue'
import PlacesThemeMenu from '../PlacesThemeMenu.vue'
import placesThemeMenuRaw from '../PlacesThemeMenu.vue?raw'
import { usePhotosPlaces } from '../../stores/places'
import { useThemeStore } from '../../../stores/theme'
import { __resetPhotosThemeForTests, usePhotosTheme } from '../../composables/usePhotosTheme'
import type { Place } from '../../util/placesMap'

// PhotosPlaces.vue (mounted only by the last describe block, case 8) pulls in PhotoLightbox,
// which touches HTMLMediaElement — jsdom has no media stack, same precondition
// PhotosPlaces.test.ts/PhotosPersonDetail.test.ts already establish.
;(HTMLMediaElement.prototype as unknown as { play: () => Promise<void> }).play = vi.fn(() => Promise.resolve())
;(HTMLMediaElement.prototype as unknown as { pause: () => void }).pause = vi.fn()

const svc = vi.hoisted(() => ({
  photos: {
    listPlaces: vi.fn(() => Promise.resolve({ places: [], regions: [], stats: { cities: 0, countries: 0, photos: 0 } })),
    getPlace: vi.fn().mockResolvedValue({}),
    thumbnailUrl: vi.fn((id: string | number) => `mock://thumb/${id}`),
    getAsset: vi.fn().mockResolvedValue({}),
    getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
    recordView: vi.fn().mockResolvedValue(undefined),
    listFavoriteIds: vi.fn().mockResolvedValue([]),
    originalUrl: vi.fn((id: string | number) => `mock://original/${id}`),
    liveUrl: vi.fn((id: string | number) => `mock://live/${id}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// Imported after the mock above so PhotosPlaces.vue's own `service` import resolves to the
// stub (same ordering convention as views/__tests__/PhotosPlaces.test.ts).
import PhotosPlaces from '../../../views/PhotosPlaces.vue'

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

// ── Case 1 的 fixture:两个手写点(照 Vue2 test 的 `{ x, y, visited }` 字面量,不经
// visitedDots() 计算——直接验证组件契约,不掺入几何算法)。────────────────────────
const HAND_DOTS = [
  { x: 1, y: 2, visited: false },
  { x: 3, y: 4, visited: true },
]

describe('PlacesWorldDots · 点阵渲染隔离(props 仅 dots)', () => {
  it('props 契约恰好只有 dots 一个字段', () => {
    // <script setup> 编译产物的 props 声明是本组件唯一的响应式输入契约。
    const declared = Object.keys((PlacesWorldDots as unknown as { props: Record<string, unknown> }).props)
    expect(declared).toEqual(['dots'])
  })

  it('每个点渲染一个 circle,已访问的带 is-visited、未访问的不带', () => {
    const w = mount(PlacesWorldDots, { props: { dots: HAND_DOTS } })
    const circles = w.findAll('circle')
    expect(circles).toHaveLength(2)
    expect(circles[0].classes()).not.toContain('is-visited')
    expect(circles[1].classes()).toContain('is-visited')
  })
})

// ── Case 2/3/4 共用的直接挂载 harness:真实 PlacesMap,外层持有可变的 activeId/themeVars
// ref,模拟"容器状态变了、往下传新 props"而不经过完整的 PhotosPlaces.vue 容器——这就是
// PlacesMap 自己的渲染依赖表面,不需要整页容器也能精确测。用 h() 手写 render(不用模板
// 字符串),避免依赖 vue 的运行时编译器 build。────────────────────────────────────
const PLAIN: Place = {
  id: 'plain', key: 1, region: 'asia', country: 'China', city: 'Plain City',
  lon: 100, lat: 20, count: 3, recent: false,
  last: 'Mar 7, 2026', lastDate: new Date(2026, 2, 7), trips: 1, home: false, thumbs: [], coverAssetId: '',
}
const ACTIVE_RECENT: Place = {
  id: 'active-recent', key: 2, region: 'americas', country: 'US', city: 'Activeville',
  lon: -70, lat: 40, count: 10, recent: true,
  last: 'Jun 1, 2026', lastDate: new Date(2026, 5, 1), trips: 1, home: false, thumbs: [], coverAssetId: '',
}

// 评审自查(TDD 第一轮撞见的真坑):`places` 数组必须在 render() 之外只构造一次——若像
// PhotosPlaces.vue 真实的 filteredPlaces computed 那样保持引用稳定,PlacesMap 自己的
// `dots = computed(() => visitedDots(props.places))` 才不会被误判"依赖变了"而重新求值。
// 第一版把 `[PLAIN, ACTIVE_RECENT]` 字面量直接写在 render() 里,每次 Harness 自身重渲染都
// 会重新构造一个新数组引用喂给 PlacesMap 的 `places` prop——那不是在测 PlacesMap 的隔离,
// 是在测"我的测试 harness 有没有意外制造一个假故障源",两个用例因此假红,已改正。
const HARNESS_PLACES = [PLAIN, ACTIVE_RECENT]

function mountMapHarness() {
  const activeId = ref<string | null>(null)
  const themeVars = ref<Record<string, string>>({ background: '#000000', '--map-dot': '#111111', '--map-grid': '#222222' })
  const Harness = defineComponent({
    setup() {
      return { activeId, themeVars }
    },
    render() {
      return h(PlacesMap, {
        places: HARNESS_PLACES,
        activeId: this.activeId,
        view: { tx: 0, ty: 0, scale: 1 },
        themeVars: this.themeVars,
        onPickPin: () => {},
        onHoverPin: () => {},
        onHoverClear: () => {},
      })
    },
  })
  const w = mount(Harness)
  return { w, activeId, themeVars }
}

describe('PlacesMap · 拖动取色器不该压主线程(改色不重绘点阵)', () => {
  it('themeVars 改 30 次(模拟拖动取色器每帧一次 input),dots 子组件的 props 引用全程不变', async () => {
    const { w, themeVars } = mountMapHarness()
    const dotsBefore = w.findComponent(PlacesWorldDots).props('dots')

    for (let i = 0; i < 30; i++) {
      // 每次都是一个全新对象引用,模拟 mapThemeStyleVars() 每次重新计算的产出——
      // 这正是会让 Vue3 判定"这个 prop 变了"的条件(引用比较,不是深比较)。
      themeVars.value = { background: '#000000', '--map-dot': `#${i.toString(16).padStart(6, '0')}` }
      await nextTick()
    }

    const dotsAfter = w.findComponent(PlacesWorldDots).props('dots')
    // 严格引用相等:证明 PlacesMap 自己的 dots computed 从未因 themeVars 变化而重新求值,
    // 而 PlacesWorldDots 收到的 props.dots 引用也没变——Vue 因此完全没有理由重绘这个子组件。
    expect(dotsAfter).toBe(dotsBefore)

    // 反向确认:themeVars prop 真的传导到了 PlacesMap(不是"什么都没生效,巧合看着没变")。
    expect(w.findComponent(PlacesMap).props('themeVars')['--map-dot']).toBe('#00001d')
  })
})

describe('PlacesMap · hover / 选中不重绘点阵', () => {
  it('activeId 变化(hover/选中的下游效果)不改变 dots 子组件的 props 引用,但图钉确实刷新了', async () => {
    const { w, activeId } = mountMapHarness()
    const dotsBefore = w.findComponent(PlacesWorldDots).props('dots')
    const activeCountBefore = w.findAll('.geo-pin.is-active').length
    expect(activeCountBefore).toBe(0)

    activeId.value = 'active-recent'
    await nextTick()

    const dotsAfter = w.findComponent(PlacesWorldDots).props('dots')
    expect(dotsAfter).toBe(dotsBefore) // 点阵子组件全程没有理由重绘

    // 但 PlacesMap 自己确实重渲染了(图钉的 is-active 反映了新 activeId)——证明上面那个
    // "没变"不是因为整棵树压根没重渲染,而是隔离生效了。
    expect(w.findAll('.geo-pin.is-active').length).toBe(1)
  })
})

describe('PlacesMap · 颜色改动通过 CSS 变量落到 DOM 上(watch 触发的后续更新,不只是 mounted 那一次)', () => {
  it('mount 后再次改变 themeVars,新值确实落到 <svg> 的 style 上', async () => {
    // 注:PlacesMap.test.ts 已经钉住了"mount 时 themeVars 落到 svg style"这一条(该文件
    // :62-67)。这里额外补的是它没覆盖的角度——mount *之后* themeVars 再变,watch() 驱动的
    // 命令式写入是否也跟着更新(证明这是一个持续生效的响应式副作用,不是只在 onMounted 跑
    // 一次的死值)。
    const { w, themeVars } = mountMapHarness()
    const svg = w.find('svg').element as SVGSVGElement
    expect(svg.style.getPropertyValue('--map-dot')).toBe('#111111')

    themeVars.value = { background: 'rgb(9, 9, 9)', '--map-dot': '#ff0000', '--map-grid': '#00ff00', '--map-dot-bg': 'rgba(1,2,3,0.3)' }
    await nextTick()

    expect(svg.style.background).toContain('rgb(9, 9, 9)')
    expect(svg.style.getPropertyValue('--map-dot')).toBe('#ff0000')
    expect(svg.style.getPropertyValue('--map-grid')).toBe('#00ff00')
    expect(svg.style.getPropertyValue('--map-dot-bg')).toBe('rgba(1,2,3,0.3)')

    // 条件展开语义(mapThemeStyleVars() 的契约,applyMapVars() 必须照顾到):dotBg 不在
    // vars 里时,上一次写过的 --map-dot-bg 要被 removeProperty 清掉,不能卡在旧值上。
    themeVars.value = { background: '#0A0A0C', '--map-dot': '#6E5BFF', '--map-grid': '#9C8EFF' }
    await nextTick()
    expect(svg.style.getPropertyValue('--map-dot-bg')).toBe('')
  })
})

function makeI18n() {
  return createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
}

// ── Case 5:取色器 uncontrolled + 弹层打开喂初值(mount PlacesThemeMenu 直连真 store,不需要
// 整个 PhotosPlaces.vue——这条契约本身只涉及这两者)。──────────────────────────────────
describe('PlacesThemeMenu · 弹层打开时把当前颜色喂给无绑定的取色器', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('open 从 false 变 true:两个 <input type=color> 的 .value 被同步成 selection 的当前颜色', async () => {
    const store = usePhotosPlaces()
    store.setCustomColors('#abcdef', '#fedcba')

    const w = mount(PlacesThemeMenu, {
      props: { selection: store.themePrefs, isLight: false, open: false },
      global: { plugins: [makeI18n()] },
    })
    // 打开前:popover 的 v-if 还没渲染,两个 input 压根不在 DOM 里。
    expect(w.find('[data-test="mtm-dot-input"]').exists()).toBe(false)

    await w.setProps({ open: true })
    await nextTick() // popover 的 v-if 渲染出 input
    await nextTick() // watch(open) 里的 nextTick(syncColorInputs) 落地

    const dotInput = w.get<HTMLInputElement>('[data-test="mtm-dot-input"]')
    const gridInput = w.get<HTMLInputElement>('[data-test="mtm-grid-input"]')
    expect(dotInput.element.value).toBe('#abcdef')
    expect(gridInput.element.value).toBe('#fedcba')

    // 无绑定(uncontrolled)契约的另一半:模板上不应该再有 :value 绑定——否则每次拖动都会
    // 把 customDotColor 拉回这个组件的渲染依赖里,读源文本确认删码没有复发。
    expect(placesThemeMenuRaw).not.toMatch(/:value="selection\.customDotColor"/)
    expect(placesThemeMenuRaw).not.toMatch(/:value="selection\.customCityColor"/)
  })
})

// ── Case 6/7:store 层面的防抖 + flush,集成到真实 <input> 拖拽事件(不只是直接调用
// action——这一段验证"真实拖拽会不会打到防抖"这条 UI→store 的接线;store 自己的防抖机制单测
// 见 places.test.ts,不在这里重复)。────────────────────────────────────────────────
describe('PlacesThemeMenu → store:连续拖拽取色器只落一次 localStorage 写入,卸载时 flush', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('30 次连续 input 事件只触发一次 setItem(250ms 防抖合并)', async () => {
    vi.useFakeTimers()
    const store = usePhotosPlaces()
    const w = mount(PlacesThemeMenu, {
      props: { selection: store.themePrefs, isLight: false, open: true },
      global: { plugins: [makeI18n()] },
    })
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const dotInput = w.get<HTMLInputElement>('[data-test="mtm-dot-input"]')

    for (let i = 0; i < 30; i++) {
      dotInput.element.value = `#${i.toString(16).padStart(6, '0')}`
      await dotInput.trigger('input')
      // 每次 @input 都 emit update:selection,但这个 harness 没有容器接住 emit 往 store 写——
      // 直接调用 store action 模拟"容器 onUpdateThemeSelection 已经接线"这一步(容器接线本身
      // 由 PhotosPlaces.test.ts 的既有集成用例覆盖,不在本文件重复挂一整个容器)。
      store.setCustomColors(dotInput.element.value, store.themePrefs.customCityColor)
    }
    expect(setItemSpy).not.toHaveBeenCalled() // 拖动过程中不落盘

    vi.advanceTimersByTime(250)
    expect(setItemSpy).toHaveBeenCalledTimes(1)
    const saved = JSON.parse(localStorage.getItem('nimo_places_map_theme')!)
    expect(saved.customDotColor).toBe('#00001d') // 最后一次(i=29)的值

    setItemSpy.mockRestore()
    vi.useRealTimers()
  })

  it('拖动中途卸载页面也会把最后一次选色 flush 落盘(store.flushThemePersist())', () => {
    vi.useFakeTimers()
    const store = usePhotosPlaces()
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    store.setCustomColors('#123456', store.themePrefs.customCityColor)
    expect(setItemSpy).not.toHaveBeenCalled() // 还在 250ms 防抖窗口内

    // 卸载即 flush——PhotosPlaces.vue 的 onUnmounted 调用的正是这同一个 store action。
    store.flushThemePersist()
    expect(setItemSpy).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem('nimo_places_map_theme')!).customDotColor).toBe('#123456')

    setItemSpy.mockRestore()
    vi.useRealTimers()
  })
})

// ── Case 8(Task 6 rewrite):自定义配色在亮/暗两种 **photos 私有主题**下都能正确地(命令式
// 地)落到 <svg> 上,且这个信号只跟 photos 私有主题走、不跟全局 app 主题走(D5 revert)——
// mount 整个 PhotosPlaces.vue 容器,验证 store→resolveMapTheme→mapThemeStyleVars→
// PlacesMap.applyMapVars 全链路真的接通(前面几个 case 都只挂了半截树,这条补上端到端)。
describe('自定义配色的命令式写入在亮/暗两种 photos 私有主题下都生效(端到端,D5 signal)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    __resetPhotosThemeForTests()
    svc.photos.listPlaces.mockClear()
  })
  afterEach(() => {
    __resetPhotosThemeForTests()
  })

  async function mountContainer() {
    const i18n = makeI18n()
    const router = createRouter({
      history: createWebHashHistory('/'),
      routes: [{ path: '/', name: 'home', component: PhotosPlaces }],
    })
    await router.push('/')
    await router.isReady()
    const w = mount(PhotosPlaces, { global: { plugins: [i18n, router] } })
    await Promise.resolve()
    await w.vm.$nextTick()
    return w
  }

  it.each([
    ['dark', 'dark', 'rgb(10, 10, 12)'], // '#0A0A0C'
    ['light', 'light', 'oklch(0.975 0.004 80)'],
  ] as const)('photos 私有主题 = %s:选自定义色后,svg 的 --map-dot-bg(经 hexToRgba 洗色)与 background(跟随主题)都落地', async (_label, photosThemeValue, expectedBg) => {
    usePhotosTheme().set(photosThemeValue)

    const w = await mountContainer()
    await w.find('[data-test="mtm-chip"]').trigger('click')
    const dotInput = w.get<HTMLInputElement>('[data-test="mtm-dot-input"]')
    await dotInput.setValue('#ff00aa')

    const svg = w.find('svg.map-canvas').element as SVGSVGElement
    // #106 sub-commit 3 remap: "Land dot color" 拾色器现在喂 dotBg(经 hexToRgba 固定 0.30
    // alpha 的洗色),不再直接喂 --map-dot(那是 pre-#106 的错误映射,Task 6 已修)。
    expect(svg.style.getPropertyValue('--map-dot-bg')).toBe('rgba(255,0,170,0.3)')
    // custom 模式 bg 现在跟随 isLight(#106 sub-commit 3 修的 bug:取色器一动,浅色地图不再
    // 翻黑),isLight 的信号来源是 photos 私有主题(D5 revert),不是全局 app 主题。
    expect(svg.style.background).toBe(expectedBg)

    w.unmount()
  })

  // ── D5 revert 的核心断言:两个方向都要覆盖 —— 全局主题切换不再牵动地图;
  // photos 私有主题切换才牵动地图。只测一个方向不足以证明"信号源换对了",两个方向合起来
  // 才排除掉"两个信号恰好同步"的巧合。────────────────────────────────────────────────
  it('D5:全局 app 主题切换不影响地图 —— photos 私有主题恒为 dark,即使全局主题切 light,custom 模式 bg 仍是深色字面量', async () => {
    usePhotosTheme().set('dark')
    useThemeStore().setTheme('light') // 全局主题切浅色——地图不该跟着变

    const w = await mountContainer()
    await w.find('[data-test="mtm-chip"]').trigger('click')
    await w.get<HTMLInputElement>('[data-test="mtm-dot-input"]').setValue('#ff00aa')

    const svg = w.find('svg.map-canvas').element as SVGSVGElement
    expect(svg.style.background).toBe('rgb(10, 10, 12)') // 仍是深色,没被全局主题带偏

    w.unmount()
  })

  it('D5:photos 私有主题切亮时地图跟着变浅 —— 即使全局主题仍是默认深色', async () => {
    usePhotosTheme().set('light')
    useThemeStore().setTheme('blue') // 全局主题仍是默认深色主题

    const w = await mountContainer()
    await w.find('[data-test="mtm-chip"]').trigger('click')
    await w.get<HTMLInputElement>('[data-test="mtm-dot-input"]').setValue('#ff00aa')

    const svg = w.find('svg.map-canvas').element as SVGSVGElement
    expect(svg.style.background).toBe('oklch(0.975 0.004 80)') // 跟着 photos 私有主题变浅

    w.unmount()
  })
})
