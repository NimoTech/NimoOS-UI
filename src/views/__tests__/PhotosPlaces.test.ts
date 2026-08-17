// Task 11 (SP7-P6a Places · map main view, wraps up this phase): PhotosPlaces.vue — the
// container that wires the output of the previous 10 tasks into one usable page. Maps
// one-to-one onto task-11-brief.md's "required test checklist" + 6 code-removal checks.
//
// Mounts Pinia + i18n + a real router (spying on push isn't needed — AreaShell/PhotosSidebar
// both use useRouter(), following the existing mounting pattern from
// PhotosAlbums.test.ts/PhotosPeople.test.ts), mocks the shared package's photos methods.
//
// The pick-pin/hover-pin interactions go straight through `vm.$emit(...)` on the PlacesMap
// child component, without relying on the SVG-internal buildPins/clusterByOverlap geometry
// layout to reverse-lookup a specific pin's DOM position — that geometry layer is already
// covered by PlacesMap.test.ts/placesMap.test.ts's own unit tests. This file only verifies
// "the container wires things up correctly once it receives the emit", to avoid coupling the
// clustering algorithm's implementation details into this integration test and making it
// brittle.
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
    setPlaceCover: vi.fn().mockResolvedValue(undefined),
    resetPlaceCover: vi.fn().mockResolvedValue(undefined),
    setSpotName: vi.fn().mockResolvedValue(undefined),
    resetSpotName: vi.fn().mockResolvedValue(undefined),
    createPlaceAlbum: vi.fn().mockResolvedValue({ albumId: 'al1', name: 'x', count: 1 }),
    placeCoverCandidates: vi.fn().mockResolvedValue({ tabs: [], items: [], page: 0, totalPages: 1, total: 0 }),
    // ── P6b-T8: needed by the PhotoLightbox mount + useLightbox.openAt() chain (D9). ──
    getAsset: vi.fn().mockResolvedValue({}),
    getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
    recordView: vi.fn().mockResolvedValue(undefined),
    listFavoriteIds: vi.fn().mockResolvedValue([]),
    originalUrl: vi.fn((id: string | number) => `mock://original/${id}`),
    liveUrl: vi.fn((id: string | number) => `mock://live/${id}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// jsdom has no media stack (PhotoLightbox references it on mount, same precondition as
// PhotosPersonDetail.test.ts).
;(HTMLMediaElement.prototype as unknown as { play: () => Promise<void> }).play = vi.fn(() => Promise.resolve())
;(HTMLMediaElement.prototype as unknown as { pause: () => void }).pause = vi.fn()

import PhotosPlaces from '../PhotosPlaces.vue'
import photosPlacesRaw from '../PhotosPlaces.vue?raw'
import PlacesRail from '../../photos/components/PlacesRail.vue'
import PlacesMap from '../../photos/components/PlacesMap.vue'
import PlacesZoomBar from '../../photos/components/PlacesZoomBar.vue'
import PlacesThemeMenu from '../../photos/components/PlacesThemeMenu.vue'
import PlaceDetailPanel from '../../photos/components/PlaceDetailPanel.vue'
import PlaceCoverPicker from '../../photos/components/PlaceCoverPicker.vue'
import placesZoomBarRaw from '../../photos/components/PlacesZoomBar.vue?raw'
import { usePhotosPlaces } from '../../photos/stores/places'
import { useLightbox } from '../../photos/lightbox/useLightbox'
import { useToast } from '../../stores/toast'
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

// ── Raw (backend) places fixture ──────────────────────────────────────────────────
// TOKYO(9990)+PARIS(2345)+CLUSTER_A(5)+CLUSTER_B(5) = 12345, a total assembled specifically
// for the "toLocaleString thousands separator" test case; CLUSTER_A/CLUSTER_B sit at nearly
// identical coordinates (same precedent as PlacesMap.test.ts), giving zoomToCluster's
// integration scenario two real, splittable members for splitScaleFor.
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

// ---- Fake requestAnimationFrame: collect callbacks, then flush them all at once to the end
// of the animation by manually passing an arbitrarily large `now` (same precedent as
// usePlacesView.test.ts — driven this way instead of vi.useFakeTimers()). ----
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
})
afterEach(() => {
  vi.restoreAllMocks()
})

// Teleport an in-flight animation straight to its endpoint (ease(k=1)) in one shot: in a real
// scenario it would arrive after 420ms — here we skip the wait.
function flushAnim(): void {
  const cbs = rafCallbacks.splice(0)
  for (const cb of cbs) cb(performance.now() + 100000)
}

describe('shell', () => {
  it('AreaShell title is "Places", PhotosSidebar exists', async () => {
    const { w } = await mountView()
    expect(w.find('.area-title').text()).toBe('地点')
    // Task 3 (shell + sidebar re-skin) renamed PhotosSidebar's root element class from
    // `.photos-sidebar` to Vue2's `.sidebar` — PhotosPlaces.vue itself is still the old
    // AreaShell shell (out of scope for this task, to be handled by Plan H later); here we're
    // just following the shared component's renaming to keep the selector in sync, not a
    // functional change belonging to this file's own task.
    expect(w.find('.sidebar').exists()).toBe(true)
  })
})

describe('first-screen load + auto-select', () => {
  it('onMounted calls fetchPlaces; once loaded, auto-selects the first place', async () => {
    const { w } = await mountView()
    expect(svc.photos.listPlaces).toHaveBeenCalledTimes(1)
    expect(w.findComponent(PlacesRail).props('activeId')).toBe('1')
    expect(w.findComponent(PlacesMap).props('activeId')).toBe('1')
  })

  // P6b-T8 review fix: now that hasDetailPanel reflects real state, the first-screen
  // auto-select already makes activePlace hit (hasPanel=true as soon as a place exists), so
  // the previously assumed "dead center" value no longer holds — wrapEl is a real DOM node,
  // and jsdom's default getBoundingClientRect always returns all zeros, so `420/0=Infinity`
  // gets clamped by `Math.min(0.55, …)` to 0.55 (not the 0.42 hand-computed in the two
  // usePlacesView cases added by T8 — those two explicitly mock wrapEl's width as 1000).
  // The tx computation therefore uses c.x=225 for panelFrac=0.55; the ty formula is
  // unaffected (panelFrac only changes x, see usePlacesView.ts:98-99).
  it('after auto-select, autoPanTo is called with the first place (TOKYO) as its argument — verified precisely against view.tx/ty/scale', async () => {
    const { w } = await mountView()
    // autoPanTo → centerOn → animateView has already synchronously queued a raf callback;
    // flush it so the easing jumps straight to its endpoint.
    expect(rafCallbacks.length).toBeGreaterThan(0)
    flushAnim()
    await w.vm.$nextTick()
    const view = w.findComponent(PlacesMap).props('view') as { tx: number, ty: number, scale: number }
    // centerOn(wx,wy,scale) computation: c = visibleCenterVb() (hasDetailPanel is true at this
    // point — the first-screen auto-selected place is exactly activePlace; wrapEl's width
    // isn't mocked, so panelFrac clamps to 0.55, c.x = 1000*(1-0.55)/2 = 225, c.y is still
    // MAP_H/2), scale = max(1, 1.8) = 1.8, tx = c.x - wx*scale, ty = c.y - wy*scale.
    const { x: wx, y: wy } = project(TOKYO.lon, TOKYO.lat)
    expect(view.scale).toBeCloseTo(1.8, 5)
    expect(view.tx).toBeCloseTo(225 - wx * 1.8, 3)
    expect(view.ty).toBeCloseTo(MAP_H / 2 - wy * 1.8, 3)
  })
})

describe('activeId switch → loadDetail (P6b seam guard)', () => {
  it('switching to another place calls getPlace with the resolved backend key', async () => {
    const { w } = await mountView()
    await flushPromises()
    expect(svc.photos.getPlace).toHaveBeenCalledWith(1) // first-screen auto-selects TOKYO (key=1)
    svc.photos.getPlace.mockClear()

    const pin: Pin = { id: '2', x: 0, y: 0, r: 10, hitR: 10, count: PARIS.count, city: PARIS.city, country: PARIS.country, thumbs: PARIS.thumbs, coverAssetId: PARIS.coverAssetId, recent: PARIS.recent, cluster: false, active: false }
    await w.findComponent(PlacesMap).vm.$emit('pick-pin', pin, new MouseEvent('click'))
    await flushPromises()
    expect(w.findComponent(PlacesRail).props('activeId')).toBe('2')
    expect(svc.photos.getPlace).toHaveBeenCalledWith(2) // PARIS (key=2)
  })
})

describe('filter linkage: rail and map receive the same filtered places, the rail search does not affect the map', () => {
  it('after minCount=50, both rail and map places narrow from 4 down to 2', async () => {
    const { w } = await mountView()
    expect(w.findComponent(PlacesRail).props('places')).toHaveLength(4)
    expect(w.findComponent(PlacesMap).props('places')).toHaveLength(4)

    await w.find('[data-test="pfm-chip"]').trigger('click')
    const btns = w.findAll('[data-test="pfm-mincount-btn"]')
    await btns[2].trigger('click') // MIN_COUNT_STEPS = [0,10,50,100,200], index 2 = 50

    expect(w.findComponent(PlacesRail).props('places')).toHaveLength(2)
    expect(w.findComponent(PlacesMap).props('places')).toHaveLength(2)
  })

  it('rail-internal search term changes do not affect the map places prop (verifies Vue2 :229/:237)', async () => {
    const { w } = await mountView()
    const before = w.findComponent(PlacesMap).props('places')
    await w.find('.map-search input').setValue('nonexistent-city-xyz')
    await w.vm.$nextTick()
    expect(w.findComponent(PlacesMap).props('places')).toBe(before)
    expect(w.findComponent(PlacesMap).props('places')).toHaveLength(4)
  })

  // Review I3: the rail's empty-state routing relies on the totalPlaces the container passes
  // (unfiltered full count) — once the filter narrows filteredPlaces to zero, totalPlaces must
  // still be the full count and must not shrink to zero along with the filtered result
  // (otherwise the rail would route to the wrong branch, showing "no location data yet"
  // instead of "no cities match the current filter").
  it('after minCount + regionFilter narrow the result to zero, totalPlaces received by the rail is still the full count (4)', async () => {
    const { w } = await mountView()
    await w.find('[data-test="pfm-chip"]').trigger('click')
    const btns = w.findAll('[data-test="pfm-mincount-btn"]')
    // MIN_COUNT_STEPS = [0,10,50,100,200], index 4 = 200: first narrows out CLUSTER_A/B
    // (count=5), leaving TOKYO(9990)/PARIS(2345).
    await btns[4].trigger('click')
    // Then also filter by continent to americas — TOKYO is asia and PARIS is europe, neither
    // is americas, so intersecting with the minCount condition above filters out all four
    // fixtures and filteredPlaces goes to zero.
    await w.find('[data-test="pfm-region-btn"][data-region-id="americas"]').trigger('click')
    expect(w.findComponent(PlacesRail).props('places')).toHaveLength(0)
    expect(w.findComponent(PlacesRail).props('totalPlaces')).toBe(4)
  })
})

describe('pick-pin wiring (Vue2 :736-743)', () => {
  it('a cluster pin calls zoomToCluster (view.scale changes, driven by splitScaleFor via the two real members CLUSTER_A/B)', async () => {
    const { w } = await mountView()
    flushAnim() // Clear the easing triggered by the first-screen auto-select first, so it doesn't leak into the assertions below
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
    // The current scale is 1 (the container's initial value — the previous autoPan was
    // already cleared by flushAnim above and produced no new call — in fact view.scale is
    // already 1.8 at this point; zoomToCluster's target is
    // max(currentScale+0.01, splitScaleFor(...)) >= 1.81. Asserting "it did in fact get
    // bigger" is enough; we don't depend on splitScaleFor's exact value (that's within
    // T2/T7's own unit test scope).
    expect(view.scale).toBeGreaterThan(1.8)
    // activeId shouldn't change just because a cluster was clicked (a cluster has no single id).
    expect(w.findComponent(PlacesRail).props('activeId')).toBe('1')
  })

  it('a non-cluster pin makes activeId become pin.id', async () => {
    const { w } = await mountView()
    const pin: Pin = { id: '2', x: 0, y: 0, r: 10, hitR: 10, count: PARIS.count, city: PARIS.city, country: PARIS.country, thumbs: PARIS.thumbs, coverAssetId: PARIS.coverAssetId, recent: PARIS.recent, cluster: false, active: false }
    await w.findComponent(PlacesMap).vm.$emit('pick-pin', pin, new MouseEvent('click'))
    expect(w.findComponent(PlacesRail).props('activeId')).toBe('2')
    expect(w.findComponent(PlacesMap).props('activeId')).toBe('2')
  })
})

describe('hover card (Vue2 :1013-1028, tip positioning uses an explicit wrapEl, deviation log 10)', () => {
  function mockCurrentTarget(): Element {
    const el = document.createElement('div')
    el.getBoundingClientRect = () => ({ left: 100, top: 200, right: 110, bottom: 210, width: 10, height: 10, x: 100, y: 200, toJSON: () => ({}) }) as DOMRect
    return el
  }
  function pinFor(raw: typeof PARIS, id: string): Pin {
    return { id, x: 0, y: 0, r: 10, hitR: 10, count: raw.count, city: raw.city, country: raw.country, thumbs: raw.thumbs, coverAssetId: raw.coverAssetId, recent: raw.recent, cluster: false, active: false }
  }

  it('hovering a non-selected place makes the tip appear, with copy containing city/country/photo count', async () => {
    const { w } = await mountView() // the first screen has already auto-selected '1' (TOKYO)
    const ev = { currentTarget: mockCurrentTarget() } as unknown as MouseEvent
    await w.findComponent(PlacesMap).vm.$emit('hover-pin', pinFor(PARIS, '2'), ev)
    await w.vm.$nextTick()
    const tip = w.find('[data-test="map-tip"]')
    expect(tip.exists()).toBe(true)
    expect(tip.text()).toContain('Paris')
    expect(tip.text()).toContain('France')
    expect(tip.text()).toContain('2345 张照片') // photosPlacesPhotoCount({n: 2345}), doesn't go through toLocaleString (follows Vue2 :1025)
  })

  it('hovering the currently selected place does not make the tip appear', async () => {
    const { w } = await mountView() // activeId is already '1'
    const ev = { currentTarget: mockCurrentTarget() } as unknown as MouseEvent
    await w.findComponent(PlacesMap).vm.$emit('hover-pin', pinFor(TOKYO as unknown as typeof PARIS, '1'), ev)
    await w.vm.$nextTick()
    expect(w.find('[data-test="map-tip"]').exists()).toBe(false)
  })

  it('hover-clear makes the tip disappear', async () => {
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
  it('all four legend groups are present; the fourth group\'s copy is the real i18n dict value "本次旅行" (the brief\'s paraphrase "当前行程" differs from the literal value — confirmed against the source); all three numeric literals are present', async () => {
    const { w } = await mountView()
    const legend = w.find('[data-test="map-legend"]')
    expect(legend.findAll('.grp')).toHaveLength(4)
    expect(legend.text()).toContain('< 40')
    expect(legend.text()).toContain('40–100')
    expect(legend.text()).toContain('100+')
    expect(legend.text()).toContain('本次旅行')
  })

  it('all three stats are present; the photo count goes through toLocaleString (total 12345 → thousands separator "12,345" appears)', async () => {
    const { w } = await mountView()
    const stats = w.find('[data-test="map-stats"]')
    const values = stats.findAll('.v').map((n) => n.text())
    expect(values).toEqual(['4', '3', '12,345'])
  })

  // Review M3: the fourth group's dot color must not win over the base `.map-legend .dot`
  // just by "happening to be written later in the style block" — the two selectors'
  // specificity must genuinely be unequal (the fourth group's selector carries one extra
  // class), independent of source order.
  it('the fourth group\'s selector specificity genuinely outranks the base .map-legend .dot (does not survive on source order alone)', () => {
    const rules = parseCssRules(extractStyleBlock(photosPlacesRaw))
    const classCount = (selector: string) => (selector.match(/\.[\w-]+/g) ?? []).length
    const base = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.map-legend .dot')
    const trip = rules.find((r) => r.selectors.some((s) => s.includes('dot-trip')))
    expect(base, 'base .map-legend .dot rule not found').toBeTruthy()
    expect(trip, 'fourth-group dot-trip rule not found').toBeTruthy()
    const tripSelector = trip!.selectors.find((s) => s.includes('dot-trip'))!
    expect(classCount(tripSelector)).toBeGreaterThan(classCount(base!.selectors[0]))
  })
})

describe('load-failure state', () => {
  it('fetchPlaces failing shows the failure copy + retry button; clicking retry calls fetchPlaces again', async () => {
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

  // Review I4: Vue2 puts "select places[0] when nothing is selected" inside loadPlaces()
  // itself, so every successful load (not just the first) auto-selects, autoPans, and
  // triggers loadDetail. retryLoad previously only called store.fetchPlaces() and missed this
  // step — the first screen fails, then the retry succeeds a second time, producing an
  // inconsistent outcome where "the rail is full of cities, the map draws pins, but no city
  // is selected".
  it('first fetchPlaces fails → click retry → after the second success, auto-selects the first place and calls loadDetail', async () => {
    svc.photos.listPlaces.mockRejectedValueOnce(new Error('network down'))
    const { w } = await mountView()
    expect(w.find('[data-test="places-failed"]').exists()).toBe(true)
    expect(svc.photos.getPlace).not.toHaveBeenCalled()

    svc.photos.listPlaces.mockImplementationOnce(okListPlaces)
    await w.find('[data-test="places-retry"]').trigger('click')
    await flushPromises()

    expect(w.find('[data-test="places-failed"]').exists()).toBe(false)
    expect(w.findComponent(PlacesRail).props('activeId')).toBe('1') // TOKYO (key=1) is the first entry in the fixture
    expect(svc.photos.getPlace).toHaveBeenCalledWith(1)
  })
})

// Review M2: the failure-state condition must be tightened with `attempted`, otherwise "hasn't
// requested yet" (the instant before onMounted's async fetchPlaces has actually started
// running) would be misjudged as "requested and failed".
//
// Landmine log (a real lesson learned during TDD, kept here to stop someone from
// "optimizing" it into a helper and stepping on it again): this case originally wrapped
// `mount()` inside an `async function mountFresh() { ...; return { w } }` and then
// `await mountFresh()`, and the result showed no difference whether M2 was fixed or not —
// the reason is that a Promise returned by an async function, even if there's no other await
// left in the function body, still always yields one microtask just from awaiting it; and the
// line `attempted.value = true` inside onMounted runs **synchronously** (there's no await
// before it) — Vue's reactivity scheduler had already queued that change onto the microtask
// queue back inside mount() itself. That one extra await happened to push the assertion to
// right after "Vue has already re-rendered once", so the true first frame was never actually
// observed. Switching to not wrapping a helper — asserting immediately after mount() with no
// await in between — is what genuinely catches the first frame (manually cross-checked both
// styles' real difference under the "remove the attempted tightening" mutation using
// w.html(), see the M2 section of the task report).
describe('first-frame gating (review M2: distinguishing "hasn\'t requested yet" from "requested and failed")', () => {
  it('the first frame (before onMounted\'s async fetchPlaces has landed) shows the skeleton, not the failure state', async () => {
    const router = makeRouter()
    router.push('/photos/places')
    await router.isReady() // this await is before mount(), it doesn't affect the frame we want to catch below
    const w = mount(PhotosPlaces, { global: { plugins: [i18n, router] } })
    // Assert immediately after mount(), with no await in between — see the comment above.
    expect(w.find('[data-test="places-skeleton"]').exists()).toBe(true)
    expect(w.find('[data-test="places-failed"]').exists()).toBe(false)
  })
})

describe('pointer gesture passthrough (review I1: the one piece of wiring between container and composable with no assertion coverage)', () => {
  it('pressing down and dragging on the svg makes PlacesMap\'s view.tx follow (the displacement conversion in usePlacesView.ts:201-206)', async () => {
    const { w } = await mountView()
    flushAnim() // Clear the easing triggered by the first-screen auto-select first, so it doesn't leak into the tx before/after comparison
    await w.vm.$nextTick()
    const before = (w.findComponent(PlacesMap).props('view') as { tx: number }).tx

    const svg = w.find('svg.map-canvas')
    await svg.trigger('pointerdown', { clientX: 100, clientY: 100, pointerId: 1, bubbles: true })
    await svg.trigger('pointermove', { clientX: 180, clientY: 100, pointerId: 1, bubbles: true })

    const after = (w.findComponent(PlacesMap).props('view') as { tx: number }).tx
    expect(after).not.toBeCloseTo(before, 5)
  })

  it('a pointermove after pointerup no longer pans (the drag state has been cleared)', async () => {
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

  it('pressing down on a pin (.geo-pin) does not pan the map (the closest guard in usePlacesView.ts:189-192)', async () => {
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

describe('explicit wheel addEventListener registration (deviation log 11-⑤)', () => {
  it('svgEl.addEventListener("wheel", ..., { passive: false }); removeEventListener is called after unmount', async () => {
    const addSpy = vi.spyOn(SVGSVGElement.prototype, 'addEventListener')
    const removeSpy = vi.spyOn(SVGSVGElement.prototype, 'removeEventListener')
    const { w } = await mountView()
    const wheelCall = addSpy.mock.calls.find((c) => c[0] === 'wheel')
    expect(wheelCall).toBeTruthy()
    expect(wheelCall?.[2]).toEqual({ passive: false })

    w.unmount()
    const wheelRemoveCall = removeSpy.mock.calls.find((c) => c[0] === 'wheel')
    expect(wheelRemoveCall).toBeTruthy()
    expect(wheelRemoveCall?.[1]).toBe(wheelCall?.[1]) // must remove the exact same function reference that was attached
  })
})

describe('the two popovers\' Esc handling does not interfere with each other (the P5-T10 bug shape)', () => {
  it('with Filters and the map theme popover both open, one Esc press closes both', async () => {
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

describe('map theme popover wiring (review M1: the routing logic is a decision unique to the container, not covered by any of T1-T10)', () => {
  it('clicking a preset changes store.themePrefs.mapTheme, and PlacesMap\'s themeVars.background follows', async () => {
    const { w } = await mountView()
    const before = (w.findComponent(PlacesMap).props('themeVars') as { background: string }).background

    await w.find('[data-test="mtm-chip"]').trigger('click')
    await w.find('[data-theme-id="ocean"]').trigger('click')

    const store = usePhotosPlaces()
    expect(store.themePrefs.mapTheme).toBe('ocean')
    const after = (w.findComponent(PlacesMap).props('themeVars') as { background: string }).background
    expect(after).not.toBe(before)
  })

  it('changing the color picker settles mapTheme as custom, and customDotColor persists (it does not unconditionally go through setMapTheme and drop the color)', async () => {
    const { w } = await mountView()
    await w.find('[data-test="mtm-chip"]').trigger('click')
    const dotInput = w.find('[data-test="mtm-dot-input"]')
    await dotInput.setValue('#123456')

    const store = usePhotosPlaces()
    expect(store.themePrefs.mapTheme).toBe('custom')
    expect(store.themePrefs.customDotColor).toBe('#123456')
    // The theme popover's selection prop is wired directly to store.themePrefs (disambiguation
    // 3: reads always go through the store); this incidentally also verifies that the
    // read-back takes effect, not a one-way link where "the store is written but the UI still
    // reads the old value".
    expect(w.findComponent(PlacesThemeMenu).props('selection')).toMatchObject({ mapTheme: 'custom', customDotColor: '#123456' })
  })
})

describe('.map-toolbar pointer-events guard (a programmatic assertion, guards against losing this during a re-skin and being unable to drag the map)', () => {
  it('both pointer-events:none and the > * auto rule are present in the style block', () => {
    const style = extractStyleBlock(photosPlacesRaw)
    expect(/\.map-toolbar\s*\{[^}]*pointer-events:\s*none/.test(style)).toBe(true)
    expect(/\.map-toolbar\s*>\s*\*\s*\{[^}]*pointer-events:\s*auto/.test(style)).toBe(true)
  })
})

// Real-device acceptance feedback 2: "the filter popover blocks the map zoom +/- bar" — Vue2
// sets both .map-toolbar and .map-zoombar to z-index:4; the toolbar forms its own stacking
// context, so its internal popover's z-index:30 cannot get past the sibling zoombar, and DOM
// order also puts the zoombar after the toolbar, so the zoom bar ends up drawn on top of the
// Filters/theme popovers (see the entry above .map-toolbar). What's pinned here is the
// invariant itself — "the toolbar sits above these overlays" (the toolbar's z-index is
// strictly greater than the max of legend/stats/tip and zoombar) — not the hardcoded value 7.
// Any equivalent stacking adjustment is fine; dropping the toolbar back to 4 will turn this
// red. .map-zoombar's styling lives in PlacesZoomBar.vue, not in this container's style
// block, so both source files need to be read.
describe('.map-toolbar stacking-order guard (real-device acceptance feedback 2: overlays should not be pierced by the zoom bar)', () => {
  function zIndexOf(rules: ReturnType<typeof parseCssRules>, selector: string): number {
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === selector)
    if (!rule) throw new Error(`rule not found: ${selector}`)
    const m = /z-index:\s*(-?\d+)/.exec(rule.body)
    if (!m) throw new Error(`rule ${selector} has no z-index declaration`)
    return Number(m[1])
  }

  it('.map-toolbar\'s z-index is strictly greater than every other overlay in the container (.map-legend/.map-stats/.map-tip) and .map-zoombar in the other file', () => {
    const containerRules = parseCssRules(extractStyleBlock(photosPlacesRaw))
    const toolbarZ = zIndexOf(containerRules, '.map-toolbar')
    const othersInContainer = ['.map-legend', '.map-stats', '.map-tip'].map((s) => zIndexOf(containerRules, s))
    const zoombarRules = parseCssRules(extractStyleBlock(placesZoomBarRaw))
    const zoombarZ = zIndexOf(zoombarRules, '.map-zoombar')
    const maxOther = Math.max(...othersInContainer, zoombarZ)
    expect(toolbarZ).toBeGreaterThan(maxOther)
  })
})

describe('routing + sidebar (append-only, no reordering)', () => {
  // SP7-P7a-T4: NAV gained smart-views, inserted after places and before favorites — a
  // regression update (an inevitable knock-on from the PhotosSidebar.vue change, out of scope
  // for this file's own task, syncing the assertion along the way).
  // SP15-P2b Task 5: this entry's label changed from "智能视图" to "为你推荐" (id/route
  // unchanged; the page has been narrowed to a Moments-only "为你推荐" page, with smart
  // albums having moved into Albums) — updating item 5's copy to match.
  it('the sidebar NAV order is library, albums, people, places, smart-views, favorites, trash', async () => {
    const { w } = await mountView()
    // Task 3 (shell + sidebar re-skin) renamed the nav item class from `.side-item`/`.side-name`
    // to Vue2's `.nav-item` (a single bare <span> holding the label text, with no dedicated
    // name subclass — matching the Vue2 source). Here we follow along and update the
    // selector; it's not a functional change belonging to this file's own task.
    const ids = w.findAll('.nav-item').map((n) => n.text())
    // The sidebar renders i18n label text, so we compare the copy sequence directly (matching
    // one-to-one with the zh_CN dict values for photosLibrary/.../photosTrash) — no extra
    // source parsing needed. This is direct evidence that "the sidebar really does render in
    // this order".
    expect(ids).toEqual(['照片库', '相册', '人物', '地点', '为你推荐', '收藏', '最近删除'])
  })
})

// ════════════════════════════════════════════════════════════════════════════
// P6b-T8: container wiring — detail panel / cover picker / spot / lightbox / album toast /
// jump-to-library navigation
// ════════════════════════════════════════════════════════════════════════════

describe('P6b-T8: panel show/hide', () => {
  it('activeId hitting a list item mounts PlaceDetailPanel; activeId=null unmounts it', async () => {
    const { w } = await mountView() // the first screen has already auto-selected TOKYO
    expect(w.findComponent(PlaceDetailPanel).exists()).toBe(true)
    await w.findComponent(PlacesRail).vm.$emit('pick', null)
    await w.vm.$nextTick()
    expect(w.findComponent(PlaceDetailPanel).exists()).toBe(false)
  })

  it('clicking the panel\'s close makes activeId become null and calls loadDetail(null)', async () => {
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

describe('P6b-T8: deviation log 4 guard (detail doesn\'t recognize the previous city after switching cities)', () => {
  it('store.detail belongs to city B while activeId is city A → the panel\'s detail prop is null, place prop is city A', async () => {
    const { w } = await mountView() // activeId = '1' (TOKYO)
    const store = usePhotosPlaces()
    // Simulate the race window where "the previous city's (PARIS, id=2) detail response hasn't
    // been overwritten yet by the new request".
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

describe('P6b-T8: hasDetailPanel becomes real (P6a seam two — panelFrac takes real effect for the first time)', () => {
  it('opening vs. closing the panel makes the same setScale call land at different points (wrapEl width 1000 → panelFrac=0.42 → center x=290 instead of 500)', async () => {
    const { w } = await mountView() // the first screen has already auto-selected TOKYO, hasPanel = true
    flushAnim()
    await w.vm.$nextTick()

    // Pin wrapEl's width so panelFrac lands in the unclamped range (matching the established
    // mock value of 1000 in usePlacesView.test.ts), instead of the 0.55 that jsdom's default
    // 0 width gets clamped to.
    const wrap = w.find('.map-canvas-wrap').element as HTMLElement
    wrap.getBoundingClientRect = () => ({ width: 1000, height: 500, left: 0, top: 0, right: 1000, bottom: 500, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect

    // Panel-open state: first reset to a known baseline (tx=0, ty=0, scale=1), then setScale(4).
    await w.findComponent(PlacesZoomBar).vm.$emit('reset')
    flushAnim()
    await w.vm.$nextTick()
    await w.findComponent(PlacesZoomBar).vm.$emit('set-scale', 4)
    await w.vm.$nextTick()
    const txOpen = (w.findComponent(PlacesMap).props('view') as { tx: number }).tx
    // Hand computation: panelFrac = min(0.55, 420/1000) = 0.42 → c.x = 1000*(1-0.42)/2 = 290.
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

describe('P6b-T8: switching cities resets cover/spot state (follows Vue2 :295-301)', () => {
  it('opening the cover popover + selecting a spot + paging to page 2, then changing activeId resets everything', async () => {
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

describe('P6b-T8: fetching cover candidates (precondition activeId && coverOpen, code-removal checklist item 8)', () => {
  it('openCoverPicker fetches once; changing tab/search term/page each fetch once; changing tab while coverOpen=false does not fetch', async () => {
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

    // Changing tab after closing the popover should not fetch again — only closing coverOpen
    // via the popover's own close (without touching activeId, otherwise the early return on
    // `!activeId.value` inside fetchCandidatesIfOpen would mask whether the coverOpen
    // precondition itself had genuinely been deleted — the code-removal check wouldn't be
    // able to tell the difference).
    await w.findComponent(PlaceCoverPicker).vm.$emit('close')
    await w.vm.$nextTick()
    svc.photos.placeCoverCandidates.mockClear()
    await w.findComponent(PlaceCoverPicker).vm.$emit('update:tab', 'fav')
    await w.vm.$nextTick()
    expect(svc.photos.placeCoverCandidates).not.toHaveBeenCalled()
  })
})

describe('P6b-T8: cover submission', () => {
  it('clicking a cell (pick) closes the popover first and calls setPlaceCover; on failure -> toast "封面更新失败"', async () => {
    const { w } = await mountView()
    const toastStore = useToast()
    const showSpy = vi.spyOn(toastStore, 'show')
    await w.findComponent(PlaceDetailPanel).vm.$emit('open-cover-picker')
    await w.vm.$nextTick()
    expect(w.findComponent(PlaceCoverPicker).props('open')).toBe(true)

    await w.findComponent(PlaceCoverPicker).vm.$emit('pick', 'asset-9')
    await w.vm.$nextTick()
    expect(w.findComponent(PlaceCoverPicker).props('open')).toBe(false) // closes the popover first
    expect(svc.photos.setPlaceCover).toHaveBeenCalledWith(1, 'asset-9')

    svc.photos.setPlaceCover.mockRejectedValueOnce(new Error('boom'))
    await w.findComponent(PlaceDetailPanel).vm.$emit('open-cover-picker')
    await w.vm.$nextTick()
    await w.findComponent(PlaceCoverPicker).vm.$emit('pick', 'asset-10')
    await flushPromises()
    expect(showSpy).toHaveBeenCalledWith('封面更新失败')
  })

  it('reset takes the same shape: closes the popover first and calls resetPlaceCover; on failure -> toast "封面更新失败"', async () => {
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

describe('P6b-T8: spot\'s three actions', () => {
  it('emitting pick-spot makes the panel receive activeSpotKey as String(spot.key)', async () => {
    const { w } = await mountView()
    await w.findComponent(PlaceDetailPanel).vm.$emit('pick-spot', { key: 42, name: 'S', lon: 0, lat: 0, count: 1, thumb: '' })
    await w.vm.$nextTick()
    expect(w.findComponent(PlaceDetailPanel).props('activeSpotKey')).toBe('42')
  })

  it('emitting rename calls setSpotName with no extra loadDetail call (deviation 7 guard)', async () => {
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

  it('rename/reset-name failures each pop one toast', async () => {
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

describe('P6b-T8: albums and toast', () => {
  it('emitting save-album makes createPlaceAlbum receive { name: <city name> }', async () => {
    const { w } = await mountView() // TOKYO
    await w.findComponent(PlaceDetailPanel).vm.$emit('save-album')
    await flushPromises()
    expect(svc.photos.createPlaceAlbum).toHaveBeenCalledWith(1, { name: 'Tokyo', from: '', to: '' })
  })

  it('emitting save-trip makes createPlaceAlbum receive `city · when` + from/to', async () => {
    const { w } = await mountView()
    await w.findComponent(PlaceDetailPanel).vm.$emit('save-trip', { when: '2026 春', from: '2026-01-01', to: '2026-01-10', current: false, days: 9, photos: 5, faces: [], spots: 2, thumbs: [] })
    await flushPromises()
    expect(svc.photos.createPlaceAlbum).toHaveBeenCalledWith(1, { name: 'Tokyo · 2026 春', from: '2026-01-01', to: '2026-01-10' })
  })

  it('on success, toast copy contains the album name and photo count and carries an action; clicking the action does router.push to the album detail page', async () => {
    svc.photos.createPlaceAlbum.mockResolvedValueOnce({ albumId: 'al-9', name: 'Tokyo', count: 3 })
    const { w, router } = await mountView()
    const toastStore = useToast()
    const showSpy = vi.spyOn(toastStore, 'show')
    const pushSpy = vi.spyOn(router, 'push')
    await w.findComponent(PlaceDetailPanel).vm.$emit('save-album')
    await flushPromises()
    expect(showSpy).toHaveBeenCalledTimes(1)
    const [text, duration, arg] = showSpy.mock.calls[0]
    // SP8-P6-T3 merge-in: show()'s third argument is now a discriminated union (string=tier /
    // object=action); narrow it back to action by typeof.
    const action = typeof arg === 'string' ? undefined : arg
    expect(text).toContain('Tokyo')
    expect(text).toContain('3')
    expect(duration).toBe(5000)
    expect(action?.label).toBe('打开')
    action?.onClick()
    expect(pushSpy).toHaveBeenCalledWith('/photos/albums/al-9')
  })

  it('on failure -> failure toast; an albumBusy error does not pop a toast', async () => {
    const { w } = await mountView()
    const toastStore = useToast()
    const showSpy = vi.spyOn(toastStore, 'show')

    svc.photos.createPlaceAlbum.mockRejectedValueOnce(new Error('network down'))
    await w.findComponent(PlaceDetailPanel).vm.$emit('save-album')
    await flushPromises()
    expect(showSpy).toHaveBeenCalledWith('相册创建失败')

    showSpy.mockClear()
    svc.photos.createPlaceAlbum.mockRejectedValueOnce(new Error('albumBusy'))
    await w.findComponent(PlaceDetailPanel).vm.$emit('save-album')
    await flushPromises()
    expect(showSpy).not.toHaveBeenCalled()
  })
})

describe('P6b-T8: lightbox (D9)', () => {
  it("emitting open-photo('b', ['a','b','c']) makes lb.openAt receive a list of length 3, with the current item's id being 'b'", async () => {
    const { w } = await mountView()
    const lb = useLightbox()
    await w.findComponent(PlaceDetailPanel).vm.$emit('open-photo', 'b', ['a', 'b', 'c'])
    expect(lb.list.value).toHaveLength(3)
    expect(String(lb.current.value?.id)).toBe('b')
    expect(lb.open.value).toBe(true)
  })

  it("emitting open-photo('x', []) gives a list of length 1", async () => {
    const { w } = await mountView()
    const lb = useLightbox()
    await w.findComponent(PlaceDetailPanel).vm.$emit('open-photo', 'x', [])
    expect(lb.list.value).toHaveLength(1)
    expect(String(lb.current.value?.id)).toBe('x')
  })
})

describe('P6b-T8: jump-to-library navigation (uses the raw backend key, not the normalized activeId)', () => {
  it('emitting open-library does router.push to /photos/places/7 (the fixture\'s backend key is the number 7, proving it uses the key rather than the normalized id)', async () => {
    const { w, router } = await mountView()
    const store = usePhotosPlaces()
    // Deliberately construct a place whose id differs from its key (the real toPlace() always
    // has id=String(key); here we inject a synthetic entry with id≠key on purpose so the
    // code-removal check is meaningful — proving that goLibrary reads activePlace.key rather
    // than activeId).
    store.places.push({
      id: 'weird-id', key: 7, region: 'asia', country: 'X', city: 'Weird',
      lon: 0, lat: 0, count: 1, recent: false, last: '', lastDate: null,
      trips: 0, home: false, thumbs: [], coverAssetId: '',
    })
    await w.findComponent(PlacesRail).vm.$emit('pick', 'weird-id')
    await w.vm.$nextTick()
    const pushSpy = vi.spyOn(router, 'push')
    await w.findComponent(PlaceDetailPanel).vm.$emit('open-library')
    expect(pushSpy).toHaveBeenCalledWith('/photos/places/7')
  })

  it('emitting open-spot-library uses the same path as above with query containing spot/lat/lon, and activeSpotKey is cleared', async () => {
    const { w, router } = await mountView()
    const store = usePhotosPlaces()
    store.places.push({
      id: 'weird-id', key: 7, region: 'asia', country: 'X', city: 'Weird',
      lon: 0, lat: 0, count: 1, recent: false, last: '', lastDate: null,
      trips: 0, home: false, thumbs: [], coverAssetId: '',
    })
    await w.findComponent(PlacesRail).vm.$emit('pick', 'weird-id')
    await w.vm.$nextTick()
    store.detail = {
      id: 'weird-id', city: 'Weird', country: 'X', count: 1, trips: 0, home: false,
      coverAssetId: '', thumbs: [], insights: [], visits: [], recent: [],
      spots: [{ key: '42', name: 'Spot', lon: 11, lat: 22, count: 1, thumb: '' }],
    }
    await w.vm.$nextTick()
    await w.findComponent(PlaceDetailPanel).vm.$emit('pick-spot', { key: '42', name: 'Spot', lon: 11, lat: 22, count: 1, thumb: '' })
    await w.vm.$nextTick()
    expect(w.findComponent(PlaceDetailPanel).props('activeSpotKey')).toBe('42')

    const pushSpy = vi.spyOn(router, 'push')
    await w.findComponent(PlaceDetailPanel).vm.$emit('open-spot-library')
    expect(pushSpy).toHaveBeenCalledWith({ path: '/photos/places/7', query: { spot: '42', lat: '22', lon: '11' } })
    await w.vm.$nextTick()
    expect(w.findComponent(PlaceDetailPanel).props('activeSpotKey')).toBe(null)
  })
})

describe('P6b-T8: one Esc closes all three when three overlays are open at once (the P5-T10 bug shape)', () => {
  it('with Filters + theme + cover popovers all open at once, one Esc press closes all three', async () => {
    const { w } = await mountView()
    await w.find('[data-test="pfm-chip"]').trigger('click')
    await w.find('[data-test="mtm-chip"]').trigger('click')
    await w.findComponent(PlaceDetailPanel).vm.$emit('open-cover-picker')
    await w.vm.$nextTick()

    expect(w.find('[data-test="pfm-pop"]').exists()).toBe(true)
    expect(w.find('[data-test="mtm-pop"]').exists()).toBe(true)
    expect(w.find('[data-test="cp-scrim"]').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()

    expect(w.find('[data-test="pfm-pop"]').exists()).toBe(false)
    expect(w.find('[data-test="mtm-pop"]').exists()).toBe(false)
    expect(w.find('[data-test="cp-scrim"]').exists()).toBe(false)
  })
})
