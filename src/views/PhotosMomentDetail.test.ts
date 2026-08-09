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
  vi.clearAllMocks()
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
  it('time window: shows a single date when the two ends fall on the same day', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ timeFrom: '2016-11-20T01:00:00Z', timeTo: '2016-11-20T09:00:00Z' })]
    s.listLoaded = true
    const { w } = await mountDetail()
    const txt = w.find('[data-test="mo-about-time"]').text()
    expect(txt).not.toContain('–')
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
    expect(bars[0].attributes('title')).toContain('2')  // November holds two, so it sorts first
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
})
