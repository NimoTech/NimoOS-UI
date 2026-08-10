## Task 9: 写路径增量化

**Files:**
- Modify: `src/photos/stores/timeline.ts`（`deleteAssets`）
- Modify: `src/photos/stores/trash.ts:40,46,74`（三处 `fetchTimeline()` → `refreshBuckets()`）
- Test: `src/photos/stores/__tests__/timeline.test.ts`、`src/photos/stores/__tests__/trash.test.ts`

**Interfaces:**
- Consumes: T5 `refreshBuckets`
- Produces: `removeAssetsFromBuckets(ids: string[]): void`（store 内部函数，不导出）

- [ ] **Step 1: 写失败测试**

```ts
// timeline.test.ts
  it('deleteAssets patches the loaded buckets instead of refetching the timeline', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([{ year: 2026, month: 8, count: 2, videoCount: 1 }])
    await s.fetchTimeline()
    svc.photos.getTimelineBucket.mockResolvedValueOnce([
      { id: 'a1', mimeType: 'image/jpeg' }, { id: 'v1', mimeType: 'video/mp4' },
    ])
    await s.fetchBucket('2026-08')
    svc.photos.deleteAsset.mockResolvedValue(undefined)
    svc.photos.getTimelineBuckets.mockClear()
    svc.photos.getTimeline.mockClear()

    expect(await s.deleteAssets(['v1'])).toBe(1)
    expect(s.months[0].photos.map((p) => p.id)).toEqual(['a1'])
    expect(s.months[0].count).toBe(1)
    expect(s.months[0].videoCount).toBe(0)
    expect(svc.photos.getTimeline).not.toHaveBeenCalled()
    expect(svc.photos.getTimelineBuckets).not.toHaveBeenCalled()
  })

  it('decrements by what actually got deleted, not by what was asked for', async () => {
    // A partial failure must not leave the directory count lying.
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([{ year: 2026, month: 8, count: 2, videoCount: 0 }])
    await s.fetchTimeline()
    svc.photos.getTimelineBucket.mockResolvedValueOnce([
      { id: 'a1', mimeType: 'image/jpeg' }, { id: 'a2', mimeType: 'image/jpeg' },
    ])
    await s.fetchBucket('2026-08')
    svc.photos.deleteAsset.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('nope'))
    expect(await s.deleteAssets(['a1', 'a2'])).toBe(1)
    expect(s.months[0].count).toBe(1)
    expect(s.months[0].photos.map((p) => p.id)).toEqual(['a2'])
  })

  it('still refetches the legacy timeline when buckets are unavailable', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockRejectedValueOnce(notFound())
    svc.photos.getTimeline.mockResolvedValue([GROUP_A])
    await s.fetchTimeline()
    svc.photos.deleteAsset.mockResolvedValue(undefined)
    svc.photos.getTimeline.mockClear()
    await s.deleteAssets(['a1'])
    expect(svc.photos.getTimeline).toHaveBeenCalledTimes(1)
  })

  it('leaves an unloaded bucket count alone (nothing local to patch)', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([{ year: 2026, month: 8, count: 5, videoCount: 0 }])
    await s.fetchTimeline()
    svc.photos.deleteAsset.mockResolvedValue(undefined)
    await s.deleteAssets(['whatever'])
    expect(s.months[0].count).toBe(5)
  })
```

`trash.test.ts` 追加：

```ts
  it('restore refreshes the bucket directory rather than the whole timeline', async () => {
    // timeline store is bucket mode; assert refreshBuckets ran and getTimeline did not
  })
```
（三个 action 各一例：`restore` / `restoreAll` / `undoRestore`。照 `trash.test.ts` 现有
mock 形状写完整代码。）

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/photos/stores/__tests__/timeline.test.ts src/photos/stores/__tests__/trash.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现**

`timeline.ts`：

```ts
  // Remove ids from every loaded bucket and take the directory counts down by
  // what was actually removed locally. Counting the requested ids instead would
  // leave the header lying whenever a delete partially failed.
  function removeAssetsFromBuckets(ids: string[]): void {
    if (!bucketMode.value || ids.length === 0) return
    const doomed = new Set(ids.map(String))
    const map = new Map(bucketAssets.value)
    const removedPerKey = new Map<string, { total: number; videos: number }>()
    for (const [key, photos] of map) {
      let total = 0
      let videos = 0
      const kept = photos.filter((p) => {
        if (!doomed.has(String(p.id))) return true
        total++
        if (p.isVideo) videos++
        return false
      })
      if (total === 0) continue
      map.set(key, kept)
      removedPerKey.set(key, { total, videos })
    }
    if (removedPerKey.size === 0) return
    bucketAssets.value = map
    buckets.value = buckets.value.map((b) => {
      const hit = removedPerKey.get(bucketKey(b))
      if (!hit) return b
      return {
        ...b,
        count: Math.max(0, b.count - hit.total),
        videoCount: Math.max(0, b.videoCount - hit.videos),
      }
    })
  }

  async function deleteAssets(ids: string[]): Promise<number> {
    const deleted: string[] = []
    for (const id of ids) {
      try {
        await service.photos.deleteAsset(id)
        deleted.push(id)
      } catch (e) {
        console.error('[photos-timeline] deleteAsset', id, e)
      }
    }
    if (deleted.length > 0) {
      if (bucketMode.value) removeAssetsFromBuckets(deleted)
      else await refreshTimelineQuiet()
    }
    return deleted.length
  }
```

`trash.ts` 三处：

```ts
    // Buckets patch themselves; on a legacy backend refreshBuckets is a no-op and
    // this falls back to the full refetch below.
    const timeline = useTimelineStore()
    if (timeline.bucketMode) void timeline.refreshBuckets()
    else void timeline.fetchTimeline()
```

（`restore` / `restoreAll` / `undoRestore` 三处同款，抽成本文件内一个小函数
`refreshTimelineAfterTrashChange()` 避免三份重复。）

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/photos/stores && pnpm exec vue-tsc --noEmit`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/photos/stores/timeline.ts src/photos/stores/trash.ts src/photos/stores/__tests__
git commit -m "perf(photos): patch buckets on delete instead of refetching everything

Deleting one photo used to refetch the entire timeline. In bucket mode the ids
are removed from the loaded buckets and the directory counts come down by what
was actually removed — by the successes, not the requests, so a partial failure
cannot leave the header lying. Restores out of the trash refresh the directory
alone, which is a few hundred bytes instead of the library."
```

---

