// PhotosPlaces.vue — the container that wires the places/map main view's pieces into one
// usable page. Covers the "required test checklist" item by item, plus 6 code-removal checks.
//
// Mounts Pinia + i18n + a real router (a push spy isn't needed; AreaShell/PhotosSidebar both
// use useRouter() — following PhotosAlbums.test.ts/PhotosPeople.test.ts's existing mounting
// pattern), mocks the shared photos package methods.
//
// The pick-pin/hover-pin interactions emit directly on the PlacesMap child component via
// `vm.$emit(...)`, rather than reverse-engineering a specific pin's DOM position from the SVG's
// internal buildPins/clusterByOverlap geometry layout — that geometry layer is already covered
// by PlacesMap.test.ts/placesMap.test.ts's own unit tests; this file only verifies "did the
// container wire things up correctly once it received the emit," to avoid coupling the
// clustering algorithm's implementation details into this integration test and making it
// brittle.
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
    // ── Needed for the PhotoLightbox mount + useLightbox.openAt() chain (D9). ──
    getAsset: vi.fn().mockResolvedValue({}),
    getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
    recordView: vi.fn().mockResolvedValue(undefined),
    listFavoriteIds: vi.fn().mockResolvedValue([]),
    originalUrl: vi.fn((id: string | number) => `mock://original/${id}`),
    liveUrl: vi.fn((id: string | number) => `mock://live/${id}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// jsdom has no media stack (referenced as soon as PhotoLightbox mounts, same prerequisite as
// PhotosPersonDetail.test.ts).
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
    history: createWebHashHistory('/'),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/photos/places', name: 'photos-places', component: PhotosPlaces },
    ],
  })
}

// Fallout fix: `createAlbum()` now fires a real
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

// ── raw (backend) places fixture ──────────────────────────────────────────────
// TOKYO(9990)+PARIS(2345)+CLUSTER_A(5)+CLUSTER_B(5) = 12345, a total assembled specifically for
// the "toLocaleString thousands separator" test case; CLUSTER_A/CLUSTER_B's coordinates are
// extremely close together (same existing precedent as PlacesMap.test.ts), used so that
// splitScaleFor has two members that can genuinely be split apart under the zoomToCluster
// integration scenario.
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

// ---- Fake requestAnimationFrame: collect callbacks, then manually flush them all at once
// with an arbitrarily large `now` to jump straight to the animation's end (same existing
// precedent as usePlacesView.test.ts — not driven by vi.useFakeTimers()). ----
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
  // usePhotosToast() is a module-level singleton (same pattern as
  // useLightbox() above) — reset between tests so one test's queued toast doesn't leak
  // into the next test's assertions.
  usePhotosToast().__resetForTests()
})
afterEach(() => {
  vi.restoreAllMocks()
  // Actually unmount every wrapper `mountView()` created THIS test
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

// Jump an in-flight animation straight to its end point (ease(k=1)) in one shot — in a real
// scenario it would arrive after 420ms; here that wait is skipped.
function flushAnim(): void {
  const cbs = rafCallbacks.splice(0)
  for (const cb of cbs) cb(performance.now() + 100000)
}

// Task 1 (Plan E re-shell): brief's Step 1 RED test — the transitional AreaShell/.photos-layout
// shell has been swapped for the same `.photos-root > .app[data-collapsed] > PhotosSidebar +
// main.main > PhotosTopbar + .photos-main` structure every other re-shelled Photos page uses
// (PhotosPeople.vue/PhotosAlbums.vue's own precedent, PhotosPeople.test.ts's own re-shell test
// as the style reference).
describe('PhotosPlaces.vue re-shell', () => {
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

    // PhotoLightbox re-nested INSIDE .photos-root -- the re-skin
    // (Tasks 3-4) removed the scoped-vs-parity cascade tie that made nesting unsafe (F8-r4).
    const rootEl = w.find('.photos-root').element
    const lbComp = w.findComponent({ name: 'PhotoLightbox' })
    expect(rootEl.contains(lbComp.element)).toBe(true)
  })
})

describe('first-screen load + auto-select', () => {
  it('onMounted calls fetchPlaces; auto-selects the first place once loaded', async () => {
    const { w } = await mountView()
    expect(svc.photos.listPlaces).toHaveBeenCalledTimes(1)
    expect(w.findComponent(PlacesRail).props('activeId')).toBe('1')
    expect(w.findComponent(PlacesMap).props('activeId')).toBe('1')
  })

  // Review fix: now that hasDetailPanel reflects real state, the first-screen
  // auto-selection makes activePlace hit immediately (a place existing means hasPanel=true),
  // so the previously assumed "dead center" value no longer holds — wrapEl is a real DOM node,
  // and jsdom's default getBoundingClientRect always returns all zeros, so `420/0=Infinity`
  // gets clamped to 0.55 by `Math.min(0.55, …)` (not the 0.42 hand-computed in the two
  // usePlacesView cases added by T8 — those two explicitly mock wrapEl's width as 1000).
  // tx's conversion accordingly switches to c.x=225 for panelFrac=0.55; the ty formula is
  // unaffected (panelFrac only changes x, see usePlacesView.ts:98-99).
  it('after auto-select, autoPanTo is called with the first place (TOKYO) — verified precisely via view tx/ty/scale', async () => {
    const { w } = await mountView()
    // autoPanTo → centerOn → animateView has already synchronously queued a raf callback;
    // flush it to take the easing straight to its end point.
    expect(rafCallbacks.length).toBeGreaterThan(0)
    flushAnim()
    await w.vm.$nextTick()
    const view = w.findComponent(PlacesMap).props('view') as { tx: number, ty: number, scale: number }
    // centerOn(wx,wy,scale)'s conversion: c = visibleCenterVb() (hasDetailPanel is true at
    // this point — the place auto-selected on first screen IS activePlace; wrapEl's width
    // isn't mocked, so panelFrac clamps to 0.55, c.x = 1000*(1-0.55)/2 = 225, c.y is still
    // MAP_H/2), scale = max(1, 1.8) = 1.8, tx = c.x - wx*scale, ty = c.y - wy*scale.
    const { x: wx, y: wy } = project(TOKYO.lon, TOKYO.lat)
    expect(view.scale).toBeCloseTo(1.8, 5)
    expect(view.tx).toBeCloseTo(225 - wx * 1.8, 3)
    expect(view.ty).toBeCloseTo(MAP_H / 2 - wy * 1.8, 3)
  })
})

describe('activeId switch triggers loadDetail', () => {
  it('switching to another place calls getPlace via loadDetail with the resolved backend key', async () => {
    const { w } = await mountView()
    await flushPromises()
    expect(svc.photos.getPlace).toHaveBeenCalledWith(1) // first-screen auto-selects TOKYO (key=1)
    svc.photos.getPlace.mockClear()

    const pin: Pin = { id: '2', x: 0, y: 0, r: 10, hitR: 10, count: PARIS.count, city: PARIS.city, country: PARIS.country, thumbs: PARIS.thumbs, coverAssetId: PARIS.coverAssetId, recent: PARIS.recent, cluster: false, active: false }
    await w.findComponent(PlacesMap).vm.$emit('pick-pin', pin, new MouseEvent('click'))
    await flushPromises()
    expect(w.findComponent(PlacesRail).props('activeId')).toBe('2')
    expect(svc.photos.getPlace).toHaveBeenCalledWith(2) // PARIS(key=2)
  })
})

describe('filter sync: rail and map receive the same filtered places; rail search does not affect map', () => {
  it('after minCount=50, both rail and map places narrow from 4 to 2', async () => {
    const { w } = await mountView()
    expect(w.findComponent(PlacesRail).props('places')).toHaveLength(4)
    expect(w.findComponent(PlacesMap).props('places')).toHaveLength(4)

    await w.find('[data-test="pfm-chip"]').trigger('click')
    const btns = w.findAll('[data-test="pfm-mincount-btn"]')
    await btns[2].trigger('click') // MIN_COUNT_STEPS = [0,10,50,100,200], index 2 = 50

    expect(w.findComponent(PlacesRail).props('places')).toHaveLength(2)
    expect(w.findComponent(PlacesMap).props('places')).toHaveLength(2)
  })

  it('changing the rail search term leaves map places prop unchanged', async () => {
    const { w } = await mountView()
    const before = w.findComponent(PlacesMap).props('places')
    await w.find('.map-search input').setValue('nonexistent-city-xyz')
    await w.vm.$nextTick()
    expect(w.findComponent(PlacesMap).props('places')).toBe(before)
    expect(w.findComponent(PlacesMap).props('places')).toHaveLength(4)
  })

  // Review I3: the rail's empty-state branching relies on the totalPlaces the container
  // passes down (the unfiltered full count) — once the filter conditions narrow
  // filteredPlaces to zero, totalPlaces must still be the full unfiltered length, it can't
  // drop to zero along with the filtered result (otherwise the rail would branch into the
  // wrong empty state, showing "no location data yet" instead of "no cities match the
  // current filter").
  it('after minCount + regionFilter narrow the result to zero, rail still receives the full totalPlaces (4)', async () => {
    const { w } = await mountView()
    await w.find('[data-test="pfm-chip"]').trigger('click')
    const btns = w.findAll('[data-test="pfm-mincount-btn"]')
    // MIN_COUNT_STEPS = [0,10,50,100,200], index 4 = 200: first narrows out CLUSTER_A/B
    // (count=5), leaving TOKYO(9990)/PARIS(2345).
    await btns[4].trigger('click')
    // Then layers on a continent filter for americas — TOKYO is asia, PARIS is europe,
    // neither is americas, so intersecting with the minCount condition above filters out all
    // four fixtures, and filteredPlaces drops to zero.
    await w.find('[data-test="pfm-region-btn"][data-region-id="americas"]').trigger('click')
    expect(w.findComponent(PlacesRail).props('places')).toHaveLength(0)
    expect(w.findComponent(PlacesRail).props('totalPlaces')).toBe(4)
  })
})

describe('pick-pin wiring', () => {
  it('a cluster pin calls zoomToCluster (view.scale changes, driven by splitScaleFor with real CLUSTER_A/B members)', async () => {
    const { w } = await mountView()
    flushAnim() // First flush the easing triggered by first-screen auto-selection, so it doesn't bleed into the assertions below
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
    // The current scale is not 1 (the container's initial value; the previous autoPan was
    // already flushed above by flushAnim without producing a new call) — at this point
    // view.scale is actually already 1.8, and zoomToCluster's target is
    // max(currentScale+0.01, splitScaleFor(...)) >= 1.81, so it's enough to assert "it did
    // keep getting bigger," without depending on splitScaleFor's exact value (that's T2/T7's
    // own unit-test territory).
    expect(view.scale).toBeGreaterThan(1.8)
    // activeId shouldn't change just from clicking a cluster (a cluster has no single id).
    expect(w.findComponent(PlacesRail).props('activeId')).toBe('1')
  })

  it('a non-cluster pin sets activeId to pin.id', async () => {
    const { w } = await mountView()
    const pin: Pin = { id: '2', x: 0, y: 0, r: 10, hitR: 10, count: PARIS.count, city: PARIS.city, country: PARIS.country, thumbs: PARIS.thumbs, coverAssetId: PARIS.coverAssetId, recent: PARIS.recent, cluster: false, active: false }
    await w.findComponent(PlacesMap).vm.$emit('pick-pin', pin, new MouseEvent('click'))
    expect(w.findComponent(PlacesRail).props('activeId')).toBe('2')
    expect(w.findComponent(PlacesMap).props('activeId')).toBe('2')
  })
})

describe('hover card', () => {
  function mockCurrentTarget(): Element {
    const el = document.createElement('div')
    el.getBoundingClientRect = () => ({ left: 100, top: 200, right: 110, bottom: 210, width: 10, height: 10, x: 100, y: 200, toJSON: () => ({}) }) as DOMRect
    return el
  }
  function pinFor(raw: typeof PARIS, id: string): Pin {
    return { id, x: 0, y: 0, r: 10, hitR: 10, count: raw.count, city: raw.city, country: raw.country, thumbs: raw.thumbs, coverAssetId: raw.coverAssetId, recent: raw.recent, cluster: false, active: false }
  }

  it('hovering an unselected place shows the tip with city/country/photo count', async () => {
    const { w } = await mountView() // first screen already auto-selected '1' (TOKYO)
    const ev = { currentTarget: mockCurrentTarget() } as unknown as MouseEvent
    await w.findComponent(PlacesMap).vm.$emit('hover-pin', pinFor(PARIS, '2'), ev)
    await w.vm.$nextTick()
    const tip = w.find('[data-test="map-tip"]')
    expect(tip.exists()).toBe(true)
    expect(tip.text()).toContain('Paris')
    expect(tip.text()).toContain('France')
    expect(tip.text()).toContain('2345 张照片') // photosPlacesPhotoCount({n: 2345}), doesn't go through toLocaleString (per Vue2 :1025)
  })

  it('hovering the currently selected place shows no tip', async () => {
    const { w } = await mountView() // activeId is already '1'
    const ev = { currentTarget: mockCurrentTarget() } as unknown as MouseEvent
    await w.findComponent(PlacesMap).vm.$emit('hover-pin', pinFor(TOKYO as unknown as typeof PARIS, '1'), ev)
    await w.vm.$nextTick()
    expect(w.find('[data-test="map-tip"]').exists()).toBe(false)
  })

  it('hover-clear hides the tip', async () => {
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

describe('legend + stats', () => {
  it('legend has all 4 groups; the 4th group copy is the real i18n value "本次旅行"; all three numeric literals are present', async () => {
    const { w } = await mountView()
    const legend = w.find('[data-test="map-legend"]')
    expect(legend.findAll('.grp')).toHaveLength(4)
    expect(legend.text()).toContain('< 40')
    expect(legend.text()).toContain('40–100')
    expect(legend.text()).toContain('100+')
    expect(legend.text()).toContain('本次旅行')
  })

  it('stats has three items; photo count goes through toLocaleString (12345 → "12,345")', async () => {
    const { w } = await mountView()
    const stats = w.find('[data-test="map-stats"]')
    const values = stats.findAll('.v').map((n) => n.text())
    expect(values).toEqual(['4', '3', '12,345'])
  })

  // The 4th group's green can't win over the base class `.map-legend .dot` merely
  // by "happening to be written later in the style block" — the two selectors' specificity
  // must genuinely differ (the 4th group's selector carries one extra class), independent of
  // source-code ordering.
  it('the 4th group selector genuinely outranks the base .map-legend .dot rule (not just source order)', () => {
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

describe('load failure state', () => {
  it('fetchPlaces failure shows the failure copy + retry button; clicking retry calls fetchPlaces again', async () => {
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

  // Review I4: Vue2 puts "if nothing is selected, pick places[0]" inside loadPlaces() itself,
  // so every successful load (not just the first) auto-selects, autoPans, and triggers
  // loadDetail. retryLoad used to only call store.fetchPlaces() and missed this step —
  // after a first-screen failure, clicking retry and succeeding the second time would leave
  // an inconsistent end state: "the rail is full of cities, the map has drawn pins, but no
  // city is selected."
  it('after the first fetchPlaces fails, retrying and succeeding auto-selects the first place and calls loadDetail', async () => {
    svc.photos.listPlaces.mockRejectedValueOnce(new Error('network down'))
    const { w } = await mountView()
    expect(w.find('[data-test="places-failed"]').exists()).toBe(true)
    expect(svc.photos.getPlace).not.toHaveBeenCalled()

    svc.photos.listPlaces.mockImplementationOnce(okListPlaces)
    await w.find('[data-test="places-retry"]').trigger('click')
    await flushPromises()

    expect(w.find('[data-test="places-failed"]').exists()).toBe(false)
    expect(w.findComponent(PlacesRail).props('activeId')).toBe('1') // TOKYO (key=1) is the first one in the fixture
    expect(svc.photos.getPlace).toHaveBeenCalledWith(1)
  })
})

// The failed-state condition must be tightened with `attempted`, otherwise
// "hasn't been requested yet" (the instant before onMounted's async fetchPlaces has actually
// started running) gets misjudged as "requested and failed."
//
// Debugging note (a real lesson learned during TDD, kept here so nobody "optimizes" this into
// a helper and falls back into the same trap): this test case originally wrapped `mount()`
// inside an `async function mountFresh() { ...; return { w } }` and then did
// `await mountFresh()`, and the result was that it couldn't tell the difference whether M2 was
// fixed or not — because the Promise an async function returns will always yield one
// microtask when awaited, even with no other await left in the function body; and the line
// `attempted.value = true` inside onMounted runs **synchronously** (there's no await before
// it), so Vue's reactivity scheduler had already queued that change into the microtask queue
// from inside mount() itself — that one extra await happened to push the assertion to after
// "Vue has already re-rendered once," so the actual first frame was never visible. Switching
// to not wrapping a helper, and asserting immediately with no await at all after mount(), is
// what actually catches the first frame (manually cross-checked both versions' real
// difference under the "delete the `attempted` tightening" mutation using w.html()).
describe('first-frame gating: distinguishes "not requested yet" from "requested and failed"', () => {
  it('the first frame (before onMounted\'s async fetchPlaces resolves) shows the skeleton, not the failure state', async () => {
    const router = makeRouter()
    router.push('/photos/places')
    await router.isReady() // this await is before mount(), so it doesn't affect the frame we're trying to catch below
    const w = mount(PhotosPlaces, { global: { plugins: [i18n, router] } })
    // Assert immediately after mount() — there must be no await in between, see the comment above.
    expect(w.find('[data-test="places-skeleton"]').exists()).toBe(true)
    expect(w.find('[data-test="places-failed"]').exists()).toBe(false)
  })
})

describe('pointer gesture pass-through', () => {
  it('dragging on the svg moves PlacesMap\'s view.tx (usePlacesView.ts offset conversion)', async () => {
    const { w } = await mountView()
    flushAnim() // First flush the easing triggered by first-screen auto-selection, so it doesn't bleed into the tx before/after comparison
    await w.vm.$nextTick()
    const before = (w.findComponent(PlacesMap).props('view') as { tx: number }).tx

    const svg = w.find('svg.map-canvas')
    await svg.trigger('pointerdown', { clientX: 100, clientY: 100, pointerId: 1, bubbles: true })
    await svg.trigger('pointermove', { clientX: 180, clientY: 100, pointerId: 1, bubbles: true })

    const after = (w.findComponent(PlacesMap).props('view') as { tx: number }).tx
    expect(after).not.toBeCloseTo(before, 5)
  })

  it('pointermove after pointerup no longer pans (drag state already cleared)', async () => {
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

  it('pressing down on a pin (.geo-pin) does not pan the map (usePlacesView.ts closest guard)', async () => {
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

describe('wheel explicit addEventListener registration', () => {
  it('svgEl.addEventListener("wheel", ..., { passive: false }); removeEventListener is called on unmount', async () => {
    const addSpy = vi.spyOn(SVGSVGElement.prototype, 'addEventListener')
    const removeSpy = vi.spyOn(SVGSVGElement.prototype, 'removeEventListener')
    const { w } = await mountView()
    const wheelCall = addSpy.mock.calls.find((c) => c[0] === 'wheel')
    expect(wheelCall).toBeTruthy()
    expect(wheelCall?.[2]).toEqual({ passive: false })

    w.unmount()
    const wheelRemoveCall = removeSpy.mock.calls.find((c) => c[0] === 'wheel')
    expect(wheelRemoveCall).toBeTruthy()
    expect(wheelRemoveCall?.[1]).toBe(wheelCall?.[1]) // the removed reference must be the exact same function reference that was added
  })
})

describe('Esc handling for two popovers does not interfere with each other', () => {
  it('with Filters and map theme popovers both open, one Esc closes both', async () => {
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

describe('map theme popover wiring', () => {
  it('picking a preset changes store.themePrefs.mapTheme, and PlacesMap\'s themeVars.background follows', async () => {
    const { w } = await mountView()
    const before = (w.findComponent(PlacesMap).props('themeVars') as { background: string }).background

    await w.find('[data-test="mtm-chip"]').trigger('click')
    await w.find('[data-theme-id="ocean"]').trigger('click')

    const store = usePhotosPlaces()
    expect(store.themePrefs.mapTheme).toBe('ocean')
    const after = (w.findComponent(PlacesMap).props('themeVars') as { background: string }).background
    expect(after).not.toBe(before)
  })

  it('changing the color picker sets mapTheme to custom and persists customDotColor', async () => {
    const { w } = await mountView()
    await w.find('[data-test="mtm-chip"]').trigger('click')
    const dotInput = w.find('[data-test="mtm-dot-input"]')
    await dotInput.setValue('#123456')

    const store = usePhotosPlaces()
    expect(store.themePrefs.mapTheme).toBe('custom')
    expect(store.themePrefs.customDotColor).toBe('#123456')
    // The theme popover's selection prop connects directly to store.themePrefs
    // (disambiguation 3: reads always go through the store) — this also verifies the
    // read-back actually works, not just a one-way link where "the store gets written but
    // the UI still reads the old value."
    expect(w.findComponent(PlacesThemeMenu).props('selection')).toMatchObject({ mapTheme: 'custom', customDotColor: '#123456' })
  })
})

describe('.map-toolbar pointer-events guard', () => {
  it('both pointer-events:none and the > * auto rule are present in the style block', () => {
    const style = extractStyleBlock(photosPlacesRaw)
    expect(/\.map-toolbar\s*\{[^}]*pointer-events:\s*none/.test(style)).toBe(true)
    expect(/\.map-toolbar\s*>\s*\*\s*\{[^}]*pointer-events:\s*auto/.test(style)).toBe(true)
  })
})

// On-device bug report: "the filter popover gets covered by the map zoom +/-
// bar" — Vue2 sets both .map-toolbar and .map-zoombar to z-index:4; the toolbar forms its own
// stacking context, so its inner popover's z-index:30 can't climb over the sibling zoombar,
// and DOM order puts the zoombar after the toolbar, so the zoom bar ends up painted on top of
// the Filters/theme popovers (see the note above .map-toolbar). What this pins down is the
// invariant itself — "the toolbar sits above these overlays" (the toolbar's z-index is
// strictly greater than the max of legend/stats/tip and the zoombar) — not a hardcoded value
// of 7; any equivalent stacking adjustment is fine, and dropping the toolbar back to 4 will
// fail this test.
//
// Update (shadowing cleanup): `.map-zoombar`'s z-index used to live in
// PlacesZoomBar.vue's own `<style scoped>` block; that whole block has since been deleted
// (parity governs 100% of `.map-zoombar` now, and this component no longer carries a
// `<style>` tag at all — `extractStyleBlock` would throw "未找到样式块" on it). Read the
// same rule from the shared parity stylesheet instead, which is now the *only* place this
// value lives — same source of truth the app itself renders from.
describe('.map-toolbar stacking-order guard', () => {
  function zIndexOf(rules: ReturnType<typeof parseCssRules>, selector: string): number {
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === selector)
    if (!rule) throw new Error(`未找到规则:${selector}`)
    const m = /z-index:\s*(-?\d+)/.exec(rule.body)
    if (!m) throw new Error(`规则 ${selector} 没有 z-index 声明`)
    return Number(m[1])
  }

  it('.map-toolbar z-index is strictly greater than the other overlays in the container (.map-legend/.map-stats/.map-tip) and parity\'s .map-zoombar', () => {
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

describe('route + sidebar (append-only, no reorder)', () => {
  // NAV adds smart-views, inserted after places and before favorites — a regression update
  // (an inevitable side effect of a PhotosSidebar.vue change, not within this file's own
  // task scope, just syncing the assertion along the way).
  // This entry's label changes from "智能视图" to "为你推荐" (id/route unchanged; the page has
  // since narrowed to a Moments-only "for you" page, and smart albums moved into Albums) —
  // syncing item 5's copy along with it.
  it('sidebar NAV order is library, albums, people, places, smart-views, favorites, trash', async () => {
    const { w } = await mountView()
    // Task 3 (shell + sidebar re-cut) changed the nav item's class names from
    // `.side-item`/`.side-name` to Vue2's `.nav-item` (a single bare <span> holding the label
    // text, with no dedicated name subclass — matching Vue2's own source). The selector is
    // updated to follow along here — not a functional change within this file's own task scope.
    const ids = w.findAll('.nav-item').map((n) => n.text())
    // The sidebar renders i18n label text, so this compares the copy sequence directly
    // (matching the zh_CN dictionary values for photosLibrary/.../photosTrash one for one) —
    // no need to additionally parse the source; this IS the direct evidence that "the sidebar
    // really does render in this order."
    expect(ids).toEqual(['照片库', '相册', '人物', '地点', '为你推荐', '收藏', '最近删除'])
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Container wiring — detail panel / cover popover / spot / lightbox / album toast / jump-to-library navigation
// ════════════════════════════════════════════════════════════════════════════

describe('detail panel visibility', () => {
  it('activeId matching a list item mounts PlaceDetailPanel; activeId=null unmounts it', async () => {
    const { w } = await mountView() // first screen already auto-selected TOKYO
    expect(w.findComponent(PlaceDetailPanel).exists()).toBe(true)
    await w.findComponent(PlacesRail).vm.$emit('pick', null)
    await w.vm.$nextTick()
    expect(w.findComponent(PlaceDetailPanel).exists()).toBe(false)
  })

  it('clicking the panel close sets activeId to null and calls loadDetail(null)', async () => {
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

// The cover picker's head thumbnail (`.cp-head-thumb`) rendered empty. Root cause: this
// container's `current-asset-id` prop
// binding only read `activeDetail?.coverAssetId ?? ''` — missing the `thumbs[0]` fallback
// Vue2's own `currentHero` computed applies (PhotosPlacesView.vue:310-314: `this.activeDetail.
// coverAssetId || (this.activeDetail.thumbs || [])[0] || ''`). Most places have no *explicit*
// coverAssetId (only set once a user actually picks one via this same dialog) and fall back to
// their first thumb for a cover — exactly the common case this bug always showed empty for.
describe('cover popover head thumbnail falls back to activeDetail.thumbs[0]', () => {
  it('activeDetail.coverAssetId empty but thumbs non-empty → PlaceCoverPicker current-asset-id falls back to thumbs[0]', async () => {
    const { w } = await mountView() // first screen already auto-selected TOKYO (id=1)
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

  it('activeDetail.coverAssetId non-empty → current-asset-id prefers coverAssetId over thumbs[0]', async () => {
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

describe('guard: detail does not retain the previous city after switching cities', () => {
  it('store.detail is city B while activeId is city A → panel detail prop is null, place prop is city A', async () => {
    const { w } = await mountView() // activeId = '1' (TOKYO)
    const store = usePhotosPlaces()
    // Simulate the race window where "the previous city's (PARIS, id=2) detail response
    // hasn't been overwritten by the new request yet."
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

describe('hasDetailPanel becomes real (panelFrac actually takes effect)', () => {
  it('the same setScale call lands differently with the panel open vs. closed (wrapEl width 1000 → panelFrac=0.42 → center x=290, not 500)', async () => {
    const { w } = await mountView() // first screen already auto-selected TOKYO, hasPanel = true
    flushAnim()
    await w.vm.$nextTick()

    // Pin wrapEl's width so panelFrac lands in the unclamped range (matching
    // usePlacesView.test.ts's own established mock value of 1000), instead of jsdom's default
    // 0 width getting clamped to 0.55.
    const wrap = w.find('.map-canvas-wrap').element as HTMLElement
    wrap.getBoundingClientRect = () => ({ width: 1000, height: 500, left: 0, top: 0, right: 1000, bottom: 500, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect

    // Panel-open state: first reset to a known baseline (tx=0, ty=0, scale=1), then setScale(4).
    await w.findComponent(PlacesZoomBar).vm.$emit('reset')
    flushAnim()
    await w.vm.$nextTick()
    await w.findComponent(PlacesZoomBar).vm.$emit('set-scale', 4)
    await w.vm.$nextTick()
    const txOpen = (w.findComponent(PlacesMap).props('view') as { tx: number }).tx
    // Hand-computed: panelFrac = min(0.55, 420/1000) = 0.42 → c.x = 1000*(1-0.42)/2 = 290.
    // applyZoom(4, 290, 250) from {tx:0,ty:0,scale:1}: wx=(290-0)/1=290,
    // tx_new = 290 - 290*4 = -870.
    expect(txOpen).toBeCloseTo(290 - 290 * 4, 5)

    // Panel-closed state: same baseline, same setScale(4), but hasPanel = false → panelFrac = 0 → c.x=500.
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

describe('switching cities resets cover/spot state', () => {
  it('opening the cover popover + picking a spot + paging to 2, then changing activeId resets everything', async () => {
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

    await w.findComponent(PlacesRail).vm.$emit('pick', '2') // switch to PARIS
    await w.vm.$nextTick()

    expect(w.findComponent(PlaceCoverPicker).props('open')).toBe(false)
    expect(w.findComponent(PlaceCoverPicker).props('tab')).toBe('recent')
    expect(w.findComponent(PlaceCoverPicker).props('search')).toBe('')
    expect(w.findComponent(PlaceCoverPicker).props('page')).toBe(0)
    expect(w.findComponent(PlaceDetailPanel).props('activeSpotKey')).toBe(null)
  })
})

describe('cover candidate fetching (precondition: activeId && coverOpen)', () => {
  it('openCoverPicker fetches once; changing tab/search/page each fetch once; changing tab while coverOpen=false does not fetch', async () => {
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
    expect(w.findComponent(PlaceCoverPicker).props('page')).toBe(0) // changing tab resets page to 0

    await picker.vm.$emit('update:search', 'xyz')
    await w.vm.$nextTick()
    expect(svc.photos.placeCoverCandidates).toHaveBeenCalledTimes(3)

    await picker.vm.$emit('update:page', 1)
    await w.vm.$nextTick()
    expect(svc.photos.placeCoverCandidates).toHaveBeenCalledTimes(4)

    // Changing tab after the popover is closed shouldn't fetch again — close coverOpen only
    // through the popover's own close (without touching activeId, otherwise
    // fetchCandidatesIfOpen's `!activeId.value` early-return would mask whether the coverOpen
    // precondition itself was actually removed, and the code-removal check couldn't tell the
    // difference).
    await w.findComponent(PlaceCoverPicker).vm.$emit('close')
    await w.vm.$nextTick()
    svc.photos.placeCoverCandidates.mockClear()
    await w.findComponent(PlaceCoverPicker).vm.$emit('update:tab', 'fav')
    await w.vm.$nextTick()
    expect(svc.photos.placeCoverCandidates).not.toHaveBeenCalled()
  })
})

describe('cover submission', () => {
  it('clicking a cell (pick) closes the popover first and calls setPlaceCover; failure shows the "封面更新失败" toast', async () => {
    const { w } = await mountView()
    const toastStore = useToast()
    const showSpy = vi.spyOn(toastStore, 'show')
    await w.findComponent(PlaceDetailPanel).vm.$emit('open-cover-picker')
    await w.vm.$nextTick()
    expect(w.findComponent(PlaceCoverPicker).props('open')).toBe(true)

    await w.findComponent(PlaceCoverPicker).vm.$emit('pick', 'asset-9')
    await w.vm.$nextTick()
    expect(w.findComponent(PlaceCoverPicker).props('open')).toBe(false) // popover closes first
    expect(svc.photos.setPlaceCover).toHaveBeenCalledWith(1, 'asset-9')

    svc.photos.setPlaceCover.mockRejectedValueOnce(new Error('boom'))
    await w.findComponent(PlaceDetailPanel).vm.$emit('open-cover-picker')
    await w.vm.$nextTick()
    await w.findComponent(PlaceCoverPicker).vm.$emit('pick', 'asset-10')
    await flushPromises()
    expect(showSpy).toHaveBeenCalledWith('封面更新失败')
  })

  it('reset follows the same shape: popover closes first, resetPlaceCover is called; failure shows the "封面更新失败" toast', async () => {
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

describe('spot: three actions', () => {
  it('emitting pick-spot gives the panel activeSpotKey as String(spot.key)', async () => {
    const { w } = await mountView()
    await w.findComponent(PlaceDetailPanel).vm.$emit('pick-spot', { key: 42, name: 'S', lon: 0, lat: 0, count: 1, thumb: '' })
    await w.vm.$nextTick()
    expect(w.findComponent(PlaceDetailPanel).props('activeSpotKey')).toBe('42')
  })

  it('emitting rename calls setSpotName without an extra loadDetail', async () => {
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

  it('emitting reset-name calls resetSpotName', async () => {
    const { w } = await mountView()
    await w.findComponent(PlaceDetailPanel).vm.$emit('pick-spot', { key: 's1', name: 'Old', lon: 0, lat: 0, count: 1, thumb: '' })
    await w.vm.$nextTick()
    await w.findComponent(PlaceDetailPanel).vm.$emit('reset-name')
    await flushPromises()
    expect(svc.photos.resetSpotName).toHaveBeenCalledWith(1, 's1')
  })

  it('rename/reset-name failure each shows one toast', async () => {
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

describe('album + toast', () => {
  it('emitting save-album calls createPlaceAlbum with { name: <city name> }', async () => {
    const { w } = await mountView() // TOKYO
    await w.findComponent(PlaceDetailPanel).vm.$emit('save-album')
    await flushPromises()
    expect(svc.photos.createPlaceAlbum).toHaveBeenCalledWith(1, { name: 'Tokyo', from: '', to: '' })
  })

  it('emitting save-trip calls createPlaceAlbum with `<city> · when` + from/to', async () => {
    const { w } = await mountView()
    await w.findComponent(PlaceDetailPanel).vm.$emit('save-trip', { when: '2026 春', from: '2026-01-01', to: '2026-01-10', current: false, days: 9, photos: 5, faces: [], spots: 2, thumbs: [] })
    await flushPromises()
    expect(svc.photos.createPlaceAlbum).toHaveBeenCalledWith(1, { name: 'Tokyo · 2026 春', from: '2026-01-01', to: '2026-01-10' })
  })

  // Switched from the generic app-wide
  // `useToast()` (a plain gray pill) to `usePhotosToast()` (the photos-styled toast every
  // other Places/library flow already uses) — see createAlbum()'s own comment in
  // PhotosPlaces.vue for the full account. These two tests replace (not merely rename) the
  // old `useToast()`-spying assertions below them.
  it('success queues a photosToast with icon:album + copy containing the album name and count + a 5000ms action; clicking the action pushes to the album detail route', async () => {
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

  it('failure queues a photosToast with the failure copy; an albumBusy error does not toast', async () => {
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

describe('lightbox', () => {
  it("emit open-photo('b', ['a','b','c']) → lb.openAt receives a list of length 3, current item id is 'b'", async () => {
    const { w } = await mountView()
    const lb = useLightbox()
    await w.findComponent(PlaceDetailPanel).vm.$emit('open-photo', 'b', ['a', 'b', 'c'])
    expect(lb.list.value).toHaveLength(3)
    expect(String(lb.current.value?.id)).toBe('b')
    expect(lb.open.value).toBe(true)
  })

  it("emit open-photo('x', []) → list length is 1", async () => {
    const { w } = await mountView()
    const lb = useLightbox()
    await w.findComponent(PlaceDetailPanel).vm.$emit('open-photo', 'x', [])
    expect(lb.list.value).toHaveLength(1)
    expect(String(lb.current.value?.id)).toBe('x')
  })
})

// Both handlers now navigate to the actual photo
// library (`/photos`) with the place's city name carried through a `?libraryPlace=` query key
// (consumed once by Photos.vue's own `onMounted`, see that file's comment) instead of the
// standalone place-assets page — matching Vue2's own
// `onPlacesOpenLibrary`/`onPlacesOpenSpot` city-level EXIF-facet jump (PhotosTimeline.vue:
// 767-793). The old `/photos/places/:key` assertions below are replaced, not merely renamed —
// this is a genuine navigation-target change, not a refactor.
describe('jump-to-library navigation now lands on the library (with ?libraryPlace=<city>) instead of the standalone place page', () => {
  it('emitting open-library pushes to /photos?libraryPlace=<city> (using the place\'s city, not key/id)', async () => {
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

  it('emitting open-spot-library also lands on /photos?libraryPlace=<city> (spot precision has no equivalent in the library\'s filter system, so it degrades to a same-city filter — a known tradeoff, not an oversight) and clears activeSpotKey', async () => {
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

describe('with three popovers open at once, one Esc closes all three', () => {
  it('with Filters + theme + cover popovers all open, one Esc closes all three', async () => {
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
