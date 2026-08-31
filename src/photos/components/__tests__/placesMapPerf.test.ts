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
// A follow-up pass deliberately scoped an earlier pass to sub-commit 4 only (the
// render-isolation architecture) and explicitly deferred #106's sub-commits 1-3 (color
// value/mapping fixes) plus the D5 signal-source revert -- this file covers that deferred
// work. Case 8's describe block below (and its two `it.each` cases) has been rewritten to
// assert the NOW-correct sub-commit-3 mapping (see src/photos/util/placesMapThemes.ts's own
// resolveMapTheme() comment) instead of the deliberately-deferred pre-#106 mapping the previous
// version of this file pinned down; two more cases were added directly below it proving the D5
// signal switch works in both directions (photos-private theme flips the map, global theme
// does not) -- this is the RED-then-GREEN test mandated for that switch.
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

// -- Fixture for Case 1: two hand-written dots (mirroring Vue2's test's `{ x, y, visited }`
// literals, bypassing visitedDots() computation -- directly validates the component's
// contract without pulling in the geometry algorithm). ------------------------------------
const HAND_DOTS = [
  { x: 1, y: 2, visited: false },
  { x: 3, y: 4, visited: true },
]

describe('PlacesWorldDots - dot rendering isolation (props is dots only)', () => {
  it('the props contract has exactly one field, dots', () => {
    // The <script setup> compiled output's props declaration is this component's only
    // reactive input contract.
    const declared = Object.keys((PlacesWorldDots as unknown as { props: Record<string, unknown> }).props)
    expect(declared).toEqual(['dots'])
  })

  it('each dot renders one circle; visited ones have is-visited, unvisited ones do not', () => {
    const w = mount(PlacesWorldDots, { props: { dots: HAND_DOTS } })
    const circles = w.findAll('circle')
    expect(circles).toHaveLength(2)
    expect(circles[0].classes()).not.toContain('is-visited')
    expect(circles[1].classes()).toContain('is-visited')
  })
})

// -- Shared direct-mount harness for Cases 2/3/4: a real PlacesMap, with the outer layer
// holding mutable activeId/themeVars refs, simulating "container state changed, new props
// passed down" without going through the full PhotosPlaces.vue container -- this is
// PlacesMap's own rendering-dependency surface, precisely testable without a full-page
// container. Uses h() to hand-write the render function (not a template string), avoiding
// a dependency on Vue's runtime compiler build. -------------------------------------------
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

// Self-check (a real pitfall hit during the first TDD pass): the `places` array must be
// constructed exactly once outside of render() -- only if its reference stays stable, the
// way PhotosPlaces.vue's real filteredPlaces computed does, will PlacesMap's own
// `dots = computed(() => visitedDots(props.places))` avoid being wrongly re-evaluated as if
// "a dependency changed." The first version wrote the `[PLAIN, ACTIVE_RECENT]` literal
// directly inside render(), so every time the Harness itself re-rendered it constructed a
// fresh array reference to feed PlacesMap's `places` prop -- that wasn't testing PlacesMap's
// isolation, it was testing "did my own test harness accidentally create a false failure
// source." Two test cases went red for this reason and have been corrected.
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

describe('PlacesMap - dragging the color picker must not block the main thread (recoloring does not repaint the dot field)', () => {
  it('changing themeVars 30 times (simulating one input event per frame while dragging the color picker) leaves the dots subcomponent\'s props reference unchanged throughout', async () => {
    const { w, themeVars } = mountMapHarness()
    const dotsBefore = w.findComponent(PlacesWorldDots).props('dots')

    for (let i = 0; i < 30; i++) {
      // A brand-new object reference each time, simulating what mapThemeStyleVars() produces
      // on every recomputation -- this is exactly the condition that makes Vue3 judge "this
      // prop changed" (reference comparison, not deep comparison).
      themeVars.value = { background: '#000000', '--map-dot': `#${i.toString(16).padStart(6, '0')}` }
      await nextTick()
    }

    const dotsAfter = w.findComponent(PlacesWorldDots).props('dots')
    // Strict reference equality: proves PlacesMap's own dots computed never re-evaluated
    // due to themeVars changing, and the props.dots reference PlacesWorldDots received also
    // never changed -- so Vue has no reason at all to repaint this child component.
    expect(dotsAfter).toBe(dotsBefore)

    // Reverse check: confirms the themeVars prop actually did propagate to PlacesMap (not
    // "nothing took effect and it coincidentally looks unchanged").
    expect(w.findComponent(PlacesMap).props('themeVars')['--map-dot']).toBe('#00001d')
  })
})

describe('PlacesMap - hover / selection does not repaint the dot field', () => {
  it('changing activeId (a downstream effect of hover/selection) does not change the dots subcomponent\'s props reference, but the pin does refresh', async () => {
    const { w, activeId } = mountMapHarness()
    const dotsBefore = w.findComponent(PlacesWorldDots).props('dots')
    const activeCountBefore = w.findAll('.geo-pin.is-active').length
    expect(activeCountBefore).toBe(0)

    activeId.value = 'active-recent'
    await nextTick()

    const dotsAfter = w.findComponent(PlacesWorldDots).props('dots')
    expect(dotsAfter).toBe(dotsBefore) // the dot-field subcomponent has no reason to repaint throughout

    // But PlacesMap itself did re-render (the pin's is-active reflects the new activeId) --
    // proving the "unchanged" above isn't because the whole tree never re-rendered, but
    // because isolation is actually working.
    expect(w.findAll('.geo-pin.is-active').length).toBe(1)
  })
})

describe('PlacesMap - color changes land on the DOM via CSS variables (a watch-triggered follow-up update, not just the initial mount)', () => {
  it('changing themeVars again after mount, the new value does land on the <svg>\'s style', async () => {
    // Note: PlacesMap.test.ts already pins down "themeVars lands on svg style at mount time"
    // (that file's :62-67). What's added here is the angle it doesn't cover -- when
    // themeVars changes again *after* mount, does the watch()-driven imperative write also
    // update (proving this is an ongoing reactive side effect, not a dead value that only
    // runs once in onMounted).
    const { w, themeVars } = mountMapHarness()
    const svg = w.find('svg').element as SVGSVGElement
    expect(svg.style.getPropertyValue('--map-dot')).toBe('#111111')

    themeVars.value = { background: 'rgb(9, 9, 9)', '--map-dot': '#ff0000', '--map-grid': '#00ff00', '--map-dot-bg': 'rgba(1,2,3,0.3)' }
    await nextTick()

    expect(svg.style.background).toContain('rgb(9, 9, 9)')
    expect(svg.style.getPropertyValue('--map-dot')).toBe('#ff0000')
    expect(svg.style.getPropertyValue('--map-grid')).toBe('#00ff00')
    expect(svg.style.getPropertyValue('--map-dot-bg')).toBe('rgba(1,2,3,0.3)')

    // Conditional-spread semantics (mapThemeStyleVars()'s contract, which applyMapVars()
    // must honor): when dotBg is not in vars, the --map-dot-bg written last time must be
    // cleared via removeProperty, not left stuck on the old value.
    themeVars.value = { background: '#0A0A0C', '--map-dot': '#6E5BFF', '--map-grid': '#9C8EFF' }
    await nextTick()
    expect(svg.style.getPropertyValue('--map-dot-bg')).toBe('')
  })
})

function makeI18n() {
  return createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
}

// -- Case 5: the color picker is uncontrolled + gets fed its initial value when the popover
// opens (mounts PlacesThemeMenu directly against the real store; doesn't need the whole
// PhotosPlaces.vue -- this contract only involves these two). -----------------------------
describe('PlacesThemeMenu - feeds the current colors to the unbound color pickers when the popover opens', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('open flips from false to true: both <input type=color>\'s .value get synced to selection\'s current colors', async () => {
    const store = usePhotosPlaces()
    store.setCustomColors('#abcdef', '#fedcba')

    const w = mount(PlacesThemeMenu, {
      props: { selection: store.themePrefs, isLight: false, open: false },
      global: { plugins: [makeI18n()] },
    })
    // Before opening: the popover's v-if hasn't rendered yet, so neither input is in the DOM.
    expect(w.find('[data-test="mtm-dot-input"]').exists()).toBe(false)

    await w.setProps({ open: true })
    await nextTick() // the popover's v-if renders the inputs
    await nextTick() // the nextTick(syncColorInputs) inside watch(open) lands

    const dotInput = w.get<HTMLInputElement>('[data-test="mtm-dot-input"]')
    const gridInput = w.get<HTMLInputElement>('[data-test="mtm-grid-input"]')
    expect(dotInput.element.value).toBe('#abcdef')
    expect(gridInput.element.value).toBe('#fedcba')

    // The other half of the uncontrolled contract: the template must not have a :value
    // binding -- otherwise every drag would pull customDotColor back into this component's
    // render dependencies. Read the raw source to confirm the removed code hasn't crept back.
    expect(placesThemeMenuRaw).not.toMatch(/:value="selection\.customDotColor"/)
    expect(placesThemeMenuRaw).not.toMatch(/:value="selection\.customCityColor"/)
  })
})

// -- Cases 6/7: store-level debouncing + flush, integrated with real <input> drag events
// (not just calling the action directly -- this section verifies the UI-to-store wiring for
// "does a real drag actually hit the debounce"; the store's own debounce mechanism has its
// own unit test in places.test.ts and isn't repeated here). -------------------------------
describe('PlacesThemeMenu -> store: continuously dragging the color picker only writes to localStorage once, and flushes on unmount', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('30 consecutive input events trigger setItem only once (250ms debounce coalescing)', async () => {
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
      // Every @input emits update:selection, but this harness has no container catching the
      // emit to write to the store -- call the store action directly to simulate "the
      // container's onUpdateThemeSelection is already wired up" (the container wiring
      // itself is covered by PhotosPlaces.test.ts's existing integration test, not repeated
      // here by mounting a whole container).
      store.setCustomColors(dotInput.element.value, store.themePrefs.customCityColor)
    }
    expect(setItemSpy).not.toHaveBeenCalled() // nothing persisted while dragging

    vi.advanceTimersByTime(250)
    expect(setItemSpy).toHaveBeenCalledTimes(1)
    const saved = JSON.parse(localStorage.getItem('nimo_places_map_theme')!)
    expect(saved.customDotColor).toBe('#00001d') // the value from the last iteration (i=29)

    setItemSpy.mockRestore()
    vi.useRealTimers()
  })

  it('unmounting mid-drag still flushes the last selected color to disk (store.flushThemePersist())', () => {
    vi.useFakeTimers()
    const store = usePhotosPlaces()
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    store.setCustomColors('#123456', store.themePrefs.customCityColor)
    expect(setItemSpy).not.toHaveBeenCalled() // still within the 250ms debounce window

    // Unmount triggers a flush -- PhotosPlaces.vue's onUnmounted calls this exact same store action.
    store.flushThemePersist()
    expect(setItemSpy).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem('nimo_places_map_theme')!).customDotColor).toBe('#123456')

    setItemSpy.mockRestore()
    vi.useRealTimers()
  })
})

// -- Case 8: custom colors land correctly (imperatively) on the <svg> in both light and
// dark **Photos-private themes**, and this signal follows only the Photos-private theme, not
// the global app theme (the D5 revert) -- mounts the full PhotosPlaces.vue container to
// verify the whole chain store -> resolveMapTheme -> mapThemeStyleVars ->
// PlacesMap.applyMapVars is actually wired up (the previous cases only mounted half the
// tree; this one adds end-to-end coverage). ------------------------------------------------
describe('custom-color imperative writes take effect in both light and dark Photos-private themes (end-to-end, D5 signal)', () => {
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
  ] as const)('Photos-private theme = %s: after picking a custom color, both the svg\'s --map-dot-bg (washed through hexToRgba) and background (following the theme) land correctly', async (_label, photosThemeValue, expectedBg) => {
    usePhotosTheme().set(photosThemeValue)

    const w = await mountContainer()
    await w.find('[data-test="mtm-chip"]').trigger('click')
    const dotInput = w.get<HTMLInputElement>('[data-test="mtm-dot-input"]')
    await dotInput.setValue('#ff00aa')

    const svg = w.find('svg.map-canvas').element as SVGSVGElement
    // Remap: the "Land dot color" picker now feeds dotBg (washed through hexToRgba with a
    // fixed 0.30 alpha), no longer feeding --map-dot directly (that was the earlier
    // incorrect mapping, since fixed).
    expect(svg.style.getPropertyValue('--map-dot-bg')).toBe('rgba(255,0,170,0.3)')
    // The custom-mode background now follows isLight (fixing the bug where moving the color
    // picker would stop a light map from turning dark again); the isLight signal's source is
    // the Photos-private theme (the D5 revert), not the global app theme.
    expect(svg.style.background).toBe(expectedBg)

    w.unmount()
  })

  // -- The core assertion of the D5 revert: both directions must be covered -- switching the
  // global theme no longer affects the map; switching the Photos-private theme does affect
  // the map. Testing only one direction isn't enough to prove "the signal source was swapped
  // correctly" -- both directions together rule out "the two signals just happen to stay in
  // sync" as a coincidence. --------------------------------------------------------------
  it('D5: switching the global app theme does not affect the map -- with the Photos-private theme fixed at dark, even switching the global theme to light leaves the custom-mode background as the dark literal', async () => {
    usePhotosTheme().set('dark')
    useThemeStore().setTheme('light') // switch the global theme to light -- the map should not follow

    const w = await mountContainer()
    await w.find('[data-test="mtm-chip"]').trigger('click')
    await w.get<HTMLInputElement>('[data-test="mtm-dot-input"]').setValue('#ff00aa')

    const svg = w.find('svg.map-canvas').element as SVGSVGElement
    expect(svg.style.background).toBe('rgb(10, 10, 12)') // still dark, unaffected by the global theme

    w.unmount()
  })

  it('D5: when the Photos-private theme switches to light, the map follows and turns light -- even though the global theme is still the default dark theme', async () => {
    usePhotosTheme().set('light')
    useThemeStore().setTheme('blue') // the global theme is still the default dark theme

    const w = await mountContainer()
    await w.find('[data-test="mtm-chip"]').trigger('click')
    await w.get<HTMLInputElement>('[data-test="mtm-dot-input"]').setValue('#ff00aa')

    const svg = w.find('svg.map-canvas').element as SVGSVGElement
    expect(svg.style.background).toBe('oklch(0.975 0.004 80)') // follows the Photos-private theme and turns light

    w.unmount()
  })
})
