// People-view pure functions: normalization + named/unnamed partition +
// confidence/singleton filter predicates + sort. Ported from Vue2:
//   store/modules/photos.js:333-344 (peopleNamed/peopleUnnamed/peopleUnnamedVisible)
//   views/Photos/PhotosPeopleView.vue:493-516,551-558,581-584
//     (filteredNamed sort/filter, hiddenSingletonCount, mergeReason, unnamedCountAt)
//   views/Photos/peopleUtils.js:5-8,14-20,44-47 (MONTH_NAMES, monthLabel, personInitial)
//
// Two deliberate deviations from a literal line-for-line port (both required by
// the task brief, not bugs being introduced silently):
//  1. sortNamed takes `now` as an injected parameter instead of reading
//     `Date.now()` internally, so the 90-day "recent" filter is deterministic
//     in tests. Callers in the view layer pass `Date.now()`.
//  2. The three duplicated confidence/singleton predicates in Vue2
//     (peopleUnnamedVisible getter, hiddenSingletonCount computed,
//     unnamedCountAt method) are unified here into visibleUnnamedOf /
//     hiddenSingletonCountOf / unnamedCountAt, sharing the same comparison
//     logic instead of being copy-pasted three times.

import { countryFromCoords } from './assetToPhoto'

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

export interface PeopleFilter {
  confidence: number
  showSingletons: boolean
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

// store/modules/photos.js:333
export function namedOf(people: Person[]): Person[] {
  return people.filter((p) => p.name && p.name.trim() !== '')
}

// store/modules/photos.js:334
export function unnamedOf(people: Person[]): Person[] {
  return people.filter((p) => !p.name || p.name.trim() === '')
}

// store/modules/photos.js:337-340
export function visibleUnnamedOf(unnamed: Person[], f: PeopleFilter): Person[] {
  return unnamed.filter(
    (p) => p.confidence * 100 >= f.confidence && (f.showSingletons || p.count >= 2),
  )
}

// PhotosPeopleView.vue:510-516
export function hiddenSingletonCountOf(unnamed: Person[], f: PeopleFilter): number {
  if (f.showSingletons) return 0
  return unnamed.filter((p) => p.confidence * 100 >= f.confidence && p.count < 2).length
}

// PhotosPeopleView.vue:581-584 — preview count for a given confidence dropdown
// option; singleton handling uses the *current* showSingletons toggle value,
// not a simulated toggle at the previewed confidence.
export function unnamedCountAt(unnamed: Person[], confidence: number, showSingletons: boolean): number {
  return unnamed.filter(
    (u) => u.confidence * 100 >= confidence && (showSingletons || u.count >= 2),
  ).length
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
