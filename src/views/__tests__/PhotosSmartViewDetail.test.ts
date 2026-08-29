// PhotosSmartViewDetail.vue -- smart view detail page shell (byId data source +
// header + three menus + delete confirmation + export 401 fix + two-section grid). Maps
// item by item to the "required cases" checklist.
//
// Test strategy: the store (usePhotosSmartViews) uses its real implementation; only the
// shared-package service is mocked -- byId's "the view automatically follows once the store
// changes" is §7e-2's main guard for this cycle's core fix, and it only means anything if it
// goes through the real store. useLightbox is a module-level singleton (same technique as
// PhotosAlbumDetail.test.ts's existing approach); here we spy out the openAt method itself
// (mockImplementation as an empty function), asserting only the call arguments, without
// pulling the real hydrate chain in (that would need extra mocks for
// getAsset/getAssetOcr/favorites, which is out of scope for this task).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import { ref, computed } from 'vue'
import zh from '../../i18n/zh_cn'
import en from '../../i18n/en_us'

const svc = vi.hoisted(() => ({
  photos: {
    listSmartViews: vi.fn(),
    getSmartViewAssets: vi.fn(),
    getSmartViewActivity: vi.fn(),
    updateSmartView: vi.fn(),
    deleteSmartView: vi.fn(),
    createSmartView: vi.fn(), // the underlying call restoreSmartView makes
    duplicateSmartView: vi.fn(),
    exportSmartViewAlbum: vi.fn(),
    exportSmartViewUrl: vi.fn((id: string | number, format: string) => `/v1/photos/smart-views/${id}/export?format=${format}&token=tok`),
    thumbnailUrl: vi.fn((id: string | number, size = 'large') => `mock://thumb/${id}/${size}`),
    // Fix-12: PhotoLightbox.vue's own render needs these once it actually mounts (v-if opens).
    originalUrl: vi.fn((id: string | number) => `mock://original/${id}`),
    liveUrl: vi.fn((id: string | number) => `mock://live/${id}`),
    // Fix-1 item 1: the topbar's title/sub here mirrors PhotosAlbums.vue's own (this page nests
    // under Vue2's 'albums' nav, see the describe block below) -- the sub needs the full album
    // list, which this page did not otherwise fetch before this fix.
    listAlbums: vi.fn().mockResolvedValue([]),
    // Task 7, folded-in finding (d): the page's own onMounted/route watcher calls
    // store.loadExcluded, which hits this endpoint. `loadExcluded` catches and leaves
    // `excluded` empty (smartViews.ts:534-547) -- exactly the end state a `[]` mock produces --
    // so this carries none of getConfig's coupling risk (see the comment on that one below) and
    // was simply missing. Adding it removes 77 caught-TypeError console.error lines per run.
    getSmartViewExcluded: vi.fn(),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// useLightbox is a module-level singleton: every call to useLightbox() returns a **new
// object literal**, but its `openAt` property points at the same module-top-level function --
// so `vi.spyOn(obj, 'openAt')` on this new literal only shadows that one object's own
// property, and does not affect a different object returned by another `useLightbox()` call
// inside the component (its `openAt` still points at the real, unintercepted function). This
// component only ever touches the single `lb.openAt` method, so mocking the whole module
// directly is both the simplest and most reliable approach -- the test file and the
// component's internals end up sharing the exact same `mockLb.openAt`.
//
// This page now also mounts a real `<PhotoLightbox>`
// (it never did before). That component's own internals call `useLightbox()` too and read
// `lb.open.value`/`lb.list.value`/etc directly in a `watch()` and its template's `v-if` --
// the original `{ openAt: vi.fn() }` fake had none of those, so simply mounting the page after
// this fix crashed every existing test in this file (`Cannot read properties of undefined
// (reading 'value')`). `vi.hoisted()` runs before `vue` itself is initialised (Vitest hoists
// `vi.mock`/`vi.hoisted` above regular imports), so real `ref()`s can't be constructed inside
// it -- `mockLb` is created here as a plain object (identity fixed by `vi.hoisted`, satisfying
// the "reference the same object `useLightbox()` returns" requirement below), then immediately
// after normal imports settle (this file's own later top-level code, once `vue` is fully
// loaded), its properties are replaced in place with real `ref()`s via `Object.assign` on the
// SAME object reference the mock factory already closed over. `openAt` is made to actually
// flip them (so the "lightbox DOM renders after a tile click" cases below have something to
// assert), while every *other* existing test in this file only ever calls
// `.mockClear()`/inspects call args on `openAt` exactly as before -- unaffected.
const mockLb = vi.hoisted(() => ({ openAt: vi.fn<(...args: unknown[]) => void>() }))
vi.mock('../../photos/lightbox/useLightbox', () => ({ useLightbox: () => mockLb }))

import PhotosSmartViewDetail from '../PhotosSmartViewDetail.vue'
import photosSmartViewDetailRaw from '../PhotosSmartViewDetail.vue?raw'
import { usePhotosSmartViews, type SmartView } from '../../photos/stores/smartViews'
import { usePhotosAlbums } from '../../photos/stores/albums'
import { useTimelineStore } from '../../photos/stores/timeline'
import { useToast } from '../../stores/toast'
import { usePhotosToast } from '../../photos/composables/usePhotosToast'
import PhotosTopbar from '../../photos/components/PhotosTopbar.vue'
import PhotosSidebar from '../../photos/components/PhotosSidebar.vue'
import { extractStyleBlock, parseCssRules, winningHoverBackground } from '../../photos/components/__tests__/cssCascade'
// Task 8 cross-page sweep: the delete/convert confirmation dialogs' `.trash-btn-cta-primary`/
// `.trash-btn-cta-danger`/`.lb-confirm-icon` rules now live solely in the globally-imported
// parity stylesheet (photos.scss:620-692), not this component's own <style scoped> -- same
// "read the shared stylesheet, not this file's own raw source" technique PhotosAlbums.test.ts
// already uses for its own de-duplicated rules. Plain `fs.readFileSync` rather than a Vite
// `?raw` import: Vite's SCSS handling intercepts `.scss` specifiers ahead of the raw-import
// plugin and yields an empty string.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Fill in `mockLb` (declared above, before `vue` was
// ready) with real `ref()`s now that normal imports have settled -- see that declaration's own
// comment for why this two-step construction is necessary. Mutates the same object identity the
// `vi.mock` factory above already closed over.
const lbOpen = ref(false)
const lbList = ref<Array<{ id: string | number }>>([])
const lbIndex = ref(0)
// `current`/`detail` mirror the real module's own `computed(() => list.value[index.value] ??
// null)` (useLightbox.ts) -- `PhotoLightbox.vue`'s own `doDelete()`/`onAddToAlbum()` read
// `lb.current.value` to know which asset id to emit, so this must actually track `openAt`'s
// argument, not stay permanently null.
const lbCurrent = computed(() => lbList.value[lbIndex.value] ?? null)
Object.assign(mockLb, {
  open: lbOpen,
  list: lbList,
  index: lbIndex,
  current: lbCurrent,
  detail: lbCurrent,
  searchQuery: ref(''),
  startMs: ref(0),
  ocrLines: ref([]),
  hasPrev: ref(false),
  hasNext: ref(false),
  isFav: ref(false),
  openAt: vi.fn((photo: { id: string | number }, list: Array<{ id: string | number }>) => {
    lbOpen.value = true
    lbList.value = list
    lbIndex.value = Math.max(0, list.findIndex((p) => String(p.id) === String(photo.id)))
  }),
  close: vi.fn(() => { lbOpen.value = false }),
  prev: vi.fn(),
  next: vi.fn(),
  goTo: vi.fn(),
  hydrateDetail: vi.fn(),
  reconcileFav: vi.fn(),
  toggleFav: vi.fn(),
  __resetForTest: vi.fn(() => { lbOpen.value = false; lbList.value = [] }),
})

const photosParityRaw = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../photos/styles/vue2-parity/photos.scss'),
  'utf8',
)

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh, en_us: en } })

function makeRouter(initial = '/photos/smart-views/7') {
  const router = createRouter({
    history: createWebHashHistory('/'),
    routes: [
      { path: '/photos/smart-views', name: 'photos-smart-views', component: { template: '<div/>' } },
      { path: '/photos/smart-views/:id', name: 'photos-smart-view-detail', component: PhotosSmartViewDetail },
      // SP15-P2b Task 5: smart albums moved into Albums (Tasks 3/4) -- this page's back
      // links (not-found, detail bar, post-delete) all now land here instead.
      { path: '/photos/albums', name: 'photos-albums-stub', component: { template: '<div/>' } },
    ],
  })
  router.push(initial)
  return router
}

interface RawSv {
  id: number | string
  name: string
  description?: string
  conds?: string[]
  threshold?: number
  live?: boolean
  includeVideos?: boolean
  count?: number
  addedThisWeek?: number
  seeds?: string[]
  median?: number
  storageBytes?: number
  distribution?: number[]
  evaluatedAt?: string
}

function makeSv(overrides: Partial<RawSv> = {}): RawSv {
  return {
    id: 7,
    name: 'Sunsets',
    description: '',
    conds: ['scene: sunset'],
    threshold: 72,
    live: true,
    includeVideos: false,
    count: 1000,
    addedThisWeek: 3,
    seeds: [],
    median: 0,
    storageBytes: 0,
    distribution: [],
    evaluatedAt: '',
    ...overrides,
  }
}

function asset(id: string | number, overrides: Record<string, unknown> = {}) {
  return { id, takenAt: '2026-05-01T10:00:00Z', mimeType: 'image/jpeg', originalName: `${id}.jpg`, ...overrides }
}

async function mountView(id = '7', svList: RawSv[] = [makeSv({ id: 7 })]) {
  svc.photos.listSmartViews.mockResolvedValue(svList)
  const router = makeRouter(`/photos/smart-views/${id}`)
  await router.isReady()
  const w = mount(PhotosSmartViewDetail, { global: { plugins: [i18n, router] } })
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('access_token', 'tok-123')
  setActivePinia(createPinia())
  svc.photos.listSmartViews.mockReset()
  svc.photos.getSmartViewAssets.mockReset().mockResolvedValue([])
  svc.photos.getSmartViewActivity.mockReset().mockResolvedValue([])
  svc.photos.updateSmartView.mockReset()
  svc.photos.deleteSmartView.mockReset()
  svc.photos.createSmartView.mockReset()
  svc.photos.duplicateSmartView.mockReset()
  svc.photos.exportSmartViewAlbum.mockReset()
  svc.photos.exportSmartViewUrl.mockClear()
  svc.photos.thumbnailUrl.mockClear()
  svc.photos.getSmartViewExcluded.mockReset().mockResolvedValue([])
  mockLb.openAt.mockClear()
  // Fix-12: the lightbox's own open/list refs are real, live state now (not just a call-history
  // spy) -- reset them too, or a test that opened the lightbox would leak `open=true` into the
  // next one.
  lbOpen.value = false
  lbList.value = []
  lbIndex.value = 0
  // Fix-10: usePhotosToast() is a module-level singleton (not Pinia), reset per test.
  usePhotosToast().__resetForTests()
})
afterEach(() => {
  usePhotosSmartViews().__resetForTest()
  vi.restoreAllMocks()
})

// ── Data-source three states (§7e-2 structural spec 1) ──────────────────────────────
describe('data-source three states', () => {
  it('listLoaded false (request not yet resolved) -> skeleton, no header rendered', async () => {
    let resolveFn: ((v: RawSv[]) => void) | undefined
    svc.photos.listSmartViews.mockImplementation(() => new Promise((res) => { resolveFn = res }))
    const router = makeRouter('/photos/smart-views/7')
    await router.isReady()
    const w = mount(PhotosSmartViewDetail, { global: { plugins: [i18n, router] } })
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-skeleton"]').exists()).toBe(true)
    expect(w.find('.sv-header').exists()).toBe(false)
    resolveFn?.([makeSv({ id: 7 })])
    await flushPromises()
  })

  it('listLoaded true + byId hit -> header renders normally', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    expect(w.find('[data-test="sv-skeleton"]').exists()).toBe(false)
    expect(w.find('.sv-header').exists()).toBe(true)
    expect(w.find('[data-test="sv-title-view"]').text()).toBe('Sunsets')
  })

  it('listLoaded true + byId returns null -> "not found" empty state + back button', async () => {
    const { w } = await mountView('999', [makeSv({ id: 7 })])
    expect(w.find('[data-test="sv-not-found"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-not-found"]').text()).toContain(zh.photosSvNotFound)
    expect(w.find('[data-test="sv-not-found-back"]').exists()).toBe(true)
  })

  // SP15-P2b Task 5: smart albums now live in Albums (Tasks 3/4) -- this button's
  // destination and label both changed (label: photosSvAllSmartViews → photosAlbumBack,
  // see the deviation comment above PhotosSmartViewDetail.vue's detail-bar back button).
  it('back button -> router.push to the albums page', async () => {
    const { w, router } = await mountView('999', [makeSv({ id: 7 })])
    const pushSpy = vi.spyOn(router, 'push')
    await w.find('[data-test="sv-not-found-back"]').trigger('click')
    expect(pushSpy).toHaveBeenCalledWith('/photos/albums')
  })

  it('byId normalizes via String: store id is number 7, route.params.id = "7" -> hit', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })]) // makeSv's id literal is itself a number
    expect(w.find('[data-test="sv-not-found"]').exists()).toBe(false)
    expect(w.find('.sv-header').exists()).toBe(true)
  })
})

// fix round 1 · M5 (structural spec 2: .sv-detail-bar had zero test cases before this) ────────────────────
describe('.sv-detail-bar -- back entry + last-updated time', () => {
  it('evaluatedAt non-empty -> photosSvLastUpdatedTime renders the relTime result', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, evaluatedAt: '2026-07-31T00:00:00Z' })])
    const bar = w.find('.sv-detail-bar')
    // Assert against the fixed prefix of the Chinese copy (the value itself comes from relTime,
    // a pure function already unit-tested elsewhere -- this only pins down that
    // "the photosSvLastUpdatedTime key is actually applied, not a constant '—'").
    expect(bar.text()).toContain(zh.photosSvLastUpdatedTime.split('{time}')[0].trim())
    expect(bar.find('.sv-last-updated').text()).not.toBe(zh.photosSvLastUpdatedTime.replace('{time}', '—'))
  })

  it('evaluatedAt empty -> falls back to displaying "—" (ported from the Vue2 :332 fallback)', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, evaluatedAt: '' })])
    expect(w.find('.sv-last-updated').text()).toBe(zh.photosSvLastUpdatedTime.replace('{time}', '—'))
  })

  // SP15-P2b Task 5: the back button had no data-test before this task (dispatch-corrected
  // brief fact 3 -- the brief's original snippet assumed `sv-detail-back` already existed).
  // Destination changed to Albums (smart albums moved there in Tasks 3/4) and the label
  // changed from photosSvAllSmartViews to photosAlbumBack -- see the deviation comment
  // above this button in PhotosSmartViewDetail.vue.
  it('sends the back button to Albums, where smart albums now live', async () => {
    const { w, router } = await mountView('7', [makeSv({ id: 7 })])
    const pushSpy = vi.spyOn(router, 'push')
    const back = w.find('[data-test="sv-detail-back"]')
    expect(back.exists()).toBe(true)
    expect(back.text()).toContain(zh.photosAlbumBack)
    await back.trigger('click')
    expect(pushSpy).toHaveBeenCalledWith('/photos/albums')
  })
})

// fix round 1 · M5 (brief §3 explicitly requires this mount-point assertion; the original version had 0 grep hits) ──────────────
// This originally mounted a dedicated SmartViewConditionEditor component here (chips +
// an "Add condition" popover). Later work (ported from the Vue 2 page's
// PhotosSmartViewDetail.vue:26-30/:700-710, "user-added requirement") removes the add entry as a
// deliberate product decision -- only removable chips survive. Once `add` was gone the
// component was down to a bare v-for with no local state, so it no longer earned its own
// file (see task-8-report.md for the full call) and folded back into this page. These
// tests were re-homed accordingly; the popover/suggestion/busy-forwarding tests that only
// exercised the add path had no capability left to cover and were deleted, not silently
// dropped (disposition table in the report).
describe('T7/T8: condition chips (remove-only, add entry removed)', () => {
  it('renders one removable chip per sv.conds entry', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, conds: ['scene: sunset', 'place: Japan'] })])
    const mountEl = w.find('[data-test="sv-header-conds"]')
    expect(mountEl.exists()).toBe(true)
    expect(mountEl.findAll('[data-test="sv-cond-chip"]').length).toBe(2)
  })

  it('no longer offers an add-condition entry (button and popover both gone)', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, conds: ['scene: sunset'] })])
    expect(w.find('[data-test="sv-cond-add-btn"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-cond-pop"]').exists()).toBe(false)
  })

  it('clicking a chip → store.updateSmartView receives the filtered conds (condsRaw), and the chip is actually gone once the round trip resolves', async () => {
    svc.photos.updateSmartView.mockResolvedValue(null)
    const { w } = await mountView('7', [makeSv({ id: 7, conds: ['scene: sunset', 'place: Japan'] })])
    await w.findAll('[data-test="sv-cond-chip"]')[0].trigger('click')
    await flushPromises()
    expect(svc.photos.updateSmartView).toHaveBeenCalledWith('7', { condsRaw: ['place: Japan'] })
    // End-to-end, not just "the call was made with the right args": the store's local merge
    // (smartViews.ts's `splice(i, 1, { ...old, ...patch })` fallback for a null response)
    // updates `sv.conds`, the page's `sv` computed follows it, and the chip actually
    // disappears from the DOM -- not merely still present with a stale click handler.
    await w.vm.$nextTick()
    const remaining = w.findAll('[data-test="sv-cond-chip"]')
    expect(remaining.length).toBe(1)
    expect(remaining[0].text()).toContain('place: Japan')
  })

  // SP15-P2c Task 8, coordinator review fix: re-homes the deleted
  // SmartViewConditionEditor.test.ts's "clicking the X (.sv-cond-x) also triggers remove (bubbles to the whole chip)".
  // The first pass of this task's disposition table claimed this was "covered structurally"
  // by the whole-chip click test above on the strength of the DOM being unchanged -- that
  // claim was never actually exercised by a test (clicking the parent span directly never
  // dispatches a click on the nested `.sv-cond-x`, so a future `@click.stop` added to the X
  // icon would silently break click-to-remove-via-X with nothing here to catch it). Fixed by
  // adding this test rather than just softening the prose.
  it('clicking the ✕ icon specifically (not just the chip body) still fires removeCond via bubbling', async () => {
    svc.photos.updateSmartView.mockResolvedValue(null)
    const { w } = await mountView('7', [makeSv({ id: 7, conds: ['scene: sunset', 'place: Japan'] })])
    await w.find('.sv-cond-x').trigger('click')
    await flushPromises()
    expect(svc.photos.updateSmartView).toHaveBeenCalledWith('7', { condsRaw: ['place: Japan'] })
  })

  it('store.patchBusy blocks a second click on the same chip from firing another PATCH', async () => {
    let resolveFn: ((v: unknown) => void) | undefined
    svc.photos.updateSmartView.mockImplementation(() => new Promise((res) => { resolveFn = res }))
    const { w } = await mountView('7', [makeSv({ id: 7, conds: ['scene: sunset', 'place: Japan'] })])
    const chip = w.findAll('[data-test="sv-cond-chip"]')[0]
    await chip.trigger('click')
    expect(svc.photos.updateSmartView).toHaveBeenCalledTimes(1)
    expect(chip.attributes('data-busy')).toBe('true')
    await chip.trigger('click')
    expect(svc.photos.updateSmartView).toHaveBeenCalledTimes(1)
    resolveFn?.(null)
    await flushPromises()
  })

  it('leaves no orphaned add-condition identifiers behind in the page source', () => {
    for (const ident of [
      'openAddCond', 'closeAddCond', 'submitCond', 'addCondSuggestion', 'addCond',
      'SmartViewConditionEditor',
    ]) {
      expect(photosSmartViewDetailRaw).not.toContain(ident)
    }
  })
})

// P7a-T8: sv-side-mount's stub assertion ("empty shell, children.length===0") is upgraded here
// into a real component assertion -- SmartViewSidePanel/SmartViewActivityFeed's own
// structure/interaction/style coverage already lives in their own __tests__ files; this only
// pins down "is the host wiring correct": both components are actually mounted, the sv/busy/
// activity prop sources are correct, and the patch emit translates into the right shape for
// store.updateSmartView(id, patch) (no extra .then(loadDetail) needed, same reasoning as
// addCond/removeCond).
describe('T8: right column (mount point delivers real components)', () => {
  it('renders SmartViewSidePanel (3 sections) + SmartViewActivityFeed (1 section) under sv-side-mount', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    const mountEl = w.find('[data-test="sv-side-mount"]')
    expect(mountEl.exists()).toBe(true)
    const sections = mountEl.findAll('.sv-side-section')
    expect(sections).toHaveLength(4)
    expect(mountEl.text()).toContain(zh.photosSvQualityThreshold)
    expect(mountEl.text()).toContain(zh.photosSvSettingsSection)
    expect(mountEl.text()).toContain(zh.photosSvStats)
    expect(mountEl.text()).toContain(zh.photosSvActivity)
  })

  it('activity feed gets store.activity (the getSmartViewActivity response)', async () => {
    svc.photos.getSmartViewActivity.mockResolvedValue([
      { id: 'a1', eventType: 'created', detail: '', assetIds: [], occurredAt: '2026-07-31T00:00:00Z' },
    ])
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    const mountEl = w.find('[data-test="sv-side-mount"]')
    expect(mountEl.text()).toContain(zh.photosSvSmartViewCreated)
  })

  describe('threshold patch -> store.updateSmartView (300ms debounce)', () => {
    // fix round 1 · M5: useRealTimers moved into afterEach (previously written at the end of
    // the it block, so if an assertion failed first the fake clock would leak into later tests
    // in this file).
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('dragging the threshold slider -> store.updateSmartView receives { threshold } after 300ms', async () => {
      svc.photos.updateSmartView.mockResolvedValue(null)
      const { w } = await mountView('7', [makeSv({ id: 7, threshold: 72 })])
      const range = w.find('[data-test="pts-range"]')
      await range.setValue('92')
      await vi.advanceTimersByTimeAsync(300)
      expect(svc.photos.updateSmartView).toHaveBeenCalledWith('7', { threshold: 92 })
    })

    // fix round 1 · I2 addendum: the host's `:busy="store.patchBusy"` prop source had zero
    // test cases before this. While updateSmartView is pending, store.patchBusy=true should be
    // forwarded into SmartViewSidePanel and reflected on both switches' data-busy attribute.
    it('while store.patchBusy=true -> both SmartViewSidePanel switches carry data-busy="true"', async () => {
      let resolveFn: ((v: unknown) => void) | undefined
      svc.photos.updateSmartView.mockImplementation(() => new Promise((res) => { resolveFn = res }))
      const { w } = await mountView('7', [makeSv({ id: 7, threshold: 72 })])
      const range = w.find('[data-test="pts-range"]')
      await range.setValue('92')
      await vi.advanceTimersByTimeAsync(300) // triggers onSidePatch -> store.updateSmartView (pending)
      await flushPromises()
      expect(w.find('[data-test="sv-switch-live"]').attributes('data-busy')).toBe('true')
      expect(w.find('[data-test="sv-switch-videos"]').attributes('data-busy')).toBe('true')
      resolveFn?.(null)
      await flushPromises()
      expect(w.find('[data-test="sv-switch-live"]').attributes('data-busy')).toBe('false')
    })
  })

  it('clicking the "Auto-add new matches" switch -> store.updateSmartView receives { live: true } (sv.live=false)', async () => {
    svc.photos.updateSmartView.mockResolvedValue(null)
    const { w } = await mountView('7', [makeSv({ id: 7, live: false })])
    await w.find('[data-test="sv-switch-live"]').trigger('click')
    await flushPromises()
    expect(svc.photos.updateSmartView).toHaveBeenCalledWith('7', { live: true })
  })
})

// ── onMounted load order ───────────────────────────────────────────────────
describe('onMounted load order', () => {
  it('when listLoaded is false: fetchSmartViews (listSmartViews) runs before loadDetail (getSmartViewAssets)', async () => {
    const order: string[] = []
    svc.photos.listSmartViews.mockImplementation(async () => { order.push('list'); return [makeSv({ id: 7 })] })
    svc.photos.getSmartViewAssets.mockImplementation(async () => { order.push('assets'); return [] })
    const router = makeRouter('/photos/smart-views/7')
    await router.isReady()
    mount(PhotosSmartViewDetail, { global: { plugins: [i18n, router] } })
    await flushPromises()
    expect(order[0]).toBe('list')
    expect(order).toContain('assets')
  })

  it('when listLoaded is true (another instance already warmed the store): only loadDetail runs, fetchSmartViews is not re-called', async () => {
    const store = usePhotosSmartViews()
    svc.photos.listSmartViews.mockResolvedValue([makeSv({ id: 7 })])
    await store.fetchSmartViews()
    svc.photos.listSmartViews.mockClear()
    const router = makeRouter('/photos/smart-views/7')
    await router.isReady()
    mount(PhotosSmartViewDetail, { global: { plugins: [i18n, router] } })
    await flushPromises()
    expect(svc.photos.listSmartViews).not.toHaveBeenCalled()
    expect(svc.photos.getSmartViewAssets).toHaveBeenCalled()
  })
})

// ── watch route.params.id ────────────────────────────────────────────────
describe('watch route.params.id', () => {
  it('id changes from 7 to 8 -> loadDetail("8") is called (getSmartViewAssets carries the new id)', async () => {
    const { w, router } = await mountView('7', [makeSv({ id: 7 }), makeSv({ id: 8, name: 'Food' })])
    svc.photos.getSmartViewAssets.mockClear()
    await router.push('/photos/smart-views/8')
    await flushPromises()
    expect(svc.photos.getSmartViewAssets).toHaveBeenCalled()
    const calledIds = svc.photos.getSmartViewAssets.mock.calls.map((c) => c[0])
    expect(calledIds.every((id) => id === '8')).toBe(true)
    expect(w.find('[data-test="sv-title-view"]').text()).toBe('Food')
  })
})

// ── rename ──────────────────────────────────────────────────────────────────
describe('rename', () => {
  it('clicking the title -> an input appears with titleDraft prefilled with the current name', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    await w.find('[data-test="sv-title-view"]').trigger('click')
    const input = w.find('[data-test="sv-title-input"]')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('Sunsets')
  })

  it('Enter submits the new name -> updateSmartView(id, {name}) is called; edit mode exits once the store writes back', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    svc.photos.updateSmartView.mockResolvedValue({ ...makeSv({ id: 7, name: '日落时分' }) })
    await w.find('[data-test="sv-title-view"]').trigger('click')
    const input = w.find('[data-test="sv-title-input"]')
    await input.setValue('日落时分')
    await input.trigger('keydown.enter')
    await flushPromises()
    await w.vm.$nextTick()
    expect(svc.photos.updateSmartView).toHaveBeenCalledWith('7', expect.objectContaining({ name: '日落时分' }))
    expect(w.find('[data-test="sv-title-input"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-title-view"]').text()).toBe('日落时分')
  })

  it('updateSmartView reject -> edit mode is retained (input still present)', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    svc.photos.updateSmartView.mockRejectedValue(new Error('500'))
    await w.find('[data-test="sv-title-view"]').trigger('click')
    const input = w.find('[data-test="sv-title-input"]')
    await input.setValue('日落时分')
    await input.trigger('keydown.enter')
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-title-input"]').exists()).toBe(true)
    expect(useToast().msg).toBe(zh.photosSvRenameFailed)
  })

  it('name unchanged (same after trim) -> updateSmartView is not called, and edit mode exits', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    await w.find('[data-test="sv-title-view"]').trigger('click')
    const input = w.find('[data-test="sv-title-input"]')
    await input.setValue('  Sunsets  ')
    await input.trigger('keydown.enter')
    await flushPromises()
    expect(svc.photos.updateSmartView).not.toHaveBeenCalled()
    expect(w.find('[data-test="sv-title-input"]').exists()).toBe(false)
  })

  it('Esc -> exits edit mode without submitting', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    await w.find('[data-test="sv-title-view"]').trigger('click')
    const input = w.find('[data-test="sv-title-input"]')
    await input.setValue('乱改的名字')
    await input.trigger('keydown.esc')
    expect(svc.photos.updateSmartView).not.toHaveBeenCalled()
    expect(w.find('[data-test="sv-title-input"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-title-view"]').text()).toBe('Sunsets')
  })
})

// ── paused is a derived value (§7e-2 main guard) ─────────────────────────────────────────────
describe('paused is a derived value', () => {
  it('store has live:false -> pill shows photosSvPaused', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, live: false })])
    expect(w.find('[data-test="sv-live-pill"]').text()).toContain(zh.photosSvPaused)
  })

  it('clicking the pill -> updateSmartView(id, {live:true})', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, live: false })])
    svc.photos.updateSmartView.mockResolvedValue(null)
    await w.find('[data-test="sv-live-pill"]').trigger('click')
    expect(svc.photos.updateSmartView).toHaveBeenCalledWith('7', { live: true })
  })

  it('§7e-2 main guard: after the store updates (no remount), the pill copy automatically follows', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, live: false })])
    expect(w.find('[data-test="sv-live-pill"]').text()).toContain(zh.photosSvPaused)
    // Directly mutate the live field on that sv in the store, without remounting and without
    // going through the component's updateSmartView call -- simulating "another path (e.g.
    // polling / another tab) has already changed the backend state". Vue2 cannot do this (it
    // relies on prop object references plus a whole local-sync mechanism); New-UI's sv is a
    // computed(byId(id)) fetched live, so it responds naturally.
    const store = usePhotosSmartViews()
    const idx = store.smartViews.findIndex((s) => s.id === '7')
    store.smartViews[idx] = { ...store.smartViews[idx], live: true }
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-live-pill"]').text()).toContain(zh.photosSvLive)
  })

  it('pill is keyboard-reachable: tabindex="0" is present, keydown.enter triggers the same handler', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, live: false })])
    svc.photos.updateSmartView.mockResolvedValue(null)
    const pill = w.find('[data-test="sv-live-pill"]')
    expect(pill.attributes('tabindex')).toBe('0')
    // VTU's `.trigger('keydown.enter')` modifier shorthand sets `.key` to lowercase 'enter'
    // (only `.code` is uppercase 'Enter'), which does not match a real browser's
    // KeyboardEvent.key === 'Enter' -- here we pass the key field explicitly to get the
    // uppercase value that matches a real browser, without depending on VTU's modifier
    // shorthand casing behaviour.
    await pill.trigger('keydown', { key: 'Enter' })
    expect(svc.photos.updateSmartView).toHaveBeenCalledWith('7', { live: true })
  })

  it('updateSmartView reject -> update-failed toast', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, live: false })])
    svc.photos.updateSmartView.mockRejectedValue(new Error('500'))
    await w.find('[data-test="sv-live-pill"]').trigger('click')
    await flushPromises()
    expect(useToast().msg).toBe(zh.photosSvUpdateFailed)
  })
})

// ── the 4 header stats ────────────────────────────────────────────────────────────────
describe('header stats: four tiles', () => {
  it('addedThisWeek === 0 -> the delta item does not render', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 0 })])
    expect(w.find('[data-test="sv-stat-delta"]').exists()).toBe(false)
  })

  it('addedThisWeek > 0 -> the delta item renders +n', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 5 })])
    expect(w.find('[data-test="sv-stat-delta"]').text()).toContain('+5')
  })

  it('median missing (0) -> shows 0%', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, median: 0 })])
    expect(w.find('[data-test="sv-stat-median"]').text()).toContain('0%')
  })

  it('formatMB three tiers: 0 -> "0 MB"', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, storageBytes: 0 })])
    expect(w.find('[data-test="sv-stat-storage"]').text()).toContain('0 MB')
  })

  it('formatMB three tiers: 1572864 -> rounds to "2 MB"', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, storageBytes: 1572864 })])
    expect(w.find('[data-test="sv-stat-storage"]').text()).toContain('2 MB')
  })

  it('formatMB three tiers: 2147483648 -> "2.0 GB"', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, storageBytes: 2147483648 })])
    expect(w.find('[data-test="sv-stat-storage"]').text()).toContain('2.0 GB')
  })
})

// ── SP15-P2c Task 6: header action row (sort capsule / pause / edit / density) ────────────
// Target: 33b05636:src/views/Photos/PhotosSmartViewDetail.vue:49-90. Sort and density are new
// construction on this page -- it never had either control -- so these tests describe the
// target's row, not a rearrangement of what was here.
describe('SP15-P2c Task 6: header action row', () => {
  /** Opens the sort menu and returns the option button carrying `sortId`. */
  async function pickSortOption(w: ReturnType<typeof mount>, sortId: string) {
    await w.find('[data-test="sv-sort-btn"]').trigger('click')
    await w.vm.$nextTick()
    const item = w.findAll('[data-test="sv-sort-item"]').find((n) => n.attributes('data-sort-id') === sortId)!
    await item.trigger('click')
    await w.vm.$nextTick()
  }

  it('renders sort and density in the header outside edit mode', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    expect(w.find('.sv-actions .group').text()).toBe(zh.photosAlbumSort)
    expect(w.find('[data-test="sv-sort-btn"]').text()).toContain(zh.photosSortScore)
    expect(w.findAll('.density button')).toHaveLength(2)
    // The target's order, element by element: Sort label -> capsule -> separator -> Pause ->
    // Edit -> separator -> density. Asserting the sequence is the only way a reordering is
    // caught; each element existing on its own says nothing about where it sits.
    const row = w.findAll('.sv-actions > *').map((n) => {
      const cls = n.classes()
      return n.attributes('data-test') ?? (cls.includes('group') ? 'group' : cls[0])
    })
    expect(row.slice(0, 7)).toEqual([
      'group',
      'sv-sort-wrap',
      'album-detail-actions-sep',
      'sv-action-pause',
      'sv-edit-toggle',
      'album-detail-actions-sep',
      'density',
    ])
  })

  it('offers match score and date taken as the two sort options', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-sort-btn"]').trigger('click')
    await w.vm.$nextTick()
    const items = w.findAll('[data-test="sv-sort-item"]')
    expect(items.map((n) => n.attributes('data-sort-id'))).toEqual(['score', 'taken'])
    expect(items.map((n) => n.text())).toEqual([zh.photosSortScore, zh.photosAlbumSortTaken])
    // Score is the default (the backend already returns match_score DESC), so it is the one
    // marked active before anything is picked.
    expect(items[0].attributes('data-active')).toBe('true')
    expect(items[1].attributes('data-active')).toBe('false')
  })

  // Whole-branch review, Minor 7: nothing guarded the check glyph / empty-spacer pair on either
  // detail page, and the album page's copy had already drifted from the target once. The spacer
  // is the half a future edit drops, and dropping it shifts every label between the active and
  // inactive rows -- so assert both halves: every option carries exactly one slot, and only the
  // active one holds a glyph. Mirror of the album page's own assertion.
  it('gives every sort option a check slot and the glyph only to the active one', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-sort-btn"]').trigger('click')
    await w.vm.$nextTick()

    const items = w.findAll('[data-test="sv-sort-item"]')
    expect(items.length).toBeGreaterThan(1)
    for (const item of items) {
      expect(item.findAll('.sv-sort-check')).toHaveLength(1)
      const hasGlyph = item.find('.sv-sort-check').element.tagName.toLowerCase() === 'svg'
      expect(hasGlyph).toBe(item.attributes('data-active') === 'true')
    }
    expect(items.filter((n) => n.attributes('data-active') === 'true')).toHaveLength(1)
  })

  it('re-sorts both grids by taken date when that option is picked, and relabels the capsule', async () => {
    svc.photos.getSmartViewAssets.mockImplementation(async (_id: string, opts: { recent?: boolean }) => {
      // Deliberately handed back in the backend's own (match score) order, oldest first, so
      // "sorted by taken date desc" is a different sequence from "left alone".
      const rows = [
        asset('old', { takenAt: '2026-01-01T00:00:00Z' }),
        asset('new', { takenAt: '2026-06-01T00:00:00Z' }),
      ]
      return opts?.recent ? rows : rows
    })
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 2 })])
    const ids = (sel: string) => w.findAll(sel).map((n) => n.find('img').attributes('src'))
    expect(ids('[data-test="sv-all-tile"]')).toEqual(['mock://thumb/old/large', 'mock://thumb/new/large'])

    await pickSortOption(w, 'taken')

    expect(ids('[data-test="sv-all-tile"]')).toEqual(['mock://thumb/new/large', 'mock://thumb/old/large'])
    expect(ids('[data-test="sv-recent-tile"]')).toEqual(['mock://thumb/new/large', 'mock://thumb/old/large'])
    expect(w.find('[data-test="sv-sort-btn"]').text()).toContain(zh.photosAlbumSortTaken)
    // Picking closes the menu (Vue2 pickSort).
    expect(w.find('[data-test="sv-sort-menu"]').exists()).toBe(false)
  })

  // SP15-P2c Task 9 (target :96/:107 -- onTileClick(p, list), photoSet/recentSet passed from
  // the template). Before this task, both grids' tiles shared one handler that always handed
  // the lightbox `store.matchedAssets` -- the backend's match-score order -- regardless of
  // what Sort was showing. The fixture below is built so the two orders genuinely diverge:
  // "all matches" comes back m1/m2/m3 (score order) but taken-date-desc reorders it to
  // m2/m3/m1, so a lightbox handed the stale order would open on the wrong photo.
  it('hands the lightbox the order the "all matches" grid is showing, not the backend order', async () => {
    svc.photos.getSmartViewAssets.mockImplementation(async (_id: string, opts: { recent?: boolean }) => {
      const matched = [
        asset('m1', { takenAt: '2026-01-10T00:00:00Z' }),
        asset('m2', { takenAt: '2026-03-05T00:00:00Z' }),
        asset('m3', { takenAt: '2026-02-01T00:00:00Z' }),
      ]
      return opts?.recent ? [] : matched
    })
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 0 })])
    await pickSortOption(w, 'taken')
    // Sorted (taken desc): m2, m3, m1 -- the third tile is m1, not m3.
    await w.findAll('[data-test="sv-all-tile"]')[2].trigger('click')

    expect(mockLb.openAt).toHaveBeenCalledTimes(1)
    const call = mockLb.openAt.mock.calls[0]
    expect((call[0] as { id: string }).id).toBe('m1')
    expect((call[1] as Array<{ id: string }>).map((p) => p.id)).toEqual(['m2', 'm3', 'm1'])
    // startMs, not an index -- untouched by this task (useLightbox.openAt computes the index
    // itself from the list and the photo).
    expect(call[2]).toBe(0)
  })

  // The "recently added" band has its own Sort-applied order (recentSet), independent of the
  // "all matches" band's (matchedSet). A fix that wires both grids' clicks to the same list --
  // e.g. always matchedSet -- would pass this test's sibling above but fail here, because the
  // two lists are built to have no assets in common.
  it('keeps the "recently added" grid on its own sorted list, not the all-matches one', async () => {
    svc.photos.getSmartViewAssets.mockImplementation(async (_id: string, opts: { recent?: boolean }) => {
      const matched = [
        asset('m1', { takenAt: '2026-01-10T00:00:00Z' }),
        asset('m2', { takenAt: '2026-03-05T00:00:00Z' }),
        asset('m3', { takenAt: '2026-02-01T00:00:00Z' }),
      ]
      const recent = [
        asset('r2', { takenAt: '2026-01-01T00:00:00Z' }),
        asset('r1', { takenAt: '2026-04-01T00:00:00Z' }),
      ]
      return opts?.recent ? recent : matched
    })
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 2 })])
    await pickSortOption(w, 'taken')
    // Sorted (taken desc): r1, r2 -- the backend handed them back the other way round.
    await w.findAll('[data-test="sv-recent-tile"]')[0].trigger('click')

    expect(mockLb.openAt).toHaveBeenCalledTimes(1)
    const call = mockLb.openAt.mock.calls[0]
    expect((call[0] as { id: string }).id).toBe('r1')
    expect((call[1] as Array<{ id: string }>).map((p) => p.id)).toEqual(['r1', 'r2'])
  })

  it('switches both grids to the compact density', async () => {
    svc.photos.getSmartViewAssets.mockResolvedValue([asset('a1')])
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 1 })])
    expect(w.find('[data-test="sv-all-grid"]').classes()).not.toContain('is-compact')
    expect(w.find('[data-test="sv-density-comfortable"]').attributes('data-active')).toBe('true')

    await w.find('[data-test="sv-density-compact"]').trigger('click')
    await w.vm.$nextTick()

    expect(w.find('[data-test="sv-all-grid"]').classes()).toContain('is-compact')
    expect(w.find('[data-test="sv-recent-grid"]').classes()).toContain('is-compact')
    expect(w.find('[data-test="sv-density-compact"]').attributes('data-active')).toBe('true')
    expect(w.find('[data-test="sv-density-comfortable"]').attributes('data-active')).toBe('false')
  })

  it('keeps pause and edit visible in edit mode while sort and density disappear', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    expect(w.find('[data-test="sv-sort-btn"]').exists()).toBe(true)
    expect(w.find('.density').exists()).toBe(true)

    await w.find('[data-test="sv-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()

    expect(w.find('[data-test="sv-sort-btn"]').exists()).toBe(false)
    expect(w.find('.density').exists()).toBe(false)
    expect(w.find('[data-test="sv-action-pause"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-edit-toggle"]').exists()).toBe(true)
    // Each separator travels with the group it parts, so neither is left dangling.
    expect(w.findAll('.album-detail-actions-sep')).toHaveLength(0)
  })

  it('enters and leaves edit mode from the single edit toggle', async () => {
    svc.photos.getSmartViewAssets.mockResolvedValue([asset('a1')])
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 0 })])
    const toggle = () => w.find('[data-test="sv-edit-toggle"]')
    expect(toggle().text()).toBe(zh.photosAlbumEdit)
    expect(toggle().attributes('data-open')).toBe('false')
    expect(w.find('[data-test="sv-select-bar"]').exists()).toBe(false)

    await toggle().trigger('click')
    await w.vm.$nextTick()
    expect(toggle().text()).toBe(zh.photosAlbumDone)
    expect(toggle().attributes('data-open')).toBe('true')
    expect(w.find('[data-test="sv-select-bar"]').exists()).toBe(true)

    await toggle().trigger('click')
    await w.vm.$nextTick()
    expect(toggle().text()).toBe(zh.photosAlbumEdit)
    expect(w.find('[data-test="sv-select-bar"]').exists()).toBe(false)
  })

  it('shows add-photos in the bottom select bar rather than the header', async () => {
    svc.photos.getSmartViewAssets.mockResolvedValue([asset('a1')])
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 0 })])
    expect(w.find('.sv-actions [data-test="sv-add-photos"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-add-photos"]').exists()).toBe(false)

    await w.find('[data-test="sv-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()

    // In the bar, and nowhere else -- and reachable with nothing selected, which is the whole
    // reason the bar is gated on edit alone (target :318).
    expect(w.find('[data-test="sv-select-bar"] [data-test="sv-add-photos"]').exists()).toBe(true)
    expect(w.findAll('[data-test="sv-add-photos"]')).toHaveLength(1)
    expect(w.find('[data-test="sv-select-bar"]').text()).toContain(zh.photosSvClickToSelect)

    await w.find('[data-test="sv-add-photos"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.findComponent({ name: 'PhotosLibraryPicker' }).props('open')).toBe(true)
  })

  // The export toast, edit-mode
  // select bar, and library picker used to be template-root SIBLINGS of `.photos-root` rather
  // than its DOM descendants, so none of parity's `.photos-root .sv-select-bar` / `.sv-toast`
  // descendant selectors (photos-smartview.scss:550-567/675) could match -- the exact same root
  // cause as the "New album" modal bug elsewhere. Same fix:
  // nest them back inside `.photos-root`.
  describe('Fix-2 item 5: the tail section is a real descendant of .photos-root', () => {
    it('the select bar renders inside .photos-root (so parity .sv-select-bar can match)', async () => {
      svc.photos.getSmartViewAssets.mockResolvedValue([asset('a1')])
      const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 0 })])
      await w.find('[data-test="sv-edit-toggle"]').trigger('click')
      await w.vm.$nextTick()
      const bar = w.get('[data-test="sv-select-bar"]').element
      expect(bar.closest('.photos-root')).not.toBeNull()
    })

    it('the library picker renders inside .photos-root', async () => {
      // PhotosLibraryPicker's own root is `v-if="open"` -- closed, `.element` is a comment
      // placeholder with no `.closest`, so open it first via the select bar's Add photos button.
      svc.photos.getSmartViewAssets.mockResolvedValue([asset('a1')])
      const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 0 })])
      await w.find('[data-test="sv-edit-toggle"]').trigger('click')
      await w.vm.$nextTick()
      await w.find('[data-test="sv-add-photos"]').trigger('click')
      await w.vm.$nextTick()
      const overlay = w.get('[data-test="lib-picker-overlay"]').element
      expect(overlay.closest('.photos-root')).not.toBeNull()
    })
  })

  it('disables Remove until something is selected', async () => {
    svc.photos.getSmartViewAssets.mockImplementation(async (_id: string, opts: { recent?: boolean }) => (opts?.recent ? [] : [asset('a1')]))
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 0 })])
    await w.find('[data-test="sv-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-remove-selected"]').attributes('disabled')).toBeDefined()

    await w.find('[data-test="sv-all-tile"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-remove-selected"]').attributes('disabled')).toBeUndefined()
    expect(w.find('[data-test="sv-select-bar"]').text()).toContain(zh.photosSelectedCount.replace('{count}', '1'))
  })

  it('closes the sort menu on an outside mousedown and on Escape', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-sort-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-sort-menu"]').exists()).toBe(true)
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-sort-menu"]').exists()).toBe(false)

    await w.find('[data-test="sv-sort-btn"]').trigger('click')
    await w.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-sort-menu"]').exists()).toBe(false)
  })
})

// ── "Refine in Search" -- delivered by T16: disabled removed, wired to router.push ─────────────────
describe('"Refine in Search" button (wired up as of T16)', () => {
  it('no longer disabled, and no photosSvSearchPending title', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    const btn = w.find('[data-test="sv-action-refine"]')
    expect(btn.attributes('disabled')).toBeUndefined()
    expect(btn.attributes('title')).toBeUndefined()
  })

  it('clicking -> router.push({ path: "/photos/search", query: { q: sv.name } })', async () => {
    const { w, router } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    const pushSpy = vi.spyOn(router, 'push')
    await w.find('[data-test="sv-action-refine"]').trigger('click')
    expect(pushSpy).toHaveBeenCalledWith({ path: '/photos/search', query: { q: 'Sunsets' } })
  })

  it('photosSvSearchPending key removed from both locales (dead key cleaned up along with T16)', () => {
    expect('photosSvSearchPending' in zh).toBe(false)
    expect('photosSvSearchPending' in en).toBe(false)
  })
})

// ── more menu (unified into five entries as of Task 7; the Export button/menu is folded in
//    entirely, see the "SP15-P2c Task 7" describe block below) ─────────────────────────────
describe('more menu', () => {
  // Re-homed (Task 7): the old "menu shows three entries (rename/duplicate/delete)" case is now a strict subset
  // of "renders exactly five menu entries in the target order" below, which also pins the
  // order -- this one stays only because it predates Convert/ZIP and is still true unchanged.
  it('opens the more menu and shows at least three entries (rename / duplicate / delete)', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    expect(w.find('[data-test="sv-more-rename"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-more-duplicate"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-more-delete"]').exists()).toBe(true)
  })

  // Re-homed (Task 7): was 'click the export button...' + 'photosSvNPhotosMbMb...', reading
  // sv-export-toggle/sv-export-zip. The export button is gone; ZIP is now the third entry of
  // the unified menu, reached through sv-more-toggle, and its data-test is sv-more-zip.
  it('the {mb} in photosSvNPhotosMbMb at count=1000 is thousands-separated "3,200"', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, count: 1000 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    expect(w.find('[data-test="sv-more-zip"]').text()).toContain('3,200')
  })
})

// ── SP15-P2c Task 7: sidebar action section + unified five-entry "..." menu ────────────────
// Target: 33b05636:src/views/Photos/PhotosSmartViewDetail.vue:127-225. Refine in Search and
// the "..." menu move from the header row (where Task 6 parked them) into a new
// `.sv-side-actions` container at the top of the sidebar, matching PhotosAlbumDetail.vue's own
// (Task 5). The Export button/menu is gone entirely: ZIP folds into the unified menu as its
// third entry, and "Save as static album" (sv-export-album / exportAlbumAction) is deleted --
// the target's own history (933a7d3a comment, restated in PhotosSmartViewDetail.vue's header)
// records that Vue2 killed this same button in the same commit range and kept only the backend
// capability, which is exactly the call made here too (see the component's own comment on the
// deletion for the full trail).
describe('SP15-P2c Task 7: sidebar action section + unified menu', () => {
  it('renders the sidebar action section with refine and the more button', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    const side = w.find('[data-test="sv-side-mount"]')
    const actions = side.find('.sv-side-actions')
    expect(actions.exists()).toBe(true)
    expect(actions.find('[data-test="sv-action-refine"]').exists()).toBe(true)
    expect(actions.find('[data-test="sv-more-toggle"]').exists()).toBe(true)
  })

  it('renders exactly five menu entries in the target order', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.vm.$nextTick()
    const items = w.find('[data-test="sv-more-menu"]').findAll('.sv-export-item')
    expect(items).toHaveLength(5)
    expect(items.map((i) => i.attributes('data-test'))).toEqual([
      'sv-more-rename',
      'sv-more-duplicate',
      'sv-more-zip',
      'sv-more-convert',
      'sv-more-delete',
    ])
    // Review fix: the previous version of this test only pinned the `data-test` order, which
    // says nothing about the rendered copy -- exactly how the Convert/Delete titles drifted
    // from the target's own shortened copy (33b05636 :143-147's own "shortened so the two
    // pages read the same" comment) without any gate catching it, until a human read the diff.
    // Titles here must match the target's short-form copy (verified against
    // 33b05636:src/assets/lang/zh_CN.json's `Convert`/`Delete` entries: 转换/删除); descs are
    // deliberately excluded -- only the titles were shortened in the target's own change.
    expect(items.map((i) => i.find('.sv-export-title').text())).toEqual([
      zh.photosSvRename,
      zh.photosSvDuplicate,
      zh.photosFavExport,
      zh.photosAlbumMenuConvert,
      zh.photosDelete,
    ])
  })

  it('no longer renders a separate export section in the menu', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    expect(w.find('[data-test="sv-export-toggle"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-export-menu"]').exists()).toBe(false)
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    // "Save as static album" is a deleted capability, not something that moved -- see the
    // describe block's own header comment.
    expect(w.find('[data-test="sv-export-album"]').exists()).toBe(false)
  })

  it('applies the fixed position style when the menu opens', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.vm.$nextTick()
    const style = w.find('[data-test="sv-more-menu"]').attributes('style') ?? ''
    expect(style).toContain('position: fixed')
  })

  // Re-homed (Task 7): was 'clicking outside the menu (mousedown, bubbles: true) -> closes' in the export-menu
  // describe block, reading sv-export-toggle/sv-export-menu -- both gone. Same behaviour, new
  // trigger.
  it('still closes the menu on an outside click', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    expect(w.find('[data-test="sv-more-menu"]').exists()).toBe(true)
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-more-menu"]').exists()).toBe(false)
  })

  // Regression guard against E10 recurring (SP15-P2b's Important finding: the convert
  // confirmation's primary-action colour and its Escape guard). The full flow (colour, Escape
  // mid-flight, 409 copy, navigation) is already covered end-to-end by the "convert to regular
  // album" describe block below Task 6's edit; this test's job is narrower and specific to
  // Task 7's relocation -- proving the *new* sidebar entry point still reaches that flow at all.
  it('keeps the convert-to-album confirmation flow working from the new entry', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, count: 12 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-convert"]').trigger('click')
    await w.vm.$nextTick()
    const confirm = w.find('[data-test="sv-convert-confirm"]')
    expect(confirm.exists()).toBe(true)
    const ok = confirm.find('[data-test="sv-convert-ok"]')
    // Task 8 cross-page sweep: `.primary`/`.danger` modifier classes renamed to Vue2's own
    // `trash-btn-cta-primary`/`trash-btn-cta-danger` (see the template's own comment).
    expect(ok.classes()).toContain('trash-btn-cta-primary')
    expect(ok.classes()).not.toContain('trash-btn-cta-danger')
  })

  // Folded-in finding (b): a keyboard activation of Edit/Done (Space/Enter on a focused
  // button) fires a `click` without a `mousedown` -- the event onDocumentMouseDown listens
  // for to close the sort menu. VTU's own `.trigger('click')` has the identical shape (no
  // synthetic mousedown either), so this reproduces the real bug without any extra event
  // plumbing: open the sort menu, flip edit mode on and back off through the toggle alone, and
  // check the sort popup does not silently reappear.
  it('does not leave the sort menu stuck open after toggling edit mode via the Edit button', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-sort-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-sort-menu"]').exists()).toBe(true)

    await w.find('[data-test="sv-edit-toggle"]').trigger('click') // enter edit mode
    await w.vm.$nextTick()
    await w.find('[data-test="sv-edit-toggle"]').trigger('click') // leave edit mode again
    await w.vm.$nextTick()

    expect(w.find('[data-test="sv-sort-menu"]').exists()).toBe(false)
  })
})

// ── export ZIP (§7e-1 fixes 401) ───────────────────────────────────────────────
describe('export ZIP', () => {
  function mockFetchOk() {
    const blob = new Blob(['zipdata'])
    return vi.fn().mockResolvedValue({ ok: true, status: 200, blob: () => Promise.resolve(blob) })
  }

  it('goes through fetch with an Authorization header, not window.location.href', async () => {
    const fetchSpy = mockFetchOk()
    vi.stubGlobal('fetch', fetchSpy)
    const createObjectURL = vi.fn(() => 'blob://x')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const hrefSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, set href(v: string) { hrefSpy(v) }, get href() { return 'unchanged' } },
      writable: true,
    })

    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets', count: 1000 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-zip"]').trigger('click')
    await flushPromises()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchSpy.mock.calls[0]
    expect(String(url)).toContain('/export')
    // fix round 1 · C1 (Critical): this endpoint only registers POST (route/v1/smartviews.go:34);
    // a default GET would be rejected by Echo as 405 -- without this assertion, a wrong method
    // would go undetected (verified by the reviewer's reverse mutation test).
    expect((opts as { method?: string }).method).toBe('POST')
    expect((opts as { headers: Record<string, string> }).headers.Authorization).toBe('tok-123')
    expect(hrefSpy).not.toHaveBeenCalled()
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)

    vi.unstubAllGlobals()
  })

  it('the download attribute on <a download> contains .zip', async () => {
    const fetchSpy = mockFetchOk()
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob://x'), revokeObjectURL: vi.fn() })
    const appendSpy = vi.spyOn(document.body, 'appendChild')

    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-zip"]').trigger('click')
    await flushPromises()

    const anchor = appendSpy.mock.calls.map((c) => c[0]).find((n) => (n as HTMLElement).tagName === 'A') as HTMLAnchorElement
    expect(anchor).toBeDefined()
    expect(anchor.download).toContain('.zip')

    vi.unstubAllGlobals()
  })

  it('fetch returns 401 (!ok) -> toast is photosSvExportFailed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-zip"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="sv-export-toast"]').text()).toContain(zh.photosFavExportFailed)
    vi.unstubAllGlobals()
  })
})

// SP15-P2c Task 7: the 'export album' describe block (Save as static album, exportAlbumAction/
// sv-export-album) is deleted here, not re-homed -- the capability itself is gone. The Vue2
// target's own history records the same deletion in the same commit range (see
// PhotosSmartViewDetail.vue's comment on `exportAlbumAction`'s removal for the full trail);
// this page's Convert entry already does the equivalent job (freezing the current matches
// into a regular album), so nothing the user could do is lost.

// ── delete ──────────────────────────────────────────────────────────────────
describe('delete smart view', () => {
  it('click more -> delete item -> confirmation dialog appears', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-delete"]').trigger('click')
    expect(w.find('[data-test="sv-confirm-scrim"]').exists()).toBe(true)
  })

  // SP15-P2b Task 5: after deletion the user lands on Albums, not the now-Moments-only
  // smart-views route (smart albums moved to Albums in Tasks 3/4).
  it('click confirm -> deleteSmartView is called -> router.push to the albums page + toast with undo', async () => {
    svc.photos.deleteSmartView.mockResolvedValue({})
    const { w, router } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    const pushSpy = vi.spyOn(router, 'push')
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-delete"]').trigger('click')
    await w.find('[data-test="sv-confirm-ok"]').trigger('click')
    await flushPromises()
    expect(svc.photos.deleteSmartView).toHaveBeenCalledWith('7')
    expect(pushSpy).toHaveBeenCalledWith('/photos/albums')
    expect(useToast().msg).toContain('Sunsets')
    const last = useToast().toasts[useToast().toasts.length - 1]
    expect(last.action?.label).toBe(zh.photosTrashUndo)
    expect(typeof last.action?.onClick).toBe('function')
  })

  // fix wave F3 (final-review must-fix): the undo callback used to be `void store.restoreSmartView(...)` --
  // when the underlying service.photos.createSmartView rejects, the store's restoreSmartView
  // throws (smartViews.ts:303-304), and `void` on the call swallows that throw entirely, so the
  // UI gives no feedback at all and it becomes an unhandled promise rejection. This pins down:
  // click undo -> the underlying call fails -> logs via console.error + shows a failure toast
  // (reusing the P3 trash's photosTrashRestoreFailed), without throwing an unhandled rejection.
  it('undo failure (restoreSmartView reject) -> logs via console.error + shows a failure toast, no unhandled rejection', async () => {
    svc.photos.deleteSmartView.mockResolvedValue({})
    svc.photos.createSmartView.mockRejectedValue(new Error('500'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-delete"]').trigger('click')
    await w.find('[data-test="sv-confirm-ok"]').trigger('click')
    await flushPromises()
    const last = useToast().toasts[useToast().toasts.length - 1]
    expect(last.action).toBeDefined()

    await expect(
      Promise.resolve().then(() => last.action?.onClick()),
    ).resolves.not.toThrow()
    await flushPromises()

    expect(errSpy).toHaveBeenCalledWith('[photos-smartviews] undo delete', expect.any(Error))
    expect(useToast().msg).toBe(zh.photosTrashRestoreFailed)
  })

  it('deleteSmartView reject -> no navigation + toast', async () => {
    svc.photos.deleteSmartView.mockRejectedValue(new Error('500'))
    const { w, router } = await mountView('7', [makeSv({ id: 7 })])
    const pushSpy = vi.spyOn(router, 'push')
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-delete"]').trigger('click')
    await w.find('[data-test="sv-confirm-ok"]').trigger('click')
    await flushPromises()
    expect(pushSpy).not.toHaveBeenCalledWith('/photos/albums')
    expect(useToast().msg).toBe(zh.photosSvDeleteFailed)
  })
})

// ── duplicate ──────────────────────────────────────────────────────────────────
// Both cases below used to assert against the generic
// `useToast()` -- Vue2's real duplicate confirmation is `window.PhotosToast.show(...)`, the
// photos-private bottom-pill toast. Updated to assert against `usePhotosToast()`'s queue.
describe('duplicate', () => {
  it('duplicateSmartView is called + photos-private toast (sparkles icon)', async () => {
    svc.photos.duplicateSmartView.mockResolvedValue(makeSv({ id: 9, name: 'Sunsets copy' }))
    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-duplicate"]').trigger('click')
    await flushPromises()
    expect(svc.photos.duplicateSmartView).toHaveBeenCalledWith('7')
    const toasts = usePhotosToast().toasts.value
    expect(toasts.some((t) => t.text.includes('Sunsets'))).toBe(true)
    expect(toasts.find((t) => t.text.includes('Sunsets'))?.icon).toBe('sparkles')
  })

  it('duplicateSmartView reject -> photos-private failure-copy toast (trash icon)', async () => {
    svc.photos.duplicateSmartView.mockRejectedValue(new Error('500'))
    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-duplicate"]').trigger('click')
    await flushPromises()
    const toasts = usePhotosToast().toasts.value
    expect(toasts.map((t) => t.text)).toContain(zh.photosSvDuplicateFailed)
    expect(toasts.find((t) => t.text === zh.photosSvDuplicateFailed)?.icon).toBe('trash')
  })
})

// ── SP15-P2b Task 8: smart album → regular album (reverse of Task 7's convertFromAlbum) ──
describe('convert to regular album', () => {
  let convertFromSmartView: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    convertFromSmartView = vi.spyOn(usePhotosAlbums(), 'convertFromSmartView')
  })

  async function openConvertConfirm(w: Awaited<ReturnType<typeof mountView>>['w']) {
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-convert"]').trigger('click')
  }

  it('offers Convert to regular album above the destructive separator', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, count: 12 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    const menu = w.find('[data-test="sv-more-menu"]')
    const html = menu.html()
    expect(menu.find('[data-test="sv-more-convert"]').exists()).toBe(true)
    // Grouped with rename/duplicate, i.e. before the separator, not next to Delete.
    expect(html.indexOf('sv-more-convert')).toBeLessThan(html.indexOf('sv-export-sep'))
  })

  it('asks for confirmation and spells out that the theme is discarded', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, count: 12 })])
    await openConvertConfirm(w)
    expect(w.find('[data-test="sv-more-menu"]').exists()).toBe(false)
    const body = w.find('[data-test="sv-convert-confirm"]').text()
    expect(body).toContain('12')
    expect(body).toContain(zh.photosSvConvertToAlbumBody.replace('{n}', '12'))
  })

  it('navigates to the new album on success', async () => {
    convertFromSmartView.mockResolvedValue({ id: 'al-new' } as never)
    const { w, router } = await mountView('7', [makeSv({ id: 7, count: 12 })])
    const push = vi.spyOn(router, 'push')
    await openConvertConfirm(w)
    await w.find('[data-test="sv-convert-ok"]').trigger('click')
    await flushPromises()
    expect(push).toHaveBeenCalledWith('/photos/albums/al-new')
  })

  // Vue2's real convert-success confirmation is
  // `window.PhotosToast.show({ icon: 'album', title: 'Converted to regular album' })` -- this
  // page's own `doConvertToAlbum()` used to call the generic `useToast()` instead, so a
  // bottom-pill confirmation never appeared for it. No prior test asserted this toast at
  // all (net-new coverage, not a changed assertion).
  it('shows the photos-private toast (album icon) on a successful convert', async () => {
    convertFromSmartView.mockResolvedValue({ id: 'al-new' } as never)
    const { w } = await mountView('7', [makeSv({ id: 7, count: 12 })])
    await openConvertConfirm(w)
    await w.find('[data-test="sv-convert-ok"]').trigger('click')
    await flushPromises()
    const toasts = usePhotosToast().toasts.value
    expect(toasts.map((t) => t.text)).toContain(zh.photosSvConvertedToAlbum)
    expect(toasts.find((t) => t.text === zh.photosSvConvertedToAlbum)?.icon).toBe('album')
  })

  it('keeps the confirmation open with an inline message when it fails', async () => {
    convertFromSmartView.mockRejectedValue(new Error('boom'))
    const { w, router } = await mountView('7', [makeSv({ id: 7, count: 12 })])
    const push = vi.spyOn(router, 'push')
    await openConvertConfirm(w)
    await w.find('[data-test="sv-convert-ok"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="sv-convert-confirm"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-convert-error"]').text()).toContain(zh.photosAlbumConvertFailed)
    expect(push).not.toHaveBeenCalledWith(expect.stringContaining('/photos/albums/'))
  })

  it('reuses the duplicate-name copy for a 409', async () => {
    convertFromSmartView.mockRejectedValue({ response: { status: 409 } })
    const { w } = await mountView('7', [makeSv({ id: 7, count: 12 })])
    await openConvertConfirm(w)
    await w.find('[data-test="sv-convert-ok"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="sv-convert-error"]').text()).toContain(zh.photosAlbumNameExists)
  })

  it('closes the convert confirmation on Escape', async () => {
    // Retitled in the final fix wave: the old title claimed this covered "along with any
    // other open overlay", but askConvertToAlbum closes the more menu on its way in, so no
    // second overlay is ever open here. The multi-overlay invariant (independent ifs, never
    // an early return) is covered by the existing export-menu + more-menu case.
    const { w } = await mountView('7', [makeSv({ id: 7, count: 12 })])
    await openConvertConfirm(w)
    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-convert-confirm"]').exists()).toBe(false)
  })

  // Task 8 cross-page sweep: this used to assert a local `.sv-confirm-ok.primary` modifier
  // class + this file's own raw CSS. The dialog was realigned to Vue2's actual `.lb-confirm-*`/
  // `.trash-btn-*` idiom (see the template's own comment) -- the button now carries the base
  // `trash-btn-cta` plus the `trash-btn-cta-primary` modifier (not `.danger`), and both rules
  // live solely in the globally-imported parity stylesheet, not this component's own <style>.
  it('dresses the confirm button as the filled primary CTA, not a second Cancel', async () => {
    // Vue2 uses trash-btn-cta-primary here (photos.scss:681-685) and reserves the danger
    // variant for the delete dialog. Without the modifier this button rendered with the base
    // ghost rule -- pixel-identical to the Cancel beside it, and with no hover at all.
    const { w } = await mountView('7', [makeSv({ id: 7, count: 12 })])
    await openConvertConfirm(w)
    const ok = w.find('[data-test="sv-convert-ok"]')
    expect(ok.classes()).toContain('trash-btn-cta-primary')
    expect(ok.classes()).not.toContain('trash-btn-cta-danger')
    expect(photosParityRaw).toMatch(/\.trash-btn-cta-primary\s*\{[^}]*background:\s*linear-gradient/)
    expect(photosParityRaw).toMatch(/\.trash-btn-cta-primary:hover\s*\{/)
  })

  // Task 8 cross-page sweep: this used to assert a local `.sv-confirm-icon.accent` colour-disc
  // modifier class. Vue2 never had one either -- it just passes a different icon colour per
  // dialog (delete red vs convert accent-hi) as a prop to its icon component; the template now
  // does the Vue3 equivalent with an inline `style="color: ..."`, same technique
  // PhotosAlbumDetail.vue's own delete dialog already uses.
  it('tints the convert dialog icon with the accent, not the delete red', async () => {
    // Vue2 :298 passes var(--accent-hi) for this album glyph; only :279's trash glyph is red.
    const { w } = await mountView('7', [makeSv({ id: 7, count: 12 })])
    await openConvertConfirm(w)
    expect(w.find('[data-test="sv-convert-confirm"] .lb-confirm-icon').attributes('style')).toContain('--accent-hi')
    // The delete dialog keeps the red disc (--danger, not --accent-hi). Fix-2 item 6 (owner
    // acceptance, 2026-08-13): was --remove-fg, a global token not shadowed on `.photos-root`
    // (so it did not follow the private photos-is-light toggle) -- switched to parity's own
    // --danger, declared directly on `.photos-root` and deliberately invariant across both of
    // its themes by spec, matching Vue2's own literal more closely too (see the report's sweep
    // table for the full trace).
    await w.find('[data-test="sv-convert-cancel"]').trigger('click')
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-delete"]').trigger('click')
    expect(w.find('[data-test="sv-confirm-scrim"] .lb-confirm-icon').attributes('style')).toContain('--danger')
  })

  it('does not dismiss the confirmation mid-flight', async () => {
    let release: (v: unknown) => void = () => {}
    convertFromSmartView.mockReturnValue(new Promise((r) => { release = r as (v: unknown) => void }))
    const { w } = await mountView('7', [makeSv({ id: 7, count: 12 })])
    await openConvertConfirm(w)
    await w.find('[data-test="sv-convert-ok"]').trigger('click')
    await w.find('[data-test="sv-convert-cancel"]').trigger('click')
    expect(w.find('[data-test="sv-convert-confirm"]').exists()).toBe(true)
    // Escape must be refused the same way the Cancel button is -- both route through
    // closeConvertToAlbum's busy guard rather than one of them poking the flag directly.
    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-convert-confirm"]').exists()).toBe(true)
    release({ id: 'al-new' })
    await flushPromises()
  })
})

// ── two-section photo grid ─────────────────────────────────────────────────────────────
describe('two-section photo grid', () => {
  it('newCount > 0 -> the "Recently added" section is present; === 0 -> absent', async () => {
    svc.photos.getSmartViewAssets.mockResolvedValue([])
    const { w: w1 } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 2 })])
    expect(w1.find('[data-test="sv-recent-head"]').exists()).toBe(true)
    const { w: w2 } = await mountView('8', [makeSv({ id: 8, addedThisWeek: 0 })])
    expect(w2.find('[data-test="sv-recent-head"]').exists()).toBe(false)
  })

  it('tile count matches the corresponding array length (3 matched / 2 recent)', async () => {
    svc.photos.getSmartViewAssets.mockImplementation(async (_id: string, opts: { recent?: boolean }) => {
      return opts?.recent ? [asset('r1'), asset('r2')] : [asset('a1'), asset('a2'), asset('a3')]
    })
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 2 })])
    expect(w.findAll('[data-test="sv-recent-tile"]')).toHaveLength(2)
    expect(w.findAll('[data-test="sv-all-tile"]')).toHaveLength(3)
  })

  // SP15-P2c Task 9: this used to assert `call[1]).toBe(store.matchedAssets)` -- the raw store
  // array, by reference. Task 9 hands the lightbox `matchedSet` (the Sort-applied view) instead,
  // and `sortAlbumPhotos` always returns a fresh `[...photos]` copy (util/albumView.ts) even in
  // the default 'score' ordering, so the reference check would now fail even though the content
  // is identical. Content is what matters here (there is only one asset, so score-order content
  // is indistinguishable from taken-order content) -- the ordering divergence is covered by the
  // two tests above.
  it('tile click still calls lb.openAt with content matching store.matchedAssets (now a separate sorted snapshot, not the same reference), startMs 0, no query', async () => {
    svc.photos.getSmartViewAssets.mockImplementation(async (_id: string, opts: { recent?: boolean }) => {
      return opts?.recent ? [] : [asset('a1')]
    })
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 0 })])
    await w.find('[data-test="sv-all-tile"]').trigger('click')
    const store = usePhotosSmartViews()
    expect(mockLb.openAt).toHaveBeenCalledTimes(1)
    const call = mockLb.openAt.mock.calls[0]
    expect(call[1]).toEqual(store.matchedAssets)
    expect(call[1]).not.toBe(store.matchedAssets)
    expect(call[2]).toBe(0)
    expect(call[3]).toBeUndefined()
  })

  it('an isNew: true item has its .new-tag disappear once clicked (optimistic in-place clear)', async () => {
    svc.photos.getSmartViewAssets.mockImplementation(async (_id: string, opts: { recent?: boolean }) => {
      return opts?.recent ? [asset('r1', { isNew: true })] : [asset('r1', { isNew: true })]
    })
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 1 })])
    const tile = w.find('[data-test="sv-recent-tile"]')
    expect(tile.find('.new-tag').exists()).toBe(true)
    await tile.trigger('click')
    await w.vm.$nextTick()
    expect(tile.find('.new-tag').exists()).toBe(false)
  })
})

// This page always called `lb.openAt` (state opened,
// network fired) but never mounted a `<PhotoLightbox>` of its own -- nothing on this page's own
// tree ever rendered the photo. Added the mount; these cases assert the DOM actually appears
// (not just that `openAt` was called, which every case above already covered) and that the
// wired events invoke the right underlying store actions.
describe('Fix-12: the lightbox is mounted on this page and its events are wired', () => {
  it('clicking a tile renders the lightbox DOM (not just calling openAt)', async () => {
    svc.photos.getSmartViewAssets.mockImplementation(async (_id: string, opts: { recent?: boolean }) => {
      return opts?.recent ? [] : [asset('a1')]
    })
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 0 })])
    expect(w.find('.lightbox').exists()).toBe(false)
    await w.find('[data-test="sv-all-tile"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.lightbox').exists()).toBe(true)
  })

  // Plan F Task 5 (2026-08-15): flipped from OUTSIDE to INSIDE -- the Fix-8 round 4 rule this
  // test used to assert no longer applies. Plan F Tasks 3-5 re-skinned PhotoLightbox.vue's DOM/
  // CSS onto parity's own grid shape and retired the local skeleton CSS that used to duplicate
  // parity's `.photos-root .lightbox`/`.lb-*` selectors (Task 5), removing the same-specificity
  // cascade tie that made nesting unsafe. See task-5-report.md for the full sweep.
  it('the lightbox renders INSIDE .photos-root (Plan F Task 5: the re-skin removed the F8-r4 cascade tie)', async () => {
    svc.photos.getSmartViewAssets.mockImplementation(async (_id: string, opts: { recent?: boolean }) => {
      return opts?.recent ? [] : [asset('a1')]
    })
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 0 })])
    await w.find('[data-test="sv-all-tile"]').trigger('click')
    await w.vm.$nextTick()
    const lightbox = w.get('.lightbox').element
    expect(lightbox.closest('.photos-root')).not.toBeNull()
  })

  it('@delete deletes the underlying asset via timeline.deleteAssets and refreshes this view', async () => {
    svc.photos.getSmartViewAssets.mockImplementation(async (_id: string, opts: { recent?: boolean }) => {
      return opts?.recent ? [] : [asset('a1')]
    })
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 0 })])
    const timeline = useTimelineStore()
    const deleteSpy = vi.spyOn(timeline, 'deleteAssets').mockResolvedValue(1)
    svc.photos.getSmartViewAssets.mockClear()
    svc.photos.getSmartViewExcluded.mockClear()

    await w.find('[data-test="sv-all-tile"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('.lb-delete').trigger('click')
    await w.vm.$nextTick()
    await w.find('.trash-btn-cta-danger').trigger('click')
    await flushPromises()

    expect(deleteSpy).toHaveBeenCalledWith(['a1'])
    // loadDetail/loadExcluded refresh this view's own data after the delete lands.
    expect(svc.photos.getSmartViewAssets).toHaveBeenCalled()
    expect(svc.photos.getSmartViewExcluded).toHaveBeenCalled()
  })

  it('@add-to-album opens AlbumPickerDialog for the current photo', async () => {
    svc.photos.getSmartViewAssets.mockImplementation(async (_id: string, opts: { recent?: boolean }) => {
      return opts?.recent ? [] : [asset('a1')]
    })
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 0 })])
    await w.find('[data-test="sv-all-tile"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('.lb-add-album').trigger('click')
    await w.vm.$nextTick()
    expect(w.get('[data-test="album-picker-overlay"]').element).toBeTruthy()
  })
})

// ── overlays ──────────────────────────────────────────────────────────────────
describe('overlays: menus open together + Esc + click-outside close', () => {
  // Re-homed (Task 7): was 'open export then more, one Esc closes both'. The export menu no
  // longer exists as an independent overlay -- ZIP is now inside the unified more menu. The
  // invariant this test guards (multiple independent `if`s in onDocumentKeydown, never an
  // early return, so one Escape closes every open overlay) still needs two *independent*
  // overlays to be meaningful; the sort menu and the more menu are the pair left on this page.
  it('opens the sort menu then the more menu, and one Escape closes both', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-sort-btn"]').trigger('click')
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    expect(w.find('[data-test="sv-sort-menu"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-more-menu"]').exists()).toBe(true)
    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-sort-menu"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-more-menu"]').exists()).toBe(false)
  })

  // 'click outside the menu (mousedown, bubbles: true) -> closes' (used to read sv-export-toggle/sv-export-menu)
  // is superseded by "SP15-P2c Task 7" describe block's own "still closes the menu on an
  // outside click" -- identical mechanism, same assertion, sv-more-toggle/sv-more-menu instead.
})

// ── non-color visual properties: anchor the rule body first, then assert the property (a file-wide toContain is trivially true and proves nothing) ──
describe('style: non-color visual properties 1:1 (property-by-property against Vue2 inline style)', () => {
  it('.sv-grid-photos-recent keeps the inline padding-bottom:18px from Vue2 :136 (absent from the all-matches section)', () => {
    const rules = parseCssRules(extractStyleBlock(photosSmartViewDetailRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-grid-photos-recent')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('padding-bottom: 18px')
  })

  it('.sv-more-menu keeps the inline min-width:220px from Vue2 :103', () => {
    const rules = parseCssRules(extractStyleBlock(photosSmartViewDetailRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-more-menu')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('min-width: 220px')
  })

  // Plan C Task 5 re-skin fix: Vue2's own inline style on this button (:180) is
  // `min-width:36px`, not 32px -- a 4px drift this task's shadowing pass caught and corrected;
  // this guard now locks the right value.
  it('.sv-action-btn-icon keeps the padding/min-width/justify-content trio inline from Vue2 :180', () => {
    const rules = parseCssRules(extractStyleBlock(photosSmartViewDetailRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-action-btn-icon')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('padding: 0 10px')
    expect(rule?.body).toContain('min-width: 36px')
    expect(rule?.body).toContain('justify-content: center')
  })

  // fix round 1 · M2: the two-column layout container (scss:161-166).
  it('.sv-detail-layout is grid-template-columns: 1fr 320px (Vue2 two-column layout)', () => {
    const rules = parseCssRules(extractStyleBlock(photosSmartViewDetailRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-detail-layout')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('grid-template-columns: 1fr 320px')
  })

  it('inside the <=768px media query, .sv-detail-layout collapses to a single column (grid-template-columns: 1fr)', () => {
    const style = extractStyleBlock(photosSmartViewDetailRaw)
    const m = /@media \(max-width: 768px\)\s*\{([\s\S]*)\}\s*$/.exec(style)
    expect(m).not.toBeNull()
    const rules = parseCssRules(m![1])
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-detail-layout')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('grid-template-columns: 1fr')
  })

  // fix round 1 · I2: the transition for both menus + the delete confirmation dialog -- Vue3
  // uses `-enter-from` (not Vue2's `-enter`).
  it('.sv-menu-enter-from / .sv-menu-leave-to keep the opacity+translateY+scale from Vue2 scss:454-455', () => {
    const rules = parseCssRules(extractStyleBlock(photosSmartViewDetailRaw))
    const rule = rules.find((r) => r.selectors.includes('.sv-menu-enter-from') && r.selectors.includes('.sv-menu-leave-to'))
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('opacity: 0')
    expect(rule?.body).toContain('translateY(-4px) scale(0.97)')
  })

  // Task 8 cross-page sweep: renamed from `.sv-confirm-enter-from`/`.sv-confirm-leave-to` --
  // the dialog's own scrim/panel/button classes were realigned to Vue2's actual `.lb-confirm-*`
  // idiom (see the template's own comment), so the Vue3 `-enter-from` transition-name
  // translation this rule provides now carries the matching `.lb-confirm-*` name too.
  it('.lb-confirm-enter-from / .lb-confirm-leave-to keep the opacity+scale from Vue2 photos.scss:705-707', () => {
    const rules = parseCssRules(extractStyleBlock(photosSmartViewDetailRaw))
    const rule = rules.find((r) => r.selectors.includes('.lb-confirm-enter-from') && r.selectors.includes('.lb-confirm-leave-to'))
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('opacity: 0')
    expect(rule?.body).toContain('scale(0.95)')
  })

  // fix round 1 · I3: the inset shadow on the inner side of the accent ring over light photos (scss:506-513).
  it('.sv-grid-photos .tile.recent::after keeps the inset box-shadow from Vue2', () => {
    const rules = parseCssRules(extractStyleBlock(photosSmartViewDetailRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-grid-photos .tile.recent::after')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('box-shadow: inset 0 0 0 2px')
  })
})

// fix round 1 · I2 (the menus/dialogs are actually wrapped in <Transition>, not just defined in styles but unused in the template) ────
describe('the overlay <Transition> wrapper is actually wired up (checked against source text, not a dormant style block)', () => {
  // Re-homed (Task 7): the export menu's own <Transition name="sv-menu"> is gone along with
  // the button that opened it, leaving exactly one -- the unified more menu's. The target
  // (33b05636 :78) wraps its own merged menu in <transition name="sv-menu"> too, so the wrapper
  // itself is 1:1 with Vue2; only the *count* here (one, not two) is New-UI-specific fallout
  // from Task 6 having parked two separate menus that Task 7 then merged into one.
  it('the more menu\'s data-test marker sits inside its <Transition name="sv-menu"> pair', () => {
    const menuBlocks = [...photosSmartViewDetailRaw.matchAll(/<Transition name="sv-menu">([\s\S]*?)<\/Transition>/g)]
    expect(menuBlocks.length).toBe(1)
    expect(menuBlocks[0][1]).toContain('data-test="sv-more-menu"')
  })

  // Task 8 cross-page sweep: `<Transition name="sv-confirm">` renamed to `name="lb-confirm"`
  // (matching Vue2's own transition name, PhotosSmartViewDetail.vue:365/386) -- the `data-test`
  // attribute itself is untouched, only the wrapping Transition's name and the scrim's class
  // changed. The non-greedy regex still isolates the delete dialog specifically: this page now
  // has two `<Transition name="lb-confirm">` blocks (delete + convert), and `.exec` without the
  // global flag returns only the first, non-greedy match -- i.e. the delete dialog's own block.
  it('lb-confirm-scrim from the delete confirmation dialog appears inside <Transition name="lb-confirm">', () => {
    const m = /<Transition name="lb-confirm">([\s\S]*?)<\/Transition>/.exec(photosSmartViewDetailRaw)
    expect(m).not.toBeNull()
    expect(m![1]).toContain('data-test="sv-confirm-scrim"')
  })
})

// ── cssCascade: hover attribution variant ─────────────────────────────────────────────
describe('style: hover cascade attribution variant', () => {
  // Task 11 (c): the `.sv-action-btn-primary` cascade regression that used to open this block is
  // gone with the rule it guarded -- Task 7 folded the Export button (the class's only consumer)
  // into the unified "..." menu, so the selector this test queried no longer exists on the page.
  // The same variant, and the same regression, still live on PhotosMomentDetail.test.ts:874-880.

  it('.sv-export-item / .sv-export-item-danger (delete item): the winning hover rule contains :hover and belongs to the variant', () => {
    const style = extractStyleBlock(photosSmartViewDetailRaw)
    const win = winningHoverBackground(style, ['sv-export-item', 'sv-export-item-danger'])
    expect(win.selector).toContain(':hover')
    expect(win.selector).toContain('sv-export-item-danger')
    expect(win.specificity).toBe(3)
  })

  // SP15-P2c Task 8, coordinator review fix round 2: this rehomes the deleted
  // SmartViewConditionEditor.test.ts's cssCascade assertion for the condition chip's own
  // hover rule, moved in from that component along with the markup. Query with the SAME
  // two-class form the two sibling tests above use (base + variant), not a single-class
  // query -- a single-class query silently drops any base `.sv-cond:hover` rule from
  // consideration before the cascade comparison ever runs (the helper filters candidates by
  // class-membership against the list passed in), which would make this test blind to the
  // exact base-beats-variant regression it exists to catch. `.sv-cond` has no `:hover` rule
  // today, but the query still has to include it so the test would actually fail if one were
  // ever added with equal-or-higher specificity than `.sv-cond-removable:hover` -- see the
  // mutation check in task-8-report.md for proof this form (not the single-class form tried
  // first) actually reddens on that scenario.
  it('.sv-cond / .sv-cond-removable (condition chip) hover-winning rule contains :hover and belongs to the variant', () => {
    const style = extractStyleBlock(photosSmartViewDetailRaw)
    const win = winningHoverBackground(style, ['sv-cond', 'sv-cond-removable'])
    expect(win.selector).toContain(':hover')
    expect(win.selector).toContain('sv-cond-removable')
  })
})

// ── red goes through a token, no literal color value ────────────────────────────────────────────────────
describe('red goes through a token, not hardcoded as a literal', () => {
  // --remove-fg switched to --danger throughout
  // this file -- --remove-fg is a global token not shadowed on `.photos-root`, so it did not
  // follow the private photos-is-light toggle; --danger is declared directly on `.photos-root`
  // and deliberately invariant across both of its own themes by spec.
  it('the style block contains the --danger family, not the literal #FF6B5C', () => {
    const style = extractStyleBlock(photosSmartViewDetailRaw)
    expect(style).toContain('--danger')
    expect(style).not.toContain('#FF6B5C')
    expect(style.toUpperCase()).not.toContain('#FF6B5C')
  })
})

// This page is the SMART ALBUM detail (saved
// search / conds+threshold+live, makeSv's own shape above) -- Vue2 renders it as
// <photos-smart-view-detail> INSIDE PhotosAlbumsView.vue (:23-45), i.e. nested under
// activeNav==='albums', the exact same nesting as <photos-album-detail> a few lines above it
// (:3-21). This is a different concept from the "Moments · For You" band (PhotosMomentDetail's
// own Vue2 home, activeNav==='smart') -- despite the route name here being "smart-views", the
// Vue2 nav it lives under is 'albums'. So the topbar here matches PhotosAlbums.vue/
// PhotosAlbumDetail.vue exactly: title='Albums', sub=album-aggregate counts (not the
// default full-library line).
describe('Fix-1 item 1: PhotosTopbar restored (title=Albums, album-aggregate sub -- smart views nest under the Albums nav in Vue2)', () => {
  it('renders the topbar with title=Albums and the album-aggregate sub, no search box', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 1, name: 'A', photoCount: 30, videoCount: 1 }])
    const { w } = await mountView()
    expect(w.findComponent(PhotosTopbar).exists()).toBe(true)
    expect(w.get('.topbar-title').text()).toBe(zh.photosAlbumsTitle)
    expect(w.get('.topbar-sub').text()).toBe(
      zh.photosCountSummary.replace('{photos}', '30').replace('{videos}', '1'),
    )
    expect(w.find('.topbar .search').exists()).toBe(false)
  })

  it('passes hide-drawer-trigger to PhotosSidebar', async () => {
    const { w } = await mountView()
    expect(w.findComponent(PhotosSidebar).props('hideDrawerTrigger')).toBe(true)
  })
})
