// SP15-P1-T7: the moment detail page skeleton. Target: Vue 2 899af59b:PhotosMomentDetail.vue:1-121
// (top bar + two columns + About/Stats/By month) and :203-291 (the computed properties).
// ★ In New-UI this page is a real **route** (Vue 2 renders it as an inline child component), so
//   it gains one path Vue 2 never had: the cold deep link — the backend has no GET /moments/:id,
//   so the page must fall back to fetching the whole list and looking the id up in it.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
// The app's own i18n singleton, which vitest.setup.ts already installs into every mount via
// `config.global.plugins`. Building a second instance here and passing it through
// `global.plugins` (as several older test files still do) installs vue-i18n twice into the same
// app and makes every mount print seven "Component i18n-t has already been registered"
// [Vue warn]s — 406 of them in PhotosSmartViewDetail.test.ts alone. Switching the singleton's
// locale gives the same control with none of the noise.
import { i18n } from '../i18n'

const svc = vi.hoisted(() => ({
  photos: {
    thumbnailUrl: vi.fn((id: string, size: string) => `mock://${id}/${size}`),
    listMoments: vi.fn(async (): Promise<unknown> => []),
    getMomentAssets: vi.fn(async (_id?: string, _featured?: boolean, _withMembers?: boolean): Promise<unknown> => []),
    // SP15-P1-T9: the write endpoints behind store.pin / store.exclude, plus the timeline the
    // library picker loads when it opens. Mocked at the service boundary rather than by
    // replacing the store methods, so the count that comes back really does travel
    // response → store → both views.
    pinMomentAssets: vi.fn(async (): Promise<unknown> => ({})),
    excludeMomentAssets: vi.fn(async (): Promise<unknown> => ({})),
    getTimeline: vi.fn(async (): Promise<unknown> => []),
    // PhotosSidebar is part of this page's shell and reads the photos config on mount. Without
    // this stub the settings store's fetchAiFeatures catches a TypeError and console.errors on
    // every single mount, which buries any real failure in the test output.
    getConfig: vi.fn(async (): Promise<unknown> => ({})),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// SP15-P1-T8: useLightbox is a module-level singleton — every call to useLightbox()
// returns a **fresh object literal**, but its `openAt` property points at the same
// module-top-level function either way. `vi.spyOn(freshObject, 'openAt')` only shadows
// that one object's own property; the component's separate `useLightbox()` call gets a
// different object whose `openAt` is still the unpatched original, so the spy is never
// invoked (established precedent: PhotosSmartViewDetail.test.ts:33-39 hit the exact same
// trap first and mocks the whole module instead — same fix here).
const lbMock = vi.hoisted(() => ({ openAt: vi.fn() }))
vi.mock('../photos/lightbox/useLightbox', () => ({ useLightbox: () => lbMock }))

import PhotosMomentDetail from './PhotosMomentDetail.vue'
// Raw SFC text, for the two style assertions at the bottom: jsdom does no cascade resolution
// and cannot enter a hover state, so the winning :hover background has to be computed from
// the stylesheet source (same helper and same reason as PhotosSmartViewDetail.test.ts:42-45).
import photosMomentDetailRaw from './PhotosMomentDetail.vue?raw'
import { extractStyleBlock, winningHoverBackground } from '../photos/components/__tests__/cssCascade'
import PhotosLibraryPicker from '../photos/components/PhotosLibraryPicker.vue'
import { usePhotosMoments, type Moment } from '../photos/stores/moments'
import { useToast } from '../stores/toast'
import zh from '../i18n/zh_cn'
import PhotosTopbar from '../photos/components/PhotosTopbar.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'

const RAW = {
  id: 'm1', title: 'Bozeman', subtitle: 'Nov 2016', cover_asset_id: 'c1',
  asset_count: 42, time_from: '2016-11-20T00:00:00Z', time_to: '2016-11-22T00:00:00Z',
  place: 'Bozeman', recipe_key: 'trip:1', featured_asset_ids: ['f1'],
  added_this_week: 3, cover_ratio: 1.5,
}

function makeMoment(over: Partial<Moment> = {}): Moment {
  return {
    id: 'm1', title: 'Bozeman', subtitle: 'Nov 2016', place: 'Bozeman',
    recipeKey: 'trip:1', coverAssetId: 'c1', featuredAssetIds: ['f1'],
    assetCount: 42, addedThisWeek: 3, coverRatio: 1.5,
    timeFrom: '2016-11-20T00:00:00Z', timeTo: '2016-11-22T00:00:00Z', updatedAt: '', ...over,
  }
}

// Expected date strings are built here with plain Intl rather than by reaching into the
// component, so the assertion is an independent expectation and not a restatement of the
// implementation — while still being timezone-safe on any machine.
function day(iso: string): string {
  return new Date(iso).toLocaleDateString('en-us', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Silences and captures the component's console.error for the cases that deliberately make a
 *  request reject, so a real unexpected error still stands out in the output. */
function muteConsoleError() {
  return vi.spyOn(console, 'error').mockImplementation(() => {})
}

async function mountDetail(id = 'm1', locale: 'zh_cn' | 'en_us' = 'en_us') {
  const router = createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/photos/smart-views', name: 'photos-smart-views', component: { template: '<div/>' } },
      { path: '/photos/moments/:id', name: 'photos-moment-detail', component: PhotosMomentDetail },
      // T10: the save-as-album toast's "Open" action pushes here. vue-router 4 does not move
      // `currentRoute` off an unmatched path (it stays put and warns "No match found"), so
      // without this route the navigation assertion in that test would silently no-op.
      { path: '/photos/albums/:id', name: 'photos-album-detail', component: { template: '<div/>' } },
    ],
  })
  await router.push('/photos/moments/' + id)
  await router.isReady()
  i18n.global.locale.value = locale
  const w = mount(PhotosMomentDetail, { global: { plugins: [router] } })
  await new Promise((r) => setTimeout(r, 0))
  return { w, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks() // also clears lbMock.openAt — it is a vi.fn(), tracked globally
  // clearAllMocks() only wipes the call records — an implementation installed with
  // mockResolvedValue/mockImplementation inside one test survives into the next. Reinstall the
  // defaults here so the `places` and `By month` cases cannot leak into the cases after them.
  svc.photos.listMoments.mockResolvedValue([])
  svc.photos.getMomentAssets.mockResolvedValue([])
  svc.photos.getConfig.mockResolvedValue({})
  svc.photos.pinMomentAssets.mockResolvedValue({})
  svc.photos.excludeMomentAssets.mockResolvedValue({})
  svc.photos.getTimeline.mockResolvedValue([])
})

describe('cold deep link (a New-UI-only path — the backend has no GET /moments/:id)', () => {
  it('fetches the whole list and looks the id up in it when the store is empty', async () => {
    svc.photos.listMoments.mockResolvedValueOnce([RAW])
    const { w } = await mountDetail('m1')
    expect(svc.photos.listMoments).toHaveBeenCalledTimes(1)
    expect(w.text()).toContain('Bozeman')
  })

  it('does not fetch the list again when the store already holds that moment', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment()]
    s.listLoaded = true
    await mountDetail('m1')
    expect(svc.photos.listMoments).not.toHaveBeenCalled()
  })

  it('renders "moment not found" rather than a blank page when the list has no such id', async () => {
    svc.photos.listMoments.mockResolvedValueOnce([])
    const { w } = await mountDetail('nope')
    expect(w.find('[data-test="mo-not-found"]').exists()).toBe(true)
  })
})

describe('top bar and header', () => {
  it('the back button returns to the smart views page', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w, router } = await mountDetail()
    await w.find('[data-test="mo-back"]').trigger('click')
    // trigger() only awaits nextTick; a vue-router 4 navigation needs more than one microtask
    // to settle, so currentRoute is still the old one at that point.
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos/smart-views')
  })

  it('the backend sends no updated_at ⇒ both the top bar and Stats show the placeholder', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-last-updated"]').text()).toContain('—')
  })

  it('renders no green badge when addedThisWeek is 0', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment({ addedThisWeek: 0 })]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('.mo-week-badge').exists()).toBe(false)
  })
})

describe('About sidebar', () => {
  // Asserted by equality, not by "does not contain an en dash": the placeholder DASH is an *em*
  // dash, so the old negative assertion was equally satisfied by the label collapsing to the
  // placeholder — the range branch went untested either way (fix round 1 · finding 3).
  //
  // fix round 2 (task 8 carry-over): the fixture used to be '01:00Z' / '09:00Z'. That is the
  // same calendar day only from roughly UTC−2 eastward — at UTC−3 or further west (e.g.
  // America/New_York, UTC−4/−5) 01:00Z is still the *previous* local day, so `fmt(from)` and
  // `fmt(to)` land on different dates and the component renders a range instead of one date,
  // which made this test fail under `TZ=America/New_York` despite the comment above claiming
  // "timezone-safe on any machine". Moving both timestamps to the middle of the UTC day
  // (12:00Z / 13:00Z) keeps them on the same local calendar day for every real IANA zone
  // (the widest offsets in use are UTC−12 to UTC+14, comfortably inside a one-hour gap centred
  // on noon UTC), so the claim is now actually true rather than only checked in one timezone.
  it('time window: shows exactly one date when the two ends fall on the same day', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ timeFrom: '2016-11-20T12:00:00Z', timeTo: '2016-11-20T13:00:00Z' })]
    s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-about-time"]').text()).toBe(day('2016-11-20T12:00:00Z'))
  })

  it('time window: shows the full "from – to" range when the two ends differ', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ timeFrom: '2016-11-20T00:00:00Z', timeTo: '2016-11-22T00:00:00Z' })]
    s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-about-time"]').text())
      .toBe(`${day('2016-11-20T00:00:00Z')} – ${day('2016-11-22T00:00:00Z')}`)
  })

  it('falls back to subtitle when the time window is missing, and to the placeholder without one', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ timeFrom: '', timeTo: '', subtitle: 'Nov 2016' })]
    s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-about-time"]').text()).toContain('Nov 2016')
  })

  it('takes the top three city names when places is non-empty and appends +N beyond that', async () => {
    svc.photos.getMomentAssets.mockResolvedValue({
      assets: [], members: [],
      places: [{ name: 'A', count: 9 }, { name: 'B', count: 8 }, { name: 'C', count: 7 }, { name: 'D', count: 1 }],
    })
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-about-place"]').text()).toBe('A · B · C +1')
  })

  it('falls back to moment.place when places is empty', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment({ place: 'Bozeman' })]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-about-place"]').text()).toBe('Bozeman')
  })

  it('still renders the row with a placeholder when neither places nor place exists', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment({ place: '' })]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-about-place"]').text()).toBe('—')
  })
})

describe('Stats and the month distribution', () => {
  it('the span is computed from the two ends, inclusive of both', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ timeFrom: '2016-11-20T00:00:00Z', timeTo: '2016-11-22T00:00:00Z' })]
    s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-stat-span"]').text()).toContain('3')
  })

  it('the span shows the placeholder when the time window is missing', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment({ timeFrom: '', timeTo: '' })]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-stat-span"]').text()).toContain('—')
  })

  it('the histogram buckets by YYYY-MM ascending and skips photos with no takenAt', async () => {
    svc.photos.getMomentAssets.mockImplementation(async (_id?: string, featured?: boolean) =>
      featured ? { assets: [], members: [], places: [] }
        : [
          { id: 'a', takenAt: '2016-12-02T00:00:00Z' },
          { id: 'b', takenAt: '2016-11-20T00:00:00Z' },
          { id: 'c', takenAt: '2016-11-21T00:00:00Z' },
          { id: 'd' },
        ],
    )
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    const bars = w.findAll('[data-test="mo-dist-bar"]')
    expect(bars).toHaveLength(2)
    // Asserted by equality: `toContain('2')` was satisfied by December's title too ('Dec 2016 · 1'
    // contains the 2 of the year), so reversing the sort left it green (fix round 1 · finding 2).
    expect(bars[0].attributes('title')).toBe('Nov 2016 · 2')
    expect(bars[1].attributes('title')).toBe('Dec 2016 · 1')
  })

  it('drops the whole By month section when nothing has a takenAt', async () => {
    svc.photos.getMomentAssets.mockImplementation(async (_id?: string, featured?: boolean) =>
      featured ? { assets: [], members: [], places: [] } : [{ id: 'a' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-dist"]').exists()).toBe(false)
  })
})

describe('route parameter changes', () => {
  it('refetches when only :id changes without a remount (the watcher tracks route.params.id)', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ id: 'm1' }), makeMoment({ id: 'm2', title: 'Other' })]
    s.listLoaded = true
    const { w, router } = await mountDetail('m1')
    svc.photos.getMomentAssets.mockClear()
    await router.push('/photos/moments/m2')
    await new Promise((r) => setTimeout(r, 0))
    expect(w.text()).toContain('Other')
    expect(svc.photos.getMomentAssets).toHaveBeenCalled()
  })

  // The staleness guard's own regression test. The case above does NOT exercise it: m1's load
  // has fully settled before the push, so the two never overlap and loadEpoch could be deleted
  // without turning it red. This one holds m1's asset requests open until after m2's have
  // landed, which is the only ordering the guard exists for — and the ordering this repo's
  // reviews have caught missing four times.
  it('a late response for the previous :id does not clobber the newer one', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ id: 'm1', place: '' }), makeMoment({ id: 'm2', title: 'Other', place: '' })]
    s.listLoaded = true

    let releaseM1: () => void = () => {}
    const m1Gate = new Promise<void>((r) => { releaseM1 = r })
    svc.photos.getMomentAssets.mockImplementation(async (id?: string, featured?: boolean) => {
      if (id === 'm1') await m1Gate
      if (!featured) return []
      return { assets: [], members: [], places: [{ name: `place-${id}`, count: 1 }] }
    })

    const { w, router } = await mountDetail('m1')      // m1's requests are now hanging
    await router.push('/photos/moments/m2')
    await flushPromises()
    expect(w.find('[data-test="mo-about-place"]').text()).toBe('place-m2')

    releaseM1()                                        // m1's stale response finally arrives
    await flushPromises()
    expect(w.find('[data-test="mo-about-place"]').text()).toBe('place-m2')
  })

  // fix round 1 · deviation 11. Vue 2 got this for free because its detail component was v-if'd
  // and remounted on every switch; a params-only route change does not remount.
  it('clears the previous moment assets on an :id change instead of showing them under the new title', async () => {
    let releaseM2: () => void = () => {}
    const m2Gate = new Promise<void>((r) => { releaseM2 = r })
    svc.photos.getMomentAssets.mockImplementation(async (id?: string, featured?: boolean) => {
      if (id === 'm2') await m2Gate
      if (!featured) return []
      return { assets: [], members: [], places: [{ name: `place-${id}`, count: 1 }] }
    })

    const s = usePhotosMoments()
    s.moments = [makeMoment({ id: 'm1', place: '' }), makeMoment({ id: 'm2', title: 'Other', place: '' })]
    s.listLoaded = true
    const { w, router } = await mountDetail('m1')
    expect(w.find('[data-test="mo-about-place"]').text()).toBe('place-m1')

    await router.push('/photos/moments/m2')
    await flushPromises()
    // m2's response has not landed yet — the row must not still be advertising m1's place.
    expect(w.find('[data-test="mo-about-place"]').text()).toBe('—')

    releaseM2()
    await flushPromises()
    expect(w.find('[data-test="mo-about-place"]').text()).toBe('place-m2')
  })

  // Final whole-branch review, finding 3 (file-header deviation 21). The watcher cleared the
  // four asset fields and none of the interaction flags. A selection is the one with a write
  // consequence: removeSelected() reads momentId.value at *call* time, so a selection carried
  // across the change would post moment A's asset ids to moment B's exclude endpoint, under a
  // bar reading "1 selected" over photos that are no longer on screen.
  it('a selection does not survive an :id change', async () => {
    svc.photos.getMomentAssets.mockImplementation(async (id?: string, featured?: boolean) =>
      featured ? { assets: [], members: [], places: [] } : [{ id: `${id}-a1` }])
    const s = usePhotosMoments()
    s.moments = [makeMoment({ id: 'm1' }), makeMoment({ id: 'm2', title: 'Other' })]
    s.listLoaded = true
    const { w, router } = await mountDetail('m1')

    await w.find('[data-test="mo-select-toggle"]').trigger('click')
    await w.find('[data-test="mo-all-tile"]').trigger('click')
    expect(w.find('[data-test="mo-select-bar"]').text()).toContain('1')

    await router.push('/photos/moments/m2')
    await flushPromises()

    // Not merely "the bar is hidden": selection mode itself must be off, and pressing Select
    // again must reveal an empty selection rather than m1's leftover id.
    expect(w.find('[data-test="mo-select-bar"]').exists()).toBe(false)
    await w.find('[data-test="mo-select-toggle"]').trigger('click')
    expect(w.find('[data-test="mo-select-bar"]').exists()).toBe(false)
    expect(svc.photos.excludeMomentAssets).not.toHaveBeenCalled()
  })

  it('an open library picker and an open delete confirmation do not survive an :id change', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ id: 'm1' }), makeMoment({ id: 'm2', title: 'Other' })]
    s.listLoaded = true
    const { w, router } = await mountDetail('m1')

    await w.find('[data-test="mo-more"]').trigger('click')
    await w.find('[data-test="mo-delete"]').trigger('click')
    expect(w.find('[data-test="mo-delete-confirm"]').exists()).toBe(true)

    await router.push('/photos/moments/m2')
    await flushPromises()
    expect(w.find('[data-test="mo-delete-confirm"]').exists()).toBe(false)

    // The picker's "already in" set is derived from the previous moment's members, so leaving
    // it open across the change would offer the wrong answer to the wrong question.
    await w.find('[data-test="mo-add-photos"]').trigger('click')
    expect(w.findComponent(PhotosLibraryPicker).props('open')).toBe(true)
    await router.push('/photos/moments/m1')
    await flushPromises()
    expect(w.findComponent(PhotosLibraryPicker).props('open')).toBe(false)
  })
})

// fix round 1 · finding 1. The two asset requests must fail independently; a single Promise.all
// under a single catch threw away whichever response had already arrived.
describe('partial load failures', () => {
  it('a rejected all-assets request does not discard the detail response that already arrived', async () => {
    const err = muteConsoleError()
    svc.photos.getMomentAssets.mockImplementation(async (_id?: string, featured?: boolean) => {
      if (!featured) throw new Error('boom')
      return { assets: [{ id: 'f1' }], members: [], places: [{ name: 'Kept', count: 3 }] }
    })
    const s = usePhotosMoments(); s.moments = [makeMoment({ place: '' })]; s.listLoaded = true
    const { w } = await mountDetail()

    expect(w.find('[data-test="mo-about-place"]').text()).toBe('Kept')
    expect(w.find('[data-test="mo-stat-featured"]').text()).toBe('1')
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it('a rejected detail request does not discard the all-assets response that already arrived', async () => {
    const err = muteConsoleError()
    svc.photos.getMomentAssets.mockImplementation(async (_id?: string, featured?: boolean) => {
      if (featured) throw new Error('boom')
      return [{ id: 'a', takenAt: '2016-11-20T00:00:00Z' }]
    })
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()

    // The By month histogram is derived from the all-assets response, so its presence is the
    // proof that response survived the other request's rejection.
    expect(w.find('[data-test="mo-dist"]').exists()).toBe(true)
    expect(w.findAll('[data-test="mo-dist-bar"]')).toHaveLength(1)
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })
})

// fix round 1 · finding 4. Three outcomes, three distinct screens.
describe('a failed list fetch is not reported as a deleted moment', () => {
  it('renders its own failure state, not not-found, when the list request fails', async () => {
    const err = muteConsoleError()
    svc.photos.listMoments.mockRejectedValueOnce(new Error('offline'))
    const { w } = await mountDetail('m1')

    expect(w.find('[data-test="mo-load-failed"]').exists()).toBe(true)
    expect(w.find('[data-test="mo-not-found"]').exists()).toBe(false)
    err.mockRestore()
  })

  it('renders not-found when the list came back clean and simply has no such id', async () => {
    svc.photos.listMoments.mockResolvedValueOnce([])
    const { w } = await mountDetail('nope')

    expect(w.find('[data-test="mo-not-found"]').exists()).toBe(true)
    expect(w.find('[data-test="mo-load-failed"]').exists()).toBe(false)
  })

  it('renders the moment, and neither failure state, when the list came back with it', async () => {
    svc.photos.listMoments.mockResolvedValueOnce([RAW])
    const { w } = await mountDetail('m1')

    expect(w.text()).toContain('Bozeman')
    expect(w.find('[data-test="mo-load-failed"]').exists()).toBe(false)
    expect(w.find('[data-test="mo-not-found"]').exists()).toBe(false)
  })

  it('retry refetches the list and recovers into the loaded state', async () => {
    const err = muteConsoleError()
    svc.photos.listMoments.mockRejectedValueOnce(new Error('offline'))
    const { w } = await mountDetail('m1')
    expect(w.find('[data-test="mo-load-failed"]').exists()).toBe(true)

    svc.photos.listMoments.mockResolvedValueOnce([RAW])
    await w.find('[data-test="mo-load-failed-retry"]').trigger('click')
    await flushPromises()

    expect(w.find('[data-test="mo-load-failed"]').exists()).toBe(false)
    expect(w.text()).toContain('Bozeman')
    err.mockRestore()
  })
})

// SP15-P1-T8: the two photo grids (Featured + All photos) and the selection state that
// backs Task 9's bulk removal. Ported from Vue2 899af59b:PhotosMomentDetail.vue :52-79
// (template) and photos-smartview.scss (.sv-grid-photos/.tile/.sv-pin-tag/.sv-tile-check/
// .sv-select-bar rule bodies).
describe('the two photo grids', () => {
  function mockAssets(featured: unknown[], all: unknown[], members: unknown[] = []) {
    svc.photos.getMomentAssets.mockImplementation(async (_id?: string, f?: boolean) =>
      f ? { assets: featured, members, places: [] } : all)
  }

  it('renders the Featured section with a photo count in its heading when it has assets', async () => {
    mockAssets([{ id: 'f1' }, { id: 'f2' }], [{ id: 'f1' }, { id: 'f2' }, { id: 'a3' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-featured-head"]').text()).toContain('2')
    expect(w.findAll('[data-test="mo-featured-tile"]')).toHaveLength(2)
  })

  it('renders no Featured section at all — not an empty shell — when Featured has no assets', async () => {
    mockAssets([], [{ id: 'a1' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-featured-head"]').exists()).toBe(false)
  })

  it('shows a pin badge on manual Featured members and not on non-manual ones', async () => {
    mockAssets([{ id: 'f1' }, { id: 'f2' }], [], [
      { asset_id: 'f1', manual: true, featured: true },
      { asset_id: 'f2', manual: false, featured: true },
    ])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.findAll('[data-test="mo-pin-tag"]')).toHaveLength(1)
  })

  // Final whole-branch review, finding 5 (file-header deviation 20). allLoading used to be
  // raised only after `await store.ensureLoaded()`. The reachable case: the smart-views page's
  // onMounted refetches the list, so returning to it and opening a moment immediately finds
  // listLoaded already true (the header renders the real title and count) while ensureLoaded()
  // awaits the in-flight request — and for that whole round trip the grid claimed the moment
  // had no photos, before "Loading…" had ever appeared.
  it('says "loading" rather than "no photos yet" while a list refetch is still in flight underneath', async () => {
    mockAssets([], [])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    let releaseList: () => void = () => {}
    svc.photos.listMoments.mockImplementation(
      () => new Promise((r) => { releaseList = () => r([RAW]) }),
    )
    void s.fetchMoments() // the refetch the smart-views page fires on mount — now in flight
    const { w } = await mountDetail()

    expect(w.text()).toContain('Bozeman')                              // the header is already real
    expect(w.find('[data-test="mo-all-loading"]').exists()).toBe(true) // …so the grid must not lie
    expect(w.find('[data-test="mo-all-empty"]').exists()).toBe(false)

    releaseList()
    await flushPromises()
    expect(w.find('[data-test="mo-all-empty"]').exists()).toBe(true)
  })

  it('shows "no photos yet" once All photos has finished loading and found none', async () => {
    mockAssets([], [])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-all-empty"]').exists()).toBe(true)
  })

  it('opens the lightbox on a tile click outside selection mode, with the all-photos list as the entry list; inside selection mode a click only toggles selection', async () => {
    mockAssets([], [{ id: 'a1' }, { id: 'a2' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()

    await w.findAll('[data-test="mo-all-tile"]')[0].trigger('click')
    expect(lbMock.openAt).toHaveBeenCalledTimes(1)
    const [photo, list] = lbMock.openAt.mock.calls[0] as [{ id: unknown }, Array<{ id: unknown }>]
    expect(photo.id).toBe('a1')
    expect(list.map((p) => p.id)).toEqual(['a1', 'a2'])

    await w.find('[data-test="mo-select-toggle"]').trigger('click')
    await w.findAll('[data-test="mo-all-tile"]')[1].trigger('click')
    expect(lbMock.openAt).toHaveBeenCalledTimes(1) // not opened again
    expect(w.find('[data-test="mo-select-bar"]').text()).toContain('1')
  })

  // fix round 1 (Important): the case above never clicks a Featured tile, so a regression
  // that always passed `allAssets` as the entry list — even for a Featured tile — kept every
  // existing test green. Featured and All photos here deliberately hold disjoint ids ('f1' vs
  // 'a1'/'a2') so that passing the wrong list is detectable by content, not just by length.
  // Mutation-checked: temporarily hard-coding `onTileClick` to always call
  // `lightbox.openAt(p, allAssets)` turns this case red (list.map(id) comes back
  // ['a1', 'a2'] instead of ['f1']) while leaving every other test in this file green;
  // reverting restores green.
  it('opens the lightbox with the Featured list as the entry list when a Featured tile is clicked, not the all-photos list', async () => {
    mockAssets([{ id: 'f1' }], [{ id: 'a1' }, { id: 'a2' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()

    await w.find('[data-test="mo-featured-tile"]').trigger('click')
    expect(lbMock.openAt).toHaveBeenCalledTimes(1)
    const [photo, list] = lbMock.openAt.mock.calls[0] as [{ id: unknown }, Array<{ id: unknown }>]
    expect(photo.id).toBe('f1')
    expect(list.map((p) => p.id)).toEqual(['f1'])
  })

  // Strengthened beyond the brief's original assertion (self-review requirement: a test
  // must fail if the behavior it names is removed). The bar's own `v-if` is
  // `selecting && selectedIds.length` — turning `selecting` off already hides the bar for
  // free, so asserting only "the bar is gone right after leaving" would pass even if
  // `toggleSelecting` forgot to clear `selectedIds.value`. Re-entering selection mode
  // without picking anything is the case that actually distinguishes "cleared" from
  // "still holds a stale id, just temporarily hidden".
  it('leaving selection mode clears the selection, not just the bar\'s visibility', async () => {
    mockAssets([], [{ id: 'a1' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    await w.find('[data-test="mo-select-toggle"]').trigger('click') // enter
    await w.find('[data-test="mo-all-tile"]').trigger('click')      // select a1
    await w.find('[data-test="mo-select-toggle"]').trigger('click') // leave
    expect(w.find('[data-test="mo-select-bar"]').exists()).toBe(false)

    await w.find('[data-test="mo-select-toggle"]').trigger('click') // enter again, nothing picked
    expect(w.find('[data-test="mo-select-bar"]').exists()).toBe(false)
  })
})

// SP15-P1-T9: adding photos to the moment (pin) and removing them from it (exclude).
// Ported from Vue2 899af59b:PhotosMomentDetail.vue :26-28 + :122-125 + :143-151 (template) and
// :340-381 (onPickPhotos / removeSelected).
//
// The write endpoints are mocked at the service boundary rather than by replacing store.pin /
// store.exclude, so the asset_count in the response really does travel response → store → the
// page's header and Stats — with the store method stubbed out, "the count changed" would only be
// re-stating the stub. store.pin/exclude are still spied on (call-through) for their arguments.
describe('adding and removing photos', () => {
  function mockAssets(all: unknown[], featured: unknown[] = []) {
    svc.photos.getMomentAssets.mockImplementation(async (_id?: string, f?: boolean) =>
      f ? { assets: featured, members: [], places: [] } : all)
  }

  it('the Add photos button opens the library picker with the moment\'s own photos marked as already in', async () => {
    mockAssets([{ id: 'a1' }, { id: 'a2' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()

    const picker = w.findComponent(PhotosLibraryPicker)
    expect(picker.props('open')).toBe(false)

    await w.find('[data-test="mo-add-photos"]').trigger('click')
    expect(picker.props('open')).toBe(true)
    // Already-in comes from the full member list, String()-normalised (Vue2 :202 memberIds).
    expect([...(picker.props('existingIds') as Set<string>)].sort()).toEqual(['a1', 'a2'])
  })

  it('the Add photos button is disabled while the all-photos list is still loading', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => { release = r })
    svc.photos.getMomentAssets.mockImplementation(async (_id?: string, f?: boolean) => {
      if (f) return { assets: [], members: [], places: [] }
      await gate
      return []
    })
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()

    expect(w.find<HTMLButtonElement>('[data-test="mo-add-photos"]').element.disabled).toBe(true)
    release()
    await flushPromises()
    expect(w.find<HTMLButtonElement>('[data-test="mo-add-photos"]').element.disabled).toBe(false)
  })

  it('adding: pins the picked ids, adopts the count from the response, reloads both grids, closes the picker and confirms with a toast', async () => {
    mockAssets([])
    svc.photos.pinMomentAssets.mockResolvedValue({ asset_count: 44 })
    const s = usePhotosMoments(); s.moments = [makeMoment({ assetCount: 42 })]; s.listLoaded = true
    const pin = vi.spyOn(s, 'pin')
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w } = await mountDetail('m1', 'zh_cn')

    await w.find('[data-test="mo-add-photos"]').trigger('click')
    svc.photos.getMomentAssets.mockClear()
    w.findComponent(PhotosLibraryPicker).vm.$emit('confirm', ['x', 'y'])
    await flushPromises()

    expect(pin).toHaveBeenCalledWith('m1', ['x', 'y'])
    expect(svc.photos.pinMomentAssets).toHaveBeenCalledWith('m1', ['x', 'y'])
    // The list entry and the detail page are the same object — no hand-mirroring (store item 1).
    expect(s.byId('m1')?.assetCount).toBe(44)
    expect(w.find('[data-test="mo-stat-photos"]').text()).toBe('44')
    // Both grids reload afterwards (featured + all = two requests).
    expect(svc.photos.getMomentAssets).toHaveBeenCalledTimes(2)
    // fix round 1 · finding 4: exactly one toast, and it is the success one carrying the count —
    // a duplicate, or a danger toast fired alongside it, has to fail here.
    expect(show).toHaveBeenCalledTimes(1)
    expect(show).toHaveBeenCalledWith(zh.photosMoAddedN.replace('{n}', '2'))
    expect(w.findComponent(PhotosLibraryPicker).props('open')).toBe(false)
  })

  it('adding: a failed pin leaves the count untouched, says so in the danger tier and keeps the picker open to retry', async () => {
    const err = muteConsoleError()
    mockAssets([])
    svc.photos.pinMomentAssets.mockRejectedValue(new Error('nope'))
    const s = usePhotosMoments(); s.moments = [makeMoment({ assetCount: 42 })]; s.listLoaded = true
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w } = await mountDetail('m1', 'zh_cn')

    await w.find('[data-test="mo-add-photos"]').trigger('click')
    w.findComponent(PhotosLibraryPicker).vm.$emit('confirm', ['x'])
    await flushPromises()

    expect(s.byId('m1')?.assetCount).toBe(42)
    // fix round 1 · finding 4: only the danger toast — no success toast leaking onto this path.
    expect(show).toHaveBeenCalledTimes(1)
    expect(show).toHaveBeenCalledWith(expect.stringContaining('失败'), expect.anything(), 'danger')
    // The panel stays up with the user's selection still in it (same contract as the album pages).
    const picker = w.findComponent(PhotosLibraryPicker)
    expect(picker.props('open')).toBe(true)
    // fix round 1 · finding 1: the busy flag has to come back down in the handler's `finally`, or
    // the panel is left with a permanently disabled "Adding…" button and no way to retry.
    expect(picker.props('submitting')).toBe(false)
    picker.vm.$emit('confirm', ['x'])
    await flushPromises()
    expect(svc.photos.pinMomentAssets).toHaveBeenCalledTimes(2)
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it('removing: excludes the selection, adopts the count from the response, leaves selection mode and reloads the grids', async () => {
    mockAssets([{ id: 'a1' }])
    svc.photos.excludeMomentAssets.mockResolvedValue({ asset_count: 41 })
    const s = usePhotosMoments(); s.moments = [makeMoment({ assetCount: 42 })]; s.listLoaded = true
    const exclude = vi.spyOn(s, 'exclude')
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w } = await mountDetail('m1', 'zh_cn')

    await w.find('[data-test="mo-select-toggle"]').trigger('click')
    await w.find('[data-test="mo-all-tile"]').trigger('click')
    svc.photos.getMomentAssets.mockClear()
    await w.find('[data-test="mo-remove-selected"]').trigger('click')
    await flushPromises()

    expect(exclude).toHaveBeenCalledWith('m1', ['a1'])
    expect(s.byId('m1')?.assetCount).toBe(41)
    expect(w.find('[data-test="mo-select-bar"]').exists()).toBe(false)
    expect(svc.photos.getMomentAssets).toHaveBeenCalledTimes(2)
    // fix round 1 · finding 4: exactly one toast, and it is the success one with the count.
    expect(show).toHaveBeenCalledTimes(1)
    expect(show).toHaveBeenCalledWith(zh.photosMoRemovedN.replace('{n}', '1'))

    // Selection mode is really off, not merely hiding a bar that still holds a1: re-entering
    // shows no bar (the same distinction the T8 case above had to make).
    await w.find('[data-test="mo-select-toggle"]').trigger('click')
    expect(w.find('[data-test="mo-select-bar"]').exists()).toBe(false)
  })

  it('removing: a failed exclude keeps selection mode and the selection itself, so the user can retry', async () => {
    const err = muteConsoleError()
    mockAssets([{ id: 'a1' }])
    svc.photos.excludeMomentAssets.mockRejectedValue(new Error('nope'))
    const s = usePhotosMoments(); s.moments = [makeMoment({ assetCount: 42 })]; s.listLoaded = true
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w } = await mountDetail('m1', 'zh_cn')

    await w.find('[data-test="mo-select-toggle"]').trigger('click')
    await w.find('[data-test="mo-all-tile"]').trigger('click')
    await w.find('[data-test="mo-remove-selected"]').trigger('click')
    await flushPromises()

    expect(s.byId('m1')?.assetCount).toBe(42)
    // fix round 1 · finding 4: only the danger toast — no success toast on the failure path.
    expect(show).toHaveBeenCalledTimes(1)
    expect(show).toHaveBeenCalledWith(expect.stringContaining('失败'), expect.anything(), 'danger')
    // Vue2 :386-387 clears the selection in the success branch only — deliberately, so a failed
    // removal leaves the user the selection they were working with.
    expect(w.find('[data-test="mo-select-bar"]').exists()).toBe(true)
    expect(w.find('[data-test="mo-select-bar"]').text()).toContain('1')
    // …and pressing it again really does resend, rather than being wedged in a busy state.
    await w.find('[data-test="mo-remove-selected"]').trigger('click')
    await flushPromises()
    expect(svc.photos.excludeMomentAssets).toHaveBeenCalledTimes(2)
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it('an empty selection cannot fire a removal — the whole bar is absent with nothing picked', async () => {
    mockAssets([{ id: 'a1' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()

    await w.find('[data-test="mo-select-toggle"]').trigger('click')
    expect(w.find('[data-test="mo-select-bar"]').exists()).toBe(false)
    expect(w.find('[data-test="mo-remove-selected"]').exists()).toBe(false)
    expect(svc.photos.excludeMomentAssets).not.toHaveBeenCalled()
  })

  // The removal button's own label and the picker's strings come from this task's new keys; a
  // missing key would render the key name itself, which no other assertion here would catch.
  it('renders Vue 2\'s own wording for the two new controls', async () => {
    mockAssets([{ id: 'a1' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail('m1', 'zh_cn')

    expect(w.find('[data-test="mo-add-photos"]').text()).toBe(zh.photosMoAddPhotos)
    await w.find('[data-test="mo-select-toggle"]').trigger('click')
    await w.find('[data-test="mo-all-tile"]').trigger('click')
    expect(w.find('[data-test="mo-remove-selected"]').text()).toBe(zh.photosMoRemoveFromMoment)

    await w.find('[data-test="mo-add-photos"]').trigger('click')
    const picker = w.findComponent(PhotosLibraryPicker)
    expect(picker.props('existingLabel')).toBe(zh.photosMoAlreadyIn)
    expect(picker.props('submitLabel')).toBe(zh.photosMoAddSelected)
    expect(picker.props('title')).toContain('Bozeman')
  })
})

// SP15-P1-T10: exporting a moment as a static album, and deleting a moment outright. Ported
// from Vue2 899af59b:PhotosMomentDetail.vue :20-22 (Save as Album button), :29-45 (more menu),
// :295-305 (the document mousedown listener that closes it — the listener Task 7 deliberately
// deferred, see this file's own header), :138-152 (delete confirm dialog) and :406-436
// (saveAsAlbum / askConfirmDelete / doDelete).
describe('save as album', () => {
  it('shows a success toast with an "Open" action that navigates to the new album', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    vi.spyOn(s, 'exportAlbum').mockResolvedValue({ albumId: 'al1', name: 'Bozeman', count: 42 })
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w, router } = await mountDetail()
    await w.find('[data-test="mo-save-album"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    const action = show.mock.calls[0][2] as { label: string; onClick: () => void }
    expect(action.label).toBeTruthy()
    action.onClick()
    // Not `router.isReady()`: that promise settled during mountDetail's own initial navigation
    // and is already resolved by this point, so awaiting it again does not wait for *this*
    // second push — flushPromises actually drains the pending navigation's microtasks.
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos/albums/al1')
  })

  // Locale is zh_cn on purpose: the assertion below checks a substring of Vue 2's own Chinese
  // copy for this key (photosMoAlbumExists), not its English translation.
  //
  // The substring is '已有同名', not the brief's original '已存在' — Vue 2's own zh_CN.json
  // (899af59b:src/assets/lang/zh_CN.json:1960) translates "An album with this name already
  // exists" as '已有同名相册', which does not contain '已存在'. Asserting that substring would
  // be checking a mistranslation, not this feature's real copy (file-header deviation 19).
  it('a 409 (name already exists) gets its own wording instead of the generic failure message', async () => {
    const err = muteConsoleError()
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    vi.spyOn(s, 'exportAlbum').mockRejectedValue({ response: { status: 409 } })
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w } = await mountDetail('m1', 'zh_cn')
    await w.find('[data-test="mo-save-album"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(show.mock.calls[0][0]).toContain('已有同名')
    // Mutation check for the discriminating power of that substring: the generic failure
    // message (photosMoAlbumFailed, '相册创建失败') must NOT also satisfy it, or a regression
    // that always fires the generic branch would still pass this test.
    expect(zh.photosMoAlbumFailed).not.toContain('已有同名')
    err.mockRestore()
  })

  it('disables the button while an export is in flight, to block a double submit', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    let release: () => void = () => {}
    vi.spyOn(s, 'exportAlbum').mockImplementation(() => new Promise((r) => { release = () => r({}) }))
    const { w } = await mountDetail()
    await w.find('[data-test="mo-save-album"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find<HTMLButtonElement>('[data-test="mo-save-album"]').element.disabled).toBe(true)
    release()
    await flushPromises()
    expect(w.find<HTMLButtonElement>('[data-test="mo-save-album"]').element.disabled).toBe(false)
  })

  it('renders Vue 2\'s own wording for the button', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail('m1', 'zh_cn')
    expect(w.find('[data-test="mo-save-album"]').text()).toContain(zh.photosMoSaveAsAlbum)
  })

  // Final whole-branch review, finding 4 (file-header deviation 23). Vue 2 marks this one
  // button `data-primary="true"` and scss:553-557 fills it with the accent; the port shipped a
  // plain .sv-action-btn, so the page's single call-to-action looked exactly like the two
  // neutral chips beside it. The per-task reviews could not see this because they compared the
  // markup against the plan's code block, which never carried the attribute — so the check is
  // written against Vue 2's own marker, and against the two other buttons staying neutral.
  it('is the bar\'s one primary action: it alone carries Vue 2\'s data-primary marker and the accent class', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    const save = w.find('[data-test="mo-save-album"]')
    expect(save.attributes('data-primary')).toBe('true')
    expect(save.classes()).toContain('sv-action-btn-primary')
    // The neighbours must stay neutral, or "primary" would be meaningless.
    expect(w.find('[data-test="mo-add-photos"]').classes()).not.toContain('sv-action-btn-primary')
    expect(w.find('[data-test="mo-select-toggle"]').classes()).not.toContain('sv-action-btn-primary')
  })

  it('fills that button from the accent token, and its hover rule beats the neutral base rule structurally', () => {
    const style = extractStyleBlock(photosMomentDetailRaw)
    expect(style).toContain('.sv-action-btn-primary { background: var(--accent);')
    const win = winningHoverBackground(style, ['sv-action-btn', 'sv-action-btn-primary'])
    expect(win.selector).toContain(':hover')
    expect(win.selector).toContain('sv-action-btn-primary')
    // Specificity 3 means both classes really are in one compound selector. A single-class
    // `.sv-action-btn-primary:hover` scores 2 — a tie with the base `.sv-action-btn:hover`,
    // survived only by source order, which is the exact fragility this repo has been bitten by
    // (the accent fill gets replaced by the neutral hover background, --on-accent text stays).
    expect(win.specificity).toBe(3)
    expect(win.value).toContain('var(--accent)')
  })
})

describe('delete moment', () => {
  it('clicking Delete in the more menu opens a confirmation first — it does not delete immediately', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const remove = vi.spyOn(s, 'remove')
    const { w } = await mountDetail()
    await w.find('[data-test="mo-more"]').trigger('click')
    await w.find('[data-test="mo-delete"]').trigger('click')
    expect(w.find('[data-test="mo-delete-confirm"]').exists()).toBe(true)
    expect(remove).not.toHaveBeenCalled()
  })

  it('confirming deletes and navigates back to the smart views page', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    vi.spyOn(s, 'remove').mockResolvedValue(undefined)
    const { w, router } = await mountDetail()
    await w.find('[data-test="mo-more"]').trigger('click')
    await w.find('[data-test="mo-delete"]').trigger('click')
    await w.find('[data-test="mo-delete-go"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(router.currentRoute.value.path).toBe('/photos/smart-views')
  })

  // The two behaviors the brief calls out as deliberate, not oversights: staying on the page
  // (the dialog itself is not dismissed) and answering inline rather than via a toast.
  it('a failed delete stays on the page with the dialog open and the message inline, not a toast', async () => {
    const err = muteConsoleError()
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    vi.spyOn(s, 'remove').mockRejectedValue(new Error('nope'))
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w, router } = await mountDetail()
    await w.find('[data-test="mo-more"]').trigger('click')
    await w.find('[data-test="mo-delete"]').trigger('click')
    await w.find('[data-test="mo-delete-go"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(router.currentRoute.value.path).toBe('/photos/moments/m1')
    expect(w.find('[data-test="mo-delete-confirm"]').exists()).toBe(true)
    expect(w.find('[data-test="mo-delete-error"]').exists()).toBe(true)
    // Strengthened beyond the brief: this really is inline, not merely "a toast that has not
    // fired yet" — no toast call happens at all on this path.
    expect(show).not.toHaveBeenCalled()
    err.mockRestore()
  })

  it('cancel closes the confirmation dialog without deleting', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const remove = vi.spyOn(s, 'remove')
    const { w } = await mountDetail()
    await w.find('[data-test="mo-more"]').trigger('click')
    await w.find('[data-test="mo-delete"]').trigger('click')
    await w.find('[data-test="mo-delete-cancel"]').trigger('click')
    expect(w.find('[data-test="mo-delete-confirm"]').exists()).toBe(false)
    expect(remove).not.toHaveBeenCalled()
  })

  it('clicking outside the more menu closes it', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    await w.find('[data-test="mo-more"]').trigger('click')
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="mo-delete"]').exists()).toBe(false)
  })

  // Self-review requirement: the debt Task 7 deliberately left for this task (file-header
  // deviation 16) is not just "a listener exists" but "it is torn down on unmount" — a leaked
  // listener keeps the component instance's closures alive and can fire after teardown.
  it('removes its document mousedown listener on unmount, leaking none', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const { w } = await mountDetail()
    const registered = addSpy.mock.calls.filter((c) => c[0] === 'mousedown').length
    expect(registered).toBeGreaterThan(0)
    w.unmount()
    const removed = removeSpy.mock.calls.filter((c) => c[0] === 'mousedown').length
    expect(removed).toBe(registered)
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })

  // Final whole-branch review, finding 2 (file-header deviation 22). Vue 2 needed no
  // re-entrance guard because it closes the dialog before the request; deviation 17 keeps the
  // dialog open, so two presses land two DELETEs — the first succeeds and navigation starts,
  // the second 404s, and the dialog then reports "删除失败" for a delete that in fact worked.
  //
  // The two clicks are deliberately NOT awaited between: awaiting flushes nextTick, the
  // :disabled attribute lands, and @vue/test-utils' trigger() then declines to dispatch on a
  // disabled element — which would leave this case green even with the JS guard deleted. Back
  // to back, the DOM has not re-rendered yet and `if (deleting.value) return` is the only
  // thing that can stop the second call.
  it('double-clicking Delete sends exactly one request', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    let release: () => void = () => {}
    const remove = vi.spyOn(s, 'remove')
      .mockImplementation(() => new Promise<void>((r) => { release = () => r() }))
    const { w } = await mountDetail()
    await w.find('[data-test="mo-more"]').trigger('click')
    await w.find('[data-test="mo-delete"]').trigger('click')

    const btn = w.find('[data-test="mo-delete-go"]')
    void btn.trigger('click')
    void btn.trigger('click')
    await flushPromises()

    expect(remove).toHaveBeenCalledTimes(1)
    release()
    await flushPromises()
  })

  it('disables the confirm button while the delete is in flight, and re-enables it after a failure', async () => {
    const err = muteConsoleError()
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    let reject: () => void = () => {}
    vi.spyOn(s, 'remove').mockImplementation(() => new Promise<void>((_r, rj) => {
      reject = () => rj(new Error('nope'))
    }))
    const { w } = await mountDetail()
    await w.find('[data-test="mo-more"]').trigger('click')
    await w.find('[data-test="mo-delete"]').trigger('click')
    await w.find('[data-test="mo-delete-go"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find<HTMLButtonElement>('[data-test="mo-delete-go"]').element.disabled).toBe(true)

    reject()
    await flushPromises()
    // The dialog is still up (deviation 17) — so the button has to come back, or the user is
    // left staring at an error next to a control they can never press again.
    expect(w.find('[data-test="mo-delete-confirm"]').exists()).toBe(true)
    expect(w.find<HTMLButtonElement>('[data-test="mo-delete-go"]').element.disabled).toBe(false)
    err.mockRestore()
  })

  // Ledger minor folded into finding 2: the success path closed the dialog only as a
  // side effect of router.push unmounting the page. router.push is stubbed here precisely so
  // that side effect cannot mask the dialog's own state — Vue 2 :388 and
  // PhotosSmartViewDetail.vue:332 both close it unconditionally.
  it('a successful delete closes the confirmation itself and reports it with a toast', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    vi.spyOn(s, 'remove').mockResolvedValue(undefined)
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w, router } = await mountDetail('m1', 'zh_cn')
    const push = vi.spyOn(router, 'push').mockResolvedValue(undefined)

    await w.find('[data-test="mo-more"]').trigger('click')
    await w.find('[data-test="mo-delete"]').trigger('click')
    await w.find('[data-test="mo-delete-go"]').trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledWith('/photos/smart-views')
    expect(w.find('[data-test="mo-delete-confirm"]').exists()).toBe(false)
    // The success toast had no assertion at all until now.
    expect(show).toHaveBeenCalledTimes(1)
    expect(show).toHaveBeenCalledWith(zh.photosMoDeleted.replace('{name}', 'Bozeman'))
  })

  it('renders Vue 2\'s own wording for the more menu\'s delete item', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail('m1', 'zh_cn')
    await w.find('[data-test="mo-more"]').trigger('click')
    expect(w.find('[data-test="mo-delete"]').text()).toContain(zh.photosMoDeleteMoment)
    expect(w.find('[data-test="mo-delete"]').text()).toContain(zh.photosSvPhotosStayLibrary)
  })
})

// Fix-1 item 1 (owner acceptance, 2026-08-13): moment detail is nested inside
// PhotosSmartViewsView in Vue2 (activeNav==='smart', "Moments dedicated page" comment,
// NimoOS-UI PhotosTimeline.vue:1024-1033) -- same nav as the Moments · For You list page, so
// title='For You' and sub=the topbar's own default full-library computation (no 'smart' entry
// in topbarSubContext's navMap, PhotosTimeline.vue:229-234).
describe('Fix-1 item 1: PhotosTopbar restored (title=For You, default full-library sub)', () => {
  it('renders the topbar with title=For You, no search box', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail('m1', 'zh_cn')
    expect(w.findComponent(PhotosTopbar).exists()).toBe(true)
    expect(w.get('.topbar-title').text()).toBe(zh.photosMoForYou)
    expect(w.find('.topbar .search').exists()).toBe(false)
  })

  it('passes hide-drawer-trigger to PhotosSidebar', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail('m1', 'zh_cn')
    expect(w.findComponent(PhotosSidebar).props('hideDrawerTrigger')).toBe(true)
  })
})
