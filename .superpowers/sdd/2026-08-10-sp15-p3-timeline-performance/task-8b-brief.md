## Task 8b: 选择器与「最近 30 天建相册」在分桶模式下的空数据修复

> 本任务不在原计划里。它由 Task 4 的评审挖出、经机主 2026-08-11 裁定后追加。
> 机主裁定原文（选择器该拉多少）：**「开箱先拉最近几个月，滚到底再拉更早的」**。

**Files:**
- Modify: `src/photos/stores/timeline.ts`（新增一个 action）
- Modify: `src/views/PhotosAlbums.vue`（约 :177-186 的「最近 30 天」分支）
- Modify: `src/photos/components/PhotosLibraryPicker.vue`（约 :80-84 的排序列表与 :164 的守卫）
- Test: `src/photos/stores/__tests__/timeline.test.ts`（追加）
- Test: `src/photos/components/__tests__/PhotosLibraryPicker.test.ts`（追加；文件已存在且已在开源清单覆盖范围内）
- Test: `src/views/__tests__/PhotosAlbums.test.ts`（追加；文件已存在且已登记）

### 为什么要有这个任务（两个真实的静默失败）

分桶模式下 `months` 有值（目录已到）而 `allPhotos` 是空的（还没有任何桶被加载）。两处消费方都用
「`months.length === 0` 就去 fetch」当守卫、然后读 `allPhotos`：

1. **`src/views/PhotosAlbums.vue:180`** —「用最近 30 天的照片建相册」：守卫看到 `months` 非空 ⇒
   不 fetch ⇒ `allPhotos` 为空 ⇒ `ids.length === 0` ⇒ **静默建出一个空相册，还弹「已创建」成功
   toast**。这段代码上面那一大段注释写明：它当初就是为了修「静默建空相册 + 虚假成功 toast」才
   加的守卫 —— 分桶从另一个门把同一个缺陷放回来了。
2. **`src/photos/components/PhotosLibraryPicker.vue:164`** — 同一个守卫，而这个组件整个列表都从
   `timeline.allPhotos` 展平而来（`:82`）⇒ **选择器显示空库**，而且守卫本身挡住了那次能填满它的
   fetch。用户会看到「从 NAS 选择照片」里什么都没有。

两处在回退（legacy）模式下都不受影响 —— 那条路径 `months` 与 `allPhotos` 同真同假，这也正是
`PhotosAlbums.vue` 那段注释所依赖的、现在被分桶打破的不变量。

### Step 0: 先读现场

- `src/photos/stores/timeline.ts`：已有 `buckets` / `bucketAssets` / `bucketLoading` / `bucketMode`、
  `fetchBucket(key)`、`refreshBuckets()`、`BUCKET_PAGE_SIZE`、`BUCKET_MAX_PAGES`、
  `__resetBucketProbeForTest()`。
- `src/photos/util/timelineBuckets.ts`：`bucketKey`、`parseBucketKey`、`normalizeBuckets`、
  `bucketToMonth`、`staleBucketKeys`。
- 目录顺序是**后端给的顺序：年降序、月降序，无日期桶最后**（`normalizeBuckets` 原样保留）。
  所以「最新的几个月」就是数组前几项 —— 但**无日期桶（`year=0`）必须排除在「最新」之外**，
  它排在最后且没有日期语义。

### Step 1: store 新增 `fetchNewestBuckets(n)`（写失败测试）

契约：
- `fetchNewestBuckets(n: number): Promise<void>`
- 非分桶模式 ⇒ 直接 return（回退路径由既有 `fetchTimeline` 覆盖，不需要它）
- 取目录里**最前面 n 个有日期的桶**（跳过 `year === 0 && month === 0`），逐个走已有的
  `fetchBucket`（因此自动继承同键去重、翻页、失败保持未加载）
- 已加载的桶不重复请求（`fetchBucket` 已保证）
- 并发发出、整体 await（`Promise.all`），不要串行等待 —— 用户在等这个列表出现

追加到 `src/photos/stores/__tests__/timeline.test.ts`（照该文件既有 `describe` 的隔离写法：
`setActivePinia` / `vi.clearAllMocks` / `__resetForTest` / fake timers；注意外层 `beforeEach` 已给
`getTimelineBuckets` 一个默认 404 拒绝，分桶用例必须自己显式 mock 成功）：

```ts
  it('fetchNewestBuckets loads the newest N dated buckets', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([
      { year: 2026, month: 8, count: 1, videoCount: 0 },
      { year: 2026, month: 7, count: 1, videoCount: 0 },
      { year: 2026, month: 6, count: 1, videoCount: 0 },
    ])
    await s.fetchTimeline()
    svc.photos.getTimelineBucket.mockResolvedValue([{ id: 'a1', mimeType: 'image/jpeg' }])
    await s.fetchNewestBuckets(2)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledTimes(2)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(2026, 8, 500, 0)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(2026, 7, 500, 0)
  })

  it('skips the unknown-date bucket when picking the newest', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([
      { year: 2026, month: 8, count: 1, videoCount: 0 },
      { year: 0, month: 0, count: 5, videoCount: 0 },
    ])
    await s.fetchTimeline()
    svc.photos.getTimelineBucket.mockResolvedValue([{ id: 'a1', mimeType: 'image/jpeg' }])
    await s.fetchNewestBuckets(2)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledTimes(1)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(2026, 8, 500, 0)
  })

  it('does not refetch a bucket it already holds', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([{ year: 2026, month: 8, count: 1, videoCount: 0 }])
    await s.fetchTimeline()
    svc.photos.getTimelineBucket.mockResolvedValue([{ id: 'a1', mimeType: 'image/jpeg' }])
    await s.fetchBucket('2026-08')
    await s.fetchNewestBuckets(3)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledTimes(1)
  })

  it('is a no-op outside bucket mode', async () => {
    const s = useTimelineStore()
    await s.fetchNewestBuckets(2)
    expect(svc.photos.getTimelineBucket).not.toHaveBeenCalled()
  })
```

### Step 2: 跑测试确认失败

`pnpm test src/photos/stores/__tests__/timeline.test.ts` → FAIL（`fetchNewestBuckets is not a function`）。

### Step 3: 实现 store action

```ts
  // Consumers that need actual photos rather than just structure (the library
  // picker, "make an album from the last 30 days") cannot work off the directory
  // alone. They ask for the newest N months, which is cheap and enough: both use
  // cases care about recent photos first, and the picker pages further back as
  // the user scrolls.
  async function fetchNewestBuckets(n: number): Promise<void> {
    if (!bucketMode.value || n <= 0) return
    const dated = buckets.value.filter((b) => !(b.year === 0 && b.month === 0))
    await Promise.all(dated.slice(0, n).map((b) => fetchBucket(bucketKey(b))))
  }
```

`return` 里补 `fetchNewestBuckets`。

### Step 4: 修 `PhotosAlbums.vue` 的「最近 30 天」

现状（`:177-186`）：`if (timeline.months.length === 0) await timeline.fetchTimeline()`，然后按
`Date.now() - 30 天` 过滤 `timeline.allPhotos`。

改成：先保证 `months` 有（沿用现有守卫），再**保证最近两个月的照片真的在手**。两个月足以覆盖任意
30 天窗口（跨月时今天所在月 + 上一个月）：

```ts
      if (timeline.months.length === 0) {
        await timeline.fetchTimeline()
      }
      // Bucket mode hands us months without their photos: the guard above is
      // satisfied while allPhotos is still empty, which used to make this create
      // an empty album and report success. Two buckets always cover a 30-day
      // window (the current month plus the previous one).
      await timeline.fetchNewestBuckets(2)
```

（`fetchNewestBuckets` 在回退模式下是 no-op，所以 legacy 行为一字不变。）

**并且补一道真正的护栏**：`ids.length === 0` 时不要建相册、不要报成功。读一遍这段现有代码，
若它已经有「没有照片就不建」的分支就不要重复加；若没有，加上并给出一条失败提示（文案复用本页
已有的失败键，**不要新增 i18n 键** —— 先 `grep` 现有键，找不到合适的就报告 NEEDS_CONTEXT
而不是自己造一个）。

### Step 5: 修 `PhotosLibraryPicker.vue`

- 打开时（`:164` 那个 `watch(() => props.open, …)` 的 `isOpen` 分支）：保留 `months.length === 0`
  时的 `fetchTimeline()`，再无条件 `void timeline.fetchNewestBuckets(3)`。
- **滚到底加载更早的月份**（机主裁定的后半句）：给列表容器加一个滚动监听，滚到接近底部时
  加载下一个还没加载的有日期桶。判据用「距底部 < 200px」，并且**同一时刻只允许一个在飞的加载**
  （`fetchBucket` 已按键去重，但仍要避免一次滚动触发十几个桶）。实现上最省事的形状：

```ts
// 分桶模式下这个列表只握有已加载的桶。滚到接近底部时补下一个未加载的有日期桶,
// 让用户能一路翻到更早的照片,而不是一次把整库拉下来。
let loadingMore = false
async function onListScroll(e: Event) {
  const el = e.target as HTMLElement
  if (el.scrollHeight - el.scrollTop - el.clientHeight > 200) return
  if (loadingMore) return
  const next = timeline.buckets.find(
    (b) => !(b.year === 0 && b.month === 0) && !timeline.bucketAssets.has(bucketKey(b)),
  )
  if (!next) return
  loadingMore = true
  try { await timeline.fetchBucket(bucketKey(next)) } finally { loadingMore = false }
}
```

把 `@scroll="onListScroll"` 挂在该组件真正滚动的那个容器上 —— **先读模板确认是哪一个**，
不要猜；这个组件的滚动容器不一定是最外层。

`bucketAssets` 是 `Map`，在模板/脚本里读它要用 `.has(key)`（它已经从 store 导出）。

### Step 6: 视图测试

`src/photos/components/__tests__/PhotosLibraryPicker.test.ts` 追加两例、
`src/views/__tests__/PhotosAlbums.test.ts` 追加一例，全部写成**完整可跑代码**（照各文件既有的
mount / mock 形状，不要留注释占位）：

- 打开选择器时调了 `fetchNewestBuckets`（分桶模式）
- 滚到底会请求下一个未加载的桶，且连续两次滚动不会重复请求同一个桶
- 分桶模式下「最近 30 天建相册」在照片到手后才建，且照片为空时不建也不报成功

### Step 7: 门与提交

```bash
pnpm test src/photos/stores/__tests__/timeline.test.ts src/photos/components/__tests__/PhotosLibraryPicker.test.ts src/views/__tests__/PhotosAlbums.test.ts
pnpm exec vue-tsc --noEmit
```

提交信息英文、imperative subject、正文解释为什么（重点：分桶把 `months` 与 `allPhotos` 的旧不变量
打破了，这两处消费方因此静默产出空结果）。

### 约束（与全期一致）

- 不新增 i18n 键（若确实需要，报 NEEDS_CONTEXT）。
- 颜色只用 theme token；本任务基本不涉及新样式。
- 代码注释英文，测试描述英文。
- 不动 `PhotosGrid.vue`。不部署、不推、不合并。
- 新增文件一律不要 —— 三个测试文件都已存在。
