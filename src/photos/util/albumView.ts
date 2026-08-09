// Ported (logic verbatim except three noted deviations) from Vue2 NimoOS-UI
// src/views/Photos/PhotosAlbumsView.vue:216-224 (userAlbums), :282-301
// (parseYearMonth + formatAlbumSpan), :359-370 (applySort), and
// src/views/Photos/PhotosAlbumDetail.vue:224-242 (photos computed sort).
//
// SP15-P2b: sortAlbums was removed here -- the Albums page now renders a mixed
// manual/smart list and sorts it through util/mixedAlbums.ts, which is the single
// remaining comparator implementation. albumToView / formatAlbumSpan / sortAlbumPhotos
// are unaffected and still have callers.
import type { Photo } from './assetToPhoto'

export interface AlbumView {
  id: string | number
  title: string
  cover: string | number | null // = coverAssetId, an asset id, not a URL
  count: number
  dateRange: string
  createdAt: string | null
  videoCount: number // P2b: the detail sidebar's Videos cell
  dateStart: string | null // P2b: raw taken_at of the earliest member; drives the 'date' sort
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
// and plus videoCount / dateStart (see the AlbumView doc comment above).
// SP15-P2b final fix wave: the P4-era `dateEnd` field is gone. Its only consumer was
// sortAlbums('date'), deleted this phase in favour of util/mixedAlbums.ts (which reads
// dateStart, matching Vue2's dateTakenMs). `a.dateEnd` is still read below -- but straight off
// the raw backend record, to render the span; nothing needed it on the view object.
export function albumToView(a: Record<string, unknown>, untitled: string): AlbumView {
  const assets = a.assets as unknown[] | undefined
  const assetCount = a.assetCount as number | null | undefined
  return {
    id: a.id as string | number,
    title: (a.name as string) || (a.title as string) || untitled,
    // `||` (not `??`) — matches Vue2 PhotosAlbumsView.vue:219 exactly; an
    // empty-string coverAssetId falls through to null, same as Vue2.
    cover: (a.coverAssetId as string | number | undefined) || null,
    count: assetCount != null ? assetCount : ((assets && assets.length) || 0),
    dateRange: formatAlbumSpan(a.dateStart, a.dateEnd),
    createdAt: (a.createdAt as string | undefined) || null,
    videoCount: Number(a.videoCount ?? 0),
    dateStart: (a.dateStart as string | undefined) || null,
  }
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
