// usePhotosDeepLinks — ?asset / ?photoset / ?q / ?album / ?person deep links.
// Source: the Vue 2 panel's src/views/Photos/PhotosTimeline.vue:364-377/:431-440/:441-465/
// :491-523; ?album is read in PhotosAlbumsView.vue:264 mounted hook itself (New-UI unified into this composable).
//
// Mount pattern follows existing examples in Photos.lightbox.test.ts / PhotosPlaceAssets.test.ts:
// real useLightbox() singleton, real Pinia toast/people store (vi.spyOn), real vue-router (query
// via router.push, not mocking useRoute). service.photos.getAsset/listPersons via
// vi.mock('@nimotech/nimoos-service').
//
// Assertions all land on real shared state of useLightbox() (open/list/index/current etc.
// module-level ref), not spying on openAt itself — calling `useLightbox()` again inside
// `usePhotosDeepLinks()` gets a new return object literal, vi.spyOn(the outer object, 'openAt')
// only replaces that outer object's own properties, won't intercept calls to the internal copy
// that references the same module-level functions (learned the hard way: first version did it
// this way, openAt assertions all missed — changed to assert real state instead, aligned with
// the general principle of testing real behavior, not just mock calls. The same discipline
// applies here: ?album/?person assertions land on vue-router's real parsed route results
// (fullPath/name/params/query), not on string form of mock call parameters — the original skeleton
// gave `router.replace.mock.calls[0][0].path` assertion which only works for "hand-stitched
// string path" implementations; this file uses vue-router named routes + params encoding
// mechanism (see usePhotosDeepLinks.ts comments), under which replace call arguments have no
// `.path` field, skeleton assertion doesn't hit, changed to assert real parsed route state.
//
// Intentional deviations from the step 1 skeleton:
//  1) Pagination assertions use real list.value / expect.objectContaining({id}), not literal
//     `{ id: 'a' }` — implementation per coordinate notes uses assetToPhoto({id}) to populate
//     Photo's 25+ mandatory fields (cannot `as unknown as Photo` cast), result is not bare
//     `{id}` object, skeleton's literal match doesn't hit.
//  2) Not using vi.fn()/spy on lb.openAt to assert call parameters (see reason above), changed
//     to assert real state like open/list/index/current/hasPrev/hasNext.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, type Component } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { usePhotosDeepLinks, type PhotosDeepLinkHooks } from '../usePhotosDeepLinks'
import { useLightbox } from '../../lightbox/useLightbox'
import { useToast } from '../../../stores/toast'

// lb.openAt is a real singleton, internally calls recordView/reconcileFavIds from usePhotosFavorites()
// and getAsset from hydrateDetail for secondary detail fetch — these are not behaviors this file
// tests, but missing mocks would throw uncaught exceptions on the openAt path and pollute test runs
// (same as existing examples in Photos.lightbox.test.ts / PhotosPlaceAssets.test.ts). This also adds
// listPersons — ?person existence validation actually calls usePhotosPeople().fetchPeople().
const svc = vi.hoisted(() => ({
  photos: {
    getAsset: vi.fn(),
    getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
    recordView: vi.fn().mockResolvedValue(undefined),
    listFavoriteIds: vi.fn().mockResolvedValue([]),
    listPersons: vi.fn().mockResolvedValue({ persons: [] }),
    // ?smartview goes through usePhotosSmartViews().fetchSmartViews(); ?place goes through getPlace().
    listSmartViews: vi.fn().mockResolvedValue([]),
    getPlace: vi.fn().mockResolvedValue({ city: '', spots: [] }),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

const lb = useLightbox()

// Host changed to factory — `?tab` is the only key that needs host page cooperation
// (tab is timeline display filtering, not a navigation destination, no corresponding route to
// navigate to), so usePhotosDeepLinks takes a hooks parameter. Factory lets each mount carry its
// own hooks, without relying on module-level mutable state to pass state between tests.
function makeHost(hooks?: PhotosDeepLinkHooks) {
  return defineComponent({
    setup() {
      usePhotosDeepLinks(hooks)
      return () => null
    },
  })
}

// Target route placeholder component — don't reuse Host, avoid mounting an extra
// usePhotosDeepLinks() outside <router-view> (this file never mounts <router-view>, Host is
// mounted directly, but placeholder still uses the simplest null render to reduce noise. Real
// navigation only changes router.currentRoute, won't re-render Host).
const Blank = defineComponent({ render: () => null })

function makeRouter(host: Component): ReturnType<typeof createRouter> {
  const routes: RouteRecordRaw[] = [
    { path: '/photos', name: 'photos', component: host },
    { path: '/photos/search', name: 'photos-search', component: Blank },
    { path: '/photos/albums/:id', name: 'photos-album-detail', component: Blank },
    { path: '/photos/people/:id', name: 'photos-person-detail', component: Blank },
    // Landing destinations for ?view / ?settings / ?smartview / ?place.
    { path: '/photos/albums', name: 'photos-albums', component: Blank },
    { path: '/photos/people', name: 'photos-people', component: Blank },
    { path: '/photos/places', name: 'photos-places', component: Blank },
    { path: '/photos/places/:key', name: 'photos-place-assets', component: Blank },
    { path: '/photos/smart-views', name: 'photos-smart-views', component: Blank },
    { path: '/photos/smart-views/:id', name: 'photos-smart-view-detail', component: Blank },
    { path: '/photos/favorites', name: 'photos-favorites', component: Blank },
    { path: '/photos/trash', name: 'photos-trash', component: Blank },
    { path: '/photos/settings', name: 'photos-settings', component: Blank },
  ]
  return createRouter({ history: createWebHashHistory('/'), routes })
}

// assets: id -> detail response (bare asset shape, resolve immediately when found); any id not
// in the table rejects, simulating real backend 404. opts.getAssetImpl can replace the fetch
// implementation entirely (the execution-order test below needs a manually-resolvable pending
// promise, which doesn't fit into the default "look up by id in table" implementation).
// Return value adds router (older call sites don't destructure the return value, so they're
// unaffected) — some tests need to assert real router.replace calls / router.currentRoute parsed results.
async function mountWithQuery(
  query: Record<string, string>,
  assets: Record<string, { id: string }> = {},
  opts?: { getAssetImpl?: (id: string) => Promise<unknown>; hooks?: PhotosDeepLinkHooks },
) {
  if (opts?.getAssetImpl) {
    svc.photos.getAsset.mockImplementation(opts.getAssetImpl)
  } else {
    svc.photos.getAsset.mockImplementation(async (id: string) => {
      if (id in assets) return assets[id]
      throw new Error(`Asset not found: ${id}`)
    })
  }
  const Host = makeHost(opts?.hooks)
  const router = makeRouter(Host)
  await router.push({ path: '/photos', query })
  await router.isReady()
  // Complete initial navigation first, then attach spy — otherwise this push to "/photos"
  // itself also gets recorded by spy, polluting assertions about "whether composable internally
  // called push/replace".
  vi.spyOn(router, 'replace')
  vi.spyOn(router, 'push')
  const wrapper = mount(Host, { global: { plugins: [router] } })
  return { wrapper, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  svc.photos.getAsset.mockReset()
  svc.photos.recordView.mockClear()
  svc.photos.listFavoriteIds.mockClear()
  svc.photos.listPersons.mockReset()
  svc.photos.listPersons.mockResolvedValue({ persons: [] })
  svc.photos.listSmartViews.mockReset()
  svc.photos.listSmartViews.mockResolvedValue([])
  svc.photos.getPlace.mockReset()
  svc.photos.getPlace.mockResolvedValue({ city: '', spots: [] })
  localStorage.clear()
  lb.__resetForTest()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  lb.__resetForTest()
  vi.restoreAllMocks()
})

describe('usePhotosDeepLinks · ?asset', () => {
  it('Detail found: open lightbox with single photo as set (prev/next are no-op)', async () => {
    await mountWithQuery({ asset: 'a1' }, { a1: { id: 'a1' } })
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.list.value).toHaveLength(1)
    expect(lb.list.value[0].id).toBe('a1')
    expect(lb.current.value?.id).toBe('a1')
    // Single photo as set means prev/next are both no-ops.
    expect(lb.hasPrev.value).toBe(false)
    expect(lb.hasNext.value).toBe(false)
  })

  it('Detail not found: show not-found toast, do not open lightbox', async () => {
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    await mountWithQuery({ asset: 'ghost' }, {})
    await flushPromises()
    expect(lb.open.value).toBe(false)
    expect(showSpy).toHaveBeenCalledWith('未找到该图片', 3000)
  })
})

describe('usePhotosDeepLinks · ?photoset', () => {
  it('Immediately removeItem after reading ids (one-time handoff, consumed before fetching details)', async () => {
    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['a', 'b', 'c'] }))
    await mountWithQuery({ photoset: 'tok', active: 'b' }, { b: { id: 'b' } })
    // Don't flushPromises — removeItem happens in the synchronous part of consumePhotosetHandoff,
    // before the await in fetchPhoto, should execute as soon as mount() returns.
    expect(localStorage.getItem('nimo:photoset:tok')).toBeNull()
  })

  it('Pagination set is lightweight objects of all ids, active shows first', async () => {
    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['a', 'b', 'c'] }))
    await mountWithQuery({ photoset: 'tok', active: 'b' }, { b: { id: 'b' } })
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.list.value.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(lb.index.value).toBe(1) // active='b' shows first = index 1 in list
    expect(lb.current.value?.id).toBe('b')
  })

  it('When active not in ids, use ids[0] (Vue2 :456)', async () => {
    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['x', 'y'] }))
    await mountWithQuery({ photoset: 'tok', active: 'not-in-list' }, { x: { id: 'x' } })
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.current.value?.id).toBe('x')
    expect(lb.index.value).toBe(0)
    expect(svc.photos.getAsset).toHaveBeenCalledWith('x')
  })

  it('Handoff missing: degrade to ?asset behavior (use active, single photo as set)', async () => {
    await mountWithQuery({ photoset: 'gone', active: 'b' }, { b: { id: 'b' } })
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.list.value).toHaveLength(1)
    expect(lb.list.value[0].id).toBe('b')
    expect(lb.hasPrev.value).toBe(false)
    expect(lb.hasNext.value).toBe(false)
  })

  it('Handoff missing and no active: do nothing, no toast', async () => {
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    await mountWithQuery({ photoset: 'gone' }, {})
    await flushPromises()
    expect(lb.open.value).toBe(false)
    expect(showSpy).not.toHaveBeenCalled()
    expect(svc.photos.getAsset).not.toHaveBeenCalled()
  })

  it('localStorage throws: swallow exception, no page crash, degrade as "handoff missing"', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    // If not swallowed (e.g., mutation test ④ deletes try/catch), openPhotoSetFromQuery would
    // directly reject at consumePhotosetHandoff — mount() itself doesn't throw synchronously
    // (throws inside async function body become rejected promises, don't surface here), but the
    // degrade path won't execute, the lightbox state assertions below will miss, turn red.
    await mountWithQuery({ photoset: 'tok', active: 'b' }, { b: { id: 'b' } })
    getItemSpy.mockRestore()
    await flushPromises()
    // Exception swallowed, ids=[] → take "handoff missing" degrade path, open single via active.
    expect(lb.open.value).toBe(true)
    expect(lb.list.value).toHaveLength(1)
    expect(lb.list.value[0].id).toBe('b')
  })

  it('When photoset and asset both present, only take photoset (Vue2 :370-374 if/else if)', async () => {
    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['x'] }))
    await mountWithQuery({ photoset: 'tok', asset: 'a1' }, { x: { id: 'x' }, a1: { id: 'a1' } })
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.list.value.map((p) => p.id)).toEqual(['x'])
    expect(lb.current.value?.id).toBe('x')
    expect(svc.photos.getAsset).not.toHaveBeenCalledWith('a1')
  })

  it('Falsy values in ids filtered out (Vue2 :446 .filter(Boolean))', async () => {
    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['a', '', null, 'b'] }))
    await mountWithQuery({ photoset: 'tok', active: 'b' }, { b: { id: 'b' } })
    await flushPromises()
    expect(lb.list.value.map((p) => p.id)).toEqual(['a', 'b'])
  })
})

// ?q / ?album / ?person. Source: Vue2 PhotosTimeline.vue:491-494 (?q),
// PhotosAlbumsView.vue:264 (?album, read in that view's mounted hook), PhotosTimeline.vue:509-523
// (?person, _applyPersonFromQuery).
//
// All three are "change route" (vs. ?asset/?photoset's "open lightbox, don't change route"),
// unified to router.replace — this is entry normalization, shouldn't leave `/photos?q=`/
// `?album=`/`?person=` compatibility records in browser history (user's back key should exit
// /photos, not return to the same page before normalization).
describe('usePhotosDeepLinks · ?q', () => {
  it('Redirect to /photos/search?q=, use replace not push', async () => {
    const { router } = await mountWithQuery({ q: '猫' }, {})
    await flushPromises()
    expect(router.replace).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/photos/search', query: { q: '猫' } }),
    )
    expect(router.push).not.toHaveBeenCalled()
  })

  it('Preserve search term as-is — including leading/trailing spaces and non-ASCII, no trim no encoding', async () => {
    const term = '  猫 咪  '
    const { router } = await mountWithQuery({ q: term }, {})
    await flushPromises()
    expect(router.replace).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/photos/search', query: { q: term } }),
    )
  })
})

describe('usePhotosDeepLinks · ?album', () => {
  it('Navigate to album detail route', async () => {
    const { router } = await mountWithQuery({ album: 'al1' }, {})
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('photos-album-detail')
    expect(router.currentRoute.value.params.id).toBe('al1')
    expect(router.push).not.toHaveBeenCalled()
  })

  // Vue2 PhotosAlbumsView.vue:264 _applyRouteAlbum doesn't URL-encode id, just assigns directly
  // to component local state (never went through "build path" step, same-page panel switch needs
  // no encoding). After New-UI converts to real route navigation, lack of encoding lets ids with
  // `/` truncate the path into segments, match completely different routes or fail — this is
  // porting discipline's "don't copy Vue2 bugs": fixed to proper encoding, logged this deviation
  // in implementation file. Use named route + params to let vue-router encode itself (encodeParam
  // encodes `/` too, equivalent to encodeURIComponent), not hand-stitched strings + encodeURIComponent.
  it('When id contains /, URL-encode it, don\'t truncate path (Vue2 unencoded is a bug, fixed)', async () => {
    const { router } = await mountWithQuery({ album: 'a/b' }, {})
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('photos-album-detail')
    // After named route navigation, vue-router auto-decodes the encoded path segment back to
    // original, params.id should be the raw unencoded string — proves "jumped to right place",
    // not "jumped to a coincidentally similar bad address".
    expect(router.currentRoute.value.params.id).toBe('a/b')
    // fullPath is the real serialized URL, must see the encoded slash (%2F), otherwise the
    // path is hand-stitched unencoded string, backend/route matching level actually truncated.
    expect(router.currentRoute.value.fullPath).toContain(encodeURIComponent('a/b'))
  })
})

describe('usePhotosDeepLinks · ?person', () => {
  it('Exists: navigate to detail route after validation passes', async () => {
    svc.photos.listPersons.mockResolvedValueOnce({ persons: [{ id: 'p1' }] })
    const { router } = await mountWithQuery({ person: 'p1' }, {})
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('photos-person-detail')
    expect(router.currentRoute.value.params.id).toBe('p1')
    expect(router.push).not.toHaveBeenCalled()
  })

  it('Does not exist: silently remove person key, stay in place, no detail nav, no toast (other query keys kept)', async () => {
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    svc.photos.listPersons.mockResolvedValueOnce({ persons: [{ id: 'someone-else' }] })
    // Sidekick key (proves "only remove person key, don't touch others") changed from view
    // to highlight — ?view was then inert (no handler on New-UI side), now it navigates itself,
    // as sidekick would break this test's "stay in place" assertion. Switched to a truly inert
    // key to preserve original intent.
    const { router } = await mountWithQuery({ person: 'ghost', highlight: 'x' }, {})
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos')
    expect(router.currentRoute.value.query).toEqual({ highlight: 'x' })
    expect(showSpy).not.toHaveBeenCalled()
  })

  // Backend id sometimes is numeric (similar precedent: Place.Key is int32). person value in
  // query is always string (URL is text), direct `===` comparison of string and number always
  // unequal, would misclassify existing person as "non-existent" and silently remove key — this
  // is a cross-area rule, id comparison must normalize with String() first.
  it('ID comparison uses String normalization — recognize numeric id from backend', async () => {
    svc.photos.listPersons.mockResolvedValueOnce({ persons: [{ id: 42 }] })
    const { router } = await mountWithQuery({ person: '42' }, {})
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('photos-person-detail')
    expect(router.currentRoute.value.params.id).toBe('42')
  })

  // usePhotosPeople().fetchPeople() already swallows network failures (internal console.error,
  // doesn't reject) — Vue2 :521-523 catch maps here, failure path and "id not found" under this
  // store implementation take the same branch (people list stays empty → validation can't match).
  // Still test explicitly — if store implementation changes (fetchPeople starts rejecting), this
  // should fail loud immediately.
  it('fetchPeople fails (network error): silently remove key, no detail nav, no exception', async () => {
    svc.photos.listPersons.mockRejectedValueOnce(new Error('network'))
    const { router } = await mountWithQuery({ person: 'x' }, {})
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos')
    expect(router.currentRoute.value.query.person).toBeUndefined()
  })
})

describe('usePhotosDeepLinks · Execution order (lightbox first, route after)', () => {
  // Vue2 :371-377: photoset/asset (open lightbox) executes before _applyUrlDeepLinks (change
  // route). Lightbox path is async (waits fetchAssetDetail), route rewrite path (?q) itself is
  // sync — without explicitly waiting for lightbox to finish before running route rewrite, sync
  // router.replace would get ahead and execute before async fetch completes, reversing the
  // actual order. Use a manually-controllable pending promise to block fetch, prove "route never
  // navigates until fetch completes".
  it('When photoset and q both present: open lightbox first, then navigate route', async () => {
    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['x'] }))
    let resolveAsset!: (v: unknown) => void
    const pending = new Promise((resolve) => { resolveAsset = resolve })
    const { router } = await mountWithQuery(
      { photoset: 'tok', q: '猫' },
      {},
      { getAssetImpl: () => pending as Promise<unknown> },
    )
    await flushPromises()
    // Fetch hasn't resolved: lightbox not open, route shouldn't navigate either. If order
    // reversed (route rewrite runs first), router.replace already called synchronously here,
    // assertion below would fail first.
    expect(lb.open.value).toBe(false)
    expect(router.replace).not.toHaveBeenCalled()

    resolveAsset({ id: 'x' })
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(router.replace).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/photos/search', query: { q: '猫' } }),
    )
  })
})

// Fix: editing query in address bar on
// timeline directly (without reopening tab), original implementation of all five forms had no
// response — vue-router 4 doesn't re-mount for same route component with only query changed,
// onMounted that time can't reach this. Each key below adds a "already stayed at /photos, query
// appears later" test: use same router instance `router.push({ path: '/photos', query })`, don't
// re-mount Host (same technique as PhotosSettings.test.ts's "query becomes ?section=ai when
// already on page" test).
describe('usePhotosDeepLinks · query-only (already at /photos, query appears later)', () => {
  it('?q query-only: watch path applies redirect', async () => {
    const { router } = await mountWithQuery({}, {})
    await flushPromises()
    expect(router.replace).not.toHaveBeenCalled()
    // This push is test simulating the action "user manually edits address bar" itself (from
    // vue-router perspective, address bar edit is a push/replace to same route different query),
    // not asserting composable internally used push — whether composable internally used replace
    // is locked separately by assertion on router.replace below.
    await router.push({ path: '/photos', query: { q: '猫' } })
    await flushPromises()
    expect(router.replace).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/photos/search', query: { q: '猫' } }),
    )
  })

  it('?album query-only: watch path applies route navigation', async () => {
    const { router } = await mountWithQuery({}, {})
    await flushPromises()
    await router.push({ path: '/photos', query: { album: 'al1' } })
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('photos-album-detail')
    expect(router.currentRoute.value.params.id).toBe('al1')
  })

  it('?person query-only: watch path applies validation + navigation', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [{ id: 'p1' }] })
    const { router } = await mountWithQuery({}, {})
    await flushPromises()
    await router.push({ path: '/photos', query: { person: 'p1' } })
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('photos-person-detail')
    expect(router.currentRoute.value.params.id).toBe('p1')
  })

  it('?asset query-only: watch path applies lightbox open', async () => {
    const { router } = await mountWithQuery({}, { a1: { id: 'a1' } })
    await flushPromises()
    expect(lb.open.value).toBe(false)
    await router.push({ path: '/photos', query: { asset: 'a1' } })
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.list.value.map((p) => p.id)).toEqual(['a1'])
  })

  it('?photoset query-only: watch path applies lightbox open (read one-time handoff, consume localStorage)', async () => {
    const { router } = await mountWithQuery({}, { y: { id: 'y' } })
    await flushPromises()
    expect(lb.open.value).toBe(false)
    localStorage.setItem('nimo:photoset:tok2', JSON.stringify({ ids: ['x', 'y'] }))
    await router.push({ path: '/photos', query: { photoset: 'tok2', active: 'y' } })
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.list.value.map((p) => p.id)).toEqual(['x', 'y'])
    expect(lb.current.value?.id).toBe('y')
    expect(localStorage.getItem('nimo:photoset:tok2')).toBeNull()
  })

  // Core test: after consuming one-time handoff, editing a completely
  // unrelated query key (?q) must never make photoset branch misclassify as "missing" and retake
  // degrade path (shrink lightbox content to active single). This is why the original constraint
  // "forbid watcher", now unblocked by "compare key-by-key, only process the one that actually
  // changed" — this test proves it works.
  it('After consuming handoff, edit unrelated ?q: no retrigger degrade, lightbox content unchanged', async () => {
    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['a', 'b', 'c'] }))
    const { router } = await mountWithQuery({ photoset: 'tok', active: 'b' }, { b: { id: 'b' } })
    await flushPromises()
    expect(lb.list.value.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(localStorage.getItem('nimo:photoset:tok')).toBeNull() // Already consumed

    const callsBefore = svc.photos.getAsset.mock.calls.length
    await router.push({ path: '/photos', query: { photoset: 'tok', active: 'b', q: '猫' } })
    await flushPromises()

    // If watcher re-runs all five forms for "any query change", photoset branch would here
    // misclassify as "missing" because handoff already consumed (no longer in localStorage), degrade
    // to open active single only — lightbox content shrinks from three to one, and getAsset called
    // again for 'b'. Use content + call count together to prove it wasn't mistriggered, while
    // proving the actually-changed ?q did process normally.
    expect(lb.list.value.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(svc.photos.getAsset.mock.calls.length).toBe(callsBefore)
    expect(router.replace).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/photos/search', query: { q: '猫' } }),
    )
  })

  // Deleting ?asset from address bar (value becomes undefined) must be no-op —
  // no toast, don't close lightbox, don't re-fetch.
  it('?asset deleted from address bar (undefined) is no-op: no toast, lightbox stays open', async () => {
    const { router } = await mountWithQuery({ asset: 'a1' }, { a1: { id: 'a1' } })
    await flushPromises()
    expect(lb.open.value).toBe(true)
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    const callsBefore = svc.photos.getAsset.mock.calls.length

    await router.push({ path: '/photos', query: {} })
    await flushPromises()

    expect(lb.open.value).toBe(true) // Still the original photo, not closed
    expect(lb.list.value[0]?.id).toBe('a1')
    expect(svc.photos.getAsset.mock.calls.length).toBe(callsBefore)
    expect(showSpy).not.toHaveBeenCalled()
  })

  // ?asset/?photoset don't change route, only open lightbox — component won't
  // unmount because of them, watcher stays alive. Must confirm "second completely unrelated
  // query change" doesn't reopen lightbox on the same asset (fetch shouldn't be re-called).
  it('?asset value unchanged, only another key (?q) changed: lightbox not reopened, getAsset not re-called', async () => {
    const { router } = await mountWithQuery({ asset: 'a1' }, { a1: { id: 'a1' } })
    await flushPromises()
    expect(lb.open.value).toBe(true)
    const callsBefore = svc.photos.getAsset.mock.calls.length

    await router.push({ path: '/photos', query: { asset: 'a1', q: '猫' } })
    await flushPromises()

    expect(svc.photos.getAsset.mock.calls.length).toBe(callsBefore)
    expect(router.replace).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/photos/search', query: { q: '猫' } }),
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Vue2 has been retired, so its `/photos` query keys will never be caught by Vue2's own
// components again — each key must land here,
// else old bookmarks all become dumb. This section covers navigation keys (?view / ?tab /
// ?settings), source: Vue2 PhotosTimeline.vue:475-489.
// ═══════════════════════════════════════════════════════════════════════════
describe('usePhotosDeepLinks · ?view (Vue2 NAV_KEYS normalized to real routes)', () => {
  it('Six Vue2 values each navigate to corresponding route', async () => {
    const cases: Array<[string, string]> = [
      ['albums', '/photos/albums'],
      ['people', '/photos/people'],
      ['places', '/photos/places'],
      ['smart', '/photos/smart-views'],
      ['favs', '/photos/favorites'],
      ['trash', '/photos/trash'],
    ]
    for (const [value, path] of cases) {
      const { router } = await mountWithQuery({ view: value })
      await flushPromises()
      expect(router.currentRoute.value.path, value).toBe(path)
    }
  })

  it('Value not in Vue2 NAV_KEYS (e.g., unreachable upload): do nothing, stay on timeline', async () => {
    const { router } = await mountWithQuery({ view: 'upload' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos')
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('Use replace not push (compatibility URL shouldn\'t stay in history)', async () => {
    const { router } = await mountWithQuery({ view: 'trash' })
    await flushPromises()
    expect(router.replace).toHaveBeenCalledWith('/photos/trash')
    expect(router.push).not.toHaveBeenCalled()
  })
})

describe('usePhotosDeepLinks · ?settings', () => {
  it('?settings=1 enter settings page, no section (Vue2 "1" = no section specified)', async () => {
    const { router } = await mountWithQuery({ settings: '1' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos/settings')
    expect(router.currentRoute.value.query.section).toBeUndefined()
  })

  it('?settings=ai enter settings page with section=ai', async () => {
    const { router } = await mountWithQuery({ settings: 'ai' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos/settings')
    expect(router.currentRoute.value.query.section).toBe('ai')
  })

  it('Section name not whitelist-validated (pass as-is like Vue2, validation responsibility at destination)', async () => {
    const { router } = await mountWithQuery({ settings: 'nonsense' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos/settings')
    expect(router.currentRoute.value.query.section).toBe('nonsense')
  })
})

describe('usePhotosDeepLinks · ?tab (only key needing host page cooperation)', () => {
  it('Vue2 TAB_KEYS three values all call setTab hook', async () => {
    for (const v of ['all', 'video', 'ocr']) {
      const setTab = vi.fn()
      await mountWithQuery({ tab: v }, {}, { hooks: { setTab } })
      await flushPromises()
      expect(setTab, v).toHaveBeenCalledWith(v)
    }
  })

  it('Value not in TAB_KEYS doesn\'t call hook (photo is Vue2 default, never in URL)', async () => {
    const setTab = vi.fn()
    await mountWithQuery({ tab: 'photo' }, {}, { hooks: { setTab } })
    await flushPromises()
    expect(setTab).not.toHaveBeenCalled()
  })

  it('When hooks not passed, ?tab doesn\'t throw (existing call sites usePhotosDeepLinks() without params still valid)', async () => {
    const { router } = await mountWithQuery({ tab: 'video' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos')
  })
})

describe('usePhotosDeepLinks · three-key query-only path', () => {
  it('After staying at /photos, manually changing ?view also applies', async () => {
    const { router } = await mountWithQuery({})
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos')

    await router.push({ path: '/photos', query: { view: 'trash' } })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos/trash')
  })

  it('After staying at /photos, manually changing ?tab also applies', async () => {
    const setTab = vi.fn()
    const { router } = await mountWithQuery({}, {}, { hooks: { setTab } })
    await flushPromises()
    expect(setTab).not.toHaveBeenCalled()

    await router.push({ path: '/photos', query: { tab: 'video' } })
    await flushPromises()
    expect(setTab).toHaveBeenCalledWith('video')
  })

  it('?tab value unchanged, only another key changed: don\'t re-call setTab', async () => {
    const setTab = vi.fn()
    const { router } = await mountWithQuery({ tab: 'video' }, {}, { hooks: { setTab } })
    await flushPromises()
    expect(setTab).toHaveBeenCalledTimes(1)

    await router.push({ path: '/photos', query: { tab: 'video', foo: 'bar' } })
    await flushPromises()
    expect(setTab).toHaveBeenCalledTimes(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Async three keys (?photo / ?smartview / ?place+?spot). All three must ask
// backend/store first to decide where to go, failures all **silent** (remove key, stay in place),
// semantics differ from ?asset's. Source: Vue2 PhotosTimeline.vue:504-506 + :556-571 (photo),
// :527-554 (place/spot), PhotosSmartViewsView.vue:337-348 (smartview).
// ═══════════════════════════════════════════════════════════════════════════
describe('usePhotosDeepLinks · ?photo (state recall, silent semantics)', () => {
  it('Detail found: open lightbox with single photo as set (same as ?asset)', async () => {
    await mountWithQuery({ photo: 'a1' }, { a1: { id: 'a1' } })
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.current.value?.id).toBe('a1')
    expect(lb.list.value).toHaveLength(1)
  })

  it('Detail not found: no toast (different from ?asset semantics), remove key', async () => {
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    const { router } = await mountWithQuery({ photo: 'gone' }, {})
    await flushPromises()
    expect(lb.open.value).toBe(false)
    expect(showSpy).not.toHaveBeenCalled()
    expect(router.currentRoute.value.query.photo).toBeUndefined()
  })

  it('When ?asset also present, defer to asset (Vue2 :504 mutual exclusion gate)', async () => {
    await mountWithQuery({ photo: 'a1', asset: 'a2' }, { a1: { id: 'a1' }, a2: { id: 'a2' } })
    await flushPromises()
    expect(lb.current.value?.id).toBe('a2')
  })

  it('When ?photoset also present, also defer (same mutual exclusion gate)', async () => {
    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['b'] }))
    await mountWithQuery({ photo: 'a1', photoset: 'tok' }, { a1: { id: 'a1' }, b: { id: 'b' } })
    await flushPromises()
    expect(lb.current.value?.id).toBe('b')
  })
})

describe('usePhotosDeepLinks · ?smartview', () => {
  it('Exists: navigate to smart view detail route', async () => {
    svc.photos.listSmartViews.mockResolvedValueOnce([{ id: 7, name: 'x' }])
    const { router } = await mountWithQuery({ smartview: '7' })
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('photos-smart-view-detail')
    expect(router.currentRoute.value.params.id).toBe('7')
  })

  it('Does not exist: silently remove key, stay on timeline', async () => {
    svc.photos.listSmartViews.mockResolvedValueOnce([{ id: 7, name: 'x' }])
    const { router } = await mountWithQuery({ smartview: '999' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos')
    expect(router.currentRoute.value.query.smartview).toBeUndefined()
  })

  // Same cross-area rule as ?person: backend id might be numeric, query value always string.
  it('ID comparison uses String normalization — recognize numeric id from backend', async () => {
    svc.photos.listSmartViews.mockResolvedValueOnce([{ id: 42, name: 'x' }])
    const { router } = await mountWithQuery({ smartview: '42' })
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('photos-smart-view-detail')
  })
})

describe('usePhotosDeepLinks · ?place (+?spot)', () => {
  it('Has city and spot hits: navigate to place detail with spot query', async () => {
    svc.photos.getPlace.mockResolvedValueOnce({ city: '杭州', spots: [{ key: 's1', name: '西湖' }] })
    const { router } = await mountWithQuery({ place: 'p1', spot: 's1' })
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('photos-place-assets')
    expect(router.currentRoute.value.params.key).toBe('p1')
    expect(router.currentRoute.value.query.spot).toBe('s1')
  })

  it('Only ?place: navigate to place detail, no spot (whole city)', async () => {
    svc.photos.getPlace.mockResolvedValueOnce({ city: '杭州', spots: [{ key: 's1' }] })
    const { router } = await mountWithQuery({ place: 'p1' })
    await flushPromises()
    expect(router.currentRoute.value.params.key).toBe('p1')
    expect(router.currentRoute.value.query.spot).toBeUndefined()
  })

  it('?spot not found in detail\'s spots[]: degrade to whole city filter (still enter place, only drop spot)', async () => {
    svc.photos.getPlace.mockResolvedValueOnce({ city: '杭州', spots: [] })
    const { router } = await mountWithQuery({ place: 'p1', spot: 'nope' })
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('photos-place-assets')
    expect(router.currentRoute.value.params.key).toBe('p1')
    expect(router.currentRoute.value.query.spot).toBeUndefined()
  })

  it('Can\'t fetch city: silently remove both place and spot keys, stay on timeline', async () => {
    svc.photos.getPlace.mockResolvedValueOnce({ city: '', spots: [] })
    const { router } = await mountWithQuery({ place: 'p1', spot: 's1' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos')
    expect(router.currentRoute.value.query.place).toBeUndefined()
    expect(router.currentRoute.value.query.spot).toBeUndefined()
  })

  it('Request throws: same silent removal of both keys (Vue2 :551-553 catch)', async () => {
    svc.photos.getPlace.mockRejectedValueOnce(new Error('boom'))
    const { router } = await mountWithQuery({ place: 'p1', spot: 's1' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos')
    expect(router.currentRoute.value.query.place).toBeUndefined()
  })

  it('Spot key comparison uses String normalization (Place.Key backend is int32)', async () => {
    svc.photos.getPlace.mockResolvedValueOnce({ city: '杭州', spots: [{ key: 12 }] })
    const { router } = await mountWithQuery({ place: 'p1', spot: '12' })
    await flushPromises()
    expect(router.currentRoute.value.query.spot).toBe('12')
  })
})

describe('usePhotosDeepLinks · Async three-key query-only path', () => {
  it('After staying at /photos, manually changing ?smartview also applies', async () => {
    svc.photos.listSmartViews.mockResolvedValue([{ id: 7 }])
    const { router } = await mountWithQuery({})
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos')

    await router.push({ path: '/photos', query: { smartview: '7' } })
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('photos-smart-view-detail')
  })

  it('After staying at /photos, manually changing ?photo also applies', async () => {
    const { router } = await mountWithQuery({}, { a1: { id: 'a1' } })
    await flushPromises()
    expect(lb.open.value).toBe(false)

    await router.push({ path: '/photos', query: { photo: 'a1' } })
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.current.value?.id).toBe('a1')
  })

  it('Even changing only ?spot (place unchanged) lands again — spot is place\'s dependent key', async () => {
    svc.photos.getPlace.mockResolvedValue({ city: '杭州', spots: [{ key: 's1' }, { key: 's2' }] })
    const { router } = await mountWithQuery({ place: 'p1', spot: 's1' })
    await flushPromises()
    expect(router.currentRoute.value.query.spot).toBe('s1')

    await router.push({ path: '/photos', query: { place: 'p1', spot: 's2' } })
    await flushPromises()
    expect(router.currentRoute.value.query.spot).toBe('s2')
  })
})
