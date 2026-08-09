# SP15-P2a 智能视图·手动加/移/恢复照片 —— 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Vue2 `#79`/`#82` 补迁到 New-UI —— 智能视图详情页的「加照片 / 多选移除 / 已排除+恢复 / pin 角标」，以及写操作后自动刷新该视图的统计。

**Architecture:** service 加 4 个方法；`smartViews` store 加 4 个 action（**每个内置写后回拉统计**）与 `excluded` 状态；`assetToPhoto` 补 `pinned`；泛化 picker 改名后接进详情页。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript strict · Pinia（setup 风格）· vue-i18n 9 · Vitest + @vue/test-utils + jsdom

## Global Constraints

以下每条对**每个任务**都成立，任务正文不再重复。

1. **1:1 靶子是 Vue2 `899af59b`**（与 P1 同一个；`#79`/`#82` 比它更早，功能在那个提交上本就存在）。取源码一律：`git -C /home/nimo/NimoTech/NimoOS-UI show 899af59b:<path>`。**界面严格 1:1；Vue2 的 bug/竞态/吞错不照抄，改正确逻辑并在文件头注释登记。**
2. **注释与 vitest `describe`/`it` 标题一律英文**（机主裁定，覆盖计划里的中文代码块）。中文作为**数据**保留：i18n 取值、测试里断言的中文界面串。**不要扫改既有的中文注释** —— 本仓两个任务因为在这条上两个方向都做错而返工过。
3. **颜色一律 theme token**，禁裸色字面量。被迫固定色（压在照片上的角标）写 `/* theme-exception: 理由 */`，照 `PhotosMomentDetail.vue` 的 pin 角标先例。**color-guard 不剥注释 —— 注释里写 hex/rgba 字面量同样命中。**
4. **CSS 注释里禁止 `*` 紧贴 `/`** —— 会提前关闭注释、错误恢复吃到下一个块结束、吞掉整条规则，五道门全部照不出来。
5. **新增 i18n 键必须同时进 `src/i18n/zh_cn.photos.ts` 与 `src/i18n/en_us.photos.ts`**，前缀 `photosSv*`。**不碰 `src/i18n/*.base.ts`**（并行分支拥有它）。中文以 Vue2 `zh_CN.json` 为准，**不要自己译**。加键前先 grep 是否已有同义键。
6. **异步写共享 state 必须带过期守卫**，回归测试走交错路径。本仓终审已在这条上逮过四次。
7. **测试证据一律 `--reporter=verbose` 并数条数。** 本计划的预测条数是估算，**P1 十一个任务全部估错** —— 报实测值，不要为凑数字增删用例。
8. **提交信息全英文**，祈使句主题行 + 解释「为什么」的正文。
9. **不碰 `src/files/**`**。
10. **`oss` 门断言工作树干净**；台账有未提交改动就报失败，先提交台账再跑，**不要 stash 绕过**。若 `.superpowers/sdd/.gitignore`（一行 `*`）出现，删掉它、不要重建。

### 后端契约（已回源核对 `NimoOS-Photos/route/v1/smartviews.go`，不要凭印象改）

| 端点 | 请求 | 响应 |
|---|---|---|
| `POST /photos/smart-views/:id/assets` | `{assetIds: string[]}` | `{added: number}` |
| `POST /photos/smart-views/:id/assets/remove` | `{assetIds: string[]}` | `{unpinned: number, excluded: number}` |
| `POST /photos/smart-views/:id/assets/restore` | `{assetIds: string[]}` | `{restored: number}` |
| `GET /photos/smart-views/:id/excluded` | — | **裸数组**（无包裹键） |

- 请求体键是 **`assetIds`**（`svAssetIDsReq` 的 json tag）。
- **空数组后端直接 400**（`len(req.AssetIDs) == 0` → `"assetIds is required"`）⇒ store 必须挡住空列表，不发请求。
- 资产上的 `pinned` 是 `json:"pinned,omitempty"`（`service/types.go:91`）⇒ **false 时字段整个不出现**，归一必须写 `!!raw.pinned`。
- **写操作只返回「改了几张」，拿不到新的 `count`/`median`/`storageBytes`** ⇒ 写后必须回拉该视图（这就是 `#82`）。

### 收尾门（Task 4 统一跑，控制器亲自复跑，不转述实现者的话）

```bash
pnpm exec vue-tsc --noEmit
pnpm test
pnpm exec vitest run src/i18n/parity.test.ts
node oss/export.mjs --out /tmp/claude-1000/-home-nimo-NimoTech/408f1faf-fbff-4bcc-b9b8-351f4f14b0c2/scratchpad/oss-out --no-commit --allow-dirty-oss
pnpm build
pnpm exec vitest run src/styles
```

**已知非缺陷，看到别去追**：全量套件的 jsdom `Not implemented: navigation` 噪声；`src/home/components/DesktopContextMenu.test.ts` 单跑该文件时失败；`src/files/upload/persist.test.ts:55` 偶发红。

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `packages/service/src/photos.ts` | HTTP 层：4 个方法 | 修改（插在 `previewSmartView` 之后、`exportSmartViewUrl` 之前） |
| `packages/service/src/photos.smartviewAssets.test.ts` | 上述 4 个方法的 URL / 参数 / 解包断言 | 新建 |
| `src/photos/util/assetToPhoto.ts` | + `pinned` 字段 | 修改 |
| `src/photos/stores/smartViews.ts` | 4 个 action + `excluded` 状态 + 写后回拉 | 修改 |
| `src/photos/stores/__tests__/smartViews.assets.test.ts` | 上述 store 行为 | 新建（既有 store 测试文件不动） |
| `src/photos/components/AlbumLibraryPicker.vue` | **改名**为 `PhotosLibraryPicker.vue` | 重命名 |
| `src/photos/components/__tests__/AlbumLibraryPicker.test.ts` | 同上 | 重命名为 `PhotosLibraryPicker.test.ts` |
| `src/views/PhotosAlbums.vue` · `src/views/PhotosAlbumDetail.vue` | 仅改 import 与标签名 | 修改 |
| `oss/manifest.mjs` | 改名后的路径 | 修改 |
| `src/views/PhotosSmartViewDetail.vue` | 加照片 / 多选移除 / pin 角标 / 已排除分节 | 修改 |
| `src/views/PhotosSmartViewDetail.assets.test.ts` | 上述交互（既有该页测试文件不动） | 新建 |
| `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts` | `photosSv*` 新键 | 修改 |

---

## Task 1: 数据层 —— service 4 方法 + store 4 action + `pinned`

**Files:**
- Modify: `packages/service/src/photos.ts`
- Test: `packages/service/src/photos.smartviewAssets.test.ts`（新建）
- Modify: `src/photos/util/assetToPhoto.ts`
- Modify: `src/photos/stores/smartViews.ts`
- Test: `src/photos/stores/__tests__/smartViews.assets.test.ts`（新建）

**Interfaces:**
- Consumes: 同文件已有的 `body<T>()` 解包 helper 与 `http`；`assetToPhoto` / `Photo`；既有 `toSmartView`
- Produces:
  - `service.photos.pinSmartViewAssets(id, assetIds)` → `Promise<{added?: number}>`
  - `service.photos.removeSmartViewAssets(id, assetIds)` → `Promise<{unpinned?: number, excluded?: number}>`
  - `service.photos.restoreSmartViewAssets(id, assetIds)` → `Promise<{restored?: number}>`
  - `service.photos.getSmartViewExcluded(id)` → `Promise<unknown[]>`
  - `Photo.pinned: boolean`
  - store 新增：`excluded: Ref<Photo[]>` · `excludedLoading: Ref<boolean>` · `assetBusy: Ref<boolean>` · `pinAssets(id, ids): Promise<number>` · `removeAssets(id, ids): Promise<{unpinned: number, excluded: number}>` · `restoreAssets(id, ids): Promise<number>` · `loadExcluded(id): Promise<void>`

- [ ] **Step 1: 写失败的测试（service 层）**

新建 `packages/service/src/photos.smartviewAssets.test.ts`：

```ts
// SP15-P2a-T1: smart-view manual asset HTTP layer. Re-verified against
// NimoOS-Photos/route/v1/smartviews.go — the request body key is "assetIds"
// (svAssetIDsReq), the three write endpoints return only change counts, and
// GET /excluded returns a bare array with no envelope key.
import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPhotos } from './photos.js'

type Call = { method: string; url: string; body?: unknown }

function harness(reply: unknown = {}) {
  const calls: Call[] = []
  const http = {
    get: async (url: string) => { calls.push({ method: 'get', url }); return { data: reply } },
    post: async (url: string, body?: unknown) => { calls.push({ method: 'post', url, body }); return { data: reply } },
  } as unknown as AxiosInstance
  return { calls, photos: createPhotos(http, () => 'TOK') }
}

describe('smart view manual asset API', () => {
  it('pinSmartViewAssets posts {assetIds} and returns the change count', async () => {
    const a = harness({ added: 3 })
    expect(await a.photos.pinSmartViewAssets('sv1', ['x', 'y'])).toEqual({ added: 3 })
    expect(a.calls[0]).toMatchObject({
      method: 'post', url: '/photos/smart-views/sv1/assets', body: { assetIds: ['x', 'y'] },
    })
  })

  it('removeSmartViewAssets hits the /remove suffix and returns both tiers', async () => {
    const a = harness({ unpinned: 2, excluded: 1 })
    expect(await a.photos.removeSmartViewAssets('sv1', ['x'])).toEqual({ unpinned: 2, excluded: 1 })
    expect(a.calls[0]).toMatchObject({
      method: 'post', url: '/photos/smart-views/sv1/assets/remove', body: { assetIds: ['x'] },
    })
  })

  it('restoreSmartViewAssets hits the /restore suffix', async () => {
    const a = harness({ restored: 4 })
    expect(await a.photos.restoreSmartViewAssets('sv1', ['x'])).toEqual({ restored: 4 })
    expect(a.calls[0]).toMatchObject({
      method: 'post', url: '/photos/smart-views/sv1/assets/restore', body: { assetIds: ['x'] },
    })
  })

  it('the three write methods fall back to an empty object when the body is absent', async () => {
    const a = harness(undefined)
    expect(await a.photos.pinSmartViewAssets('sv1', ['x'])).toEqual({})
    const b = harness(undefined)
    expect(await b.photos.removeSmartViewAssets('sv1', ['x'])).toEqual({})
    const c = harness(undefined)
    expect(await c.photos.restoreSmartViewAssets('sv1', ['x'])).toEqual({})
  })

  it('getSmartViewExcluded reads the bare array, defaulting to empty', async () => {
    const a = harness([{ id: 'a1' }])
    expect(await a.photos.getSmartViewExcluded('sv1')).toEqual([{ id: 'a1' }])
    expect(a.calls[0]).toMatchObject({ method: 'get', url: '/photos/smart-views/sv1/excluded' })

    const b = harness(undefined)
    expect(await b.photos.getSmartViewExcluded('sv1')).toEqual([])
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run packages/service/src/photos.smartviewAssets.test.ts --reporter=verbose`
Expected: FAIL —— `a.photos.pinSmartViewAssets is not a function`

- [ ] **Step 3: 实现 service 层**

在 `packages/service/src/photos.ts` 的 `previewSmartView` 之后、`exportSmartViewUrl` 之前插入：

```ts
    // ─── Smart view manual asset actions (SP15-P2a) ───
    // Re-verified against NimoOS-Photos/route/v1/smartviews.go: the shared request
    // body is svAssetIDsReq {assetIds}, and an empty array is rejected with 400, so
    // callers must not send one. The three write endpoints return only the counts of
    // what changed — never the view's own statistics — which is why the store has to
    // refetch the view afterwards.
    async pinSmartViewAssets(id: string | number, assetIds: string[]): Promise<{ added?: number }> {
      const res = await http.post(`/photos/smart-views/${id}/assets`, { assetIds })
      return body<{ added?: number }>(res.data) ?? {}
    },
    // Removal is tiered on the backend: a pinned row is deleted (unpinned), an
    // automatically matched row is flagged excluded. Hence two counters, not one.
    async removeSmartViewAssets(id: string | number, assetIds: string[]): Promise<{ unpinned?: number; excluded?: number }> {
      const res = await http.post(`/photos/smart-views/${id}/assets/remove`, { assetIds })
      return body<{ unpinned?: number; excluded?: number }>(res.data) ?? {}
    },
    async restoreSmartViewAssets(id: string | number, assetIds: string[]): Promise<{ restored?: number }> {
      const res = await http.post(`/photos/smart-views/${id}/assets/restore`, { assetIds })
      return body<{ restored?: number }>(res.data) ?? {}
    },
    // Bare array, no envelope key — unlike most of the list endpoints in this file.
    async getSmartViewExcluded(id: string | number): Promise<unknown[]> {
      const res = await http.get(`/photos/smart-views/${id}/excluded`)
      return body<unknown[]>(res.data) ?? []
    },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run packages/service/src/photos.smartviewAssets.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: 补 `pinned` 字段**

`src/photos/util/assetToPhoto.ts`：在 `export interface Photo` 里 `isNew` 那一行下面加

```ts
  pinned: boolean
```

在 `assetToPhoto` 的返回对象里，紧跟在 `isNew: !!asset.isNew,` 之后加：

```ts
    // Smart View per-user annotation: manually pinned into the view rather than
    // matched by its conditions. Drives the pin badge on the detail page's tiles.
    // The backend tags this `omitempty`, so false arrives as an absent field —
    // `!!` is load-bearing, not decoration.
    pinned: !!asset.pinned,
```

- [ ] **Step 6: 写失败的测试（store 层）**

新建 `src/photos/stores/__tests__/smartViews.assets.test.ts`：

```ts
// SP15-P2a-T1: the smart view manual asset actions on the store.
// Two things are deliberately different from Vue 2 and are asserted here:
//  1) the post-write statistics refetch lives inside each action rather than at
//     the call sites — Vue 2 shipped #82 precisely because a call site forgot it;
//  2) an empty id list is rejected locally, because the backend answers 400.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const listSmartViews = vi.fn()
const getSmartView = vi.fn()
const pinSmartViewAssets = vi.fn()
const removeSmartViewAssets = vi.fn()
const restoreSmartViewAssets = vi.fn()
const getSmartViewExcluded = vi.fn()

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      listSmartViews: (...a: unknown[]) => listSmartViews(...a),
      getSmartView: (...a: unknown[]) => getSmartView(...a),
      pinSmartViewAssets: (...a: unknown[]) => pinSmartViewAssets(...a),
      removeSmartViewAssets: (...a: unknown[]) => removeSmartViewAssets(...a),
      restoreSmartViewAssets: (...a: unknown[]) => restoreSmartViewAssets(...a),
      getSmartViewExcluded: (...a: unknown[]) => getSmartViewExcluded(...a),
      thumbnailUrl: (id: string, size: string) => `mock://${id}/${size}`,
    },
  },
}))

import { usePhotosSmartViews } from '../smartViews'

const RAW_SV = { id: 'sv1', name: 'Hiking', conds: ['a'], threshold: 80, count: 10, median: 5, storageBytes: 100 }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  listSmartViews.mockResolvedValue([RAW_SV])
})

describe('pinAssets', () => {
  it('returns the added count and refetches the view so the header and card both follow', async () => {
    pinSmartViewAssets.mockResolvedValue({ added: 2 })
    getSmartView.mockResolvedValue({ ...RAW_SV, count: 12 })
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()

    expect(await s.pinAssets('sv1', ['x', 'y'])).toBe(2)
    expect(pinSmartViewAssets).toHaveBeenCalledWith('sv1', ['x', 'y'])
    expect(getSmartView).toHaveBeenCalledWith('sv1')
    expect(s.byId('sv1')?.count).toBe(12)
  })

  it('sends no request for an empty list — the backend answers 400 for one', async () => {
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(await s.pinAssets('sv1', [])).toBe(0)
    expect(pinSmartViewAssets).not.toHaveBeenCalled()
  })

  it('rethrows on failure and leaves the stored view untouched', async () => {
    pinSmartViewAssets.mockRejectedValue(new Error('nope'))
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await expect(s.pinAssets('sv1', ['x'])).rejects.toThrow()
    expect(s.byId('sv1')?.count).toBe(10)
  })

  it('a failing refetch does not turn a successful write into a failure', async () => {
    pinSmartViewAssets.mockResolvedValue({ added: 1 })
    getSmartView.mockRejectedValue(new Error('stats down'))
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(await s.pinAssets('sv1', ['x'])).toBe(1)
    expect(s.byId('sv1')?.count).toBe(10)
  })
})

describe('removeAssets', () => {
  it('returns both tiers and refetches the view', async () => {
    removeSmartViewAssets.mockResolvedValue({ unpinned: 1, excluded: 2 })
    getSmartView.mockResolvedValue({ ...RAW_SV, count: 7 })
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()

    expect(await s.removeAssets('sv1', ['x'])).toEqual({ unpinned: 1, excluded: 2 })
    expect(s.byId('sv1')?.count).toBe(7)
  })

  it('defaults both counters to 0 when the backend omits them', async () => {
    removeSmartViewAssets.mockResolvedValue({})
    getSmartView.mockResolvedValue(RAW_SV)
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(await s.removeAssets('sv1', ['x'])).toEqual({ unpinned: 0, excluded: 0 })
  })

  it('sends no request for an empty list', async () => {
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(await s.removeAssets('sv1', [])).toEqual({ unpinned: 0, excluded: 0 })
    expect(removeSmartViewAssets).not.toHaveBeenCalled()
  })
})

describe('restoreAssets', () => {
  it('returns the restored count and refetches the view', async () => {
    restoreSmartViewAssets.mockResolvedValue({ restored: 3 })
    getSmartView.mockResolvedValue({ ...RAW_SV, count: 13 })
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(await s.restoreAssets('sv1', ['x'])).toBe(3)
    expect(s.byId('sv1')?.count).toBe(13)
  })
})

describe('loadExcluded', () => {
  it('normalises the bare array through assetToPhoto', async () => {
    getSmartViewExcluded.mockResolvedValue([{ id: 'a1', originalName: 'a.jpg' }])
    const s = usePhotosSmartViews()
    await s.loadExcluded('sv1')
    expect(s.excluded).toHaveLength(1)
    expect(s.excluded[0].id).toBe('a1')
  })

  it('leaves the list empty and does not throw when the request fails', async () => {
    getSmartViewExcluded.mockRejectedValue(new Error('nope'))
    const s = usePhotosSmartViews()
    await s.loadExcluded('sv1')
    expect(s.excluded).toEqual([])
    expect(s.excludedLoading).toBe(false)
  })

  it('carries a staleness guard: when two loads interleave, the later one wins', async () => {
    let resolveA: (v: unknown) => void = () => {}
    getSmartViewExcluded.mockImplementationOnce(() => new Promise((r) => { resolveA = r }))
    getSmartViewExcluded.mockResolvedValueOnce([{ id: 'second' }])

    const s = usePhotosSmartViews()
    const pA = s.loadExcluded('sv1')   // fired first, left hanging
    const pB = s.loadExcluded('sv2')   // fired second, resolves immediately
    await pB
    resolveA([{ id: 'first' }])        // the first one lands late
    await pA

    expect(s.excluded.map((p) => String(p.id))).toEqual(['second'])
  })
})
```

- [ ] **Step 7: 跑测试确认它失败**

Run: `pnpm exec vitest run src/photos/stores/__tests__/smartViews.assets.test.ts --reporter=verbose`
Expected: FAIL —— `s.pinAssets is not a function`

- [ ] **Step 8: 实现 store**

在 `src/photos/stores/smartViews.ts` 里：

① 状态区（`const activity = ref...` 之后）追加：

```ts
  // SP15-P2a: the excluded list belongs here rather than in the view, alongside the
  // three asset collections this page already reads from the store — splitting one
  // page's data across two owners is what makes staleness bugs possible.
  const excluded = ref<Photo[]>([])
  const excludedLoading = ref(false)
  // Staleness guard for loadExcluded, same shape as detailSeq: switching smart views
  // can leave an older request in flight, and it must not overwrite the newer list.
  let excludedSeq = 0
  // Mutual exclusion across the three manual write actions: they all mutate the same
  // membership of the same view, so letting two run at once would race the refetch.
  const assetBusy = ref(false)
```

② 在 `loadDetail` 之后插入四个 action：

```ts
  // Refetch one smart view and replace it in the list. Vue 2 needed an in-place
  // field merge here to preserve the object identity its detail page held as a prop
  // (#82's MERGE_SMART_VIEW_STATS). That problem does not exist here: the detail
  // page reads `byId(id)` as a computed, so replacing the array item is enough and
  // both the header and the list card follow automatically.
  //
  // Deliberately swallows its own failure: the caller's write already succeeded, and
  // reporting a stats refresh error as a write error would be a lie.
  async function refreshStats(id: string): Promise<void> {
    try {
      const raw = await service.photos.getSmartView(id)
      if (!raw) return
      const i = smartViews.value.findIndex((s) => String(s.id) === String(id))
      if (i === -1) return
      smartViews.value.splice(i, 1, toSmartView(raw))
    } catch (e) {
      console.error('[photos-smartviews] refreshStats', e)
    }
  }

  // The stats refetch lives inside each of the three write actions rather than at
  // the call sites. Vue 2 put it at the call sites and shipped #82 to fix the one it
  // forgot; keeping it here means a caller cannot forget.
  //
  // The empty-list early return is not defensive padding — the backend rejects an
  // empty assetIds with 400 ("assetIds is required").
  async function pinAssets(id: string, assetIds: string[]): Promise<number> {
    if (!assetIds.length || assetBusy.value) return 0
    assetBusy.value = true
    try {
      const res = await service.photos.pinSmartViewAssets(id, assetIds)
      const added = typeof res.added === 'number' ? res.added : 0
      await refreshStats(id)
      return added
    } catch (e) {
      console.error('[photos-smartviews] pinAssets', e)
      throw e
    } finally {
      assetBusy.value = false
    }
  }

  // Removal is tiered on the backend — a pinned row is deleted, an automatically
  // matched row is flagged excluded — so both counters come back and the caller
  // needs both to phrase its confirmation.
  async function removeAssets(id: string, assetIds: string[]): Promise<{ unpinned: number; excluded: number }> {
    if (!assetIds.length || assetBusy.value) return { unpinned: 0, excluded: 0 }
    assetBusy.value = true
    try {
      const res = await service.photos.removeSmartViewAssets(id, assetIds)
      const out = {
        unpinned: typeof res.unpinned === 'number' ? res.unpinned : 0,
        excluded: typeof res.excluded === 'number' ? res.excluded : 0,
      }
      await refreshStats(id)
      return out
    } catch (e) {
      console.error('[photos-smartviews] removeAssets', e)
      throw e
    } finally {
      assetBusy.value = false
    }
  }

  async function restoreAssets(id: string, assetIds: string[]): Promise<number> {
    if (!assetIds.length || assetBusy.value) return 0
    assetBusy.value = true
    try {
      const res = await service.photos.restoreSmartViewAssets(id, assetIds)
      const restored = typeof res.restored === 'number' ? res.restored : 0
      await refreshStats(id)
      return restored
    } catch (e) {
      console.error('[photos-smartviews] restoreAssets', e)
      throw e
    } finally {
      assetBusy.value = false
    }
  }

  // Failure is swallowed rather than rethrown: the excluded band is a secondary
  // section, and an error there must not take down the matched grid above it.
  async function loadExcluded(id: string): Promise<void> {
    const mine = ++excludedSeq
    excludedLoading.value = true
    excluded.value = []
    try {
      const raw = await service.photos.getSmartViewExcluded(id)
      if (mine !== excludedSeq) return
      excluded.value = (raw ?? []).map((a) => assetToPhoto(a as Record<string, unknown>))
    } catch (e) {
      console.error('[photos-smartviews] loadExcluded', e)
    } finally {
      if (mine === excludedSeq) excludedLoading.value = false
    }
  }
```

③ `__resetForTest` 里追加（放在 `activity.value = []` 之后）：

```ts
    excluded.value = []
    excludedLoading.value = false
    assetBusy.value = false
```

④ `return { … }` 块里追加：

```ts
    excluded, excludedLoading, assetBusy,
    pinAssets, removeAssets, restoreAssets, loadExcluded,
```

- [ ] **Step 9: 跑测试确认通过**

Run: `pnpm exec vitest run src/photos/stores/__tests__ packages/service/src/photos.smartviewAssets.test.ts --reporter=verbose`
Expected: PASS，且既有 store 测试条数不减

- [ ] **Step 10: 类型检查与提交**

Run: `pnpm exec vue-tsc --noEmit` → 必须 clean

```bash
git add packages/service/src/photos.ts packages/service/src/photos.smartviewAssets.test.ts \
        src/photos/util/assetToPhoto.ts src/photos/stores/smartViews.ts \
        src/photos/stores/__tests__/smartViews.assets.test.ts
git commit -m "feat(photos): add the smart view manual asset actions

The three write endpoints return only what changed, never the view's own
statistics, so each action refetches the view before returning. Vue 2 put that
refetch at the call sites and then shipped a follow-up fix for the one call site
that forgot it; keeping it inside the action removes the opportunity.

The empty-list early return matches the backend, which rejects an empty assetIds
with a 400 rather than treating it as a no-op."
```

---

## Task 2: 把 picker 改名为 `PhotosLibraryPicker`

**Files:**
- Rename: `src/photos/components/AlbumLibraryPicker.vue` → `src/photos/components/PhotosLibraryPicker.vue`
- Rename: `src/photos/components/__tests__/AlbumLibraryPicker.test.ts` → `.../PhotosLibraryPicker.test.ts`
- Modify: `src/views/PhotosAlbums.vue` · `src/views/PhotosAlbumDetail.vue`
- Modify: `oss/manifest.mjs`

**Interfaces:**
- Consumes: 无
- Produces: 组件新路径 `src/photos/components/PhotosLibraryPicker.vue`，**props 与 emits 一字不改**

> **这一步只改名字，不改任何行为。** P1 已经把这个组件泛化成与相册无关的通用 picker，
> 名字从那时起就在说谎；本任务只是还这笔债。**任何 props/emits/逻辑改动都属越界。**

- [ ] **Step 1: 记录基线**

```bash
pnpm exec vitest run src/photos/components/__tests__/AlbumLibraryPicker.test.ts \
  src/views/__tests__/PhotosAlbums.test.ts src/views/__tests__/PhotosAlbumDetail.test.ts --reporter=verbose
```

把三个文件各自的条数记进报告。**改名后必须一条不少。**

- [ ] **Step 2: 用 `git mv` 改名（保住历史）**

```bash
git mv src/photos/components/AlbumLibraryPicker.vue src/photos/components/PhotosLibraryPicker.vue
git mv src/photos/components/__tests__/AlbumLibraryPicker.test.ts src/photos/components/__tests__/PhotosLibraryPicker.test.ts
```

- [ ] **Step 3: 改所有引用点**

先找全：

```bash
grep -rn "AlbumLibraryPicker" src oss --include='*.vue' --include='*.ts' --include='*.mjs'
```

逐处把标识符 `AlbumLibraryPicker` 换成 `PhotosLibraryPicker`、路径换成新路径。涉及：
- `src/views/PhotosAlbums.vue`：`import` 语句 + 模板里的组件标签
- `src/views/PhotosAlbumDetail.vue`：同上
- `src/photos/components/__tests__/PhotosLibraryPicker.test.ts`：`import` 与 `describe` 标题
- `oss/manifest.mjs`：剥离清单里的路径（**两个文件都要**：组件与它的测试）

在组件文件头把 P1 登记的「名字说谎」那条债改成已还，写明改名发生在 SP15-P2a、且只改名不改行为。

- [ ] **Step 4: 跑测试确认零回归**

```bash
pnpm exec vitest run src/photos/components/__tests__/PhotosLibraryPicker.test.ts \
  src/views/__tests__/PhotosAlbums.test.ts src/views/__tests__/PhotosAlbumDetail.test.ts --reporter=verbose
pnpm exec vue-tsc --noEmit
pnpm exec vitest run oss
```

Expected: 三个测试文件条数与 Step 1 逐一相等；`vue-tsc` clean；`oss` 全绿。

> **`oss` 若变红**：说明剥离清单里还留着旧路径（清单对不存在的路径会 `exit 1`，这是设计好的过期报警）。改清单里的路径，**不要**去动 `oss/forbidden.mjs` 的词表。

- [ ] **Step 5: 全仓确认没有残留**

```bash
grep -rn "AlbumLibraryPicker" src oss packages docs || echo "clean"
```

Expected: `clean`（`docs/` 里的历史设计文档若提到旧名字，那是历史记录，保留不改 —— 只确认 `src`/`oss`/`packages` 干净）。

- [ ] **Step 6: 提交**

```bash
git add -A src/photos/components src/views/PhotosAlbums.vue src/views/PhotosAlbumDetail.vue oss/manifest.mjs
git commit -m "refactor(photos): rename the library picker to match what it does

P1 made this component collection-agnostic — both halves of its album-specific
behaviour moved out to its callers — but left the name, and registered the gap as
debt. The smart view detail page becomes its third consumer, so the name is now
actively misleading.

Rename only: props, emits and behaviour are untouched, and the album pages'
existing tests carry over unchanged as the evidence."
```

---

## Task 3: 详情页交互 —— 加照片 / 多选移除 / pin 角标 / 已排除

**Files:**
- Modify: `src/views/PhotosSmartViewDetail.vue`
- Test: `src/views/PhotosSmartViewDetail.assets.test.ts`（新建；既有该页测试文件不动）
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`

**Interfaces:**
- Consumes: `store.pinAssets` / `removeAssets` / `restoreAssets` / `loadExcluded` / `excluded` / `assetBusy`（Task 1）· `PhotosLibraryPicker`（Task 2）· `useToast`
- Produces: 无新导出

**新增 i18n 键**（两个 locale 都加；中文取自 Vue2 `zh_CN.json`，**不要自己译**）：

| 键 | zh_cn | en_us |
|---|---|---|
| `photosSvAddPhotos` | `加照片` | `Add photos` |
| `photosSvRemoveFromView` | `从此视图移除` | `Remove from this view` |
| `photosSvRemovedNFromView` | `已从此视图移除 {n} 张` | `Removed {n} from this view` |
| `photosSvExcludedN` | `已排除（{n}）` | `Excluded ({n})` |
| `photosSvAlreadyInView` | `已在此视图` | `Already in this view` |
| `photosSvPinnedNToView` | `已钉住 {n} 张到此视图` | `Pinned {n} to this view` |
| `photosSvRestoreFailed` | `恢复失败` | `Restore failed` |
| `photosSvRemoveFailed` | `移除失败` | `Remove failed` |
| `photosSvAddFailed` | `添加失败` | `Add failed` |
| `photosSvShow` | `显示` | `Show` |
| `photosSvHide` | `隐藏` | `Hide` |
| `photosSvRestore` | `恢复` | `Restore` |

**必须复用、不要新建的既有键**（写作本计划时已逐个 grep 核对，取值如下）：

| 用途 | 键 | 现有中文取值 | 注意 |
|---|---|---|---|
| Select 按钮 | `photosPersonSelect` | `选择` | P1 的 `PhotosMomentDetail.vue` 用的就是这个 |
| Cancel 按钮 | `photosCancel` | `取消` | |
| 「{n} 已选」 | `photosSelectedCount` | `已选择 {count} 项` | **参数名是 `count` 不是 `n`** —— 传 `{ count: … }`，传 `n` 会渲染出字面量 |
| picker 标题 | `photosAlbumPickerTitle` | `添加照片到「{name}」` | Vue2 本来就是一个字符串喂两个 picker |
| picker 提交按钮 | `photosAlbumPickerAdd` | `添加({count})` | 走**函数形态**，见下 |

`submitLabel` 必须传函数（照 `src/views/PhotosAlbums.vue:171-173` 的既有写法，那样计数才会
跟着选择动）:

```ts
function pickerSubmitLabel(count: number): string {
  return t('photosAlbumPickerAdd', { count })
}
```

- [ ] **Step 1: 写失败的测试**

新建 `src/views/PhotosSmartViewDetail.assets.test.ts`：

```ts
// SP15-P2a-T3: the manual asset interactions on the smart view detail page.
// Target is Vue 2 899af59b:src/views/Photos/PhotosSmartViewDetail.vue.
// Note the device reality this cannot cover: producing an excluded row requires
// removing an *automatically matched* asset, and every smart view on the test
// device is semantic, paused and never evaluated — see the design doc's §2.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

const svc = vi.hoisted(() => ({
  photos: {
    thumbnailUrl: vi.fn((id: string, size: string) => `mock://${id}/${size}`),
    listSmartViews: vi.fn(async () => []),
    getSmartView: vi.fn(async () => ({})),
    getSmartViewAssets: vi.fn(async () => []),
    getSmartViewActivity: vi.fn(async () => []),
    getSmartViewExcluded: vi.fn(async () => []),
    pinSmartViewAssets: vi.fn(async () => ({ added: 0 })),
    removeSmartViewAssets: vi.fn(async () => ({ unpinned: 0, excluded: 0 })),
    restoreSmartViewAssets: vi.fn(async () => ({ restored: 0 })),
    listAlbums: vi.fn(async () => []),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosSmartViewDetail from './PhotosSmartViewDetail.vue'
import { usePhotosSmartViews } from '../photos/stores/smartViews'
import { useToast } from '../stores/toast'

const SV = {
  id: 'sv1', name: 'Hiking', description: '', conds: ['a'], threshold: 80,
  live: true, includeVideos: false, count: 3, addedThisWeek: 0, seeds: [],
  median: 0, storageBytes: 0, distribution: new Array(10).fill(0), evaluatedAt: '',
}

async function mountPage() {
  const router = createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/photos/smart-views', name: 'photos-smart-views', component: { template: '<div/>' } },
      { path: '/photos/smart-views/:id', name: 'photos-smart-view-detail', component: PhotosSmartViewDetail },
    ],
  })
  await router.push('/photos/smart-views/sv1')
  await router.isReady()
  const w = mount(PhotosSmartViewDetail, { global: { plugins: [router] } })
  await new Promise((r) => setTimeout(r, 0))
  return { w, router }
}

function seed() {
  const s = usePhotosSmartViews()
  s.smartViews = [{ ...SV }]
  s.listLoaded = true
  s.matchedAssets = [
    { id: 'a1', pinned: true }, { id: 'a2', pinned: false },
  ] as never
  return s
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('pin badge', () => {
  it('marks only the pinned tiles', async () => {
    seed()
    const { w } = await mountPage()
    expect(w.findAll('[data-test="sv-pin-tag"]')).toHaveLength(1)
  })
})

describe('add photos', () => {
  it('opens the picker, pins what it confirms, and reports the count it was told', async () => {
    const s = seed()
    const pin = vi.spyOn(s, 'pinAssets').mockResolvedValue(2)
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w } = await mountPage()

    await w.find('[data-test="sv-add-photos"]').trigger('click')
    w.findComponent({ name: 'PhotosLibraryPicker' }).vm.$emit('confirm', ['x', 'y'])
    await new Promise((r) => setTimeout(r, 0))

    expect(pin).toHaveBeenCalledWith('sv1', ['x', 'y'])
    expect(show).toHaveBeenCalled()
  })

  it('reports a failure and keeps the picker open so the user can retry', async () => {
    const s = seed()
    vi.spyOn(s, 'pinAssets').mockRejectedValue(new Error('nope'))
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w } = await mountPage()
    await w.find('[data-test="sv-add-photos"]').trigger('click')
    w.findComponent({ name: 'PhotosLibraryPicker' }).vm.$emit('confirm', ['x'])
    await new Promise((r) => setTimeout(r, 0))
    expect(show).toHaveBeenCalledWith(expect.any(String), expect.anything(), 'danger')
    expect(w.findComponent({ name: 'PhotosLibraryPicker' }).props('open')).toBe(true)
  })

  it('hands the picker the ids already in the view, String()-normalised', async () => {
    const s = seed()
    s.matchedAssets = [{ id: 5 }] as never
    const { w } = await mountPage()
    await w.find('[data-test="sv-add-photos"]').trigger('click')
    const ids = w.findComponent({ name: 'PhotosLibraryPicker' }).props('existingIds') as Set<string>
    expect([...ids]).toContain('5')
  })
})

describe('selection and removal', () => {
  it('suppresses the lightbox while selecting, and shows the count', async () => {
    seed()
    const { w } = await mountPage()
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    await w.findAll('[data-test="sv-all-tile"]')[0].trigger('click')
    expect(w.find('[data-test="sv-select-bar"]').text()).toContain('1')
  })

  it('removes the selection, then leaves selection mode', async () => {
    const s = seed()
    const remove = vi.spyOn(s, 'removeAssets').mockResolvedValue({ unpinned: 1, excluded: 0 })
    const { w } = await mountPage()
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    await w.findAll('[data-test="sv-all-tile"]')[0].trigger('click')
    await w.find('[data-test="sv-remove-selected"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(remove).toHaveBeenCalledWith('sv1', ['a1'])
    expect(w.find('[data-test="sv-select-bar"]').exists()).toBe(false)
  })

  it('keeps the selection on failure so the user can retry', async () => {
    const s = seed()
    vi.spyOn(s, 'removeAssets').mockRejectedValue(new Error('nope'))
    const { w } = await mountPage()
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    await w.findAll('[data-test="sv-all-tile"]')[0].trigger('click')
    await w.find('[data-test="sv-remove-selected"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(w.find('[data-test="sv-select-bar"]').exists()).toBe(true)
  })

  it('leaving selection mode clears what was selected', async () => {
    seed()
    const { w } = await mountPage()
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    await w.findAll('[data-test="sv-all-tile"]')[0].trigger('click')
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    expect(w.find('[data-test="sv-select-bar"]').exists()).toBe(false)
  })
})

describe('excluded section', () => {
  it('stays hidden when nothing is excluded', async () => {
    seed()
    const { w } = await mountPage()
    expect(w.find('[data-test="sv-excluded-head"]').exists()).toBe(false)
  })

  it('appears with a count once there are excluded assets, collapsed by default', async () => {
    const s = seed()
    s.excluded = [{ id: 'e1' }, { id: 'e2' }] as never
    const { w } = await mountPage()
    expect(w.find('[data-test="sv-excluded-head"]').text()).toContain('2')
    expect(w.find('[data-test="sv-excluded-grid"]').exists()).toBe(false)
  })

  it('expands on click and restores a photo when one is clicked', async () => {
    const s = seed()
    s.excluded = [{ id: 'e1' }] as never
    const restore = vi.spyOn(s, 'restoreAssets').mockResolvedValue(1)
    const { w } = await mountPage()
    await w.find('[data-test="sv-excluded-head"]').trigger('click')
    await w.find('[data-test="sv-excluded-tile"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(restore).toHaveBeenCalledWith('sv1', ['e1'])
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/views/PhotosSmartViewDetail.assets.test.ts --reporter=verbose`
Expected: FAIL —— `[data-test="sv-add-photos"]` 找不到

- [ ] **Step 3: 先加 i18n 键，再改页面**

先在两个 locale 文件加上表格里的键（放在既有 `photosSv*` 块内，新起一段注释
`// ── SP15-P2a: manual asset actions ──`）。

`src/views/PhotosSmartViewDetail.vue` 的 `<script setup>` 追加：

```ts
import PhotosLibraryPicker from '../photos/components/PhotosLibraryPicker.vue'

const pickerOpen = ref(false)
const selecting = ref(false)
const selectedIds = ref<string[]>([])
const excludedOpen = ref(false)

// The ids the picker must show as already-in. Normalising with String() here is
// load-bearing: album/asset ids arrive from the API as numbers on some paths while
// timeline photo ids are strings, and a mismatch silently un-dims every tile.
const viewAssetIds = computed(() => new Set(store.matchedAssets.map((p) => String(p.id))))

function toggleSelecting(): void {
  selecting.value = !selecting.value
  if (!selecting.value) selectedIds.value = []
}

function toggleSelect(id: string): void {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((x) => x !== id)
    : [...selectedIds.value, id]
}

async function onPickPhotos(assetIds: Array<string | number>): Promise<void> {
  const ids = assetIds.map(String)
  try {
    const n = await store.pinAssets(svId.value, ids)
    toast.show(t('photosSvPinnedNToView', { n }))
    pickerOpen.value = false
    await store.loadDetail(svId.value)
  } catch (e) {
    console.error('[photos-smartviews] pinAssets', e)
    // The picker deliberately stays open on failure — the user still has their
    // selection and can retry without re-picking.
    toast.show(t('photosSvAddFailed'), 2500, 'danger')
  }
}

async function removeSelected(): Promise<void> {
  const ids = selectedIds.value.slice()
  if (!ids.length) return
  try {
    const r = await store.removeAssets(svId.value, ids)
    toast.show(t('photosSvRemovedNFromView', { n: r.unpinned + r.excluded }))
    // Cleared only on success, matching Vue 2: on failure the selection is what the
    // user needs in order to retry.
    selecting.value = false
    selectedIds.value = []
    await Promise.all([store.loadDetail(svId.value), store.loadExcluded(svId.value)])
  } catch (e) {
    console.error('[photos-smartviews] removeAssets', e)
    toast.show(t('photosSvRemoveFailed'), 2500, 'danger')
  }
}

async function restoreOne(id: string): Promise<void> {
  try {
    await store.restoreAssets(svId.value, [id])
    await Promise.all([store.loadDetail(svId.value), store.loadExcluded(svId.value)])
  } catch (e) {
    console.error('[photos-smartviews] restoreAssets', e)
    toast.show(t('photosSvRestoreFailed'), 2500, 'danger')
  }
}
```

`onTileClick` 改成选择态优先（**照 Vue2**：选择态下点瓦片只切选中，不开灯箱）：
在函数最前面加

```ts
  if (selecting.value) { toggleSelect(String(p.id)); return }
```

在 `onMounted` 与 `watch(svId, …)` 里，除既有的 `store.loadDetail(...)` 之外追加
`void store.loadExcluded(svId.value)`；切 `:id` 时同时重置 `selecting` / `selectedIds` /
`pickerOpen` / `excludedOpen`（**P1 终审在同型问题上逮到过跨条目误删** —— 选择态跨
智能视图存活会把 A 的照片 id 发给 B 的移除接口）。

模板改动：

- 工具条那一行（`sv-action-pause` 所在的按钮组）里追加两个按钮：
  `data-test="sv-add-photos"`（`t('photosSvAddPhotos')`，点击 `pickerOpen = true`）与
  `data-test="sv-select-toggle"`（`selecting ? t('photosCancel') : t('photosPersonSelect')`，
  点击 `toggleSelecting`）
- 两个网格的 `<div class="tile">` 上：加 `:data-selected="selecting && selectedIds.includes(String(p.id))"`；
  内部加 `<div v-if="p.pinned" class="sv-pin-tag" data-test="sv-pin-tag">`（pin 图标）与
  选中态的勾选角标
- 「全部匹配」网格之后插入「已排除」分节：

```vue
          <template v-if="store.excluded.length">
            <div class="sv-section-head sv-excluded-head" data-test="sv-excluded-head" @click="excludedOpen = !excludedOpen">
              {{ t('photosSvExcludedN', { n: store.excluded.length }) }}
              <span class="pill">{{ excludedOpen ? t('photosSvHide') : t('photosSvShow') }}</span>
            </div>
            <div v-if="excludedOpen" class="sv-grid-photos sv-excluded-grid" data-test="sv-excluded-grid">
              <div
                v-for="p in store.excluded" :key="p.id" class="tile"
                data-test="sv-excluded-tile" @click="restoreOne(String(p.id))"
              >
                <img :src="service.photos.thumbnailUrl(p.id, 'large')" alt="" loading="lazy">
                <div class="sv-restore-hint">{{ t('photosSvRestore') }}</div>
              </div>
            </div>
          </template>
```

- 选择栏（照 Vue2 `sv-select-bar`）：

```vue
    <div v-if="selecting && selectedIds.length" class="sv-select-bar" data-test="sv-select-bar">
      <span>{{ t('photosSelectedCount', { count: selectedIds.length }) }}</span>
      <button type="button" class="sv-action-btn" data-test="sv-remove-selected" :disabled="store.assetBusy" @click="removeSelected">
        {{ t('photosSvRemoveFromView') }}
      </button>
    </div>
```

- 页面末尾挂 picker：

```vue
    <PhotosLibraryPicker
      :open="pickerOpen"
      :title="t('photosAlbumPickerTitle', { name: sv?.name ?? '' })"
      :existing-ids="viewAssetIds"
      :existing-label="t('photosSvAlreadyInView')"
      :submit-label="pickerSubmitLabel"
      :submitting="store.assetBusy"
      @update:open="pickerOpen = $event"
      @confirm="onPickPhotos"
    />
```

样式照 Vue2 `photos-smartview.scss` 的 `#79` 增量（`.sv-pin-tag` / `.sv-tile-check` /
`.sv-excluded-head` / `.sv-restore-hint` / `.sv-select-bar`），**颜色一律 token**；压在照片上的
角标前景色照 `PhotosMomentDetail.vue` 的 pin 角标先例写 `theme-exception`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/views/PhotosSmartViewDetail.assets.test.ts src/views/__tests__/PhotosSmartViewDetail.test.ts src/i18n/parity.test.ts --reporter=verbose`
Expected: PASS，**且既有该页测试条数不减**

> 既有页面测试若因为新增的 `getSmartViewExcluded` 调用而打印吞掉的错误，
> 给那个文件的 service mock 补上 `getSmartViewExcluded: vi.fn(async () => [])`
> —— 只补这一行，别动它的断言（P1 的 Task 5 是同款处置）。

- [ ] **Step 5: 类型检查、样式守卫与提交**

```bash
pnpm exec vue-tsc --noEmit
pnpm exec vitest run src/styles
```

```bash
git add src/views/PhotosSmartViewDetail.vue src/views/PhotosSmartViewDetail.assets.test.ts \
        src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts
git commit -m "feat(photos): let a smart view's photos be pinned, removed and restored

A smart view is generated from conditions, so the manual actions are annotations
on top of that: pinning adds a photo the conditions missed, removing either
unpins one or excludes it, and the excluded band is what makes the second case
reversible rather than silent.

The excluded band stays collapsed until asked for. It is a record of past
decisions, not part of the view."
```

---

## Task 4: 收尾门 + 验收清单

**Files:**
- Create: `docs/superpowers/2026-08-09-sp15-p2a-acceptance.md`

- [ ] **Step 1: 跑全部六门**

```bash
pnpm exec vue-tsc --noEmit
pnpm test
pnpm exec vitest run src/i18n/parity.test.ts
node oss/export.mjs --out /tmp/claude-1000/-home-nimo-NimoTech/408f1faf-fbff-4bcc-b9b8-351f4f14b0c2/scratchpad/oss-out --no-commit --allow-dirty-oss
pnpm build
pnpm exec vitest run src/styles
```

把**实测数字**（文件数 / 用例数）记进验收文档，不要写「全绿」了事。

- [ ] **Step 2: CSS 注释自查**

```bash
grep -n '\*/' src/views/PhotosSmartViewDetail.vue
```

逐条确认每个 `*/` 都是正常的注释终止符，没有「`*` 紧贴 `/`」提前关闭注释的写法。

- [ ] **Step 3: 写验收清单**

新建 `docs/superpowers/2026-08-09-sp15-p2a-acceptance.md`，**第 0 步与第 1 行提示照抄设计文档 §2.1/§2.2**：

> **第 0 步（必做）**：本机既有的 9 个智能视图全部是语义条件、`live=0`、从未评估，
> `smart_view_matches` 是 0 行。**先在界面上新建一个「日期」条件的智能视图并置为 live**，
> 等它评估出自动匹配行。五种条件里只有 `semantic` 走 CLIP（撞 BE-1），`date` 是纯 SQL。
>
> **第 1 行提示**：**「已排除（N）」在旧的 9 个视图上永远不会出现**，因为后端移除是分层的
> —— 只有移除「自动匹配」的照片才产生排除行，手动钉住的照片被移除是直接删行。
> 这是数据不足，不是本期缺陷。

其余步骤：加照片后张数在**详情页头部与列表卡片上同时**变化 · 加照片失败时 picker 保持打开 ·
pin 角标只出现在手动钉住的照片上 · 选择态下点瓦片不开灯箱 · 移除成功退出选择态、
失败保持选择态 · 已排除分节默认折叠、点开后点照片可恢复 · 恢复后该照片回到匹配网格 ·
**浅色与深色两套主题都要看**（压在照片上的 pin 角标与恢复提示）。

- [ ] **Step 4: 提交**

```bash
git add docs/superpowers/2026-08-09-sp15-p2a-acceptance.md
git commit -m "docs(sp15): record the P2a gate results and the acceptance list

The list opens by having the owner create a date-conditioned smart view, because
the excluded band cannot be reached otherwise: removal only produces an excluded
row for an automatically matched photo, and every existing view on this device is
semantic, paused and never evaluated."
```

---

## 自审记录

**Spec 覆盖**：spec §1.1 的五项 —— service/store 数据层 T1 · `pinned` T1 · 详情页四块交互 T3 ·
改名 T2 · i18n T3。spec §4 的四个「照抄会错」处 —— ① `#82` 原地合并是非问题 → T1 Step 8 的
`refreshStats` 注释与「store 只需替换数组项」的实现；② 回拉放 action 内部 → T1 Step 8；
③ 改名是还债不是 1:1 → T2 开头的限定与提交信息；④ P1 已付一半 → T2 只改 import。
spec §5 错误处理五条 → T3 Step 3。spec §6 六门 → T4。spec §10 验收两条死约束 → T4 Step 3。

**类型一致性**：`pinAssets`/`restoreAssets` 返回 `number`，`removeAssets` 返回
`{unpinned, excluded}` —— T1 定义、T3 消费，T3 的 `r.unpinned + r.excluded` 与之匹配。
`excluded` 是 `Photo[]`，`loadExcluded` 无返回值。`Photo.pinned: boolean` 在 T1 定义、
T3 模板消费。

**自审逮到并已就地修掉的三处**（原稿把不确定性推给了实现者，现已查实写死）：

1. **`photosSelectedCount` 的参数名是 `count` 不是 `n`**（`已选择 {count} 项`）。原稿的
   `t('photosSelectedCount', { n: … })` 会把 `{count}` 原样渲染成字面量 —— 单测未必照得出来
   （断言 `toContain('1')` 时 `已选择 {count} 项` 里没有 1，其实会红；但若断言写松就漏了）。
2. **Select/Cancel 不新建键**：复用 `photosPersonSelect`（`选择`）与 `photosCancel`（`取消`），
   与 P1 的 `PhotosMomentDetail.vue` 一致。原稿写的 `photosSelect` **不存在**。
3. **`submitLabel` 必须传函数**而不是字符串 —— `photosAlbumPickerAdd` 是 `添加({count})`，
   传死字符串会让计数不跟着选择动。照 `PhotosAlbums.vue:171-173` 的既有写法。
   同时 picker 的开合改用 `:open` + `@update:open`。`v-model:open` 在语法上同样成立
   （组件确实声明了 `open` prop 与 `update:open` emit），这里只是与两个既有调用点保持一致。
