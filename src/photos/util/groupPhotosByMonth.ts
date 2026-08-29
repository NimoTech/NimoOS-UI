// Groups a flat Photo[] (e.g. the Favorites list, which the backend returns
// as a flat array rather than pre-bucketed {year,month} groups like the
// timeline endpoint) into Month[] buckets by `takenAt`'s YYYY-MM, newest
// month first. Missing/invalid takenAt falls into an 'unknown' bucket sorted
// last. Title format and MONTH_NAMES values are kept in sync with
// `groupToMonth` in ./assetToPhoto.ts (not reused directly: groupToMonth
// re-runs assetToPhoto over `assets`, which we don't want here — input is
// already Photo[]).
import type { Photo, Month } from './assetToPhoto'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export function groupPhotosByMonth(photos: Photo[]): Month[] {
  const buckets = new Map<string, Photo[]>()
  for (const p of photos) {
    const t = p.takenAt
    const d = t != null ? new Date(t) : null
    const valid = d != null && !Number.isNaN(d.getTime())
    const key = valid ? `${d!.getFullYear()}-${String(d!.getMonth() + 1).padStart(2, '0')}` : 'unknown'
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(p)
  }
  const keys = [...buckets.keys()].sort((a, b) => {
    if (a === 'unknown') return 1
    if (b === 'unknown') return -1
    return a < b ? 1 : a > b ? -1 : 0 // descending
  })
  return keys.map((key) => {
    let title = 'Unknown Date'
    if (key !== 'unknown') {
      const [y, m] = key.split('-')
      title = `${MONTH_NAMES[Number(m) - 1]} ${y}`
    }
    return { key, title, loc: '', photos: buckets.get(key)! }
  })
}

// Acceptance Fix-1 (owner finding, Plans G+H): mirrors Vue2 PhotosFavoritesView.vue's own
// monthKey (:454-456) + grouped (:375-390) computed pair -- NOT reused from
// groupPhotosByMonth above, which the Favorites view's shared-grid architecture already
// pulled in for a different purpose (see usePersonDetail.ts's own "don't reuse
// groupPhotosByMonth" precedent for the same underlying reason). Two deliberate
// differences from groupPhotosByMonth:
//  1. monthKey is a raw string slice of takenAt (`takenAt.slice(0,7)`), never a
//     `new Date(t)` local-timezone parse -- Vue2 :454-456 never parses a Date at all,
//     and the timezone-parse would disagree with the string-sliced hero year-span /
//     stat-card computeds this view already keeps string-based for the same reason
//     (see peopleView.ts's byYear comment).
//  2. Group ORDER follows first-appearance order in the (already sorted) `photos`
//     argument, not a re-sort by key string -- Vue2's grouped computed builds a Map by
//     iterating `sorted` and takes its insertion order, so when `sorted` runs
//     oldest-first (the "Oldest" sort toggle), the group list itself also runs
//     oldest-month-first, not just each month's internal tile order. Passing an
//     unsorted array here would silently drop this behavior.
// 'unknown' is still always pushed to the very end (Vue2 :385-388), regardless of the
// sort direction the caller used to produce `photos`.
export function groupFavoritesByMonthOrdered(photos: Photo[]): Month[] {
  const map = new Map<string, Photo[]>()
  for (const p of photos) {
    const raw = typeof p.takenAt === 'string' ? p.takenAt : (p.takenAt != null ? String(p.takenAt) : '')
    const key = raw ? raw.slice(0, 7) : 'unknown'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(p)
  }
  const entries = [...map.entries()]
  const idx = entries.findIndex(([key]) => key === 'unknown')
  if (idx >= 0 && idx < entries.length - 1) {
    entries.push(entries.splice(idx, 1)[0])
  }
  return entries.map(([key, ps]) => {
    let title = 'Unknown Date'
    if (key !== 'unknown') {
      const [y, m] = key.split('-')
      title = `${MONTH_NAMES[Number(m) - 1]} ${y}`
    }
    return { key, title, loc: '', photos: ps }
  })
}
