## Task 10: 索引轮询只刷目录 + 防抖

**Files:**
- Modify: `src/photos/stores/timeline.ts:104-137`（`fetchIndexStatus` 的刷新分支）
- Test: `src/photos/stores/__tests__/timeline.test.ts`

**Interfaces:** Consumes T5 `refreshBuckets`。Produces `__resetIndexRefreshForTest()`（清防抖时间戳）。

- [ ] **Step 1: 写失败测试**

```ts
  it('refreshes only the directory while indexing progresses', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    svc.photos.getTimelineBuckets.mockClear()
    svc.photos.getTimeline.mockClear()
    svc.photos.getStatus.mockResolvedValueOnce({ indexed: 1 })
    await s.fetchIndexStatus()
    svc.photos.getStatus.mockResolvedValueOnce({ indexed: 2 })
    await s.fetchIndexStatus()
    expect(svc.photos.getTimelineBuckets).toHaveBeenCalledTimes(1)
    expect(svc.photos.getTimeline).not.toHaveBeenCalled()
  })

  it('debounces the directory refresh to at most one per 3 seconds', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValue(BUCKETS)
    await s.fetchTimeline()
    svc.photos.getTimelineBuckets.mockClear()
    svc.photos.getStatus.mockResolvedValueOnce({ indexed: 1 })
    await s.fetchIndexStatus()
    svc.photos.getStatus.mockResolvedValueOnce({ indexed: 2 })
    await s.fetchIndexStatus()
    expect(svc.photos.getTimelineBuckets).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(3001)
    svc.photos.getStatus.mockResolvedValueOnce({ indexed: 3 })
    await s.fetchIndexStatus()
    expect(svc.photos.getTimelineBuckets).toHaveBeenCalledTimes(2)
  })

  it('keeps the legacy quiet refresh when buckets are unavailable', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockRejectedValueOnce(notFound())
    svc.photos.getTimeline.mockResolvedValue([GROUP_A])
    await s.fetchTimeline()
    svc.photos.getTimeline.mockClear()
    svc.photos.getStatus.mockResolvedValueOnce({ indexed: 1 })
    await s.fetchIndexStatus()
    expect(svc.photos.getTimeline).toHaveBeenCalledTimes(1)
  })
```

第一例的第一次调用之所以是 1 次：`indexed` 从 0 涨到 1 触发一次刷新，第二次被防抖挡住。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/photos/stores/__tests__/timeline.test.ts`
Expected: FAIL —— 现在每次涨都全量 `getTimeline`。

- [ ] **Step 3: 实现**

```ts
// Indexing polls every 5s and each tick used to refetch the whole timeline. The
// directory is cheap enough to poll, but not free — debounce it so a burst of
// index progress cannot turn into a burst of requests.
const INDEX_REFRESH_DEBOUNCE_MS = 3_000
let _lastIndexRefreshAt = 0

export function __resetIndexRefreshForTest(): void {
  _lastIndexRefreshAt = 0
}
```

`fetchIndexStatus` 里那段：

```ts
      if (nextIndexed > prevIndexed) {
        if (bucketMode.value) {
          const now = Date.now()
          if (now - _lastIndexRefreshAt >= INDEX_REFRESH_DEBOUNCE_MS) {
            _lastIndexRefreshAt = now
            void refreshBuckets()
          }
        } else {
          void refreshTimelineQuiet()
        }
      }
```

`__resetForTest()` 里补 `__resetIndexRefreshForTest()`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/photos/stores/__tests__/timeline.test.ts && pnpm exec vue-tsc --noEmit`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/photos/stores/timeline.ts src/photos/stores/__tests__/timeline.test.ts
git commit -m "perf(photos): refresh only the directory while indexing

Importing photos polls index status every five seconds, and every tick that saw
progress refetched the entire timeline. The directory is small enough to poll
instead, and a debounce keeps a burst of index progress from becoming a burst of
requests. Untouched months keep their exact arrays, so the grid the user is
looking at does not re-render."
```

---

