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

