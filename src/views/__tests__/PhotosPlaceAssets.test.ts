// PhotosPlaceAssets.vue — the `/photos/places/:key` place-assets page: month-grouped grid +
// lightbox + breadcrumb ("city › spot") + three-state gate. This page is a minimal drop-in for
// jumping into the library, no multi-select/batch operations (selectable=false).
//
// Two hard requirements carried over from review (must show up in this
// file):
//  1) The route must be genuinely registered and tests must genuinely resolve it — not just spy
//     on router.push. See describe('Route registration and resolution')'s resolve() assertion
//     against the **real app router** (`import { router as appRouter } from '../../router'`), and
//     every other case in this file uniformly pushing/replacing on a real router instance (never
//     mocking the router).
//  2) The breadcrumb's city/spot names must be derived from the key + spot query round-tripped
//     through `store.detail` — never assumed to arrive as city/spotName on the URL. This file's
//     fixtures never put those two strings on the URL; they're always read from the mocked
//     getPlace response.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
// Source-file text (a Vite `?raw` import, typed via node_modules/vite/client.d.ts:243, no
// dependency on @types/node). Correction: the original claim that "this repo doesn't even have
// it installed" no longer holds — after merging, `@types/node` is installed (devDependencies
// `^26.1.2`). The conclusion here still stands: `?raw` works for **`.ts`/`.vue`** and only needs
// vite/client — in other words, using `?raw` here isn't a workaround, it's simply sufficient.
// (Watch out: `?raw` on **`.css`/`.scss`** is the one case that's always empty.) See the
// "append without reordering" case below for how this is used.
import routerSource from '../../router/index.ts?raw'
// Verifying the breadcrumb icon's glyph likewise can only be checked by reading the source file's
// text (same `?raw` technique as above).
import photosPlaceAssetsRaw from '../PhotosPlaceAssets.vue?raw'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    getPlace: vi.fn(),
    listAssetsByPlace: vi.fn(),
    // An existing dependency of PhotosGrid + the lightbox (same precedent as
    // PhotosAlbumDetail.test.ts/PhotosPersonDetail.test.ts — missing this mock throws an
    // uncaught exception on the hover/openAt path, polluting the test run; it doesn't affect
    // assertions but still needs to be plugged).
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
// FilterBar consumption.
import PhotosFilterBar from '../../photos/components/PhotosFilterBar.vue'
import { usePhotosPlaces } from '../../photos/stores/places'
import { useLightbox } from '../../photos/lightbox/useLightbox'
import { router as appRouter } from '../../router'

const lb = useLightbox()
// No longer building a separate createI18n instance — vitest.setup.ts already installs the
// src/i18n singleton into config.global.plugins, taking effect on every mount; a second locally
// built instance here would double-install alongside it, printing 7 [Vue warn] lines per test
// case (the same issue already hit and fixed elsewhere). After removing it, the three mount
// calls below also drop this local i18n from `global.plugins`, keeping only the router — locale
// still falls back to zh_cn (localStorage is empty under jsdom), so the existing Chinese-text
// assertions are unaffected.

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
    history: createWebHashHistory('/'),
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

// The transitional AreaShell/.photos-layout shell has been swapped for the same
// `.photos-root > .app[data-collapsed] > PhotosSidebar + main.main > PhotosTopbar +
// .photos-main` structure every other re-shelled Photos page uses (PhotosPeople.vue/
// PhotosAlbums.vue's own precedent, PhotosPeople.test.ts's own re-shell test as the style
// reference).
describe('PhotosPlaceAssets.vue — re-shell', () => {
  it('mounts the app shell: .photos-root .app exists, PhotosTopbar title=city name with no sub, lightbox outside', async () => {
    svc.photos.getPlace.mockResolvedValue(rawPlace('7', { city: 'Kyoto' }))
    const { w } = await mountView('/photos/places/7')
    expect(w.find('.photos-root .app').exists()).toBe(true)

    const topbar = w.findComponent({ name: 'PhotosTopbar' })
    expect(topbar.exists()).toBe(true)
    expect(topbar.props('title')).toBe('Kyoto')
    // Vue2 has no dedicated topbar/sub for this detail context (see this file's own header
    // comment). A prop-level assertion here let a real regression slip through review —
    // PhotosTopbar's `sub` computed falls back to the library-wide count summary on an *omitted*
    // prop (`??` only catches null/undefined, not ''), so simply not passing `sub` would render a
    // stray, wrong subtitle under the city name. The page now passes `sub=""` (the explicit
    // opt-out PhotosTopbar.vue was given at the same time), and PhotosTopbar itself now renders
    // no `.topbar-sub` node at all for an empty string — assert that DOM outcome directly, not
    // the prop value.
    expect(w.find('.topbar-sub').exists()).toBe(false)

    // PhotoLightbox re-nested INSIDE .photos-root -- the re-skin removed the scoped-vs-parity
    // cascade tie that made nesting unsafe.
    const rootEl = w.find('.photos-root').element
    const lbComp = w.findComponent({ name: 'PhotoLightbox' })
    expect(rootEl.contains(lbComp.element)).toBe(true)
  })
})

describe('route registration and resolution (hard requirement 1: must be genuinely registered and resolved)', () => {
  it('resolves /photos/places/7 to name=photos-place-assets on the real app router, with the component attached', () => {
    const match = appRouter.resolve('/photos/places/7')
    expect(match.matched.length).toBeGreaterThan(0)
    expect(match.name).toBe('photos-place-assets')
    expect(match.matched[0]?.components?.default).toBeTruthy()
  })

  // Correction from actually running this (the originally proposed numbers/assertion were
  // wrong): vue-router 4's `getRoutes()` sorts its match
  // table by its own scoring algorithm (dynamic-segment routes get moved as a group toward the
  // front of the list) — it is **not** declaration order. In this repo's actual route table,
  // `photos-place-assets` ends up sorted **before** `photos-places` (because the former has a
  // `:key` dynamic segment), so asserting "comes after" via `getRoutes()` index would necessarily
  // be a false red, and it's unrelated to the "append without reordering" constraint itself (that
  // constraint is about the source file, to minimize rebase conflicts — not runtime match
  // priority). Instead this asserts against the **source file's text**: the
  // `/photos/places/:key` line is indeed appended after the `/photos/places` line, and both lines
  // are still present (neither was moved elsewhere).
  //
  // Division-of-labor note: `src/router/index.test.ts` already has a matching `?raw`
  // source-text-order assertion, but it checks **a different pair** of boundaries
  // (`/photos/people/:id` → `/photos/places` → `/login`, established when that route was
  // appended) — it never covered where this task's new `/photos/places/:key` lands. Both
  // assertions use the same verification *technique* (`?raw` text order), but they check the
  // route boundaries added by two different, separate pieces of work, not a duplicate assertion
  // of the same thing. `router/index.test.ts` is deliberately left untouched (its existing
  // assertion isn't modified); this one is added here instead, next to the code it's about.
  it('appends /photos/places/:key after /photos/places in the source file (no reordering of existing routes)', () => {
    const placesLine = routerSource.indexOf("path: '/photos/places',")
    const assetsLine = routerSource.indexOf("path: '/photos/places/:key',")
    expect(placesLine).toBeGreaterThanOrEqual(0)
    expect(assetsLine).toBeGreaterThan(placesLine)
  })

  it('currentRoute.name is genuinely photos-place-assets after a real push to /photos/places/9 (not just a spied push)', async () => {
    const router = makeRouter()
    await router.push('/photos/places/9')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('photos-place-assets')
    expect(router.currentRoute.value.params.key).toBe('9')
  })
})

describe('mounting orchestrates data loading (param normalization + hard requirement 2: breadcrumb derives from key/spot, never stale URL strings)', () => {
  it('no query → loadDetail("7") and assets.load("7", "", null, null)', async () => {
    await mountView('/photos/places/7')
    expect(svc.photos.getPlace).toHaveBeenCalledWith('7')
    expect(svc.photos.listAssetsByPlace).toHaveBeenCalledWith('7', '', 500, null, null)
  })

  it('spot/lat/lon query → assets.load("7", "s1", 30.1, 120.2)', async () => {
    svc.photos.getPlace.mockResolvedValue(rawPlace('7', {
      spots: [{ key: 's1', name: 'Shibuya Crossing', lat: 30.1, lon: 120.2, count: 5, thumb: '' }],
    }))
    await mountView('/photos/places/7?spot=s1&lat=30.1&lon=120.2')
    expect(svc.photos.listAssetsByPlace).toHaveBeenCalledWith('7', 's1', 500, 30.1, 120.2)
  })

  it('non-numeric lat (lat=abc) → passes null, never sends NaN to the backend', async () => {
    svc.photos.getPlace.mockResolvedValue(rawPlace('7', {
      spots: [{ key: 's1', name: 'Shibuya Crossing', lat: 30.1, lon: 120.2, count: 5, thumb: '' }],
    }))
    await mountView('/photos/places/7?spot=s1&lat=abc&lon=120.2')
    expect(svc.photos.listAssetsByPlace).toHaveBeenCalledWith('7', 's1', 500, null, 120.2)
  })

  // lat/lon must come paired with spotKey and never take effect decoupled from it — following
  // Vue2's `_applyPlaceFromQuery` (PhotosTimeline.vue:538-545) semantics of only assigning
  // coordinates when a spot actually matches. In-app navigation never hits this
  // (showWholeCity/spot cards always clear or carry all three keys together), but hand-editing
  // the address bar or an old bookmark can: `?lat=1&lon=2` with **no** `spot=` → lat/lon must
  // both be forced to null, never passed to the backend as an orphaned coordinate pair (which
  // would violate the shared package's "lat/lon paired with spotKey" invariant).
  it('lat/lon present but no spot query → lat/lon both coerced to null, spotKey sent as empty string', async () => {
    await mountView('/photos/places/7?lat=1&lon=2')
    expect(svc.photos.listAssetsByPlace).toHaveBeenCalledWith('7', '', 500, null, null)
  })

  it("title: PhotosTopbar's title is the city name sourced from store.detail (never a city string carried on the URL)", async () => {
    svc.photos.getPlace.mockResolvedValue(rawPlace('7', { city: 'Kyoto' }))
    const { w } = await mountView('/photos/places/7')
    expect(w.findComponent({ name: 'PhotosTopbar' }).props('title')).toBe('Kyoto')
  })

  it('title: falls back to t("photosPlaces") ("地点") while detail hasn\'t arrived', async () => {
    svc.photos.getPlace.mockReturnValue(new Promise(() => {})) // 永不 resolve
    const router = makeRouter()
    await router.push('/photos/places/7')
    await router.isReady()
    const w = mount(PhotosPlaceAssets, { global: { plugins: [router] } })
    await w.vm.$nextTick()
    expect(w.findComponent({ name: 'PhotosTopbar' }).props('title')).toBe(zh.photosPlaces)
  })
})

describe('reruns on route param change (lesson 6: hash routing reuses the component, a missing watcher renders stale data)', () => {
  it('key changes from 7 to 9 → loadDetail/assets.load each fire again, no stale data lingers', async () => {
    svc.photos.getPlace.mockImplementation((key: string) =>
      Promise.resolve(rawPlace(key, { city: key === '7' ? 'Tokyo' : 'Osaka' })))
    svc.photos.listAssetsByPlace.mockImplementation((key: string) => {
      if (key === '7') return Promise.resolve({ assets: [asset('a1'), asset('a2')] })
      return Promise.resolve({ assets: [asset('b1'), asset('b2'), asset('b3')] })
    })
    const { w, router } = await mountView('/photos/places/7')
    expect(w.findAll('.tile')).toHaveLength(2)
    expect(w.findComponent({ name: 'PhotosTopbar' }).props('title')).toBe('Tokyo')

    const getPlaceCallsBefore = svc.photos.getPlace.mock.calls.length
    const listCallsBefore = svc.photos.listAssetsByPlace.mock.calls.length

    await router.push('/photos/places/9')
    await flushPromises()
    await w.vm.$nextTick()

    expect(svc.photos.getPlace.mock.calls.length).toBe(getPlaceCallsBefore + 1)
    expect(svc.photos.listAssetsByPlace.mock.calls.length).toBe(listCallsBefore + 1)
    expect(svc.photos.getPlace).toHaveBeenLastCalledWith('9')
    expect(svc.photos.listAssetsByPlace).toHaveBeenLastCalledWith('9', '', 500, null, null)
    // The old data (2 photos, a1/a2) doesn't linger — the grid switches to the new place's 3
    // photos, b1/b2/b3.
    expect(w.findAll('.tile')).toHaveLength(3)
    expect(w.findComponent({ name: 'PhotosTopbar' }).props('title')).toBe('Osaka')
  })
})

describe("breadcrumb (following Vue2 PhotosTimeline.vue:1073-1090's information hierarchy)", () => {
  it('no spot → the city segment is a span, not a button', async () => {
    const { w } = await mountView('/photos/places/7')
    expect(w.find('[data-test="place-crumb-city-span"]').exists()).toBe(true)
    expect(w.find('[data-test="place-crumb-city-btn"]').exists()).toBe(false)
    expect(w.find('[data-test="place-crumb-spot"]').exists()).toBe(false)
  })

  it('spot present and found by key in detail → city segment is a button + spot name + chevron', async () => {
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

describe('stale data does not linger during a second load', () => {
  it("key changes from 7 to 9, before 9's response arrives: the page takes the skeleton branch, no lingering grid of 7's old photos", async () => {
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

    // 9's response hasn't arrived yet — it shouldn't keep showing 7's old photos; it should be
    // on the skeleton branch.
    expect(w.find('[data-test="place-assets-skeleton"]').exists()).toBe(true)
    expect(w.findAll('.tile')).toHaveLength(0)

    resolveNine({ assets: [asset('b1'), asset('b2'), asset('b3')] })
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.find('[data-test="place-assets-skeleton"]').exists()).toBe(false)
    expect(w.findAll('.tile')).toHaveLength(3)
  })
})

describe('breadcrumb icon glyph sourced from truth', () => {
  it('.crumb-icon is the folded map (Vue2 PhotosIcon.vue name="map"), not a map pin', () => {
    const m = /<svg class="crumb-icon"[^>]*>([\s\S]*?)<\/svg>/.exec(photosPlaceAssetsRaw)
    expect(m, '未找到 .crumb-icon 的 svg').not.toBeNull()
    expect(m![1]).toContain('M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z')
    expect(m![1]).toContain('M9 4v14M15 6v14')
    expect(m![1]).not.toContain('M12 21s-7-7.5-7-12')
  })
})

describe('silently degrades when spot is not found (following Vue2 PhotosTimeline.vue:547-551, no toast)', () => {
  it("query has spot=zzz but detail's spots doesn't have it → no spot segment appears, router.replace clears spot/lat/lon", async () => {
    svc.photos.getPlace.mockResolvedValue(rawPlace('7', {
      spots: [{ key: 's1', name: 'Shibuya Crossing', lat: 30.1, lon: 120.2, count: 5, thumb: '' }],
    }))
    const { w, router } = await mountView('/photos/places/7?spot=zzz&lat=1&lon=2')
    await flushPromises()
    expect(w.find('[data-test="place-crumb-spot"]').exists()).toBe(false)
    expect(w.find('[data-test="place-crumb-city-span"]').exists()).toBe(true) // 已降级为整城 leaf
    expect(router.currentRoute.value.query.spot).toBeUndefined()
    expect(router.currentRoute.value.query.lat).toBeUndefined()
    expect(router.currentRoute.value.query.lon).toBeUndefined()
  })
})

describe('three-state gate', () => {
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
  it('months is passed through to PhotosGrid; selectable is false (no multi-select)', async () => {
    const { w } = await mountView('/photos/places/7')
    const grid = w.findComponent(PhotosGrid)
    expect(grid.exists()).toBe(true)
    expect(grid.props('selectable')).toBe(false)
    const months = grid.props('months') as Array<{ photos: Array<{ id: string | number }> }>
    expect(months.flatMap((m) => m.photos).map((p) => p.id)).toEqual(['a1', 'a2'])
  })

  // Correction: the original title "when selectable isn't passed…" was inaccurate — this page's
  // template actually **explicitly** passes `:selectable="false"` (no multi-select), it's not
  // "not passed". What this assertion really verifies is that semantics itself (checkboxes
  // genuinely don't render), so the title has been changed to reflect that.
  it("this page explicitly passes selectable=false, checkboxes genuinely don't render", async () => {
    const { w } = await mountView('/photos/places/7')
    expect(w.find('.tile-checkbox').exists()).toBe(false)
  })

  it('PhotosGrid emits open → lb.openAt receives the whole-page photos as the paging set', async () => {
    const { w } = await mountView('/photos/places/7')
    await w.find('.tile').trigger('click')
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.list.value.map((p) => p.id)).toEqual(['a1', 'a2'])
  })
})

// EXIF filtering wired into the place-assets page (only the years + cameras chips are kept, the
// places dimension doesn't appear — the city is already fixed by the route, so layering a
// place-text filter on top would wrongly exclude results; this follows Vue2
// PhotosTimeline.vue:167's spot branch).
describe('EXIF filter wiring', () => {
  // Fixture: two photos spanning two years (2023 / 2020), neither landing on 1999 which any test
  // assertion uses — filtering years:['2023'] hits 1 (p1), filtering years:['1999'] hits 0, and
  // the place's total is always 2. Reuses the existing `asset()` helper (id, takenAt) for the
  // base shape, then layers on placeName/make/model (assetToPhoto.ts:319-321 and 367 read
  // camera/place respectively).
  function placeFixtureAssets() {
    return [
      { ...asset('p1', '2023-06-15T10:00:00Z'), placeName: 'Tokyo', make: 'Canon', model: 'EOS R5' },
      { ...asset('p2', '2020-01-01T10:00:00Z'), placeName: 'Tokyo', make: 'Sony', model: 'A7' },
    ]
  }

  beforeEach(() => {
    svc.photos.listAssetsByPlace.mockReset().mockResolvedValue({ assets: placeFixtureAssets() })
  })

  // "Existing helper": `mountPlaceAssets()` here is just this file's existing `mountView(path)`
  // — this file never had a helper actually named mountPlaceAssets, that was just an illustrative
  // name; the existing one is reused rather than adding a parallel mounting scaffold.
  async function mountPlaceAssets() {
    return mountView('/photos/places/7')
  }

  it('renders only the years and cameras chips, no places chip', async () => {
    const { w } = await mountPlaceAssets()
    const bar = w.findComponent(PhotosFilterBar)
    expect(bar.exists()).toBe(true)
    expect(bar.props('chipKeys')).toEqual(['years', 'cameras'])
    expect(w.find('[data-test="exif-chip-places"]').exists()).toBe(false)
    // Props assertions alone can't catch a "right component, wrong position" bug — moving
    // <PhotosFilterBar> to just before .crumb-spacer (the exact mistake the implementation had on
    // its first pass, only caught by eyeballing it against the spec) leaves the three assertions
    // above all green, but on screen the filter bar jumps from the right side to sit right next
    // to the breadcrumb text: `.crumb-spacer{flex:1}` pushes apart whatever comes *after* it, so
    // inserting FilterBar before it makes it hug the breadcrumb text instead of sitting on the
    // right next to the count. Adjacent-sibling selectors pin down the DOM order instead:
    // .crumb-spacer is immediately followed by .exif-filter (FilterBar's root node), which is
    // immediately followed by .crumb-count — comment nodes in between don't affect CSS
    // adjacent-sibling matching.
    // Mutation testing (performed by hand and reverted): moving <PhotosFilterBar> in the template
    // to before <div class="crumb-spacer"> → turns both of these assertions red (neither
    // crumb-spacer + exif-filter nor exif-filter + crumb-count finds a matching node) → reverted.
    expect(w.find('.crumb-spacer + .exif-filter').exists()).toBe(true)
    expect(w.find('.exif-filter + .crumb-count').exists()).toBe(true)
  })

  // The place-assets page's facet-source invariant had no assertion at all before this — the
  // timeline page (Photos.integration.test.ts, "FilterBar's facet source is the library-wide
  // allPhotos, doesn't shrink with an already-applied filter") has a dedicated regression lock,
  // but the place-assets page was bare. `:photos="assets.photos.value"` must always be the
  // unfiltered set, or the bug this was written to catch shows up: after filtering out a year,
  // that year disappears from the dropdown and can never be selected again. Same shape as the
  // timeline page's lock: record the facet-source length before submitting a filter, submit one,
  // then confirm the facet-source length is unchanged (the photos prop FilterBar receives doesn't
  // shrink along with gridMonths).
  //
  // Mutation testing (performed by hand and reverted): temporarily changing the template's
  // PhotosFilterBar `:photos="assets.photos.value"` to
  // `:photos="gridMonths.flatMap(m => m.photos)"` → turns the assertion below from 2 to a red 1
  // (the facet source shrank along with the filter) → reverted.
  it("FilterBar's facet source is always the unfiltered assets.photos, doesn't shrink with an applied filter", async () => {
    const { w } = await mountPlaceAssets()
    const bar = w.findComponent(PhotosFilterBar)
    const before = (bar.props('photos') as unknown[]).length
    expect(before).toBe(2) // Fixture is deliberate: placeFixtureAssets() has exactly two.

    await bar.vm.$emit('update:filter', { years: ['2023'], places: [], cameras: [] })
    await w.vm.$nextTick()

    expect((w.findComponent(PhotosFilterBar).props('photos') as unknown[]).length).toBe(before)
  })

  // Even if some future code (a deep link/store) puts a value into exifFilter.places, the
  // "place-assets page only filters by years/cameras" behavior must prove itself at the data
  // layer — the grid's results must not shrink just because places has a value. This traces back
  // to `PhotosPlaceAssets.vue`'s gridMonths: once it's changed to the explicit projection
  // `{ years: exifFilter.value.years, cameras: exifFilter.value.cameras }`, `applyExifFilters`
  // can no longer even read the places key, so it can never take effect even if it's populated.
  it("exifFilter.places has no effect even when populated (proven at the data layer, not just by the UI not rendering a places chip)", async () => {
    const { w } = await mountPlaceAssets()
    // Feeds in a value that matches neither of the two fixture assets' place ('Tokyo') — if
    // places were read and took effect, the result would be filtered down to 0; if places is
    // correctly ignored (self-proven at the data layer), the result is unaffected, still the
    // pre-filter 2.
    await w.findComponent(PhotosFilterBar).vm.$emit(
      'update:filter', { years: [], places: ['某个不存在的地名'], cameras: [] })
    await w.vm.$nextTick()
    const months = w.findComponent(PhotosGrid).props('months') as Array<{ photos: unknown[] }>
    expect(months.flatMap((m) => m.photos)).toHaveLength(2) // If places took effect, this would be 0.
  })

  it('after filtering, the grid only gets matching photos (the empty-month gate is vacuously true here — see below), and the lightbox paging set shrinks too', async () => {
    // The original test title promised "empty months get dropped", but that's a vacuously true
    // assertion — groupPhotosByMonth (util/groupPhotosByMonth.ts:15-23) only creates a bucket
    // when it encounters a photo and never produces an empty one, and this page filters before
    // grouping, so the `.filter(m => m.photos.length > 0)` in PhotosPlaceAssets.vue can never
    // structurally remove anything on this call path — deleting that `.filter` wouldn't turn this
    // test red either. The title has been reworded so it no longer promises something it doesn't
    // actually verify; the `months.every(...)` line below is kept anyway (it verifies that "the
    // matched months genuinely have photos", not the unsupported claim that "empty months get
    // dropped").
    const { w } = await mountPlaceAssets()
    await w.findComponent(PhotosFilterBar).vm.$emit(
      'update:filter', { years: ['2023'], places: [], cameras: [] })
    await w.vm.$nextTick()
    const months = w.findComponent(PhotosGrid).props('months') as Array<{ photos: unknown[] }>
    expect(months.every((m) => m.photos.length > 0)).toBe(true)
    // Fixture is deliberate: 2023 only matches p1 (p2 is 2020).
    expect(months.flatMap((m) => m.photos)).toHaveLength(1)

    // The lightbox's paging set must shrink along with the filter — it must not stay the
    // "pre-filter" whole-page photos — once p2 (2020) is filtered out, the paging set shouldn't
    // still be able to page to it. The existing "emit open → list is the whole-page photos" test
    // is a zero-filter scenario where both assets land in the same month/bucket, so
    // assets.photos.value and gridMonths.flatMap happen to be equal and same-ordered in that
    // scenario — it's insensitive to this change and can't be relied on as existing coverage, so
    // a direct assertion after a filter is applied is added here.
    // Mutation testing (performed by hand and reverted): temporarily reverting onOpen's
    // `gridMonths.value.flatMap(...)` in PhotosPlaceAssets.vue back to `assets.photos.value` →
    // turns the assertion below from `['p1']` red to `['p1', 'p2']` (the paging set picked up the
    // filtered-out p2) → reverted.
    await w.find('.tile').trigger('click')
    await flushPromises()
    expect(lb.list.value.map((p) => p.id)).toEqual(['p1'])
  })

  // What this locks down is **which gate branch fires** — when filtering down to zero, the code
  // takes the v-else path below (PhotosGrid renders its own empty grid), not the
  // `place-assets-empty` branch. But the empty-state copy rendered by both paths is word-for-word
  // identical (both use photosNoPhotos / photosNoPhotosHint, the same two keys PhotosGrid's own
  // empty state uses), so what the user sees doesn't differ depending on which branch fires — the
  // original title's "doesn't fall into that empty state" implied "the user sees something
  // different", which doesn't hold, so it's been reworded. This assertion is still worth keeping:
  // it pins down the logical invariant that the three-state gate's empty-state determination must
  // read unfiltered data, and must not mistake a place for having no assets just because the
  // filtered result is empty — even though that distinction is invisible to the user.
  it("filtering down to zero takes the three-state gate's v-else branch (not place-assets-empty); breadcrumb count still shows the place total", async () => {
    const { w } = await mountPlaceAssets()
    await w.findComponent(PhotosFilterBar).vm.$emit(
      'update:filter', { years: ['1999'], places: [], cameras: [] })
    await w.vm.$nextTick()
    expect(w.find('[data-test="place-assets-empty"]').exists()).toBe(false)
    // The original `.toContain('2')` was too loose — the fixture's rawPlace() defaults to
    // count:42 (this file, line 66); if the count were mistakenly changed to read
    // store.detail.count, it would render "42 张照片" (42 photos), and toContain('2') would still
    // pass (because "42" contains "2"). Changed to an exact full-string match to pin down the
    // contract: the count must read the place's asset-array length (2), not the detail's own
    // count field.
    expect(w.get('[data-test="place-crumb-count"]').text()).toBe('2 张照片')
  })
})
