// SP15-P2b: the Albums page shows manual albums and smart albums in one grid, ranked
// against each other by a single sort control. Ported from Vue2
// 939a7d3a:PhotosAlbumsView.vue:381-393 (smartAlbums / mixedAlbums) and :670-700
// (applySort).
//
// This lives in a pure module rather than in the view for one reason: the comparators
// have to read a different field per kind and treat a missing timestamp specially, and
// that is exactly the kind of branch where a component-level test passes for the wrong
// reason (the same trap momentLayout.ts was pulled out for in P1).
//
// Deviation from Vue2, registered: its `applySort` sorts in place and returns the same
// array. Here it returns a new one, matching the convention the rest of this directory
// already follows.
//
// Supersedes albumView.sortAlbums, which was deleted in the same commit: once the page
// renders a mixed list there is no caller left for an AlbumView-only comparator, and
// keeping both would mean two copies of the same comparators drifting apart.
import type { AlbumView } from './albumView'
import type { SmartView } from '../stores/smartViews'

export type MixedSortId = 'created' | 'name' | 'name-r' | 'count' | 'date'

export type MixedAlbumItem =
  | { kind: 'user'; id: string | number; view: AlbumView }
  | { kind: 'smart'; id: string; sv: SmartView }

// Vue2 :392 concatenates smart then user and lets the sort decide the final order; the
// same here. The pre-sort order is only observable through the 'unknown sort id' path.
export function buildMixedAlbums(views: AlbumView[], svs: SmartView[]): MixedAlbumItem[] {
  return [
    ...svs.map((sv): MixedAlbumItem => ({ kind: 'smart', id: sv.id, sv })),
    ...views.map((view): MixedAlbumItem => ({ kind: 'user', id: view.id, view })),
  ]
}

function titleOf(item: MixedAlbumItem): string {
  return item.kind === 'smart' ? item.sv.name : item.view.title
}

function countOf(item: MixedAlbumItem): number {
  return item.kind === 'smart' ? item.sv.count : item.view.count
}

// null means "no usable timestamp". Kept distinct from 0 on purpose -- see byMsDesc.
function msOf(raw: string | null | undefined): number | null {
  if (!raw) return null
  const t = Date.parse(raw)
  return isNaN(t) ? null : t
}

function createdMs(item: MixedAlbumItem): number | null {
  return msOf(item.kind === 'smart' ? item.sv.createdAt : item.view.createdAt)
}

// Vue2 :679-685. A manual album's 'date taken' is the taken_at of its earliest member;
// a smart album has no equivalent aggregate on the wire, so it falls back to createdAt.
// That fallback is a documented degradation, not a bug to fix here.
function dateTakenMs(item: MixedAlbumItem): number | null {
  if (item.kind === 'user') return msOf(item.view.dateStart)
  return createdMs(item)
}

// Vue2 :686-693, including the reason its comment gives: a missing timestamp sorts
// FIRST. Coercing it to 0 would send it to the very end instead, which is the opposite
// of the intent -- an album whose creation time cannot be compared should not be
// presented as the oldest thing in the library.
function byMsDesc(get: (i: MixedAlbumItem) => number | null) {
  return (a: MixedAlbumItem, b: MixedAlbumItem): number => {
    const av = get(a)
    const bv = get(b)
    if (av === null && bv === null) return 0
    if (av === null) return -1
    if (bv === null) return 1
    return bv - av
  }
}

export function sortMixed(items: MixedAlbumItem[], sort: MixedSortId | string): MixedAlbumItem[] {
  const arr = [...items]
  if (sort === 'name') arr.sort((a, b) => titleOf(a).localeCompare(titleOf(b)))
  else if (sort === 'name-r') arr.sort((a, b) => titleOf(b).localeCompare(titleOf(a)))
  else if (sort === 'count') arr.sort((a, b) => countOf(b) - countOf(a))
  else if (sort === 'date') arr.sort(byMsDesc(dateTakenMs))
  else if (sort === 'created') arr.sort(byMsDesc(createdMs))
  return arr
}
