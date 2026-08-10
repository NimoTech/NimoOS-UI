# SP15-P3 时间线性能线 —— 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让相册主页在照片很多时「一进来立刻有结构可看、滚到哪儿加载哪儿、滚多远 DOM 都不爆」，
并把后端 `#54` 上线后会静默截断的收藏/回收站两页改成分页。

**Architecture:** 数据两步走 —— 先拿月份目录（`/timeline/buckets`，几百字节）立刻渲染骨架，
再按视口逐月拉照片（`/timeline/bucket`）。窗口化用 `IntersectionObserver` 判定，几何与失效
规则下沉成两个纯函数模块（jsdom 没有布局引擎，只有纯函数才验得到「算得对」）。老后端 404 时
整条回退到 `/timeline` 并退避 10 分钟。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript strict · Pinia · vue-i18n 9 · vitest + jsdom ·
手写 CSS（无框架）· `@nimotech/nimoos-service`（内联在 `packages/service/`）。

**Spec:** `docs/superpowers/specs/2026-08-10-sp15-p3-timeline-performance-design.md`

---

## Global Constraints

以下每条都是**全期硬约束**，每个任务的要求隐含包含本节。

1. **本期没有 1:1 靶子。** 机主 2026-08-10 裁定：「功能上解决就行，代码上不需要对齐」。
   Vue2 `#138`–`#140` 只是教训来源，**不要**照它的方法名/文件划分/代码结构做，也**不要**
   为了对齐去改本仓既有结构。需要参考时读
   `git -C /home/nimo/NimoTech/NimoOS-UI show c40957be:<path>`。
2. **界面只准新增一种状态的样式**：「未加载月份的骨架」。瓷砖、月标题、刻度尺、收藏页、
   回收站的既有视觉**一律不动**（不改尺寸、不改配色、不改排版）。
3. **两条可验的界面要求**（机主原话的落地）：一进相册主页立刻有结构可看（月份标题 + 张数 +
   等高占位），不是白屏；滚动过程中滚动条长度稳定、不跳。
4. **后端归机主（D1）**：**绝对不要**动 `/home/nimo/NimoTech/NimoOS-Photos` 仓、不要 build、
   不要部署、不要改它的 main。需要真机探接口时**停下来问机主「后端拉取部署完成了吗」**，
   得到确认才探。设备当前是老后端（无分桶端点），所以本期编码期只能验回退路径。
5. **颜色只能用 `src/styles/theme.css` 的 token**（`var(--…)`）。禁止 hex / `rgb()` /
   `rgba()` / 具名色。骨架的灰底与流光也必须走 token；需要新语义就在 `theme.css` 里加 token
   并在**两套主题块**（`:root` 与 `:root[data-theme="light"]`）都给值。
6. **CSS 注释里 `*` 不能紧贴 `/`**（`*/` 会提前关闭注释、错误恢复吞掉整条规则，六道门全瞎）。
   注释里也不能出现 hex/rgba 字面量（color-guard 不剥注释）。
7. **新增 i18n 键必须同时加进 `src/i18n/zh_cn.photos.ts` 与 `src/i18n/en_us.photos.ts`**
   （注意：**不是** `src/i18n/locales/`），按字母序插进已有 `photos*` 键之间，否则
   `src/i18n/parity.test.ts` 挂红。键名用 `photosXxx` 驼峰，**不用英文原文当键**。
8. **开源剥离登记**：`oss/manifest.mjs` 的 DELETE 表里已有 **`'src/photos'` 整目录**一条 ⇒
   本期在 `src/photos/**` 下新增的实现与测试**都不需要登记**。但
   `packages/service/src/*` 与 `src/views/**` 下新增的**文件**必须逐条登记
   （`oss/photosStripCoverage.test.mjs` 会反向检查）。本期规划的新文件全在 `src/photos/**`，
   服务包只改既有文件 —— **如果你新建了计划外的文件，先回来看这条**。
9. **测试描述一律英文**（机主 2026-08-09 拍板）。**代码注释一律英文**（本分支最近提交
   `136582d` 即为准）。对话与台账中文。
10. **提交信息一律英文**：imperative subject、sentence case、正文解释**为什么**而不是复述 diff。
11. **异步写共享 state 必带过期守卫**（generation / epoch）。本仓已被终审逮过四次。
    回归测试必须走**交错**路径（慢响应在切换之后才回来），不能只测顺序路径。
12. **不部署、不推 origin、不合 master。** 做完停在 `sp15-photos-moments` 分支上等机主统一验收。
13. **每个任务结束前**跑本任务相关测试 + `pnpm exec vue-tsc --noEmit`，绿了再提交。
    六道门在 T13 由控制器亲自复跑。
14. 已知非缺陷，跑测试时别追：jsdom `Not implemented: navigation` 噪声、
    `src/home/components/DesktopContextMenu.test.ts` 单跑时失败、
    `src/files/upload/persist.test.ts:55` 偶发红。

### 后端契约（实测取证，不要重新推测）

| 端点 | 形状 |
|---|---|
| `GET /photos/timeline/buckets` | 裸数组 `[{year,month,count,videoCount}]`，**camelCase**，年月降序，`year=0&month=0`（无日期）排最后 |
| `GET /photos/timeline/bucket?year=&month=&limit=&offset=` | 裸资产数组，列集与老 `/timeline` 相同；**单页硬上限 500**；`year/month` 只填一个（半零）→ **400**；无日期桶必须 `year=0&month=0` 成对传 |
| `GET /photos/favorites`、`GET /photos/trash` | **不传 limit 从「全部」变成 500**；响应里**没有** total 字段 |

### 全期新增 i18n 键总表（4 个，两个 locale 逐字照抄）

| 键 | zh_cn | en_us | 引入任务 |
|---|---|---|---|
| `photosLoadedSubsetHint` | `'统计基于已加载的前 {n} 项'` | `'Stats reflect the first {n} loaded items'` | T11 |
| `photosLoadMore` | `'加载更多'` | `'Load more'` | T11 |
| `photosTrashEmptiedToastPartial` | `'最近删除已清空'` | `'Trash emptied'` | T12 |
| `photosTrashEmptyBodyPartial` | `'这将释放 NAS 上的空间，原始文件将无法恢复。'` | `"This frees up space on the NAS. Once gone, the originals can't be recovered."` | T12 |

**复用、不要新增同义键**：`photosTrashEmptyBody`（带 `{size}`，`zh_cn.photos.ts:117`）、
`photosTrashEmptiedToast`（带 `{size}`，`:121`）、`photosTrashRestoreAllTitle` /
`photosTrashRestoreAllBody` / `photosTrashRestoredToast`（这三条本来就不带容量 ⇒
**「恢复全部」一路不需要降级文案**，只有「清空」那一路需要）、`photosUnknownDate`
（`PhotosGrid.vue:285` 已在用）。`photosSearchLoading`（`'正在加载更多…'`）是搜索页的**加载态**
文案，不是按钮标签，别拿它当 `photosLoadMore` 复用。

---

## File Structure

| 文件 | 责任 | 任务 |
|---|---|---|
| `packages/service/src/photos.ts` | 加 `getTimelineBuckets` / `getTimelineBucket`；`listTrash` 补分页参数 | T1 |
| `packages/service/src/photos.test.ts` | 上述三个方法的 URL/params/信封断言（**已在 manifest 里，不用登记**）| T1 |
| `src/photos/util/timelineBuckets.ts` | **新建**。桶键/标题/规范化/失效比对，纯函数 | T2 |
| `src/photos/util/__tests__/timelineBuckets.test.ts` | **新建**。同上单测 | T2 |
| `src/photos/util/gridMetrics.ts` | **新建**。列数/瓷砖边长/节高/骨架张数，纯函数 + 唯一数值真相源 | T3 |
| `src/photos/util/__tests__/gridMetrics.test.ts` | **新建**。几何单测 | T3 |
| `src/photos/util/__tests__/gridMetricsCssParity.test.ts` | **新建**。CSS ↔ TS 数值一致性守卫 | T3 |
| `src/photos/util/assetToPhoto.ts` | `Month` 接口加三个可选字段 | T6 |
| `src/photos/stores/timeline.ts` | 分桶状态 / 探测回退退避 / 单桶翻页 / 目录失效 / 增量删除 / 轮询防抖 | T4 T5 T9 T10 |
| `src/photos/stores/__tests__/timeline.test.ts` | 上述行为单测（追加到既有文件）| T4 T5 T9 T10 |
| `src/photos/components/PhotosGrid.vue` | 三态渲染 + 骨架样式 + IO 窗口化 + 实测高度 + `need-bucket` | T6 T7 |
| `src/photos/components/__tests__/PhotosGrid.test.ts` | 追加三态/窗口化/降级用例 | T6 T7 |
| `src/views/Photos.vue` | 保留未加载月份、接 `need-bucket`、死刻度置灰 | T8 |
| `src/views/__tests__/Photos.buckets.test.ts` | **新建 → 必须登记 `oss/manifest.mjs`** | T8 |
| `src/photos/stores/trash.ts` + `src/views/PhotosTrash.vue` | 回收站分页 + 清空文案降级 | T9 T12 |
| `src/photos/stores/favorites.ts` + `src/views/PhotosFavorites.vue` | 收藏分页 + 精确总数 + 提示行 | T11 |
| `src/views/PhotosAlbumDetail.vue` | `:817` 的 `<img>` 补 `loading="lazy"` | T13 |
| `src/i18n/zh_cn.photos.ts` / `en_us.photos.ts` | 4 个新键 | T11 T12 |

---

## Task 1: 服务层三个方法

**Files:**
- Modify: `packages/service/src/photos.ts:26-29`（`getTimeline` 之后插两个方法）、`:439-442`（`listTrash`）
- Test: `packages/service/src/photos.test.ts`（追加，**已在 manifest**）

**Interfaces:**
- Produces:
  - `service.photos.getTimelineBuckets(): Promise<unknown>`
  - `service.photos.getTimelineBucket(year: number, month: number, limit?: number, offset?: number): Promise<unknown>`
  - `service.photos.listTrash(limit?: number, offset?: number): Promise<unknown[]>`
- 返回 `unknown` 是本文件既有口径（`getTimeline` 就是 `Promise<unknown>`），类型化在 New-UI 侧做。

- [ ] **Step 1: 写失败测试**

追加到 `packages/service/src/photos.test.ts` 的 `describe('createPhotos', …)` 里：

```ts
  it('getTimelineBuckets hits the bucket directory endpoint with no params', async () => {
    const { http, calls } = capture([{ year: 2026, month: 8, count: 3, videoCount: 1 }])
    const p = createPhotos(http, noToken)
    expect(await p.getTimelineBuckets()).toEqual([{ year: 2026, month: 8, count: 3, videoCount: 1 }])
    expect(calls[0]).toMatchObject({ method: 'get', url: '/photos/timeline/buckets' })
    expect(calls[0].params).toBeUndefined()
  })
  it('getTimelineBucket passes year/month/limit/offset', async () => {
    const { http, calls } = capture([])
    const p = createPhotos(http, noToken)
    await p.getTimelineBucket(2026, 8, 500, 1000)
    expect(calls[0].url).toBe('/photos/timeline/bucket')
    expect(calls[0].params).toEqual({ year: 2026, month: 8, limit: 500, offset: 1000 })
  })
  it('getTimelineBucket defaults to the backend page cap and offset 0', async () => {
    const { http, calls } = capture([])
    const p = createPhotos(http, noToken)
    await p.getTimelineBucket(0, 0)
    expect(calls[0].params).toEqual({ year: 0, month: 0, limit: 500, offset: 0 })
  })
  it('listTrash omits paging params when limit is 0 and passes them when set', async () => {
    const { http, calls } = capture([])
    const p = createPhotos(http, noToken)
    await p.listTrash()
    expect(calls[0].params).toEqual({})
    await p.listTrash(500, 500)
    expect(calls[1].params).toEqual({ limit: 500, offset: 500 })
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test packages/service/src/photos.test.ts`
Expected: FAIL —— `p.getTimelineBuckets is not a function`。

- [ ] **Step 3: 实现**

`packages/service/src/photos.ts`，在 `getTimeline` 之后插入：

```ts
    // Bucketed timeline (SP15-P3). The directory is the cheap half: one row per
    // month, so the grid can render structure before any asset arrives. Bare
    // camelCase array from the backend, no envelope.
    async getTimelineBuckets(): Promise<unknown> {
      const res = await http.get('/photos/timeline/buckets')
      return body<unknown>(res.data)
    },
    // One month's assets. The backend clamps limit to 500 (limit <= 0 or > 500
    // both become 500), so 500 is the honest default rather than "unlimited".
    // year and month must be zero together for the unknown-date bucket — the
    // backend rejects a half-zero key with 400.
    async getTimelineBucket(year: number, month: number, limit = 500, offset = 0): Promise<unknown> {
      const res = await http.get('/photos/timeline/bucket', { params: { year, month, limit, offset } })
      return body<unknown>(res.data)
    },
```

把 `listTrash` 改成（形状与同文件的 `listFavorites:116-120` 一致）：

```ts
    // limit/offset mirror listFavorites: omitted (limit = 0) leaves the backend
    // to apply its own default, which since NimoOS-Photos#54 is 500 rather than
    // "everything" — callers that must see the whole list have to page.
    async listTrash(limit = 0, offset = 0): Promise<unknown[]> {
      const params: Record<string, number> = {}
      if (limit > 0) { params.limit = limit; params.offset = offset }
      const res = await http.get('/photos/trash', { params })
      return body<unknown[]>(res.data)
    },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test packages/service/src/photos.test.ts && pnpm exec vue-tsc --noEmit`
Expected: PASS，tsc 0 错。

- [ ] **Step 5: 提交**

```bash
git add packages/service/src/photos.ts packages/service/src/photos.test.ts
git commit -m "feat(photos): add the bucketed timeline endpoints and trash paging params

The bucket directory and per-month endpoints are the data half of the timeline
performance line: the directory is small enough to render structure from before
any asset arrives. listTrash grows the same optional limit/offset listFavorites
already had, because an absent limit no longer means everything."
```

---

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

## Task 3: `gridMetrics.ts` 纯函数 + CSS 一致性守卫

**Files:**
- Create: `src/photos/util/gridMetrics.ts`
- Test: `src/photos/util/__tests__/gridMetrics.test.ts`
- Test: `src/photos/util/__tests__/gridMetricsCssParity.test.ts`

**Interfaces:**
- Produces:
  - `GRID_METRICS: Record<'comfortable' | 'compact' | 'loose', { minColWidth: number; gap: number }>`
  - `CONTENT_INSET: number` / `FALLBACK_CONTAINER_WIDTH: number` / `MONTH_HEAD_HEIGHT: number`
  - `columnsFor(containerWidth: number, density: string): number`
  - `tileEdge(containerWidth: number, density: string): number`
  - `estimateSectionBodyHeight(args: { containerWidth: number; density: string; itemCount: number }): number`
  - `skeletonItemCount(args: { tab: string; count?: number; videoCount?: number; loaded?: boolean; loadedLength: number }): number`

- [ ] **Step 1: 写几何失败测试**

```ts
// src/photos/util/__tests__/gridMetrics.test.ts
import { describe, it, expect } from 'vitest'
import {
  GRID_METRICS, CONTENT_INSET, FALLBACK_CONTAINER_WIDTH, MONTH_HEAD_HEIGHT,
  columnsFor, tileEdge, estimateSectionBodyHeight, skeletonItemCount,
} from '../gridMetrics'

describe('columnsFor', () => {
  it('mirrors repeat(auto-fill, minmax(min, 1fr)) for the default density', () => {
    // 800 usable px, min 140, gap 4 -> floor((800 + 4) / 144) = 5
    expect(columnsFor(800 + CONTENT_INSET, 'comfortable')).toBe(5)
  })
  it('packs more columns at compact and fewer at loose', () => {
    expect(columnsFor(800 + CONTENT_INSET, 'compact')).toBe(8)   // floor(802 / 98)
    expect(columnsFor(800 + CONTENT_INSET, 'loose')).toBe(3)     // floor(810 / 210)
  })
  it('never returns less than one column', () => {
    expect(columnsFor(10, 'loose')).toBe(1)
  })
  it('falls back to a nominal width when the container has not been laid out', () => {
    // jsdom reports clientWidth 0 for everything; a 0 here would make every
    // skeleton 0px tall and the on-demand loader would never see a scrollable page.
    expect(columnsFor(0, 'comfortable')).toBe(columnsFor(FALLBACK_CONTAINER_WIDTH, 'comfortable'))
  })
  it('treats an unknown density as the default', () => {
    expect(columnsFor(800 + CONTENT_INSET, 'nonsense')).toBe(columnsFor(800 + CONTENT_INSET, 'comfortable'))
  })
})

describe('tileEdge', () => {
  it('splits the usable width across columns minus the inter-column gaps', () => {
    // 5 columns, 4 gaps of 4px -> (800 - 16) / 5 = 156.8
    expect(tileEdge(800 + CONTENT_INSET, 'comfortable')).toBeCloseTo(156.8, 5)
  })
})

describe('estimateSectionBodyHeight', () => {
  it('is zero for an empty section', () => {
    expect(estimateSectionBodyHeight({ containerWidth: 868, density: 'comfortable', itemCount: 0 })).toBe(0)
  })
  it('counts rows and the gaps BETWEEN rows only', () => {
    // 12 items over 5 columns -> 3 rows -> 3 * 156.8 + 2 * 4 = 478.4
    expect(estimateSectionBodyHeight({ containerWidth: 868, density: 'comfortable', itemCount: 12 }))
      .toBeCloseTo(478.4, 5)
  })
  it('rounds partial rows up', () => {
    const one = estimateSectionBodyHeight({ containerWidth: 868, density: 'comfortable', itemCount: 1 })
    const five = estimateSectionBodyHeight({ containerWidth: 868, density: 'comfortable', itemCount: 5 })
    expect(one).toBeCloseTo(five, 5)
  })
})

describe('skeletonItemCount', () => {
  it('estimates the photo tab as count minus videoCount', () => {
    // The photo tab is the DEFAULT tab on this page (Photos.vue). Estimating 0
    // here would leave every month past the first viewport permanently unloaded.
    expect(skeletonItemCount({ tab: 'photo', count: 100, videoCount: 12, loaded: false, loadedLength: 0 })).toBe(88)
  })
  it('estimates the video tab from videoCount and the all tab from count', () => {
    expect(skeletonItemCount({ tab: 'video', count: 100, videoCount: 12, loaded: false, loadedLength: 0 })).toBe(12)
    expect(skeletonItemCount({ tab: 'all', count: 100, videoCount: 12, loaded: false, loadedLength: 0 })).toBe(100)
  })
  it('estimates nothing on the doc tab, which the directory has no counter for', () => {
    expect(skeletonItemCount({ tab: 'doc', count: 100, videoCount: 12, loaded: false, loadedLength: 0 })).toBe(0)
  })
  it('uses the real length for already-loaded groups that carry no directory counts', () => {
    // Favorites and the place-assets page feed synthetic month groups: no count,
    // no videoCount, already in hand. Their placeholders must keep a true height.
    expect(skeletonItemCount({ tab: 'photo', loaded: true, loadedLength: 7 })).toBe(7)
  })
  it('never returns a negative estimate when videoCount exceeds count', () => {
    expect(skeletonItemCount({ tab: 'photo', count: 2, videoCount: 5, loaded: false, loadedLength: 0 })).toBe(0)
  })
})

describe('constants', () => {
  it('exposes the three densities the grid CSS defines', () => {
    expect(Object.keys(GRID_METRICS).sort()).toEqual(['comfortable', 'compact', 'loose'])
  })
  it('keeps a positive month-head allowance', () => {
    expect(MONTH_HEAD_HEIGHT).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/photos/util/__tests__/gridMetrics.test.ts`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 实现**

```ts
// src/photos/util/gridMetrics.ts
// SP15-P3 geometry. The photo grid is `repeat(auto-fill, minmax(Npx, 1fr))`, so
// its column count depends on the container width — an unloaded month's
// placeholder height can only be estimated, never read off a constant table.
// These are pure functions on purpose: jsdom has no layout engine, so geometry
// living inside the component could only ever be tested through its degenerate
// path.
//
// This table is the single source of truth for the numbers that also appear in
// PhotosGrid.vue's <style>. gridMetricsCssParity.test.ts fails if the two drift,
// because a silent drift here makes every placeholder the wrong height and no
// other gate can see it.
export const GRID_METRICS = {
  comfortable: { minColWidth: 140, gap: 4 },
  compact: { minColWidth: 96, gap: 2 },
  loose: { minColWidth: 200, gap: 10 },
} as const

export type Density = keyof typeof GRID_METRICS

// .photos-wrap has `padding-right: 68px` (the month scrubber floats over it), and
// clientWidth includes padding — subtract it to get the width the grid actually
// lays out in.
export const CONTENT_INSET = 68

// Used when the container reports width 0: jsdom always does, and a real
// container does momentarily while display:none. Estimating 0 there would give
// every skeleton zero height, leaving the page unscrollable and the on-demand
// loader with nothing to react to.
export const FALLBACK_CONTAINER_WIDTH = 1200

// .month-head is `padding: 4px 2px 10px` around a 15px/600 title — about 32px
// tall. Only an estimate, and only used until a section has rendered once: after
// that the grid remembers its measured height instead.
export const MONTH_HEAD_HEIGHT = 32

function metricsFor(density: string): { minColWidth: number; gap: number } {
  return GRID_METRICS[density as Density] ?? GRID_METRICS.comfortable
}

function usableWidth(containerWidth: number): number {
  const w = containerWidth > 0 ? containerWidth : FALLBACK_CONTAINER_WIDTH
  return Math.max(1, w - CONTENT_INSET)
}

export function columnsFor(containerWidth: number, density: string): number {
  const { minColWidth, gap } = metricsFor(density)
  const w = usableWidth(containerWidth)
  return Math.max(1, Math.floor((w + gap) / (minColWidth + gap)))
}

// Tiles are `aspect-ratio: 1`, so the edge length is also the row height.
export function tileEdge(containerWidth: number, density: string): number {
  const { gap } = metricsFor(density)
  const cols = columnsFor(containerWidth, density)
  const w = usableWidth(containerWidth)
  return (w - (cols - 1) * gap) / cols
}

export function estimateSectionBodyHeight(
  { containerWidth, density, itemCount }: { containerWidth: number; density: string; itemCount: number },
): number {
  if (itemCount <= 0) return 0
  const { gap } = metricsFor(density)
  const cols = columnsFor(containerWidth, density)
  const rows = Math.ceil(itemCount / cols)
  return rows * tileEdge(containerWidth, density) + (rows - 1) * gap
}

// How many tiles an unrendered section stands in for, on the current tab.
export function skeletonItemCount(
  { tab, count, videoCount, loaded, loadedLength }:
  { tab: string; count?: number; videoCount?: number; loaded?: boolean; loadedLength: number },
): number {
  // Synthetic groups (favorites, place assets) and legacy timeline groups carry
  // no directory counts and are always already in hand — their real length is
  // the honest estimate, and using 0 would collapse their placeholder.
  if (count == null) return loaded === false ? 0 : Math.max(0, loadedLength)
  const total = Math.max(0, count)
  const videos = Math.max(0, videoCount ?? 0)
  if (tab === 'all') return total
  if (tab === 'video') return videos
  // The photo tab is this page's default. The directory has no photo-only
  // counter, so it is derived — estimating 0 would stop every month past the
  // first viewport from ever being requested.
  if (tab === 'photo') return Math.max(0, total - videos)
  // The doc/OCR tab has no directory counter at all; unloaded months stay hidden
  // there (registered limitation, see the P3 spec).
  return 0
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/photos/util/__tests__/gridMetrics.test.ts`
Expected: PASS。

- [ ] **Step 5: 写 CSS 一致性守卫**

```ts
// src/photos/util/__tests__/gridMetricsCssParity.test.ts
// gridMetrics.ts duplicates three numbers that only CSS can actually enforce:
// each density's minmax() floor and its gap, plus .photos-wrap's padding-right.
// If either side is edited alone, every unloaded month gets the wrong height —
// and no other gate can see it: vue-tsc does not read CSS, the build does not
// care, color-guard only looks at colors, and jsdom does no layout at all.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { GRID_METRICS, CONTENT_INSET } from '../gridMetrics'

const SRC = readFileSync('src/photos/components/PhotosGrid.vue', 'utf8')

function ruleLine(startsWith: string): string {
  const line = SRC.split('\n').find((l) => l.trimStart().startsWith(startsWith))
  expect(line, `no CSS rule in PhotosGrid.vue starting with ${startsWith}`).toBeTruthy()
  return line as string
}
function numberAfter(line: string, re: RegExp): number {
  const m = re.exec(line)
  expect(m, `pattern ${re} did not match: ${line}`).toBeTruthy()
  return Number((m as RegExpExecArray)[1])
}

const RULES: Array<[keyof typeof GRID_METRICS, string]> = [
  ['comfortable', '.grid {'],
  ['compact', '.grid[data-density="compact"]'],
  ['loose', '.grid[data-density="loose"]'],
]

describe('gridMetrics matches PhotosGrid.vue CSS', () => {
  for (const [density, selector] of RULES) {
    it(`${density}: minmax floor and gap agree with the CSS`, () => {
      const line = ruleLine(selector)
      expect(numberAfter(line, /minmax\((\d+)px/)).toBe(GRID_METRICS[density].minColWidth)
      expect(numberAfter(line, /gap:\s*(\d+)px/)).toBe(GRID_METRICS[density].gap)
    })
  }
  it('CONTENT_INSET matches .photos-wrap padding-right', () => {
    expect(numberAfter(ruleLine('.photos-wrap {'), /padding-right:\s*(\d+)px/)).toBe(CONTENT_INSET)
  })
})
```

- [ ] **Step 6: 跑守卫，并做变异验证**

Run: `pnpm test src/photos/util/__tests__/gridMetricsCssParity.test.ts`
Expected: PASS（4 例）。

变异验证（必须做，证明守卫真的在起作用）：把 `GRID_METRICS.compact.gap` 临时改成 `3`，
重跑 → 必须**红**在 compact 那一例；改回来 → 绿。把 `.grid[data-density="loose"]` 的
`minmax(200px` 临时改成 `minmax(180px`，重跑 → 必须**红**；改回来。两次变异都要真的跑一遍，
不要只在报告里声称。

- [ ] **Step 7: 提交**

```bash
git add src/photos/util/gridMetrics.ts src/photos/util/__tests__/gridMetrics.test.ts src/photos/util/__tests__/gridMetricsCssParity.test.ts
git commit -m "feat(photos): add grid geometry helpers and a CSS parity guard

The photo grid is auto-fill/minmax, so an unloaded month's placeholder height
has to be computed from the container width rather than a fixed column count.
Keeping that math in pure functions is what makes it testable at all: jsdom has
no layout engine, so geometry inside the component could only be exercised
through its degenerate path. The parity test exists because the same three
numbers live in CSS too, and a one-sided edit would silently mis-size every
placeholder with no other gate able to notice."
```

---

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

## Task 6: 网格三态渲染（骨架 / 占位 / 已渲染，暂不含 IO）

**Files:**
- Modify: `src/photos/util/assetToPhoto.ts:408-413`（`Month` 加三个可选字段）
- Modify: `src/photos/components/PhotosGrid.vue`
- Test: `src/photos/components/__tests__/PhotosGrid.test.ts`（追加）

**Interfaces:**
- Consumes: T3 `skeletonItemCount` / `estimateSectionBodyHeight` / `MONTH_HEAD_HEIGHT`
- Produces:
  - `Month` 新增 `loaded?: boolean`、`count?: number`、`videoCount?: number`
  - `PhotosGrid` 新增 emit `(e: 'need-bucket', key: string)`（本任务只声明并在骨架出现时**不**发，
    T7 接 IO 后才发）
  - 骨架 DOM：`.month-skeleton[data-test="month-skeleton"]`，行内 `height`

**这一步要修三个「首屏什么都看不到」的现成陷阱**（都已取证，别漏）：
1. `PhotosGrid.vue:273` 空态条件是 `filteredMonths.every(m => m.filtered.length === 0)` ——
   分桶模式首屏所有月份都还没加载 ⇒ 直接显示「没有照片」。
2. `:283` 月份容器 `v-if="m.filtered.length > 0"` ⇒ 未加载月份连容器都不渲染，
   跳月锚点与滚动条长度全没了。
3. `:342` 刻度尺 `v-if` 与 `:257` `onMounted` 取首月都用同一个「有照片」判据。

- [ ] **Step 1: 写失败测试**

```ts
// 追加到 src/photos/components/__tests__/PhotosGrid.test.ts
function bucketMonth(key: string, title: string, count: number, videoCount = 0): Month {
  return { key, title, loc: '', photos: [], loaded: false, count, videoCount }
}

describe('PhotosGrid bucket-mode skeletons', () => {
  it('renders a sized skeleton for an unloaded month instead of the empty state', async () => {
    const w = mount(PhotosGrid, { props: { months: [bucketMonth('2026-08', 'August 2026', 12, 3)], tab: 'photo' } })
    await nextTick()
    expect(w.find('[data-test="empty-state"]').exists()).toBe(false)
    const sk = w.find('[data-test="month-skeleton"]')
    expect(sk.exists()).toBe(true)
    expect(Number.parseFloat(sk.attributes('style')?.match(/height:\s*([\d.]+)px/)?.[1] ?? '0')).toBeGreaterThan(0)
  })

  it('keeps the month head visible on a skeleton, with the estimated count', async () => {
    const w = mount(PhotosGrid, { props: { months: [bucketMonth('2026-08', 'August 2026', 12, 3)], tab: 'photo' } })
    await nextTick()
    expect(w.find('.month-title').text()).toBe('August 2026')
    // photo tab estimate = count - videoCount = 9
    expect(w.find('.month-count').text()).toContain('9')
  })

  it('renders the month container so jump anchors exist before anything loads', async () => {
    const w = mount(PhotosGrid, { props: { months: [bucketMonth('2026-08', 'August 2026', 12)], tab: 'photo' } })
    await nextTick()
    expect(w.find('#m-2026-08').exists()).toBe(true)
  })

  it('keeps the scrubber visible while every month is still a skeleton', async () => {
    const w = mount(PhotosGrid, {
      props: { months: [bucketMonth('2026-08', 'August 2026', 12), bucketMonth('2026-07', 'July 2026', 4)], tab: 'photo' },
    })
    await nextTick()
    expect(w.find('.scrubber').exists()).toBe(true)
    expect(w.findAll('.scrubber-tick').length).toBeGreaterThan(0)
  })

  it('hides an unloaded month on the doc tab, which has no directory counter', async () => {
    const w = mount(PhotosGrid, { props: { months: [bucketMonth('2026-08', 'August 2026', 12, 3)], tab: 'doc' } })
    await nextTick()
    expect(w.find('[data-test="month-skeleton"]').exists()).toBe(false)
    expect(w.find('[data-test="empty-state"]').exists()).toBe(true)
  })

  it('still shows the empty state when there are no months at all', async () => {
    const w = mount(PhotosGrid, { props: { months: [], tab: 'photo' } })
    await nextTick()
    expect(w.find('[data-test="empty-state"]').exists()).toBe(true)
  })

  it('renders real tiles once a month is loaded', async () => {
    const m: Month = { key: '2026-08', title: 'August 2026', loc: '', photos: [photo('a1')], loaded: true, count: 1, videoCount: 0 }
    const w = mount(PhotosGrid, { props: { months: [m], tab: 'photo' } })
    await nextTick()
    expect(w.findAll('.tile')).toHaveLength(1)
    expect(w.find('[data-test="month-skeleton"]').exists()).toBe(false)
  })

  it('leaves legacy month groups (no loaded field) rendering exactly as before', async () => {
    const w = mount(PhotosGrid, { props: { months: [month('2026-08', 'August 2026', [photo('a1')])], tab: 'photo' } })
    await nextTick()
    expect(w.findAll('.tile')).toHaveLength(1)
    expect(w.find('[data-test="month-skeleton"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/photos/components/__tests__/PhotosGrid.test.ts`
Expected: FAIL —— 首例就红（现在渲染的是空态）。

- [ ] **Step 3: 扩 `Month` 类型**

`src/photos/util/assetToPhoto.ts` 的 `Month` 接口加三个可选字段：

```ts
export interface Month {
  key: string
  title: string
  loc: string
  photos: Photo[]
  // SP15-P3 bucket metadata. Absent on legacy timeline groups and on every
  // synthetic group (search results, favorites, place assets) — `loaded`
  // undefined must be read as "already loaded", never as "pending".
  loaded?: boolean
  count?: number
  videoCount?: number
}
```

顺手把 T2 里 `bucketToMonth` 的交叉返回类型收回成 `Month`。

- [ ] **Step 4: 改 `PhotosGrid.vue`**

script 里补：

```ts
import { estimateSectionBodyHeight, skeletonItemCount, MONTH_HEAD_HEIGHT } from '../util/gridMetrics'
```

emit 增加一项：

```ts
const emit = defineEmits<{
  (e: 'open', photo: Photo, list: undefined, startMs: number): void
  (e: 'toggle-select', id: string | number): void
  // Bucket mode: the grid knows which months are on screen, the parent owns the
  // store. Emitting keeps this component usable by the two consumers that have
  // no buckets at all (favorites, place assets).
  (e: 'need-bucket', key: string): void
}>()
```

`filteredMonths` 之后加派生量与三个 helper：

```ts
// Container width drives the column count (auto-fill/minmax), so it is read from
// the scroll wrap. It stays a ref rather than a getter because a resize has to
// re-run the estimates.
const wrapWidth = ref(0)
function measureWrap() { wrapWidth.value = wrapRef.value?.clientWidth ?? 0 }

function skeletonCountOf(m: Month & { filtered: Photo[] }): number {
  return skeletonItemCount({
    tab: props.tab,
    count: m.count,
    videoCount: m.videoCount,
    loaded: m.loaded,
    loadedLength: m.filtered.length,
  })
}
// A month is worth a container if it has tiles to show OR a non-zero estimate to
// stand in for. Without the second half, bucket mode's first paint would fall
// through to the empty state and no anchor would exist to scroll to.
function hasContent(m: Month & { filtered: Photo[] }): boolean {
  return m.filtered.length > 0 || skeletonCountOf(m) > 0
}
const anyContent = computed(() => filteredMonths.value.some(hasContent))
function sectionBodyHeight(m: Month & { filtered: Photo[] }): number {
  return estimateSectionBodyHeight({
    containerWidth: wrapWidth.value,
    density: props.density,
    itemCount: skeletonCountOf(m),
  })
}
function isLoaded(m: Month & { filtered: Photo[] }): boolean {
  return m.loaded !== false
}
```

`onMounted` 里改首月判据并量一次宽度：

```ts
onMounted(() => {
  measureWrap()
  const first = filteredMonths.value.find(hasContent)
  if (first) activeMonth.value = first.key
  onScroll()
})
```

模板三处改动：

```html
      <div v-if="!anyContent" class="empty-state" data-test="empty-state">
```

```html
        <template v-for="m in filteredMonths" :key="m.key">
          <div v-if="hasContent(m)" :id="'m-' + m.key" class="month-group">
            <div class="month-head">
              <div class="month-title">{{ m.key === 'unknown' ? t('photosUnknownDate') : m.title }}</div>
              <div class="month-count">
                {{ t('photosItemsCount', { count: isLoaded(m) ? m.filtered.length : skeletonCountOf(m) }) }}
              </div>
            </div>
            <div v-if="isLoaded(m)" class="grid" :data-density="density">
              <!-- 既有瓷砖循环整段不动 -->
            </div>
            <div
              v-else
              class="month-skeleton"
              data-test="month-skeleton"
              :style="{ height: sectionBodyHeight(m) + 'px' }"
            ></div>
          </div>
        </template>
```

```html
    <div v-if="anyContent" ref="scrubberRef" class="scrubber">
```

`<style scoped>` 里加骨架样式（**颜色只准用 token**）：

```css
/* Unloaded month placeholder. The gentle sweep is the only thing telling the
   user this block is still arriving rather than empty; it reuses the existing
   surface tokens so both skins stay correct. */
.month-skeleton {
  border-radius: 8px;
  background: var(--chip-bg);
  background-image: linear-gradient(90deg, transparent 0%, var(--hover) 50%, transparent 100%);
  background-size: 40% 100%;
  background-repeat: no-repeat;
  animation: month-skeleton-sweep 1.4s ease-in-out infinite;
}
@keyframes month-skeleton-sweep {
  0% { background-position: -40% 0; }
  100% { background-position: 140% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .month-skeleton { animation: none; }
}
```

这两个 token 已核过都在两套主题块里有值：`--chip-bg`（`theme.css` 三处定义）、
`--hover`（`:root` `:56` 与 light `:445`）。**注意不是 `--hover-bg`** —— 那个名字在本仓
不存在，写错会静默变成透明。别新造颜色字面量。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm test src/photos/components/__tests__/PhotosGrid.test.ts && pnpm exec vue-tsc --noEmit`
Expected: PASS，且**既有 420 行用例一个都不能红**（回退/合成分组走 `loaded === undefined`
路径，行为与改动前一致）。

- [ ] **Step 6: 跑相册区全部测试，确认没有连带回归**

Run: `pnpm test src/photos src/views/__tests__`
Expected: 全绿。

- [ ] **Step 7: 提交**

```bash
git add src/photos/util/assetToPhoto.ts src/photos/components/PhotosGrid.vue src/photos/components/__tests__/PhotosGrid.test.ts
git commit -m "feat(photos): render unloaded months as sized skeletons

Bucket mode hands the grid months it has no photos for yet, and three existing
conditions read \"no tiles\" as \"nothing here\": the empty state, the month
container's v-if and the scrubber's. Left alone they would have made the first
paint of a bucketed library show \"no photos\" with no anchors to scroll to —
the exact opposite of the phase's goal. Each now also asks whether the month has
an estimate to stand in for."
```

---

## Task 7: `IntersectionObserver` 窗口化 + 实测高度 + jsdom 降级

**Files:**
- Modify: `src/photos/components/PhotosGrid.vue`
- Test: `src/photos/components/__tests__/PhotosGrid.test.ts`（追加）

**Interfaces:**
- Consumes: T6 的 `hasContent` / `sectionBodyHeight` / `isLoaded`
- Produces: `need-bucket` 真正开始发；DOM 上 `.month-placeholder[data-test="month-placeholder"]`

**行为契约：**
- 窗口内（视口前后各 2 屏）且 `loaded` ⇒ 真实瓷砖
- 窗口外且**量过**真实高度 ⇒ `.month-placeholder`，行内高度 = 实测值
- 窗口外且没量过、或 `!loaded` ⇒ T6 的 `.month-skeleton`
- 进入窗口且 `loaded === false` ⇒ `emit('need-bucket', key)`（同一 key 每次进入都可以发，
  store 侧已按 key 去重）
- `IntersectionObserver` 不存在（jsdom）或容器宽度为 0 ⇒ **全部视为在窗口内**（等于改动前行为）

- [ ] **Step 1: 写失败测试**

```ts
// 追加到 src/photos/components/__tests__/PhotosGrid.test.ts
class FakeIO {
  static instances: FakeIO[] = []
  cb: IntersectionObserverCallback
  targets: Element[] = []
  constructor(cb: IntersectionObserverCallback) { this.cb = cb; FakeIO.instances.push(this) }
  observe(el: Element) { this.targets.push(el) }
  unobserve(el: Element) { this.targets = this.targets.filter((t) => t !== el) }
  disconnect() { this.targets = [] }
  takeRecords(): IntersectionObserverEntry[] { return [] }
  fire(el: Element, isIntersecting: boolean) {
    this.cb(
      [{ target: el, isIntersecting } as unknown as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }
}

describe('PhotosGrid windowing', () => {
  beforeEach(() => {
    FakeIO.instances = []
    ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeIO
  })
  afterEach(() => {
    delete (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver
  })

  const loadedMonth = (key: string, ids: string[]): Month => ({
    key, title: key, loc: '', photos: ids.map((id) => photo(id)), loaded: true, count: ids.length, videoCount: 0,
  })

  it('observes every month container', async () => {
    const w = mount(PhotosGrid, { props: { months: [loadedMonth('2026-08', ['a1']), loadedMonth('2026-07', ['a2'])], tab: 'photo' } })
    await nextTick()
    expect(FakeIO.instances[0].targets).toHaveLength(2)
  })

  it('asks for a bucket when an unloaded month enters the window', async () => {
    const w = mount(PhotosGrid, { props: { months: [bucketMonth('2026-08', 'August 2026', 12)], tab: 'photo' } })
    await nextTick()
    const io = FakeIO.instances[0]
    io.fire(w.find('#m-2026-08').element, true)
    await nextTick()
    expect(w.emitted('need-bucket')?.[0]).toEqual(['2026-08'])
  })

  it('never asks for a bucket for a group that has no bucket at all', async () => {
    // Favorites and place-assets feed synthetic groups: loaded is undefined.
    const w = mount(PhotosGrid, { props: { months: [month('2026-08', 'August 2026', [photo('a1')])], tab: 'photo' } })
    await nextTick()
    FakeIO.instances[0].fire(w.find('#m-2026-08').element, true)
    await nextTick()
    expect(w.emitted('need-bucket')).toBeUndefined()
  })

  it('swaps a rendered month for a measured placeholder when it leaves the window', async () => {
    const w = mount(PhotosGrid, { props: { months: [loadedMonth('2026-08', ['a1', 'a2'])], tab: 'photo' } })
    await nextTick()
    const el = w.find('#m-2026-08').element as HTMLElement
    const io = FakeIO.instances[0]
    io.fire(el, true)
    await nextTick()
    // jsdom reports offsetHeight 0; stub it so the measurement path is exercised.
    Object.defineProperty(el, 'offsetHeight', { configurable: true, value: 321 })
    io.fire(el, false)
    await nextTick()
    expect(w.findAll('.tile')).toHaveLength(0)
    const ph = w.find('[data-test="month-placeholder"]')
    expect(ph.exists()).toBe(true)
    expect(ph.attributes('style')).toContain('321px')
  })

  it('renders tiles again when the month comes back into the window', async () => {
    const w = mount(PhotosGrid, { props: { months: [loadedMonth('2026-08', ['a1'])], tab: 'photo' } })
    await nextTick()
    const el = w.find('#m-2026-08').element as HTMLElement
    const io = FakeIO.instances[0]
    io.fire(el, true); await nextTick()
    io.fire(el, false); await nextTick()
    io.fire(el, true); await nextTick()
    expect(w.findAll('.tile')).toHaveLength(1)
  })

  it('renders everything when IntersectionObserver is missing', async () => {
    delete (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver
    const w = mount(PhotosGrid, { props: { months: [loadedMonth('2026-08', ['a1']), loadedMonth('2026-07', ['a2'])], tab: 'photo' } })
    await nextTick()
    expect(w.findAll('.tile')).toHaveLength(2)
    expect(w.find('[data-test="month-placeholder"]').exists()).toBe(false)
  })

  it('disconnects the observer on unmount', async () => {
    const w = mount(PhotosGrid, { props: { months: [loadedMonth('2026-08', ['a1'])], tab: 'photo' } })
    await nextTick()
    const io = FakeIO.instances[0]
    w.unmount()
    expect(io.targets).toHaveLength(0)
  })

  it('observes a month that appears after a directory refresh', async () => {
    const w = mount(PhotosGrid, { props: { months: [loadedMonth('2026-08', ['a1'])], tab: 'photo' } })
    await nextTick()
    await w.setProps({ months: [loadedMonth('2026-08', ['a1']), bucketMonth('2026-07', 'July 2026', 4)] })
    await nextTick()
    expect(FakeIO.instances[0].targets).toHaveLength(2)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/photos/components/__tests__/PhotosGrid.test.ts`
Expected: FAIL —— 没有 observer、也没有 `need-bucket`。

- [ ] **Step 3: 实现**

script 里加窗口状态与 observer：

```ts
// Month-section windowing. Far-away months keep their container (anchors and
// scroll length depend on it) but drop their tiles, so the DOM stays a constant
// size no matter how far the user scrolls. Which months count as near is left to
// the browser: rootMargin gives it two viewports of slack in both directions.
const WINDOW_MARGIN = '200% 0px'
const activeKeys = ref<Set<string>>(new Set())
// Measured heights survive a section being torn down, so a placeholder can keep
// the exact height its tiles had — this is what stops the scrollbar from jumping.
// Not reactive: it is only read while rendering a section that just changed.
const measuredHeights = new Map<string, number>()
let observer: IntersectionObserver | null = null
const windowingActive = ref(false)

function keyOf(el: Element): string { return (el.id || '').replace(/^m-/, '') }

function onIntersect(entries: IntersectionObserverEntry[]) {
  const next = new Set(activeKeys.value)
  for (const entry of entries) {
    const key = keyOf(entry.target)
    if (!key) continue
    if (entry.isIntersecting) {
      next.add(key)
      const m = filteredMonths.value.find((x) => x.key === key)
      // Only bucket-backed months have something to fetch; a synthetic group
      // (favorites, place assets) has loaded === undefined and must never emit.
      if (m && m.loaded === false) emit('need-bucket', key)
    } else {
      const el = entry.target as HTMLElement
      const h = el.offsetHeight
      // Record before dropping the tiles: once they are gone the height is the
      // placeholder's own, which would ratchet the section down over time.
      if (h > 0) measuredHeights.set(key, h)
      next.delete(key)
    }
  }
  activeKeys.value = next
}

function syncObserver() {
  if (!observer) return
  observer.disconnect()
  for (const m of filteredMonths.value) {
    if (!hasContent(m)) continue
    const el = document.getElementById(`m-${m.key}`)
    if (el) observer.observe(el)
  }
}

function isWindowed(m: Month & { filtered: Photo[] }): boolean {
  // Degraded environments (jsdom has no IntersectionObserver; a display:none
  // container reports width 0) render everything, which is exactly the
  // pre-windowing behaviour.
  if (!windowingActive.value) return true
  return activeKeys.value.has(m.key)
}
function placeholderHeight(m: Month & { filtered: Photo[] }): number | null {
  const h = measuredHeights.get(m.key)
  return h != null && h > 0 ? h : null
}
```

`onMounted` 末尾接上：

```ts
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(onIntersect, { root: wrapRef.value, rootMargin: WINDOW_MARGIN })
    windowingActive.value = true
    syncObserver()
  }
```

`watch` 区加一条（月份集合变化后重挂）：

```ts
watch(() => filteredMonths.value.map((m) => m.key).join('|'), () => {
  void nextTick().then(() => { measureWrap(); syncObserver() })
})
```

`onBeforeUnmount` 里补：

```ts
  observer?.disconnect()
  observer = null
```

模板把「已加载」那一支再分成两态：

```html
            <div v-if="isLoaded(m) && isWindowed(m)" class="grid" :data-density="density">
              <!-- 既有瓷砖循环 -->
            </div>
            <div
              v-else-if="isLoaded(m) && placeholderHeight(m) !== null"
              class="month-placeholder"
              data-test="month-placeholder"
              :style="{ height: placeholderHeight(m) + 'px' }"
            ></div>
            <div
              v-else
              class="month-skeleton"
              data-test="month-skeleton"
              :style="{ height: sectionBodyHeight(m) + 'px' }"
            ></div>
```

样式（占位不需要流光，它不是「在加载」）：

```css
/* A section that has been rendered once and scrolled away: same height, no
   content, no shimmer — nothing is pending here. */
.month-placeholder { border-radius: 8px; }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/photos/components/__tests__/PhotosGrid.test.ts && pnpm exec vue-tsc --noEmit`
Expected: PASS。

- [ ] **Step 5: 确认既有消费方零回归**

Run: `pnpm test src/photos src/views/__tests__`
Expected: 全绿 —— 既有用例都没装 `IntersectionObserver`，走降级路径（全渲染）。

- [ ] **Step 6: 提交**

```bash
git add src/photos/components/PhotosGrid.vue src/photos/components/__tests__/PhotosGrid.test.ts
git commit -m "feat(photos): window month sections with an IntersectionObserver

Loading on demand is not enough on its own: scrolling far enough still piles up
tens of thousands of tiles. Sections far from the viewport now keep their
container but drop their tiles, and the height they are replaced with is the one
that was measured while they were rendered — an estimate there would move the
scrollbar under the user. Deciding what is near is left to the browser, and when
no observer exists the component renders everything, which is what the two
consumers with no buckets and the whole existing test suite already expect."
```

---

## Task 8: `Photos.vue` 接线（保留未加载月份 / 按需请求 / 死刻度）

**Files:**
- Modify: `src/views/Photos.vue:75-79`（`gridMonths`）、模板上的 `<PhotosGrid>`
- Modify: `src/photos/components/PhotosGrid.vue`（刻度尺 `data-disabled`）
- Test: `src/views/__tests__/Photos.buckets.test.ts`（**新建 → 必须登记 `oss/manifest.mjs`**）

**Interfaces:**
- Consumes: T5 `store.fetchBucket`；T7 `need-bucket`
- Produces: 无新导出

- [ ] **Step 1: 写失败测试**

新建 `src/views/__tests__/Photos.buckets.test.ts`。**mock 形状照
`src/views/__tests__/Photos.integration.test.ts` 现成的那套抄**（它已经把
`@nimotech/nimoos-service`、router、MessageBus 都 mock 好了）—— 先读那个文件，照它的
`beforeEach` 与 mock 清单建同款骨架，只把断言换成下面这些：

```ts
  it('keeps unloaded months in gridMonths so the grid can render skeletons', async () => {
    // store in bucket mode with one unloaded month -> the view must not filter it
    // out; Photos.vue:78's `.filter(m => m.photos.length > 0)` would have.
  })
  it('drops unloaded months once an EXIF filter is active', async () => {
    // Registered limitation (spec 5.1): an unloaded month's membership is
    // unknown, so it is hidden rather than guessed at.
  })
  it('forwards need-bucket to the store', async () => {
    // expect(timeline.fetchBucket).toHaveBeenCalledWith('2026-07')
  })
```

三例都要写成可跑的完整代码（照 integration 测试的 mount 方式），不要留注释占位。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/views/__tests__/Photos.buckets.test.ts`
Expected: FAIL。

- [ ] **Step 3: 改 `Photos.vue`**

```ts
// 分桶模式下未加载的月份 photos 恒为空数组,不能被这条 filter 吃掉 —— 它是 PhotosGrid
// 画骨架、也是滚动条长度与跳月锚点的来源。
// 一旦 EXIF 筛选生效就恢复原样丢弃:未加载月份里到底有没有符合筛选的照片,前端无从得知
// (spec §5.1 已登记为遗留限制,真正的修法是后端筛选)。
const exifFilterActive = computed(() => {
  const f = exifFilter.value
  return f.years.length > 0 || f.places.length > 0 || f.cameras.length > 0
})
const gridMonths = computed(() =>
  store.months
    .map((m) => ({ ...m, photos: applyExifFilters(m.photos, exifFilter.value) }))
    .filter((m) => m.photos.length > 0 || (m.loaded === false && !exifFilterActive.value)),
)
```

模板给 `<PhotosGrid>` 加一行：

```html
            @need-bucket="(k: string) => store.fetchBucket(k)"
```

`filteredCount` 不动（它数的是真实照片数，未加载月份贡献 0 —— 与「顶部统计用目录精确值」
是两回事，本任务不改它，若评审认为该改，登记成后续票）。

- [ ] **Step 4: 刻度尺死刻度置灰**

`PhotosGrid.vue` 的 `scrubberTicks` 现在从 `props.months` 走、与模板的 `filteredMonths`
两套判据，会出现「点了没反应」的死刻度。改成从**同一个** `filteredMonths` 取，
并给不显示的月份打 `disabled`：

```ts
const scrubberTicks = computed(() => {
  const ticks: Array<{ label: string; major: boolean; key: string; disabled: boolean }> = []
  const seenYears = new Set<string>()
  // Read the same array the template's v-if reads, so a tick's disabled state can
  // never disagree with whether that month actually renders.
  for (const m of filteredMonths.value) {
    if (!m.key || m.key === 'unknown' || m.key === 'search' || !m.key.includes('-')) continue
    const [year, mo] = m.key.split('-')
    if (!seenYears.has(year)) {
      seenYears.add(year)
      // Year ticks are never disabled — they are not click targets to begin with.
      ticks.push({ label: year, major: true, key: `y-${year}`, disabled: false })
    }
    const abbr = new Date(+year, +mo - 1).toLocaleString('en', { month: 'short' })
    ticks.push({ label: abbr, major: false, key: m.key, disabled: !hasContent(m) })
  }
  return ticks
})
```

模板：

```html
          :data-major="tk.major" :data-active="tk.key === activeMonth" :data-disabled="tk.disabled"
          :style="{ top: tickTop(i), cursor: (tk.major || tk.disabled) ? 'default' : 'pointer' }"
          @click="!tk.major && !tk.disabled && jumpTo(tk.key)"
```

样式：

```css
/* A month hidden by the current tab or filter has no anchor to jump to. */
.scrubber-tick[data-disabled="true"] { opacity: 0.35; }
```

追加一例到 `PhotosGrid.test.ts`：

```ts
  it('disables the tick of a month the current tab hides', async () => {
    const w = mount(PhotosGrid, {
      props: { months: [bucketMonth('2026-08', 'August 2026', 12, 3)], tab: 'doc' },
    })
    await nextTick()
    const tick = w.findAll('.scrubber-tick').find((t) => t.attributes('data-major') !== 'true')
    expect(tick?.attributes('data-disabled')).toBe('true')
  })
```

注意：`doc` tab 下该月不显示 ⇒ `anyContent` 为假 ⇒ 刻度尺整块 `v-if` 不渲染，这一例会
拿不到刻度。**所以这个用例要给两个月份**：一个在 doc tab 下有内容（放一张 `hasOcr: true`
的照片、`loaded: true`），一个是未加载的分桶月份 ⇒ 刻度尺渲染、且后者的刻度 disabled。
写测试时按这个形状构造，别照抄上面那段的单月份版本。

- [ ] **Step 5: 登记开源清单**

`oss/manifest.mjs` 的视图测试段（`'src/views/__tests__/Photos.route.test.ts'` 附近）
按字母序插入一行，并在旁边写一句为什么：

```js
  // SP15-P3: bucket-mode wiring test for Photos.vue.
  'src/views/__tests__/Photos.buckets.test.ts',
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm test src/views/__tests__/Photos.buckets.test.ts src/photos/components/__tests__/PhotosGrid.test.ts && pnpm test oss && pnpm exec vue-tsc --noEmit`
Expected: 全绿（`oss/photosStripCoverage.test.mjs` 会验刚加的那行）。

- [ ] **Step 7: 提交**

```bash
git add src/views/Photos.vue src/views/__tests__/Photos.buckets.test.ts src/photos/components/PhotosGrid.vue src/photos/components/__tests__/PhotosGrid.test.ts oss/manifest.mjs
git commit -m "feat(photos): wire bucket loading into the timeline view

The view used to drop every month with no photos in it, which in bucket mode is
every month that has not been scrolled to yet — so the filter now keeps unloaded
months unless an EXIF filter is active, where a month's membership genuinely is
unknown. The scrubber also stopped deriving its ticks from a different array
than the template renders from, which is what let it offer ticks that jump
nowhere."
```

---

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

## Task 11: 收藏页分页 + 精确总数 + 已加载提示

**Files:**
- Modify: `src/photos/stores/favorites.ts`
- Modify: `src/views/PhotosFavorites.vue`
- Modify: `src/i18n/zh_cn.photos.ts` / `src/i18n/en_us.photos.ts`（`photosLoadMore`、`photosLoadedSubsetHint`）
- Test: `src/photos/stores/__tests__/favorites.test.ts`、`src/views/__tests__/PhotosFavorites.test.ts`

**Interfaces:**
- Produces（favorites store）：
  - `favoritesExhausted: Ref<boolean>`、`loadingMore: Ref<boolean>`
  - `favoritesTotal: ComputedRef<number>`
  - `loadMoreFavorites(): Promise<void>`
  - `fetchFavorites()` 语义变为「取第一页并复位游标」
  - 常量 `FAVORITES_PAGE_SIZE = 500`

- [ ] **Step 1: 写失败测试（store）**

```ts
  const A = (id: string) => ({ id, mimeType: 'image/jpeg' })
  const page = (n: number, from = 0) => Array.from({ length: n }, (_, i) => A(`f${from + i}`))

  it('fetchFavorites asks for one page and reports exhaustion on a short page', async () => {
    const s = usePhotosFavorites()
    svc.photos.listFavorites.mockResolvedValueOnce(page(3))
    await s.fetchFavorites()
    expect(svc.photos.listFavorites).toHaveBeenCalledWith(500, 0)
    expect(s.favoritesExhausted).toBe(true)
  })

  it('loadMoreFavorites appends the next page and advances the offset', async () => {
    const s = usePhotosFavorites()
    svc.photos.listFavorites.mockResolvedValueOnce(page(500))
    await s.fetchFavorites()
    expect(s.favoritesExhausted).toBe(false)
    svc.photos.listFavorites.mockResolvedValueOnce(page(2, 500))
    await s.loadMoreFavorites()
    expect(svc.photos.listFavorites).toHaveBeenLastCalledWith(500, 500)
    expect(s.favoritesList).toHaveLength(502)
    expect(s.favoritesExhausted).toBe(true)
  })

  it('refuses to page past the end', async () => {
    const s = usePhotosFavorites()
    svc.photos.listFavorites.mockResolvedValueOnce(page(3))
    await s.fetchFavorites()
    await s.loadMoreFavorites()
    expect(svc.photos.listFavorites).toHaveBeenCalledTimes(1)
  })

  it('does not run two loadMore requests at once', async () => {
    const s = usePhotosFavorites()
    svc.photos.listFavorites.mockResolvedValueOnce(page(500))
    await s.fetchFavorites()
    svc.photos.listFavorites.mockResolvedValue(page(500, 500))
    await Promise.all([s.loadMoreFavorites(), s.loadMoreFavorites()])
    expect(svc.photos.listFavorites).toHaveBeenCalledTimes(2) // first page + one loadMore
  })

  it('discards a stale in-flight page after a refresh (interleaved)', async () => {
    const s = usePhotosFavorites()
    svc.photos.listFavorites.mockResolvedValueOnce(page(500))
    await s.fetchFavorites()
    let release: (v: unknown) => void = () => {}
    svc.photos.listFavorites.mockImplementationOnce(() => new Promise((r) => { release = r }))
    const slow = s.loadMoreFavorites()
    svc.photos.listFavorites.mockResolvedValueOnce(page(1))
    await s.fetchFavorites()          // generation bumps here
    release(page(500, 500))           // the slow page comes back afterwards
    await slow
    expect(s.favoritesList).toHaveLength(1)
    expect(s.loadingMore).toBe(false)
  })

  it('resets the cursor on a failed page so the next attempt does not skip rows', async () => {
    const s = usePhotosFavorites()
    svc.photos.listFavorites.mockResolvedValueOnce(page(500))
    await s.fetchFavorites()
    svc.photos.listFavorites.mockRejectedValueOnce(new Error('boom'))
    await s.loadMoreFavorites()
    expect(s.loadingMore).toBe(false)
    svc.photos.listFavorites.mockResolvedValueOnce(page(1, 500))
    await s.loadMoreFavorites()
    expect(svc.photos.listFavorites).toHaveBeenLastCalledWith(500, 500)
  })

  it('reports the exact total from the id list, and the loaded length before ids land', async () => {
    const s = usePhotosFavorites()
    svc.photos.listFavorites.mockResolvedValueOnce(page(500))
    await s.fetchFavorites()
    expect(s.favoritesTotal).toBe(500)          // favIds not loaded yet: no flash of 0
    svc.photos.listFavoriteIds.mockResolvedValueOnce(Array.from({ length: 1234 }, (_, i) => `f${i}`))
    await s.reconcileFavIds()
    expect(s.favoritesTotal).toBe(1234)
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/photos/stores/__tests__/favorites.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现（store）**

```ts
// NimoOS-Photos#54 turned an absent limit from "everything" into 500, so this
// list has to be paged or it silently truncates. A generation counter guards the
// shared state: a slow page that lands after a refresh must be dropped whole
// rather than appended to a list it no longer belongs to.
const FAVORITES_PAGE_SIZE = 500

  const favoritesExhausted = ref(false)
  const loadingMore = ref(false)
  let _offset = 0
  let _generation = 0

  // Exact count from the server's full id list. favoritesList.length is only the
  // pages fetched so far, and favIds lands independently — falling back to the
  // loaded length keeps the header from flashing 0 while ids are in flight.
  const favoritesTotal = computed(() =>
    favIdsLoaded.value ? favIds.value.size : (favoritesList.value?.length ?? 0),
  )
```

`fetchFavorites` 改成取第一页并复位：

```ts
  async function fetchFavorites(): Promise<void> {
    const gen = ++_generation
    loadingMore.value = false
    try {
      const list = (await service.photos.listFavorites(FAVORITES_PAGE_SIZE, 0)) as unknown[]
      if (gen !== _generation) return
      const rows = list ?? []
      favoritesList.value = rows.map((a) => assetToPhoto(a as Record<string, unknown>))
      _offset = rows.length
      favoritesExhausted.value = rows.length < FAVORITES_PAGE_SIZE
      favoritesLoaded.value = true
      loadError.value = false
    } catch (e) {
      if (gen !== _generation) return
      favoritesList.value = []
      _offset = 0
      favoritesExhausted.value = false
      loadError.value = true
      console.error('[photos-favorites] fetchFavorites', e)
    }
  }

  async function loadMoreFavorites(): Promise<void> {
    if (favoritesExhausted.value || loadingMore.value) return
    const gen = _generation
    loadingMore.value = true
    try {
      const list = (await service.photos.listFavorites(FAVORITES_PAGE_SIZE, _offset)) as unknown[]
      // A refresh happened while this page was in flight: drop it entirely.
      if (gen !== _generation) return
      const rows = list ?? []
      favoritesList.value = [
        ...(favoritesList.value ?? []),
        ...rows.map((a) => assetToPhoto(a as Record<string, unknown>)),
      ]
      _offset += rows.length
      if (rows.length < FAVORITES_PAGE_SIZE) favoritesExhausted.value = true
    } catch (e) {
      // Leave the cursor where it was so the retry asks for the same page again
      // rather than skipping it.
      console.error('[photos-favorites] loadMoreFavorites', e)
    } finally {
      if (gen === _generation) loadingMore.value = false
    }
  }
```

`toggle()` 里 `favoritesLoaded.value = false` 之外，**同时**把 `_offset` / `favoritesExhausted`
复位（下次进页面重新从第一页取），并在 `__resetForTest` 里清 `_offset` / `_generation` /
`favoritesExhausted` / `loadingMore`。return 里补四个新导出。

- [ ] **Step 4: 改视图**

`src/views/PhotosFavorites.vue`：
- 「全部 N」那个计数（`:205` 的 `photosFavCount`）改用 `fav.favoritesTotal`
- 网格下方加「加载更多」按钮：`v-if="!fav.favoritesExhausted"`，
  `:disabled="fav.loadingMore"`，文案 `t('photosLoadMore')`
- 统计卡/筛选下拉上方加提示行：`v-if="!fav.favoritesExhausted"`，
  `t('photosLoadedSubsetHint', { n: fav.favoritesList?.length ?? 0 })`，
  样式复用既有 `--fg-muted` 小字，不新增颜色 token
- 按钮/提示行的类名沿用本文件既有小字/次要按钮类，**不新造视觉**

追加视图测试（`src/views/__tests__/PhotosFavorites.test.ts`）：

```ts
  it('shows the load-more button only while pages remain', async () => { /* … */ })
  it('shows the loaded-subset hint with the loaded count', async () => { /* … */ })
  it('shows the exact total in the All chip, not the loaded length', async () => { /* … */ })
```
三例写完整代码，照该文件现有 mount 方式。

- [ ] **Step 5: 加 i18n 两键**

`src/i18n/zh_cn.photos.ts` / `en_us.photos.ts` 按字母序插：

```ts
  photosLoadedSubsetHint: '统计基于已加载的前 {n} 项',
  photosLoadMore: '加载更多',
```
```ts
  photosLoadedSubsetHint: 'Stats reflect the first {n} loaded items',
  photosLoadMore: 'Load more',
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm test src/photos/stores/__tests__/favorites.test.ts src/views/__tests__/PhotosFavorites.test.ts src/i18n && pnpm exec vue-tsc --noEmit`
Expected: 全绿（含 `parity.test.ts`）。

- [ ] **Step 7: 提交**

```bash
git add src/photos/stores/favorites.ts src/views/PhotosFavorites.vue src/views/__tests__/PhotosFavorites.test.ts src/photos/stores/__tests__/favorites.test.ts src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts
git commit -m "fix(photos): page the favorites list instead of asking for everything

An absent limit stopped meaning \"all rows\" on the backend, so this page would
silently show only the first 500 favorites with nothing on screen saying so.
Pages are appended behind a load-more button, the count comes from the full id
list so it stays exact while pagination catches up, and the derived stats say
out loud that they only cover what is loaded. A generation counter drops a page
that lands after a refresh, which would otherwise append rows to a list they no
longer belong to."
```

---

## Task 12: 回收站分页 + 清空文案降级

**Files:**
- Modify: `src/photos/stores/trash.ts`
- Modify: `src/views/PhotosTrash.vue`
- Modify: `src/i18n/zh_cn.photos.ts` / `en_us.photos.ts`（两键）
- Test: `src/photos/stores/__tests__/trash.test.ts`、`src/views/__tests__/PhotosTrash.test.ts`

**Interfaces:**
- Produces（trash store）：`trashExhausted`、`loadingMore`、`loadMoreTrash()`、
  `TRASH_PAGE_SIZE = 500`；`fetchTrash()` 语义变为「取第一页并复位游标」

- [ ] **Step 1: 写失败测试**

store 侧照 T11 的七个形状各写一遍（`listTrash(500, 0)`、追加、拒绝越界、并发去重、
**交错**陈旧丢弃、失败不推进游标、`fetchTrash` 复位）。视图侧三例：

```ts
  it('uses the size-less empty copy while pages remain', async () => {
    // trashExhausted false -> confirm dialog body is photosTrashEmptyBodyPartial
  })
  it('uses the exact copy with the freed size once everything is loaded', async () => {
    // trashExhausted true -> photosTrashEmptyBody with {size}
  })
  it('shows the load-more button only while pages remain', async () => { /* … */ })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/photos/stores/__tests__/trash.test.ts src/views/__tests__/PhotosTrash.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现（store）**

与 T11 同构：`TRASH_PAGE_SIZE = 500`、`_offset`、`_generation`、`trashExhausted`、
`loadingMore`、`loadMoreTrash()`；`fetchTrash()` 改成 `service.photos.listTrash(500, 0)`
并复位游标；`restore/restoreAll/purge/empty/undoRestore` 结尾的 `await fetchTrash()`
保持不变（它现在就是「回到第一页」，语义正确）。

- [ ] **Step 4: 改视图**

`src/views/PhotosTrash.vue`：
- 「清空回收站」确认框：`trash.trashExhausted ? t('photosTrashEmptyBody', { size }) : t('photosTrashEmptyBodyPartial')`；
  成功 toast 同理在 `photosTrashEmptiedToast` / `photosTrashEmptiedToastPartial` 之间选
- **「恢复全部」那一路不改**（`photosTrashRestoreAllBody` / `photosTrashRestoredToast`
  本来就不带容量，见 Global Constraints 的键表）
- Hero 里那行 `<b>{{ totalSize }} MB</b>`：未取完时容量只是已加载部分 ⇒ 在它后面接
  `t('photosLoadedSubsetHint', { n: trash.items.length })`（复用 T11 的键，不新增）
- 网格下方「加载更多」按钮，同 T11 形态

- [ ] **Step 5: 加 i18n 两键**

```ts
  photosTrashEmptiedToastPartial: '最近删除已清空',
  photosTrashEmptyBodyPartial: '这将释放 NAS 上的空间，原始文件将无法恢复。',
```
```ts
  photosTrashEmptiedToastPartial: 'Trash emptied',
  photosTrashEmptyBodyPartial: "This frees up space on the NAS. Once gone, the originals can't be recovered.",
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm test src/photos/stores/__tests__/trash.test.ts src/views/__tests__/PhotosTrash.test.ts src/i18n && pnpm exec vue-tsc --noEmit`
Expected: 全绿。

- [ ] **Step 7: 提交**

```bash
git add src/photos/stores/trash.ts src/views/PhotosTrash.vue src/views/__tests__/PhotosTrash.test.ts src/photos/stores/__tests__/trash.test.ts src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts
git commit -m "fix(photos): page the trash list and stop promising a size it cannot know

Trash pages for the same reason favorites does: an absent limit now means 500.
The freed-space figure is computed from the loaded items, so while pages remain
the empty-trash confirmation drops the megabyte figure instead of quoting a
number that only covers part of the bin. Restore-all needs no such split — its
copy never quoted a size."
```

---

## Task 13: 收尾 —— 懒加载补齐、六道门、台账、验收清单

**Files:**
- Modify: `src/views/PhotosAlbumDetail.vue:817`
- Create: `docs/superpowers/2026-08-10-sp15-p3-acceptance.md`
- Create: `.superpowers/sdd/2026-08-10-sp15-p3-timeline-performance/progress.md`

- [ ] **Step 1: 相册详情瓷砖补懒加载**

```html
                  <img :src="thumbnailUrl(p.id, 'small')" alt="" loading="lazy">
```

- [ ] **Step 2: 跑六道门（全套，逐条记下真实数字）**

```bash
pnpm exec vue-tsc --noEmit
pnpm test
pnpm test oss
pnpm build
```
`color-guard` 与开源导出门都在 `pnpm test` / `pnpm test oss` 覆盖内；**开源导出门在脏工作树上
会中止**，所以先 `git status --short` 确认干净再跑。数字（文件数 / 用例数 / build 秒数）
逐条抄进台账，不要写「全绿」了事。

- [ ] **Step 3: 与 master 做只读合并预演**

```bash
git merge-tree --write-tree master HEAD | head -3
```
退出码 0 且只输出一行 tree OID ⇒ 无冲突。**不要真的合并。**

- [ ] **Step 4: 写验收清单**

`docs/superpowers/2026-08-10-sp15-p3-acceptance.md`，照 spec §6.3 的五步展开，每步写清
「点哪里 / 看什么 / 期望什么」，并在开头写明：

- 第 1–4 步**需要机主先把 `NimoOS-Photos` 升到 origin/main 并部署**，第 5 步现在就能验；
- 第 5 步验完若要继续验 1–4 步，**部署后端后要硬刷新页面**（目录探测有 10 分钟退避，
  见 spec §5.5）；
- 库很小（几百张、月份少），**看不出「变快」是预期的**，验的是机制在跑。

- [ ] **Step 5: 写台账**

`.superpowers/sdd/2026-08-10-sp15-p3-timeline-performance/progress.md`：逐任务记
「做了什么 / 计划被实测推翻的地方 / 评审逮到什么 / 挂账」，并把 spec §5 那五条已知限制
原样抄一遍（这是「白纸黑字登记」的落地），另加本期新登记的限制与后续票。

- [ ] **Step 6: 提交**

```bash
git add src/views/PhotosAlbumDetail.vue docs/superpowers/2026-08-10-sp15-p3-acceptance.md .superpowers/sdd/2026-08-10-sp15-p3-timeline-performance/progress.md
git commit -m "docs(sp15): close out the P3 timeline performance line

The album detail tiles were the last grid in the area still loading every
thumbnail eagerly. The acceptance checklist is written for a mechanism-level
run because the device library is a few hundred assets: nothing here will look
faster, so each step names the request or the DOM change that proves the
machinery is live, and the first four steps say up front that they need the
backend the owner is deploying."
```

---

## Self-Review

**Spec 覆盖核对**（spec 章节 → 任务）：

| spec | 任务 |
|---|---|
| §1.1/1.2 目录与单桶接口 | T1 T4 T5 |
| §1.4 收藏/回收站 500 语义 | T1 T11 T12 |
| §3.1 store 分桶状态/探测/回退/退避/月份/计数 | T4 |
| §3.1 单桶翻页 + 目录失效 | T5 |
| §3.2 两个纯函数模块 | T2 T3 |
| §3.3 三态 + IO + 实测高度 + 降级 | T6 T7 |
| §3.3 tab/筛选/刻度尺 | T6（tab）T8（筛选 + 死刻度）|
| §3.4 三个消费方兼容 | T6 T7（`loaded === undefined` = 已加载，`need-bucket` 只在 `false` 时发）|
| §3.5 写路径增量化 + 轮询 | T9 T10 |
| §3.6 两页分页 + generation 守卫 | T11 T12 |
| §4 i18n 四键 | T11 T12 |
| §5 限制登记 | T13（台账）+ 各任务代码注释 |
| §6.1 六道门 | 各任务局部 + T13 全套 |
| §6.2 CSS↔TS 守卫 | T3（含变异验证）|
| §6.3 机制层验收清单 | T13 |
| §2.1-13 相册详情懒加载 | T13 |

**类型/命名一致性**（跨任务对齐过）：`bucketKey` / `parseBucketKey` / `normalizeBuckets` /
`bucketToMonth` / `staleBucketKeys`（T2 定义，T4 T5 T9 使用）· `columnsFor` / `tileEdge` /
`estimateSectionBodyHeight` / `skeletonItemCount` / `GRID_METRICS` / `CONTENT_INSET` /
`FALLBACK_CONTAINER_WIDTH` / `MONTH_HEAD_HEIGHT`（T3 定义，T6 T7 使用）· `bucketMode` /
`buckets` / `bucketAssets` / `bucketLoading` / `fetchBucket` / `refreshBuckets` / `totalCount`
（T4 T5 定义，T8 T9 T10 使用）· `need-bucket`（T7 定义，T8 接线）· `favoritesExhausted` /
`loadingMore` / `favoritesTotal` / `loadMoreFavorites`（T11）· `trashExhausted` /
`loadMoreTrash`（T12）。

**已知的两处「计划自己踩过的坑」**（实现期若与实际不符，按实际改并在台账登记）：

1. T2 的 `bucketToMonth` 返回类型在 T6 扩 `Month` 之前只能用交叉类型顶着 —— 已在 T2 Step 4
   写明处置，不要在 T2 里提前改 `Month`（那会让 T6 的失败测试一开始就是绿的）。
2. T8 Step 4 那个刻度尺用例，单月份写法会因为 `anyContent` 为假而拿不到刻度 ——
   已就地写明必须构造两个月份。

**未在任务里解决、留作后续票的**：`Photos.vue` 的 `filteredCount`（工具栏计数）在分桶模式下
仍只数已加载照片，与顶部目录精确计数口径不同（T8 明确不改，评审若认为该统一，开票）。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-10-sp15-p3-timeline-performance.md`.
