// SP7-P7a-T16: views/PhotosSearch.vue — search container wiring (route /photos/search).
// Maps one-to-one to the "required test cases" checklist in task-16-brief.md (Step 1).
//
// Test strategy: usePhotosSearch/usePhotosPeople/usePhotosAlbums/usePhotosSmartViews all
// use the real store (spyOn rather than mock, so derived state like matchesQuery/isSearchMode
// is genuinely computed), and only the shared-package service is mocked. useLightbox is a
// module-level singleton, mocked wholesale with the same technique already used in
// PhotosSmartViewDetail.test.ts.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'
import en from '../../i18n/en_us'

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

const lbMock = vi.hoisted(() => ({ openAt: vi.fn() }))
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
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/photos/search', name: 'photos-search', component: PhotosSearch },
      { path: '/photos/smart-views', name: 'photos-smart-views', component: { template: '<div/>' } },
      { path: '/photos/smart-views/:id', name: 'photos-smart-view-detail', component: { template: '<div/>' } },
      // SP15-P2b Task 5: onSaved()'s toast action now lands here instead of smart-views.
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

// fix round 1 · M10 follow-up fix: `attachTo` defaults to "not mounted into the real
// document" — vue-test-utils mounts the component into a detached DOM tree by default, so
// `element.dispatchEvent(new MouseEvent(..., {bubbles: true}))` only bubbles within that
// detached tree and never reaches listeners on the real `document` (regardless of whether
// the child component's `document.addEventListener('mousedown', ...)` logic is correct).
// That's exactly why the earlier M10 ignoreEl test case stayed green even after deleting
// ignoreEl — the assertion wasn't wrong, the event simply never reached the listener. We
// now mount into `document.body` by default.
// fix round 2 · Minor#3 (folded in during review; the cited precedent turned out to be
// wrong and has been corrected): the first draft here said "see the precedent in
// `Photos.lightbox.test.ts`" — grepping that file's full source shows no `attachTo` /
// `document.body` occurrences at all, so the citation was wrong. The real precedents are
// `ClusterActionDialog.test.ts:52` / `PersonHero.test.ts:50` / `PlacesThemeMenu.test.ts:33`
// (all three use `attachTo: document.body` plus a module-level array that records mounted
// instances and cleans them up uniformly in `afterEach`/`beforeEach`).
//
// Once mounted into the real `document.body`, we must explicitly `unmount()` (which fires
// each child component's `onUnmounted` and removes the `document`-level keydown/mousedown
// listeners it registered) — otherwise listeners left over from one test would keep firing
// against an already-"defunct" component instance in later tests, and DOM nodes would keep
// piling up for the whole duration of the file's test run. A module-level array records the
// wrapper + container element for **every mount done via `mountSearch()`** and cleans them
// all up in `afterEach` — note this array only covers mounts that go through that helper;
// this file has one other spot with a bare `mount()` that bypasses `mountSearch()` (the
// "floating layers: unified Esc handling" / "isolate the child component's own fallback"
// test case), which guarantees its own `unmount()` via `try/finally` instead (introduced by
// fix round 2 · Minor#2, changed to try/finally by fix round 3 · #3 so a failing assertion
// doesn't skip cleanup) and is not added to this array.
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
  vi.restoreAllMocks()
  // See the comment above mountSearch: instances mounted into the real document.body must
  // be explicitly unmounted + have their container removed, or document-level listeners and
  // DOM nodes will leak across tests and accumulate for the whole file's run.
  for (const { w, el } of mountedInstances) {
    w.unmount()
    el.remove()
  }
  mountedInstances.length = 0
})

// ── Route query driven (structural spec 7) ──────────────────────────────────
describe('route query driven', () => {
  it('on mount, route.query.q="abc" → smartSearch is called once with "abc"', async () => {
    const search = usePhotosSearch()
    const spy = vi.spyOn(search, 'smartSearch')
    await mountSearch('/photos/search?q=abc')
    expect(spy).toHaveBeenCalledWith('abc')
  })

  it('q changes to "def" → called again, and clearAll takes effect (chip filters cleared)', async () => {
    const search = usePhotosSearch()
    const spy = vi.spyOn(search, 'smartSearch')
    const { w, router } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    // First actually select and submit a filter (type=OCR), then confirm it gets cleared
    // after the query changes — merely opening the popover without Apply doesn't count as
    // "the filter took effect" (the chipActive predicate looks at filters, not openPop).
    await w.get('[data-test="chip-type"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.btn.btn-primary').trigger('click')
    expect(w.get('[data-test="chip-type"] .fchip').attributes('data-on')).toBe('true')
    await router.push('/photos/search?q=def')
    await flushPromises()
    expect(spy).toHaveBeenCalledWith('def')
    expect(w.get('[data-test="chip-type"] .fchip').attributes('data-on')).toBe('false')
  })

  it('q becomes empty → store.clear() is called (store falls back to the unsearched state)', async () => {
    const { router } = await mountSearch('/photos/search?q=abc')
    const search = usePhotosSearch()
    await flushPromises()
    expect(search.isSearchMode).toBe(true)
    await router.push('/photos/search')
    await flushPromises()
    expect(search.isSearchMode).toBe(false)
  })

  it('smartSearch is not passed filters (second arg omitted, always the store default)', async () => {
    const search = usePhotosSearch()
    const spy = vi.spyOn(search, 'smartSearch')
    await mountSearch('/photos/search?q=abc')
    expect(spy.mock.calls[0].length).toBe(1)
  })

  // fix round 1 · M15 (fix round 2 · Minor#4 adds coverage, folded in during review): when
  // `router.replace` targets the same route (path and query both unchanged), vue-router
  // treats it as no navigation, the `query` computed doesn't change, and so the main
  // watcher never re-invokes `smartSearch` — "resubmit the same word to force a refresh"
  // would silently fail. `submitQuery` now has a shortcut: when the target word exactly
  // matches the current route's `q`, skip the router and call `smartSearch` again directly.
  // This test asserts: submitting the same word twice calls `smartSearch` twice (not just
  // once, and definitely not silently swallowed).
  it('resubmitting the same word (M15) → smartSearch is called again, not silently dropped because the route did not change', async () => {
    const search = usePhotosSearch()
    const spy = vi.spyOn(search, 'smartSearch')
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    expect(spy).toHaveBeenCalledTimes(1)
    await w.get('.photos-search-bar input').setValue('abc')
    await w.get('.photos-search-bar input').trigger('keydown.enter')
    await flushPromises()
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenNthCalledWith(2, 'abc')
  })
})

// ── §7e-3: query is a read-only computed, the source must not assign to it ────
describe('§7e-3: do not assign to query', () => {
  it('source does not contain the "query.value =" assignment pattern', () => {
    expect(photosSearchRaw).not.toMatch(/query\.value\s*=(?!=)/)
  })
})

// ── Pre-search state ─────────────────────────────────────────────────────
describe('pre-search state', () => {
  it('q is empty → .search-prestate present, hero absent', async () => {
    const { w } = await mountSearch('/photos/search')
    expect(w.find('.search-prestate').exists()).toBe(true)
    expect(w.find('[data-test="search-hero"]').exists()).toBe(false)
  })

  it('3 history entries → 3 .prestate-chip elements; clicking one → router.replace with that word', async () => {
    localStorage.setItem('nimo_search_history', JSON.stringify(['c', 'b', 'a']))
    const { w, router } = await mountSearch('/photos/search')
    const chips = w.findAll('[data-test="prestate-chip"]')
    expect(chips).toHaveLength(3)
    const replaceSpy = vi.spyOn(router, 'replace')
    await chips[1].trigger('click')
    expect(replaceSpy).toHaveBeenCalledWith({ path: '/photos/search', query: { q: 'b' } })
  })
})

// ── hero ─────────────────────────────────────────────────────────────────
describe('hero', () => {
  it('queryParts takes effect: contains a .kw highlight element', async () => {
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a')])
    const { w } = await mountSearch('/photos/search?q=my%20videos')
    await flushPromises()
    expect(w.find('.search-query .kw').exists()).toBe(true)
  })

  it('searching true → .search-meta absent; false → present, and seconds is (ms/1000).toFixed(2)', async () => {
    let resolveFn: ((v: unknown[]) => void) | undefined
    svc.photos.smartSearch.mockImplementation(() => new Promise((res) => { resolveFn = res }))
    const { w } = await mountSearch('/photos/search?q=abc')
    // Request still in flight: searching is true, search-meta should not exist.
    expect(w.find('[data-test="search-meta"]').exists()).toBe(false)
    resolveFn!([rawAsset('a')])
    await flushPromises()
    await w.vm.$nextTick()
    const meta = w.get('[data-test="search-meta"]')
    const search = usePhotosSearch()
    const expectedSeconds = (search.ms / 1000).toFixed(2)
    expect(meta.text()).toContain(expectedSeconds)
  })

  it('regression guard for defect #13: query "my videos" → the understood <b> text is Chinese "视频", not "Videos"', async () => {
    const { w } = await mountSearch('/photos/search?q=my%20videos')
    const vals = w.findAll('[data-test="understood-v"]').map((n) => n.text())
    expect(vals).toContain(zh.photosSearchTypeVideos)
    expect(vals).not.toContain('Videos')
  })
})

// ── The 5 chips ────────────────────────────────────────────────────────────
describe('chip bar', () => {
  it('5 chips render in the order date/people/place/album/type', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    const wraps = w.findAll('.filterbar > .fchip-wrap')
    expect(wraps).toHaveLength(5)
    expect(w.find('[data-test="chip-date"]').exists()).toBe(true)
    expect(w.find('[data-test="chip-people"]').exists()).toBe(true)
    expect(w.find('[data-test="chip-place"]').exists()).toBe(true)
    expect(w.find('[data-test="chip-album"]').exists()).toBe(true)
    expect(w.find('[data-test="chip-type"]').exists()).toBe(true)
  })

  it('clicking a chip → its popover appears; clicking again → closes', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await w.get('[data-test="chip-date"] .fchip').trigger('click')
    expect(w.find('.cal').exists()).toBe(true) // SearchDatePopover's calendar
    await w.get('[data-test="chip-date"] .fchip').trigger('click')
    expect(w.find('.cal').exists()).toBe(false)
  })

  it('People chip → SearchPeoplePopover face grid appears', async () => {
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

// ── draft semantics ───────────────────────────────────────────────────────────
describe('draft semantics (Apply/Cancel/click outside)', () => {
  it('open place popover → check one item → filteredResults unchanged (not submitted); click Apply → changes', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('a', { placeName: 'Tokyo, Japan' }),
      rawAsset('b', { placeName: 'Osaka, Japan' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    expect(w.findAll('.tile')).toHaveLength(2)

    await w.get('[data-test="chip-place"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click') // check the first place
    expect(w.findAll('.tile')).toHaveLength(2) // not submitted, results unchanged
  })

  it('checking a draft item then clicking Apply → results narrow to 1', async () => {
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

  it('open popover, check an item, click Cancel → filters unchanged', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('a', { placeName: 'Tokyo, Japan' }),
      rawAsset('b', { placeName: 'Osaka, Japan' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-place"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.fpop-quick').trigger('click') // Cancel (the first .fpop-quick is Cancel)
    expect(w.findAll('.tile')).toHaveLength(2)
    expect(w.get('[data-test="chip-place"] .fchip').attributes('data-on')).toBe('false')
  })

  it('clicking outside the popover → also discards (draft not submitted)', async () => {
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
    expect(w.find('.fpop-list').exists()).toBe(false) // popover already closed
    expect(w.findAll('.tile')).toHaveLength(2) // not submitted
  })
})

// ── filteredResults: the five filter kinds + combinations ────────────────────────────────────────
describe('filteredResults', () => {
  it('with no type filter set, all three asset kinds are present (baseline — first confirm the fixture itself is fine)', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('photo1', { mimeType: 'image/jpeg', hasOcr: false }),
      rawAsset('ocr1', { mimeType: 'image/jpeg', hasOcr: true }),
      rawAsset('vid1', { mimeType: 'video/mp4' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    expect(w.findAll('.tile')).toHaveLength(3)
  })

  // fix round 1 · I6 (a real defect found during review, Important): before the rename, the
  // case above was called "each of the three branches filters out the expected count", but it
  // never actually set `filters.type` — it only asserted "with no filter, all 3 are present".
  // Review negated the predicates of all three type branches and 49/49 still stayed green.
  // These three cases add real coverage that actually sets `filters.type` (by selecting the
  // matching item in the type chip's PhotosFilterPopover → Apply); brief Step 1 explicitly
  // requires "one case per filter kind, five in total". The type chip's items are in the fixed
  // order `['Photos','OCR','Videos']` (`TYPE_ITEMS`), and `.fpop-item` renders in that same
  // order, so we select by index.
  it('type=Photos (index 0) → only non-video, non-OCR photos remain', async () => {
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

  it('type=OCR (index 1) → only assets with hasOcr remain', async () => {
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

  it('type=Videos (index 2) → only isVideo assets remain', async () => {
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

  // fix round 1 · M9 (folded in during review, needed to assert the E7 ordering contract):
  // the earlier three fixtures each only had 1 person, so even reversing the sort order
  // wouldn't have been caught. This puts in 2 people with different counts and asserts the
  // face-cell render order is descending by count.
  it('People popover renders in descending order by face count (M9)', async () => {
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
    await w.get('.fpop-quick[data-on]').trigger('click') // click the first quick range (Today, which most likely excludes both dates above, verifying narrowing occurs)
    await w.get('.btn.btn-primary').trigger('click')
    expect(w.findAll('.tile').length).toBeLessThan(2)
  })

  it('place filter + people filter both take effect (combined)', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [{ id: 1, name: 'Sara', count: 3 }], facesIndexedUpTo: null })
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('a', { placeName: 'Tokyo, Japan', faces: ['Sara'] }),
      rawAsset('b', { placeName: 'Tokyo, Japan', faces: ['Bob'] }),
      rawAsset('c', { placeName: 'Osaka, Japan', faces: ['Sara'] }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-place"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click') // select Tokyo (ranked first, highest frequency)
    await w.get('.btn.btn-primary').trigger('click')
    await w.get('[data-test="chip-people"] .fchip').trigger('click')
    await w.get('.face-cell').trigger('click')
    await w.get('[data-test="people-apply-btn"]').trigger('click')
    expect(w.findAll('.tile')).toHaveLength(1) // only a satisfies both Tokyo + Sara
  })
})

// ── filters.album ──────────────────────────────────────────────────────
describe('filters.album', () => {
  it('selecting an album → fetchAlbumAssets is called, results narrow to the album assets', async () => {
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

  // fix round 2 · Important#1 (a new regression found during review, introduced by fix
  // round 1): at the moment Apply is clicked for a selected album, the `getAlbum` request
  // has usually not landed yet — that's the normal path for "filter by album for the first
  // time", not an extreme timing edge case. The earlier computed design used the return
  // value of `assetsOf(id)` to decide "should we filter", but "the cache slot doesn't exist
  // yet" and "the cache slot exists and its content happens to be an empty array" look
  // identical through `assetsOf`'s return value (both are `[]`), so during the in-flight
  // window `albumAssetIds` was misjudged as an empty Set, `filteredResults` instantly
  // dropped to zero, and the whole `.empty-search` block (orb + "no matches" + condition
  // chips) flashed on screen until the request actually landed — this test asserts "that
  // should not happen during the in-flight window" (per Vue2 `:593-602`'s behavior: don't
  // filter while in flight, rather than filtering down to an empty set).
  it('the album-filter in-flight window (getAlbum not yet resolved) must not collapse results to empty / flash the empty state', async () => {
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
    // Request still in flight (resolveGet hasn't been called yet) — should not drop to zero, and should not show the empty state.
    expect(w.find('[data-test="empty-search"]').exists()).toBe(false)
    expect(w.findAll('.tile')).toHaveLength(2)
    // Only now does the request actually land, and results should narrow precisely.
    resolveGet!({ assets: [{ id: 'a', originalName: 'a.jpg', mimeType: 'image/jpeg' }] })
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.findAll('.tile')).toHaveLength(1)
  })

  // fix round 3 · #1 (a zero-coverage gap found during review — a real guard rail missing
  // at the level of an actual functional defect): the predicate "the cache slot doesn't exist
  // (in)" vs. "the cache slot has landed but its content is an empty array (.length===0)"
  // previously only had the in-flight test above (asserting the "not yet landed" half) —
  // **no test asserted the other half, "has landed and this album genuinely has no
  // photos"**. Swapping the computed's `in` predicate for `assetsOf(id).length===0` still
  // left the same batch of 72 tests all green, because none of them ever reached the
  // specific state of "the album genuinely exists, the request has genuinely landed, and
  // the returned asset list happens to be an empty array." This adds that case, and also
  // asserts `getAlbum` really was called (ruling out the false positive of "the request was
  // never even sent, and it happens to look like an empty array").
  it('album genuinely exists but has no assets (request landed) → results are empty + empty state appears (not an in-flight misjudgment)', async () => {
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
    expect(svc.photos.getAlbum).toHaveBeenCalledWith(9) // a request really was made, not just never called
    expect(w.findAll('.tile')).toHaveLength(0)
    expect(w.find('[data-test="empty-search"]').exists()).toBe(true)
  })

  // fix round 1 · I7 (a real defect found during review, Important): the previous version
  // of this test's name claimed to cover the "id not found" branch, but its comment admitted
  // it "was changed to directly assert that albumAssetIds is always null when no album is
  // selected" — which actually asserts "no filtering" (both 2 remain), the exact opposite of
  // what the brief requires ("results are empty").
  //
  // This properly exercises that branch: first select an album normally, Apply, and confirm
  // narrowing by album assets works (1 remains); then simulate "the album got deleted
  // elsewhere" (the store's `albums.albums` list is cleared, while the `filters.album` name
  // itself is unchanged) — I2's redesign makes `albumAssetIds` a computed that reads
  // `albums.albums` directly, so as soon as `albums.albums` changes, with no extra trigger
  // needed, the computed automatically re-evaluates: this name can no longer be found in
  // `albums.albums`, so it should degrade to an empty set, not to "can't find it, so don't
  // filter."
  it('album name not found in the list → results are empty (not "no filtering")', async () => {
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
    expect(w.findAll('.tile')).toHaveLength(1) // first confirm normal narrowing works, so this isn't vacuously true
    const albums = usePhotosAlbums()
    albums.albums = [] // simulate the album being deleted elsewhere: this name can no longer be found in filters.album
    await w.vm.$nextTick()
    expect(w.findAll('.tile')).toHaveLength(0) // id not found ⇒ empty set, not degraded to "no filtering"
  })

  // fix round 1 · I2 (a real defect found during review, Important): fully reproduces the
  // failing sequence given in review —
  // select album A → Apply (request for A in flight, not resolved) → reopen the popover,
  // deselect A → Apply (albumAssetIds should become null) → select A again → Apply. The old
  // implementation (`fetchAlbumAssets(id).then(...)` writing a snapshot + an `albumSeq`
  // counter) breaks here: `albums.ts:81`'s `isLoadingAssets(id)` short-circuit makes the
  // second call for A resolve immediately with no data; inside `.then()`, `mine===albumSeq`
  // holds (it is the latest legitimate call) but `assetsOf(A)` is still empty at this
  // point ⇒ `albumAssetIds` gets written as an empty Set, permanently zeroed, and nobody
  // reads it again even once the first real request eventually lands.
  // After the redesign (`albumAssetIds` is a computed that reads
  // `albums.assetsOf(currently selected album id)` directly): no matter how many
  // short-circuited, dataless `fetchAlbumAssets` calls happen in between, as long as "the
  // first genuinely in-flight request" eventually writes its data into
  // `albums.albumAssetsByID`, this computed will pick it up automatically the next time it
  // evaluates — here we let A's first request resolve last and assert the final result is
  // correct, not permanently empty.
  it('re-entrant race on the same album (select A while in flight → deselect → select A again) must not permanently empty the results', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 1, name: 'A' }])
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a'), rawAsset('b')])
    let resolveFirst: ((v: unknown) => void) | undefined
    const firstCall = new Promise((res) => { resolveFirst = res })
    let callCount = 0
    svc.photos.getAlbum.mockImplementation(() => {
      callCount += 1
      if (callCount === 1) return firstCall // first call: hangs, simulating "request in flight"
      // No call after this (including ones short-circuited by albums.ts's isLoadingAssets)
      // should ever be relied on — in the real implementation, the second explicit call gets
      // short-circuited by the store itself; here we return a "wrong answer" (empty array) to
      // make sure that if the implementation regresses to the old "rely on the promise to
      // write a snapshot" approach, the test would read this wrong answer instead of the real
      // data eventually delivered by resolveFirst.
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
    await w.get('.fpop-item').trigger('click') // click it again = deselect
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises()
    // Select A again → Apply (the first request still hasn't resolved; this call gets short-circuited by the store itself).
    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises()
    // Only now does the first, genuine request arrive, carrying real data.
    resolveFirst!({ assets: [{ id: 'a', originalName: 'a.jpg', mimeType: 'image/jpeg' }] })
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.findAll('.tile')).toHaveLength(1) // not permanently empty
  })

  it('sequence guard when quickly switching between two albums: an old (slow) response does not overwrite a newer (fast) one', async () => {
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
    await w.get('.fpop-item').trigger('click') // select A (id 1, slow response, not yet resolved)
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises()
    // Before switching to B (id 2, fast response), reopen the popover first.
    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    // Deselect A, select B.
    const items = w.findAll('.fpop-item')
    await items[0].trigger('click') // deselect A
    await items[1].trigger('click') // select B
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises() // B (fast response) lands first
    // A's slow response now finally arrives — it should not overwrite B's already-landed result.
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
  it('query contains a named person → people chip gets preselected', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [{ id: 1, name: 'Sara', count: 3 }], facesIndexedUpTo: null })
    const { w } = await mountSearch('/photos/search?q=Sara%20trip')
    await flushPromises()
    expect(w.get('[data-test="chip-people"] .fchip').attributes('data-on')).toBe('true')
  })

  it('contains "last week" and date is empty → date gets prefilled', async () => {
    const { w } = await mountSearch('/photos/search?q=last%20week')
    await flushPromises()
    expect(w.get('[data-test="chip-date"] .fchip').attributes('data-on')).toBe('true')
  })

  it('date already has a user selection → applyUnderstood does not overwrite it', async () => {
    // query contains "last week" ⇒ on mount applyUnderstood auto-fills date=last7.
    const { w } = await mountSearch('/photos/search?q=last%20week')
    await flushPromises()
    expect(w.get('[data-test="chip-date"] .fchip').attributes('data-on')).toBe('true')
    // User manually changes the date to "Today" (different from the auto-filled last7), overriding the auto-fill.
    await w.get('[data-test="chip-date"] .fchip').trigger('click')
    const quickBtns = w.findAll('.fpop-row .fpop-quick')
    await quickBtns[0].trigger('click') // QUICK_KEYS[0] === 'today'
    await w.get('.btn.btn-primary').trigger('click')
    const labelAfterManualPick = w.get('[data-test="chip-date"] .fchip').text()
    expect(labelAfterManualPick).toBe(zh.photosSearchToday)
    // Trigger applyUnderstood to re-run (peopleLoaded false→true); the "don't overwrite an
    // existing date" branch should block understood's last7 prefill and keep the user's
    // manual "Today" pick from being reverted.
    const people = usePhotosPeople()
    people.peopleLoaded = false
    await w.vm.$nextTick()
    people.peopleLoaded = true
    await w.vm.$nextTick()
    expect(w.get('[data-test="chip-date"] .fchip').text()).toBe(labelAfterManualPick)
  })

  it('peopleLoaded flips from false to true → applyUnderstood re-runs once', async () => {
    const { w } = await mountSearch('/photos/search?q=Sara')
    await flushPromises()
    expect(w.get('[data-test="chip-people"] .fchip').attributes('data-on')).toBe('false')
    const people = usePhotosPeople()
    // onMounted's fetchPeople() (a real store method) has already pushed peopleLoaded from
    // false to true by the time flushPromises runs (even when listPersons resolves an empty
    // list) — so we flip it back to false first, in order to create a genuine false→true
    // transition that actually triggers the watch(peopleLoaded) re-run logic, rather than
    // hitting the false positive of "true→true doesn't trigger the watcher."
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

// ── Sorting ─────────────────────────────────────────────────────────────────
describe('sorting', () => {
  it('under relevance, descending by score; switching to newest/oldest → order changes', async () => {
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

  it('under relevance, when belowCut takes effect "more" is non-empty (two tiers); switching to newest → "more" is empty', async () => {
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

// ── Result-count thousands separator follows locale (fix wave F2) ────────────────────────────────────
// Final-review must-fix: `filteredResults.length.toLocaleString()` was the only bare call in
// the whole batch (the other 5 call sites all passed a locale). This repo's locale
// identifiers are `zh_cn`/`en_us` (underscore, not valid BCP-47), and passing one bare to
// toLocaleString throws a RangeError (consistent with the `PhotosSearch.vue` localeTag
// comment and the existing precedent stated in `SmartViewCard.vue:37`/
// `SearchPeoplePopover.vue:62` — fix wave follow-up · N1 correction: this comment previously
// mistakenly said "does not throw", contradicting the production-code comment added in the
// same commit; confirmed via a real node run of `(1234).toLocaleString('zh_cn')` that it
// really does throw `RangeError: Incorrect locale information provided`, and the wording has
// been made consistent). This also verifies: (1) the element renders without throwing (the
// mount uses the zh_cn i18n instance, and the call site has been changed to
// `toLocaleString(localeTag)`, where `localeTag` is the valid value after conversion to
// `zh-cn`); (2) the source text is a call with the localeTag identifier, not a bare call.
describe('result-count thousands separator follows locale (F2)', () => {
  it('results-count renders the thousands-separated number without throwing RangeError (zh_cn locale)', async () => {
    svc.photos.smartSearch.mockResolvedValue(
      Array.from({ length: 1234 }, (_, i) => rawAsset(`p${i}`)),
    )
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    expect(w.get('[data-test="results-count"]').text()).toContain((1234).toLocaleString('zh-cn'))
  })

  // Source-text guard: following the pattern already tightened in
  // SearchPeoplePopover.test.ts:135 — the old regex `/toLocaleString\(\s*\S+/` would even
  // match a bare call `toLocaleString()` (`)` itself is a `\S`), giving it no discriminating
  // power; this one requires the captured group to actually be the `localeTag` identifier.
  it('the source text\'s toLocaleString(localeTag) call passes a real identifier argument, not a bare call', () => {
    expect(photosSearchRaw).toMatch(/toLocaleString\(\s*localeTag\s*\)/)
  })
})

// ── Empty state ─────────────────────────────────────────────────────────────
describe('empty state', () => {
  it('filteredResults is empty + searching is false → .empty-search present, lists activeConditions', async () => {
    svc.photos.smartSearch.mockResolvedValue([])
    const { w } = await mountSearch('/photos/search?q=nothing')
    await flushPromises()
    expect(w.find('[data-test="empty-search"]').exists()).toBe(true)
  })

  it('when searching is true, .empty-search is absent', async () => {
    let resolveFn: ((v: unknown[]) => void) | undefined
    svc.photos.smartSearch.mockImplementation(() => new Promise((res) => { resolveFn = res }))
    const { w } = await mountSearch('/photos/search?q=abc')
    expect(w.find('[data-test="empty-search"]').exists()).toBe(false)
    resolveFn!([])
  })

  it('D1 negative assertion: the Ask Nimo button is not present in the empty state', async () => {
    svc.photos.smartSearch.mockResolvedValue([])
    const { w } = await mountSearch('/photos/search?q=nothing')
    await flushPromises()
    expect(w.text()).not.toContain(zh.photosSearchAskNimoSearchDifferently)
  })
})

// ── load-more ────────────────────────────────────────────────────────────
describe('load-more', () => {
  it('@load-more → store.loadMore() is called', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('best', { matchScore: 0.9, belowCut: false }),
      rawAsset('tail', { matchScore: 0.3, belowCut: true }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const search = usePhotosSearch()
    const spy = vi.spyOn(search, 'loadMore').mockResolvedValue(undefined)
    await w.get('.more-results-bar').trigger('click') // expand more
    // The sentinel is driven by IntersectionObserver, and jsdom can't test real scrolling —
    // instead call the load-more event path the component exposes directly:
    // PhotosSearchGrid forwards an IO hit as emit('load-more'); here we find the
    // PhotosSearchGrid instance directly and emit it, verifying the host wires it to
    // store.loadMore().
    const grid = w.findComponent({ name: 'PhotosSearchGrid' })
    grid.vm.$emit('load-more')
    await w.vm.$nextTick()
    expect(spy).toHaveBeenCalled()
  })
})

// ── @open → openAt's fourth arg is query (the main guard for OCR activation) ───────────────────────
describe('@open → lightbox OCR activation', () => {
  it('openAt\'s fourth arg is the current query; the second arg is the photo array mapped from sortedResults', async () => {
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

  // fix round 1 · M11 (folded in during review): the case above only asserts membership via
  // arrayContaining, not order — quietly swapping openAt's second arg from sortedResults to
  // filteredResults (unsorted) wouldn't be caught, even though brief structural spec 15
  // specifically calls out "the paging set is sortedResults, not filteredResults" as a
  // distinction. This uses two results with different scores (under relevance sort, high
  // should come first) and asserts the exact id order.
  it('the second arg strictly follows sortedResults order (relevance, descending by score), not filteredResults\' original order', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('low', { matchScore: 0.2 }), // first in the original order, but a low score
      rawAsset('high', { matchScore: 0.9 }), // second in the original order, but a high score
    ])
    const { w } = await mountSearch('/photos/search?q=receipt')
    await flushPromises()
    // Click the tile that renders second by score (already sorted, tiles[0] is high).
    await w.findAll('.tile')[0].trigger('click')
    const args = lbMock.openAt.mock.calls[0]
    expect((args[1] as Array<{ id: string }>).map((p) => p.id)).toEqual(['high', 'low'])
  })
})

// ── Search history ───────────────────────────────────────────────────────────
describe('search history', () => {
  // fix round 1 · I1 (a real defect found during review, Important): both `Photos.vue`'s top
  // search bar and `PhotosSmartViewDetail.vue`'s "refine within search" only call
  // `router.push`, without writing to history — previously only `PhotosSearch.vue`'s own
  // `PhotosSearchBar` submit path wrote to it. Fix: move the history write into the main
  // query watcher (record it upon arrival), which naturally covers any entry point that
  // brings the route here with a non-empty `q`, not just "this page's own search bar
  // submission". This test mounts directly at an address that already carries `q` (simulating
  // a push from Photos.vue or PhotosSmartViewDetail.vue, or even a deep link / browser
  // back-forward arrival) and asserts the history does record this word — exactly the broken
  // path review had found.
  it('address bar already carries q on mount (simulating a push from Photos.vue/a refine entry point, or a deep link) → the word is in history', async () => {
    await mountSearch('/photos/search?q=sunset')
    expect(JSON.parse(localStorage.getItem('nimo_search_history')!)).toEqual(['sunset'])
  })

  // fix round 1 · I1 side effect: after moving the history write into the query watcher, its
  // timing now follows the completion of `router.replace()`'s (async) navigation, no longer
  // in the same synchronous call stack as `submitQuery()` — after triggering Enter, an extra
  // `flushPromises()` wait is needed before the write shows up (production behavior is
  // unchanged, the test just needs to add the wait).
  it('onSubmit("abc") → localStorage is ["abc"]; then "def" → ["def","abc"]', async () => {
    const { w } = await mountSearch('/photos/search')
    await w.get('.photos-search-bar input').setValue('abc')
    await w.get('.photos-search-bar input').trigger('keydown.enter')
    await flushPromises()
    expect(JSON.parse(localStorage.getItem('nimo_search_history')!)).toEqual(['abc'])
    await w.get('.photos-search-bar input').setValue('def')
    await w.get('.photos-search-bar input').trigger('keydown.enter')
    await flushPromises()
    expect(JSON.parse(localStorage.getItem('nimo_search_history')!)).toEqual(['def', 'abc'])
  })

  it('repeating "abc" → deduped and moved to the front: ["abc","def"]', async () => {
    localStorage.setItem('nimo_search_history', JSON.stringify(['def', 'abc']))
    const { w } = await mountSearch('/photos/search')
    await w.get('.photos-search-bar input').setValue('abc')
    await w.get('.photos-search-bar input').trigger('keydown.enter')
    await flushPromises()
    expect(JSON.parse(localStorage.getItem('nimo_search_history')!)).toEqual(['abc', 'def'])
  })

  it('more than 6 entries → only keeps 6', async () => {
    localStorage.setItem('nimo_search_history', JSON.stringify(['1', '2', '3', '4', '5', '6']))
    const { w } = await mountSearch('/photos/search')
    await w.get('.photos-search-bar input').setValue('7')
    await w.get('.photos-search-bar input').trigger('keydown.enter')
    await flushPromises()
    const stored = JSON.parse(localStorage.getItem('nimo_search_history')!)
    expect(stored).toHaveLength(6)
    expect(stored[0]).toBe('7')
  })

  it('localStorage throws (mock setItem to throw) → does not crash', async () => {
    const { w } = await mountSearch('/photos/search')
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    await expect(
      w.get('.photos-search-bar input').setValue('boom').then(() =>
        w.get('.photos-search-bar input').trigger('keydown.enter')),
    ).resolves.not.toThrow()
    spy.mockRestore()
  })
})

// ── Save popover ─────────────────────────────────────────────────────────────
describe('save as smart view', () => {
  it('clicking "Save as smart view" → popover opens; when defaultName is shorter than 40 it is the query itself', async () => {
    const { w } = await mountSearch('/photos/search?q=sunset')
    await flushPromises()
    await w.get('[data-test="save-smart"]').trigger('click')
    expect(w.find('[data-test="ssv-root"]').exists()).toBe(true)
    expect((w.get('[data-test="ssv-name-input"]').element as HTMLInputElement).value).toBe('sunset')
  })

  // fix round 1 · M10 (folded in during review): `:ignore-el="saveBtnRef"` previously had no
  // assertion at all — deleting it left 49/49 still green. This dispatches a bare mousedown
  // directly on the trigger button (bypassing the @click openSave logic) to verify that
  // SearchSaveSmartView's own onDocMousedown recognizes "the click landed on ignoreEl" and
  // does not close — if ignoreEl were wired up wrong, this mousedown would be judged an
  // "outside click" and mistakenly close the popover.
  it('the save-smart trigger button is passed in as ignoreEl: mousedown on the button does not mistakenly close the popover', async () => {
    const { w } = await mountSearch('/photos/search?q=sunset')
    await flushPromises()
    await w.get('[data-test="save-smart"]').trigger('click')
    expect(w.find('[data-test="ssv-root"]').exists()).toBe(true)
    w.get('[data-test="save-smart"]').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="ssv-root"]').exists()).toBe(true)
  })

  it('when defaultName is longer than 40, it follows the concatenation rule (matches the sunset keyword)', async () => {
    const longQ = 'a'.repeat(45) + ' sunset'
    const { w } = await mountSearch(`/photos/search?q=${encodeURIComponent(longQ)}`)
    await flushPromises()
    await w.get('[data-test="save-smart"]').trigger('click')
    expect((w.get('[data-test="ssv-name-input"]').element as HTMLInputElement).value).toBe(zh.photosSearchSunsets)
  })

  it('save succeeds → button changes to "Saved" + disabled', async () => {
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

  it('regression guard for defect #14: changing the query word resets "Saved"', async () => {
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

  // fix wave F1 (final-review must-fix): saving previously gave zero user-visible feedback —
  // this guard pins down that the toast is called, the copy contains the interpolated name,
  // the action label is a translation key, and clicking the action triggers a router.push to
  // the smart-views list route. The real behavior is Vue2 PhotosSearchView.vue:283-288's
  // `.save-toast` (sparkles + 5 seconds + a jump link); New-UI maps it onto the generic
  // useToast's third arg { label, onClick }, with the jump target being
  // `/photos/smart-views` (a necessary deviation from Vue2's `#/photos`, see the onSaved
  // comment).
  // SP15-P2b Task 5 (fix round 2): smart albums moved into Albums (Tasks 3/4), so the
  // "open it" link now lands on /photos/albums instead of the (now Moments-only)
  // /photos/smart-views route. Round 1 left the label as photosSearchOpenSmartViews
  // ("在智能视图中打开") on the theory that only the destination needed to change — that
  // was wrong: a label naming a destination the control doesn't go to is the same defect
  // class as the PhotosSmartViewDetail.vue back button in this task, so the key is renamed
  // to photosSearchOpenInAlbums ("在相册中打开") along with the destination.
  it('save succeeds → toast is called (5s, copy contains name, action label is a translation key); clicking action navigates to /photos/albums', async () => {
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
    // SP8-P6-T3 merge: show()'s third arg is now a discriminated union (string = tier / object = action); narrow back to action by typeof.
    const action = typeof arg === 'string' ? undefined : arg
    expect(text).toBe(zh.photosSearchNameSavedSmartView.replace('{name}', 'my trip'))
    expect(duration).toBe(5000)
    expect(action?.label).toBe(zh.photosSearchOpenInAlbums)

    const pushSpy = vi.spyOn(router, 'push')
    action?.onClick()
    expect(pushSpy).toHaveBeenCalledWith('/photos/albums')
  })
})

// ── Unified floating-layer handling ───────────────────────────────────────────
describe('floating layers: unified Esc handling', () => {
  it('when a chip popover and the save popover are both open, one Esc closes both (integration test, allowing the child component\'s own Esc fallback to participate)', async () => {
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

  // The integration case above has a fatal blind spot (a lesson from deletion-verification
  // checklist item 8, confirmed by an actual test run): SearchSaveSmartView also registers
  // its own independent document keydown listener (mounted via watch(open), see the top of
  // that component's file). A single Escape hits both the host's onDocKeydown and the child
  // component's own onDocKeydown at the same time — even if the host's onDocKeydown handles
  // the openPop branch and then `return`s early without ever touching saveOpen, the child
  // component itself will still call close() → emit('update:open', false) → the host's
  // v-model binding sets saveOpen to false too. In other words, the outcome "both floating
  // layers' DOM got closed" is **unfalsifiable** as evidence for "did the host violate the
  // no-early-return constraint" — we actually deleted `{ openPop.value = null; return }` once
  // to verify this, and the case above stayed fully green (this file and the task report
  // both honestly record this "guard masked by another guard" finding).
  // This uses a stand-in component with no Esc fallback of its own to shut off the child
  // component's rescue path, putting all the pressure on the host's own onDocKeydown — this
  // is the case that actually verifies the hard constraint "neither if branch early-returns."
  it('(after isolating the child component\'s own fallback) neither branch of the host\'s own onDocKeydown early-returns', async () => {
    const router = makeRouter('/photos/search?q=abc')
    await router.isReady()
    const w = mount(PhotosSearch, {
      global: {
        plugins: [i18n, router],
        stubs: {
          // No keydown listener of its own, and doesn't emit update:open — purely shows/hides
          // based on the open prop, forcing "whoever sets saveOpen back to false" to be the
          // host's own onDocKeydown, and nothing else.
          SearchSaveSmartView: { props: ['open'], template: '<div v-if="open" data-test="ssv-root-stub" />' },
        },
      },
    })
    // fix round 2 · Minor#2 (folded in during review, closes a contract gap) + fix round 3 ·
    // #3 (folded in during review, robustness cleanup): this case mounts directly via
    // `mount()`, bypassing the `mountSearch()` helper, so it is not covered by the cleanup
    // logic in `afterEach` that walks `mountedInstances`. Fix round 2 once added a bare
    // `w.unmount()` line at the end of the case, but that line came after the assertions —
    // **if any earlier assertion fails and throws first, `unmount()` never runs at all**, and
    // the component would leak (precedents like `ClusterActionDialog.test.ts` are naturally
    // immune to this via `mounted[]` + `afterEach`, but there's no such array here). Changed
    // to `try/finally`: the `unmount()` in `finally` runs regardless of whether an assertion
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

  it('Esc does not trigger "exit search" (negative assertion: router.push/replace not called)', async () => {
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

// ── Routing ─────────────────────────────────────────────────────────────────
describe('routing', () => {
  it('in ?raw, the /photos/search line comes after /photos/smart-views/:id', () => {
    const iSv = routerRaw.indexOf(`path: '/photos/smart-views/:id'`)
    const iSearch = routerRaw.indexOf(`path: '/photos/search'`)
    expect(iSv).toBeGreaterThan(-1)
    expect(iSearch).toBeGreaterThan(iSv)
  })

  it('resolve("/photos/search")\'s name is photos-search', () => {
    const resolved = appRouter.resolve('/photos/search')
    expect(resolved.name).toBe('photos-search')
  })
})

// ── fix round 1 · I4: exact glyph reproduction for the 8 inline SVGs added in this file ──────────────────
// This file has one other icon (the search icon used in the pre-search-state chip) +
// PhotosSearchBar.vue's search icon, already asserted in their own component test files.
// Review broke the d values of both the clock and the map icons at the same time → the
// previous round still stayed 49/49 green, so this round adds assertions one by one for all
// 9 icons (8 in this file + the 1 already asserted in PhotosSearchBar.test.ts).
describe('exact glyph reproduction (copied character-for-character from Vue2 PhotosIcon.vue)', () => {
  it('the pre-search-state search chip icon\'s path d', async () => {
    localStorage.setItem('nimo_search_history', JSON.stringify(['a']))
    const { w } = await mountSearch('/photos/search')
    const path = w.get('[data-test="prestate-chip"] svg path')
    expect(path.attributes('d')).toBe('m20 20-3.5-3.5')
  })

  it('date chip (clock) icon: circle + path d="M12 7v5l3 2"', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const icon = w.get('[data-test="chip-date"] .fchip-icon')
    expect(icon.get('circle').attributes('r')).toBe('9')
    expect(icon.get('path').attributes('d')).toBe('M12 7v5l3 2')
  })

  it('people chip (person) icon: circle + path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const icon = w.get('[data-test="chip-people"] .fchip-icon')
    expect(icon.get('circle').attributes('r')).toBe('4')
    expect(icon.get('path').attributes('d')).toBe('M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6')
  })

  it('place chip (map) icon: both path d values match character-for-character', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const icon = w.get('[data-test="chip-place"] .fchip-icon')
    const ds = icon.findAll('path').map((p) => p.attributes('d'))
    expect(ds).toEqual(['M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z', 'M9 4v14M15 6v14'])
  })

  it('album chip (album) icon: rect + path d="M3 14l5-4 4 3 3-2 6 5"', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const icon = w.get('[data-test="chip-album"] .fchip-icon')
    expect(icon.get('rect').attributes('rx')).toBe('3')
    expect(icon.get('path').attributes('d')).toBe('M3 14l5-4 4 3 3-2 6 5')
  })

  it('type chip (video) icon: rect + path d="m16 10 5-3v10l-5-3z"', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const icon = w.get('[data-test="chip-type"] .fchip-icon')
    expect(icon.get('rect').attributes('rx')).toBe('2')
    expect(icon.get('path').attributes('d')).toBe('m16 10 5-3v10l-5-3z')
  })

  it('save-smart unsaved-state (sparkles) icon: both path d and circle are present', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const icon = w.get('[data-test="save-smart"]')
    expect(icon.get('circle').attributes('r')).toBe('3')
    expect(icon.get('path').attributes('d')).toBe(
      'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
    )
  })

  it('save-smart saved-state (check) icon: path d="m5 12 5 5L20 7"', async () => {
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

// ── fix round 1 · I5 (a plan hard constraint, folded in during review): cssCascade hover assertions + non-color property anchoring ──
describe('styling: hover hard constraint (cssCascade)', () => {
  it('.sort button[data-active="true"]\'s winning hover rule contains :hover and data-active', () => {
    const style = extractStyleBlock(photosSearchRaw)
    expect(style.length).toBeGreaterThan(0)
    const winner = winningHoverBackground(style, ['sort'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('data-active')
  })

  it('.save-smart[data-saved="true"]\'s winning hover rule contains :hover and data-saved', () => {
    const style = extractStyleBlock(photosSearchRaw)
    const winner = winningHoverBackground(style, ['save-smart'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('data-saved')
  })

  it('.prestate-chip has a :hover rule (a minimal compliance check from cssCascade\'s perspective)', () => {
    const style = extractStyleBlock(photosSearchRaw)
    // .prestate-chip is the descendant selector `.search-prestate .prestate-chip`, so both
    // classes need to be fed to the matcher (cssCascade.ts's matching is "every class that
    // appears in the selector must be in the allowed set", not a structural descendant-
    // relationship check).
    const winner = winningHoverBackground(style, ['prestate-chip', 'search-prestate'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('prestate-chip')
  })
})

describe('styling: non-color visual property anchoring (anchor the rule body first, then assert the property)', () => {
  it('.search-prestate .nimo-orb / .empty-search .nimo-orb are both 68×68', () => {
    const style = extractStyleBlock(photosSearchRaw)
    const rules = parseCssRules(style)
    for (const sel of ['.search-prestate .nimo-orb', '.empty-search .nimo-orb']) {
      const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === sel)
      expect(rule, `rule not found: ${sel}`).toBeDefined()
      expect(rule?.body).toContain('width: 68px')
      expect(rule?.body).toContain('height: 68px')
    }
  })

  it('.empty-search .conditions .fchip\'s compact height is 26px', () => {
    const style = extractStyleBlock(photosSearchRaw)
    const rule = parseCssRules(style).find(
      (r) => r.selectors.length === 1 && r.selectors[0] === '.empty-search .conditions .fchip',
    )
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('height: 26px')
  })
})
