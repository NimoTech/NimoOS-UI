// Bucketed timeline data layer: splits one huge /timeline response
// into a cheap month directory plus per-month asset pages, so these helpers own
// the two things that must not drift: the month key/title (shared with the
// legacy path) and the cache-invalidation rule for a refreshed directory.
import { groupToMonth, type Month, type Photo } from './assetToPhoto'

export interface BucketMeta {
  year: number
  month: number
  count: number
  videoCount: number
  // Number of assets in this month matching the OCR/document criterion
  // (backend field `ocrCount`). Added alongside `count`/`videoCount` so the
  // photo/video/ocr tab split can be sized entirely from directory metadata —
  // see `tabCountOf` below.
  ocrCount: number
}

// Key and title are delegated to groupToMonth on purpose. The legacy /timeline
// path builds its months there; if the two paths disagreed on a key, jump-to-
// month anchors (id="m-<key>"), activeMonth tracking and the scrubber would all
// behave differently depending on which backend answered. Its MONTH_NAMES table
// is module-private (and already duplicated three times in this codebase) — call
// it instead of copying a fourth table.
export function bucketKey(b: { year: number; month: number }): string {
  return groupToMonth({ year: b.year, month: b.month }).key
}

// Inverse of bucketKey. Returns a zero PAIR for the unknown bucket: the backend
// rejects a half-zero key (year=0 with month!=0, or the reverse) with 400.
export function parseBucketKey(key: string): { year: number; month: number } | null {
  if (key === 'unknown') return { year: 0, month: 0 }
  const m = /^(\d{1,4})-(\d{2})$/.exec(key)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12) return null
  return { year, month }
}

function intOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : fallback
}

// The directory body is a bare array. Order is the backend's (year desc, month
// desc, unknown last) and is preserved verbatim — the grid renders in this order.
export function normalizeBuckets(raw: unknown): BucketMeta[] {
  if (!Array.isArray(raw)) return []
  const out: BucketMeta[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    if (typeof r.year !== 'number' || typeof r.month !== 'number') continue
    out.push({
      year: Math.trunc(r.year),
      month: Math.trunc(r.month),
      count: intOr(r.count, 0),
      videoCount: intOr(r.videoCount, 0),
      // Deployment-order decoupling: the backend counterpart for `ocrCount` may
      // not be deployed yet, so a missing/non-numeric field must default to 0
      // rather than throw or produce NaN (see timelineBuckets.test.ts).
      ocrCount: intOr(r.ocrCount, 0),
    })
  }
  return out
}

// Per-tab expected item count derived from bucket directory metadata.
// Must agree with matchesTab() in tabFilter.ts: 'all' shows everything,
// 'video' shows videos, 'ocr' shows OCR/document assets, and the default
// photo tab shows what is neither video nor OCR.
export function tabCountOf(m: { count: number; videoCount: number; ocrCount: number }, tab: string): number {
  return tab === 'all' ? m.count
    : tab === 'video' ? m.videoCount
      : tab === 'ocr' ? m.ocrCount
        : Math.max(0, m.count - m.videoCount - m.ocrCount)
}

// `photos === null` means "not fetched yet" and `[]` means "fetched, and this
// month really is empty". Collapsing the two would make the grid re-request an
// empty bucket on every scroll pass.
export function bucketToMonth(b: BucketMeta, photos: Photo[] | null): Month {
  const base = groupToMonth({ year: b.year, month: b.month })
  return {
    ...base,
    photos: photos ?? [],
    loaded: photos !== null,
    count: b.count,
    videoCount: b.videoCount,
    ocrCount: b.ocrCount,
  }
}

// Which cached buckets a refreshed directory invalidates. Only loaded buckets can
// be stale, and only a changed count (total, video, or ocr) or a vanished bucket
// counts as stale — an unchanged bucket must be left byte-identical so a refresh
// during indexing does not make the grid flash. ocrCount is checked alongside
// videoCount because tabCountOf's photo-tab estimate subtracts both: an
// ocrCount-only move is just as real a staleness signal as a videoCount-only one.
export function staleBucketKeys(
  prev: BucketMeta[],
  next: BucketMeta[],
  loadedKeys: Iterable<string>,
): string[] {
  const byKey = new Map(next.map((b) => [bucketKey(b), b]))
  const prevByKey = new Map(prev.map((b) => [bucketKey(b), b]))
  const stale: string[] = []
  for (const key of loadedKeys) {
    const after = byKey.get(key)
    if (!after) { stale.push(key); continue }
    const before = prevByKey.get(key)
    if (!before) continue
    if (
      before.count !== after.count
      || before.videoCount !== after.videoCount
      || before.ocrCount !== after.ocrCount
    ) stale.push(key)
  }
  return stale
}
