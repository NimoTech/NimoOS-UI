// Ported from the Vue 2 panel's src/views/Photos/PhotosPlacesView.vue:
//   data()     :70-96    (view/activeId/theme/filter/collapsedRegions state)
//   mounted    :339-357  (two localStorage reads: theme prefs + rail-collapsed)
//   methods    :379-385  (persistTheme write), :386-389 (isRegionCollapsed),
//              :392-399  (toggleRegionFold), :400-418 (loadPlaces),
//              :419-433  (loadDetail), :495-516 (saveSpotName),
//              :522-536  (loadCoverCandidates), :537-560 (setCover/resetCover)
// Photos v1 backend has no envelope: listPlaces() is a {regions, places, stats} object wrapper, not unwrapped inside; unwrapped here.
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import {
  toPlace,
  type Place, type RegionCount, type PlacesStats,
} from '../util/placesMap'

// New-UI naming convention, deliberately not reusing Vue2's `photos.placesMapTheme` /
// `photos.placesRailCollapsed`
// (a logged deviation): Vue2 and New-UI share the same origin's browser localStorage. This comment
// used to explain the need for this separate key via a note about changing the trigger signal to
// the global data-theme — that decision has since been reverted (see placesMapThemes.ts's own
// header comment and usePhotosTheme.ts), but the separate key itself stays: even
// though New-UI's MapThemePrefs shape (the customCityColor field name, the custom branch's
// bg/grid-follow semantics) and Vue2's current customCityColor structure happen to be
// name-for-name/shape-for-shape identical, it's safer for the two persistence layers to stay
// independent rather than share one localStorage key — sharing it would mean any future
// structural change on either side directly corrupts the other's data, and vice versa.
const LS_THEME = 'nimo_places_map_theme'
const LS_RAIL_COLLAPSED = 'nimo_places_rail_collapsed'

const THEME_ALLOWED = ['default', 'ocean', 'sand', 'mono', 'custom']
const HEX_RE = /^#[0-9a-f]{6}$/i
// Matches Vue2 PhotosPlacesView.vue:86-87's default value.
const DEFAULT_DOT_COLOR = '#6E5BFF'
// Renamed from DEFAULT_GRID_COLOR — same reason as Vue2 PR #106
// sub-commit 3 renaming its own `customGridColor` to `customCityColor` (this value now feeds the
// solid "city light" colour, not a grid line): no migration for the old field name's localStorage
// value — reading an old-shape record simply finds this field already missing and falls straight
// back to this default, matching Vue2's own handling (per that sub-commit's own commit message).
const DEFAULT_CITY_COLOR = '#9C8EFF'

export interface MapThemePrefs {
  mapTheme: string // 'default' | 'ocean' | 'sand' | 'mono' | 'custom'
  customDotColor: string // '#RRGGBB'
  customCityColor: string
}

// Three anonymous object types that used to be inlined in PlaceDetail are promoted to named
// exports: four components' props all need them, a single definition avoids the kind of
// two-places-handwritten duplication PersonPlace had elsewhere.
export interface PlaceSpot { key: string, name: string, lon: number, lat: number, count: number, thumb: string }
export interface PlaceInsight { ico: string, key: string, params: Record<string, unknown> }
export interface PlaceVisit {
  when: string, from: string, to: string, current: boolean
  days: number, photos: number, faces: string[], spots: number, thumbs: string[]
}
export interface CreatedAlbum { albumId: string, name: string, count: number }

export interface PlaceDetail {
  id: string
  city: string
  country: string
  count: number
  trips: number
  home: boolean
  coverAssetId: string
  thumbs: string[]
  spots: PlaceSpot[]
  insights: PlaceInsight[]
  visits: PlaceVisit[]
  recent: string[]
}

export interface CoverCandidates {
  tabs: Array<{ id: string, label: string, icon: string, count: number }>
  items: string[]
  page: number
  totalPages: number
  total: number
}

const EMPTY_COVER_CANDIDATES: CoverCandidates = { tabs: [], items: [], page: 0, totalPages: 1, total: 0 }
const EMPTY_STATS: PlacesStats = { cities: 0, countries: 0, photos: 0 }

// Follows Vue2 mounted :339-348's IIFE read approach: whitelist/regex validation + an overall try
// fallback (private mode/SSR/bad JSON). Each field falls back independently — an invalid mapTheme
// doesn't drag down an already-valid custom color, and vice versa.
function readThemePrefs(): MapThemePrefs {
  const def: MapThemePrefs = { mapTheme: 'default', customDotColor: DEFAULT_DOT_COLOR, customCityColor: DEFAULT_CITY_COLOR }
  try {
    const raw = localStorage.getItem(LS_THEME)
    if (!raw) return def
    const t = JSON.parse(raw) as Partial<MapThemePrefs>
    return {
      mapTheme: THEME_ALLOWED.includes(t.mapTheme as string) ? (t.mapTheme as string) : 'default',
      customDotColor: HEX_RE.test(t.customDotColor ?? '') ? (t.customDotColor as string) : DEFAULT_DOT_COLOR,
      customCityColor: HEX_RE.test(t.customCityColor ?? '') ? (t.customCityColor as string) : DEFAULT_CITY_COLOR,
    }
  } catch {
    return def
  }
}

// Follows Vue2 mounted :349-357. Divergence: normalizes with `.map(String)` on read — the iron
// rule requires the region id in railCollapsed to match the type compared against in
// toggleRegionFold/isRegionCollapsed; localStorage is user-tamperable external input, so its
// element type can't be trusted to already be a string.
function readRailCollapsed(): string[] {
  try {
    const raw = localStorage.getItem(LS_RAIL_COLLAPSED)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) ? arr.map(String) : []
  } catch {
    return []
  }
}

function toPlaceDetail(raw: unknown): PlaceDetail {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    id: String(r.key),
    city: (r.city as string) ?? '',
    country: (r.country as string) ?? '',
    count: (r.count as number) ?? 0,
    trips: (r.trips as number) ?? 0,
    home: Boolean(r.home),
    coverAssetId: (r.coverAssetId as string) ?? '',
    thumbs: (r.thumbs as string[] | null | undefined) ?? [],
    spots: Array.isArray(r.spots) ? (r.spots as PlaceDetail['spots']) : [],
    insights: Array.isArray(r.insights) ? (r.insights as PlaceDetail['insights']) : [],
    visits: Array.isArray(r.visits) ? (r.visits as PlaceDetail['visits']) : [],
    recent: Array.isArray(r.recent) ? (r.recent as string[]) : [],
  }
}

function toCreatedAlbum(raw: unknown, fallbackName: string): CreatedAlbum {
  const r = (raw ?? {}) as Record<string, unknown>
  // Same pitfall as resolvePlaceKey: the backend's albumId is a number, tests require it
  // normalized to a string for the caller (the album route uses string ids).
  return {
    albumId: String(r.albumId ?? ''),
    name: String(r.name ?? fallbackName),
    count: Number(r.count ?? 0),
  }
}

function toCoverCandidates(raw: unknown): CoverCandidates {
  const r = (raw ?? {}) as Partial<CoverCandidates>
  return {
    tabs: Array.isArray(r.tabs) ? (r.tabs as CoverCandidates['tabs']) : [],
    items: Array.isArray(r.items) ? (r.items as string[]) : [],
    page: typeof r.page === 'number' ? r.page : 0,
    totalPages: typeof r.totalPages === 'number' ? r.totalPages : 1,
    total: typeof r.total === 'number' ? r.total : 0,
  }
}

export const usePhotosPlaces = defineStore('photosPlaces', () => {
  const places = ref<Place[]>([])
  const regions = ref<RegionCount[]>([])
  // stats currently has no consumer here — Vue2's only use was to feed the topbar, and per spec
  // the topbar is explicitly not being built; the rail header and .map-stats display filtered
  // statistics sourced from filteredPlaces (the container computes its own countPhotos/
  // countCountries), not from here. The backend's global statistics are kept for later
  // consumption, not an oversight.
  const stats = ref<PlacesStats>({ ...EMPTY_STATS })
  // Empty-state gating, following people.ts's peopleLoaded technique: set to true only on the
  // success path, left false on failure so it can be retried.
  const placesLoaded = ref(false)
  const loading = ref(false)

  const detail = ref<PlaceDetail | null>(null)
  const detailLoading = ref(false)
  // loadDetail's seq race guard (a logged divergence), technique follows usePersonDetail.ts:40-82.
  // Not part of state: a purely internal sequence number the view never needs to read.
  let seq = 0
  // fetchCoverCandidates' own independent seq guard (a logged divergence), same technique, also
  // not part of state. This is an unrelated lock from the seq above: loadDetail and
  // fetchCoverCandidates are two completely independent request streams (the former is place
  // detail, the latter is the candidate list for the cover-picker popup); sharing one counter
  // would let a request on one side skew the other side's "stale" judgment. Vue2's
  // loadCoverCandidates :522-536 has no guard at all for its per-key requests, so quickly
  // switching tabs/pages in the popup lets an old response that arrives after a newer one
  // overwrite the newer result.
  let coverSeq = 0

  const coverCandidates = ref<CoverCandidates>({ ...EMPTY_COVER_CANDIDATES })
  // In-flight short-circuit for three submission paths. coverBusy guards both setPlaceCover/
  // resetPlaceCover -- both are mutually exclusive write operations on the same "current place
  // cover" resource, so sharing one lock is a reasonable tightening, not an oversight;
  // spotBusy independently guards setSpotName, completely separate from coverBusy -- changing the
  // spot name while a cover submission is in flight (or vice versa) shouldn't block on each
  // other, two unrelated resources shouldn't share one lock.
  const coverBusy = ref(false)
  const spotBusy = ref(false)
  // createPlaceAlbum's own re-entry lock, independent of the two above -- creating an album and
  // renaming a cover/spot are unrelated resources.
  const albumBusy = ref(false)

  const themePrefs = ref<MapThemePrefs>(readThemePrefs())
  const railCollapsed = ref<string[]>(readRailCollapsed())

  // The three submission paths look up the backend's original key (int32) by id, following the
  // same technique loadDetail uses, consolidated into one place. When not found (a deep-link
  // scenario where the list hasn't loaded yet), falls back to the id itself as passed in.
  function resolvePlaceKey(id: string): string | number {
    const hit = places.value.find(p => String(p.id) === String(id))
    return hit ? hit.key : id
  }
  // Important: the `resolvePlaceKey(id) as string` at the call sites is a **deliberate** type
  // assertion, do NOT "clean it up" into `String(resolvePlaceKey(id))`. The shared package's
  // `service.photos.getPlace` and similar methods have a TS signature that declares `key` as
  // plain `string` (inconsistent with this same file's `getPerson(id: string | number)`, but the
  // Service side is off-limits to change), while the backend's `Place.key` is actually int32, and
  // tests require the raw number to be passed through to the backend unchanged
  // (`expect(getPlace).toHaveBeenCalledWith(7)`, not `'7'`). The `as string` only affects the
  // compile-time check; at runtime it still passes `resolvePlaceKey`'s raw number through;
  // switching to `String()` would actually convert it to a string at runtime, silently breaking
  // that assertion above.

  // Follows Vue2 loadPlaces :400-418. **Does not** do Vue2 :412-413's "auto-select places[0] once
  // loaded" -- that's the view layer's responsibility, so a view-layer unit test can pin down the
  // "which place gets selected on page entry" interaction logic; the store only handles data.
  async function fetchPlaces(): Promise<void> {
    loading.value = true
    try {
      const raw = (await service.photos.listPlaces()) as
        { regions?: unknown, places?: unknown, stats?: unknown } | undefined
      const list = Array.isArray(raw?.places) ? (raw?.places as Record<string, unknown>[]) : []
      places.value = list.map(toPlace)
      regions.value = Array.isArray(raw?.regions) ? (raw?.regions as RegionCount[]) : []
      stats.value = (raw?.stats as PlacesStats | undefined) ?? { ...EMPTY_STATS }
      placesLoaded.value = true
    } catch (e) {
      // Divergence: Vue2 :400-418 has no catch (the exception throws straight to the
      // caller/console, and with nobody catching it inside mounted() it becomes an unhandled
      // rejection). A catch is added here: only logs, keeps the previous data, and placesLoaded
      // does not regress (a first failure leaves it false so it can be retried, rather than
      // "confirmed zero places").
      console.error('[photos-places] fetchPlaces', e)
    } finally {
      loading.value = false
    }
  }

  // Follows Vue2 loadDetail :419-433, with a seq race guard added (a logged divergence): Vue2
  // compares `this.activeId === key` after the fact, and when clicking two cities quickly with
  // the earlier one resolving later, the earlier stale response would overwrite the newer detail
  // -- because Vue2's key parameter is activeId itself, and as long as there's no third click
  // this comparison is always true. Here a monotonically increasing seq is used instead,
  // independent of external state.
  async function loadDetail(id: string | null): Promise<void> {
    if (id == null) {
      seq++ // Invalidates any in-flight old request, so it can't later write detail back to a non-null value
      detail.value = null
      // Unconditional reset here is necessary, can't rely on the in-flight request's finally to
      // do it -- seq has already advanced, so that finally's `if (mine === seq)` is guaranteed
      // false and skipped; not resetting here would leave detailLoading permanently stuck true
      // (observed as the loading indicator spinning forever after clearing detail).
      detailLoading.value = false
      return
    }
    const mine = ++seq
    detailLoading.value = true
    const key = resolvePlaceKey(id) as string
    try {
      const raw = await service.photos.getPlace(key)
      if (mine !== seq) return // stale response, discard (success path)
      detail.value = toPlaceDetail(raw)
    } catch (e) {
      if (mine !== seq) return // stale response, discard (catch path -- Vue2 :429-432 has no such check)
      console.error('[photos-places] loadDetail', e)
      detail.value = null
    } finally {
      if (mine === seq) detailLoading.value = false
    }
  }

  function clearDetail(): void {
    seq++ // Invalidates any in-flight loadDetail, preventing it from writing detail back later
    detail.value = null
    // Same reasoning as loadDetail(null)'s branch -- seq has already advanced, so the in-flight
    // request's finally's `mine === seq` is guaranteed false and won't reset detailLoading for
    // us; it must be written unconditionally here.
    detailLoading.value = false
  }

  // Follows Vue2 setCover :537-548. On success, optimistically writes back to two places: detail
  // and the matching item's coverAssetId in places, avoiding another listPlaces call just to
  // sync one thumbnail. Rethrows on failure (the view layer handles the toast), doesn't swallow it.
  async function setPlaceCover(id: string, assetId: string | number): Promise<void> {
    if (coverBusy.value) return
    coverBusy.value = true
    try {
      const key = resolvePlaceKey(id) as string
      await service.photos.setPlaceCover(key, assetId)
      if (detail.value) detail.value = { ...detail.value, coverAssetId: String(assetId) }
      const i = places.value.findIndex(p => String(p.id) === String(id))
      if (i !== -1) places.value.splice(i, 1, { ...places.value[i], coverAssetId: String(assetId) })
    } catch (e) {
      console.error('[photos-places] setPlaceCover', e)
      throw e
    } finally {
      coverBusy.value = false
    }
  }

  // Follows Vue2 resetCover :549-560. Both writebacks become an empty string, otherwise same as above.
  async function resetPlaceCover(id: string): Promise<void> {
    if (coverBusy.value) return
    coverBusy.value = true
    try {
      const key = resolvePlaceKey(id) as string
      await service.photos.resetPlaceCover(key)
      if (detail.value) detail.value = { ...detail.value, coverAssetId: '' }
      const i = places.value.findIndex(p => String(p.id) === String(id))
      if (i !== -1) places.value.splice(i, 1, { ...places.value[i], coverAssetId: '' })
    } catch (e) {
      console.error('[photos-places] resetPlaceCover', e)
      throw e
    } finally {
      coverBusy.value = false
    }
  }

  // Divergence: Vue2's saveSpotName :495-516 is "first change dialog.spot.name locally + then
  // refetch the whole detail via loadDetail + then re-point the dialog back to the same spot by
  // key from the new detail". New-UI leaves interaction decisions like "whether to refetch, and
  // how to find the popup's focus back afterward" to the view layer, and the store only does a
  // minimal, deterministic local writeback: only changes the name of the item in detail.spots
  // matching the key, without refetching detail.
  async function setSpotName(id: string, spotKey: string, name: string): Promise<void> {
    if (spotBusy.value) return
    spotBusy.value = true
    try {
      const key = resolvePlaceKey(id) as string
      await service.photos.setSpotName(key, spotKey, name)
      if (detail.value) {
        detail.value = {
          ...detail.value,
          spots: detail.value.spots.map(s => (s.key === spotKey ? { ...s, name } : s)),
        }
      }
    } catch (e) {
      console.error('[photos-places] setSpotName', e)
      throw e
    } finally {
      spotBusy.value = false
    }
  }

  // Restores the default spot name. Deliberately takes a different post-success path from the
  // adjacent setSpotName -- not an oversight, but each input's own uniquely correct approach:
  //   · When setSpotName renames, the new name is **passed in by the caller** -- the frontend
  //     already knows it, so a local writeback suffices; refetching detail again would just be
  //     an extra request.
  //   · When resetSpotName restores the default, the new name (a default display name computed
  //     by the backend) **cannot be computed** by the frontend -- no local data can derive it, so
  //     the only way to get the new value is to request detail again.
  // If someone later "unifies" the two into the same writeback strategy, either setSpotName makes
  // a needless extra network request, or resetSpotName displays the wrong name (stale or empty).
  async function resetSpotName(id: string, spotKey: string): Promise<void> {
    if (spotBusy.value) return
    spotBusy.value = true
    try {
      const key = resolvePlaceKey(id) as string
      await service.photos.resetSpotName(key, spotKey)
      await loadDetail(id)
    } catch (e) {
      console.error('[photos-places] resetSpotName', e)
      throw e
    } finally {
      spotBusy.value = false
    }
  }

  // Creates an album. Deliberately different from this repo's own "silently return on entry
  // short-circuit" convention: this function **has a return value** (the newly created album
  // object, which the caller needs for navigation/toast), and a silent return would give a
  // re-entrant caller undefined, conflating that with "actually succeeded but couldn't get the
  // album". Instead, when busy, it directly rejects with an Error whose message is fixed as
  // 'albumBusy' -- the caller uses this message to distinguish "this was a blocked re-entry,
  // don't pop an error toast" from "this is a real failure, do pop one", rather than swallowing
  // or fabricating a result.
  async function createPlaceAlbum(
    id: string,
    opts: { name: string, from?: string, to?: string },
  ): Promise<CreatedAlbum> {
    if (albumBusy.value) return Promise.reject(new Error('albumBusy'))
    albumBusy.value = true
    try {
      const key = resolvePlaceKey(id) as string
      const raw = await service.photos.createPlaceAlbum(key, {
        name: opts.name,
        from: opts.from ?? '',
        to: opts.to ?? '',
      })
      return toCreatedAlbum(raw, opts.name)
    } catch (e) {
      console.error('[photos-places] createPlaceAlbum', e)
      throw e
    } finally {
      albumBusy.value = false
    }
  }

  // Follows Vue2 loadCoverCandidates :522-536. This copies Vue2's "clear on failure" verbatim,
  // deliberately different from fetchPlaces' own "keep old data on failure" stance: fetchPlaces
  // is the primary data (the places list), and a single network blip shouldn't wipe out data the
  // user is already looking at; this one is a one-off query result inside the cover-picker
  // popup, which re-queries every time it opens/pages/searches, so leaving the previous search's
  // candidates around after a failure would instead mislead the user into thinking the query
  // succeeded. These aren't an inconsistent oversight -- they're two correct strategies arising
  // from different data lifecycles.
  async function fetchCoverCandidates(
    id: string,
    opts: { tab?: string, q?: string, page?: number } = {},
  ): Promise<void> {
    const mine = ++coverSeq
    try {
      const key = resolvePlaceKey(id) as string
      const raw = await service.photos.placeCoverCandidates(key, opts)
      if (mine !== coverSeq) return // stale response, discard (success path)
      coverCandidates.value = toCoverCandidates(raw)
    } catch (e) {
      if (mine !== coverSeq) return // stale response, discard (catch path -- Vue2 :522-536 has no such check)
      console.error('[photos-places] fetchCoverCandidates', e)
      coverCandidates.value = { ...EMPTY_COVER_CANDIDATES }
    }
  }

  // 250ms debounce + flush-on-unmount, ported
  // from the Vue 2 panel's PR #106 perf sub-commit (git show 78cf3335) persistTheme()/
  // writeThemeNow()/beforeDestroy(). localStorage.setItem is synchronous, and dragging the
  // custom-colour picker fires an `input` event (and, before this task, a synchronous
  // setCustomColors() → persistTheme() call) per mouse-move — writing to disk on every one of
  // those stutters the drag. Only the *disk write* is debounced; `themePrefs.value` itself is
  // still assigned synchronously in setMapTheme/setCustomColors below, so every other reactive
  // consumer (PlacesMap's themeVars, PlacesThemeMenu's own selection prop, etc.) sees the new
  // value immediately — only the localStorage.setItem call is coalesced.
  let persistThemeTimer: ReturnType<typeof setTimeout> | null = null
  function writeThemeNow(): void {
    persistThemeTimer = null
    try { localStorage.setItem(LS_THEME, JSON.stringify(themePrefs.value)) } catch { /* ignore write failure */ }
  }
  function persistTheme(): void {
    if (persistThemeTimer !== null) clearTimeout(persistThemeTimer)
    persistThemeTimer = setTimeout(writeThemeNow, 250)
  }
  // Equivalent of Vue2's beforeDestroy (:393-397): flushes the last not-yet-persisted colour pick
  // when the view unmounts — can't rely on the browser staying open until the user reopens the
  // page. The caller is PhotosPlaces.vue's onUnmounted. Also called by __resetForTest itself
  // (below), to keep a leftover timer from an already-reset old store instance from firing later
  // during some other test and writing a themePrefs snapshot that doesn't belong to that test.
  function flushThemePersist(): void {
    if (persistThemeTimer !== null) {
      clearTimeout(persistThemeTimer)
      writeThemeNow()
    }
  }
  function setMapTheme(theme: string): void {
    themePrefs.value = { ...themePrefs.value, mapTheme: theme }
    persistTheme()
  }
  // Follows Vue2 template :940/:944's `@input="mapTheme = 'custom'"`: picking a custom color is
  // treated as switching to the custom theme.
  function setCustomColors(dotColor: string, cityColor: string): void {
    themePrefs.value = { ...themePrefs.value, mapTheme: 'custom', customDotColor: dotColor, customCityColor: cityColor }
    persistTheme()
  }

  function persistRailCollapsed(): void {
    try { localStorage.setItem(LS_RAIL_COLLAPSED, JSON.stringify(railCollapsed.value)) } catch { /* ignore write failure */ }
  }
  // Follows Vue2 toggleRegionFold :392-399. This is the "collapse a continent group" toggle in
  // the album-list sidebar, a different thing from the continent filter on the map (toggleRegion,
  // not part of this store).
  function toggleRegionFold(rId: string): void {
    const idx = railCollapsed.value.indexOf(rId)
    railCollapsed.value = idx === -1
      ? [...railCollapsed.value, rId]
      : railCollapsed.value.filter((_, i) => i !== idx)
    persistRailCollapsed()
  }
  // Follows Vue2 isRegionCollapsed :386-389: search state overrides collapse -- when there's a
  // search term, nothing is collapsed, ensuring a matched place is never hidden inside a
  // collapsed group.
  function isRegionCollapsed(rId: string, searchActive: boolean): boolean {
    if (searchActive) return false
    return railCollapsed.value.includes(rId)
  }

  function __resetForTest(): void {
    places.value = []
    regions.value = []
    stats.value = { ...EMPTY_STATS }
    placesLoaded.value = false
    loading.value = false
    detail.value = null
    detailLoading.value = false
    // Deliberately does not reset seq: if a loadDetail request issued before this
    // __resetForTest is still in flight right now, rewinding seq to 0 would make "the next
    // loadDetail after reset" land on the same mine value again, creating an aliasing collision
    // with that old request that should have been invalidated -- the `mine !== seq` check would
    // be bypassed when the stale response comes back. seq only increases, never decreases, which
    // naturally guarantees any new request's mine value is strictly greater than every request
    // issued before it.
    coverCandidates.value = { ...EMPTY_COVER_CANDIDATES }
    coverBusy.value = false
    spotBusy.value = false
    albumBusy.value = false
    // Deliberately does not reset coverSeq: same reasoning as the seq comment above -- resetting
    // would make the next fetchCoverCandidates after reset land on the same mine value, creating
    // an aliasing collision with an old request still in flight from before the reset.
    // Flush any not-yet-persisted debounced write before resetting — without this, if the
    // previous test/caller just called setMapTheme/setCustomColors and immediately called
    // __resetForTest (without waiting the 250ms), the readThemePrefs() call below would read the
    // stale pre-flush localStorage content rather than "the last value written before the reset"
    // (an invariant places.test.ts's own __resetForTest case pins down). This also keeps the
    // about-to-be-discarded store instance from leaving behind a still-ticking timer.
    flushThemePersist()
    themePrefs.value = readThemePrefs()
    railCollapsed.value = readRailCollapsed()
  }

  return {
    places, regions, stats, placesLoaded, loading,
    detail, detailLoading, coverCandidates, themePrefs, railCollapsed,
    coverBusy, spotBusy, albumBusy,
    fetchPlaces, loadDetail, clearDetail,
    setPlaceCover, resetPlaceCover, setSpotName, resetSpotName, createPlaceAlbum, fetchCoverCandidates,
    setMapTheme, setCustomColors, toggleRegionFold, isRegionCollapsed,
    flushThemePersist,
    __resetForTest,
  }
})
