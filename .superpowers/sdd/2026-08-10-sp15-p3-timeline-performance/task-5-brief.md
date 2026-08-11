## Task 5: store 单桶翻页 + 目录刷新失效

**Files:**
- Modify: `src/photos/stores/timeline.ts`
- Test: `src/photos/stores/__tests__/timeline.test.ts`（追加）

**Interfaces:**
- Consumes: T1 `getTimelineBuckets`/`getTimelineBucket`；T2 `parseBucketKey`/`staleBucketKeys`；
  既有 `assetToPhoto`
- Produces:
  - `fetchBucket(key: string): Promise<void>`
  - `refreshBuckets(): Promise<void>`
  - 常量 `BUCKET_PAGE_SIZE = 500`、`BUCKET_MAX_PAGES = 40`

- [ ] **Step 1: 写失败测试**

```ts
describe('photos-timeline fetchBucket', () => {
  beforeEach(() => { __resetBucketProbeForTest() })

  async function enterBucketMode(s: ReturnType<typeof useTimelineStore>, list = BUCKETS) {
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(list)
    await s.fetchTimeline()
  }
  const asset = (id: string, video = false) => ({ id, mimeType: video ? 'video/mp4' : 'image/jpeg' })

  it('fetches one month and marks it loaded', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s)
    svc.photos.getTimelineBucket.mockResolvedValueOnce([asset('a1'), asset('a2')])
    await s.fetchBucket('2026-08')
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(2026, 8, 500, 0)
    const aug = s.months.find((m) => m.key === '2026-08')
    expect(aug?.loaded).toBe(true)
    expect(aug?.photos.map((p) => p.id)).toEqual(['a1', 'a2'])
  })

  it('sends the unknown bucket as a zero pair, never a half-zero key', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s, [{ year: 0, month: 0, count: 1, videoCount: 0 }])
    svc.photos.getTimelineBucket.mockResolvedValueOnce([asset('u1')])
    await s.fetchBucket('unknown')
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(0, 0, 500, 0)
  })

  it('pages until the directory count is covered', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s, [{ year: 2026, month: 8, count: 501, videoCount: 0 }])
    svc.photos.getTimelineBucket
      .mockResolvedValueOnce(Array.from({ length: 500 }, (_, i) => asset(`p${i}`)))
      .mockResolvedValueOnce([asset('p500')])
    await s.fetchBucket('2026-08')
    expect(svc.photos.getTimelineBucket).toHaveBeenNthCalledWith(2, 2026, 8, 500, 500)
    expect(s.months[0].photos).toHaveLength(501)
  })

  it('stops paging early when a page comes back short', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s, [{ year: 2026, month: 8, count: 900, videoCount: 0 }])
    svc.photos.getTimelineBucket.mockResolvedValueOnce([asset('p0')])
    await s.fetchBucket('2026-08')
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledTimes(1)
    expect(s.months[0].loaded).toBe(true)
  })

  it('dedupes concurrent requests for the same month', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s)
    svc.photos.getTimelineBucket.mockResolvedValue([asset('a1')])
    await Promise.all([s.fetchBucket('2026-08'), s.fetchBucket('2026-08')])
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledTimes(1)
  })

  it('does not refetch a month it already holds', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s)
    svc.photos.getTimelineBucket.mockResolvedValueOnce([asset('a1')])
    await s.fetchBucket('2026-08')
    await s.fetchBucket('2026-08')
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledTimes(1)
  })

  it('leaves a month unloaded on failure so scrolling back retries it', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s)
    svc.photos.getTimelineBucket.mockRejectedValueOnce(new Error('boom'))
    await s.fetchBucket('2026-08')
    expect(s.months[0].loaded).toBe(false)
    svc.photos.getTimelineBucket.mockResolvedValueOnce([asset('a1')])
    await s.fetchBucket('2026-08')
    expect(s.months[0].loaded).toBe(true)
  })

  it('ignores an unknown key instead of firing a request with NaN', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s)
    await s.fetchBucket('search')
    expect(svc.photos.getTimelineBucket).not.toHaveBeenCalled()
  })

  it('does nothing outside bucket mode', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockRejectedValueOnce(notFound())
    svc.photos.getTimeline.mockResolvedValueOnce([GROUP_A])
    await s.fetchTimeline()
    await s.fetchBucket('2026-07')
    expect(svc.photos.getTimelineBucket).not.toHaveBeenCalled()
  })
})

describe('photos-timeline refreshBuckets', () => {
  beforeEach(() => { __resetBucketProbeForTest() })
  const asset = (id: string) => ({ id, mimeType: 'image/jpeg' })

  it('keeps an unchanged month byte-identical so the grid does not flash', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    svc.photos.getTimelineBucket.mockResolvedValueOnce([asset('a1')])
    await s.fetchBucket('2026-08')
    const before = s.months[0].photos
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.refreshBuckets()
    expect(s.months[0].photos).toBe(before)
  })

  it('drops the cache for a month whose count changed', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    svc.photos.getTimelineBucket.mockResolvedValueOnce([asset('a1')])
    await s.fetchBucket('2026-08')
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([{ year: 2026, month: 8, count: 13, videoCount: 3 }, BUCKETS[1]])
    await s.refreshBuckets()
    expect(s.months[0].loaded).toBe(false)
    expect(s.months[0].count).toBe(13)
  })

  it('drops a month that vanished entirely', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    svc.photos.getTimelineBucket.mockResolvedValueOnce([asset('a1')])
    await s.fetchBucket('2026-08')
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([BUCKETS[1]])
    await s.refreshBuckets()
    expect(s.months.map((m) => m.key)).toEqual(['2026-07'])
  })

  it('is a no-op outside bucket mode', async () => {
    const s = useTimelineStore()
    await s.refreshBuckets()
    expect(svc.photos.getTimelineBuckets).not.toHaveBeenCalled()
  })

  it('keeps the old directory when the refresh fails', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    svc.photos.getTimelineBuckets.mockRejectedValueOnce(new Error('boom'))
    await s.refreshBuckets()
    expect(s.buckets).toEqual(BUCKETS)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/photos/stores/__tests__/timeline.test.ts`
Expected: FAIL —— `s.fetchBucket is not a function`。

- [ ] **Step 3: 实现**

模块级常量与 in-flight 表：

```ts
// The backend clamps a bucket page to 500 rows, so paging is not optional for a
// busy month. The page ceiling is a runaway guard, not a product limit: 40 pages
// is 20k assets in one month, far past any real library.
const BUCKET_PAGE_SIZE = 500
const BUCKET_MAX_PAGES = 40

// Promises are not store state. Keyed so two viewport events for the same month
// share one request instead of racing.
const _bucketInflight = new Map<string, Promise<void>>()
```

`__resetBucketProbeForTest` 里同时清 `_bucketInflight`（否则上一个测试遗留的 promise 会把
下一个测试的请求去重掉）：

```ts
export function __resetBucketProbeForTest(): void {
  _bucketProbeRetryAfter = 0
  _bucketInflight.clear()
}
```

store 内新增两个 action：

```ts
  async function fetchBucket(key: string): Promise<void> {
    if (!bucketMode.value) return
    if (bucketAssets.value.has(key)) return
    const inflight = _bucketInflight.get(key)
    if (inflight) return inflight
    const ym = parseBucketKey(key)
    if (!ym) return
    const meta = buckets.value.find((b) => bucketKey(b) === key)
    if (!meta) return

    const run = (async () => {
      const next = new Set(bucketLoading.value)
      next.add(key)
      bucketLoading.value = next
      try {
        const photos: Photo[] = []
        for (let page = 0; page < BUCKET_MAX_PAGES; page++) {
          const raw = await service.photos.getTimelineBucket(
            ym.year, ym.month, BUCKET_PAGE_SIZE, page * BUCKET_PAGE_SIZE,
          )
          const list = (raw as unknown[] | null | undefined) ?? []
          photos.push(...list.map((a) => assetToPhoto(a as Record<string, unknown>)))
          // A short page means the month is exhausted; the directory count is
          // only an upper bound (an asset can be deleted between the two calls).
          if (list.length < BUCKET_PAGE_SIZE) break
          if (photos.length >= meta.count) break
          if (page === BUCKET_MAX_PAGES - 1) {
            console.warn('[photos-timeline] bucket truncated at the page ceiling', key, photos.length)
          }
        }
        const map = new Map(bucketAssets.value)
        map.set(key, photos)
        bucketAssets.value = map
      } catch (e) {
        // Leave the month unloaded: scrolling back to it retries naturally, so
        // no extra retry machinery is needed.
        console.error('[photos-timeline] fetchBucket', key, e)
      } finally {
        const done = new Set(bucketLoading.value)
        done.delete(key)
        bucketLoading.value = done
        _bucketInflight.delete(key)
      }
    })()
    _bucketInflight.set(key, run)
    return run
  }

  // Refresh the directory only — a few hundred bytes — and drop just the caches
  // it invalidates. Untouched months keep their exact photo arrays so the grid
  // does not re-render them.
  async function refreshBuckets(): Promise<void> {
    if (!bucketMode.value) return
    try {
      const raw = await service.photos.getTimelineBuckets()
      const next = normalizeBuckets(raw)
      const stale = staleBucketKeys(buckets.value, next, bucketAssets.value.keys())
      const live = new Set(next.map((b) => bucketKey(b)))
      const map = new Map(bucketAssets.value)
      for (const key of stale) map.delete(key)
      for (const key of [...map.keys()]) if (!live.has(key)) map.delete(key)
      buckets.value = next
      bucketAssets.value = map
    } catch (e) {
      console.error('[photos-timeline] refreshBuckets', e)
    }
  }
```

import 区补 `parseBucketKey`、`staleBucketKeys`、`assetToPhoto`。return 里补
`fetchBucket, refreshBuckets`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/photos/stores/__tests__/timeline.test.ts && pnpm exec vue-tsc --noEmit`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/photos/stores/timeline.ts src/photos/stores/__tests__/timeline.test.ts
git commit -m "feat(photos): load one month at a time and refresh the directory cheaply

A month is fetched on demand and paged, because the backend caps a page at 500
rows and a busy month exceeds that. Requests are deduped per month so two
viewport events cannot race, and a failure deliberately leaves the month
unloaded: scrolling back to it is already a retry. The directory refresh drops
only the caches whose counts moved, which is what keeps a refresh during
indexing from re-rendering months the user is looking at."
```

---

