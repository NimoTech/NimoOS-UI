// views/PhotosSearch.vue -- search container wiring (route /photos/search).
// Covers the "must-have test cases" checklist item by item.
//
// Test strategy: usePhotosSearch/usePhotosPeople/usePhotosAlbums/usePhotosSmartViews all use
// the real store (spyOn rather than mock, so derived state like matchesQuery/isSearchMode is
// genuinely derived), only the shared package's service is mocked. useLightbox is a
// module-level singleton, mocked wholesale using the same technique as
// PhotosSmartViewDetail.test.ts.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'
import en from '../../i18n/en_us'
import { useAgentStore } from '../../ai/stores/agentStore'
import { useAskNimo } from '../../photos/composables/useAskNimo'

const svc = vi.hoisted(() => ({
  photos: {
    smartSearch: vi.fn().mockResolvedValue([]),
    listPersons: vi.fn().mockResolvedValue({ persons: [], facesIndexedUpTo: null }),
    listAlbums: vi.fn().mockResolvedValue([]),
    getAlbum: vi.fn().mockResolvedValue({ assets: [] }),
    createSmartView: vi.fn(),
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
    personFaceThumbnailUrl: vi.fn((id: string | number, ver: unknown) => `mock://face/${id}/${ver}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// PhotoLightbox is now actually mounted in PhotosSearch.vue's template (this page
// never had a mount before), so this mock must satisfy every property/
// method PhotoLightbox.vue's own setup script touches unconditionally (its two `watch()` calls
// read `lb.index.value`/`lb.open.value`/`lb.current.value` at setup time regardless of whether
// the lightbox is ever opened). Plain `{ value: ... }` objects (not real Vue `ref()`s) are enough
// here -- this file's ~100 other tests never open the lightbox, so `open.value` stays `false`
// forever and the `v-if` gate keeps the rest of PhotoLightbox's template from ever evaluating;
// no reactivity is needed for a value that never changes. The dedicated "click result opens
// lightbox" test lives in PhotosSearch.lightbox.test.ts instead, using the real useLightbox()
// singleton (same split as Photos.vue/Photos.lightbox.test.ts).
const lbMock = vi.hoisted(() => ({
  open: { value: false },
  current: { value: null },
  detail: { value: null },
  list: { value: [] },
  index: { value: 0 },
  isFav: { value: false },
  hasPrev: { value: false },
  hasNext: { value: false },
  ocrLines: { value: [] },
  startMs: { value: 0 },
  openAt: vi.fn(),
  close: vi.fn(),
  prev: vi.fn(),
  next: vi.fn(),
  goTo: vi.fn(),
  toggleFav: vi.fn(),
}))
vi.mock('../../photos/lightbox/useLightbox', () => ({ useLightbox: () => lbMock }))

import PhotosSearch from '../PhotosSearch.vue'
import photosSearchRaw from '../PhotosSearch.vue?raw'
import routerRaw from '../../router/index.ts?raw'
import { usePhotosSearch } from '../../photos/stores/search'
import { usePhotosPeople } from '../../photos/stores/people'
import { usePhotosAlbums } from '../../photos/stores/albums'
import { useToast } from '../../stores/toast'
import { router as appRouter } from '../../router'
import { extractStyleBlock, parseCssRules, winningHoverBackground } from '../../photos/components/__tests__/cssCascade'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh, en_us: en } })

function makeRouter(initial = '/photos/search') {
  const router = createRouter({
    history: createWebHashHistory('/'),
    routes: [
      { path: '/photos/search', name: 'photos-search', component: PhotosSearch },
      { path: '/photos/smart-views', name: 'photos-smart-views', component: { template: '<div/>' } },
      { path: '/photos/smart-views/:id', name: 'photos-smart-view-detail', component: { template: '<div/>' } },
      // onSaved()'s toast action now lands here instead of smart-views.
      { path: '/photos/albums', name: 'photos-albums-stub', component: { template: '<div/>' } },
    ],
  })
  router.push(initial)
  return router
}

function rawAsset(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    takenAt: '2026-01-10T10:00:00Z',
    mimeType: 'image/jpeg',
    originalName: `${id}.jpg`,
    matchScore: 0.9,
    faces: [] as string[],
    hasOcr: false,
    belowCut: false,
    ...overrides,
  }
}

// A related correction: `attachTo` defaults to "not mounted into the real document" —
// vue-test-utils by default mounts the component into a detached DOM tree, and
// `element.dispatchEvent(new MouseEvent(..., {bubbles: true}))` only bubbles within that
// detached tree — it never reaches a listener on the real `document` (regardless of whether a
// child component's own `document.addEventListener('mousedown', ...)` logic is correct or not).
// A previous ignoreEl test case for exactly this reason "didn't go red even after ignoreEl was
// deleted" — not because the assertion was wrong, but because the event never reached the
// listener at all. This now mounts into `document.body` by default.
// Correction (the original citation for this pattern turned out to be wrong): the first draft
// of this comment cited "see the same pattern in Photos.lightbox.test.ts" — a source check
// found no `attachTo`/`document.body` anywhere in that file at all; the citation was wrong. The
// real precedent is `ClusterActionDialog.test.ts:52` / `PersonHero.test.ts:50` /
// `PlacesThemeMenu.test.ts:33` (all three use `attachTo: document.body` plus a module-level
// array recording mounted instances, cleaned up uniformly in `afterEach`/`beforeEach` — the
// same technique used here).
//
// Once mounted into the real `document.body`, `unmount()` must be called explicitly (to trigger
// each child component's own `onUnmounted`, removing the `document`-level keydown/mousedown
// listeners each one registers) — otherwise listeners left over from one test would keep firing
// against an already-"dead" component instance in later tests, and DOM nodes would keep
// accumulating for the whole duration of this file's run. A module-level array records the
// wrapper + container element for **every mount made via `mountSearch()`**, cleaned up
// uniformly in `afterEach` — note this array only covers mounts that go through this helper;
// this file has one other bare `mount()` that doesn't go through `mountSearch()` (the "overlays:
// unified Esc handling" / "isolated child-component fallback" test case), and that one
// guarantees its own `unmount()` with `try/finally` instead (switched to try/finally so a
// failing assertion can't skip cleanup) — it isn't added to this array.
const mountedInstances: Array<{ w: ReturnType<typeof mount>; el: HTMLElement }> = []
async function mountSearch(path = '/photos/search') {
  const router = makeRouter(path)
  await router.isReady()
  const el = document.createElement('div')
  document.body.appendChild(el)
  const w = mount(PhotosSearch, { global: { plugins: [i18n, router] }, attachTo: el })
  mountedInstances.push({ w, el })
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  svc.photos.smartSearch.mockReset().mockResolvedValue([])
  svc.photos.listPersons.mockReset().mockResolvedValue({ persons: [], facesIndexedUpTo: null })
  svc.photos.listAlbums.mockReset().mockResolvedValue([])
  svc.photos.getAlbum.mockReset().mockResolvedValue({ assets: [] })
  svc.photos.createSmartView.mockReset()
  lbMock.openAt.mockClear()
})
afterEach(() => {
  usePhotosSearch().__resetForTest()
  usePhotosPeople().__resetForTest()
  usePhotosAlbums().__resetForTest()
  // useAskNimo() is a module-level singleton (not tied to the per-test Pinia
  // instance), and PhotosSearch.vue mounts <AskNimoHost /> unconditionally -- leaving
  // popupOpen=true here would leak into every later test in this file, re-mounting
  // NimoModelPicker (via a fresh, un-stubbed agent store) on their next mountSearch() call and
  // throwing an unhandled "service.ai.listModels is not a function" rejection.
  useAskNimo().__resetForTests()
  vi.restoreAllMocks()
  // See mountSearch's header comment: an instance mounted into the real document.body must
  // explicitly unmount + remove its container, or document-level listeners and DOM nodes will
  // leak across tests and accumulate for the whole run.
  for (const { w, el } of mountedInstances) {
    w.unmount()
    el.remove()
  }
  mountedInstances.length = 0
})

// ── Route query-driven (structural spec 7) ──────────────────────────────────
describe('route query drives the search', () => {
  it('mounting with route.query.q="abc" calls smartSearch once with "abc"', async () => {
    const search = usePhotosSearch()
    const spy = vi.spyOn(search, 'smartSearch')
    await mountSearch('/photos/search?q=abc')
    expect(spy).toHaveBeenCalledWith('abc')
  })

  it('changing q to "def" calls again and clearAll takes effect (chip filters are cleared)', async () => {
    const search = usePhotosSearch()
    const spy = vi.spyOn(search, 'smartSearch')
    const { w, router } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    // First actually select and apply a filter (type=OCR), then confirm it gets cleared once the
    // query word changes — merely opening the popover without Apply isn't evidence the filter
    // took effect (the chipActive condition looks at filters, not openPop).
    await w.get('[data-test="chip-type"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.btn.btn-primary').trigger('click')
    expect(w.get('[data-test="chip-type"] .fchip').attributes('data-on')).toBe('true')
    await router.push('/photos/search?q=def')
    await flushPromises()
    expect(spy).toHaveBeenCalledWith('def')
    expect(w.get('[data-test="chip-type"] .fchip').attributes('data-on')).toBe('false')
  })

  it('q becoming empty calls store.clear() (store falls back to the unsearched state)', async () => {
    const { router } = await mountSearch('/photos/search?q=abc')
    const search = usePhotosSearch()
    await flushPromises()
    expect(search.isSearchMode).toBe(true)
    await router.push('/photos/search')
    await flushPromises()
    expect(search.isSearchMode).toBe(false)
  })

  it('smartSearch is called without filters (the second arg is omitted, always the store default)', async () => {
    const search = usePhotosSearch()
    const spy = vi.spyOn(search, 'smartSearch')
    await mountSearch('/photos/search?q=abc')
    expect(spy.mock.calls[0].length).toBe(1)
  })

  // When `router.replace` targets the same route (path and query both unchanged), vue-router
  // treats it as no navigation — the `query` computed doesn't change, so the main watcher never
  // re-calls `smartSearch` either. That means "resubmit the same word to force a refresh"
  // silently fails. `submitQuery` gets a shortcut: when the target word exactly matches the
  // current route's `q`, skip the route and call `smartSearch` again directly. Asserts here:
  // submitting the same word twice calls `smartSearch` twice (not just once, and definitely not
  // silently swallowed).
  it('resubmitting the same term calls smartSearch again, not silently skipped just because the route is unchanged', async () => {
    const search = usePhotosSearch()
    const spy = vi.spyOn(search, 'smartSearch')
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    expect(spy).toHaveBeenCalledTimes(1)
    await w.get('.topbar .search input').setValue('abc')
    await w.get('.topbar .search input').trigger('keydown.enter')
    await flushPromises()
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenNthCalledWith(2, 'abc')
  })
})

// ── §7e-3: query is a read-only computed, the source text must contain no assignment to it ──
describe('does not assign to query', () => {
  it('source text contains no "query.value =" assignment', () => {
    expect(photosSearchRaw).not.toMatch(/query\.value\s*=(?!=)/)
  })
})

// ── Pre-search state ─────────────────────────────────────────────────────
describe('pre-search state', () => {
  it('q empty shows .search-prestate and hides the hero', async () => {
    const { w } = await mountSearch('/photos/search')
    expect(w.find('.search-prestate').exists()).toBe(true)
    expect(w.find('[data-test="search-hero"]').exists()).toBe(false)
  })

  it('history with 3 entries renders 3 .prestate-chip; clicking one calls router.replace with that term', async () => {
    localStorage.setItem('nimo_search_history', JSON.stringify(['c', 'b', 'a']))
    const { w, router } = await mountSearch('/photos/search')
    const chips = w.findAll('[data-test="prestate-chip"]')
    expect(chips).toHaveLength(3)
    const replaceSpy = vi.spyOn(router, 'replace')
    await chips[1].trigger('click')
    expect(replaceSpy).toHaveBeenCalledWith({ path: '/photos/search', query: { q: 'b' } })
  })
})

// No Vue2 source: a clear-history affordance.
// Clicking wipes the persisted localStorage key and the reactive `history` ref together, so both
// render spots -- the prestate `.prestate-recent` chips block and the results-state
// `.search-history` row -- empty in the same tick (their existing v-if guards already hide on an
// empty array).
describe('clearing search history', () => {
  it('non-empty history renders the clear button inside .prestate-recent-head (data-test=search-history-clear)', async () => {
    localStorage.setItem('nimo_search_history', JSON.stringify(['c', 'b', 'a']))
    const { w } = await mountSearch('/photos/search')
    expect(w.find('[data-test="search-history-clear"]').exists()).toBe(true)
  })

  it('empty history does not render the whole .prestate-recent block (including the clear button)', async () => {
    const { w } = await mountSearch('/photos/search')
    expect(w.find('.prestate-recent').exists()).toBe(false)
    expect(w.find('[data-test="search-history-clear"]').exists()).toBe(false)
  })

  it('clicking clear removes the localStorage key and the whole .prestate-recent block (including chips) disappears', async () => {
    localStorage.setItem('nimo_search_history', JSON.stringify(['c', 'b', 'a']))
    const { w } = await mountSearch('/photos/search')
    expect(w.findAll('[data-test="prestate-chip"]')).toHaveLength(3)

    await w.get('[data-test="search-history-clear"]').trigger('click')

    expect(localStorage.getItem('nimo_search_history')).toBeNull()
    expect(w.find('.prestate-recent').exists()).toBe(false)
    expect(w.findAll('[data-test="prestate-chip"]')).toHaveLength(0)
  })

  it('after clearing, navigating to a query with results no longer shows the .search-history row either (same history ref)', async () => {
    localStorage.setItem('nimo_search_history', JSON.stringify(['b', 'a']))
    const { w, router } = await mountSearch('/photos/search')
    await w.get('[data-test="search-history-clear"]').trigger('click')

    await router.push('/photos/search?q=other')
    await flushPromises()
    await w.vm.$nextTick()

    expect(w.find('.search-history').exists()).toBe(false)
  })
})

// ── Topbar alignment ─────────────────────────────────────────────────────
// Vue2 ground truth (the Vue 2 page's PhotosSearchView.vue + PhotosTopbar.vue) has exactly ONE
// search input on this page — the shared topbar's `.search` box — and this page's own hero
// is a pure TEXT echo row (`.search-query` + `.kw` spans), never an editable input. New-UI's
// own PhotosSearchBar.vue (a departure from Vue2: a second, page-body-local editable input) has been
// retired: grep-confirmed no other consumer remains, so the component + its test file were
// deleted outright rather than left dead in the tree.
describe('top bar search field: PhotosSearchBar is retired, topbar\'s .search is the only input', () => {
  it('top bar search field echoes the route\'s q value', async () => {
    const { w } = await mountSearch('/photos/search?q=sunset')
    await flushPromises()
    expect((w.get('.topbar .search input').element as HTMLInputElement).value).toBe('sunset')
  })

  it('q empty leaves the top bar search field empty too', async () => {
    const { w } = await mountSearch('/photos/search')
    expect((w.get('.topbar .search input').element as HTMLInputElement).value).toBe('')
  })

  it('the page has only one input (the top bar one); PhotosSearchBar\'s standalone input is no longer rendered', async () => {
    const { w } = await mountSearch('/photos/search?q=sunset')
    await flushPromises()
    expect(w.findAll('input')).toHaveLength(1)
    expect(w.find('.photos-search-bar').exists()).toBe(false)
  })

  it('the hero area has no input, only .search-query text echo (+ .kw highlight)', async () => {
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a')])
    const { w } = await mountSearch('/photos/search?q=my%20videos')
    await flushPromises()
    expect(w.find('[data-test="search-hero"] input').exists()).toBe(false)
    expect(w.find('[data-test="search-query"]').exists()).toBe(true)
  })
})

// ── hero ─────────────────────────────────────────────────────────────────
describe('hero', () => {
  it('queryParts takes effect: includes .kw highlight elements', async () => {
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a')])
    const { w } = await mountSearch('/photos/search?q=my%20videos')
    await flushPromises()
    expect(w.find('.search-query .kw').exists()).toBe(true)
  })

  it('searching true hides .search-meta; false shows it, with seconds as (ms/1000).toFixed(2)', async () => {
    let resolveFn: ((v: unknown[]) => void) | undefined
    svc.photos.smartSearch.mockImplementation(() => new Promise((res) => { resolveFn = res }))
    const { w } = await mountSearch('/photos/search?q=abc')
    // The request is still in flight: searching is true, search-meta should not exist.
    expect(w.find('[data-test="search-meta"]').exists()).toBe(false)
    resolveFn!([rawAsset('a')])
    await flushPromises()
    await w.vm.$nextTick()
    const meta = w.get('[data-test="search-meta"]')
    const search = usePhotosSearch()
    const expectedSeconds = (search.ms / 1000).toFixed(2)
    expect(meta.text()).toContain(expectedSeconds)
  })

  it('query "my videos" renders understood\'s <b> text as the Chinese "视频", not "Videos"', async () => {
    const { w } = await mountSearch('/photos/search?q=my%20videos')
    const vals = w.findAll('[data-test="understood-v"]').map((n) => n.text())
    expect(vals).toContain(zh.photosSearchTypeVideos)
    expect(vals).not.toContain('Videos')
  })
})

// ── The 5 chips ─────────────────────────────────────────────────────────
describe('chip bar', () => {
  it('5 chips render in date/people/place/album/type order', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    const wraps = w.findAll('.filterbar > .fchip-wrap')
    expect(wraps).toHaveLength(5)
    expect(w.find('[data-test="chip-date"]').exists()).toBe(true)
    expect(w.find('[data-test="chip-people"]').exists()).toBe(true)
    expect(w.find('[data-test="chip-place"]').exists()).toBe(true)
    expect(w.find('[data-test="chip-album"]').exists()).toBe(true)
    expect(w.find('[data-test="chip-type"]').exists()).toBe(true)
  })

  it('clicking a chip opens its popover; clicking again closes it', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await w.get('[data-test="chip-date"] .fchip').trigger('click')
    expect(w.find('.cal').exists()).toBe(true) // SearchDatePopover's calendar
    await w.get('[data-test="chip-date"] .fchip').trigger('click')
    expect(w.find('.cal').exists()).toBe(false)
  })

  it('the People chip shows SearchPeoplePopover\'s face grid', async () => {
    svc.photos.listPersons.mockResolvedValue({
      persons: [{ id: 1, name: 'Sara', count: 5 }],
      facesIndexedUpTo: null,
    })
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-people"] .fchip').trigger('click')
    expect(w.find('.face-pop-grid').exists()).toBe(true)
  })

  it('Places / Albums / File type are all PhotosFilterPopover (.fpop-list)', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 1, name: 'Trip' }])
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a', { placeName: 'Tokyo, Japan' })])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()

    await w.get('[data-test="chip-place"] .fchip').trigger('click')
    expect(w.find('.fpop-list').exists()).toBe(true)
    expect(w.text()).toContain('Tokyo')
    await w.get('[data-test="chip-place"] .fchip').trigger('click')

    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    expect(w.find('.fpop-list').exists()).toBe(true)
    expect(w.text()).toContain('Trip')
    await w.get('[data-test="chip-album"] .fchip').trigger('click')

    await w.get('[data-test="chip-type"] .fchip').trigger('click')
    expect(w.find('.fpop-list').exists()).toBe(true)
    expect(w.text()).toContain(zh.photosSearchTypeOcr)
  })
})

// ── draft semantics ────────────────────────────────────────────────────────
describe('draft semantics (Apply/Cancel/click outside)', () => {
  it('opening the place popover and checking an item leaves filteredResults unchanged (not committed); clicking Apply changes it', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('a', { placeName: 'Tokyo, Japan' }),
      rawAsset('b', { placeName: 'Osaka, Japan' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    expect(w.findAll('.tile')).toHaveLength(2)

    await w.get('[data-test="chip-place"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click') // check the first place
    expect(w.findAll('.tile')).toHaveLength(2) // not applied yet, results unchanged
  })

  it('checking the draft then clicking Apply narrows results to 1', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('a', { placeName: 'Tokyo, Japan' }),
      rawAsset('b', { placeName: 'Osaka, Japan' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-place"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.btn.btn-primary').trigger('click') // Apply
    expect(w.findAll('.tile')).toHaveLength(1)
    expect(w.get('[data-test="chip-place"] .fchip').attributes('data-on')).toBe('true')
  })

  it('opening the popover, checking, then clicking Cancel leaves filters unchanged', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('a', { placeName: 'Tokyo, Japan' }),
      rawAsset('b', { placeName: 'Osaka, Japan' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-place"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.fpop-quick').trigger('click') // Cancel (the first fpop-quick is Cancel)
    expect(w.findAll('.tile')).toHaveLength(2)
    expect(w.get('[data-test="chip-place"] .fchip').attributes('data-on')).toBe('false')
  })

  it('clicking outside the popover also discards it (the draft is not committed)', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('a', { placeName: 'Tokyo, Japan' }),
      rawAsset('b', { placeName: 'Osaka, Japan' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-place"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('.fpop-list').exists()).toBe(false) // popover closed
    expect(w.findAll('.tile')).toHaveLength(2) // not applied
  })
})

// ── filteredResults: the five filter types + combinations ───────────────────
describe('filteredResults', () => {
  it('with no type filter set, all three asset types are present (baseline, confirms the fixture itself is fine)', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('photo1', { mimeType: 'image/jpeg', hasOcr: false }),
      rawAsset('ocr1', { mimeType: 'image/jpeg', hasOcr: true }),
      rawAsset('vid1', { mimeType: 'video/mp4' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    expect(w.findAll('.tile')).toHaveLength(3)
  })

  // A real defect: the test below used to be named "each of the three branches filters out the
  // expected count", but never actually set `filters.type` at all — it only asserted "all 3 are
  // present when unfiltered". Negating all three type-branch predicates still left 49/49 green.
  // Three test cases were added here that genuinely set `filters.type` (by selecting the
  // corresponding item via the type chip's PhotosFilterPopover → Apply), covering one case per
  // filter type, five in total. The type chip's items are in a
  // fixed order, `['Photos','OCR','Videos']` (`TYPE_ITEMS`), and `.fpop-item` renders in that
  // same order, selected by index.
  it('type=Photos (index 0) leaves only non-video, non-OCR photos', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('photo1', { mimeType: 'image/jpeg', hasOcr: false }),
      rawAsset('ocr1', { mimeType: 'image/jpeg', hasOcr: true }),
      rawAsset('vid1', { mimeType: 'video/mp4' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-type"] .fchip').trigger('click')
    await w.findAll('.fpop-item')[0].trigger('click') // Photos
    await w.get('.btn.btn-primary').trigger('click')
    const ids = w.findAll('.tile img').map((n) => n.attributes('src'))
    expect(ids).toHaveLength(1)
    expect(ids[0]).toContain('/photo1/')
  })

  it('type=OCR (index 1) leaves only assets with hasOcr', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('photo1', { mimeType: 'image/jpeg', hasOcr: false }),
      rawAsset('ocr1', { mimeType: 'image/jpeg', hasOcr: true }),
      rawAsset('vid1', { mimeType: 'video/mp4' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-type"] .fchip').trigger('click')
    await w.findAll('.fpop-item')[1].trigger('click') // OCR
    await w.get('.btn.btn-primary').trigger('click')
    const ids = w.findAll('.tile img').map((n) => n.attributes('src'))
    expect(ids).toHaveLength(1)
    expect(ids[0]).toContain('/ocr1/')
  })

  it('type=Videos (index 2) leaves only isVideo assets', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('photo1', { mimeType: 'image/jpeg', hasOcr: false }),
      rawAsset('ocr1', { mimeType: 'image/jpeg', hasOcr: true }),
      rawAsset('vid1', { mimeType: 'video/mp4' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-type"] .fchip').trigger('click')
    await w.findAll('.fpop-item')[2].trigger('click') // Videos
    await w.get('.btn.btn-primary').trigger('click')
    const ids = w.findAll('.tile img').map((n) => n.attributes('src'))
    expect(ids).toHaveLength(1)
    expect(ids[0]).toContain('/vid1/')
  })

  // The E7 ordering contract needs an assertion: all three previous fixtures only ever put in 1
  // person, so even a reversed order wouldn't have been caught. This puts in 2 people with
  // different counts and asserts the face-cells render in descending count order.
  it('the People popover renders in descending order of face count', async () => {
    svc.photos.listPersons.mockResolvedValue({
      persons: [
        { id: 1, name: 'Low', count: 2 },
        { id: 2, name: 'High', count: 9 },
      ],
      facesIndexedUpTo: null,
    })
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-people"] .fchip').trigger('click')
    const names = w.findAll('.face-cell-name').map((n) => n.text())
    expect(names).toEqual(['High', 'Low'])
  })

  it('people filter: only kept when the faces array contains the selected name', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [{ id: 1, name: 'Sara', count: 3 }], facesIndexedUpTo: null })
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('a', { faces: ['Sara'] }),
      rawAsset('b', { faces: ['Bob'] }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-people"] .fchip').trigger('click')
    await w.get('.face-cell').trigger('click')
    await w.get('[data-test="people-apply-btn"]').trigger('click')
    expect(w.findAll('.tile')).toHaveLength(1)
  })

  it('date filter: dateInRange narrows by takenAt', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('a', { takenAt: '2026-01-10T10:00:00Z' }),
      rawAsset('b', { takenAt: '2020-01-10T10:00:00Z' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-date"] .fchip').trigger('click')
    await w.get('.fpop-quick[data-on]').trigger('click') // Click the first quick range (Today — very unlikely to contain either date above; verifies narrowing happens)
    await w.get('.btn.btn-primary').trigger('click')
    expect(w.findAll('.tile').length).toBeLessThan(2)
  })

  it('place filter and people filter both apply together (combined)', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [{ id: 1, name: 'Sara', count: 3 }], facesIndexedUpTo: null })
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('a', { placeName: 'Tokyo, Japan', faces: ['Sara'] }),
      rawAsset('b', { placeName: 'Tokyo, Japan', faces: ['Bob'] }),
      rawAsset('c', { placeName: 'Osaka, Japan', faces: ['Sara'] }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-place"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click') // Select Tokyo (listed first, highest frequency)
    await w.get('.btn.btn-primary').trigger('click')
    await w.get('[data-test="chip-people"] .fchip').trigger('click')
    await w.get('.face-cell').trigger('click')
    await w.get('[data-test="people-apply-btn"]').trigger('click')
    expect(w.findAll('.tile')).toHaveLength(1) // Only 'a' matches both Tokyo + Sara
  })
})

// ── filters.album ──────────────────────────────────────────────────────
describe('filters.album', () => {
  it('selecting an album calls fetchAlbumAssets and narrows results to the album\'s assets', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 9, name: 'Trip' }])
    svc.photos.getAlbum.mockResolvedValue({ assets: [{ id: 'a', originalName: 'a.jpg', mimeType: 'image/jpeg' }] })
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a'), rawAsset('b')])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    expect(svc.photos.getAlbum).toHaveBeenCalledWith(9)
    expect(w.findAll('.tile')).toHaveLength(1)
  })

  // A real regression: the instant Apply is clicked on a selected album, the `getAlbum` request
  // has usually not landed yet — that's the normal path for "filter by album for the first
  // time", not an edge-case timing. The previous computed design used `assetsOf(id)`'s return
  // value to decide "should this filter apply", but "the cache slot doesn't exist yet" and "the
  // cache slot exists and its content just happens to be an empty array" look identical on
  // `assetsOf`'s return value (both are `[]`) — so during the in-flight window, `albumAssetIds`
  // gets misjudged as an empty Set, `filteredResults` instantly zeroes out, and the whole
  // `.empty-search` block (orb + "no matches" + condition chips) flashes until the request
  // actually lands — this test case asserts "this should not happen during the in-flight window"
  // (per Vue2 `:593-602`'s own behavior: don't filter while in flight, rather than filtering
  // down to an empty set).
  it('the album filter\'s in-flight window (getAlbum not yet resolved) should not collapse results to empty or flash the empty state', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 9, name: 'Trip' }])
    let resolveGet: ((v: unknown) => void) | undefined
    svc.photos.getAlbum.mockImplementation(() => new Promise((res) => { resolveGet = res }))
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a'), rawAsset('b')])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    // The request is still in flight (resolveGet hasn't been called) — should not zero out, and the empty state should not appear.
    expect(w.find('[data-test="empty-search"]').exists()).toBe(false)
    expect(w.findAll('.tile')).toHaveLength(2)
    // Only now does the request actually land, and the results should narrow down precisely.
    resolveGet!({ assets: [{ id: 'a', originalName: 'a.jpg', mimeType: 'image/jpeg' }] })
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.findAll('.tile')).toHaveLength(1)
  })

  // A zero-coverage gap at the level of a real functional-defect-grade missing guard: the
  // distinction between "the cache slot doesn't exist (`in`)" vs. "the cache slot has landed but
  // its content is an empty array (`.length===0`)" previously only had the in-flight test case
  // above (asserting the "hasn't landed yet" half) — **no test case asserted the "has landed,
  // and this album genuinely has no photos" half at all** — swapping the computed's `in` check
  // for `assetsOf(id).length===0` still returned the same batch of 72 green test cases, because
  // not one of them ever reached the specific state of "the album genuinely exists, the request
  // has genuinely landed, and the returned asset list happens to be an empty array". This adds
  // that case, and additionally asserts `getAlbum` was actually called (ruling out the false
  // positive of "the request was never even sent, and it happened to also be an empty array").
  it('an album that truly exists but has no assets (request settled) yields an empty result set and the empty state (not a false in-flight read)', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 9, name: 'Trip' }])
    svc.photos.getAlbum.mockResolvedValue({ assets: [] })
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a'), rawAsset('b')])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    expect(svc.photos.getAlbum).toHaveBeenCalledWith(9) // the request genuinely fired, not simply never called
    expect(w.findAll('.tile')).toHaveLength(0)
    expect(w.find('[data-test="empty-search"]').exists()).toBe(true)
  })

  // A real defect: the previous version of this test case claimed to cover the "id not found"
  // branch, but its own comment admitted it "was changed to directly assert albumAssetIds is
  // always null when no album is selected" — what it actually ended up asserting was "no
  // filtering" (both tiles present), the exact opposite of the required "result is
  // an empty set".
  //
  // This genuinely exercises that branch: first normally select an album, Apply, and confirm
  // filtering by album assets narrows the result (1 tile); then simulate "the album got deleted
  // elsewhere" (the store's `albums.albums` list is cleared, while `filters.album`'s own name is
  // unchanged) — the redesign makes `albumAssetIds` a computed that reads `albums.albums`
  // directly, so once `albums.albums` changes, no extra trigger is needed — the computed
  // automatically re-evaluates: this name can no longer be found in `albums.albums`, so it
  // should degrade to an empty set, not to "not found, so don't filter".
  it('an album name with no matching id yields an empty result set (not "no filter applied")', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 9, name: 'Trip' }])
    svc.photos.getAlbum.mockResolvedValue({ assets: [{ id: 'a', originalName: 'a.jpg', mimeType: 'image/jpeg' }] })
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a'), rawAsset('b')])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.findAll('.tile')).toHaveLength(1) // First verify normal narrowing works, ruling out an always-true assertion
    const albums = usePhotosAlbums()
    albums.albums = [] // Simulate the album being deleted elsewhere: filters.album's name can no longer find an id
    await w.vm.$nextTick()
    expect(w.findAll('.tile')).toHaveLength(0) // id not found => empty set, not degraded to "don't filter"
  })

  // A real defect: fully reproduces the failing sequence — select album A → Apply (request for A
  // in flight, doesn't resolve) → reopen the popover, deselect A → Apply (albumAssetIds should
  // become null) → select A again → Apply. The old implementation (`fetchAlbumAssets(id).then
  // (...)` writing a snapshot + an `albumSeq` counter) breaks here: `albums.ts:81`'s
  // `isLoadingAssets(id)` short-circuit makes the second call for A resolve immediately with no
  // data; inside `.then()`, `mine===albumSeq` holds (it's the most recent legitimate call), but
  // `assetsOf(A)` is still empty at that moment => `albumAssetIds` gets written as an empty Set,
  // permanently zeroed out — nobody reads it again even once the first genuine request finally
  // lands.
  // After the redesign (`albumAssetIds` is a computed that reads `albums.assetsOf(the currently
  // selected album id)` directly): no matter how many short-circuited, data-less
  // `fetchAlbumAssets` calls happen in between, as long as "the first genuinely in-flight
  // request" eventually writes its data into `albums.albumAssetsByID`, this computed picks it up
  // automatically on its next evaluation — here A's first request is made to resolve last, and
  // the assertion checks the result ends up correct, not permanently empty.
  it('a re-entrant race on the same album (select A in-flight, cancel, select A again) does not permanently collapse results to empty', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 1, name: 'A' }])
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a'), rawAsset('b')])
    let resolveFirst: ((v: unknown) => void) | undefined
    const firstCall = new Promise((res) => { resolveFirst = res })
    let callCount = 0
    svc.photos.getAlbum.mockImplementation(() => {
      callCount += 1
      if (callCount === 1) return firstCall // First call: hangs, simulating "request in flight"
      // Any subsequent call (including ones short-circuited by albums.ts's isLoadingAssets)
      // should not be relied on — the real implementation short-circuits the second explicit
      // call inside the store itself; a "wrong answer" (empty array) is given here to ensure: if
      // the implementation regresses back to the old "rely on the promise to write a snapshot"
      // technique, the test will read this wrong answer instead of the real data eventually
      // supplied by resolveFirst.
      return Promise.resolve({ assets: [] })
    })
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    // Select A → Apply (request in flight).
    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises()
    // Reopen the popover, deselect A → Apply (filters.album = null).
    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click') // Click it again = deselect
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises()
    // Select A again → Apply (the first request still hasn't resolved; this call gets short-circuited by the store itself).
    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises()
    // Only now does the first genuine request finally arrive, bringing the real data.
    resolveFirst!({ assets: [{ id: 'a', originalName: 'a.jpg', mimeType: 'image/jpeg' }] })
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.findAll('.tile')).toHaveLength(1) // not a permanently empty set
  })

  it('the seq guard when rapidly switching two albums: a slow stale response does not overwrite the fast new one', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 1, name: 'A' }, { id: 2, name: 'B' }])
    svc.photos.smartSearch.mockResolvedValue([rawAsset('x'), rawAsset('y')])
    let resolveA: ((v: unknown) => void) | undefined
    const pendingA = new Promise((res) => { resolveA = res })
    svc.photos.getAlbum.mockImplementation((id: number) => {
      if (id === 1) return pendingA
      return Promise.resolve({ assets: [{ id: 'y', originalName: 'y.jpg', mimeType: 'image/jpeg' }] })
    })
    const albums = usePhotosAlbums()
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click') // Select A (id 1, slow response, not yet resolved)
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises()
    // Reopen the popover before switching to B (id 2, fast response).
    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    // Deselect A, select B.
    const items = w.findAll('.fpop-item')
    await items[0].trigger('click') // Deselect A
    await items[1].trigger('click') // Select B
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises() // B (fast response) lands first
    // A's slow response only arrives now — it should not overwrite B's already-landed result.
    resolveA!({ assets: [{ id: 'x', originalName: 'x.jpg', mimeType: 'image/jpeg' }] })
    await flushPromises()
    await w.vm.$nextTick()
    expect(albums.assetsOf(2)).toBeDefined()
    expect(w.findAll('.tile')).toHaveLength(1)
    expect(w.get('.tile img').attributes('src')).toContain('/y/')
  })
})

// ── applyUnderstood ──────────────────────────────────────────────────────
describe('applyUnderstood', () => {
  it('a query containing a named person pre-selects the people chip', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [{ id: 1, name: 'Sara', count: 3 }], facesIndexedUpTo: null })
    const { w } = await mountSearch('/photos/search?q=Sara%20trip')
    await flushPromises()
    expect(w.get('[data-test="chip-people"] .fchip').attributes('data-on')).toBe('true')
  })

  it('containing "last week" with date empty pre-fills the date', async () => {
    const { w } = await mountSearch('/photos/search?q=last%20week')
    await flushPromises()
    expect(w.get('[data-test="chip-date"] .fchip').attributes('data-on')).toBe('true')
  })

  it('an existing user-selected date is not overwritten by applyUnderstood', async () => {
    // The query contains "last week" => applyUnderstood auto-prefills date=last7 on mount.
    const { w } = await mountSearch('/photos/search?q=last%20week')
    await flushPromises()
    expect(w.get('[data-test="chip-date"] .fchip').attributes('data-on')).toBe('true')
    // User manually changes the date to "Today" (different from the auto-prefilled last7), overriding the auto-prefill.
    await w.get('[data-test="chip-date"] .fchip').trigger('click')
    const quickBtns = w.findAll('.fpop-row .fpop-quick')
    await quickBtns[0].trigger('click') // QUICK_KEYS[0] === 'today'
    await w.get('.btn.btn-primary').trigger('click')
    const labelAfterManualPick = w.get('[data-test="chip-date"] .fchip').text()
    expect(labelAfterManualPick).toBe(zh.photosSearchToday)
    // Triggers applyUnderstood to re-run (peopleLoaded false->true); the "don't overwrite an
    // existing date" branch should block understood's last7 prefill, keeping the user's manually
    // chosen "Today" from being reverted.
    const people = usePhotosPeople()
    people.peopleLoaded = false
    await w.vm.$nextTick()
    people.peopleLoaded = true
    await w.vm.$nextTick()
    expect(w.get('[data-test="chip-date"] .fchip').text()).toBe(labelAfterManualPick)
  })

  it('peopleLoaded flipping from false to true re-runs applyUnderstood once', async () => {
    const { w } = await mountSearch('/photos/search?q=Sara')
    await flushPromises()
    expect(w.get('[data-test="chip-people"] .fchip').attributes('data-on')).toBe('false')
    const people = usePhotosPeople()
    // onMounted's own fetchPeople() (a real store method) already pushed peopleLoaded from
    // false to true during flushPromises (even though listPersons resolved an empty list) —
    // this dials it back to false first, so a genuine "false->true" transition can be produced
    // to trigger the watch(peopleLoaded) re-run logic, rather than hitting the false positive of
    // "true->true doesn't trigger the watcher".
    people.peopleLoaded = false
    people.people = [{
      id: 1, name: 'Sara', confidence: 0.9, count: 3, favorite: false, relation: '',
      coverFaceId: null, heroAssetId: null, firstSeen: null, lastSeen: null, placesCount: 0,
    }]
    await w.vm.$nextTick()
    people.peopleLoaded = true
    await w.vm.$nextTick()
    expect(w.get('[data-test="chip-people"] .fchip').attributes('data-on')).toBe('true')
  })
})

// ── Sorting ────────────────────────────────────────────────────────────────
describe('sorting', () => {
  it('relevance sorts by descending score; switching to newest/oldest changes the order', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('low', { matchScore: 0.2, takenAt: '2020-01-01T00:00:00Z' }),
      rawAsset('high', { matchScore: 0.9, takenAt: '2026-01-01T00:00:00Z' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    let ids = w.findAll('.tile img').map((n) => n.attributes('src'))
    expect(ids[0]).toContain('/high/')
    await w.get('[data-test="sort-oldest"]').trigger('click')
    ids = w.findAll('.tile img').map((n) => n.attributes('src'))
    expect(ids[0]).toContain('/low/')
  })

  it('under relevance, belowCut being active makes more non-empty (two-tier); switching to newest empties more', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('best', { matchScore: 0.9, belowCut: false }),
      rawAsset('tail', { matchScore: 0.3, belowCut: true }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    expect(w.find('.more-results-bar').exists()).toBe(true)
    await w.get('[data-test="sort-newest"]').trigger('click')
    expect(w.find('.more-results-bar').exists()).toBe(false)
  })
})

// ── Result-count thousands separator follows locale ──────────────────────────
// `filteredResults.length.toLocaleString()` was the only
// bare call across the whole codebase (the other 5 call sites all pass a locale). This repo's
// locale identifiers are `zh_cn`/`en_us` (underscore, not valid BCP-47) — passing one bare to
// toLocaleString throws a RangeError (consistent with the existing wording in `PhotosSearch.vue`'s
// own localeTag comment and `SmartViewCard.vue:37`/`SearchPeoplePopover.vue:62` — corrected here:
// this comment previously and wrongly said "does not throw", contradicting the production code's
// own comment in the same commit; verified with node that `(1234).toLocaleString('zh_cn')`
// genuinely throws `RangeError: Incorrect locale information provided`, wording now made
// consistent). This verifies both: (1) rendering the element doesn't throw (mounted with the
// zh_cn i18n instance; the call site now reads `toLocaleString(localeTag)`, where `localeTag` is
// the valid value after conversion to `zh-cn`) and (2) the source text is a call carrying the
// localeTag identifier, not a bare call.
describe('result count thousands separator follows locale', () => {
  it('results-count renders the thousands-separated number without throwing RangeError (zh_cn locale)', async () => {
    svc.photos.smartSearch.mockResolvedValue(
      Array.from({ length: 1234 }, (_, i) => rawAsset(`p${i}`)),
    )
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    expect(w.get('[data-test="results-count"]').text()).toContain((1234).toLocaleString('zh-cn'))
  })

  // Source-text guard, tightened the same way as SearchPeoplePopover.test.ts:135 — the old
  // regex `/toLocaleString\(\s*\S+/` would even match a bare call `toLocaleString()` (`)` itself
  // is a `\S`), so it had no discriminating power; this one requires the captured group to
  // genuinely be the `localeTag` identifier.
  it('source text calls toLocaleString(localeTag) with an identifier argument, not a bare call', () => {
    expect(photosSearchRaw).toMatch(/toLocaleString\(\s*localeTag\s*\)/)
  })
})

// ── Empty state ────────────────────────────────────────────────────────────
describe('empty state', () => {
  it('filteredResults empty with searching false shows .empty-search, listing activeConditions', async () => {
    svc.photos.smartSearch.mockResolvedValue([])
    const { w } = await mountSearch('/photos/search?q=nothing')
    await flushPromises()
    expect(w.find('[data-test="empty-search"]').exists()).toBe(true)
  })

  it('searching true hides .empty-search', async () => {
    let resolveFn: ((v: unknown[]) => void) | undefined
    svc.photos.smartSearch.mockImplementation(() => new Promise((res) => { resolveFn = res }))
    const { w } = await mountSearch('/photos/search?q=abc')
    expect(w.find('[data-test="empty-search"]').exists()).toBe(false)
    resolveFn!([])
  })

  // The old decision ("no Ask Nimo button here") has been reversed by the spec --
  // this test used to assert the button's *absence*; it now asserts its presence and exact wiring
  // instead of being deleted outright, so the empty state's Ask Nimo affordance stays covered.
  it('empty-search state shows an Ask Nimo button that opens the popup with the i18n prefix + chips joined by " + " (not a Chinese comma)', async () => {
    // This it() needs its own stub -- openWith() below calls ensureNimoAgentInit(), and this
    // test file has no dedicated beforeEach to rely on, so the stub goes right here (same
    // pattern as PersonHero.test.ts/PersonRelationsTab.test.ts).
    const agent = useAgentStore('photos')
    agent.loadAvailableModels = vi.fn(async () => {})
    agent.createSession = vi.fn(async () => { agent.activeSessionId = 's0' })
    agent.deleteSession = vi.fn(async () => {})
    agent.setSessionTitle = vi.fn(async () => {})
    useAskNimo().__resetForTests()

    svc.photos.listPersons.mockResolvedValue({ persons: [{ id: 1, name: 'Sara', count: 3 }], facesIndexedUpTo: null })
    // Tokyo+Bob only -- selecting place=Tokyo AND people=Sara narrows this to zero matches, driving
    // the empty state (same place+people combo as the "组合" test above, minus the Sara match).
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('a', { placeName: 'Tokyo, Japan', faces: ['Bob'] }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-place"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.btn.btn-primary').trigger('click')
    await w.get('[data-test="chip-people"] .fchip').trigger('click')
    await w.get('.face-cell').trigger('click')
    await w.get('[data-test="people-apply-btn"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="empty-search"]').exists()).toBe(true)

    await w.find('[data-test="empty-search-ask-nimo"]').trigger('click')
    expect(useAskNimo().popupOpen.value).toBe(true)
    // PhotosSearch.vue also mounts <AskNimoHost /> unconditionally, so opening the popup here
    // immediately renders AskNimoChat, whose own prefill watcher consumes useAskNimo().prefill
    // into its local textarea model within the same tick (emitting prefill-consumed) -- so the
    // composable's prefill ref is back to '' by the time we can observe it. Assert against the
    // rendered textarea instead, which is where the consumed text actually lands.
    await flushPromises()
    // AskNimoHost Teleports its whole subtree (incl. AskNimoChat's textarea) to document.body --
    // same query pattern as AskNimoHost.test.ts -- so it must be queried on document.body, not
    // through `w`, which only sees PhotosSearch.vue's own (non-teleported) render tree.
    const textarea = document.body.querySelector('.nimo-chat-textarea') as HTMLTextAreaElement | null
    // activeConditions order is people-then-place (PhotosSearch.vue's own computed), giving
    // ['Sara', 'Tokyo'] here -- joined with Vue2's exact ' + ' separator, not a Chinese comma.
    expect(textarea?.value).toBe(zh.photosSearchFindPhotosPrefix + 'Sara + Tokyo')
  })
})

// ── load-more ────────────────────────────────────────────────────────────
describe('load-more', () => {
  it('@load-more calls store.loadMore()', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('best', { matchScore: 0.9, belowCut: false }),
      rawAsset('tail', { matchScore: 0.3, belowCut: true }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const search = usePhotosSearch()
    const spy = vi.spyOn(search, 'loadMore').mockResolvedValue(undefined)
    await w.get('.more-results-bar').trigger('click') // expand more
    // The sentinel is driven by IntersectionObserver, and jsdom can't test a real scroll —
    // call the load-more event path the component exposes directly instead:
    // PhotosSearchGrid forwards an IO hit as emit('load-more'); here we find the
    // PhotosSearchGrid instance directly and emit it, verifying the host wires it to store.loadMore().
    const grid = w.findComponent({ name: 'PhotosSearchGrid' })
    grid.vm.$emit('load-more')
    await w.vm.$nextTick()
    expect(spy).toHaveBeenCalled()
  })
})

// ── @open → openAt's 4th arg is query (the OCR-activation main guard) ───────
describe('@open activates lightbox OCR', () => {
  it('openAt\'s fourth arg is the current query, and the second arg is the photo array mapped from sortedResults', async () => {
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a'), rawAsset('b')])
    const { w } = await mountSearch('/photos/search?q=receipt')
    await flushPromises()
    await w.get('.tile').trigger('click')
    expect(lbMock.openAt).toHaveBeenCalledTimes(1)
    const args = lbMock.openAt.mock.calls[0]
    expect(args[3]).toBe('receipt')
    expect(Array.isArray(args[1])).toBe(true)
    expect((args[1] as Array<{ id: string }>).map((p) => p.id)).toEqual(expect.arrayContaining(['a', 'b']))
  })

  // The test above only uses arrayContaining to assert membership, not order —
  // quietly swapping openAt's 2nd arg from sortedResults to filteredResults (unsorted) would
  // slip past it, and structural spec item 15 specifically calls out that "the paging set is
  // sortedResults, not filteredResults" distinction.
  // Uses two results with different scores here (under relevance sort, high should come first),
  // asserting the exact id order.
  it('the second arg strictly follows sortedResults\' order (descending relevance score), not filteredResults\' original order', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('low', { matchScore: 0.2 }), // first in raw order, but low score
      rawAsset('high', { matchScore: 0.9 }), // second in raw order, but high score
    ])
    const { w } = await mountSearch('/photos/search?q=receipt')
    await flushPromises()
    // Click the second tile (render order is already sorted by score; tiles[0] is high).
    await w.findAll('.tile')[0].trigger('click')
    const args = lbMock.openAt.mock.calls[0]
    expect((args[1] as Array<{ id: string }>).map((p) => p.id)).toEqual(['high', 'low'])
  })
})

// ── Search history ─────────────────────────────────────────────────────────
describe('search history', () => {
  // A real defect: `Photos.vue`'s top search box and `PhotosSmartViewDetail.vue`'s
  // "refine within search" both only `router.push` without writing history — previously only
  // `PhotosSearch.vue`'s own `PhotosSearchBar` submit path wrote it. The fix: history writing
  // moved into the main query watcher (recorded on arrival), which naturally covers any entry
  // point that lets the route arrive here with a non-empty `q`, not just "this page's own search
  // box submit". This test case mounts directly at an address that already carries `q`
  // (simulating a push from Photos.vue or PhotosSmartViewDetail.vue, or even arriving via deep
  // link / browser back-forward), asserting the word really gets written into history — exactly
  // the previously broken path.
  it('mounting with q already in the address bar (simulating a push from Photos.vue/a refinement entry point, or a deep link) puts that term in history', async () => {
    await mountSearch('/photos/search?q=sunset')
    expect(JSON.parse(localStorage.getItem('nimo_search_history')!)).toEqual(['sunset'])
  })

  // A knock-on effect of the change above: with history writing moved into the query watcher,
  // the write now follows completion of `router.replace()`'s (asynchronous) navigation, no
  // longer sharing a synchronous call stack with `submitQuery()` — after triggering Enter, one
  // extra `flushPromises()` is needed before the write becomes observable (production behavior
  // is unchanged; only the test has to add the wait).
  it('onSubmit("abc") leaves localStorage as ["abc"]; then "def" gives ["def","abc"]', async () => {
    const { w } = await mountSearch('/photos/search')
    await w.get('.topbar .search input').setValue('abc')
    await w.get('.topbar .search input').trigger('keydown.enter')
    await flushPromises()
    expect(JSON.parse(localStorage.getItem('nimo_search_history')!)).toEqual(['abc'])
    await w.get('.topbar .search input').setValue('def')
    await w.get('.topbar .search input').trigger('keydown.enter')
    await flushPromises()
    expect(JSON.parse(localStorage.getItem('nimo_search_history')!)).toEqual(['def', 'abc'])
  })

  it('repeating "abc" dedupes and moves it to the front: ["abc","def"]', async () => {
    localStorage.setItem('nimo_search_history', JSON.stringify(['def', 'abc']))
    const { w } = await mountSearch('/photos/search')
    await w.get('.topbar .search input').setValue('abc')
    await w.get('.topbar .search input').trigger('keydown.enter')
    await flushPromises()
    expect(JSON.parse(localStorage.getItem('nimo_search_history')!)).toEqual(['abc', 'def'])
  })

  it('more than 6 entries keeps only 6', async () => {
    localStorage.setItem('nimo_search_history', JSON.stringify(['1', '2', '3', '4', '5', '6']))
    const { w } = await mountSearch('/photos/search')
    await w.get('.topbar .search input').setValue('7')
    await w.get('.topbar .search input').trigger('keydown.enter')
    await flushPromises()
    const stored = JSON.parse(localStorage.getItem('nimo_search_history')!)
    expect(stored).toHaveLength(6)
    expect(stored[0]).toBe('7')
  })

  it('localStorage throwing (mocked setItem throw) does not crash', async () => {
    const { w } = await mountSearch('/photos/search')
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    await expect(
      w.get('.topbar .search input').setValue('boom').then(() =>
        w.get('.topbar .search input').trigger('keydown.enter')),
    ).resolves.not.toThrow()
    spy.mockRestore()
  })
})

// ── Save popover ─────────────────────────────────────────────────────────
describe('save as smart view', () => {
  it('clicking "Save as smart view" opens the popover; defaultName is the query itself when shorter than 40', async () => {
    const { w } = await mountSearch('/photos/search?q=sunset')
    await flushPromises()
    await w.get('[data-test="save-smart"]').trigger('click')
    expect(w.find('[data-test="ssv-root"]').exists()).toBe(true)
    expect((w.get('[data-test="ssv-name-input"]').element as HTMLInputElement).value).toBe('sunset')
  })

  // `:ignore-el="saveBtnRef"` previously had no assertion at all — deleting it left 49/49 still
  // green. Here a bare mousedown is dispatched directly on the trigger button (bypassing
  // @click's openSave logic), verifying that SearchSaveSmartView's own onDocMousedown judges it
  // as "clicked on the ignoreEl" and therefore doesn't close — if ignoreEl isn't wired up
  // correctly, this mousedown would be judged an "outside click" and wrongly close the popover.
  it('the save-smart trigger button is passed as ignoreEl: a mousedown on the button does not mistakenly close the popover', async () => {
    const { w } = await mountSearch('/photos/search?q=sunset')
    await flushPromises()
    await w.get('[data-test="save-smart"]').trigger('click')
    expect(w.find('[data-test="ssv-root"]').exists()).toBe(true)
    w.get('[data-test="save-smart"]').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="ssv-root"]').exists()).toBe(true)
  })

  it('defaultName longer than 40 follows the truncation rule (including a sunset keyword hit)', async () => {
    const longQ = 'a'.repeat(45) + ' sunset'
    const { w } = await mountSearch(`/photos/search?q=${encodeURIComponent(longQ)}`)
    await flushPromises()
    await w.get('[data-test="save-smart"]').trigger('click')
    expect((w.get('[data-test="ssv-name-input"]').element as HTMLInputElement).value).toBe(zh.photosSearchSunsets)
  })

  it('a successful save turns the button into "Saved" + disabled', async () => {
    svc.photos.createSmartView.mockResolvedValue({
      id: 'sv-1', name: 'x', description: '', conds: [], threshold: 75, live: true, includeVideos: false,
      count: 0, addedThisWeek: 0, seeds: [], median: 0, storageBytes: 0, distribution: [], evaluatedAt: '',
    })
    const { w } = await mountSearch('/photos/search?q=sunset')
    await flushPromises()
    await w.get('[data-test="save-smart"]').trigger('click')
    await w.get('[data-test="ssv-confirm-btn"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    const btn = w.get('[data-test="save-smart"]')
    expect(btn.attributes('data-saved')).toBe('true')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.text()).toContain(zh.photosSearchSaved)
  })

  it('changing the query term resets "Saved"', async () => {
    svc.photos.createSmartView.mockResolvedValue({
      id: 'sv-1', name: 'x', description: '', conds: [], threshold: 75, live: true, includeVideos: false,
      count: 0, addedThisWeek: 0, seeds: [], median: 0, storageBytes: 0, distribution: [], evaluatedAt: '',
    })
    const { w, router } = await mountSearch('/photos/search?q=sunset')
    await flushPromises()
    await w.get('[data-test="save-smart"]').trigger('click')
    await w.get('[data-test="ssv-confirm-btn"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="save-smart"]').attributes('data-saved')).toBe('true')
    await router.push('/photos/search?q=other')
    await flushPromises()
    expect(w.get('[data-test="save-smart"]').attributes('data-saved')).toBe('false')
  })

  // A successful save previously produced zero user-visible feedback — this guard pins down:
  // the toast is called, the text contains the interpolated name, the action label is the
  // navigation key, and clicking the action triggers router.push to the smart-view list route.
  // Ground truth is Vue2 PhotosSearchView.vue:283-288's `.save-toast` (sparkles + 5 seconds +
  // jump link); New-UI maps it onto the generic useToast's third argument { label, onClick },
  // with `/photos/smart-views` as the destination (a necessary departure from Vue2's
  // `#/photos`, see the onSaved comment).
  // Smart albums have since moved into Albums, so the "open it" link now lands on
  // /photos/albums instead of the (now Moments-only) /photos/smart-views route. The label was
  // initially left as photosSearchOpenSmartViews ("在智能视图中打开") on the theory that only
  // the destination needed to change — that was wrong: a label naming a destination the control
  // doesn't go to is the same defect class as the PhotosSmartViewDetail.vue back button, so the
  // key is renamed to photosSearchOpenInAlbums ("在相册中打开") along with the destination.
  it('a successful save calls the toast (5s, copy includes name, action label is the navigate key); clicking the action navigates to /photos/albums', async () => {
    svc.photos.createSmartView.mockResolvedValue({
      id: 'sv-1', name: 'my trip', description: '', conds: [], threshold: 75, live: true, includeVideos: false,
      count: 0, addedThisWeek: 0, seeds: [], median: 0, storageBytes: 0, distribution: [], evaluatedAt: '',
    })
    const toastSpy = vi.spyOn(useToast(), 'show')
    const { w, router } = await mountSearch('/photos/search?q=sunset')
    await flushPromises()
    await w.get('[data-test="save-smart"]').trigger('click')
    await w.get('[data-test="ssv-name-input"]').setValue('my trip')
    await w.get('[data-test="ssv-confirm-btn"]').trigger('click')
    await flushPromises()

    expect(toastSpy).toHaveBeenCalledTimes(1)
    const [text, duration, arg] = toastSpy.mock.calls[0]!
    // show()'s third argument is now a discriminated union (string = tier / object = action); narrow it back to action via typeof.
    const action = typeof arg === 'string' ? undefined : arg
    expect(text).toBe(zh.photosSearchNameSavedSmartView.replace('{name}', 'my trip'))
    expect(duration).toBe(5000)
    expect(action?.label).toBe(zh.photosSearchOpenInAlbums)

    const pushSpy = vi.spyOn(router, 'push')
    action?.onClick()
    expect(pushSpy).toHaveBeenCalledWith('/photos/albums')
  })
})

// ── Unified overlay handling ─────────────────────────────────────────────
describe('overlays: unified Esc handling', () => {
  it('when the chip popover and the save popover are both open, one Esc closes both (integration, allows the child components\' own Esc fallback to participate)', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-date"] .fchip').trigger('click')
    await w.get('[data-test="save-smart"]').trigger('click')
    expect(w.find('.cal').exists()).toBe(true)
    expect(w.find('[data-test="ssv-root"]').exists()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(w.find('.cal').exists()).toBe(false)
    expect(w.find('[data-test="ssv-root"]').exists()).toBe(false)
  })

  // The integration test above has a fatal blind spot (a delete-the-code verification lesson,
  // confirmed empirically): SearchSaveSmartView registers its own independent document keydown
  // listener (mounted via watch(open), see that component's file header), so a single Escape
  // hits both the host's onDocKeydown and the child's own onDocKeydown — even if the host's
  // onDocKeydown `return`s early after handling the openPop branch and never touches saveOpen,
  // the child itself still calls close() → emit('update:open', false) → the host's v-model
  // linkage sets saveOpen to false as well. In other words, the result "both overlays' DOM
  // closed" is **unfalsifiable** with respect to the hard constraint "the host must not early
  // return" — `{ openPop.value = null; return }` was genuinely deleted once to verify, and the
  // test above stayed fully green (this "guard masked by another guard" finding is recorded
  // here as-is).
  // Here a stand-in component without its own Esc fallback blocks the child's rescue path,
  // making the host\'s own onDocKeydown carry the load alone — the test that genuinely verifies
  // the hard constraint "neither if early-returns".
  it('(isolating the child fallback) the host\'s own onDocKeydown does not early-return on either branch', async () => {
    const router = makeRouter('/photos/search?q=abc')
    await router.isReady()
    const w = mount(PhotosSearch, {
      global: {
        plugins: [i18n, router],
        stubs: {
          // No keydown listener of its own, and never emits update:open — visibility follows
          // the open prop alone, forcing "who sets saveOpen back to false" to be answerable
          // only by the host\'s own onDocKeydown.
          SearchSaveSmartView: { props: ['open'], template: '<div v-if="open" data-test="ssv-root-stub" />' },
        },
      },
    })
    // This test case calls `mount()` directly, not through the `mountSearch()` helper, so it's
    // not covered by the `afterEach` cleanup that iterates `mountedInstances`. An earlier
    // version added a bare `w.unmount()` at the end of the test, but that line came after the
    // assertions — **if any earlier assertion failed and threw, `unmount()` would never run**
    // and the component would linger (precedents like `ClusterActionDialog.test.ts` are
    // naturally immune via `mounted[]` + `afterEach`; there's no corresponding array here).
    // Changed to `try/finally`: the `unmount()` in `finally` runs whether or not an assertion
    // fails.
    try {
      await flushPromises()
      await w.vm.$nextTick()
      await w.get('[data-test="chip-date"] .fchip').trigger('click')
      await w.get('[data-test="save-smart"]').trigger('click')
      expect(w.find('.cal').exists()).toBe(true)
      expect(w.find('[data-test="ssv-root-stub"]').exists()).toBe(true)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await w.vm.$nextTick()
      expect(w.find('.cal').exists()).toBe(false)
      expect(w.find('[data-test="ssv-root-stub"]').exists()).toBe(false)
    } finally {
      w.unmount()
    }
  })

  it('Esc does not trigger "exit search" (negative assertion: router.push/replace is not called)', async () => {
    const { w, router } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const pushSpy = vi.spyOn(router, 'push')
    const replaceSpy = vi.spyOn(router, 'replace')
    await w.get('[data-test="chip-date"] .fchip').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(pushSpy).not.toHaveBeenCalled()
    expect(replaceSpy).not.toHaveBeenCalled()
  })
})

// ── Routing ──────────────────────────────────────────────────────────────
describe('routing', () => {
  it('the ?raw:/photos/search route line comes after /photos/smart-views/:id', () => {
    const iSv = routerRaw.indexOf(`path: '/photos/smart-views/:id'`)
    const iSearch = routerRaw.indexOf(`path: '/photos/search'`)
    expect(iSv).toBeGreaterThan(-1)
    expect(iSearch).toBeGreaterThan(iSv)
  })

  it('resolve("/photos/search") resolves to name photos-search', () => {
    const resolved = appRouter.resolve('/photos/search')
    expect(resolved.name).toBe('photos-search')
  })

  // Clicking PhotosTopbar's back button (Vue2 searchMode's chevL) should navigate back to
  // /photos — not router.back() (a deep link / newly opened tab has no history entry to go back
  // to); onBack()'s established implementation is router.push('/photos').
  it('clicking PhotosTopbar\'s back button calls router.push("/photos")', async () => {
    const { w, router } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const pushSpy = vi.spyOn(router, 'push')
    // Scope the lookup to .topbar — PhotosSidebar has .icon-btn elements of its own (collapse
    // drawer trigger / theme toggle), and a bare `.icon-btn` would select those too.
    const icons = w.findAll('.topbar .icon-btn')
    // The first is the collapse button; the second is the back key rendered when back=true (PhotosTopbar.vue structural spec).
    expect(icons).toHaveLength(2)
    await icons[1]!.trigger('click')
    expect(pushSpy).toHaveBeenCalledWith('/photos')
  })
})

// ── Exact glyph replication for the 8 inline svgs this file introduces ──────
// One further glyph in this file (the search icon, used on the pre-search-state chip) plus the
// topbar PhotosTopbar.vue search icon are asserted in their own components' test files
// (previously PhotosSearchBar.vue asserted the former; that component has been retired, and the
// same assertion now lives in PhotosTopbar.test.ts). Mutating the d values of both the clock and
// map glyphs previously left 49/49 green, so all 9 glyphs (8 in this file + the 1 already
// asserted in PhotosTopbar.test.ts) now each get their own assertion.
describe('glyph exact parity (character-for-character copy from Vue2 PhotosIcon.vue)', () => {
  it('the pre-search-state search chip icon\'s path d', async () => {
    localStorage.setItem('nimo_search_history', JSON.stringify(['a']))
    const { w } = await mountSearch('/photos/search')
    const path = w.get('[data-test="prestate-chip"] svg path')
    expect(path.attributes('d')).toBe('m20 20-3.5-3.5')
  })

  it('the date chip (clock) icon: circle + path d="M12 7v5l3 2"', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const icon = w.get('[data-test="chip-date"] .fchip-icon')
    expect(icon.get('circle').attributes('r')).toBe('9')
    expect(icon.get('path').attributes('d')).toBe('M12 7v5l3 2')
  })

  it('the people chip (person) icon: circle + path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const icon = w.get('[data-test="chip-people"] .fchip-icon')
    expect(icon.get('circle').attributes('r')).toBe('4')
    expect(icon.get('path').attributes('d')).toBe('M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6')
  })

  it('the place chip (map) icon: both path d values match character-for-character', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const icon = w.get('[data-test="chip-place"] .fchip-icon')
    const ds = icon.findAll('path').map((p) => p.attributes('d'))
    expect(ds).toEqual(['M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z', 'M9 4v14M15 6v14'])
  })

  it('the album chip (album) icon: rect + path d="M3 14l5-4 4 3 3-2 6 5"', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const icon = w.get('[data-test="chip-album"] .fchip-icon')
    expect(icon.get('rect').attributes('rx')).toBe('3')
    expect(icon.get('path').attributes('d')).toBe('M3 14l5-4 4 3 3-2 6 5')
  })

  it('the type chip (video) icon: rect + path d="m16 10 5-3v10l-5-3z"', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const icon = w.get('[data-test="chip-type"] .fchip-icon')
    expect(icon.get('rect').attributes('rx')).toBe('2')
    expect(icon.get('path').attributes('d')).toBe('m16 10 5-3v10l-5-3z')
  })

  it('the save-smart unsaved-state (sparkles) icon: both path d and circle are present', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const icon = w.get('[data-test="save-smart"]')
    expect(icon.get('circle').attributes('r')).toBe('3')
    expect(icon.get('path').attributes('d')).toBe(
      'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
    )
  })

  it('the save-smart saved-state (check) icon: path d="m5 12 5 5L20 7"', async () => {
    svc.photos.createSmartView.mockResolvedValue({
      id: 'sv-1', name: 'x', description: '', conds: [], threshold: 75, live: true, includeVideos: false,
      count: 0, addedThisWeek: 0, seeds: [], median: 0, storageBytes: 0, distribution: [], evaluatedAt: '',
    })
    const { w } = await mountSearch('/photos/search?q=sunset')
    await flushPromises()
    await w.get('[data-test="save-smart"]').trigger('click')
    await w.get('[data-test="ssv-confirm-btn"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.get('[data-test="save-smart"] path').attributes('d')).toBe('m5 12 5 5L20 7')
  })
})

// ── Hard constraint: cssCascade hover assertions + non-color property anchoring ──
describe('style: hard hover constraint (cssCascade)', () => {
  it('the winning hover rule for .sort button[data-active="true"] includes :hover and data-active', () => {
    const style = extractStyleBlock(photosSearchRaw)
    expect(style.length).toBeGreaterThan(0)
    const winner = winningHoverBackground(style, ['sort'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('data-active')
  })

  it('the winning hover rule for .save-smart[data-saved="true"] includes :hover and data-saved', () => {
    const style = extractStyleBlock(photosSearchRaw)
    const winner = winningHoverBackground(style, ['save-smart'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('data-saved')
  })

  // Same rollback treatment
  // as PhotosFilterChip.vue/PhotosFilterPopover.vue's own rollback: `.prestate-chip`
  // is genuine Vue2-sourced CSS (Vue2 photos.scss:2781 has this exact hover rule too, not a
  // New-UI additive enhancement like `.sort button`/`.save-smart` above), and
  // vue2-parity/photos.scss already carries it verbatim — the local scoped duplicate (which used
  // to reach for New-UI's global `--accent-text` instead of the correct local `--accent-hi`) is
  // deleted, not re-pointed at the right token, since parity's own copy is already correct.
  it('this component\'s scoped style no longer contains .prestate-chip color rules (fully moved to parity)', () => {
    const style = extractStyleBlock(photosSearchRaw)
    const selectors = parseCssRules(style).flatMap((r) => r.selectors)
    expect(selectors.some((s) => s.includes('prestate-chip'))).toBe(false)
  })

  it('parity scss: the .search-prestate .prestate-chip:hover rule includes :hover', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const winner = winningHoverBackground(parityScss, ['prestate-chip', 'search-prestate'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('prestate-chip')
  })
})

describe('style: non-color visual property anchoring (anchor the rule body first, then assert the property)', () => {
  // `.nimo-orb` (including its two size variants, `.search-prestate .nimo-orb` /
  // `.empty-search .nimo-orb`) and `.empty-search .conditions .fchip` were handed over wholesale
  // to vue2-parity/photos.scss as part of the 2026-08-13 rollback — this component no longer
  // carries these rules itself, so the assertions target the shared parity file instead.
  it('this component\'s scoped style no longer contains .nimo-orb/.empty-search .conditions .fchip rules (fully moved to parity)', () => {
    const style = extractStyleBlock(photosSearchRaw)
    const selectors = parseCssRules(style).flatMap((r) => r.selectors)
    expect(selectors.some((s) => s.includes('nimo-orb'))).toBe(false)
    expect(selectors.some((s) => s === '.empty-search .conditions .fchip')).toBe(false)
  })

  it('parity scss: .search-prestate .nimo-orb / .empty-search .nimo-orb are both 68×68', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rules = parseCssRules(parityScss)
    for (const sel of ['.search-prestate .nimo-orb', '.empty-search .nimo-orb']) {
      const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === sel)
      expect(rule, `未找到规则:${sel}`).toBeDefined()
      expect(rule?.body).toContain('width: 68px')
      expect(rule?.body).toContain('height: 68px')
    }
  })

  it('parity scss: .empty-search .conditions .fchip compact height is 26px', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find(
      (r) => r.selectors.length === 1 && r.selectors[0] === '.empty-search .conditions .fchip',
    )
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('height: 26px')
  })
})
