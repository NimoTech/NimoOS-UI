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
