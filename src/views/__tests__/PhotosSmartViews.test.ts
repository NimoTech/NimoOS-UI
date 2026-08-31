// PhotosSmartViews.vue — smart-view list page tests. Maps line-for-line to
// the "required cases" checklist. Mounts Pinia + i18n + a real router (resolving
// for real once before spying on push, since AreaShell/PhotosSidebar both use useRouter() —
// following PhotosPeople.test.ts's existing mounting pattern), mocking the shared package's
// photos methods.
//
// As of Vue2 939a7d3a: the smart-view grid, its hero, the create tile, and the
// create dialog all moved to PhotosAlbums.vue — this page is Moments-only now.
// Every test in this file that exercised a smart-view list responsibility (fetching the
// list, the loading skeleton, the hero create button, the create-tile/dialog, a card's
// `@open`, and the two CSS structural checks on `.svs-banner`/`.sv-create-btn`) has been
// deleted rather than rewritten to keep passing against the new shape — that functionality
// and its coverage now live on PhotosAlbums.vue (see PhotosAlbums.test.ts).
//
// What survives here: the `aiSmartViewOff` → `settings.fetchAiFeatures()` dedup behaviour
// (this page still consumes that store directly, unrelated to the smart-view list) and the
// `.app` grid responsive CSS structural check (from the re-shell: was a `.photos-layout`
// check before the page moved onto the Vue2 `.app` grid shell). The Moments band itself — rendering,
// gating, drag-reorder, the new slim settings hint, and the h2→h1 promotion — is covered in
// the sibling file `../PhotosSmartViews.moments.test.ts` (the established home for
// band behaviour; new cases were added there, not duplicated here).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    getConfig: vi.fn().mockResolvedValue({}),
    thumbnailUrl: vi.fn((id: string, size: string) => `mock://thumb/${id}/${size}`),
    listMoments: vi.fn(async () => []),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosSmartViews from '../PhotosSmartViews.vue'
// Established review precedent (PhotosPeople.test.ts): `?raw` is only used for structural
// assertions against the <style> source text, never for behavioral assertions.
import photosSmartViewsRaw from '../PhotosSmartViews.vue?raw'
import { usePhotosSettingsStore } from '../../photos/stores/settings'
import PhotosTopbar from '../../photos/components/PhotosTopbar.vue'
import PhotosSidebar from '../../photos/components/PhotosSidebar.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/'),
    routes: [
      { path: '/photos/smart-views', name: 'photos-smart-views', component: PhotosSmartViews },
      { path: '/photos/moments/:id', name: 'photos-moment-detail-stub', component: { template: '<div/>' } },
      // (§7e-9): the settings link points at /photos/settings?section=ai — the stub
      // route lets RouterLink actually resolve an href, otherwise vue-router warns "no match".
      { path: '/photos/settings', name: 'photos-settings-stub', component: { template: '<div/>' } },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/photos/smart-views')
  await router.isReady()
  const w = mount(PhotosSmartViews, { global: { plugins: [i18n, router] } })
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  svc.photos.getConfig.mockClear().mockResolvedValue({})
  svc.photos.thumbnailUrl.mockClear()
  svc.photos.listMoments.mockClear().mockResolvedValue([])
})

describe('PhotosSmartViews.vue — aiFeatures fetch dedup (§7e-15, unrelated to the smart-view list)', () => {
  // (§7e-10): aiSmartViewOff has been folded into the photosSettings store, this page no
  // longer reads getConfig directly itself — onMounted goes through settings.fetchAiFeatures(),
  // the same absorption precedent as PhotosPeople.vue.
  //
  // review fix (take-along, tightening the assertion): this used to be `toHaveBeenCalled()`;
  // before tightening it to `toHaveBeenCalledTimes(...)` the actual count was manually
  // verified first — `mountView()` mounts the full `PhotosSmartViews` (the template contains
  // `<PhotosSidebar />`, and T6 also wired fetchAiFeatures into the sidebar), so after mounting
  // the spy records **two** action calls (one from this page itself + one from the sidebar it
  // mounts), not 1 — same as the existing precedent in PhotosPeople.test.ts:104-112 and
  // PhotosSettings.test.ts (both of those are also 2, for the same reason). This number was
  // settled by temporarily changing it to `toHaveBeenCalledTimes(1)` and running it manually,
  // confirming it fails (got 2 times) — not copied verbatim from a review suggestion.
  it('aiSmartViewOff reads the store rather than calling getConfig itself (onMounted goes through settings.fetchAiFeatures, 2 action calls total including the sidebar it mounts)', async () => {
    const settings = usePhotosSettingsStore()
    const spy = vi.spyOn(settings, 'fetchAiFeatures')
    await mountView()
    expect(spy).toHaveBeenCalledTimes(2)
  })

  // review fix (Important 1): the previous case spies on the store's action, not the network
  // layer — this one doesn't spy on fetchAiFeatures, letting the real implementation run, and
  // counts calls directly at the HTTP layer (`svc.photos.getConfig`), proving that "the page
  // itself + the sidebar it mounts each call the action once in the same frame" ultimately
  // lands as only one real request (the invariant §7e-15 needs — settings.ts's
  // aiFeaturesInFlight dedup).
  it('§7e-15 network-level dedup proof: PhotosSmartViews itself + the PhotosSidebar it mounts each call fetchAiFeatures once in the same frame, but the real getConfig only fires once', async () => {
    await mountView()
    expect(svc.photos.getConfig).toHaveBeenCalledTimes(1)
  })
})

// ── style block structural assertions (?raw, following the existing color-guard /
// PersonAssetGrid.test.ts precedent) ──
describe('PhotosSmartViews.vue — style block structural check', () => {
  // After the re-skin the sidebar width is owned by the `.app` CSS grid
  // column, so narrowing to ≤768px now collapses the whole sidebar column (the same
  // `.app { grid-template-columns: 1fr; }` as Photos.vue) rather than setting `gap: 0` on
  // `.photos-layout`.
  it('.app collapses the sidebar column to a single column inside the ≤768px media query (matching the shape Photos.vue established)', () => {
    const m = /@media \(max-width: 768px\)\s*\{([^}]*\{[^}]*\})*[^}]*\}/.exec(photosSmartViewsRaw)
    expect(m).not.toBeNull()
    expect(photosSmartViewsRaw).toContain('.app { grid-template-columns: 1fr; }')
  })
})

// Vue2 mounts the same <PhotosTopbar> for
// activeNav === 'smart' (PhotosTimeline.vue:957-971) with title = topbarTitle's 'smart' branch
// ('For You', PhotosTimeline.vue:190) and sub = topbarSubContext's DEFAULT branch (navMap has
// no 'smart' entry, PhotosTimeline.vue:229-234) -- the same full-library count line the topbar
// already computes on its own by default, so no `sub` override is needed from this page.
describe('PhotosTopbar restored (title=For You, default full-library sub)', () => {
  it('renders the topbar with title=For You, no search box', async () => {
    const { w } = await mountView()
    expect(w.findComponent(PhotosTopbar).exists()).toBe(true)
    expect(w.get('.topbar-title').text()).toBe(zh.photosMoForYou)
    expect(w.find('.topbar .search').exists()).toBe(false)
  })

  it('passes hide-drawer-trigger to PhotosSidebar', async () => {
    const { w } = await mountView()
    expect(w.findComponent(PhotosSidebar).props('hideDrawerTrigger')).toBe(true)
  })
})
