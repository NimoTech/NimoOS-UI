// Ported (logic verbatim except three noted deviations) from Vue2 NimoOS-UI
// src/views/Photos/PhotosAlbumsView.vue:216-224 (userAlbums), :282-301
// (parseYearMonth + formatAlbumSpan), :359-370 (applySort), and
// src/views/Photos/PhotosAlbumDetail.vue:224-242 (photos computed sort).
import type { Photo } from './assetToPhoto'

export interface AlbumView {
  id: string | number
  title: string
  cover: string | number | null // = coverAssetId, an asset id, not a URL
  count: number
  dateRange: string
  createdAt: string | null
  dateEnd: string | null // P4 addition (not present on the Vue2 view object) for sortAlbums('date')
}

// Extract {year, month(1-12)} from a raw taken_at string ('2025-06-03',
// '2025-06-03 12:00:00', RFC3339, …) without relying on Date parsing.
// Verbatim port of PhotosAlbumsView.vue:284-288 (parseYearMonth).
function parseYearMonth(s: unknown): { year: number; month: number } | null {
  const m = String(s || '').match(/^(\d{4})-(\d{2})/)
  if (!m) return null
  return { year: Number(m[1]), month: Number(m[2]) }
}

// Render the album's taken_at span:
//   same month        -> 'May 2026'
//   same year, spread  -> 'Jun - Dec 2025'
//   spans years        -> '2023-2025'
// Verbatim port of PhotosAlbumsView.vue:293-301. Note: MONTHS here is the
// three-letter abbreviation table local to this function — distinct from the
// full-name MONTH_NAMES in assetToPhoto.ts / groupPhotosByMonth.ts.
export function formatAlbumSpan(startRaw: unknown, endRaw: unknown): string {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const a = parseYearMonth(startRaw)
  const b = parseYearMonth(endRaw)
  if (!a || !b) return ''
  if (a.year !== b.year) return `${a.year}-${b.year}`
  if (a.month === b.month) return `${MONTHS[a.month - 1]} ${a.year}`
  return `${MONTHS[a.month - 1]} - ${MONTHS[b.month - 1]} ${a.year}`
}

// Verbatim port of PhotosAlbumsView.vue:216-224 (userAlbums computed), minus
// the `kind: 'user'` field (shared-album section is out of scope, see brief)
// and plus `dateEnd` (see AlbumView doc comment above).
export function albumToView(a: Record<string, unknown>, untitled: string): AlbumView {
  const assets = a.assets as unknown[] | undefined
  const assetCount = a.assetCount as number | null | undefined
  const dateEnd = a.dateEnd as string | undefined
  return {
    id: a.id as string | number,
    title: (a.name as string) || (a.title as string) || untitled,
    // `||` (not `??`) — matches Vue2 PhotosAlbumsView.vue:219 exactly; an
    // empty-string coverAssetId falls through to null, same as Vue2.
    cover: (a.coverAssetId as string | number | undefined) || null,
    count: assetCount != null ? assetCount : ((assets && assets.length) || 0),
    dateRange: formatAlbumSpan(a.dateStart, a.dateEnd),
    createdAt: (a.createdAt as string | undefined) || null,
    dateEnd: dateEnd || null,
  }
}

// Verbatim port of PhotosAlbumsView.vue:359-370 (applySort), with three
// deliberate deviations from Vue2 (each noted below):
export function sortAlbums(list: AlbumView[], sort: string): AlbumView[] {
  const arr = [...list] // deviation: return a new array instead of Vue2's in-place arr.sort()
  // Verbatim port of Vue2's `ts` helper, parameterized by field (see the
  // 'date' deviation note below for why).
  const ts = (a: AlbumView, field: 'createdAt' | 'dateEnd') => {
    const raw = a[field]
    const t = raw ? Date.parse(raw) : NaN
    return isNaN(t) ? 0 : t
  }
  if (sort === 'name') arr.sort((a, b) => a.title.localeCompare(b.title))
  else if (sort === 'name-r') arr.sort((a, b) => b.title.localeCompare(a.title))
  else if (sort === 'count') arr.sort((a, b) => b.count - a.count)
  // deviation: Vue2's sortOptions lists a 'created' entry but applySort never
  // handles it (falls through, unsorted) — bug not reproduced; implemented
  // here using the same ts() pattern as the other date-based branches.
  else if (sort === 'created') arr.sort((a, b) => ts(b, 'createdAt') - ts(a, 'createdAt'))
  // deviation: Vue2's 'date' branch also reads a.createdAt via ts() (the Vue2
  // view object has no separate taken-date field); here it reads dateEnd
  // instead, since that's the field 'date' is meant to represent.
  else if (sort === 'date') arr.sort((a, b) => ts(b, 'dateEnd') - ts(a, 'dateEnd'))
  return arr
}

// Verbatim port of PhotosAlbumDetail.vue:224-242 (photos computed).
export function sortAlbumPhotos(photos: Photo[], sortBy: string): Photo[] {
  if (sortBy === 'taken') {
    return [...photos].sort((a, b) => {
      const ta = a.takenAt ? Date.parse(a.takenAt as string) : 0
      const tb = b.takenAt ? Date.parse(b.takenAt as string) : 0
      return tb - ta
    })
  }
  if (sortBy === 'added') {
    return [...photos].sort((a, b) => {
      const ta = a.indexedAt ? Date.parse(a.indexedAt as string) : 0
      const tb = b.indexedAt ? Date.parse(b.indexedAt as string) : 0
      return tb - ta
    })
  }
  return [...photos] // manual
}
