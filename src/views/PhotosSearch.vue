<script setup lang="ts">
// PhotosSearch.vue — search container wiring (route /photos/search).
// Delivers on three items carried over from this iteration: ①T6's "refine within search" button
// destination (see PhotosSmartViewDetail.vue) ②lightbox OCR highlight activation (@open passes
// query as the 4th argument to useLightbox().openAt) ③D12's "save as smart view" host wiring
// (.save-smart button + SearchSaveSmartView).
// Read-only reference: Vue2's src/views/Photos/PhotosSearchView.vue in full,
// PhotosTopbar.vue, PhotosTimeline.vue:208-215 (searchActive/history), :650-668
// (onSearch + history write).
//
// This page used to
// pass `show-search=false` to the top bar and render its own separate `PhotosSearchBar.vue` input
// instead -- a D13 divergence from Vue2 (Vue2 has exactly one search box: the shared top bar's own
// `.search`, the same component on both the library page and the search page). This has been
// corrected: the top bar's `showSearch` is left at its default (true), a new `query` prop
// echoes the route's `q` back into that one top-bar input, and submission routes back through
// `@search-submit` into the existing `submitQuery()` -- reusing the exact same top-bar component
// and the same echo/submit contract as Photos.vue's timeline page.
// `PhotosSearchBar.vue` has been retired: a grep confirmed this file was its only consumer before
// deletion, so the component and its test file were deleted together (no dead code left behind).
//
// ★ Architectural difference (structural spec 7, §7e-3): in Vue2, `query` is a prop pushed down
// by the parent component (PhotosTimeline); what actually triggers smartSearch is `onSearch()`
// (a one-shot dispatch on submit) -- `query`'s own watcher only handles "reset the filter chips +
// apply the understood prefill". New-UI is a real route, so the address bar's `q` is the single
// source of truth (back/forward navigation, editing the address bar directly, and refreshing must
// all keep the results in sync) -- which is why triggering smartSearch/clear is also folded into
// the same `watch(query, ..., { immediate: true })` here. This is a deliberate architectural
// adjustment relative to Vue2, not a copy-paste omission.
import '../photos/styles/vue2-parity'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import { useSidebarCollapse } from '../photos/composables/useSidebarCollapse'
import { useAskNimo } from '../photos/composables/useAskNimo'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosTopbar from '../photos/components/PhotosTopbar.vue'
import PhotosFilterChip from '../photos/components/PhotosFilterChip.vue'
import PhotosFilterPopover from '../photos/components/PhotosFilterPopover.vue'
import SearchDatePopover from '../photos/components/SearchDatePopover.vue'
import SearchPeoplePopover from '../photos/components/SearchPeoplePopover.vue'
import SearchSaveSmartView from '../photos/components/SearchSaveSmartView.vue'
import PhotosSearchGrid from '../photos/components/PhotosSearchGrid.vue'
import AlbumPickerDialog from '../photos/components/AlbumPickerDialog.vue'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
import PhotosToastHost from '../photos/components/PhotosToastHost.vue'
import AskNimoHost from '../photos/components/asknimo/AskNimoHost.vue'
import { usePhotosSearch } from '../photos/stores/search'
import { usePhotosPeople } from '../photos/stores/people'
import { usePhotosAlbums } from '../photos/stores/albums'
import { useTimelineStore } from '../photos/stores/timeline'
import { usePhotosTrash } from '../photos/stores/trash'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { usePhotosToast } from '../photos/composables/usePhotosToast'
import { useToast } from '../stores/toast'
import { understood, type PersonOption, type UnderstoodKind, type UnderstoodToken } from '../photos/util/searchUnderstood'
import { queryParts } from '../photos/util/searchQueryParts'
import { sortResults, splitTiers, matchPct, type ScoredPhoto, type SortKey } from '../photos/util/searchSort'
import { dateInRange, quickRange, yearRange, type DateRange } from '../photos/util/dateRange'
import type { Photo } from '../photos/util/assetToPhoto'

const route = useRoute()
const router = useRouter()
// `locale` is back in use again -- the codebase's only bare `toLocaleString()` call
// (`filteredResults.length.toLocaleString()`) doesn't follow locale, so under the Chinese UI the
// thousands-separator formatting for numbers would drift with the browser's own locale. It was
// removed once because it genuinely wasn't used at the time -- not because it should never be used
// again; this repo's locale tags are `zh_cn`/`en_us` (underscore, not valid BCP-47), and passing
// them to toLocaleString raw throws a RangeError, so they must always be converted to the hyphenated
// form (the established convention, following the existing precedent in SearchPeoplePopover.vue
// :59-63 / SmartViewCard.vue:38).
const { t, locale } = useI18n()
const { themeClass } = usePhotosTheme()
// Shell migration onto the
// `.app` CSS Grid + PhotosTopbar, matching the six pages already migrated. `collapsed`/`toggle` is
// the same shared module-singleton
// composable every migrated page already consumes — this page is not a new instance of the
// collapse state, just another consumer of it.
const { collapsed, toggle: onToggleCollapse } = useSidebarCollapse()
const localeTag = computed(() => locale.value.replace('_', '-'))
const search = usePhotosSearch()
const people = usePhotosPeople()
const albums = usePhotosAlbums()
const timeline = useTimelineStore()
const trash = usePhotosTrash()
const lb = useLightbox()
const toast = useToast()
const photosToast = usePhotosToast()

// ── query: read from the route, a read-only computed, never assigned directly (the falsifiable guard from §7e-3) ───────────
const query = computed(() => String(route.query.q ?? ''))

// ── Local state (structural spec 9) ───────────────────────────────────────────────────
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
// albumAssetIds is no longer a ref written by a watcher -- see the redesign below; it's
// now a computed read live from the albums store (actually defined in the section near the
// filters.album watcher, not near realAlbumItems -- the two are about 230 lines apart).

const filterbarRef = ref<HTMLElement | null>(null)
const saveBtnRef = ref<HTMLElement | null>(null)

// ── Search history (structural spec 16, same localStorage key as Vue2) ──────────────────────
const HISTORY_KEY = 'nimo_search_history' // Same key Vue2 used, kept for continuity with existing stored history.
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
    // Mirrors Vue2 PhotosTimeline.vue:658's blanket error-swallowing: a write failure doesn't crash and doesn't affect the current search flow.
  }
}

// No Vue2 source: Vue2 never had a clear-history
// affordance at all. Wipes both the persisted localStorage key and the reactive `history` ref
// together, in the same tick, so BOTH render spots -- the prestate `.prestate-recent` chips block
// and the results-state `.search-history` row -- empty immediately. Their existing `v-if`
// conditions (`history.length` / `history.length > 1`) already hide on an empty array; no extra
// wiring needed there.
function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch {
    // Same broad-catch precedent as readHistory/writeHistory above -- a storage failure here
    // shouldn't crash the page, it should just leave the reactive ref (cleared below) as the
    // source of truth for this session.
  }
  history.value = []
}

// Submitting a term: syncs the address bar via router replace. The top bar PhotosTopbar's
// search-submit (replacing the now-retired PhotosSearchBar), the recent-
// search chips in the pre-search state, and the history terms in the hero all share this same
// logic.
//
// History writing does **not** happen here -- it's moved to the main query watcher below
// (the non-empty branch) -- see the detailed note above that watcher. Only the route navigation
// remains here.
//
// Vue2's `onSearch()` unconditionally dispatches smartSearch on every submit. New-UI is
// route-driven -- resubmitting the same term calls `router.replace` to the **same
// route** (neither path nor query changes), which vue-router treats as no navigation, so the
// `query` computed never fires, and the main watcher never re-calls smartSearch -- silently
// breaking "resubmit to force a refresh". This adds a shortcut: when the target term exactly
// matches the current route's q, skip the route change and directly
// call smartSearch again (no need to write history -- it's already the front of the history queue, so the order doesn't change).
function submitQuery(q: string): void {
  if (q && q === query.value) {
    void search.smartSearch(q)
    return
  }
  void router.replace({ path: '/photos/search', query: q ? { q } : {} })
}

// PhotosTopbar's `back` button (Vue2 searchMode's chevL, PhotosTopbar.vue:6-8,
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

// ── Three data sources (structural spec 11) ──────────────────────────────────────────────────
// people.named's filter criterion (`p.name && p.name.trim() !== ''`) matches Vue2's realPeopleList's
// `.filter(p => p.name && p.name.trim())` verbatim (cross-checked against the source), so it's
// reused directly rather than re-filtered here. Sorting (descending by face count) and the mapping
// to → PersonOption are still done in this file (SearchPeoplePopover's people prop relies on the
// caller having already sorted it; the component itself does not sort).
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

// Transcribed from Vue2 :452-465 along with its comment: tallies the frequency of the first segment of the place name from the **current search results** (before filtering), sorted descending by frequency.
const realPlaceItems = computed<string[]>(() => {
  const freq = new Map<string, number>()
  for (const r of results.value) {
    if (!r.p.place) continue
    const city = r.p.place.split(',')[0].trim()
    freq.set(city, (freq.get(city) || 0) + 1)
  }
  return Array.from(freq.keys()).sort((a, b) => (freq.get(b) || 0) - (freq.get(a) || 0))
})

// File type is an intrinsic asset property, not backend-driven -- transcribed from Vue2's static typeItems array.
const TYPE_ITEMS = ['Photos', 'OCR', 'Videos'] as const
// Direct concatenation of 'photosSearchType' + v would produce 'photosSearchTypeOCR' (uppercase)
// for OCR, which differs in case from the real key 'photosSearchTypeOcr' -- string concatenation
// can't be relied on here, an explicit lookup table is required (a fatal concatenation trap found
// while cross-checking against the source; implementing the literal formula as-is would silently
// fall back to the English original for the OCR type, the same class of defect §7e-13 is meant to fix).
const TYPE_LABEL_KEYS: Record<string, string> = {
  Photos: 'photosSearchTypePhotos',
  OCR: 'photosSearchTypeOcr',
  Videos: 'photosSearchTypeVideos',
}
function typeLabel(v: string): string {
  return t(TYPE_LABEL_KEYS[v] ?? v)
}

// ── Chip definitions (structural spec 10, order transcribed from Vue2 :564-572) ────────────────────────────
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

// ── Result derivation (structural spec 12, order transcribed from Vue2 :339-404: results →
//    filteredResults → sortedResults → the two tiers, the tier split happens after sorting) ────────────────────────────
const results = computed<ScoredPhoto[]>(() => {
  if (!query.value) return []
  // Returns empty during the in-flight window (route q already updated, but the store still holds the old term / has never searched) to prevent flashing the previous results.
  if (!search.matchesQuery(query.value)) return []
  return search.results.map((p) => ({ p, score: p.matchScore ?? null }))
})

// In-flight state: there is already a query term but the store's results don't belong to it yet. Used to suppress the empty-state copy.
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
  // String() fallback: Photo.takenAt's type is string | number | null (real data is always
  // an ISO string; number is just defensive type tolerance -- same treatment as the existing
  // precedent comment in peopleView.ts:330-337).
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

// Transcribed from Vue2 :413-415.
const showSentinel = computed(() => moreExpanded.value && !search.exhausted && more.value.length > 0)

const topScore = computed(() => {
  if (!sortedResults.value.length) return null
  const pct = matchPct(sortedResults.value[0].score)
  return pct != null ? pct + '%' : null
})

// ── Hero: query highlighting + Nimo's "understood as" (structural spec 15) ──────────────────────────────
const understoodTokens = computed<UnderstoodToken[]>(() => understood(query.value, realPeopleList.value))
const queryPartsComputed = computed(() => queryParts(query.value, understoodTokens.value.map((tk) => tk.v.toLowerCase())))

function understoodKeyFor(k: UnderstoodKind): string {
  if (k === 'person') return 'photosSearchTokPerson'
  if (k === 'type') return 'photosSearchTokType'
  return 'photosSearchTokTime'
}
// Vue2 defect fix #13 (§7e-13): Vue2's `:44` is `<b>{{ t.v }}</b>`, which outputs English
// directly (e.g. searching 'my videos' displays 'Videos'), leaking English into the Chinese UI.
// This localizes by token kind instead: person → the person's name as-is; type →
// t('photosSearchType'+v); time → if quick is a number (a year) keep it as-is, if it's a
// QuickKey string then v itself is an i18n key, so run it through t().
function understoodValueFor(tok: UnderstoodToken): string {
  if (tok.k === 'person') return tok.v
  if (tok.k === 'type') return typeLabel(tok.v)
  if (typeof tok.quick === 'number') return tok.v
  return t(tok.v)
}

// ── applyUnderstood (structural spec 14, transcribed from Vue2 :659-672) ──────────────────────────────
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

// ── Main watcher (structural spec 7+8+21, §7e-3/§7e-14): merges the route-driven search
//    dispatch, history write, chip reset, understood prefill, and saved reset ────────────────────────
//
// History writing is moved here (the non-empty branch), instead of having each of
// the three entry points (Photos.vue's top-bar search box / this page's own top-bar search-submit,
// replacing the now-retired PhotosSearchBar / T6's "refine within search")
// each calling it once. Vue2 only has one place that writes history (`PhotosTimeline.vue`'s
// `onSearch()`), because Vue2 has a single view where all three trigger paths end up calling the
// same method; New-UI is genuinely routed, so these three are scattered across three files each
// calling their own `router.push`, and requiring "write on submit" would mean keeping all three
// permanently in sync -- **writing once here, after the route lands (in the watcher), naturally
// covers every entry point**, including deep links and refreshes, which is more robust than
// manually keeping three call sites in sync.
//
// **Divergence on record (an observable difference from Vue2 that must be documented)**: Vue2
// records "on submit" -- history is only written when `onSearch(query)` is actually called.
// New-UI here records "on arrival" -- any way that makes `query` become a new non-empty value
// writes history, including: a shared deep link, the browser's back/forward buttons, or editing
// the address bar directly. In other words these actions now also record the term into "recent
// searches" and move it to the front -- a deliberately accepted behavioral difference for this
// task (and arguably more sensible for the deep-link case: it means the user did actually see this
// search's results), not an oversight.
watch(
  query,
  (q, old) => {
    if (old !== undefined && q !== old) {
      filters.value = emptyFilters()
      moreExpanded.value = false
      saved.value = false // 第 14 条 Vue2 缺陷修复(§7e-14):换查询词后「已保存」复位。
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

// Reruns the understood prefill once after people finish loading asynchronously (transcribed from Vue2 :591).
watch(
  () => people.peopleLoaded,
  (loaded) => {
    if (loaded) applyUnderstood()
  },
)

// ── filters.album's album asset resolution (structural spec 13, E4) ───────────────────────────
//
// The first version made `albumAssetIds` a ref written by `fetchAlbumAssets(id).then(...)`,
// guarding against "an old response overwriting a new one" with a self-built `albumSeq` counter --
// but that only blocks the **cross-id** race (pick A, then quickly switch to B); it doesn't block
// the **same-id reentrancy** race found during review: `albums.ts:82`'s
// `if (isLoadingAssets(id)) return` -- calling again for the same id while a request for it
// is already in flight **resolves immediately with no data at all**. Full repro path: select
// album A → Apply (request A in-flight) → reopen the popover, cancel A → Apply
// (`filters.album=null`) → select A again → Apply ⇒ the second `fetchAlbumAssets` call for A
// hits `isLoadingAssets(A)===true` and short-circuits to an immediate resolve; inside `.then()`,
// `mine===albumSeq` holds (it is the latest legal call), but `assetsOf(A)` is still empty at that
// moment -- `albumAssetIds` gets written as an empty Set, and **the result is permanently
// zeroed**; by the time the first real request lands, no code path ever reads it again.
//
// Fix (a structural elimination, not another counter): change `albumAssetIds` from "a snapshot
// written by some promise's resolve" to "a computed read live from the `albums` store" -- every
// access reads `albums.assetsOf(the currently selected album's id)` directly, which is a
// reactive reference. No matter which call to `fetchAlbumAssets` writes `albumAssetsByID` (even
// one whose data got swallowed by the short-circuit), as long as it writes the id of the
// "currently selected album", this computed automatically re-evaluates and picks up the latest
// data -- there's no need to check "is this the response to my request", because it never depends
// on any single promise's return value at all. The cross-id race (pick A, its slow response
// hasn't come back yet, switch to B) is therefore structurally immune too: once switched to B,
// this computed reads `assetsOf(B)`; A's late response only writes `albumAssetsByID['A']`, which
// doesn't affect the `assetsOf(B)` currently being read. The `fetchAlbumAssets` call is thereby
// downgraded to an independent watcher that is **purely a trigger side effect**, no longer
// responsible for writing any local state.
function findAlbumIdByName(name: string): string | number | null {
  const found = albums.albums.find((a) => (typeof a.name === 'string' ? a.name : '') === name)
  return found ? (found.id as string | number) : null
}
// `albums.assetsOf(id)` returns the same `[]` whether **the cache slot was never established
// at all** (the request is in-flight / not yet sent) or "the cache slot is established but is
// genuinely an empty array" (the album really has no photos) -- you can't decide "should this
// filter apply" just by looking at `assetsOf(id).length`. At the moment an album's Apply is
// clicked, the request has usually not landed yet; treating "no data available yet" as "this
// album has no photos" would zero out `filteredResults` instantly, and `.empty-search` (the 80px
// padding "no matches" block) would flash on screen during the whole in-flight window -- this is
// the **normal path** for filtering by album for the first time, not an extreme timing edge case,
// and it had no test coverage (nothing in the mutation-testing checklist would catch it, because
// every album test either mocks an immediate resolve or explicitly awaits `flushPromises()`
// before asserting, which naturally skips over the "before it resolves" window).
//
// Fix: distinguish "the cache slot doesn't exist" (`String(id) in albums.albumAssetsByID` is
// false ⇒ in-flight/not fetched, matching Vue2 `PhotosSearchView.vue:593-602`'s convention --
// **don't filter while in-flight**, consistent with the initial state the moment an album is
// selected, `albumAssetIds = null`) from "the cache slot has landed, and its content happens to
// be an empty array" (⇒ genuinely no photos, should narrow precisely to an empty set -- it can't
// be allowed to pass through unfiltered just because it "looks the same []" as the in-flight
// case, or I7's "empty album" semantics would collapse back into "in-flight"). The `in` check
// only looks at whether the key exists (`albums.ts`'s `fetchAlbumAssets` writes this album's slot
// on both success and failure -- the success path calls `setAlbumAssets(id, ...)` inside the
// `try` block (`albums.ts:87`), the failure path calls `setAlbumAssets(id, [])` inside the
// `catch` block (`albums.ts:90`); `finally` (`:91-93`) is only responsible for resetting
// `isLoadingAssets` and never touches this slot -- so even though the result can be an empty
// array, the slot is absent only when a request has never been made / hasn't completed yet) --
// not "checking whether the length is 0", which is exactly the key distinction of this fix: it
// must use `in` and cannot use `assetsOf(id).length === 0` to decide "hasn't landed yet".
//
// Registering one more observable difference from Vue2 -- previously only the "first selection"
// half of this was mentioned, missing the "switching" half: Vue2
// `PhotosSearchView.vue:593-602`'s `albumAssetIds` **keeps its previous value** during the
// in-flight window -- so in the window where "album A has already landed (filter applied) → the
// user switches to album B, and B's request is still in flight", Vue2 still **filters by A** (the
// old value hasn't been cleared). New-UI's unified rule of "don't filter when the cache slot
// doesn't exist" means the same window instead **shows the unfiltered full set**, rather than
// "continuing to filter by A". **The two behave the same on first selecting an album** (neither
// filters, because neither has any cached value available yet); **only the "switching albums"
// sub-case differs**. Judgment: from the angle of "an album that is no longer selected shouldn't
// be used to misleadingly filter the results", New-UI's new behavior is more reasonable (it is
// less likely to confuse the user than "silently filtering with the previous album's stale
// results"), but this is indeed an observable behavioral difference from Vue2, registered here
// (also recorded in the report).
const albumAssetIds = computed<Set<string> | null>(() => {
  const name = filters.value.album
  if (!name) return null
  const id = findAlbumIdByName(name)
  if (id === null) return new Set() // 相册名查不到 id ⇒ 结果为空集,不是不过滤(I7)。
  if (!(String(id) in albums.albumAssetsByID)) return null // 缓存槽不存在 ⇒ 在途/未拉,不过滤。
  return new Set(albums.assetsOf(id).map((a) => String(a.id))) // 缓存槽已落地 ⇒ 精确收窄。
})
watch(
  () => filters.value.album,
  (name) => {
    if (!name) return
    const id = findAlbumIdByName(name)
    if (id === null) return
    void albums.fetchAlbumAssets(id) // 纯触发;结果由上面的 computed 响应式读取,不在这里处理。
  },
)

// ── Chip / popover interaction (structural spec 20, transcribed from Vue2 :739-753 + :783-797) ──────────────
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
// Vue2 `:562`'s `anyFilter` **does not include album** (`f.date || f.people.length ||
// f.place.length || f.cameras.length || f.type.length || f.src.length || f.scene.length` --
// there is no `f.album` in the enumeration) -- meaning that in Vue2, when only an album filter is
// selected, the "clear all" button never appears at all, and the user has no one-click way to
// clear the selected album. This adds `f.album` here, fixing this Vue2 oversight (an album
// should be treated the same as the other four filter dimensions), not a straight port --
// registered here.
const anyFilter = computed(() => {
  const f = filters.value
  return !!(f.date || f.people.length || f.place.length || f.type || f.album)
})

// Single-select chips (album/type) store string|null in filters/draft, but
// PhotosFilterPopover's selected is string[] -- this does the two-way adaptation.
function singleSelected(v: string | null): string[] {
  return v ? [v] : []
}

// ── activeConditions (structural spec 18, transcribed from Vue2 :498-508; the
//    'type: '/'album: ' prefixes are sent to the backend parser, not passed through i18n) ──────────────────────────────
const activeConditions = computed<string[]>(() => {
  const out: string[] = []
  const f = filters.value
  // Vue2 `:501`'s fallback is the hardcoded English literal
  // `f.date.label || 'Date'` -- if `label` happens to be missing, an English word leaks through
  // under the Chinese UI. This uses `t('photosSearchDate')` for localization instead, registered
  // here (a deliberate divergence from Vue2, not a copying mistake).
  if (f.date) out.push(f.date.label || t('photosSearchDate'))
  f.people.forEach((p) => out.push(p))
  f.place.forEach((p) => out.push(p))
  if (f.type) out.push('type: ' + f.type)
  if (f.album) out.push('album: ' + f.album)
  return out
})

// Task 18 (Plan G): empty-state "Ask Nimo to search differently" button, entry #5 of the 9 real
// Ask Nimo entry points (spec §3 reverses the old D1 ruling that this button not be built).
function onAskNimoSearchDifferently(): void {
  // Preflight F-07: Vue2's exact separator is ' + ' (PhotosSearchView.vue:234
  // `activeConditions.join(' + ')`), not a Chinese-comma guess.
  useAskNimo().openWith(t('photosSearchFindPhotosPrefix') + activeConditions.value.join(' + '))
}

// ── defaultSaveName (structural spec 17, transcribed from Vue2 :550-559) ──────────────────────────────
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
// Save success previously only flipped the single `saved` boolean, with no user-visible feedback
// at all -- Vue2's confirmSave() (:806-812) pops a 5-second `.save-toast` on success (a sparkles
// icon + 「"{name}" 已保存为智能视图」 + a 「在智能视图中打开 →」 link, :283-288). This maps
// that 1:1 using the generic `useToast`'s third argument (the same signature as the undo pill,
// `{ label, onClick }`, already used by T6's trash undo, src/stores/toast.ts:13-19): label is the
// link text, onClick becomes the route navigation.
// Divergence on record: Vue 2's target is `#/photos` (its
// smart views and album home share the same screen), and its label there is
// still "Open in Smart Views →" -- unchanged from before this branch's IA merge, since
// Vue 2 never gets this port's change that folds smart albums into the Albums
// grid. New-UI briefly pointed this link at the standalone `/photos/smart-views` route,
// but that page is now Moments-only and smart albums live in Albums
// instead (PhotosAlbums.vue). Both the destination AND the label change together: the
// key is renamed photosSearchOpenSmartViews -> photosSearchOpenInAlbums (not just
// re-valued, so a stale key name can't mislead the next reader) and the link now points
// at `/photos/albums`. Same reasoning as the back-button divergence note in
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

// ── Unified overlay governance (structural spec 19, a hard constraint): one mousedown + one
//    keydown, no early exits allowed. The save popover's own click-outside/Esc is already
//    handled internally by SearchSaveSmartView (the ignoreEl check) -- the keydown here still
//    explicitly closes saveOpen too, so the hard constraint "when the chip popover and the save
//    popover are both open, a single Esc closes both" also holds at the host level, without
//    fully relying on the child component's internal implementation.
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (openPop.value !== null) openPop.value = null
  if (saveOpen.value) saveOpen.value = false
  // Divergence on record (structural spec 19): Vue2's Esc is exitSearch() (exits search, :834),
  // not carried over here -- New-UI uses Esc to close overlays instead (consistent with the rest
  // of this repo's pages); exiting search instead goes through the sidebar / the browser's back
  // button.
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

// ── Opening a result (structural spec 15, the core wiring for §7e-3/E3): the 4th argument
//    passes query to activate the lightbox's OCR highlight; the pagination set is sortedResults,
//    not filteredResults (transcribed from Vue2 :725). ────────────
function onOpen(photo: Photo): void {
  lb.openAt(photo, sortedResults.value.map((r) => r.p), 0, query.value)
}

// ── PhotoLightbox event wiring for this page's own search-results context ──
// (this page never mounted <PhotoLightbox> at all before -- lb.openAt above fired into a
// dangling singleton with no visible overlay, the F8 bug class).
// @toggle-fav: no-op, same convention every host page in this codebase uses (Photos.vue,
// PhotosAlbumDetail.vue, PhotosMomentDetail.vue, PhotosSmartViewDetail.vue, and even
// PhotosFavorites.vue -- whose own list you would expect to react locally to an unfavorite, and
// which still wires the same `() => {}` no-op) -- useLightbox itself optimistically flips favIds
// and re-renders the star icon internally (PhotoLightbox.vue's own onToggleFav comment), and that
// store-level fallback is what every page actually relies on, this one included. The emit exists
// only as a hook for some future host page that needs a local reaction beyond the star icon; none
// of today's pages, including list-backed ones like Favorites, currently need it.
function onLightboxToggleFav(): void {}

// @delete: Function parity with Vue2 requires a REAL delete
// here, not a no-op: the delete button + confirm dialog render unconditionally inside
// PhotoLightbox, so a no-op handler let the user complete the whole confirm flow (dialog closes,
// lightbox closes, exactly as if the delete succeeded) while nothing actually happened -- a
// false-success illusion, not a harmless gap. Vue2's own search-opened lightbox has a working
// delete (single shared lightbox instance owned by PhotosTimeline.vue, wired the same as every
// other entry point), so New-UI owes the same here.
// Mirrors Photos.vue's `onLightboxDelete` (Photos.vue:221-236) byte-for-byte on the delete/toast
// side: same `timeline.deleteAssets([id])` pathway (the real `service.photos.deleteAsset` call,
// reused rather than reinvented), same Photos-private toast shape (trash icon, count 1, Undo
// action) via the same `usePhotosToast()` composable.
// Deviation (documented): `usePhotosSearch()`'s `results` is a plain,
// unwrapped ref (not a store method) -- a targeted local filter removes the deleted id directly,
// no new store mutation needed. This is preferred over re-running smartSearch because
// `filteredResults`/`sortedResults`/`tiers`/`best`/`more` all derive from `search.results` via
// `computed()`, so one filter cascades through the whole results pipeline for free, and it
// preserves this page's own scroll/offset/exhausted pagination state (a fresh smartSearch would
// reset `offset` to 0 the same way a real re-submit does).
// Undo: Photos.vue's Undo relies on `trash.restore()`'s own `refreshTimelineAfterTrashChange()`
// to refresh the SAME timeline store its list reads from -- that mechanism doesn't reach this
// page's results (a search snapshot, not the timeline store), so restoring the asset
// server-side wouldn't put it back in `search.results` on its own. Re-running the same query
// after restore is the documented fallback for exactly this case: it brings the restored item
// back (if it still matches), at the cost of resetting pagination -- the same cost every fresh
// `submitQuery()` on this page already pays.
async function onLightboxDelete(id: string | number): Promise<void> {
  const snapshot = [String(id)]
  await timeline.deleteAssets(snapshot)
  search.results = search.results.filter((p) => String(p.id) !== String(id))
  photosToast.show({
    text: t('photosDeletedToast', { count: 1 }),
    icon: 'trash',
    action: {
      label: t('photosTrashUndo'),
      onClick: () => {
        void (async () => {
          await trash.restore(snapshot)
          if (query.value) void search.smartSearch(query.value, search.filtersPayload)
        })()
      },
    },
  })
}

// @add-to-album IS meaningfully supportable without any of the above -- it only needs the asset
// id and AlbumPickerDialog's own API call, no mutation of this page's search-results list at all
// (the closest analog is PhotosMomentDetail.vue's own single-item `openAlbumPicker`/
// `onAlbumPickerAdded` pair, not Photos.vue's batch-selection variant -- this page has no
// selection state to clear afterward either).
const albumPickerOpen = ref(false)
const albumPickerIds = ref<Array<string | number>>([])
function openAlbumPicker(ids: Array<string | number>): void {
  albumPickerIds.value = ids
  albumPickerOpen.value = true
}
function onAlbumPickerAdded(): void {}

// On mount, fetches people/albums once each if not already loaded (transcribed from Vue2
// :817-818). Uses New-UI store's own `loaded` gating flag rather than Vue2's `!array.length`
// (to avoid confusing "genuinely zero items" with "hasn't been fetched yet" -- the store already
// makes this distinction specifically, so it's reused directly).
onMounted(() => {
  if (!people.peopleLoaded) void people.fetchPeople()
  if (!albums.albumsLoaded) void albums.fetchAlbums()
})
</script>

<template>
  <div class="photos-root" :class="themeClass">
    <div class="app" :data-collapsed="collapsed">
      <!-- Same narrow-mode coordination as Photos.vue/PhotosAlbums.vue — the
           topbar's own collapse button already delegates to the sidebar drawer on narrow
           viewports, so the sidebar's own floating trigger would be a redundant second
           affordance here. -->
      <PhotosSidebar :collapsed="collapsed" hide-drawer-trigger />
      <main class="main">
        <!-- `back`: Vue2 searchMode's chevL button, replacing title/sub (PhotosTopbar.vue:6-12
             region). `showSearch` stays at its default (true) and `query` echoes
             the route's `q` into the topbar's own `.search` box — Vue2 has only ONE search box
             because its search "page" and library page are the same component; this page now
             matches that 1:1 instead of rendering a second, page-body-local input (the retired
             PhotosSearchBar.vue). -->
        <PhotosTopbar
          :collapsed="collapsed" back :query="query"
          @toggle-collapse="onToggleCollapse" @back="onBack" @search-submit="submitQuery"
        />
      <div class="photos-main">
        <!-- Pre-search state (structural spec 15) -->
        <div v-if="!query" class="search-prestate" data-test="search-prestate">
          <div class="nimo-orb" />
          <h2>{{ t('photosSearchSearchLibrary') }}</h2>
          <p>{{ t('photosSearchDescribeReLookingPeople') }}</p>
          <div v-if="history.length" class="prestate-recent">
            <div class="prestate-recent-head">
              <span class="prestate-recent-label">{{ t('photosSearchRecentSearches') }}</span>
              <!-- No Vue2 source: see clearHistory()
                   above for what clicking this does to both render spots. -->
              <button
                type="button" class="prestate-recent-clear" data-test="search-history-clear"
                @click="clearHistory"
              >{{ t('photosSearchClearHistory') }}</button>
            </div>
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
          <!-- Hero (structural spec 15) -->
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

          <!-- Chip bar (structural specs 10, 19, 20) -->
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

          <!-- Sort / count bar (structural spec 15) -->
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

          <!-- Spec §3 reverses the old D1 ruling ("no Ask Nimo button here") --
               the button is now built. Inline size/icon transcribed verbatim from Vue2
               PhotosSearchView.vue:233-236. -->
          <div v-if="filteredResults.length === 0 && !searching" class="empty-search" data-test="empty-search">
            <div class="nimo-orb" />
            <h2>{{ t('photosSearchNoMatches') }}</h2>
            <p>{{ t('photosSearchCouldnTFindPhotos') }}</p>
            <div class="conditions">
              <div v-for="c in activeConditions" :key="c" class="fchip" data-on="true">{{ c }}</div>
            </div>
            <button
              type="button" class="btn btn-ai" style="height:36px;padding:0 18px"
              data-test="empty-search-ask-nimo" @click="onAskNimoSearchDifferently"
            >
              <span class="nimo-orb" style="width:18px;height:18px" />
              {{ t('photosSearchAskNimoSearchDifferently') }}
            </button>
          </div>

          <!-- Results grid -->
          <PhotosSearchGrid
            v-else :best="best" :more="more" :more-expanded="moreExpanded" :show-sentinel="showSentinel"
            :loading-more="search.loadingMore" @open="onOpen" @update:more-expanded="(v) => (moreExpanded = v)"
            @load-more="search.loadMore()"
          />
        </template>
      </div>
      </main>
    </div>

    <!-- PhotoLightbox mount added -- this page never had one before (see
         onOpen's own comment above for the F8 bug class this closes: lb.openAt fired into a
         dangling singleton with no overlay to render into). Nested inside `.photos-root` from
         the start (no F8-r4-style un-nest/re-nest history here), matching every other page's
         final position after the same cleanup pass. -->
    <PhotoLightbox
      @delete="onLightboxDelete"
      @toggle-fav="onLightboxToggleFav"
      @add-to-album="(id) => openAlbumPicker([id])"
    />
    <AlbumPickerDialog v-model:open="albumPickerOpen" :asset-ids="albumPickerIds" @added="onAlbumPickerAdded" />
    <!-- Required now that `onLightboxDelete` fires a real
         `usePhotosToast()` Undo toast -- without a mount, the toast state flips but nothing on
         this page's own tree renders it, the exact same "state changed, nothing visible" bug
         class the delete no-op itself was flagged for. Teleports to <body> and re-applies
         `photos-root` + `themeClass` on its own portal target (see that component's own header
         comment), same mount Photos.vue/PhotosAlbumDetail.vue/PhotosSmartViewDetail.vue already
         use for the identical Undo-toast pattern. -->
    <PhotosToastHost />
    <!-- Plan G: Ask Nimo FAB + popup + drawer, same "mount once per view, Teleport to body" shape
         as PhotosToastHost -- Photos has no shared shell to mount this once at. -->
    <AskNimoHost />
  </div>
</template>

<style scoped>
/* Shell migration onto the
   `.app` CSS Grid, matching the six pages already migrated. The transitional flex-row
   `.photos-layout` shell and its `.sidebar` width pin
   are gone — the `.app` CSS Grid (parity scss photos.scss:116-129) now owns the sidebar's width
   and the height cap (`height: 100vh; overflow: hidden`). `.photos-layout` no longer appears
   anywhere in this file's source — photosLayoutHeightCap.test.ts's CAPPED list has been updated
   to drop this page accordingly (its `allPhotosLayoutViews()` scan only collects pages that still
   contain the `.photos-layout` rule). */
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* 2026-08-13 rollback (the same treatment
   PhotosFilterChip.vue/PhotosFilterPopover.vue already went through on the same date): every
   selector that shared a name with a bare rule in vue2-parity/photos.scss has been deleted from
   here. The local scoped copies were reaching for New-UI's OWN global tokens (--fg/--fg-faint/
   --fg-muted/--chip-bg/--chip-border/--chip-bg-hi/--accent-soft/--accent-soft-2/--accent-soft-bd/
   --accent-text/--divider/--success), none of which `.photos-root` redefines locally — so they
   fell through to New-UI's blue/glass theme.css values instead of the Vue2-native
   --text-* / --surface-* / --line / --accent-hi / --accent-soft tokens `.photos-root` DOES define
   locally (vue2-parity/photos.scss:14-64). Scoped `[data-v-xxx]` specificity always won over the correct
   plain parity selector of the same name, so the wrong-token copy always rendered — this is the
   exact "chaotic hybrid" this page exhibited. Deleting them lets the already-present,
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

/* No Vue2 source: neither selector has a parity
   counterpart -- Vue2's recent-searches block never had a clear affordance to transcribe. Kept
   subtle to match the label it sits next to: a plain text button, `--text-3` at rest (same token
   `.prestate-recent-label` itself uses, so it reads as part of the same quiet header row rather
   than a competing call-to-action) brightening to `--text-1` on hover -- both `.photos-root`-local,
   is-light-aware tokens, legible in both themes by construction. */
.prestate-recent-head { display: flex; align-items: center; gap: 10px; }
.prestate-recent-clear {
  background: transparent; border: 0; padding: 0; cursor: pointer;
  font-size: 11px; color: var(--text-3);
}
.prestate-recent-clear:hover { color: var(--text-1); }

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

/* New-UI mobile enhancement (Vue2 has no responsive drawer here — same recorded divergence as
   Photos.vue's/PhotosAlbums.vue's own copy of this rule): once the sidebar switches into
   is-drawer mode (position:fixed, taken out of grid flow) at ≤768px, collapse `.app`'s sidebar
   column too, so `.main` doesn't leave a dead var(--sidebar-w) gutter where the now-floating
   sidebar used to sit. */
@media (max-width: 768px) {
  .app { grid-template-columns: 1fr; }
}
</style>
