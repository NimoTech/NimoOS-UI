// SP7-P8a-T7/T8: Deep links ?asset / ?photoset / ?q / ?album / ?person —
// Source: the Vue 2 panel's src/views/Photos/PhotosTimeline.vue:364-377 (dispatch in mounted),
// :431-440 (_openAssetFromQuery), :441-465 (_openPhotoSetFromQuery), :491-494 (?q,
// within _applyUrlDeepLinks), :509-523 (?person, _applyPersonFromQuery).
// ?album source in Vue2 is not in this file — it is read by PhotosAlbumsView.vue:264 in its
// own mounted() (in same-page panel-switching architecture, only the album-list view cares
// about this key). New-UI consolidates into this composable: all three keys are "entry
// normalization from /photos?xxx= compatibility URL to actual route", not "same-page local
// state switching".
//
// Scope inventory (final review Important 2; source-verified Vue2 :364-374 dispatch in mounted
// + :475-507 complete key set in _applyUrlDeepLinks + each sub-view's mounted()):
//   Vue2's complete /photos query keys = photoset, asset, active (:368-374, dispatched in
//   mounted) + view, tab, settings, q, place, spot, person, photo (:475-507, in
//   _applyUrlDeepLinks) + album (PhotosAlbumsView.vue:264, read in its own mounted())
//   + smartview (PhotosSmartViewsView.vue:340, read in smart-views page's own mounted()).
//   P8a implements: asset / photoset / active / q / album / person — 6 keys.
//   **P8b additions (Vue2 has been retired; legacy bookmarks can only land here)**:
//     - view — six Vue2 NAV_KEYS values, each normalized to one of New-UI's six real routes
//       (VIEW_ROUTES).
//     - tab — the only key needing host page cooperation, goes via
//       PhotosDeepLinkHooks.setTab.
//     - settings — normalized to dedicated settings route `/photos/settings?section=`
//       ('1' = no section specified).
//     - photo — lowest priority in lightbox chain (photoset > asset > photo);
//       semantics are **state restoration** (not found: silently clear key, no toast,
//       intentionally different from ?asset's share semantics).
//     - smartview — wait until fetchSmartViews ready, validate existence, jump to
//       /photos/smart-views/:id.
//     - place, spot — verify city name via getPlace, then jump to /photos/places/:key
//       (?spot appended to query); spot not found downgrades to full city, city fetch
//       fails clears both keys.
//   **Intentionally not implemented: none. All 13 query keys from Vue2's /photos have
//   landing points in this file.**
//   (Gate check: __tests__/deepLinkCoverage.test.ts — key inventory + bidirectional
//   verification with watch array. If Vue2 adds keys later, that gate will fail; if New-UI
//   misses watch entries, it will also fail.)
//
// Mount convention (real-device acceptance feedback correction, 2026-08-04 — original
// decision "no watcher" is now revoked; reason below):
// usePhotosDeepLinks() called once in /photos's setup, supporting **two arrival paths**:
//   ① Fresh mount (bookmark / open new tab at `/photos?xxx=`) — onMounted fires once.
//   ② Already on /photos, then manually edit address bar query (or future internal link
//      changing only deep-link params) — vue-router 4 only query change on same route
//      **does not remount**; onMounted alone cannot reach this case, must add a watch
//      without immediate flag.
// Real device acceptance testing: directly edit address bar to change
// `#/photos?q=...`/`?asset=...`/`?person=...` on timeline — all five cases show no
// response — root cause is exactly ① only onMounted, missing ②.
//
// Both paths share the same applyDeepLinkChanges(query, previous)/dispatchQueryChange(query)
// predicate (precedent from Task 5 scrollToSection/isSectionId: same function, not two
// separate logic paths drifting independently). previous is null means "nothing processed
// before" (at mount time), treat all five keys as "newly arrived"; when previous has value,
// compare string values per key, handle only **keys whose values actually changed**.
//
// 🔴 This "per-key comparison, not full rerun" is the key to enabling watcher, and also
// the original reason for "prohibit watcher" itself: ?photoset is one-time handoff, after
// consuming once the localStorage key is gone. If watcher indiscriminately reruns the full
// five-key dispatch on "any query change", then even if user only edits unrelated `?q`,
// the already-consumed photoset branch reruns, finds handoff "missing", misjudges to
// downgrade path, reopens lightbox at `active` — when user just wanted to change search
// term. Similarly: when `?asset` value hasn't changed, any other query key change should
// not retrigger `openAssetFromQuery` once (lightbox should neither need nor be reopened
// due to unrelated changes). Using "whether this key's own value changed" as threshold
// naturally avoids both false-triggers — not via additional "process once" flags.
//
// Deleting a key (value becomes undefined) is no-op under this predicate:
// firstQueryValue(undefined) normalizes to '', each branch's `if (id) ...` naturally
// short-circuits, neither toasts nor closes lightbox nor rewrites any route.
//
// Execution order (deviates from original spec, corrected per law, not copied verbatim —
// source verification at :364-377): In Vue2 mounted(), _openPhotoSetFromQuery(...)/
// _openAssetFromQuery(...) are **non-awaited** calls (fire-and-forget async), immediately
// followed by sync call _applyUrlDeepLinks(). That is, Vue2's actual timing is "call order"
// lightbox-then-route, but "completion order" is actually uncontrolled — q/place/person
// (route-rewrite leg) completes first, lightbox's fetchAssetDetail still in flight,
// settling later; this is a race Vue2 never deliberately promised order for, not a
// "lightbox-first-route-second" design commitment. New-UI here changes to explicit await
// lightbox leg, then run q/album/person; both arrival paths identical; this is deliberate
// serialization, not "copying Vue2 timing" — both legs make observable side effects like
// route change/lightbox open; serialization makes results predictable (who finishes first
// doesn't depend on network order or user address-bar edit speed), better than replicating
// an unpromised, pure-implementation-detail race.
//
// Scope declaration: mixed "lightbox-open-image + navigating-query" combination inputs are
// not this file's supported shape — if `?q` + `?album` + `?person` arrive simultaneously,
// dispatchQueryChange will sequentially trigger three router.replace() calls (q's result
// overwritten by album's replace, person's async result overwrites again), no mutual
// exclusion or queueing. This is a known limitation, not in this period's fix scope
// (deep-link combinations were never a product-design-intended entry shape, Vue2 never
// defined explicit behavior for them either). P8b-added `?view` / `?settings` same
// category: also "change-route" legs, when arriving simultaneously with q/album/person,
// likewise latter overwrites former, no new mutual exclusion. Only exception: `?tab` —
// changes only this page's local state, doesn't navigate, conflicts with nothing.
import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { LocationQuery, LocationQueryValue } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useLightbox } from '../lightbox/useLightbox'
import { usePhotosPeople } from '../stores/people'
import { usePhotosSmartViews } from '../stores/smartViews'
import { useToast } from '../../stores/toast'
import { assetToPhoto, type Photo } from '../util/assetToPhoto'

const PHOTOSET_KEY_PREFIX = 'nimo:photoset:'

// ── P8b ────────────────────────────────────────────────────────────────────
// Vue2 has been retired, so its `/photos` query keys will never be caught by Vue2's own
// components again — each key either lands in this file, or becomes a dead link. So P8a's
// intentionally-postponed keys are all filled in here (key inventory gate at
// __tests__/deepLinkCoverage.test.ts).

// Source-verified against the Vue 2 panel's src/views/Photos/PhotosTimeline.vue:477's NAV_KEYS,
// matched value-by-value to New-UI's real routes. Vue2 is "switch activeNav panel within
// page", New-UI has six separate routes — so what happens here is entry normalization
// (change route), not "switch local state within same page".
// Note: Vue2's NAV_KEYS has no 'upload' — upload view is unreachable dead code on Vue2
// side (spec D21), so no need to reserve a place for it here; values not in table are
// all no-op (per Vue2's includes guard).
const VIEW_ROUTES: Record<string, string> = {
  albums: '/photos/albums',
  people: '/photos/people',
  places: '/photos/places',
  smart: '/photos/smart-views',
  favs: '/photos/favorites',
  trash: '/photos/trash',
}

// Source-verified :478's TAB_KEYS. Intentionally excludes 'photo' — that's the default
// value in Vue2 `data() { tab: 'photo' }`, never appears in URL (Vue2's includes guard
// also doesn't recognize it).
const TAB_KEYS: readonly string[] = ['all', 'video', 'ocr']

/**
 * Seam where host page hands its local state to the dispatcher.
 * Only `?tab` needs it: tab is display filtering within timeline page, not a navigation
 * destination, no corresponding route to jump to. All other keys land via router, need no
 * callback — so this interface intentionally has one member only, not a generic catch-all
 * callback bag (avoid exposing page internals piece-by-piece to the composable).
 */
export interface PhotosDeepLinkHooks {
  setTab?: (tab: string) => void
}

// Toast display duration when details cannot be fetched, per Vue2 :438 / :463
// duration: 3000.
const NOT_FOUND_TOAST_MS = 3000

function firstQueryValue(v: LocationQueryValue | LocationQueryValue[]): string {
  return (Array.isArray(v) ? v[0] : v) || ''
}

export function usePhotosDeepLinks(hooks: PhotosDeepLinkHooks = {}): void {
  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()
  const lb = useLightbox()
  const toast = useToast()

  // Fetch details by id. Failure (network error / 404 / falsy response) all unified as
  // "not found", no distinction by cause — per Vue2 fetchAssetDetail (the Vue 2 panel's
  // src/store/modules/photos.js:611-619): it catches, console.error, returns null;
  // caller treats as falsy.
  async function fetchPhoto(id: string): Promise<Photo | null> {
    try {
      const asset = await service.photos.getAsset(id)
      return asset ? assetToPhoto(asset as unknown as Record<string, unknown>) : null
    } catch (e) {
      console.error('[photos-deeplinks] fetchPhoto', e)
      return null
    }
  }

  function notFoundToast(): void {
    toast.show(t('photosDeepLinkPhotoNotFound'), NOT_FOUND_TOAST_MS)
  }

  // Vue2 :431-440 _openAssetFromQuery — single image becomes a set, prev/next become
  // no-op (unrelated to whether timeline contains that image).
  async function openAssetFromQuery(id: string): Promise<void> {
    const photo = await fetchPhoto(id)
    if (photo) lb.openAt(photo, [photo])
    else notFoundToast()
  }

  // Read one-time handoff payload: { ids: string[] }, key = 'nimo:photoset:' + token.
  // Expiry cleanup not here — 2-minute TTL is producer's responsibility
  // (src/views/AI/Agent/services/openInApp.js:76-85, timestamp parsed from key name),
  // consumer only "removeItem when read", no expiry check; not found (key absent, already
  // consumed, or producer-cleaned) all treated as "no handoff".
  function consumePhotosetHandoff(token: string): string[] {
    const key = PHOTOSET_KEY_PREFIX + token
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return []
      const parsed = JSON.parse(raw) as { ids?: unknown[] }
      // Per Vue2 :447 — removeItem upon successful parse, even if detail fetch later
      // fails (one-time handoff semantics, not "re-sent" if downstream fails).
      localStorage.removeItem(key)
      return (parsed.ids || []).filter(Boolean) as string[]
    } catch {
      // localStorage read / JSON.parse exceptions must be swallowed — private mode /
      // quota exceptions cannot crash the whole page (Vue2 :449's catch {}).
      return []
    }
  }

  // Vue2 :441-465 _openPhotoSetFromQuery.
  async function openPhotoSetFromQuery(token: string, activeId: string): Promise<void> {
    const ids = consumePhotosetHandoff(token)
    if (!ids.length) {
      // Handoff missing (key absent / already consumed) → downgrade to ?asset behavior;
      // if no activeId either, do nothing, silent (no toast).
      if (activeId) await openAssetFromQuery(activeId)
      return
    }
    const active = activeId && ids.includes(activeId) ? activeId : ids[0]
    const photo = await fetchPhoto(active)
    if (photo) {
      // Carousel set carries only lightweight id objects — Photo is a wide interface
      // with 25+ required fields; use assetToPhoto({id}) to fill defaults rather than
      // `as unknown as Photo` cast; lightbox fetches each image's full details on
      // navigation as needed (useLightbox.ts:100-124's hydrateDetail).
      lb.openAt(photo, ids.map((id) => assetToPhoto({ id })))
    } else {
      notFoundToast()
    }
  }

  // Vue2 :491-494 (within _applyUrlDeepLinks): `?q=<term>` is "open search panel +
  // search in place" in Vue2. New-UI has dedicated search route (built in P7a), so
  // normalize to full-page redirect: replace the `/photos` compatibility URL, don't leave
  // in browser history (when user presses back, should exit /photos, not return to
  // pre-normalized same page). Search term passed verbatim — no trim, no transcoding
  // (query object level is raw string, serializing to URL is vue-router's job, should not
  // hand-encode here).
  function redirectSearchFromQuery(term: string): void {
    router.replace({ path: '/photos/search', query: { q: term } })
  }

  // ?view=<one of NAV_KEYS>: normalize to full-page redirect. Use replace not push —
  // same reason as redirectSearchFromQuery: `/photos?view=albums` is a compatibility URL,
  // should not stay in browser history sending user back to a "no-longer-existent
  // intermediate state" on back.
  // Values not in table all no-op, matches Vue2's `if (q.view && NAV_KEYS.includes(q.view))`
  // exactly — not "error on unknown value", not "fall back to default page".
  function redirectViewFromQuery(view: string): void {
    const path = VIEW_ROUTES[view]
    if (path) router.replace(path)
  }

  // ?settings=1|<section>: Vue2 :485-488 — '1' means "open settings panel without
  // specifying section", other values used as-is as section name (`settingsInitialSection
  // = q.settings === '1' ? '' : String(q.settings)`). New-UI's counterpart is dedicated
  // route /photos/settings?section=storage|ai. Section name intentionally not
  // whitelist-validated (passed as-is, matching Vue2): PhotosSettings's internal
  // isSectionId treats unknown values as "don't scroll", validation responsibility is at
  // destination, not at entry-normalization layer.
  function redirectSettingsFromQuery(value: string): void {
    const section = value === '1' ? '' : value
    router.replace(section
      ? { path: '/photos/settings', query: { section } }
      : { path: '/photos/settings' })
  }

  // ?photo=<id>: Vue2 :556-571 _applyPhotoFromQuery — both open single image in lightbox
  // as ?asset, but semantics deliberately different, don't merge: ?asset is **share link**
  // (not found shows toast telling user "this link expired"), ?photo is **state
  // restoration** (not found silently clear key, don't disturb user, it's just writing
  // currently-open image to URL for refresh restore). Vue2's own comment :556-557
  // explicitly marks this distinction.
  async function applyPhotoFromQuery(id: string): Promise<void> {
    const photo = await fetchPhoto(id)
    if (photo) lb.openAt(photo, [photo])
    else stripQueryKey('photo')
  }

  // ?smartview=<id>: Vue2 PhotosSmartViewsView.vue:337-348 _applyRouteSmartView —
  // wait until list ready, validate existence only then open, not found silently clear
  // key. Id comparison uses String() normalization (same region-wide law as ?person:
  // backend id might be number, query value always string, `===` direct compare misses
  // existing items as not found). Vue2 opens detail overlay within page, New-UI has real
  // detail route, so normalize to navigation.
  async function applySmartViewFromQuery(id: string): Promise<void> {
    const store = usePhotosSmartViews()
    try {
      await store.fetchSmartViews()
      const exists = store.smartViews.some((s) => String(s.id) === String(id))
      if (exists) router.replace({ name: 'photos-smart-view-detail', params: { id } })
      else stripQueryKey('smartview')
    } catch (e) {
      // Defensive fallback — fetchSmartViews already swallows network failures internally
      // (console.error, no reject), this catch won't trigger now, keeping for safety if
      // store implementation changes (same pattern as ?person).
      console.error('[photos-deeplinks] fetchSmartViews', e)
      stripQueryKey('smartview')
    }
  }

  // ?place=<key> (+?spot=<spotKey>): Vue2 :527-554 _applyPlaceFromQuery — fetch
  // details first to validate city name, not found clears place+spot keys; spot not found
  // in spots[] downgrades to full-city filter, only drops spot.
  //
  // Deviation from spec (not verbatim copy): After fetching details, Vue2 puts
  // spotName/spotLat/spotLon all into onPlacesOpenSpot, which is its parameter passing in
  // "same-page panel-switch" architecture. New-UI's destination is real route
  // /photos/places/:key, carrying only ?spot; lat/lon optional queries intentionally
  // omitted — PhotosPlaceAssets will loadDetail(key) itself to fetch spot coordinates,
  // those queries are "skip second request" optimization when jumping from map page, not
  // required inputs. Fabricating lat/lon from an old bookmark with only key just adds
  // cache layer, not needed.
  async function applyPlaceFromQuery(placeKey: string, spotKey: string): Promise<void> {
    try {
      const detail = (await service.photos.getPlace(placeKey)) as
        { city?: string; spots?: Array<{ key?: unknown }> } | null
      const city = detail?.city || ''
      // Vue2 :531-534: empty city means "this place doesn't exist", clear both keys,
      // stay in place.
      if (!city) { stripQueryKey('place', 'spot'); return }
      // spot key comparison also uses String() normalization — Place.Key backend is int32
      // (proven in P0).
      const hit = spotKey
        ? (detail?.spots || []).some((s) => String(s?.key) === String(spotKey))
        : false
      router.replace(hit
        ? { name: 'photos-place-assets', params: { key: placeKey }, query: { spot: spotKey } }
        : { name: 'photos-place-assets', params: { key: placeKey } })
    } catch (e) {
      console.error('[photos-deeplinks] getPlace', e)
      stripQueryKey('place', 'spot')
    }
  }

  // ?album=<id>: Vue2 is PhotosAlbumsView.vue:264 letting the album **list** page itself
  // validate + open, no existence check (not found silently clears key, but Vue2 never
  // validates existence — just direct assignment). New-UI has real album-detail route,
  // direct redirect, same no added Vue2-missing validation (port discipline: no unrelated
  // "improvements", no self-added validation).
  //
  // Deviation from spec (corrected per law, not verbatim): Vue2 is "switch local state
  // within page", never went through "put id into URL path" step, so never encoded.
  // New-UI makes it real path redirect; not encoding lets id with `/` (or other path
  // reserved chars) truncate path mid-way, match wrong route or fail — this is a defect
  // to fix, not behavior to preserve. Use named route + params let vue-router encode
  // (encodeParam encodes `/` too, equivalent to encodeURIComponent), better than hand-
  // string-concat then encodeURIComponent — hand-concat needs worry about percent-encode
  // rules matching both ends; params mechanism uses same internal functions for both
  // construction and parsing, no asymmetry in encode/decode.
  function redirectAlbumFromQuery(id: string): void {
    router.replace({ name: 'photos-album-detail', params: { id } })
  }

  // ?person=<id>: Vue2 :509-523 _applyPersonFromQuery — wait until people list ready,
  // validate id exists before switching page, not found (or fetch fails) silently clear
  // person key in query, stay in place, no error, no prompt.
  async function applyPersonFromQuery(id: string): Promise<void> {
    const peopleStore = usePhotosPeople()
    try {
      await peopleStore.fetchPeople()
      // Id comparison uses String() normalization — region-wide law: backend id
      // sometimes is number (prior example: Place.Key is int32), person value in query
      // always string (URL is text), `===` direct compare string vs number never equals,
      // lets existing person be misdetected as "not found" and silently key-stripped.
      const exists = peopleStore.people.some((p) => String(p.id) === String(id))
      if (exists) {
        redirectPersonFromQuery(id)
      } else {
        stripQueryKey('person')
      }
    } catch (e) {
      // Vue2 :521-523's catch. Defensive fallback — usePhotosPeople().fetchPeople()
      // already swallows network failures internally (console.error, no reject), this
      // catch won't trigger now, keeping for safety if store implementation changes
      // (prevents uncaught exception bubbling up crashing whole onMounted chain).
      console.error('[photos-deeplinks] fetchPeople', e)
      stripQueryKey('person')
    }
  }

  function redirectPersonFromQuery(id: string): void {
    router.replace({ name: 'photos-person-detail', params: { id } })
  }

  // Silently strip specified query keys, stay in place — don't touch other keys or
  // clear path (per Vue2's mergeQuery semantics: only touch the stripped keys). Used by
  // person / photo / smartview / place+spot from P8b on; variadic params because ?place
  // failure strips place + spot keys at once in Vue2 (:531 / :552).
  function stripQueryKey(...keys: string[]): void {
    const rest = { ...route.query }
    for (const k of keys) delete rest[k]
    router.replace({ path: route.path, query: rest })
  }

  // Five-key shared dispatch predicate — mount path and query-only path both use this
  // single function, not two separate logic paths drifting independently (Task 5
  // scrollToSection/isSectionId precedent).
  //
  // `previous` is null: "nothing processed before" at mount, all five keys treated as
  // "newly arrived", process what needs processing (equivalent to original onMounted
  // behavior).
  // `previous` has value: query-only path, compare normalized string values per key,
  // handle only **keys whose values actually changed** — this is key to safely enabling
  // watcher (see file-head 🔴 section), not "rerun five paths on any query change".
  async function applyDeepLinkChanges(query: LocationQuery, previous: LocationQuery | null): Promise<void> {
    const photosetToken = firstQueryValue(query.photoset)
    const assetId = firstQueryValue(query.asset)
    const photoId = firstQueryValue(query.photo)
    const photosetChanged = !previous || photosetToken !== firstQueryValue(previous.photoset)
    const assetChanged = !previous || assetId !== firstQueryValue(previous.asset)
    const photoChanged = !previous || photoId !== firstQueryValue(previous.photo)

    // Lightbox first, route second: this section must await complete before q/album/
    // person run (see file-head execution-order section). Priority: photoset over asset
    // (Vue2 :370-374's if / else if — both present runs only photoset, not both);
    // "both present" means "both actually changed this round", not "both have current
    // value" — if only asset changed, photoset value unchanged (still old already-
    // processed value), shouldn't swallow asset change just because photoset still
    // "has value".
    if (photosetChanged && photosetToken) {
      await openPhotoSetFromQuery(photosetToken, firstQueryValue(query.active))
    } else if (assetChanged && assetId) {
      await openAssetFromQuery(assetId)
    } else if (photoChanged && photoId && !photosetToken && !assetId) {
      // ?photo is lowest priority in lightbox chain (Vue2 :504
      // `if (q.photo && !q.photoset && !q.asset)`). Note its deference threshold differs
      // from above two tiers: here asks "do those two keys **currently have value**", not
      // "did they change this round" — per Vue2 verbatim. Means: as long as photoset/
      // asset still on URL, photo never acts, preventing two lightbox opens in one
      // dispatch.
      await applyPhotoFromQuery(photoId)
    }

    // q/album/person: three keys independent, don't interfere, all "change route" not
    // "open lightbox".
    const q = firstQueryValue(query.q)
    const albumId = firstQueryValue(query.album)
    const personId = firstQueryValue(query.person)
    const qChanged = !previous || q !== firstQueryValue(previous.q)
    const albumChanged = !previous || albumId !== firstQueryValue(previous.album)
    const personChanged = !previous || personId !== firstQueryValue(previous.person)

    if (qChanged && q) redirectSearchFromQuery(q)
    if (albumChanged && albumId) redirectAlbumFromQuery(albumId)
    if (personChanged && personId) await applyPersonFromQuery(personId)

    // ── P8b: ?tab / ?view / ?settings ────────────────────────────────────────
    // ?tab lands first (pure local state, no route change), then process ?view/?settings
    // that navigate away.
    // Deviation from spec: Vue2 :479-489 ordering is view → tab → settings, all three
    // act on same page instance, no observable order difference; in New-UI view/settings
    // navigate away, if setTab first then jump, we're modifying state of page being
    // unmounted. Reorder to "local first, then navigate", not copying prose order.
    const tab = firstQueryValue(query.tab)
    const view = firstQueryValue(query.view)
    const settings = firstQueryValue(query.settings)
    const tabChanged = !previous || tab !== firstQueryValue(previous.tab)
    const viewChanged = !previous || view !== firstQueryValue(previous.view)
    const settingsChanged = !previous || settings !== firstQueryValue(previous.settings)

    if (tabChanged && TAB_KEYS.includes(tab)) hooks.setTab?.(tab)
    if (viewChanged && view) redirectViewFromQuery(view)
    if (settingsChanged && settings) redirectSettingsFromQuery(settings)

    // ── P8b: ?smartview / ?place (+?spot) — two legs needing backend/store query to
    // know destination ──────
    // place's change predicate includes spot: spot is place's sub-key, changing only spot
    // (place unchanged) must also re-land once (full-city ↔ specific-spot switch), else
    // query-only path changing spot has no effect.
    const smartViewId = firstQueryValue(query.smartview)
    const placeKey = firstQueryValue(query.place)
    const spotKey = firstQueryValue(query.spot)
    const smartViewChanged = !previous || smartViewId !== firstQueryValue(previous.smartview)
    const placeChanged = !previous
      || placeKey !== firstQueryValue(previous.place)
      || spotKey !== firstQueryValue(previous.spot)

    if (smartViewChanged && smartViewId) await applySmartViewFromQuery(smartViewId)
    if (placeChanged && placeKey) await applyPlaceFromQuery(placeKey, spotKey)
  }

  // previousQuery records snapshot of "last dispatch-processed" query — null before
  // mount (forces all five keys as "newly arrived"), then synced every dispatch
  // (whether from onMounted or watch), ensuring next watch trigger compares "truly last
  // processed state", not stale snapshot.
  let previousQuery: LocationQuery | null = null

  function dispatchQueryChange(query: LocationQuery): void {
    const previous = previousQuery
    previousQuery = query
    void applyDeepLinkChanges(query, previous)
  }

  onMounted(() => {
    dispatchQueryChange(route.query)
  })

  // Query-only path: page already on /photos, some query key changed (manual address-bar
  // edit, or future internal link changing only deep-link params). vue-router 4 query-
  // only change on same route doesn't remount, onMounted alone can't reach this case,
  // add watch without immediate flag (watch defaults to not running once on init, no
  // duplicate with onMounted).
  //
  // Only watch these five keys' individual values (not whole route.query object) — so
  // only when one of them truly changed triggers callback (Vue's watch on multi-source
  // uses Object.is position-by-position comparison, even if route.query swaps to new
  // object reference due to other unrelated keys changing, as long as these five string
  // values unchanged, callback won't trigger at all). Callback internally gives
  // applyDeepLinkChanges for per-key comparison — two threshold layers combined, no
  // accidental trigger from unrelated query changes.
  watch(
    [
      () => route.query.photoset,
      () => route.query.asset,
      () => route.query.q,
      () => route.query.album,
      () => route.query.person,
      // P8b-added keys — omitting from this array means "only recognized on full-page
      // mount", manual address-bar changes have no effect (that's how P8a was caught in
      // real-device acceptance).
      () => route.query.tab,
      () => route.query.view,
      () => route.query.settings,
      () => route.query.photo,
      () => route.query.smartview,
      () => route.query.place,
      // spot is place's sub-key, but still watch separately — changing only spot (place
      // unchanged) is real user action (full-city ↔ specific-spot), missing it means such
      // change has no effect in query-only path.
      () => route.query.spot,
    ],
    () => {
      dispatchQueryChange(route.query)
    },
  )
}
