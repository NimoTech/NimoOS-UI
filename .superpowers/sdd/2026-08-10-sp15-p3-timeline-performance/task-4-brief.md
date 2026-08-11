## Task 4: store 分桶状态 · 探测 / 回退 / 退避 / 月份 / 计数

**Files:**
- Modify: `src/photos/stores/timeline.ts`（新增状态与 `fetchTimeline` 改写、`months` 分支、计数）
- Test: `src/photos/stores/__tests__/timeline.test.ts`（追加）

**Interfaces:**
- Consumes: T1 的 `service.photos.getTimelineBuckets`；T2 的 `normalizeBuckets` / `bucketKey` /
  `bucketToMonth`；既有 `isNotFound` from `src/photos/util/httpErrors.ts`
- Produces（store 上新增，供 T5–T10 与视图使用）：
  - state: `buckets: BucketMeta[]`、`bucketAssets: Map<string, Photo[]>`、
    `bucketLoading: Set<string>`、`bucketMode: boolean`
  - getter: `totalCount: number`（新增）；`months` / `photoCount` / `videoCount` 增加分桶分支
  - test hook: `__resetBucketProbeForTest()`（清模块级退避时间戳）

- [ ] **Step 1: 写失败测试**

追加到 `src/photos/stores/__tests__/timeline.test.ts`。顶部 `svc.photos` 的 mock 对象要补
`getTimelineBuckets: vi.fn()` 与 `getTimelineBucket: vi.fn()`（**两个一起补**，T5 要用）。

```ts
import { __resetBucketProbeForTest } from '../timeline'

const BUCKETS = [
  { year: 2026, month: 8, count: 12, videoCount: 3 },
  { year: 2026, month: 7, count: 5, videoCount: 0 },
]
function notFound() {
  return Object.assign(new Error('Request failed with status code 404'), { response: { status: 404 } })
}

describe('photos-timeline bucket mode', () => {
  beforeEach(() => { __resetBucketProbeForTest() })

  it('fetchTimeline probes the directory and enters bucket mode', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    expect(s.bucketMode).toBe(true)
    expect(s.buckets).toEqual(BUCKETS)
    expect(svc.photos.getTimeline).not.toHaveBeenCalled()
    expect(s.loading).toBe(false)
  })

  it('exposes every directory month as an unloaded group, newest first', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    expect(s.months.map((m) => m.key)).toEqual(['2026-08', '2026-07'])
    expect(s.months.every((m) => m.loaded === false && m.photos.length === 0)).toBe(true)
    expect(s.months[0]).toMatchObject({ count: 12, videoCount: 3 })
  })

  it('counts from the directory, so the totals are exact before anything loads', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    expect(s.totalCount).toBe(17)
    expect(s.videoCount).toBe(3)
    expect(s.photoCount).toBe(14)
  })

  it('falls back to the legacy timeline on 404 and stays out of bucket mode', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockRejectedValueOnce(notFound())
    svc.photos.getTimeline.mockResolvedValueOnce([GROUP_A])
    await s.fetchTimeline()
    expect(s.bucketMode).toBe(false)
    expect(s.timelineGroups).toEqual([GROUP_A])
    expect(s.months.map((m) => m.key)).toEqual(['2026-07'])
    expect(s.months[0].loaded).toBeUndefined()
  })

  it('does not re-probe the directory for 10 minutes after a 404', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockRejectedValueOnce(notFound())
    svc.photos.getTimeline.mockResolvedValue([GROUP_A])
    await s.fetchTimeline()
    await s.fetchTimeline()
    expect(svc.photos.getTimelineBuckets).toHaveBeenCalledTimes(1)
    expect(svc.photos.getTimeline).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(10 * 60_000 + 1)
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    expect(svc.photos.getTimelineBuckets).toHaveBeenCalledTimes(2)
    expect(s.bucketMode).toBe(true)
  })

  it('keeps probing after a non-404 failure — a blip must not pin the user on the legacy path', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockRejectedValueOnce(new Error('network down'))
    svc.photos.getTimeline.mockResolvedValue([GROUP_A])
    await s.fetchTimeline()
    expect(s.bucketMode).toBe(false)
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    expect(svc.photos.getTimelineBuckets).toHaveBeenCalledTimes(2)
    expect(s.bucketMode).toBe(true)
  })

  it('drops legacy groups when it switches into bucket mode', async () => {
    // Both sources feeding `months` at once would double every month.
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockRejectedValueOnce(notFound())
    svc.photos.getTimeline.mockResolvedValueOnce([GROUP_A])
    await s.fetchTimeline()
    __resetBucketProbeForTest()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    expect(s.timelineGroups).toEqual([])
    expect(s.months.map((m) => m.key)).toEqual(['2026-08', '2026-07'])
  })
})
```

注意：既有 `beforeEach` 已经 `vi.useFakeTimers()`，所以退避那一例可以直接
`vi.advanceTimersByTime`。但**退避时间戳必须用 `Date.now()`**，而 `vi.useFakeTimers()` 默认
也 mock `Date` ⇒ `advanceTimersByTime` 会推进 `Date.now()`。实现时不要用
`performance.now()`（fake timers 不推进它）。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/photos/stores/__tests__/timeline.test.ts`
Expected: FAIL —— `__resetBucketProbeForTest` 不存在 / `bucketMode` undefined。

- [ ] **Step 3: 实现**

在 `src/photos/stores/timeline.ts` 顶部 import 区补：

```ts
import { isNotFound } from '../util/httpErrors'
import {
  bucketKey, bucketToMonth, normalizeBuckets, type BucketMeta,
} from '../util/timelineBuckets'
import type { Photo } from '../util/assetToPhoto'
```

在模块级（`_pollTimer` 附近）加退避状态：

```ts
// A legacy backend answers 404 on the bucket directory every single time. Probing
// on every page entry is pure noise, so a 404 parks the probe for a while. This
// is a timestamp, not store state — it must not be reactive, and __resetForTest
// has to clear it or one test's 404 would silence the next test's probe.
const BUCKET_PROBE_BACKOFF_MS = 10 * 60_000
let _bucketProbeRetryAfter = 0

export function __resetBucketProbeForTest(): void {
  _bucketProbeRetryAfter = 0
}
```

在 store 内加状态与 getter（`timelineGroups` 附近）：

```ts
  const buckets = ref<BucketMeta[]>([])
  const bucketAssets = ref<Map<string, Photo[]>>(new Map())
  const bucketLoading = ref<Set<string>>(new Set())
  const bucketMode = ref(false)
```

`months` 改成分支（**保留**原来的回退实现）：

```ts
  const months = computed<Month[]>(() => {
    if (bucketMode.value) {
      return buckets.value.map((b) => bucketToMonth(b, bucketAssets.value.get(bucketKey(b)) ?? null))
    }
    return timelineGroups.value.map(g => groupToMonth(g))
  })
```

计数改成分支，并新增 `totalCount`：

```ts
  // In bucket mode the directory knows the whole library, so these are exact
  // before a single asset has been fetched. The legacy branch can only count
  // what it holds — which was always wrong for a large library, and stays as it
  // was because that path has no directory to consult.
  const totalCount = computed(() =>
    bucketMode.value
      ? buckets.value.reduce((s, b) => s + b.count, 0)
      : allPhotos.value.length,
  )
  const videoCount = computed(() =>
    bucketMode.value
      ? buckets.value.reduce((s, b) => s + b.videoCount, 0)
      : allPhotos.value.filter(p => p.isVideo).length,
  )
  const photoCount = computed(() =>
    bucketMode.value
      ? Math.max(0, totalCount.value - videoCount.value)
      : allPhotos.value.filter(p => !p.isVideo).length,
  )
```

`fetchTimeline` 改写：

```ts
  async function fetchTimeline() {
    loading.value = true
    try {
      if (Date.now() >= _bucketProbeRetryAfter) {
        try {
          const raw = await service.photos.getTimelineBuckets()
          buckets.value = normalizeBuckets(raw)
          bucketMode.value = true
          // Both sources feed `months`; leaving legacy groups behind would
          // render every month twice.
          timelineGroups.value = []
          return
        } catch (e) {
          if (isNotFound(e)) {
            _bucketProbeRetryAfter = Date.now() + BUCKET_PROBE_BACKOFF_MS
          } else {
            // A network blip must not pin the user on the legacy path for ten
            // minutes — only a 404 (this backend has no bucket endpoints) does.
            console.error('[photos-timeline] bucket probe', e)
          }
        }
      }
      const res = await service.photos.getTimeline()
      timelineGroups.value = (res as TimelineGroup[] | null | undefined) ?? []
    } catch (e) {
      console.error('[photos-timeline] fetchTimeline', e)
    } finally {
      loading.value = false
    }
  }
```

`resetState()` 补四个新状态；`__resetForTest()` 补 `__resetBucketProbeForTest()`：

```ts
  function resetState() {
    timelineGroups.value = []
    loading.value = false
    indexStatus.value = emptyIndexStatus()
    tasks.value = []
    buckets.value = []
    bucketAssets.value = new Map()
    bucketLoading.value = new Set()
    bucketMode.value = false
  }
```

return 里补 `buckets, bucketAssets, bucketLoading, bucketMode, totalCount`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/photos/stores/__tests__/timeline.test.ts && pnpm exec vue-tsc --noEmit`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/photos/stores/timeline.ts src/photos/stores/__tests__/timeline.test.ts
git commit -m "feat(photos): probe the bucket directory and expose exact library counts

Entering the page now costs one small directory request instead of the whole
library, and the month list it produces is what lets the grid paint structure
before any asset arrives. A 404 means this backend predates the endpoints, so
that case alone parks the probe for ten minutes; any other failure keeps
probing, because a network blip must not pin the user on the legacy path. The
directory also makes the header counts exact, which the loaded-assets count
never was for a large library."
```

---

