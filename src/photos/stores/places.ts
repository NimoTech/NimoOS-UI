// Ported from Vue2 NimoOS-UI src/views/Photos/PhotosPlacesView.vue:
//   data()     :70-96    (view/activeId/theme/filter/collapsedRegions state)
//   mounted    :339-357  (two localStorage reads: theme prefs + rail-collapsed)
//   methods    :379-385  (persistTheme write), :386-389 (isRegionCollapsed),
//              :392-399  (toggleRegionFold), :400-418 (loadPlaces),
//              :419-433  (loadDetail), :495-516 (saveSpotName),
//              :522-536  (loadCoverCandidates), :537-560 (setCover/resetCover)
// Photos v1 backend lacks response envelope: listPlaces() is wrapped in {regions, places, stats}
// object; not unpacked inside, we unwrap it here.
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import {
  toPlace,
  type Place, type RegionCount, type PlacesStats,
} from '../util/placesMap'

// New-UI naming convention, intentionally different from Vue2's
// `photos.placesMapTheme` / `photos.placesRailCollapsed` (deviation note): Vue2 and
// New-UI share the same browser localStorage. This period (D5) changed light map
// variant trigger from "album-private mapTheme field" to global `data-theme`
// attribute. Using the same key would let both sides read/write each other's old
// structures, cross-polluting. Independent keys let the two implementations' persistent
// state not interfere.
const LS_THEME = 'nimo_places_map_theme'
const LS_RAIL_COLLAPSED = 'nimo_places_rail_collapsed'

const THEME_ALLOWED = ['default', 'ocean', 'sand', 'mono', 'custom']
const HEX_RE = /^#[0-9a-f]{6}$/i
// Following Vue2 PhotosPlacesView.vue:86-87 default values.
const DEFAULT_DOT_COLOR = '#6E5BFF'
const DEFAULT_GRID_COLOR = '#9C8EFF'

export interface MapThemePrefs {
  mapTheme: string // 'default' | 'ocean' | 'sand' | 'mono' | 'custom'
  customDotColor: string // '#RRGGBB'
  customGridColor: string
}

// Three anonymous object types formerly inlined in PlaceDetail promoted to named
// exports (P6b-T2): four components T3-T6 all use them; single-point definition
// avoids hand-written duplication like PersonPlace in P5-T12.
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

// Following Vue2 mounted :339-348 IIFE pattern: whitelist/regex validation + outer
// try fallback (private mode / SSR / malformed JSON). Per-field independent fallback —
// invalid mapTheme doesn't discard already-valid custom colors, and vice versa.
function readThemePrefs(): MapThemePrefs {
  const def: MapThemePrefs = { mapTheme: 'default', customDotColor: DEFAULT_DOT_COLOR, customGridColor: DEFAULT_GRID_COLOR }
  try {
    const raw = localStorage.getItem(LS_THEME)
    if (!raw) return def
    const t = JSON.parse(raw) as Partial<MapThemePrefs>
    return {
      mapTheme: THEME_ALLOWED.includes(t.mapTheme as string) ? (t.mapTheme as string) : 'default',
      customDotColor: HEX_RE.test(t.customDotColor ?? '') ? (t.customDotColor as string) : DEFAULT_DOT_COLOR,
      customGridColor: HEX_RE.test(t.customGridColor ?? '') ? (t.customGridColor as string) : DEFAULT_GRID_COLOR,
    }
  } catch {
    return def
  }
}

// Following Vue2 mounted :349-357. Deviation note 7: `.map(String)` normalization on read —
// invariant requires railCollapsed region ids to match the type in toggleRegionFold/
// isRegionCollapsed comparisons. localStorage is user-alterable external input; we cannot
// trust element types are actually strings.
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
  // resolvePlaceKey same trap: backend albumId is a number; tests require normalizing
  // it to a string for callers (album routes use string ids).
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
  // Review M6: stats has no consumer in P6a — Vue2's only use was to feed topbar, and
  // topbar is explicitly not being built per spec §7c-6. Rail header and .map-stats
  // display filtered stats sourced from filteredPlaces (computed by the container itself:
  // countPhotos/countCountries), not from here. Backend global stats retained for P6b
  // and future consumption — not an omission.
  const stats = ref<PlacesStats>({ ...EMPTY_STATS })
  // Empty-state gate following people.ts peopleLoaded pattern: set to true only on
  // success path, leave false on failure so it can be retried.
  const placesLoaded = ref(false)
  const loading = ref(false)

  const detail = ref<PlaceDetail | null>(null)
  const detailLoading = ref(false)
  // loadDetail seq race guard (deviation note 8), pattern follows usePersonDetail.ts:40-82.
  // Not in state: pure internal counter; views don't need to read it.
  let seq = 0
  // fetchCoverCandidates independent seq guard (deviation note 5), same pattern, same
  // not-in-state. Above seq and this one are two unrelated locks: loadDetail and
  // fetchCoverCandidates are completely independent request flows (former is place detail,
  // latter is cover-picker-dialog candidate list). Sharing one counter would let one side's
  // staleness check bias the other's. Vue2 loadCoverCandidates :522-536 has no guard at all;
  // rapid tab switching / pagination in the dialog lets a late-returning old response
  // overwrite the new result.
  let coverSeq = 0

  const coverCandidates = ref<CoverCandidates>({ ...EMPTY_COVER_CANDIDATES })
  // In-flight short-circuit for three write paths. coverBusy guards both setPlaceCover
  // and resetPlaceCover — both are mutually exclusive writes to the same resource
  // (current place's cover), so sharing one lock is reasonable tightening, not an omission.
  // spotBusy guards setSpotName alone, completely independent from coverBusy — changing
  // a spot name while a cover submit is in flight (or vice versa) should not block each other.
  // Two unrelated resources should not share one lock.
  const coverBusy = ref(false)
  const spotBusy = ref(false)
  // createPlaceAlbum reentry lock, independent from the two above — creating an album
  // and changing cover/spot name are unrelated resources.
  const albumBusy = ref(false)

  const themePrefs = ref<MapThemePrefs>(readThemePrefs())
  const railCollapsed = ref<string[]>(readRailCollapsed())

  // Three write paths reverse-lookup the backend's original key (int32) from id,
  // consolidated in one place following loadDetail's same technique. Falls back to the
  // passed id itself when not found (deep-link scenario, list not yet loaded).
  function resolvePlaceKey(id: string): string | number {
    const hit = places.value.find(p => String(p.id) === String(id))
    return hit ? hit.key : id
  }
  // Review required (Minor): `resolvePlaceKey(id) as string` at call sites is
  // **intentional** type assertion — do not "clean it up" to `String(resolvePlaceKey(id))`.
  // The shared package's `service.photos.getPlace` etc. methods declare `key` as pure
  // `string` in their TS signatures (inconsistent with same-file `getPerson(id: string | number)`,
  // but Service-side forbids changing it). Backend `Place.key` is actually int32, and tests
  // require passing the raw number as-is to backend (`expect(getPlace).toHaveBeenCalledWith(7)`,
  // not `'7'`). `as string` only affects compile-time checks; at runtime it still passes
  // the original number returned by `resolvePlaceKey`. Switching to `String()` would actually
  // convert it to a string at runtime, silently failing that assertion above.

  // Following Vue2 loadPlaces :400-418. **Not doing** Vue2 :412-413's "auto-select places[0]
  // after load" — that is view-layer responsibility (P6b/T11), so unit tests can pin down
  // "which place is selected when entering the page" interaction logic. Store only manages
  // data.
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
      // Deviation note 9: Vue2 :400-418 has no catch (exception goes straight to caller /
      // console; no one in mounted() catches it, so it becomes an uncaught rejection).
      // Here we add catch: log only, retain previous data, placesLoaded doesn't revert
      // (failure leaves it false for retry, not "confirmed zero places").
      console.error('[photos-places] fetchPlaces', e)
    } finally {
      loading.value = false
    }
  }

  // Following Vue2 loadDetail :419-433, adding seq race guard (deviation note 8).
  // Vue2 post-compares with `this.activeId === key`; clicking two cities with late-arriving
  // responses overwrites new details with old — Vue2's key parameter is activeId itself,
  // so this comparison stays true unless there's a third click. Here we use monotonically
  // increasing seq, independent of external state.
  async function loadDetail(id: string | null): Promise<void> {
    if (id == null) {
      seq++ // invalidate any in-flight old request, prevent it from writing detail back to non-null later
      detail.value = null
      // Review required (I1): unconditional reset, cannot rely on in-flight request's finally
      // to do this — seq is already incremented, so the `if (mine === seq)` check in that
      // finally will be false and skipped. Without resetting here, detailLoading stays true
      // permanently (P6b shows loading spinner spinning forever after clearing detail).
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
      if (mine !== seq) return // stale response, discard (catch path — Vue2 :429-432 has no this check)
      console.error('[photos-places] loadDetail', e)
      detail.value = null
    } finally {
      if (mine === seq) detailLoading.value = false
    }
  }

  function clearDetail(): void {
    seq++ // invalidate any in-flight loadDetail, prevent it from writing detail back later
    detail.value = null
    // Review required (I1): same reason as loadDetail(null) branch — seq is incremented,
    // in-flight request's finally has `mine === seq` false, won't reset detailLoading for us,
    // must write unconditionally here.
    detailLoading.value = false
  }

  // Following Vue2 setCover :537-548. On success, optimistically rewrite in two places:
  // detail and the matched item in places' coverAssetId, avoid making another listPlaces
  // just to sync one thumbnail. Failure rethrows (view layer handles toast), not swallowed.
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

  // Following Vue2 resetCover :549-560. Rewrite to empty string in both places, rest same as above.
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

  // Deviation note: Vue2 saveSpotName :495-516 is "change dialog.spot.name locally, then
  // loadDetail to refetch entire detail, then re-find the same spot by key in new detail
  // and point dialog back to it". New-UI leaves "whether to refetch, how to re-anchor
  // dialog focus after refetch" view-interaction decisions to P6b's view layer. Store only
  // does minimal, deterministic local rewrite: change only the name of the key-matched item
  // in detail.spots, don't refetch detail.
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

  // D8: restore default spot name. Deliberately uses two different success-path handling
  // strategies alongside setSpotName — not an omission, but the unique correct approach
  // for each input type:
  //   · setSpotName when renaming: new name is **passed by the caller**, frontend knows it,
  //     local rewrite suffices. Re-fetching detail is just an extra request.
  //   · resetSpotName when restoring default: new name (backend-computed default display name)
  //     is something frontend **cannot compute** — no local data can derive it, only way to
  //     get the new value is refetching detail.
  // If a future developer "unifies" these into one rewrite strategy, either setSpotName
  // does a pointless extra network request, or resetSpotName shows the wrong name (old or empty).
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

  // Create album. Deliberately diverges from this repo's "entry short-circuit silent return"
  // convention: this function **has a return value** (the newly created album object,
  // caller uses it to navigate / show toast). Silent return would let a reentrant caller
  // get undefined, conflating it with "actually succeeded but couldn't get the album".
  // Change to: when busy, directly reject with an Error whose message is fixed at 'albumBusy' —
  // caller (T8) uses this message to distinguish "blocked reentry, don't show error toast"
  // from "real failure, show it", rather than swallowing / faking a result.
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

  // Following Vue2 loadCoverCandidates :522-536. This copies Vue2's "clear on failure",
  // deliberately different from fetchPlaces' "retain old data on failure": fetchPlaces is
  // primary data (place list), a network hiccup shouldn't erase data the user is already
  // viewing. This is a one-shot query result inside the cover-picker dialog; the dialog
  // refetches on every open / pagination / search. Keeping the previous search's candidates
  // after failure would mislead the user into thinking the query succeeded. This is not
  // inconsistent omission — two correct strategies due to different data lifespans.
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
      if (mine !== coverSeq) return // stale response, discard (catch path — Vue2 :522-536 has no this check)
      console.error('[photos-places] fetchCoverCandidates', e)
      coverCandidates.value = { ...EMPTY_COVER_CANDIDATES }
    }
  }

  function persistTheme(): void {
    try { localStorage.setItem(LS_THEME, JSON.stringify(themePrefs.value)) } catch { /* ignore write failure */ }
  }
  function setMapTheme(theme: string): void {
    themePrefs.value = { ...themePrefs.value, mapTheme: theme }
    persistTheme()
  }
  // Following Vue2 template :940/:944 `@input="mapTheme = 'custom'"`: picking custom
  // colors counts as switching to custom theme.
  function setCustomColors(dotColor: string, gridColor: string): void {
    themePrefs.value = { ...themePrefs.value, mapTheme: 'custom', customDotColor: dotColor, customGridColor: gridColor }
    persistTheme()
  }

  function persistRailCollapsed(): void {
    try { localStorage.setItem(LS_RAIL_COLLAPSED, JSON.stringify(railCollapsed.value)) } catch { /* ignore write failure */ }
  }
  // Following Vue2 toggleRegionFold :392-399. This is the "collapse a continent region" toggle
  // in the album-list sidebar, distinct from map-level continent filtering (toggleRegion, not
  // part of this store).
  function toggleRegionFold(rId: string): void {
    const idx = railCollapsed.value.indexOf(rId)
    railCollapsed.value = idx === -1
      ? [...railCollapsed.value, rId]
      : railCollapsed.value.filter((_, i) => i !== idx)
    persistRailCollapsed()
  }
  // Following Vue2 isRegionCollapsed :386-389: search state overrides collapse — when there's
  // a search query, never collapse, ensuring matched places are never hidden in a collapsed group.
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
    // Intentionally not resetting seq: if a loadDetail request sent before __resetForTest
    // is still in flight, resetting seq back to 0 would make the next loadDetail after reset
    // land on the same mine value, creating an alias collision with the old request that
    // should be discarded (same reason as people.ts __resetForTest). seq only increases, never
    // decreases, naturally guaranteeing any new request's mine value is strictly greater than
    // all previously sent requests.
    coverCandidates.value = { ...EMPTY_COVER_CANDIDATES }
    coverBusy.value = false
    spotBusy.value = false
    albumBusy.value = false
    // Intentionally not resetting coverSeq: reason same as seq comment above — reset would let
    // the next fetchCoverCandidates after reset land on the same mine value, creating alias
    // collision with in-flight old request from before reset.
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
    __resetForTest,
  }
})
