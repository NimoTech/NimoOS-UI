## Task 2: 混排模型与全局排序（纯函数） ← 逐任务评审

**Files:**
- Create: `src/photos/util/mixedAlbums.ts`
- Create: `src/photos/util/__tests__/mixedAlbums.test.ts`
- Modify: `src/photos/util/albumView.ts`（**删除** `sortAlbums`）
- Modify: `src/photos/util/__tests__/albumView.test.ts`（删除 `sortAlbums` 的 describe）
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`（删 2 死键）
- Modify: `oss/manifest.mjs`

**Interfaces:**
- Consumes: `AlbumView`（含 T1 新加的 `videoCount`/`dateStart`）、`SmartView`（含 T1 的 `createdAt`）
- Produces（T3 依赖这些确切签名）：
  - `export type MixedSortId = 'created' | 'name' | 'name-r' | 'count' | 'date'`
  - `export type MixedAlbumItem = { kind: 'user'; id: string | number; view: AlbumView } | { kind: 'smart'; id: string; sv: SmartView }`
  - `export function buildMixedAlbums(views: AlbumView[], svs: SmartView[]): MixedAlbumItem[]`
  - `export function sortMixed(items: MixedAlbumItem[], sort: MixedSortId | string): MixedAlbumItem[]`
- **`sortAlbums` 不再存在。** T3 之后它零调用方，留着就是死导出。

---

- [ ] **Step 1: 写失败测试**

Create `src/photos/util/__tests__/mixedAlbums.test.ts`：

```ts
// SP15-P2b-T2: the mixed manual/smart album list and the global sort that ranks both
// kinds against each other. Ported from Vue2 939a7d3a:PhotosAlbumsView.vue:381-393
// (smartAlbums / mixedAlbums) and :670-700 (applySort).
import { describe, it, expect } from 'vitest'
import { buildMixedAlbums, sortMixed, type MixedAlbumItem } from '../mixedAlbums'
import type { AlbumView } from '../albumView'
import type { SmartView } from '../../stores/smartViews'

const view = (o: Partial<AlbumView>): AlbumView => ({
  id: 'u', title: '', cover: null, count: 0, dateRange: '',
  createdAt: null, dateEnd: null, videoCount: 0, dateStart: null, ...o,
})
const sv = (o: Partial<SmartView>): SmartView => ({
  id: 's', name: '', description: '', conds: [], threshold: 0, live: false,
  includeVideos: false, count: 0, addedThisWeek: 0, seeds: [], median: 0,
  storageBytes: 0, distribution: new Array(10).fill(0), evaluatedAt: '', createdAt: '', ...o,
})
const ids = (items: MixedAlbumItem[]) => items.map((i) => String(i.id))

describe('buildMixedAlbums', () => {
  it('tags each entry with its kind and keeps the payload reachable', () => {
    const out = buildMixedAlbums([view({ id: 'u1', title: 'A' })], [sv({ id: 's1', name: 'B' })])
    const user = out.find((i) => i.kind === 'user')
    const smart = out.find((i) => i.kind === 'smart')
    expect(user?.kind === 'user' && user.view.title).toBe('A')
    expect(smart?.kind === 'smart' && smart.sv.name).toBe('B')
  })

  it('surfaces the id at the top level so callers do not reach into the payload for keys', () => {
    const out = buildMixedAlbums([view({ id: 7 })], [sv({ id: 's1' })])
    expect(ids(out).sort()).toEqual(['7', 's1'])
  })
})

describe('sortMixed', () => {
  // Titles, counts and dates are deliberately staggered across the two kinds so that a
  // comparator that only ever looks at one kind's field cannot pass.
  const items = buildMixedAlbums(
    [
      view({ id: 'u1', title: 'Beta', count: 3, createdAt: '2026-01-01T00:00:00Z', dateStart: '2024-01-01' }),
      view({ id: 'u2', title: 'Delta', count: 9, createdAt: '2025-01-01T00:00:00Z', dateStart: '2026-01-01' }),
    ],
    [
      sv({ id: 's1', name: 'Alpha', count: 5, createdAt: '2026-06-01T00:00:00Z' }),
      sv({ id: 's2', name: 'Gamma', count: 1, createdAt: '' }),
    ],
  )

  it('sorts by name across both kinds, not smart-first', () => {
    expect(ids(sortMixed(items, 'name'))).toEqual(['s1', 'u1', 's2', 'u2'])
    expect(ids(sortMixed(items, 'name-r'))).toEqual(['u2', 's2', 'u1', 's1'])
  })

  it('sorts by photo count descending across both kinds', () => {
    expect(ids(sortMixed(items, 'count'))).toEqual(['u2', 's1', 'u1', 's2'])
  })

  // THE POINT OF THIS TASK. Vue2 939a7d3a:PhotosAlbumsView.vue:686-693 puts a missing
  // timestamp FIRST, with its own comment explaining why: treating it as epoch 0 would
  // bury it at the end instead. This is the opposite of what albumView.sortAlbums used
  // to assert ("缺失记 0 排最后"), and reverting it is a regression, not a cleanup.
  it('ranks a missing createdAt FIRST, not last', () => {
    expect(ids(sortMixed(items, 'created'))).toEqual(['s2', 's1', 'u1', 'u2'])
  })

  it('ranks a missing date FIRST too, and reads dateStart for manual albums', () => {
    // u2's dateStart (2026) beats u1's (2024) even though u1 was created later, which is
    // what proves 'date' does not just fall through to createdAt for manual albums.
    // Smart albums have no earliest-member aggregate, so they fall back to createdAt
    // (Vue2 :684) -- a real degradation, not a defect.
    expect(ids(sortMixed(items, 'date'))).toEqual(['s2', 'u2', 's1', 'u1'])
  })

  it('leaves the order untouched for an unknown sort id', () => {
    expect(ids(sortMixed(items, 'zzz'))).toEqual(ids(items))
  })

  it('does not mutate its input', () => {
    const before = ids(items)
    sortMixed(items, 'name')
    expect(ids(items)).toEqual(before)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm exec vitest run src/photos/util/__tests__/mixedAlbums.test.ts
```

预期：FAIL —— 模块不存在。

- [ ] **Step 3: 实现 `mixedAlbums.ts`**

Create `src/photos/util/mixedAlbums.ts`：

```ts
// SP15-P2b: the Albums page shows manual albums and smart albums in one grid, ranked
// against each other by a single sort control. Ported from Vue2
// 939a7d3a:PhotosAlbumsView.vue:381-393 (smartAlbums / mixedAlbums) and :670-700
// (applySort).
//
// This lives in a pure module rather than in the view for one reason: the comparators
// have to read a different field per kind and treat a missing timestamp specially, and
// that is exactly the kind of branch where a component-level test passes for the wrong
// reason (the same trap momentLayout.ts was pulled out for in P1).
//
// Deviation from Vue2, registered: its `applySort` sorts in place and returns the same
// array. Here it returns a new one, matching the convention the rest of this directory
// already follows.
//
// Supersedes albumView.sortAlbums, which was deleted in the same commit: once the page
// renders a mixed list there is no caller left for an AlbumView-only comparator, and
// keeping both would mean two copies of the same comparators drifting apart.
import type { AlbumView } from './albumView'
import type { SmartView } from '../stores/smartViews'

export type MixedSortId = 'created' | 'name' | 'name-r' | 'count' | 'date'

export type MixedAlbumItem =
  | { kind: 'user'; id: string | number; view: AlbumView }
  | { kind: 'smart'; id: string; sv: SmartView }

// Vue2 :392 concatenates smart then user and lets the sort decide the final order; the
// same here. The pre-sort order is only observable through the 'unknown sort id' path.
export function buildMixedAlbums(views: AlbumView[], svs: SmartView[]): MixedAlbumItem[] {
  return [
    ...svs.map((sv): MixedAlbumItem => ({ kind: 'smart', id: sv.id, sv })),
    ...views.map((view): MixedAlbumItem => ({ kind: 'user', id: view.id, view })),
  ]
}

function titleOf(item: MixedAlbumItem): string {
  return item.kind === 'smart' ? item.sv.name : item.view.title
}

function countOf(item: MixedAlbumItem): number {
  return item.kind === 'smart' ? item.sv.count : item.view.count
}

// null means "no usable timestamp". Kept distinct from 0 on purpose -- see byMsDesc.
function msOf(raw: string | null | undefined): number | null {
  if (!raw) return null
  const t = Date.parse(raw)
  return isNaN(t) ? null : t
}

function createdMs(item: MixedAlbumItem): number | null {
  return msOf(item.kind === 'smart' ? item.sv.createdAt : item.view.createdAt)
}

// Vue2 :679-685. A manual album's 'date taken' is the taken_at of its earliest member;
// a smart album has no equivalent aggregate on the wire, so it falls back to createdAt.
// That fallback is a documented degradation, not a bug to fix here.
function dateTakenMs(item: MixedAlbumItem): number | null {
  if (item.kind === 'user') return msOf(item.view.dateStart)
  return createdMs(item)
}

// Vue2 :686-693, including the reason its comment gives: a missing timestamp sorts
// FIRST. Coercing it to 0 would send it to the very end instead, which is the opposite
// of the intent -- an album whose creation time cannot be compared should not be
// presented as the oldest thing in the library.
function byMsDesc(get: (i: MixedAlbumItem) => number | null) {
  return (a: MixedAlbumItem, b: MixedAlbumItem): number => {
    const av = get(a)
    const bv = get(b)
    if (av === null && bv === null) return 0
    if (av === null) return -1
    if (bv === null) return 1
    return bv - av
  }
}

export function sortMixed(items: MixedAlbumItem[], sort: MixedSortId | string): MixedAlbumItem[] {
  const arr = [...items]
  if (sort === 'name') arr.sort((a, b) => titleOf(a).localeCompare(titleOf(b)))
  else if (sort === 'name-r') arr.sort((a, b) => titleOf(b).localeCompare(titleOf(a)))
  else if (sort === 'count') arr.sort((a, b) => countOf(b) - countOf(a))
  else if (sort === 'date') arr.sort(byMsDesc(dateTakenMs))
  else if (sort === 'created') arr.sort(byMsDesc(createdMs))
  return arr
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm exec vitest run src/photos/util/__tests__/mixedAlbums.test.ts
```

全 8 例绿。若 `name` / `date` 两条的期望顺序与实现不符，**先手算一遍夹具**再改 —— 不要
为了让测试变绿而改期望值。

- [ ] **Step 5: 删除 `sortAlbums` 及其测试**

- `src/photos/util/albumView.ts`：删掉整个 `export function sortAlbums(...)`（含它上方
  那段 `// Verbatim port of PhotosAlbumsView.vue:359-370` 注释块）。在文件顶部注释里
  补一行：

```ts
// SP15-P2b: sortAlbums was removed here -- the Albums page now renders a mixed
// manual/smart list and sorts it through util/mixedAlbums.ts, which is the single
// remaining comparator implementation. albumToView / formatAlbumSpan / sortAlbumPhotos
// are unaffected and still have callers.
```

- `src/photos/util/__tests__/albumView.test.ts`：删掉整个 `describe('sortAlbums', …)`，
  并把 import 里的 `sortAlbums` 去掉。

- [ ] **Step 6: 删 2 个死 i18n 键**

`src/i18n/zh_cn.photos.ts` 与 `src/i18n/en_us.photos.ts` 各删两行：
`photosAlbumSortUpdated` / `photosAlbumSortUpdatedHint`。

> 这两个键此刻仍被 `PhotosAlbums.vue` 的 `sortOptions` 引用 —— **T2 结束时该文件会因此
> 编译不过**。这是刻意的顺序：T3 第一步就是重写 `sortOptions`。为了让 T2 能独立提交，
> **本步顺手把 `PhotosAlbums.vue` 的 `sortOptions` 里那一项与 `SortId` 里的 `'updated'`
> 一并删掉，并把 `sort` 的初值从 `'updated'` 改成 `'created'`**，其余不动（网格仍走
> 旧的 `views` computed —— T3 再换）。同时修 `src/views/__tests__/PhotosAlbums.test.ts`
> 里那条依赖 `默认 sort='updated'` 的断言（约 :135），改成断言默认 `created` 下按
> `createdAt` 降序。

- [ ] **Step 7: 跑相关测试 + 类型检查**

```bash
pnpm exec vitest run src/photos/util src/views/__tests__/PhotosAlbums.test.ts src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit
```

- [ ] **Step 8: 登记新测试文件**

`oss/manifest.mjs` 里 `src/photos` 是**整目录**剥离（见清单里那行 `'src/photos'`），
所以 `src/photos/util/__tests__/mixedAlbums.test.ts` **不需要**单独登记。
跑一次确认：

```bash
node oss/export.mjs --out /tmp/claude-1000/-home-nimo-NimoTech/4bd5688e-62a4-4e15-b431-6eedc1501e05/scratchpad/oss-t2 --no-commit --allow-dirty-oss
```

零泄漏即可。**若报出该文件**，说明整目录剥离的假设错了，按报错提示登记并在报告里写明。

- [ ] **Step 9: 提交**

```bash
git add -A
git commit -m "feat(photos): rank manual and smart albums with one comparator

The Albums page is about to show both kinds in a single grid, so the sort has to
read a different field per kind and can no longer live in an AlbumView-only
helper. sortAlbums is deleted rather than kept alongside the new module: with the
page on a mixed list it has no caller, and two copies of the same comparators
would drift.

The missing-timestamp rule is inverted from what this repo asserted before. Vue 2
puts an unusable createdAt first and says why -- coercing it to epoch 0 buries it
at the end, presenting an album whose creation time cannot be compared as the
oldest thing in the library. The test names that intent so a later reader does
not 'fix' it back.

The 'updated' sort option goes away with its two now-dead copy keys, and the
default moves to 'created'."
```

---

