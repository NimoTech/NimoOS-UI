// People-view pure functions: normalization + named/unnamed partition + sort. Ported from Vue2:
//   store/modules/photos.js:333-344 (peopleNamed/peopleUnnamed/peopleUnnamedVisible)
//   views/Photos/PhotosPeopleView.vue:493-516,551-558
//     (filteredNamed sort/filter, hiddenSingletonCount, mergeReason)
//   views/Photos/peopleUtils.js:5-8,14-20,44-47 (MONTH_NAMES, monthLabel, personInitial)
//
// A deliberate deviation from a literal line-for-line port (required by the task brief, not a
// bug being introduced silently): sortNamed takes `now` as an injected parameter instead of
// reading `Date.now()` internally, so the 90-day "recent" filter is deterministic in tests.
// Callers in the view layer pass `Date.now()`.
//
// Task 4 (2026-08-19 timeline/people-visibility fix): the confidence dropdown/gate that used
// to live here (Vue2's peopleUnnamedVisible getter / hiddenSingletonCount computed / a third
// predicate unnamedCountAt) has been removed entirely -- a product decision, not a bug fix
// half-measure. A fixed 80%-confidence default silently hid a real 221-photo cluster at
// confidence 0.796 with zero indication to the user. It is replaced by
// splitUnnamedByDistribution below, which decides visibility from the cluster-size
// distribution instead of a confidence score. mergeConfidencePct (the per-cluster percentage
// badge) is unrelated and stays.
//
// Fix round 1: the confidence-minus-confidence-clause helpers visibleUnnamedOf/
// hiddenSingletonCountOf (an intermediate state from the first Task 4 pass) were deleted as
// dead production code once the store switched to splitUnnamedByDistribution exclusively.
//
// Fix round 2 (2026-08-19, product decision): the People page's unnamed grid now shows ONLY
// splitUnnamedByDistribution's `visible` head -- the singleton toggle (and the PeopleFilter
// type/showSingletons field that backed it, which had already lost its confidence-gate sibling
// in the original Task 4 pass and had no consumer left besides this toggle) is gone too, along
// with the fold expander that briefly existed in between. splitUnnamedByDistribution's own
// logic is untouched -- it still computes folded/singletons, callers just don't consume those
// fields anymore.

import { countryFromCoords, type Photo } from './assetToPhoto'

export interface Person {
  id: string | number
  name: string
  confidence: number
  count: number
  favorite: boolean
  relation: string
  coverFaceId: string | number | null
  heroAssetId: string | number | null
  firstSeen: string | null
  lastSeen: string | null
  placesCount: number
}

// Structural mirror of usePersonDetail.ts's PersonPlace interface. Not
// imported from there because usePersonDetail.ts already imports
// toPerson/monthKeyLabel from this file — importing it back here would be
// circular. TypeScript's structural typing means callers can pass
// usePersonDetail's PersonPlace[] into groupPlaces/colorPoints unchanged.
export interface PersonPlace {
  placeName?: string | null
  latitude?: number | null
  longitude?: number | null
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Normalize a raw backend record into a Person with safe defaults.
 *
 * Why normalizing here is safe (matches Vue2's raw-object behavior at the
 * predicate call sites): Vue2's `p.confidence * 100 >= t` evaluates to
 * `NaN >= t` = false when confidence is missing; normalizing to 0 gives
 * `0 >= t` which is also false for every reachable threshold (t is one of
 * [50,60,70,80,90,95], never <= 0). Likewise `(p.count || 0) >= 2` already
 * treats a missing count as 0, same as normalizing count to 0 up front.
 * The two behaviors only diverge at t <= 0, which is unreachable.
 */
export function toPerson(raw: Record<string, unknown>): Person {
  return {
    id: raw.id as string | number,
    name: typeof raw.name === 'string' ? raw.name : '',
    confidence: Number(raw.confidence) || 0,
    count: Number(raw.count) || 0,
    favorite: !!raw.favorite,
    relation: typeof raw.relation === 'string' ? raw.relation : '',
    coverFaceId: (raw.coverFaceId as string | number | null | undefined) ?? null,
    heroAssetId: (raw.heroAssetId as string | number | null | undefined) ?? null,
    firstSeen: typeof raw.firstSeen === 'string' ? raw.firstSeen : null,
    lastSeen: typeof raw.lastSeen === 'string' ? raw.lastSeen : null,
    placesCount: Number(raw.placesCount) || 0,
  }
}

// peopleUtils.js:44-47
export function personInitial(name: unknown): string {
  if (typeof name !== 'string' || !name.trim()) return ''
  return name.trim()[0].toUpperCase()
}

// peopleUtils.js:36-40 (findNamedDuplicate). Finds an already-named person in `list` whose
// name matches `name` (trimmed, case-insensitive). `excludeId` skips a specific person — e.g.
// the one currently being renamed, so renaming to one's own current name (case/whitespace
// aside) isn't flagged as a duplicate. Returns the matching person, or null when there's no
// duplicate. Used by both ClusterActionDialog.vue (naming an unnamed cluster) and
// PhotosPersonDetail.vue (renaming an already-named person) to switch into a "dupconfirm"
// sub-state offering Merge into existing / Name anyway / Cancel.
//
// Iron rule (id comparisons always via String()): Vue2's own `p.id !== excludeId` is a strict
// equality check; here `excludeId` is compared via String() like every other id comparison in
// this codebase (this file's own toPerson/personById callers, ClusterActionDialog.vue's
// sameId, etc.) — no behavior difference in practice, since ids are consistently typed within
// a single backend response.
export function findNamedDuplicate(
  list: Person[], name: string, excludeId?: string | number | null,
): Person | null {
  const target = (name || '').trim().toLowerCase()
  if (!target || !Array.isArray(list)) return null
  return list.find((p) => {
    if (!p) return false
    if (excludeId != null && String(p.id) === String(excludeId)) return false
    return (p.name || '').trim().toLowerCase() === target
  }) ?? null
}

// store/modules/photos.js:333
export function namedOf(people: Person[]): Person[] {
  return people.filter((p) => p.name && p.name.trim() !== '')
}

// store/modules/photos.js:334
export function unnamedOf(people: Person[]): Person[] {
  return people.filter((p) => !p.name || p.name.trim() === '')
}

// Task 4 fix round 1 (2026-08-19): visibleUnnamedOf/hiddenSingletonCountOf (the
// confidence-minus-the-confidence-clause helpers from the original Task 4 pass) were dead
// production code — splitUnnamedByDistribution below is the store's only visibility source
// now, and grep confirmed these two had no consumer left outside their own unit tests.
// Deleted rather than kept around as unused exports.

// Task 4 (2026-08-19 timeline/people-visibility fix): replaces the confidence gate with a
// size-distribution-based split. Product decision, not a bug fix half-measure — a fixed
// confidence threshold (default 80%) silently hid a real 221-photo cluster at confidence
// 0.796 with no indication to the user (see peopleView.test.ts's regression case). Shows the
// smallest top-k clusters (by photo count, descending) whose cumulative count reaches 80% of
// all multi-photo faces, clamped to [12, 60], and never splits a tie (equal counts stay on
// the same side of the cut). Singletons (count < 2) are always carved out separately from
// `visible`/`folded` here, but fix round 2 removed the last consumer that ever showed them
// (the singleton toggle) — `singletons` is still computed and returned below for API
// completeness/future use, it's just not read by the store/view anymore.
export interface UnnamedSplit { visible: Person[]; folded: Person[]; singletons: Person[] }
export function splitUnnamedByDistribution(unnamed: Person[]): UnnamedSplit {
  const MIN_SHOW = 12, MAX_SHOW = 60, COVERAGE = 0.8
  const multi = [...unnamed.filter((p) => p.count >= 2)].sort((a, b) => b.count - a.count)
  const singletons = unnamed.filter((p) => p.count < 2)
  if (multi.length === 0) return { visible: [], folded: [], singletons }
  const total = multi.reduce((s, p) => s + p.count, 0)
  let k = 0, cum = 0
  while (k < multi.length && k < MAX_SHOW && (k < MIN_SHOW || cum / total < COVERAGE)) {
    cum += multi[k].count
    k++
  }
  // Fix round 1: whole-group tie resolution, replacing a naive "extend while the next item
  // ties" loop that was unbounded and silently defeated MAX_SHOW on near-uniform
  // distributions (e.g. 100 clusters all count=5 used to show all 100, folding nothing).
  // A run of equal counts must never be split across the visible/folded boundary, but MIN_SHOW/
  // MAX_SHOW are hard bounds that take priority over that rule when they conflict.
  if (k < multi.length) {
    const c = multi[k - 1].count
    // [hi, lo) = the contiguous run of clusters with count === c straddling the cut at k
    // (multi is sorted descending, so equal-count runs are always contiguous).
    let hi = k - 1
    while (hi > 0 && multi[hi - 1].count === c) hi--
    let lo = k
    while (lo < multi.length && multi[lo].count === c) lo++
    if (k !== lo) { // k === lo means the run already ends exactly at the cut -- nothing to resolve
      if (lo <= MAX_SHOW) k = lo // extend: the whole tie group still fits under the cap
      else if (hi >= MIN_SHOW) k = hi // retract: fold the whole tie group instead
      else k = Math.min(MAX_SHOW, multi.length) // degenerate near-uniform case: bounds win, tie is split as a last resort
    }
  }
  return { visible: multi.slice(0, k), folded: multi.slice(k), singletons }
}

// PhotosPeopleView.vue:493-506 — filteredNamed computed. `now` is injected
// (see file header) instead of reading Date.now() internally.
export function sortNamed(named: Person[], filter: string, sort: string, now: number): Person[] {
  let arr = [...named]
  if (filter === 'family' || filter === 'friend' || filter === 'work') {
    arr = arr.filter((p) => p.relation === filter)
  } else if (filter === 'recent') {
    const cut = now - 90 * 864e5
    arr = arr.filter((p) => p.lastSeen && new Date(p.lastSeen).getTime() >= cut)
  }
  if (sort === 'name') {
    arr = [...arr].sort((a, b) => a.name.localeCompare(b.name))
  } else if (sort === 'recent') {
    arr = [...arr].sort((a, b) => new Date(b.lastSeen || 0).getTime() - new Date(a.lastSeen || 0).getTime())
  } else if (sort === 'oldest') {
    arr = [...arr].sort((a, b) => new Date(a.firstSeen || 0).getTime() - new Date(b.firstSeen || 0).getTime())
  }
  return arr
}

// peopleUtils.js:14-20 (there named monthLabel; renamed monthKeyLabel per
// brief to avoid confusion with the timeline's unrelated month-label helpers
// in assetToPhoto.ts / groupPhotosByMonth.ts, which use abbreviated month
// names for a different purpose — this one is people-detail-page only).
export function monthKeyLabel(key: unknown): string {
  if (typeof key !== 'string' || !key) return ''
  const [y, m] = key.split('-')
  const n = parseInt(m, 10)
  if (!n || n < 1 || n > 12) return key
  return `${MONTH_NAMES[n - 1]} ${y}`
}

// Used by merge-suggestion banner / review dialog / unnamed badge
// (PhotosPeopleView.vue:553, :202, :378 each duplicated this computation).
export function mergeConfidencePct(confidence: unknown): number {
  return Math.round((Number(confidence) || 0) * 100)
}

// Merge-card legibility fix (2026-08-21): English singular/plural suffix helper for photo
// counts ("1 photo" vs "N photos") -- same role and shape as src/ai/util/stagedGroups.ts's own
// pluralWord (that one is AI-area-only and src/ai is a whole separate OSS-stripped tree, so this
// is a sibling copy for the Photos area rather than a cross-domain import). Chinese copy never
// takes a singular/plural marker before the number, so passing {s} to a zh_cn message that
// doesn't reference it is harmless (vue-i18n substitutes the empty string for an unused param).
export function pluralWord(n: number): '' | 's' {
  return n === 1 ? '' : 's'
}

// PhotosPeopleView.vue:551-558 (mergeReason) — pure functions cannot depend on
// i18n, so this returns a translation key + params instead of a finished
// string; the view layer resolves it via $t(key, params).
export function mergeReasonKey(
  s: { confidence?: unknown; intoName?: unknown } | null | undefined,
): { key: string; params: Record<string, unknown> } {
  if (!s) return { key: 'photosPeopleMergeReasonUnnamed', params: { pct: 0 } }
  const pct = mergeConfidencePct(s.confidence)
  if (s.intoName) {
    return { key: 'photosPeopleMergeReasonNamed', params: { pct, name: s.intoName } }
  }
  return { key: 'photosPeopleMergeReasonUnnamed', params: { pct } }
}

// ---------------------------------------------------------------------------
// Person-detail "places" tab (Task 12). Ported from Vue2
// PhotosPersonDetail.vue:446 (PLACE_PALETTE), :537-551 (groupedPlaces),
// :552-570 (coloredPoints).

// Categorical data-visualization palette, NOT a theme skin color: it exists
// so distinct places drawn together on the same mini map / legend / chip
// strip stay visually distinguishable from each other, independent of the
// current light/dark theme (same rationale as a chart's series-color scale).
// 7 colors, cycled by index modulo length — see groupPlaces below. Kept in
// this .ts file (not theme.css) deliberately: color-guard only scans .vue
// <style> blocks and .css files, so per-datum colors that must stay constant
// across themes belong here, not as 7 throwaway theme tokens. Documented as
// an exception in docs/THEMING.md §6.
export const PLACE_PALETTE: readonly string[] = [
  '#6E5BFF', '#FF9AC2', '#5AC8FA', '#FFD60A', '#34C759', '#FF9F0A', '#FF6B5C',
]

export interface PlaceGroup {
  name: string
  count: number
  color: string
}

// PhotosPersonDetail.vue:537-551 (groupedPlaces computed). `unknownLabel` is
// injected by the caller (a resolved i18n string) — this function must stay
// pure and cannot call useI18n() itself.
export function groupPlaces(places: PersonPlace[], unknownLabel: string): PlaceGroup[] {
  const counts: Record<string, number> = {}
  for (const pl of places) {
    // Prefer placeName field; fall back to reverse-geocode; final fallback unknownLabel.
    const name = pl.placeName || countryFromCoords(pl.latitude, pl.longitude) || unknownLabel
    counts[name] = (counts[name] || 0) + 1
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count], idx) => ({
      name,
      count,
      color: PLACE_PALETTE[idx % PLACE_PALETTE.length],
    }))
}

// PhotosPersonDetail.vue:552-570 (coloredPoints computed). `groups` is
// normally the output of groupPlaces(places, unknownLabel) for the same
// places/unknownLabel — passed in separately (not recomputed here) so the
// two stay in lockstep with a single source of truth in the caller.
export function colorPoints(
  places: PersonPlace[],
  groups: PlaceGroup[],
  unknownLabel: string,
): Array<{ latitude: number; longitude: number; color: string }> {
  // Build a name -> color lookup from groups.
  const colorMap: Record<string, string> = {}
  for (const g of groups) colorMap[g.name] = g.color

  return places
    .filter((pl): pl is PersonPlace & { latitude: number; longitude: number } =>
      typeof pl.latitude === 'number' && typeof pl.longitude === 'number')
    .map((pl) => {
      const name = pl.placeName || countryFromCoords(pl.latitude, pl.longitude) || unknownLabel
      return {
        latitude: pl.latitude,
        longitude: pl.longitude,
        color: colorMap[name] || PLACE_PALETTE[0],
      }
    })
}

// ---------------------------------------------------------------------------
// Person-detail "relationships" tab (Task 13). Ported from Vue2
// PhotosPersonDetail.vue:571-585 (nimoRead computed). Pure functions can't
// depend on i18n (same rule as mergeReasonKey above), so this returns a list
// of {key, params} instead of a finished string; the view layer resolves
// each with t(key, params) and joins with a space, matching Vue2's
// `parts.join(' ')`.
//
// `relations` is typed with a minimal structural shape (only `.name` is
// read) rather than importing usePersonDetail.ts's PersonRelation directly —
// same rationale as the PersonPlace comment above: usePersonDetail.ts
// already imports toPerson/monthKeyLabel from this file, so importing back
// would be circular. PersonRelation's `name?: string` is structurally
// compatible, so callers can pass it in unchanged.
interface NimoReadRelation {
  name?: string
}

// Vue2 :573 reads `this.relations[0]` — the first element in whatever order
// the caller passed in, NOT `sortedRelations[0]` (the count-sorted list used
// by the co-appearance list, :530-532). This is a deliberate one-line
// deviation risk if ported carelessly (brief flags it explicitly), so it's
// called out here at the read site too, not just in the caller.
export function nimoReadParts(
  personName: string,
  relations: NimoReadRelation[],
  places: PlaceGroup[],
): Array<{ key: string; params: Record<string, unknown> }> {
  const parts: Array<{ key: string; params: Record<string, unknown> }> = []

  const top = relations[0]
  if (top && top.name) parts.push({ key: 'photosPersonInsightWith', params: { name: personName, other: top.name } })
  else if (top) parts.push({ key: 'photosPersonInsightWithUnnamed', params: { name: personName } })

  if (places[0] && places[1]) {
    parts.push({ key: 'photosPersonInsightPlaces2', params: { place1: places[0].name, place2: places[1].name } })
  } else if (places[0]) {
    parts.push({ key: 'photosPersonInsightPlace1', params: { place: places[0].name } })
  }

  if (parts.length === 0) return [{ key: 'photosPersonInsightNone', params: { name: personName } }]
  return parts
}

// ---------------------------------------------------------------------------
// Favorites hero-stats three cards (Task 15A, SP7-P5). Ported from Vue2
// PhotosFavoritesView.vue:369-385 (byPersonAll/byPlaceAll/byYearAll computed).
//
// The three cards' sort/slice rules genuinely differ (count-desc / count-desc /
// year-string-desc — NOT count), so they are kept as three separate exported
// functions rather than one generic `countBy(items, pick)` — unifying them
// behind a single guard-and-sort abstraction would either have to silently
// homogenize Vue2's per-card falsy-guard differences (faces are pushed
// unguarded per Vue2 :371; place/year skip falsy values per Vue2 :376/:383) or
// carry that distinction as a parameter, which reads less clearly than three
// short named functions. They do share one private counter increment helper
// so the "count" half of the logic isn't triplicated.
function bump(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] || 0) + 1
}

// PhotosFavoritesView.vue:369-372 (byPersonAll) — Photo.faces is typed
// unknown[] (assetToPhoto.ts:311) but is always a string[] of person names on
// the wire (only populated by the favorites-list endpoint); String(f) mirrors
// Vue2 using the raw array element as an object key (JS coerces to string
// implicitly there too). Sorted by count desc.
export function topPersons(photos: Photo[]): Array<[string, number]> {
  const counts: Record<string, number> = {}
  for (const p of photos) {
    const faces = Array.isArray(p.faces) ? p.faces : []
    for (const f of faces) bump(counts, String(f))
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}

// PhotosFavoritesView.vue:373-377 (byPlaceAll) — falsy `place` skipped
// (Vue2 `if (p.place)`). Sorted by count desc.
export function topPlaces(photos: Photo[]): Array<[string, number]> {
  const counts: Record<string, number> = {}
  for (const p of photos) {
    if (p.place) bump(counts, p.place)
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}

// PhotosFavoritesView.vue:378-385 (byYearAll) — empty year skipped (Vue2
// `if (y)`). Sorted by year string **descending** (`b[0].localeCompare(a[0])`)
// — deliberately NOT by count; brief flags this as the easy-to-get-wrong spot.
// String(...) guards the (rare, per Photo['takenAt'] typing) numeric-epoch
// case — Vue2's raw `.slice(0, 4)` would throw on a number, so this is a
// strictly-safer superset of Vue2's behavior for string inputs, not a
// behavior change for the string values the backend actually sends.
export function byYear(photos: Photo[]): Array<[string, number]> {
  const counts: Record<string, number> = {}
  for (const p of photos) {
    const y = String(p.takenAt || '').slice(0, 4)
    if (y) bump(counts, y)
  }
  return Object.entries(counts).sort((a, b) => b[0].localeCompare(a[0]))
}

// ---------------------------------------------------------------------------
// Lightbox face-chip real-avatar resolution (Task 15B, SP7-P5). See
// task-15-brief.md's "prerequisite fact correction": Photo.faces is a bare person-name
// string[] (no personId), populated only by the favorites-list endpoint, and
// there is no asset-scoped face-thumbnail endpoint — only the person-scoped
// one. This is the best achievable mapping without a backend change: resolve
// a face name back to a Person by exact name match, but only when the match
// is unambiguous.
//
// name.trim() on both sides, case-sensitive exact comparison (no fuzzy
// matching — matches Vue2's naming semantics). A count of matches !== 1
// (zero, i.e. no match, OR more than one, i.e. two people share a name)
// returns null: better to fall back to the initial-letter placeholder than
// to show a stranger's face.
export function resolvePersonByName(people: Person[], name: string): Person | null {
  const target = name.trim()
  const matches = people.filter((p) => p.name.trim() === target)
  return matches.length === 1 ? matches[0] : null
}
