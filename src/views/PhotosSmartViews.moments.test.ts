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

import PhotosSmartViews from './PhotosSmartViews.vue'
import { usePhotosMoments, type Moment } from '../photos/stores/moments'
import { usePhotosSettingsStore } from '../photos/stores/settings'

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

describe('relationship with the smart-views hero', () => {
  it('when the band is present, the sv-hero below it gets the sv-hero-secondary divider class', async () => {
    const { w } = await mountPage()
    const s = usePhotosMoments()
    s.moments = [makeMoment()]
    await nextTick()
    expect(w.find('.sv-hero').classes()).toContain('sv-hero-secondary')
  })

  it('when the band is absent, sv-hero does not carry that class', async () => {
    const { w } = await mountPage()
    expect(w.find('.sv-hero').classes()).not.toContain('sv-hero-secondary')
  })
})

describe('fetching', () => {
  it('fetches moments once on mount', async () => {
    await mountPage()
    expect(svc.photos.listMoments).toHaveBeenCalledTimes(1)
  })
})
