// Search result sorting + the "best match / more results" two-tier split. Ported from Vue2
// the Vue 2 panel's src/views/Photos/PhotosSearchView.vue:374-391 (sortedResults), :397-404
// (bestTierResults/moreTierResults), :675-678 (matchPct),
// src/store/modules/photos.js:32-33 (searchStateMatchesQuery).

import type { Photo } from './assetToPhoto'

export type SortKey = 'relevance' | 'newest' | 'oldest'

export interface ScoredPhoto {
  p: Photo
  score: number | null
}

// Comparator for sorting by capture time. Vue2→Vue3 iron rule: "compare by id" always means
// String(a) === String(b) — Photo.id's type is string | number, and comparing mixed types
// directly with > gives counter-intuitive results (plus a risk of unstable tie-break ordering
// across types), so always convert to String before comparing.
function byTakenAt(desc: boolean) {
  return (a: ScoredPhoto, b: ScoredPhoto): number => {
    const ta = a.p.takenAt
    const tb = b.p.takenAt
    // Both null → compare by id, to keep the sort stable.
    if (ta == null && tb == null) return String(a.p.id) > String(b.p.id) ? 1 : -1
    // One null → always sorts to the end, regardless of direction (copies Vue2 behavior).
    if (ta == null) return 1
    if (tb == null) return -1
    if (ta === tb) return String(a.p.id) > String(b.p.id) ? 1 : -1
    return (ta > tb ? 1 : -1) * (desc ? -1 : 1)
  }
}

export function sortResults(rows: ScoredPhoto[], sort: SortKey): ScoredPhoto[] {
  // Must copy before sorting, never mutate in place — the caller (store/component) may still
  // hold a reference to the original array for other purposes (e.g. upstream of filteredResults).
  const arr = [...rows]
  if (sort === 'relevance') arr.sort((a, b) => (b.score || 0) - (a.score || 0))
  else if (sort === 'newest') arr.sort(byTakenAt(true))
  else arr.sort(byTakenAt(false))
  return arr
}

// Search result tiering (spec §4): the "best match vs long tail" split only makes sense for
// relevance sort; newest/oldest sort by time, aren't tiered, and all fall into best.
export function splitTiers(sorted: ScoredPhoto[], sort: SortKey): { best: ScoredPhoto[]; more: ScoredPhoto[] } {
  if (sort !== 'relevance') return { best: sorted, more: [] }
  return {
    best: sorted.filter(r => !r.p.belowCut),
    more: sorted.filter(r => r.p.belowCut),
  }
}

// The backend has already recalibrated the display score to [0,1] (OCR exact match is pinned
// at 1.0); this only clamps and converts to a percentage, no further client-side rescaling.
export function matchPct(score: number | null | undefined): number | null {
  if (score == null) return null
  return Math.round(Math.max(0, Math.min(1, score)) * 100)
}

// Whether the search results already committed in the current store belong to the given query.
// The search view uses this to decide whether to render the result set or the in-flight empty
// state, eliminating the flash of two result sets during the window where the route's q is
// already the new term but the store still has the old term/timeline fallback. Ported verbatim
// from photos.js:32-33.
export function searchStateMatchesQuery(state: { isSearchMode: boolean; searchQuery: string }, query: string): boolean {
  return !!state.isSearchMode && state.searchQuery === (query || '').trim()
}
