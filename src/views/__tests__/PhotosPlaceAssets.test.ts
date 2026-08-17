// P6b-T9 (SP7 Photos "Places" detail, the final task of this sprint): PhotosPlaceAssets.vue —
// The `/photos/places/:key` place-photos page: month-grouped grid + lightbox + breadcrumb
// "city › spot" + three-state gating.
// D10: this is the leanest possible drill-in page — no multi-select/batch operations
// (selectable=false).
//
// Two hard requirements carried over from review (stronger than the brief, must be
// reflected in this file):
//  1) The route must be genuinely registered and the test must genuinely resolve it — not
//     just spy on router.push. See describe('Route registration and resolution')'s
//     resolve() assertion against **the real app router**
//     (`import { router as appRouter } from '../../router'`), and the rest of this file's
//     cases uniformly use a real router instance to push/replace (no mocking router).
//  2) The breadcrumb's city name / spot name must be derived from key + spot query via the
//     source of truth (store.detail) — they must not rely on the URL carrying
//     city/spotName. In this file's fixtures the URL never carries those two strings; they
//     are all read from the mocked getPlace response.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
// Source file text (Vite `?raw` import, types come from node_modules/vite/client.d.ts:243,
// no dependency on @types/node).
// [SP8-P6 T10 correction] The original tail note "this repo never had it installed" no
// longer holds — after the merge, `@types/node` is installed (devDependencies `^26.1.2`).
// This line's conclusion still stands: `?raw` works for **`.ts`/`.vue`** and only needs
// vite/client; in other words using `?raw` here isn't a workaround, it's simply sufficient.
// (⚠️ `?raw` on **`.css`/`.scss`** is the one case that's always an empty-string trap.)
// See the comment on the "append, don't reorder" case below for how this is used.
import routerSource from '../../router/index.ts?raw'
// Review I1: verifying the breadcrumb icon glyph against its source can likewise only be
// judged by reading the source file text (same `?raw` technique as above).
import photosPlaceAssetsRaw from '../PhotosPlaceAssets.vue?raw'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    getPlace: vi.fn(),
    listAssetsByPlace: vi.fn(),
    // Existing dependencies of PhotosGrid + lightbox (same precedent as
    // PhotosAlbumDetail.test.ts/PhotosPersonDetail.test.ts — a missing mock throws
    // uncaught exceptions on the hover/openAt path, polluting the test run; it doesn't
    // affect assertions but still needs to be plugged).
    thumbnailUrl: vi.fn((id: string | number, size?: string) => `mock://thumb/${id}/${size ?? 'large'}`),
    previewUrl: vi.fn((id: string | number) => `mock://preview/${id}`),
    spriteUrl: vi.fn((id: string | number) => `mock://sprite/${id}`),
    originalUrl: vi.fn((id: string | number) => `mock://original/${id}`),
    liveUrl: vi.fn((id: string | number) => `mock://live/${id}`),
    spriteMeta: vi.fn().mockRejectedValue(new Error('no video in test')),
    getAsset: vi.fn().mockRejectedValue(new Error('no hydrate in test')),
    getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
    recordView: vi.fn().mockResolvedValue(undefined),
    listFavoriteIds: vi.fn().mockResolvedValue([]),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

;(HTMLMediaElement.prototype as unknown as { play: () => Promise<void> }).play = vi.fn(() => Promise.resolve())
;(HTMLMediaElement.prototype as unknown as { pause: () => void }).pause = vi.fn()

import PhotosPlaceAssets from '../PhotosPlaceAssets.vue'
import PhotosGrid from '../../photos/components/PhotosGrid.vue'
// P7b-T5: FilterBar consumer (D19).
import PhotosFilterBar from '../../photos/components/PhotosFilterBar.vue'
import { usePhotosPlaces } from '../../photos/stores/places'
import { useLightbox } from '../../photos/lightbox/useLightbox'
import { router as appRouter } from '../../router'

const lb = useLightbox()
// P7b-T5 (global constraint 4): no longer building a separate createI18n instance —
// vitest.setup.ts already installs the src/i18n singleton into config.global.plugins,
// taking effect on every mount; the second instance previously built here would install
// alongside it and duplicate it, spamming 7 [Vue warn] lines per test case (the same issue
// already hit and fixed elsewhere this sprint, in T3/T4). After removing it, the three
// mount calls below also drop this local i18n from `global.plugins`, keeping only router —
// locale still falls back to zh_cn (localStorage is empty under jsdom), so existing Chinese
// copy assertions are unaffected.

function rawPlace(key: string | number, overrides: Record<string, unknown> = {}) {
  return {
    key,
    city: overrides.city ?? 'Tokyo',
    country: overrides.country ?? 'Japan',
    count: overrides.count ?? 42,
    trips: overrides.trips ?? 2,
    home: overrides.home ?? false,
    coverAssetId: overrides.coverAssetId ?? '',
    thumbs: overrides.thumbs ?? [],
    spots: overrides.spots ?? [],
    insights: overrides.insights ?? [],
    visits: overrides.visits ?? [],
    recent: overrides.recent ?? [],
    ...overrides,
  }
}

function asset(id: string | number, takenAt = '2026-05-01T10:00:00Z') {
  return { id, takenAt, mimeType: 'image/jpeg', originalName: `${id}.jpg` }
}

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/photos/places', name: 'photos-places', component: { template: '<div/>' } },
      { path: '/photos/places/:key', name: 'photos-place-assets', component: PhotosPlaceAssets },
    ],
  })
}

async function mountView(path: string) {
  const router = makeRouter()
  await router.push(path)
  await router.isReady()
  const w = mount(PhotosPlaceAssets, { global: { plugins: [router] } })
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  usePhotosPlaces().__resetForTest()
  lb.__resetForTest()
  svc.photos.getPlace.mockReset().mockResolvedValue(rawPlace('7'))
  svc.photos.listAssetsByPlace.mockReset().mockResolvedValue({ assets: [asset('a1'), asset('a2')] })
  svc.photos.thumbnailUrl.mockClear()
  svc.photos.recordView.mockClear()
  svc.photos.listFavoriteIds.mockClear()
})

afterEach(() => {
  lb.__resetForTest()
})

describe('Route registration and resolution (T8 review hard requirement 1: must genuinely register, test must genuinely resolve)', () => {
  it('the real app router resolves /photos/places/7 to name=photos-place-assets, with the component already attached', () => {
    const match = appRouter.resolve('/photos/places/7')
    expect(match.matched.length).toBeGreaterThan(0)
    expect(match.name).toBe('photos-place-assets')
    expect(match.matched[0]?.components?.default).toBeTruthy()
  })

  // Measured correction (the brief's numbers/assertion were wrong; going by actual
  // source/runtime behavior and recording it here): vue-router 4's `getRoutes()` sorts the
  // match table by its own scoring algorithm (routes with dynamic segments get moved as a
  // block toward the front of the list) — it is **not** declaration order. In this repo's
  // route table, `photos-place-assets` actually ends up sorted **before**
  // `photos-places` (because the former carries a `:key` dynamic segment), so asserting
  // "sorted after" via a `getRoutes()` index would necessarily be a false red — unrelated
  // to the "append, don't reorder" hard constraint itself (that constraint is about the
  // source file, to minimize rebase conflicts, not runtime match priority). Instead assert
  // against **the source file text**: the `/photos/places/:key` line is genuinely appended
  // after the `/photos/places` line, and both lines are still present (neither was moved
  // elsewhere).
  //
  // Review Minor (division of labor note): `src/router/index.test.ts` already has a
  // matching `?raw` source-text-order assertion, but it checks **a different pair** of
  // boundaries (`/photos/people/:id` → `/photos/places` → `/login`, set up during the
  // P6a-T11 append) and has never covered where this task's new `/photos/places/:key`
  // lands. Both assertions use the same *technique* (`?raw` text order) but check the
  // route boundaries newly added by two different tasks — this is not a duplicate
  // assertion of the same thing. Deliberately not touching `router/index.test.ts` (leaving
  // its existing assertions alone); this case belongs here instead.
  it('in the source file, /photos/places/:key is appended after the /photos/places line (existing routes are not reordered)', () => {
    const placesLine = routerSource.indexOf("path: '/photos/places',")
    const assetsLine = routerSource.indexOf("path: '/photos/places/:key',")
    expect(placesLine).toBeGreaterThanOrEqual(0)
    expect(assetsLine).toBeGreaterThan(placesLine)
  })

  it('after a real push to /photos/places/9, currentRoute.name is genuinely photos-place-assets (not just a spied push)', async () => {
    const router = makeRouter()
    await router.push('/photos/places/9')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('photos-place-assets')
    expect(router.currentRoute.value.params.key).toBe('9')
  })
})

describe('orchestrates data on mount (parameter normalization + T8 hard requirement 2: breadcrumb sources from key/spot, ignores stale strings on the URL)', () => {
  it('no query → loadDetail("7") and assets.load("7", "", null, null)', async () => {
    await mountView('/photos/places/7')
    expect(svc.photos.getPlace).toHaveBeenCalledWith('7')
    expect(svc.photos.listAssetsByPlace).toHaveBeenCalledWith('7', '', 500, null, null)
  })

  it('with spot/lat/lon query → assets.load("7", "s1", 30.1, 120.2)', async () => {
    svc.photos.getPlace.mockResolvedValue(rawPlace('7', {
      spots: [{ key: 's1', name: 'Shibuya Crossing', lat: 30.1, lon: 120.2, count: 5, thumb: '' }],
    }))
    await mountView('/photos/places/7?spot=s1&lat=30.1&lon=120.2')
    expect(svc.photos.listAssetsByPlace).toHaveBeenCalledWith('7', 's1', 500, 30.1, 120.2)
  })

  it('lat is not numeric (lat=abc) → passes null, never sends NaN to the backend', async () => {
    svc.photos.getPlace.mockResolvedValue(rawPlace('7', {
      spots: [{ key: 's1', name: 'Shibuya Crossing', lat: 30.1, lon: 120.2, count: 5, thumb: '' }],
    }))
    await mountView('/photos/places/7?spot=s1&lat=abc&lon=120.2')
    expect(svc.photos.listAssetsByPlace).toHaveBeenCalledWith('7', 's1', 500, null, 120.2)
  })

  // Review I1: lat/lon must be paired with spotKey and never take effect on their own,
  // matching Vue2's `_applyPlaceFromQuery` (PhotosTimeline.vue:538-545) semantics of only
  // assigning coordinates when spot is actually matched. In-app navigation never hits this
  // path (showWholeCity/spot cards always clear or carry all three keys together), but
  // hand-edited address bars/stale bookmarks can: `?lat=1&lon=2` with **no** `spot=` →
  // lat/lon must both be collapsed to null, never sent to the backend as orphaned
  // coordinates (that would violate the shared package's "lat/lon paired with spotKey"
  // invariant).
  it('has lat/lon but no spot query → lat/lon both collapse to null, spotKey is sent as an empty string', async () => {
    await mountView('/photos/places/7?lat=1&lon=2')
    expect(svc.photos.listAssetsByPlace).toHaveBeenCalledWith('7', '', 500, null, null)
  })

  it('title: AreaShell\'s title is the city name sourced from store.detail (the URL never carries a city string)', async () => {
    svc.photos.getPlace.mockResolvedValue(rawPlace('7', { city: 'Kyoto' }))
    const { w } = await mountView('/photos/places/7')
    expect(w.find('.area-title').text()).toBe('Kyoto')
  })

  it('title: falls back to t("photosPlaces") ("地点") while detail has not yet arrived', async () => {
    svc.photos.getPlace.mockReturnValue(new Promise(() => {})) // never resolves
    const router = makeRouter()
    await router.push('/photos/places/7')
    await router.isReady()
    const w = mount(PhotosPlaceAssets, { global: { plugins: [router] } })
    await w.vm.$nextTick()
    expect(w.find('.area-title').text()).toBe(zh.photosPlaces)
  })
})

describe('reruns when route params change (SP6-P5.5 lesson #6: hash routing does not rebuild the same component, missing a watcher renders stale data)', () => {
  it('key changes from 7 to 9 → loadDetail/assets.load each get called again, and no stale data lingers', async () => {
    svc.photos.getPlace.mockImplementation((key: string) =>
      Promise.resolve(rawPlace(key, { city: key === '7' ? 'Tokyo' : 'Osaka' })))
    svc.photos.listAssetsByPlace.mockImplementation((key: string) => {
      if (key === '7') return Promise.resolve({ assets: [asset('a1'), asset('a2')] })
      return Promise.resolve({ assets: [asset('b1'), asset('b2'), asset('b3')] })
    })
    const { w, router } = await mountView('/photos/places/7')
    expect(w.findAll('.tile')).toHaveLength(2)
    expect(w.find('.area-title').text()).toBe('Tokyo')

    const getPlaceCallsBefore = svc.photos.getPlace.mock.calls.length
    const listCallsBefore = svc.photos.listAssetsByPlace.mock.calls.length

    await router.push('/photos/places/9')
    await flushPromises()
    await w.vm.$nextTick()

    expect(svc.photos.getPlace.mock.calls.length).toBe(getPlaceCallsBefore + 1)
    expect(svc.photos.listAssetsByPlace.mock.calls.length).toBe(listCallsBefore + 1)
    expect(svc.photos.getPlace).toHaveBeenLastCalledWith('9')
    expect(svc.photos.listAssetsByPlace).toHaveBeenLastCalledWith('9', '', 500, null, null)
    // The old data (2 photos, a1/a2) doesn't linger — the grid switches to the new place's
    // 3 photos, b1/b2/b3.
    expect(w.findAll('.tile')).toHaveLength(3)
    expect(w.find('.area-title').text()).toBe('Osaka')
  })
})

describe('breadcrumb (mirrors Vue2 PhotosTimeline.vue:1073-1090\'s information hierarchy)', () => {
  it('no spot → the city segment is a span (not a button)', async () => {
    const { w } = await mountView('/photos/places/7')
    expect(w.find('[data-test="place-crumb-city-span"]').exists()).toBe(true)
    expect(w.find('[data-test="place-crumb-city-btn"]').exists()).toBe(false)
    expect(w.find('[data-test="place-crumb-spot"]').exists()).toBe(false)
  })

  it('has spot and it\'s found by key in detail → the city segment is a button + spot name + right chevron', async () => {
    svc.photos.getPlace.mockResolvedValue(rawPlace('7', {
      spots: [{ key: 's1', name: 'Shibuya Crossing', lat: 30.1, lon: 120.2, count: 5, thumb: '' }],
    }))
    const { w } = await mountView('/photos/places/7?spot=s1&lat=30.1&lon=120.2')
    expect(w.find('[data-test="place-crumb-city-btn"]').exists()).toBe(true)
    expect(w.find('[data-test="place-crumb-city-span"]').exists()).toBe(false)
    expect(w.find('[data-test="place-crumb-spot"]').text()).toBe('Shibuya Crossing')
    expect(w.find('.crumb-chev').exists()).toBe(true)
  })

  it('clicking the city segment → router.replace to the same path with no query', async () => {
    svc.photos.getPlace.mockResolvedValue(rawPlace('7', {
      spots: [{ key: 's1', name: 'Shibuya Crossing', lat: 30.1, lon: 120.2, count: 5, thumb: '' }],
    }))
    const { w, router } = await mountView('/photos/places/7?spot=s1&lat=30.1&lon=120.2')
    await w.find('[data-test="place-crumb-city-btn"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos/places/7')
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('photo count = photosPlacesPhotoCount({n: photos.length})', async () => {
    svc.photos.listAssetsByPlace.mockResolvedValue({ assets: [asset('a1'), asset('a2')] })
    const { w } = await mountView('/photos/places/7')
    expect(w.find('[data-test="place-crumb-count"]').text()).toBe('2 张照片')
  })
})

describe('stale data doesn\'t linger during the second load (review I2)', () => {
  it('key changes from 7 to 9; before 9\'s response arrives: the page takes the skeleton branch, no trace of 7\'s old photo grid', async () => {
    svc.photos.getPlace.mockImplementation((key: string) =>
      Promise.resolve(rawPlace(key, { city: key === '7' ? 'Tokyo' : 'Osaka' })))
    let resolveNine: (v: unknown) => void = () => {}
    svc.photos.listAssetsByPlace.mockImplementation((key: string) => {
      if (key === '7') return Promise.resolve({ assets: [asset('a1'), asset('a2')] })
      return new Promise((r) => { resolveNine = r })
    })
    const { w, router } = await mountView('/photos/places/7')
    expect(w.findAll('.tile')).toHaveLength(2)

    await router.push('/photos/places/9')
    await flushPromises()
    await w.vm.$nextTick()

    // 9's response hasn't arrived yet — it should not keep showing 7's old photos; it
    // should take the skeleton branch.
    expect(w.find('[data-test="place-assets-skeleton"]').exists()).toBe(true)
    expect(w.findAll('.tile')).toHaveLength(0)

    resolveNine({ assets: [asset('b1'), asset('b2'), asset('b3')] })
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.find('[data-test="place-assets-skeleton"]').exists()).toBe(false)
    expect(w.findAll('.tile')).toHaveLength(3)
  })
})

describe('breadcrumb icon glyph matches its source (review I1)', () => {
  it('.crumb-icon is a folded map (Vue2 PhotosIcon.vue name="map"), not a map pin', () => {
    const m = /<svg class="crumb-icon"[^>]*>([\s\S]*?)<\/svg>/.exec(photosPlaceAssetsRaw)
    expect(m, 'could not find the .crumb-icon svg').not.toBeNull()
    expect(m![1]).toContain('M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z')
    expect(m![1]).toContain('M9 4v14M15 6v14')
    expect(m![1]).not.toContain('M12 21s-7-7.5-7-12')
  })
})

describe('silently degrades when spot isn\'t found (mirrors Vue2 PhotosTimeline.vue:547-551, no toast)', () => {
  it('query has spot=zzz, not present in detail\'s spots → no spot segment appears, router.replace clears spot/lat/lon', async () => {
    svc.photos.getPlace.mockResolvedValue(rawPlace('7', {
      spots: [{ key: 's1', name: 'Shibuya Crossing', lat: 30.1, lon: 120.2, count: 5, thumb: '' }],
    }))
    const { w, router } = await mountView('/photos/places/7?spot=zzz&lat=1&lon=2')
    await flushPromises()
    expect(w.find('[data-test="place-crumb-spot"]').exists()).toBe(false)
    expect(w.find('[data-test="place-crumb-city-span"]').exists()).toBe(true) // already degraded to a whole-city leaf
    expect(router.currentRoute.value.query.spot).toBeUndefined()
    expect(router.currentRoute.value.query.lat).toBeUndefined()
    expect(router.currentRoute.value.query.lon).toBeUndefined()
  })
})

describe('three-state gating', () => {
  it('loading && !loaded → skeleton', async () => {
    svc.photos.listAssetsByPlace.mockReturnValue(new Promise(() => {}))
    const router = makeRouter()
    await router.push('/photos/places/7')
    await router.isReady()
    const w = mount(PhotosPlaceAssets, { global: { plugins: [router] } })
    await w.vm.$nextTick()
    expect(w.find('[data-test="place-assets-skeleton"]').exists()).toBe(true)
    expect(w.find('[data-test="place-assets-failed"]').exists()).toBe(false)
    expect(w.find('[data-test="place-assets-empty"]').exists()).toBe(false)
  })

  it('failed → failure copy + retry button, clicking retry calls load again', async () => {
    svc.photos.listAssetsByPlace.mockRejectedValueOnce(new Error('network down'))
    const { w } = await mountView('/photos/places/7')
    expect(w.find('[data-test="place-assets-failed"]').exists()).toBe(true)
    expect(w.text()).toContain(zh.photosPlacesLoadFailed)

    const before = svc.photos.listAssetsByPlace.mock.calls.length
    svc.photos.listAssetsByPlace.mockResolvedValue({ assets: [asset('a1')] })
    await w.find('[data-test="place-assets-retry"]').trigger('click')
    await flushPromises()
    expect(svc.photos.listAssetsByPlace.mock.calls.length).toBe(before + 1)
    expect(w.find('[data-test="place-assets-failed"]').exists()).toBe(false)
    expect(w.findAll('.tile')).toHaveLength(1)
  })

  it('loaded with zero photos → reuses the existing empty-state copy', async () => {
    svc.photos.listAssetsByPlace.mockResolvedValue({ assets: [] })
    const { w } = await mountView('/photos/places/7')
    expect(w.find('[data-test="place-assets-empty"]').exists()).toBe(true)
    expect(w.text()).toContain(zh.photosNoPhotos)
    expect(w.text()).toContain(zh.photosNoPhotosHint)
  })
})

describe('grid + lightbox', () => {
  it('months is passed through to PhotosGrid; selectable is passed as false (D10: no multi-select)', async () => {
    const { w } = await mountView('/photos/places/7')
    const grid = w.findComponent(PhotosGrid)
    expect(grid.exists()).toBe(true)
    expect(grid.props('selectable')).toBe(false)
    const months = grid.props('months') as Array<{ photos: Array<{ id: string | number }> }>
    expect(months.flatMap((m) => m.photos).map((p) => p.id)).toEqual(['a1', 'a2'])
  })

  // Review Minor fix: the original title "when selectable isn't passed…" was worded
  // inaccurately — this page's template actually **does explicitly** pass
  // `:selectable="false"` (D10: no multi-select); it's not "not passed". What this
  // assertion actually verifies is the D10 semantics themselves (the checkbox genuinely
  // isn't rendered), so the title was changed to reflect that.
  it('D10 in practice: this page explicitly passes selectable=false, and the checkbox genuinely does not render', async () => {
    const { w } = await mountView('/photos/places/7')
    expect(w.find('.tile-checkbox').exists()).toBe(false)
  })

  it('PhotosGrid emits open → lb.openAt receives a list that is the whole page\'s photos (D9 paging set)', async () => {
    const { w } = await mountView('/photos/places/7')
    await w.find('.tile').trigger('click')
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.list.value.map((p) => p.id)).toEqual(['a1', 'a2'])
  })
})

// P7b-T5: wires EXIF filtering into the drill-in page (D19: keep only the year + camera
// chips, no location dimension — the city is already framed by the route, so a second
// layer of location-text filtering would be a mis-fire; matches Vue2
// PhotosTimeline.vue:167's spot branch).
describe('P7b-T5: EXIF filter wiring (D19)', () => {
  // Fixture: two photos spanning two years (2023 / 2020), neither landing on 1999, which
  // any test assertion uses — filtering years:['2023'] hits 1 photo (p1), filtering
  // years:['1999'] hits 0, and the place total is always 2. Reuses the existing `asset()`
  // helper (id, takenAt) to produce the base shape, then layers on placeName/make/model
  // (assetToPhoto.ts:319-321, 367 read out camera/place respectively).
  function placeFixtureAssets() {
    return [
      { ...asset('p1', '2023-06-15T10:00:00Z'), placeName: 'Tokyo', make: 'Canon', model: 'EOS R5' },
      { ...asset('p2', '2020-01-01T10:00:00Z'), placeName: 'Tokyo', make: 'Sony', model: 'A7' },
    ]
  }

  beforeEach(() => {
    svc.photos.listAssetsByPlace.mockReset().mockResolvedValue({ assets: placeFixtureAssets() })
  })

  // "Existing helper": the brief's `mountPlaceAssets()` is just this file's existing
  // `mountView(path)` — this file has never had a helper actually named mountPlaceAssets;
  // the brief was using an illustrative name. Reusing the one that already exists here
  // rather than adding a parallel mounting scaffold.
  async function mountPlaceAssets() {
    return mountView('/photos/places/7')
  }

  it('D19: renders only the year and camera chips, no location chip', async () => {
    const { w } = await mountPlaceAssets()
    const bar = w.findComponent(PhotosFilterBar)
    expect(bar.exists()).toBe(true)
    expect(bar.props('chipKeys')).toEqual(['years', 'cameras'])
    expect(w.find('[data-test="exif-chip-places"]').exists()).toBe(false)
    // fix round 1, must-fix 1 (review): a props assertion can't catch "mounted the right
    // component in the wrong place" bugs — moving <PhotosFilterBar> in front of
    // .crumb-spacer (the shape the implementer actually wrote wrong the first time, only
    // caught by eyeballing it against the brief) leaves the three assertions above still
    // green, but on screen the filter bar jumps from the right side to sit next to the
    // breadcrumb text: .crumb-spacer{flex:1} pushes apart whatever comes "after" it, so
    // inserting FilterBar before it makes it hug the breadcrumb text instead of appearing
    // on the right next to the count. Pin the DOM order down with adjacent-sibling
    // selectors: .crumb-spacer is immediately followed by .exif-filter (FilterBar's root
    // node), and .exif-filter is immediately followed by .crumb-count — comment nodes in
    // between don't affect the CSS adjacent-sibling selector's match.
    // Mutation testing (executed by hand and reverted; evidence in task-5-report.md's "fix
    // round 1" section): moving <PhotosFilterBar> in the template to before
    // <div class="crumb-spacer"> → both of these assertions turn red
    // (neither crumb-spacer + exif-filter nor exif-filter + crumb-count can find a
    // matching node) → reverted.
    expect(w.find('.crumb-spacer + .exif-filter').exists()).toBe(true)
    expect(w.find('.exif-filter + .crumb-count').exists()).toBe(true)
  })

  // fix round (sprint-end final review, must-fix I2): the drill-in page's facet-source
  // invariant had no assertion at all before this — the timeline page side
  // (Photos.integration.test.ts's "FilterBar's facet source is the whole-library
  // allPhotos, not narrowed by an already-applied filter") has a dedicated regression
  // lock; the drill-in page was bare. `:photos="assets.photos.value"` must always be the
  // unfiltered collection, otherwise the bug the plan called out by name shows up: after
  // filtering out a year, that year disappears from the dropdown and can never be
  // selected again. Same shape as the timeline page's lock: record the facet source's
  // length before submitting, apply a filter, then confirm the facet source's length is
  // unchanged (the photos prop FilterBar receives doesn't narrow along with gridMonths).
  //
  // Mutation testing (executed by hand and reverted; evidence in task-5-report.md's
  // "sprint-end final review fix wave" section): temporarily changing PhotosFilterBar's
  // `:photos="assets.photos.value"` in the template to
  // `:photos="gridMonths.flatMap(m => m.photos)"` → the assertion below turns red, from 2
  // to 1 (the facet source narrowed along with the filter) → reverted.
  it('FilterBar\'s facet source is always the unfiltered assets.photos, not narrowed by an already-applied filter', async () => {
    const { w } = await mountPlaceAssets()
    const bar = w.findComponent(PhotosFilterBar)
    const before = (bar.props('photos') as unknown[]).length
    expect(before).toBe(2) // fixture math: placeFixtureAssets() has two.

    await bar.vm.$emit('update:filter', { years: ['2023'], places: [], cameras: [] })
    await w.vm.$nextTick()

    expect((w.findComponent(PhotosFilterBar).props('photos') as unknown[]).length).toBe(before)
  })

  // fix round (sprint-end final review, suggested to bundle in M1): even if future code
  // (deep links/store) stuffs a value into exifFilter.places, D19 (the drill-in page only
  // filters by year/camera) must self-certify at the data layer — the grid result must not
  // narrow just because places has a value. Traced back to `PhotosPlaceAssets.vue`'s
  // gridMonths: after changing it to an explicit projection
  // `{ years: exifFilter.value.years, cameras: exifFilter.value.cameras }`,
  // `applyExifFilters` can no longer even read the places key, so it cannot take effect no
  // matter what value it's stuffed with.
  it('M1: exifFilter.places has no effect even when given a value (D19 self-certifies at the data layer, not just relying on the UI not rendering a location chip)', async () => {
    const { w } = await mountPlaceAssets()
    // Stuff in a value that matches neither fixture asset's place('Tokyo') — if places
    // were actually read and applied, the result would be filtered down to 0; if places is
    // correctly ignored (data-layer self-certification), the result is unaffected and
    // still the pre-filter 2.
    await w.findComponent(PhotosFilterBar).vm.$emit(
      'update:filter', { years: [], places: ['某个不存在的地名'], cameras: [] })
    await w.vm.$nextTick()
    const months = w.findComponent(PhotosGrid).props('months') as Array<{ photos: unknown[] }>
    expect(months.flatMap((m) => m.photos)).toHaveLength(2) // if places took effect, this would be 0.
  })

  it('once a filter takes effect, the grid only gets the matching photos (the empty-month gate itself is vacuously true here — see below for why), and the lightbox paging set narrows along with it', async () => {
    // fix round 1, Minor 1 (review): the original case name promised that "empty months
    // get dropped", but that's a vacuously-true assertion — groupPhotosByMonth
    // (util/groupPhotosByMonth.ts:15-23)'s buckets are only created when a photo lands in
    // them, so an empty bucket can never be produced; this page also filters before
    // grouping, so the `.filter(m => m.photos.length > 0)` in PhotosPlaceAssets.vue is
    // structurally incapable of removing anything on this call path — deleting that
    // .filter wouldn't turn this case red either. The case name has been changed to stop
    // promising something it doesn't actually verify; the `months.every(...)` line below is
    // kept as-is (it verifies "the months that do match genuinely have photos", not the
    // unsupportable claim "empty months get dropped").
    const { w } = await mountPlaceAssets()
    await w.findComponent(PhotosFilterBar).vm.$emit(
      'update:filter', { years: ['2023'], places: [], cameras: [] })
    await w.vm.$nextTick()
    const months = w.findComponent(PhotosGrid).props('months') as Array<{ photos: unknown[] }>
    expect(months.every((m) => m.photos.length > 0)).toBe(true)
    // fixture math: 2023 only matches p1 (p2 is 2020).
    expect(months.flatMap((m) => m.photos)).toHaveLength(1)

    // fix round 1, must-fix 2 (review, constraint 5 / a regression lock of the same shape
    // as D9): the lightbox paging set must narrow along with the filter — it must not be
    // the "pre-filter" whole-page photos. Once p2 (2020) is filtered out, the paging set
    // should no longer be able to page to it. The existing "emit open → list is the whole
    // page's photos" case is a zero-filter scenario where both assets land in the same
    // month/bucket, so assets.photos.value and gridMonths.flatMap have the same value and
    // order in that scenario and are insensitive to this change — it can't be counted as
    // existing coverage, so a direct assertion for the post-filter case is added here.
    // Mutation testing (executed by hand and reverted; evidence in task-5-report.md):
    // temporarily reverting PhotosPlaceAssets.vue's onOpen from
    // `gridMonths.value.flatMap(...)` back to `assets.photos.value` → the assertion below
    // turns red, from `['p1']` to `['p1', 'p2']` (the paging set picked up the filtered-out
    // p2) → reverted.
    await w.find('.tile').trigger('click')
    await flushPromises()
    expect(lb.list.value.map((p) => p.id)).toEqual(['p1'])
  })

  // fix round (sprint-end final review, must-fix I1, case name changed): what this locks
  // down is **which gating branch runs** — when filtering down to zero, the code takes the
  // v-else below (PhotosGrid renders its own empty grid), not the `place-assets-empty`
  // branch. But the empty-state copy rendered by both paths is byte-identical (both are
  // photosNoPhotos / photosNoPhotosHint — PhotosGrid's own empty state uses exactly those
  // two keys), so what the user sees doesn't differ based on which branch runs — the
  // original case name "doesn't fall into that empty state" implied "what the user sees is
  // different", which doesn't hold, so it's been reworded. This assertion is still worth
  // keeping: it pins down the logical invariant that "the three-state gate's empty-state
  // decision must read unfiltered data, and must not mistake an empty filter result for the
  // whole place having no assets", even though this is invisible to the user.
  it('when filtered down to zero, the three-state gate takes v-else (not the place-assets-empty branch); the breadcrumb count is still the place total', async () => {
    const { w } = await mountPlaceAssets()
    await w.findComponent(PhotosFilterBar).vm.$emit(
      'update:filter', { years: ['1999'], places: [], cameras: [] })
    await w.vm.$nextTick()
    expect(w.find('[data-test="place-assets-empty"]').exists()).toBe(false)
    // fix round 1, Minor 2 (review): the original `.toContain('2')` was too loose — the
    // fixture's rawPlace() defaults to count:42 (this file, :66); if the count were
    // mistakenly changed to read store.detail.count it would render "42 张照片", and
    // toContain('2') would still pass (because "42" contains "2"). Changed to an exact
    // full-string match to pin down the contract: the count must read the place's asset
    // array length (2), not that count field in detail.
    expect(w.get('[data-test="place-crumb-count"]').text()).toBe('2 张照片')
  })
})
