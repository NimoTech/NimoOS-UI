## Task 2: `timelineBuckets.ts` 纯函数

**Files:**
- Create: `src/photos/util/timelineBuckets.ts`
- Test: `src/photos/util/__tests__/timelineBuckets.test.ts`

**Interfaces:**
- Consumes: `groupToMonth` from `src/photos/util/assetToPhoto.ts:415`（**必须复用**，见下）
- Produces:
  - `interface BucketMeta { year: number; month: number; count: number; videoCount: number }`
  - `bucketKey(b: { year: number; month: number }): string`
  - `parseBucketKey(key: string): { year: number; month: number } | null`
  - `normalizeBuckets(raw: unknown): BucketMeta[]`
  - `bucketToMonth(b: BucketMeta, photos: Photo[] | null): Month`
  - `staleBucketKeys(prev: BucketMeta[], next: BucketMeta[], loadedKeys: Iterable<string>): string[]`

**为什么 key/title 必须借道 `groupToMonth`**：回退模式的月份由 `groupToMonth` 生成，
分桶模式由本模块生成。两者的 `key` 一旦不一致，跳月锚点（`m-<key>`）、`activeMonth` 追踪、
刻度尺在两种模式下就会行为不同。`groupToMonth` 里的 `MONTH_NAMES` 是模块私有的（同一份数组
在本仓已被复制三份），所以**不要**再抄第四份 —— 直接调它。

- [ ] **Step 1: 写失败测试**

```ts
// src/photos/util/__tests__/timelineBuckets.test.ts
import { describe, it, expect } from 'vitest'
import { bucketKey, parseBucketKey, normalizeBuckets, bucketToMonth, staleBucketKeys } from '../timelineBuckets'
import { groupToMonth, assetToPhoto } from '../assetToPhoto'

const B = (year: number, month: number, count = 1, videoCount = 0) => ({ year, month, count, videoCount })

describe('bucketKey / parseBucketKey', () => {
  it('matches groupToMonth byte for byte, including the unknown bucket', () => {
    expect(bucketKey(B(2026, 8))).toBe(groupToMonth({ year: 2026, month: 8 }).key)
    expect(bucketKey(B(2026, 8))).toBe('2026-08')
    expect(bucketKey(B(0, 0))).toBe(groupToMonth({ year: 0, month: 0 }).key)
    expect(bucketKey(B(0, 0))).toBe('unknown')
  })
  it('round-trips a month key', () => {
    expect(parseBucketKey('2026-08')).toEqual({ year: 2026, month: 8 })
  })
  it('parses the unknown key to a zero PAIR, never a half-zero key', () => {
    // The backend answers 400 when only one of year/month is zero.
    expect(parseBucketKey('unknown')).toEqual({ year: 0, month: 0 })
  })
  it('rejects junk keys instead of producing NaN', () => {
    expect(parseBucketKey('search')).toBeNull()
    expect(parseBucketKey('')).toBeNull()
    expect(parseBucketKey('2026-13')).toBeNull()
  })
})

describe('normalizeBuckets', () => {
  it('keeps backend order and coerces missing counts to 0', () => {
    const out = normalizeBuckets([{ year: 2026, month: 8, count: 3 }, { year: 2026, month: 7, count: 1, videoCount: 1 }])
    expect(out).toEqual([B(2026, 8, 3, 0), B(2026, 7, 1, 1)])
  })
  it('tolerates a null body and non-array junk', () => {
    expect(normalizeBuckets(null)).toEqual([])
    expect(normalizeBuckets({ buckets: [] })).toEqual([])
  })
  it('drops entries with no usable year/month', () => {
    expect(normalizeBuckets([{ count: 5 }, { year: 'x', month: 2, count: 1 }])).toEqual([])
  })
})

describe('bucketToMonth', () => {
  it('marks a bucket with no photos as not loaded and carries the counts', () => {
    const m = bucketToMonth(B(2026, 8, 12, 3), null)
    expect(m).toMatchObject({ key: '2026-08', title: 'August 2026', loc: '', photos: [], loaded: false, count: 12, videoCount: 3 })
  })
  it('marks an empty-but-fetched bucket as loaded', () => {
    // A bucket whose assets came back as [] is loaded, not pending — otherwise
    // the grid would keep requesting it forever.
    expect(bucketToMonth(B(2026, 8, 0, 0), []).loaded).toBe(true)
  })
  it('passes photos through untouched', () => {
    const p = assetToPhoto({ id: 'a1', mimeType: 'image/jpeg' })
    expect(bucketToMonth(B(2026, 8, 1, 0), [p]).photos).toEqual([p])
  })
})

describe('staleBucketKeys', () => {
  it('invalidates a loaded bucket whose count changed', () => {
    expect(staleBucketKeys([B(2026, 8, 3)], [B(2026, 8, 4)], ['2026-08'])).toEqual(['2026-08'])
  })
  it('invalidates a loaded bucket that vanished', () => {
    expect(staleBucketKeys([B(2026, 8, 3)], [], ['2026-08'])).toEqual(['2026-08'])
  })
  it('leaves an unchanged bucket alone so the grid never flashes', () => {
    expect(staleBucketKeys([B(2026, 8, 3)], [B(2026, 8, 3)], ['2026-08'])).toEqual([])
  })
  it('invalidates on a videoCount-only change (the photo tab estimates from it)', () => {
    expect(staleBucketKeys([B(2026, 8, 3, 0)], [B(2026, 8, 3, 1)], ['2026-08'])).toEqual(['2026-08'])
  })
  it('ignores buckets that were never loaded', () => {
    expect(staleBucketKeys([B(2026, 8, 3)], [B(2026, 8, 9)], [])).toEqual([])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/photos/util/__tests__/timelineBuckets.test.ts`
Expected: FAIL —— `Failed to resolve import "../timelineBuckets"`。

- [ ] **Step 3: 实现**

```ts
// src/photos/util/timelineBuckets.ts
// SP15-P3 data layer. The bucketed timeline splits one huge /timeline response
// into a cheap month directory plus per-month asset pages, so these helpers own
// the two things that must not drift: the month key/title (shared with the
// legacy path) and the cache-invalidation rule for a refreshed directory.
import { groupToMonth, type Month, type Photo } from './assetToPhoto'

export interface BucketMeta {
  year: number
  month: number
  count: number
  videoCount: number
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
    })
  }
  return out
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
  }
}

// Which cached buckets a refreshed directory invalidates. Only loaded buckets can
// be stale, and only a changed count (either total or video) or a vanished bucket
// counts as stale — an unchanged bucket must be left byte-identical so a refresh
// during indexing does not make the grid flash.
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
    if (before.count !== after.count || before.videoCount !== after.videoCount) stale.push(key)
  }
  return stale
}
```

`groupToMonth` 现在的签名是 `{ year, month, assets?: unknown[] }` ⇒ 不传 `assets` 合法，
返回 `photos: []`。**不要**改它的签名。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/photos/util/__tests__/timelineBuckets.test.ts && pnpm exec vue-tsc --noEmit`
Expected: PASS。若 `Month` 还没有 `loaded/count/videoCount` 字段，tsc 会红 ——
**此时不要改 `Month`**（那是 T6 的事），改成在本任务里先给 `bucketToMonth` 的返回类型
标 `Month & { loaded: boolean; count: number; videoCount: number }`；T6 会把字段并进 `Month`
并把这个交叉类型收回去。

- [ ] **Step 5: 提交**

```bash
git add src/photos/util/timelineBuckets.ts src/photos/util/__tests__/timelineBuckets.test.ts
git commit -m "feat(photos): add the bucket key, title and staleness helpers

The bucket path and the legacy timeline path both produce month groups, and the
key has to be identical between them or jump-to-month anchors and the scrubber
would behave differently per backend — so the key and title delegate to
groupToMonth rather than reimplementing its private month-name table. The
staleness rule keeps unchanged buckets byte-identical so a directory refresh
during indexing cannot make the grid flash."
```

---

