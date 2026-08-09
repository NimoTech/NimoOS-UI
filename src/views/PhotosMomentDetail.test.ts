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
import { usePhotosMoments, type Moment } from '../photos/stores/moments'

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
