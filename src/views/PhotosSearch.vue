<script setup lang="ts">
// SP7-P7a-T16: PhotosSearch.vue -- search container wiring (route /photos/search).
// Delivers three items carried over from that phase: (1) the landing spot for T6's "Refine in
// search" button (see PhotosSmartViewDetail.vue); (2) lightbox OCR highlight activation (@open
// passes query as the fourth arg to useLightbox().openAt); (3) D12's host wiring for "save as
// smart view" (.save-smart button + SearchSaveSmartView).
// Read-only reference: Vue2 NimoOS-UI src/views/Photos/PhotosSearchView.vue in full,
// PhotosTopbar.vue, PhotosTimeline.vue:208-215 (searchActive/history), :650-668
// (onSearch + history write).
//
// * Architectural difference (structure spec 7, §7e-3): in Vue2, `query` is a prop handed down
// by the parent component (PhotosTimeline), and what actually triggers smartSearch is
// `onSearch()` (a one-shot dispatch on submit); `query`'s own watcher is only responsible for
// "resetting filter chips + applying the understood prefill". New-UI is a real route, and the
// address bar's `q` is the single source of truth (browser forward/back, editing the address bar
// directly, and refresh must all keep the results consistent) -- so here "triggering
// smartSearch/clear" is folded into the same `watch(query, ..., {immediate:true})` as well.
// This is a deliberate architectural adjustment relative to Vue2, not a missed port.
import '../photos/styles/vue2-parity'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import { useSidebarCollapse } from '../photos/composables/useSidebarCollapse'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosTopbar from '../photos/components/PhotosTopbar.vue'
import PhotosSearchBar from '../photos/components/PhotosSearchBar.vue'
import PhotosFilterChip from '../photos/components/PhotosFilterChip.vue'
import PhotosFilterPopover from '../photos/components/PhotosFilterPopover.vue'
import SearchDatePopover from '../photos/components/SearchDatePopover.vue'
import SearchPeoplePopover from '../photos/components/SearchPeoplePopover.vue'
import SearchSaveSmartView from '../photos/components/SearchSaveSmartView.vue'
import PhotosSearchGrid from '../photos/components/PhotosSearchGrid.vue'
import { usePhotosSearch } from '../photos/stores/search'
import { usePhotosPeople } from '../photos/stores/people'
import { usePhotosAlbums } from '../photos/stores/albums'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { useToast } from '../stores/toast'
import { understood, type PersonOption, type UnderstoodKind, type UnderstoodToken } from '../photos/util/searchUnderstood'
import { queryParts } from '../photos/util/searchQueryParts'
import { sortResults, splitTiers, matchPct, type ScoredPhoto, type SortKey } from '../photos/util/searchSort'
import { dateInRange, quickRange, yearRange, type DateRange } from '../photos/util/dateRange'
import type { Photo } from '../photos/util/assetToPhoto'

const route = useRoute()
const router = useRouter()
// fix wave F2 (final-review-required item): `locale` is back in use again -- the codebase's
// only bare `toLocaleString()` call (`filteredResults.length.toLocaleString()`) wasn't following
// locale, so under a Chinese UI the thousands-separator formatting would drift with the
// browser's own locale. It was deleted in fix round 1 * M14 because it genuinely wasn't used at
// the time, not because it "should never be used again"; this repo's locale tags are
// `zh_cn`/`en_us` (underscore, not valid BCP-47), and passing them raw to toLocaleString throws
// a RangeError, so they must always be converted to hyphenated form (an established convention,
// following existing precedent in SearchPeoplePopover.vue:59-63 / SmartViewCard.vue:38, etc.).
const { t, locale } = useI18n()
const { themeClass } = usePhotosTheme()
// Fix-3 item 7 (owner acceptance, 2026-08-13, Plan F pull-forward): shell migration onto the
// `.app` CSS Grid + PhotosTopbar, matching the six pages already migrated (Photos.vue's Task 3/4,
// PhotosAlbums.vue's Plan C Task 2). `collapsed`/`toggle` is the same shared module-singleton
// composable every migrated page already consumes — this page is not a new instance of the
// collapse state, just another consumer of it.
const { collapsed, toggle: onToggleCollapse } = useSidebarCollapse()
const localeTag = computed(() => locale.value.replace('_', '-'))
const search = usePhotosSearch()
const people = usePhotosPeople()
const albums = usePhotosAlbums()
const lb = useLightbox()
const toast = useToast()

// ── query: read from the route, a read-only computed, never assigned to directly (the
//    falsifiable guard from §7e-3) ───────────────────────────────────────────
const query = computed(() => String(route.query.q ?? ''))

// ── local state (structure spec 9) ──────────────────────────────────────────
interface SearchFilters {
  date: DateRange | null
  people: string[]
  place: string[]
  type: string | null
  album: string | null
}
function emptyFilters(): SearchFilters {
  return { date: null, people: [], place: [], type: null, album: null }
}
function cloneVal<T>(v: T): T {
  if (Array.isArray(v)) return [...v] as unknown as T
  if (v && typeof v === 'object') return { ...(v as object) } as T
  return v
}

const sort = ref<SortKey>('relevance')
const filters = ref<SearchFilters>(emptyFilters())
const draft = ref<SearchFilters>(emptyFilters())
const openPop = ref<string | null>(null)
const moreExpanded = ref(false)
const saveOpen = ref(false)
const saved = ref(false)
// albumAssetIds is no longer a ref written by a watcher -- see the redesign in fix round 1 * I2
// below; it's now a computed that reads live from the albums store (fix round 2 * Minor#3
// correction: it's actually defined in the watcher block for filters.album, not near
// realAlbumItems -- the two are about 230 lines apart).

const filterbarRef = ref<HTMLElement | null>(null)
const saveBtnRef = ref<HTMLElement | null>(null)

// ── search history (structure spec 16, same localStorage key as Vue2) ───────
const HISTORY_KEY = 'nimo_search_history' // Same key as Vue2: shared history between the two during cutover is a good thing.
function readHistory(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw.map(String).slice(0, 6)
  } catch {
    return []
  }
}
const history = ref<string[]>(readHistory())
function writeHistory(q: string): void {
  try {
    const prev = readHistory()
    const next = [q, ...prev.filter((h) => h !== q)].slice(0, 6)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    history.value = next
  } catch {
    // Mirrors Vue2 PhotosTimeline.vue:658's blanket swallow: a write failure doesn't crash and
    // doesn't affect the current search flow.
  }
}

// Submit a term: sync the address bar via a route replace. onSubmit (PhotosSearchBar), the
// recent-search chips in the pre-search state, and the history terms in the hero all share this
// one code path.
//
// fix round 1 * I1 (a real defect confirmed in review, Important): history is **not** written
// here -- it's moved to the main query watcher below (the non-empty branch). See the detailed
// note above that watcher. Only the route navigation is left here.
//
// fix round 1 * M15 (folded in during review, fixed): Vue2's `onSearch()` unconditionally
// dispatches smartSearch on every submit; New-UI is route-driven -- resubmitting the same term
// does a `router.replace` to the **same route** (neither path nor query changes), which
// vue-router treats as no navigation, so the `query` computed never fires, and the main watcher
// never calls smartSearch again. The "resubmit to force a refresh of the results" action would
// silently fail. This adds a shortcut: when the target term exactly matches the current route's
// q, skip the route and call smartSearch again directly (no need to write history -- it's
// already the front of the history queue, so the order doesn't change).
function submitQuery(q: string): void {
  if (q && q === query.value) {
    void search.smartSearch(q)
    return
  }
  void router.replace({ path: '/photos/search', query: q ? { q } : {} })
}

// Fix-3 item 7: PhotosTopbar's `back` button (Vue2 searchMode's chevL, PhotosTopbar.vue:6-8,
// `$emit('exit-search')` → `this.$store.dispatch('photos/clearSearch')`). Vue2 exits back to
// the SAME component (the timeline underneath, still mounted) because search there is a local
// UI state, not a route. New-UI's /photos/search is a real route, so "back" has to mean
// "navigate to the library" — /photos is the concrete destination every entry point into this
// page conceptually returns to (Photos.vue's search box, PhotosSmartViewDetail's "Refine in
// Search" button, a deep link). Not `router.back()`: a deep link or a fresh tab has no prior
// history entry to go back to, and `/photos` is deterministic and testable.
function onBack(): void {
  void router.push('/photos')
}

// ── three data sources (structure spec 11) ───────────────────────────────────
// people.named's filter criteria (p.name && p.name.trim() !== '') matches Vue2's realPeopleList
// `.filter(p => p.name && p.name.trim())` verbatim (checked against the source in E5, see the
// task report), so it's reused directly rather than filtering again here. The sort (descending
// by face count) and the mapping to PersonOption are still done in this file (SearchPeoplePopover's
// people prop relies on the caller having already sorted it; the component itself doesn't sort).
const realPeopleList = computed<PersonOption[]>(() =>
  people.named
    .map((p) => ({
      id: String(p.id),
      name: p.name.trim(),
      count: p.count || 0,
      coverFaceId: p.coverFaceId ? String(p.coverFaceId) : '',
    }))
    .sort((a, b) => b.count - a.count),
)

const realAlbumItems = computed<string[]>(() =>
  albums.albums.map((a) => (typeof a.name === 'string' ? a.name : '')).filter(Boolean),
)

// Mirrors Vue2 :452-465, comment included: tallies frequency of the first segment of the place
// name from the **current search results** (pre-filter), sorted by descending frequency.
const realPlaceItems = computed<string[]>(() => {
  const freq = new Map<string, number>()
  for (const r of results.value) {
    if (!r.p.place) continue
    const city = r.p.place.split(',')[0].trim()
    freq.set(city, (freq.get(city) || 0) + 1)
  }
  return Array.from(freq.keys()).sort((a, b) => (freq.get(b) || 0) - (freq.get(a) || 0))
})

// File type is an intrinsic asset attribute, not backend-driven -- mirrors Vue2's static
// typeItems array.
const TYPE_ITEMS = ['Photos', 'OCR', 'Videos'] as const
// Naively concatenating 'photosSearchType' + v produces 'photosSearchTypeOCR' (uppercase) for
// OCR, which doesn't match the real key name 'photosSearchTypeOcr' in case -- string
// concatenation can't be relied on here, so an explicit lookup table is required (this is a
// concatenation trap confirmed against the source during this task; implementing the brief's
// literal formula as-is would silently fall back to the raw English string for the OCR type,
// which is the same class of defect §7e-13 needs fixed).
const TYPE_LABEL_KEYS: Record<string, string> = {
  Photos: 'photosSearchTypePhotos',
  OCR: 'photosSearchTypeOcr',
  Videos: 'photosSearchTypeVideos',
}
function typeLabel(v: string): string {
  return t(TYPE_LABEL_KEYS[v] ?? v)
}

// ── chip definitions (structure spec 10, order mirrors Vue2 :564-572) ────────
type ChipKey = 'date' | 'people' | 'place' | 'album' | 'type'
const chips = computed(() => [
  { key: 'date' as ChipKey, icon: 'clock', label: t('photosSearchDate') },
  { key: 'people' as ChipKey, icon: 'person', label: t('photosSearchPeople') },
  { key: 'place' as ChipKey, icon: 'map', label: t('photosSearchPlaces') },
  { key: 'album' as ChipKey, icon: 'album', label: t('photosSearchAlbums') },
  { key: 'type' as ChipKey, icon: 'video', label: t('photosSearchFileType') },
])

function chipLabel(chip: { key: ChipKey; label: string }): string {
  const v = filters.value[chip.key]
  if (chip.key === 'date') return (v as DateRange | null)?.label || chip.label
  if (chip.key === 'type') return v ? typeLabel(v as string) : chip.label
  if (Array.isArray(v)) return v.length ? v.join(', ') : chip.label
  return v ? String(v) : chip.label
}
function chipActive(key: ChipKey): boolean {
  const v = filters.value[key]
  return Array.isArray(v) ? v.length > 0 : !!v
}

// ── result derivation (structure spec 12, order mirrors Vue2 :339-404: results ->
//    filteredResults -> sortedResults -> the two tiers, tier split happens after sorting) ────
const results = computed<ScoredPhoto[]>(() => {
  if (!query.value) return []
  // Return empty during the in-flight window (route q already updated, store still has the old
  // term or has never searched) to avoid flashing the previous results.
  if (!search.matchesQuery(query.value)) return []
  return search.results.map((p) => ({ p, score: p.matchScore ?? null }))
})

// In-flight state: there's a query term but the store's results don't belong to it yet. Used to
// suppress the empty-state copy.
const searching = computed(() => !!query.value && !search.matchesQuery(query.value))

const filteredResults = computed<ScoredPhoto[]>(() => {
  let arr = results.value
  const f = filters.value
  if (f.type === 'Photos') arr = arr.filter((r) => !r.p.isVideo && !r.p.hasOcr)
  else if (f.type === 'OCR') arr = arr.filter((r) => r.p.hasOcr)
  else if (f.type === 'Videos') arr = arr.filter((r) => r.p.isVideo)
  if (f.people.length) {
    arr = arr.filter((r) => {
      const faces = Array.isArray(r.p.faces) ? (r.p.faces as unknown[]) : []
      return f.people.some((name) => faces.includes(name))
    })
  }
  // String() fallback: Photo.takenAt's type is string | number | null (real data is always an
  // ISO string; number is just defensive type leniency -- see the matching precedent comment
  // in peopleView.ts:330-337 for the same treatment).
  if (f.date) arr = arr.filter((r) => dateInRange(r.p.takenAt != null ? String(r.p.takenAt) : null, f.date))
  if (f.place.length) arr = arr.filter((r) => f.place.includes((r.p.place || '').split(',')[0].trim()))
  if (f.album && albumAssetIds.value) {
    const ids = albumAssetIds.value
    arr = arr.filter((r) => ids.has(String(r.p.id)))
  }
  return arr
})

const sortedResults = computed(() => sortResults(filteredResults.value, sort.value))
const tiers = computed(() => splitTiers(sortedResults.value, sort.value))
const best = computed(() => tiers.value.best)
const more = computed(() => tiers.value.more)

// Mirrors Vue2 :413-415.
const showSentinel = computed(() => moreExpanded.value && !search.exhausted && more.value.length > 0)

const topScore = computed(() => {
  if (!sortedResults.value.length) return null
  const pct = matchPct(sortedResults.value[0].score)
  return pct != null ? pct + '%' : null
})

// ── hero: query highlighting + "Nimo understood" (structure spec 15) ─────────
const understoodTokens = computed<UnderstoodToken[]>(() => understood(query.value, realPeopleList.value))
const queryPartsComputed = computed(() => queryParts(query.value, understoodTokens.value.map((tk) => tk.v.toLowerCase())))

function understoodKeyFor(k: UnderstoodKind): string {
  if (k === 'person') return 'photosSearchTokPerson'
  if (k === 'type') return 'photosSearchTokType'
  return 'photosSearchTokTime'
}
// Vue2 defect fix #13 (§7e-13): Vue2's `:44` is `<b>{{ t.v }}</b>`, which outputs the raw
// English string directly (e.g. searching 'my videos' displays 'Videos'), so English leaks into
// a Chinese UI. Here the localization mapping is done per token kind: person -> the name as-is;
// type -> t('photosSearchType'+v); time -> if quick is a number (a year) keep it as-is, if it's
// a QuickKey string then v itself is the i18n key, so run it through t().
function understoodValueFor(tok: UnderstoodToken): string {
  if (tok.k === 'person') return tok.v
  if (tok.k === 'type') return typeLabel(tok.v)
  if (typeof tok.quick === 'number') return tok.v
  return t(tok.v)
}

// ── applyUnderstood (structure spec 14, mirrors Vue2 :659-672) ───────────────
function applyUnderstood(): void {
  const u = understoodTokens.value
  if (!u.length) return
  const peopleNames = u.filter((tk) => tk.k === 'person').map((tk) => tk.v)
  const timeTok = u.find((tk) => tk.k === 'time')
  const typeTok = u.find((tk) => tk.k === 'type')
  if (peopleNames.length) {
    filters.value.people = Array.from(new Set([...filters.value.people, ...peopleNames]))
  }
  if (timeTok && !filters.value.date) {
    const now = new Date()
    if (typeof timeTok.quick === 'number') {
      filters.value.date = yearRange(timeTok.quick, timeTok.v)
    } else if (timeTok.quick) {
      filters.value.date = quickRange(timeTok.quick, now, t(timeTok.v))
    }
  }
  if (typeTok && !filters.value.type) {
    filters.value.type = typeTok.v
  }
}

// ── main watcher (structure spec 7+8+21, §7e-3/§7e-14): merges the route-driven search
//    dispatch, history write, chip reset, understood prefill, and saved reset ─────────────
//
// fix round 1 * I1 (a real defect confirmed in review, Important): history writing is moved
// here (the non-empty branch) instead of being called once from each of three entry points
// (Photos.vue's top search box / PhotosSearch.vue's own PhotosSearchBar / T6's "Refine in
// search"). The reason Vue2 only writes history in one place (`PhotosTimeline.vue`'s
// `onSearch()`) is that Vue2 has a single view and all three trigger paths ultimately call the
// same method; New-UI has real routes, so these three call sites live in three separate files
// each doing their own `router.push`. Requiring "write on submit" would mean keeping all three
// permanently in sync -- **writing once, uniformly, after the route lands (in the watcher)
// naturally covers every entry point**, including deep links and refresh, and is more robust
// than manually keeping three call sites in sync.
//
// **Deviation registered (an observable difference from Vue2, must be documented)**: Vue2
// records "on submit" -- history is only written when `onSearch(query)` is actually called.
// Here, New-UI records "on arrival" -- any way that makes `query` become a new non-empty value
// writes history, including: a shared deep link, the browser's forward/back buttons, or editing
// the address bar directly. In other words these actions now also push the term into "recent
// searches" and move it to the front. This is a behavior difference this task deliberately
// accepts (it's actually more sensible for the deep-link case: it means the user did see the
// results of that search), not an oversight.
watch(
  query,
  (q, old) => {
    if (old !== undefined && q !== old) {
      filters.value = emptyFilters()
      moreExpanded.value = false
      saved.value = false // Vue2 defect fix #14 (§7e-14): reset "saved" after the query term changes.
    }
    applyUnderstood()
    if (q) {
      writeHistory(q)
      void search.smartSearch(q)
    } else {
      search.clear()
    }
  },
  { immediate: true },
)

// Re-run the understood prefill once people finish loading asynchronously (mirrors Vue2 :591).
watch(
  () => people.peopleLoaded,
  (loaded) => {
    if (loaded) applyUnderstood()
  },
)

// ── filters.album's album-asset resolution (structure spec 13, E4) ───────────
//
// fix round 1 * I2 (a real defect confirmed in review, Important, redesigned rather than
// patched): the first version made `albumAssetIds` a ref written by
// `fetchAlbumAssets(id).then(...)`, guarded by a homegrown `albumSeq` counter against "an old
// response overwriting a new one" -- but that only guards against **cross-id** races (pick A,
// then quickly switch to B). It doesn't guard against the **same-id re-entrancy** race review
// actually found: `albums.ts:82`'s (fix round 3 * #3 self-check correction: previously
// mis-cited as `:81`, which is actually the function signature `async function
// fetchAlbumAssets`) `if (isLoadingAssets(id)) return` -- calling this again for the same id
// while its request is still in flight **resolves immediately with no data at all**. Full
// repro: select album A -> Apply (request A in flight) -> reopen the popover and cancel A ->
// Apply (`filters.album=null`) -> select A again -> Apply => the second `fetchAlbumAssets` call
// for A hits `isLoadingAssets(A)===true`, short-circuits, and resolves immediately; in
// `.then()`, `mine===albumSeq` holds (it's the most recent legitimate call), but `assetsOf(A)`
// is still empty at that moment -- `albumAssetIds` gets written as an empty Set, **permanently
// zeroing the result**; by the time the first real request lands, no code path ever reads it
// again.
//
// Fix (a structural elimination, not more counters): change `albumAssetIds` from "a snapshot
// written by some promise's resolve" to "a computed that reads live from the `albums` store" --
// every access reads `albums.assetsOf(the currently selected album's id)` directly, which is a
// reactive reference. Regardless of which `fetchAlbumAssets` call (even one whose data got
// swallowed by the short-circuit) writes to `albumAssetsByID`, as long as it writes to the id of
// the "currently selected album", this computed automatically re-evaluates and picks up the
// latest data -- there's no need to check "is this the response to my request", because it
// never depends on any single promise's return value in the first place. The cross-id race
// (select A, its slow response hasn't come back yet, switch to B) is therefore structurally
// immune too: after switching to B, this computed reads `assetsOf(B)`; A's late response only
// writes `albumAssetsByID['A']` and doesn't affect the `assetsOf(B)` being read. The
// `fetchAlbumAssets` call is thus demoted to a standalone watcher that is a **pure trigger side
// effect** and no longer writes any local state.
function findAlbumIdByName(name: string): string | number | null {
  const found = albums.albums.find((a) => (typeof a.name === 'string' ? a.name : '') === name)
  return found ? (found.id as string | number) : null
}
// fix round 2 * Important#1 (a new regression confirmed in review, a real functional defect):
// `albums.assetsOf(id)` returns the same `[]` both when the **cache slot hasn't been created at
// all** (request in flight / not yet issued) and when "the cache slot exists but genuinely is an
// empty array" (the album really has no photos) -- you can't decide "should this filter apply"
// by looking only at `assetsOf(id).length`. At the moment you Apply an album selection, the
// request usually hasn't landed yet; treating "data isn't available yet" as "this album has no
// photos" makes `filteredResults` instantly zero out, and `.empty-search` (the "no matches"
// block with 80px padding) flashes across the whole area during the request's in-flight window
// -- this is the **normal path** for "filtering by album for the first time", not an edge-case
// timing, and no test ever covered it (none of fix round 1's mutation-testing/deletion checklist
// items would turn red for it, because every album test either mocks an immediate resolve or
// explicitly waits for `flushPromises()` before asserting, which naturally skips over the "not
// yet resolved" window).
//
// Fix: distinguish "the cache slot doesn't exist" (`String(id) in albums.albumAssetsByID` is
// false => in flight/not fetched, following Vue2's `PhotosSearchView.vue:593-602` convention --
// **don't filter while in flight**, matching the initial state at the moment of "just selected,
// `albumAssetIds = null`") from "the cache slot has landed and its content just happens to be an
// empty array" (=> genuinely no photos, should precisely narrow to an empty set; don't skip
// filtering just because "it looks the same `[]` as in-flight" -- that would collapse I7's
// "empty album" semantics back into "in flight"). The `in` check only looks at whether the key
// exists (`albums.ts`'s `fetchAlbumAssets` writes this album's slot regardless of success or
// failure -- the success path does `setAlbumAssets(id, ...)` in the `try` body (`albums.ts:87`),
// the failure path does `setAlbumAssets(id, [])` in the `catch` body (`albums.ts:90`); `finally`
// (`:91-93`) is only responsible for resetting `isLoadingAssets` and doesn't touch this slot --
// even when the result is an empty array, the slot only fails to exist when no request has ever
// been issued/completed) -- not "is the length 0", which is exactly the key distinction this fix
// makes: it must use `in` rather than `assetsOf(id).length === 0` to determine "hasn't landed
// yet" (fix round 3 * #2 correction: the previous round mistakenly said "written in finally" --
// the location of the slot write was wrong, though the conclusion -- both success and failure
// write the slot -- was correct, and has now been corrected to match albums.ts's actual code
// location).
//
// fix round 3 * #4 (folded in during review, registering an observable difference from Vue2 that
// was missed -- the earlier note only covered the "first selection" half, missing the
// "switching" half): Vue2's `PhotosSearchView.vue:593-602` `albumAssetIds` **keeps its previous
// value** while in flight -- so during the window where "album A has landed (filter active) ->
// the user switches to album B, and B's request is still in flight", Vue2 still **filters by
// A** (the old value hasn't been cleared). New-UI's rule here is uniformly "don't filter if the
// cache slot doesn't exist", so the same window will **show the unfiltered full set** instead of
// "continuing to filter by A". **Both behave the same on the first album selection** (neither
// filters, since neither has any cached value available yet); **only the "switching albums"
// sub-case differs**. Judgment call: from the angle of "results shouldn't be misleadingly
// filtered by an album that's no longer selected", New-UI's new behavior is more reasonable
// (it's less confusing than silently showing the previous album's stale filtered results), but
// this is indeed an observable behavior difference from Vue2, registered here (also noted in the
// report).
const albumAssetIds = computed<Set<string> | null>(() => {
  const name = filters.value.album
  if (!name) return null
  const id = findAlbumIdByName(name)
  if (id === null) return new Set() // Album name has no matching id => the result is an empty set, not "don't filter" (I7).
  if (!(String(id) in albums.albumAssetsByID)) return null // Cache slot doesn't exist => in flight/not fetched, don't filter.
  return new Set(albums.assetsOf(id).map((a) => String(a.id))) // Cache slot has landed => narrow precisely.
})
watch(
  () => filters.value.album,
  (name) => {
    if (!name) return
    const id = findAlbumIdByName(name)
    if (id === null) return
    void albums.fetchAlbumAssets(id) // Pure trigger; the result is read reactively by the computed above, not handled here.
  },
)

// ── chip / popover interaction (structure spec 20, mirrors Vue2 :739-753 + :783-797) ─────
function togglePop(key: string): void {
  if (openPop.value === key) {
    openPop.value = null
    return
  }
  openPop.value = key
  draft.value = { ...draft.value, [key]: cloneVal((filters.value as Record<string, unknown>)[key]) } as SearchFilters
}
function applyPop(key: keyof SearchFilters): void {
  filters.value = { ...filters.value, [key]: cloneVal(draft.value[key]) }
  openPop.value = null
}
function cancelPop(): void {
  openPop.value = null
}
function clearFilter(key: keyof SearchFilters): void {
  const cur = filters.value[key]
  filters.value = { ...filters.value, [key]: Array.isArray(cur) ? [] : null }
}
function clearAll(): void {
  filters.value = emptyFilters()
}
// fix round 1 * I8 (folded in during review, a registration note for a fix that was made in
// passing earlier but never written up; fix round 3 * #3 correction: the enumeration line is
// actually Vue2 `:562`, `:561` is `const f = this.filters`): Vue2 `:562`'s `anyFilter` **does
// not include album** (`f.date || f.people.length || f.place.length || f.cameras.length ||
// f.type.length || f.src.length || f.scene.length` -- `f.album` is missing from the
// enumeration) -- meaning that in Vue2, when only an album filter is selected, the "Clear all"
// button never appears at all, and the user has no way to clear the selected album with one
// click. This adds `f.album` back in, fixing this omission in Vue2 (album should be treated the
// same as the other four filter dimensions) -- it's not a straight port, and is registered here.
const anyFilter = computed(() => {
  const f = filters.value
  return !!(f.date || f.people.length || f.place.length || f.type || f.album)
})

// Single-select chips (album/type) store string|null in filters/draft, but
// PhotosFilterPopover's selected is string[] -- this adapts between the two shapes both ways.
function singleSelected(v: string | null): string[] {
  return v ? [v] : []
}

// ── activeConditions (structure spec 18, mirrors Vue2 :498-508; the 'type: '/'album: '
//    prefixes are sent to the backend parser and don't go through i18n) ──────────────
const activeConditions = computed<string[]>(() => {
  const out: string[] = []
  const f = filters.value
  // fix round 1 * I8 (folded in during review, a registration note): Vue2 `:501`'s fallback is
  // the hardcoded English literal `f.date.label || 'Date'` -- if `label` happened to be missing,
  // an English word would leak into the Chinese UI. Here it's changed to `t('photosSearchDate')`
  // for localization, registered here as a deliberate deviation from Vue2, not a copying mistake.
  if (f.date) out.push(f.date.label || t('photosSearchDate'))
  f.people.forEach((p) => out.push(p))
  f.place.forEach((p) => out.push(p))
  if (f.type) out.push('type: ' + f.type)
  if (f.album) out.push('album: ' + f.album)
  return out
})

// ── defaultSaveName (structure spec 17, mirrors Vue2 :550-559) ───────────────
const defaultSaveName = computed(() => {
  const q = (query.value || '').trim().replace(/^['"]|['"]$/g, '')
  if (q.length < 40) return q
  const parts: string[] = []
  if (filters.value.people[0]) parts.push(filters.value.people[0])
  if (filters.value.place[0]) parts.push(filters.value.place[0].split(',')[0])
  const ql = (query.value || '').toLowerCase()
  if (ql.includes('sunset')) parts.push(t('photosSearchSunsets'))
  return parts.length ? parts.join(' · ') : t('photosSvNewSmartView')
})

function openSave(): void {
  if (saved.value) return
  saveOpen.value = true
}
// fix wave F1 (final-review-required item, a real functional gap): a successful save previously
// only flipped the `saved` boolean, with no user-visible feedback at all -- Vue2's
// confirmSave() (:806-812) pops a 5-second `.save-toast` on success (sparkles icon + `"{name}"
// saved as a smart view` + an `Open in Smart Views ->` navigation link, :283-288). This maps
// that 1:1 onto the generic `useToast`'s third arg (the same signature as the undo pill,
// `{ label, onClick }`, currently used by T6's recycle-bin undo, src/stores/toast.ts:13-19):
// label is the navigation copy, onClick is swapped for a route push.
// Deviation registered (SP15-P2b Task 5, fix round 2): Vue 2's target is `#/photos` (its
// smart views and album home share the same screen), and at 939a7d3a its label there is
// still "Open in Smart Views →" -- unchanged from before this branch's IA merge, since
// Vue 2 never gets this port's Task 3/4 change that folds smart albums into the Albums
// grid. New-UI briefly pointed this link at the standalone `/photos/smart-views` route
// (T4), but that page is now Moments-only (Task 5) and smart albums live in Albums
// instead (PhotosAlbums.vue). Both the destination AND the label change together: the
// key is renamed photosSearchOpenSmartViews -> photosSearchOpenInAlbums (not just
// re-valued, so a stale key name can't mislead the next reader) and the link now points
// at `/photos/albums`. Same reasoning as the back-button deviation note in
// PhotosSmartViewDetail.vue -- a control whose label names a destination it does not go
// to is a user-visible defect, not a styling choice, so this port fixes the label to match
// the destination it actually needs (Albums) rather than keep repeating Vue 2's now-wrong
// wording.
function onSaved(_id: string, name: string): void {
  saved.value = true
  toast.show(t('photosSearchNameSavedSmartView', { name }), 5000, {
    label: t('photosSearchOpenInAlbums'),
    onClick: () => { void router.push('/photos/albums') },
  })
}

// ── unified overlay governance (structure spec 19, a hard constraint): one mousedown + one
//    keydown, no early returns. The save popover's own outside-click/Esc handling is already
//    done internally by SearchSaveSmartView (the ignoreEl check) -- the keydown here still
//    explicitly closes saveOpen too, to guarantee that the hard constraint "one Esc closes both
//    the chip popover and the save popover when both are open" also holds at the host level, not
//    relying entirely on the child component's internal implementation.
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (openPop.value !== null) openPop.value = null
  if (saveOpen.value) saveOpen.value = false
  // Deviation registered (structure spec 19): Vue2's Esc is exitSearch() (exits search, :834) --
  // not ported here. New-UI uses Esc to close overlays (consistent with the rest of this repo);
  // exiting search goes through the sidebar / browser back button instead.
}
function onDocMousedown(e: MouseEvent): void {
  const target = e.target as Node
  if (openPop.value !== null) {
    const bar = filterbarRef.value
    if (bar && !bar.contains(target)) openPop.value = null
  }
}
const anyOverlayOpen = computed(() => openPop.value !== null || saveOpen.value)
watch(anyOverlayOpen, (open) => {
  if (open) {
    document.addEventListener('keydown', onDocKeydown)
    document.addEventListener('mousedown', onDocMousedown)
  } else {
    document.removeEventListener('keydown', onDocKeydown)
    document.removeEventListener('mousedown', onDocMousedown)
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocKeydown)
  document.removeEventListener('mousedown', onDocMousedown)
})

// ── opening a result (structure spec 15, the core wiring for §7e-3/E3): the fourth arg passes
//    query to activate lightbox OCR highlighting; the paging set is sortedResults, not
//    filteredResults (mirrors Vue2 :725). ─────────────────────────────────────
function onOpen(photo: Photo): void {
  lb.openAt(photo, sortedResults.value.map((r) => r.p), 0, query.value)
}

// onMounted fetches people/albums once each if they haven't loaded yet (mirrors Vue2 :817-818).
// Uses New-UI's store's own loaded gating flag, not Vue2's `!array.length` (avoiding confusion
// between "genuinely zero items" and "hasn't been fetched yet" -- the store already
// distinguishes these specifically, so it's reused directly).
onMounted(() => {
  if (!people.peopleLoaded) void people.fetchPeople()
  if (!albums.albumsLoaded) void albums.fetchAlbums()
})
</script>

<template>
  <div class="photos-root" :class="themeClass">
    <div class="app" :data-collapsed="collapsed">
      <!-- Fix-3 item 7: same narrow-mode coordination as Photos.vue/PhotosAlbums.vue — the
           topbar's own collapse button already delegates to the sidebar drawer on narrow
           viewports, so the sidebar's own floating trigger would be a redundant second
           affordance here. -->
      <PhotosSidebar :collapsed="collapsed" hide-drawer-trigger />
      <main class="main">
        <!-- `back`: Vue2 searchMode's chevL button, replacing title/sub (PhotosTopbar.vue:6-12
             region). `show-search="false"`: PhotosSearchBar below already carries the editable
             query box (owner's standing glass-fill exception) — Vue2 has only one search box
             because its search "page" and library page are the same component; rendering the
             topbar's own box here too would duplicate it. -->
        <PhotosTopbar :collapsed="collapsed" back :show-search="false" @toggle-collapse="onToggleCollapse" @back="onBack" />
      <div class="photos-main">
        <PhotosSearchBar :value="query" autofocus @submit="submitQuery" />

        <!-- pre-search state (structure spec 15)-->
        <div v-if="!query" class="search-prestate" data-test="search-prestate">
          <div class="nimo-orb" />
          <h2>{{ t('photosSearchSearchLibrary') }}</h2>
          <p>{{ t('photosSearchDescribeReLookingPeople') }}</p>
          <div v-if="history.length" class="prestate-recent">
            <span class="prestate-recent-label">{{ t('photosSearchRecentSearches') }}</span>
            <div class="prestate-chips">
              <button
                v-for="h in history.slice(0, 6)" :key="h" type="button" class="prestate-chip"
                data-test="prestate-chip" @click="submitQuery(h)"
              >
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
                ><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <span>{{ h }}</span>
              </button>
            </div>
          </div>
        </div>

        <template v-else>
          <!-- hero (structure spec 15)-->
          <div class="search-hero" data-test="search-hero">
            <div class="search-query-row">
              <div class="search-query" data-test="search-query">
                "<span
                  v-for="(part, i) in queryPartsComputed" :key="i"
                  :class="part.hl ? 'kw' : null"
                >{{ part.text }}</span>"
              </div>
              <div v-if="!searching" class="search-meta" data-test="search-meta">
                {{ t('photosSearchCountResultsSecondsS', { count: filteredResults.length, seconds: (search.ms / 1000).toFixed(2) }) }}
              </div>
            </div>
            <div v-if="history.length > 1" class="search-history">
              <span class="search-history-label">{{ t('photosSearchRecent') }}</span>
              <template v-for="h in history.slice(0, 5)" :key="h">
                <span v-if="h !== query" class="search-history-item" @click="submitQuery(h)">{{ h }}</span>
              </template>
            </div>
            <div v-if="understoodTokens.length > 0" class="understood" data-test="understood">
              <span class="nimo-orb" />
              {{ t('photosSearchNimoUnderstood') }}
              <template v-for="(tok, i) in understoodTokens" :key="i">
                <span class="understood-k">{{ (i > 0 ? '· ' : '') + t(understoodKeyFor(tok.k)) }}</span>
                <b class="understood-v" data-test="understood-v">{{ understoodValueFor(tok) }}</b>
              </template>
            </div>
          </div>

          <!-- chip bar (structure spec 10, 19, 20)-->
          <div ref="filterbarRef" class="filterbar" data-test="filterbar">
            <PhotosFilterChip
              v-for="chip in chips" :key="chip.key" :label="chipLabel(chip)" :active="chipActive(chip.key)"
              :open="openPop === chip.key" :data-test="'chip-' + chip.key"
              @toggle="togglePop(chip.key)" @clear="clearFilter(chip.key)"
            >
              <template #icon>
                <svg
                  v-if="chip.icon === 'clock'" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
                ><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                <svg
                  v-else-if="chip.icon === 'person'" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
                ><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
                <svg
                  v-else-if="chip.icon === 'map'" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
                ><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></svg>
                <svg
                  v-else-if="chip.icon === 'album'" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
                ><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 14l5-4 4 3 3-2 6 5" /></svg>
                <svg
                  v-else viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
                ><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3z" /></svg>
              </template>

              <SearchDatePopover
                v-if="openPop === 'date' && chip.key === 'date'" :draft="draft.date" :committed="filters.date"
                @update:draft="(v) => (draft.date = v)" @apply="applyPop('date')" @cancel="cancelPop"
              />
              <SearchPeoplePopover
                v-if="openPop === 'people' && chip.key === 'people'" :people="realPeopleList" :selected="draft.people"
                @update:selected="(v) => (draft.people = v)" @apply="applyPop('people')" @cancel="cancelPop"
              />
              <PhotosFilterPopover
                v-if="openPop === 'place' && chip.key === 'place'" :title="chip.label" :items="realPlaceItems"
                :selected="draft.place" :search-placeholder="t('photosSearchSearchLabel', { label: chip.label })"
                :empty-hint="t('photosSearchNoLocationDataYet')"
                @update:selected="(v) => (draft.place = v)" @apply="applyPop('place')" @cancel="cancelPop"
              />
              <PhotosFilterPopover
                v-if="openPop === 'album' && chip.key === 'album'" :title="chip.label" :items="realAlbumItems"
                :multiple="false" :selected="singleSelected(draft.album)"
                :search-placeholder="t('photosSearchSearchLabel', { label: chip.label })"
                :empty-hint="t('photosSearchNothingHereYet')"
                @update:selected="(v) => (draft.album = v[0] ?? null)" @apply="applyPop('album')" @cancel="cancelPop"
              />
              <PhotosFilterPopover
                v-if="openPop === 'type' && chip.key === 'type'" :title="chip.label" :items="[...TYPE_ITEMS]"
                :multiple="false" :selected="singleSelected(draft.type)" :label-for="typeLabel"
                :search-placeholder="t('photosSearchSearchLabel', { label: chip.label })"
                :empty-hint="t('photosSearchNothingHereYet')"
                @update:selected="(v) => (draft.type = v[0] ?? null)" @apply="applyPop('type')" @cancel="cancelPop"
              />
            </PhotosFilterChip>

            <div class="filterbar-spacer" />
            <button v-if="anyFilter" type="button" class="clear" data-test="clear-all" @click="clearAll">
              {{ t('photosSearchClearAll') }}
            </button>
            <div style="position: relative">
              <button
                ref="saveBtnRef" type="button" class="save-smart" data-test="save-smart"
                :data-saved="saved ? 'true' : 'false'" :disabled="saved" @click="openSave"
              >
                <svg
                  v-if="!saved" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                ><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
                <svg
                  v-else viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
                  stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
                ><path d="m5 12 5 5L20 7" /></svg>
                {{ saved ? t('photosSearchSaved') : t('photosSearchSaveSmartView') }}
              </button>
              <SearchSaveSmartView
                v-model:open="saveOpen" :query="query" :conditions="activeConditions"
                :default-name="defaultSaveName" :ignore-el="saveBtnRef" @saved="onSaved"
              />
            </div>
          </div>

          <!-- sort / count bar (structure spec 15)-->
          <div class="results-bar" data-test="results-bar">
            <span>{{ t('photosSearchSort') }}</span>
            <div class="sort">
              <button
                type="button" :data-active="sort === 'relevance' ? 'true' : 'false'" data-test="sort-relevance"
                @click="sort = 'relevance'"
              >{{ t('photosSearchRelevance') }}</button>
              <button
                type="button" :data-active="sort === 'newest' ? 'true' : 'false'" data-test="sort-newest"
                @click="sort = 'newest'"
              >{{ t('photosSearchNewest') }}</button>
              <button
                type="button" :data-active="sort === 'oldest' ? 'true' : 'false'" data-test="sort-oldest"
                @click="sort = 'oldest'"
              >{{ t('photosSearchOldest') }}</button>
            </div>
            <div style="flex: 1" />
            <span v-if="!searching" data-test="results-count">
              {{ t('photosSearchCountMatches', { count: filteredResults.length.toLocaleString(localeTag) }) }}
              <template v-if="topScore"> · {{ t('photosSearchTopScoreScore', { score: topScore }) }}</template>
            </span>
          </div>

          <!-- empty state (structure spec 15, D1: no Ask Nimo button)-->
          <div v-if="filteredResults.length === 0 && !searching" class="empty-search" data-test="empty-search">
            <div class="nimo-orb" />
            <h2>{{ t('photosSearchNoMatches') }}</h2>
            <p>{{ t('photosSearchCouldnTFindPhotos') }}</p>
            <div class="conditions">
              <div v-for="c in activeConditions" :key="c" class="fchip" data-on="true">{{ c }}</div>
            </div>
          </div>

          <!-- results grid -->
          <PhotosSearchGrid
            v-else :best="best" :more="more" :more-expanded="moreExpanded" :show-sentinel="showSentinel"
            :loading-more="search.loadingMore" @open="onOpen" @update:more-expanded="(v) => (moreExpanded = v)"
            @load-more="search.loadMore()"
          />
        </template>
      </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* Fix-3 item 7 (owner acceptance, 2026-08-13, Plan F pull-forward): shell migration onto the
   `.app` CSS Grid, matching the six pages already migrated (Photos.vue Task 3/4, PhotosAlbums.vue/
   PhotosAlbumDetail.vue/PhotosSmartViews.vue/PhotosSmartViewDetail.vue/PhotosMomentDetail.vue's
   Plan C Task 2). The transitional flex-row `.photos-layout` shell and its `.sidebar` width pin
   are gone — the `.app` CSS Grid (parity scss photos.scss:116-129) now owns the sidebar's width
   and the height cap (`height: 100vh; overflow: hidden`). `.photos-layout` no longer appears
   anywhere in this file's source — photosLayoutHeightCap.test.ts's CAPPED list has been updated
   to drop this page accordingly (its `allPhotosLayoutViews()` scan only collects pages that still
   contain the `.photos-layout` rule). */
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* 2026-08-13 rollback (owner acceptance, Fix-3 item 7 pull-forward — the same treatment
   PhotosFilterChip.vue/PhotosFilterPopover.vue already went through on the same date): every
   selector that shared a name with a bare rule in vue2-parity/photos.scss has been deleted from
   here. The local scoped copies were reaching for New-UI's OWN global tokens (--fg/--fg-faint/
   --fg-muted/--chip-bg/--chip-border/--chip-bg-hi/--accent-soft/--accent-soft-2/--accent-soft-bd/
   --accent-text/--divider/--success), none of which `.photos-root` redefines locally — so they
   fell through to New-UI's blue/glass theme.css values instead of the Vue2-native
   --text-* / --surface-* / --line / --accent-hi / --accent-soft tokens `.photos-root` DOES define
   locally (vue2-parity/photos.scss:14-64). Scoped `[data-v-xxx]` specificity always won over the correct
   plain parity selector of the same name, so the wrong-token copy always rendered — this is the
   exact "chaotic hybrid" the owner flagged on this page. Deleting them lets the already-present,
   already-correct parity rules govern directly: `.search-prestate`(+children incl. `.nimo-orb`)/
   `.search-hero`/`.search-query`(+`.kw`)/`.search-meta`/`.search-history`(+children)/
   `.understood`(+`.nimo-orb`)/`.filterbar`/`.filterbar-spacer`/`.filterbar .clear`(+:hover)/
   `.save-smart`/`.save-smart[data-saved="true"]`/`.results-bar`/`.sort`/`.sort button`/
   `.sort button[data-active="true"]`/`.empty-search`(+children incl. `.conditions .fchip`)/
   `.nimo-orb` all now come from vue2-parity/photos.scss:2603-2868 verbatim (transcribed from
   Vue2 photos.scss:2560-2825 1:1). The `.filterbar` `background: var(--bg)` an earlier version
   of this comment specifically avoided is safe now: this page no longer lives inside AreaShell's
   translucent glass shell (the very problem that comment registered) — it lives in the SAME
   opaque `.app` grid every other migrated page does, which already paints its own solid
   `var(--bg)` (parity scss photos.scss:116-129), so the "black band on a translucent panel"
   failure mode that comment described cannot recur here (see the corrected reverse gate,
   __tests__/photosGlassSurfaces.test.ts). `.nimo-orb`'s own base rule is dropped too, not just
   its size variants: vue2-parity/photos.scss already carries a `.photos-root .nimo-orb` rule
   using the REAL Vue2 logo asset (`src/photos/assets/nimo-logo.png`, already shipped and already
   consumed by `.nimo-fab`/`.nimo-pop-head` elsewhere in that same stylesheet) — this page's
   self-drawn radial-gradient substitute predates that asset landing in this repo and is strictly
   less accurate than the real image parity already uses, so it is dropped rather than kept as a
   "close enough" stand-in. */

/* `.understood-k`/`.understood-v`: New-UI-only, not covered by parity — Vue2 renders this pair via
   inline `style=` on unclassed spans (PhotosSearchView.vue:43-44: `style="color:var(--text-3)"` /
   `style="margin:0 4px"`), so parity's own extraction has no selector for either. Token corrected
   to `--text-3` (parity-local, matches Vue2's own inline literal exactly) — the old `--fg-faint`
   here was the same New-UI-global-token leak the rest of this rollback removes. */
.understood-k { color: var(--text-3); }
.understood-v { margin: 0 4px; }

/* `.sort button:hover` / `.sort button[data-active="true"]:hover`: Vue2's own `.sort button` has
   NO hover feedback at all (photos.scss:2696-2698 has no `:hover` rule, and parity's transcription
   of it, vue2-parity/photos.scss:2739-2740, faithfully carries that same absence) — this repo's
   other clickable controls all give hover feedback, so this stays as a kept, registered additive
   UX improvement (not a parity gap), just re-pointed at the correct parity token (`--text-1`, not
   the New-UI-global `--fg`) and re-anchored against parity's actual `[data-active]` value
   (`--surface-3`, not `--chip-bg-hi`) for the hover-lock variant, so hovering an already-active
   sort button doesn't visually revert it to the inactive background. */
.sort button:hover { color: var(--text-1); }
.sort button[data-active='true']:hover { background: var(--surface-3); color: var(--text-1); }

/* `.save-smart:hover` / `.save-smart[data-saved="true"]:hover`: same situation as `.sort button`
   above — Vue2's `.save-smart` (photos.scss:2634-2646) has no hover state at all, on either the
   base or the `[data-saved="true"]` variant. Kept as the same registered additive hover-feedback
   convention; the saved-state hover-lock repeats the exact literal values Vue2 uses for that
   state — not a new literal introduced by this rollback, see the theme-exception tag below. */
.save-smart:hover { filter: brightness(1.1); }
/* theme-exception: repeats Vue2's own literal success color for the saved state — the same
   literal (plus !important) parity itself carries at vue2-parity/photos.scss:2683-2687. Each
   property line below needs its own marker since the guard's exempt window only spans to the
   next `;`. */
.save-smart[data-saved='true']:hover {
  /* theme-exception: Vue2 literal */
  background: rgba(52,199,89,0.14) !important;
  /* theme-exception: Vue2 literal */
  border-color: rgba(52,199,89,0.35) !important;
  /* theme-exception: Vue2 literal */
  color: #34C759 !important;
}

/* New-UI mobile enhancement (Vue2 has no responsive drawer here — same registered deviation as
   Photos.vue's/PhotosAlbums.vue's own copy of this rule): once the sidebar switches into
   is-drawer mode (position:fixed, taken out of grid flow) at ≤768px, collapse `.app`'s sidebar
   column too, so `.main` doesn't leave a dead var(--sidebar-w) gutter where the now-floating
   sidebar used to sit. */
@media (max-width: 768px) {
  .app { grid-template-columns: 1fr; }
}
</style>
