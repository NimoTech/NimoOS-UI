// SP15-P1-T5: the "Moments · For You" band at the top of the smart views page.
// Target is Vue2 899af59b:PhotosSmartViewsView.vue:31-44 (mo-section) + :46 (sv-hero
// picking up the sv-hero-secondary divider) + :455 (showMoments gating).
//
// Two mechanical deviations from the plan brief's literal test code, both logged:
//
//  1) Does not build its own createI18n instance. vitest.setup.ts already installs the
//     src/i18n singleton into `config.global.plugins` for every mount, and @vue/test-utils
//     concatenates that with any plugin array passed via `global.plugins` on an individual
//     mount() call rather than replacing it — a second createI18n() would get installed on
//     the very same app alongside the global one, and vue-i18n's install() unconditionally
//     registers its components/directives, producing "already registered" [Vue warn] noise
//     on every mount. Same fix already applied at MomentCard.test.ts:5-14 and
//     PhotosToolbar.test.ts:7-12 (project memory: "New-UI 测试别另建 createI18n"). The global
//     singleton defaults to 'zh_cn', which is all this file needs.
//  2) Moment/settings fixtures are written into the stores *after* `mountPage()` returns
//     (which flushes the mount's initial promises), not before. Both PhotosSmartViews.vue's
//     onMounted fires a real `moments.fetchMoments()` and `settings.fetchAiFeatures()` against
//     the mocked service — writing test data into the store *before* mounting loses a race
//     against that real fetch's resolution (the mocked `listMoments`/`getConfig` responses
///    resolve in a microtask and unconditionally overwrite `moments.value` / `aiFeatures.value`
//     once the fetch settles). Setting fixtures after the initial fetch has already settled
//     avoids the race outright, rather than trying to out-time it.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

const svc = vi.hoisted(() => ({
  photos: {
    thumbnailUrl: vi.fn((id: string, size: string) => `mock://${id}/${size}`),
    listMoments: vi.fn(async () => []),
    listSmartViews: vi.fn(async () => []),
    getConfig: vi.fn(async () => ({})),
    reorderMoments: vi.fn(async () => ({})),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// SP15-P1-T6: fake sortablejs so drag-drop can be simulated by invoking the captured
// onEnd callback directly, same technique as useAlbumDragSort.test.ts.
const sortableCreate = vi.hoisted(() => vi.fn((..._args: unknown[]) => ({ destroy: vi.fn() })))
vi.mock('sortablejs', () => ({ default: { create: sortableCreate } }))

import PhotosSmartViews from './PhotosSmartViews.vue'
import { usePhotosMoments, type Moment } from '../photos/stores/moments'
import { usePhotosSettingsStore } from '../photos/stores/settings'
import { useToast } from '../stores/toast'

function makeMoment(over: Partial<Moment> = {}): Moment {
  return {
    id: 'm1', title: 'Bozeman', subtitle: 'Nov 2016', place: 'Bozeman',
    recipeKey: 'trip:1', coverAssetId: 'c1', featuredAssetIds: ['f1', 'f2'],
    assetCount: 42, addedThisWeek: 0, coverRatio: 1.5,
    timeFrom: '', timeTo: '', updatedAt: '', ...over,
  }
}

function makeRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/photos/smart-views/:id', component: { template: '<div/>' } },
      { path: '/photos/moments/:id', name: 'photos-moment-detail', component: { template: '<div/>' } },
      { path: '/photos/settings', component: { template: '<div/>' } },
    ],
  })
}

async function mountPage() {
  const router = makeRouter()
  await router.push('/')
  await router.isReady()
  const w = mount(PhotosSmartViews, { global: { plugins: [router] } })
  // Let onMounted's fetchMoments()/fetchAiFeatures() calls settle against the mocked
  // service before any test overwrites store state (deviation 2 above).
  await flushPromises()
  return { w, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('band gating', () => {
  it('renders nothing when there are no moments (the core semantics of Vue2 showMoments)', async () => {
    const { w } = await mountPage()
    expect(w.find('[data-test="mo-section"]').exists()).toBe(false)
  })

  it('renders the band when moments exist, with title/description from i18n', async () => {
    const { w } = await mountPage()
    const s = usePhotosMoments()
    s.moments = [makeMoment()]
    await nextTick()
    expect(w.find('[data-test="mo-section"]').exists()).toBe(true)
    expect(w.text()).toContain('时刻 · 为你推荐')
  })

  it('hides the band when aiFeatures.smartview is false, even with moments present', async () => {
    const { w } = await mountPage()
    const s = usePhotosMoments()
    s.moments = [makeMoment()]
    const settings = usePhotosSettingsStore()
    settings.aiFeatures.smartview = false
    await nextTick()
    expect(w.find('[data-test="mo-section"]').exists()).toBe(false)
  })

  it('treats a missing aiFeatures.smartview field as enabled (no scary default)', async () => {
    const { w } = await mountPage()
    const s = usePhotosMoments()
    s.moments = [makeMoment()]
    await nextTick()
    expect(w.find('[data-test="mo-section"]').exists()).toBe(true)
  })
})

describe('grid', () => {
  it('renders one card per moment, sizing/template pulled from the store sizeMap', async () => {
    const { w } = await mountPage()
    const s = usePhotosMoments()
    s.moments = [makeMoment({ id: 'a' }), makeMoment({ id: 'b', coverRatio: 0.6 })]
    await nextTick()
    const cards = w.findAll('.mo-card')
    expect(cards).toHaveLength(2)
    expect(cards[1].classes()).toContain('mo-card-tall')
  })

  it('clicking a card navigates to /photos/moments/:id', async () => {
    const { w, router } = await mountPage()
    const s = usePhotosMoments()
    s.moments = [makeMoment({ id: 'zz' })]
    await nextTick()
    await w.find('.mo-card').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos/moments/zz')
  })
})

// SP15-P2b Task 5: the smart-views hero this divider used to react to no longer exists on
// this page at all (it moved to PhotosAlbums.vue in Tasks 3/4, which has its own layout and
// no `.sv-hero-secondary` concept). Both cases below asserted a class on `.sv-hero`, an
// element this page no longer renders — deleted rather than rewritten, since there is no
// "relationship with the smart-views hero" left on this route to test. No coverage moves
// anywhere: the two-sections-stacked-with-a-divider layout this guarded was specific to the
// old combined page and does not have an equivalent on either side of the split.

describe('fetching', () => {
  it('fetches moments once on mount', async () => {
    await mountPage()
    expect(svc.photos.listMoments).toHaveBeenCalledTimes(1)
  })
})

// SP15-P1-T6: drag-to-reorder. The band reuses useAlbumDragSort (already covered by
// useAlbumDragSort.test.ts) — these cases only check the wiring: the DOM order read by
// the composable's onEnd reaches store.reorder(), a failed reorder toasts, and the
// hidden→shown transition rebinds a fresh Sortable instance.
//
// Deviation from the brief's literal snippet (same reasoning as this file's header
// "deviation 2"): moment fixtures are set *after* mountPage() resolves, not before —
// setting them first loses a race against onMounted's real fetchMoments() call, whose
// mocked listMoments() resolves to [] and would silently overwrite the fixture.
type CapturedSortableOptions = { onStart: () => void; onEnd: () => void | Promise<void> }
describe('drag-to-reorder', () => {
  it('dropping calls store.reorder with the DOM order after the drop', async () => {
    const { w } = await mountPage()
    const s = usePhotosMoments()
    s.moments = [makeMoment({ id: 'a' }), makeMoment({ id: 'b' })]
    const spy = vi.spyOn(s, 'reorder').mockResolvedValue(true)
    await nextTick()
    // Let the hidden->shown watch's nextTick(drag.refresh()) run before grabbing the
    // latest Sortable.create() call.
    await new Promise((r) => setTimeout(r, 0))

    // Simulate Sortable having reordered the DOM on drop.
    const grid = w.find('.mo-grid').element
    grid.appendChild(grid.firstElementChild!) // "a" moves to the end
    const opts = sortableCreate.mock.calls[sortableCreate.mock.calls.length - 1][1] as CapturedSortableOptions
    opts.onEnd()

    expect(spy).toHaveBeenCalledWith(['b', 'a'])
  })

  it('toasts a failure message when reorder() resolves false', async () => {
    const { w } = await mountPage()
    const s = usePhotosMoments()
    s.moments = [makeMoment({ id: 'a' }), makeMoment({ id: 'b' })]
    vi.spyOn(s, 'reorder').mockResolvedValue(false)
    const toast = useToast()
    const spy = vi.spyOn(toast, 'show')
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))

    const grid = w.find('.mo-grid').element
    grid.appendChild(grid.firstElementChild!)
    const opts = sortableCreate.mock.calls[sortableCreate.mock.calls.length - 1][1] as CapturedSortableOptions
    await opts.onEnd()
    await new Promise((r) => setTimeout(r, 0))

    expect(spy).toHaveBeenCalledWith('排序保存失败', expect.anything(), 'danger')
  })

  // SP15-P1 final fix wave, finding 1. Sortable's own post-drag click suppression
  // (`ignoreNextClick`) is cleared by the first `dragover`, so a drag that actually
  // reorders is left unprotected and the drop's click used to navigate into the moment
  // that was just dragged. The composable exposes isDragging() for exactly this, and the
  // sibling album grid already consults it.
  it('a drag in progress suppresses the card click, so a reorder does not also open the moment', async () => {
    const { w, router } = await mountPage()
    const s = usePhotosMoments()
    s.moments = [makeMoment({ id: 'a' }), makeMoment({ id: 'b' })]
    vi.spyOn(s, 'reorder').mockResolvedValue(true)
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))

    const opts = sortableCreate.mock.calls[sortableCreate.mock.calls.length - 1][1] as CapturedSortableOptions
    opts.onStart() // the pointer is now dragging a card
    await w.find('.mo-card').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/')
  })

  it('rebinds Sortable when the band goes from hidden to shown (a freshly mounted .mo-grid node)', async () => {
    const { w } = await mountPage()
    const before = sortableCreate.mock.calls.length
    const s = usePhotosMoments()
    s.moments = [makeMoment()]
    await w.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 0))
    expect(sortableCreate.mock.calls.length).toBeGreaterThan(before)
  })
})

// SP15-P2b Task 5: the smart-view grid, hero, create tile and create dialog moved to
// PhotosAlbums.vue (Tasks 3/4) — this page is now Moments-only. These cases pin down that
// the removal actually happened (not just "the new stuff still works").
describe('SP15-P2b: smart-view list responsibilities are gone from this page', () => {
  it('renders the Moments band as the page\'s only hero (h1), with none of the old smart-view entry points', async () => {
    const { w } = await mountPage()
    const s = usePhotosMoments()
    s.moments = [makeMoment()]
    await nextTick()
    // Scoped to .mo-hero: PhotosSidebar carries its own h1 (photosTitle, "相册") that is
    // unrelated to this page's content and always renders first in DOM order — a bare
    // `w.find('h1')` would pick that one up instead.
    const h1 = w.find('.mo-hero h1')
    expect(h1.exists()).toBe(true)
    expect(h1.text()).toContain('时刻')
    // Everything the smart-view list used to own is gone from this page (moved to
    // PhotosAlbums.vue in Tasks 3/4 — see task-5-report.md for exactly where).
    expect(w.find('[data-test="sv-hero-create"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-create-card"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-skeleton"]').exists()).toBe(false)
    expect(w.findAll('[data-test="sv-card"]')).toHaveLength(0)
  })

  it('no longer fetches the smart view list on this page', async () => {
    await mountPage()
    expect(svc.photos.listSmartViews).not.toHaveBeenCalled()
  })

  it('shows the slim settings hint instead of the band when smart views are off, even with moments present', async () => {
    const { w } = await mountPage()
    const s = usePhotosMoments()
    s.moments = [makeMoment()]
    const settings = usePhotosSettingsStore()
    settings.aiFeatures.smartview = false
    await nextTick()
    expect(w.find('[data-test="mo-section"]').exists()).toBe(false)
    expect(w.find('[data-test="mo-off-hint"]').exists()).toBe(true)
  })

  it('shows neither the band nor the hint when there are simply no moments (the everyday real-device state)', async () => {
    const { w } = await mountPage()
    // No moments fixture set — mountPage's mocked listMoments() already resolved to [].
    expect(w.find('[data-test="mo-section"]').exists()).toBe(false)
    expect(w.find('[data-test="mo-off-hint"]').exists()).toBe(false)
  })
})
