## Task 1: service 层 —— 8 个 moments 方法

**Files:**
- Modify: `packages/service/src/photos.ts`（在 `exportSmartViewAlbum` 之后、`// ─── 回收站 ───` 之前插入新段）
- Test: `packages/service/src/photos.moments.test.ts`（新建）

**Interfaces:**
- Consumes: 同文件已有的 `body<T>()` 解包helper 与 `http`
- Produces: `service.photos.listMoments()` · `getMomentAssets(id, featured?, withMembers?)` · `pinMomentAssets(id, ids)` · `excludeMomentAssets(id, ids)` · `deleteMoment(id)` · `exportMomentAlbum(id)` · `reorderMoments(ids)` · `recomputeMoments()`

- [ ] **Step 1: 写失败的测试**

新建 `packages/service/src/photos.moments.test.ts`：

```ts
// SP15-P1-T1: moments HTTP 层。回源核对 NimoOS-Photos/route/v1/moments.go —
// List 返回 {moments:[…]}(带包裹键,不是裸数组);Assets 带 with_members=1 时返回
// {assets,members,places},不带时是裸数组;Pin/Exclude 返回 {ok,asset_count};
// CreateAlbum 返回 201 {albumId,name,count}。
import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPhotos } from './photos.js'

type Call = { method: string; url: string; params?: unknown; body?: unknown; cfg?: unknown }

function harness(reply: unknown = {}) {
  const calls: Call[] = []
  const http = {
    get: async (url: string, cfg?: { params?: unknown }) => {
      calls.push({ method: 'get', url, params: cfg?.params }); return { data: reply }
    },
    post: async (url: string, body?: unknown) => {
      calls.push({ method: 'post', url, body }); return { data: reply }
    },
    put: async (url: string, body?: unknown) => {
      calls.push({ method: 'put', url, body }); return { data: reply }
    },
    delete: async (url: string, cfg?: unknown) => {
      calls.push({ method: 'delete', url, cfg }); return { data: reply }
    },
  } as unknown as AxiosInstance
  return { calls, photos: createPhotos(http, () => 'TOK') }
}

describe('photos moments API', () => {
  it('listMoments 解出 moments 数组,缺字段时兜底空数组', async () => {
    const a = harness({ moments: [{ id: 'm1' }] })
    expect(await a.photos.listMoments()).toEqual([{ id: 'm1' }])
    expect(a.calls[0]).toMatchObject({ method: 'get', url: '/photos/moments' })

    const b = harness({})
    expect(await b.photos.listMoments()).toEqual([])
  })

  it('getMomentAssets 只在为真时才带 featured / with_members 查询参数', async () => {
    const a = harness([])
    await a.photos.getMomentAssets('m1')
    expect(a.calls[0]).toMatchObject({ url: '/photos/moments/m1/assets', params: {} })

    const b = harness({ assets: [], members: [], places: [] })
    await b.photos.getMomentAssets('m1', true, true)
    expect(b.calls[0].params).toEqual({ featured: 1, with_members: 1 })
  })

  it('getMomentAssets 原样返回两种形状(裸数组 / {assets,members,places}),不在这层归一', async () => {
    const bare = harness([{ id: 'a1' }])
    expect(await bare.photos.getMomentAssets('m1')).toEqual([{ id: 'a1' }])

    const wrapped = harness({ assets: [{ id: 'a1' }], members: [{ asset_id: 'a1', manual: true, featured: false }], places: [{ name: 'X', count: 2 }] })
    expect(await wrapped.photos.getMomentAssets('m1', true, true)).toEqual({
      assets: [{ id: 'a1' }],
      members: [{ asset_id: 'a1', manual: true, featured: false }],
      places: [{ name: 'X', count: 2 }],
    })
  })

  it('pinMomentAssets / excludeMomentAssets 传 {ids} 并回传 asset_count', async () => {
    const a = harness({ ok: true, asset_count: 7 })
    expect(await a.photos.pinMomentAssets('m1', ['x', 'y'])).toEqual({ ok: true, asset_count: 7 })
    expect(a.calls[0]).toMatchObject({ method: 'post', url: '/photos/moments/m1/assets', body: { ids: ['x', 'y'] } })

    const b = harness({ ok: true, asset_count: 5 })
    expect(await b.photos.excludeMomentAssets('m1', ['x'])).toEqual({ ok: true, asset_count: 5 })
    // axios 的 delete 请求体必须放在 config.data 里,不能当第二位置参数
    expect(b.calls[0]).toMatchObject({ method: 'delete', url: '/photos/moments/m1/assets', cfg: { data: { ids: ['x'] } } })
  })

  it('deleteMoment / exportMomentAlbum / reorderMoments / recomputeMoments 打对 URL', async () => {
    const a = harness({})
    await a.photos.deleteMoment('m1')
    expect(a.calls[0]).toMatchObject({ method: 'delete', url: '/photos/moments/m1' })

    const b = harness({ albumId: 'al1', name: 'Trip', count: 12 })
    expect(await b.photos.exportMomentAlbum('m1')).toEqual({ albumId: 'al1', name: 'Trip', count: 12 })
    expect(b.calls[0]).toMatchObject({ method: 'post', url: '/photos/moments/m1/album', body: {} })

    const c = harness({})
    await c.photos.reorderMoments(['b', 'a'])
    expect(c.calls[0]).toMatchObject({ method: 'put', url: '/photos/moments/order', body: { ids: ['b', 'a'] } })

    const d = harness({})
    await d.photos.recomputeMoments()
    expect(d.calls[0]).toMatchObject({ method: 'post', url: '/photos/moments/recompute', body: {} })
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run packages/service/src/photos.moments.test.ts --reporter=verbose`
Expected: FAIL —— `a.photos.listMoments is not a function`

- [ ] **Step 3: 实现**

在 `packages/service/src/photos.ts` 的 `exportSmartViewAlbum` 之后插入：

```ts
    // ─── Moments(自动聚合的高光时刻,智能视图页 "For You" 分区)───
    // 回源核对 NimoOS-Photos/route/v1/moments.go:List 用 {moments:[…]} 包裹键(与本文件
    // 其它裸数组端点不同);字段是 snake_case(后端注释写明是有意为之)。归一到驼峰在
    // store 层做,这一层只负责取出包裹键。
    async listMoments(): Promise<unknown[]> {
      const res = await http.get('/photos/moments')
      return body<{ moments?: unknown[] } | undefined>(res.data)?.moments ?? []
    },
    // withMembers=true 时后端返回 {assets,members,places};不带时是裸数组。
    // 两种形状原样上抛,由 store 分辨——这层不做归一,免得两个消费方口径分叉。
    async getMomentAssets(id: string, featured = false, withMembers = false): Promise<unknown> {
      const params: Record<string, number> = {}
      if (featured) params.featured = 1
      if (withMembers) params.with_members = 1
      const res = await http.get(`/photos/moments/${id}/assets`, { params })
      return body<unknown>(res.data)
    },
    async pinMomentAssets(id: string, ids: string[]): Promise<{ ok?: boolean; asset_count?: number }> {
      const res = await http.post(`/photos/moments/${id}/assets`, { ids })
      return body<{ ok?: boolean; asset_count?: number }>(res.data) ?? {}
    },
    // axios 的 delete 没有 body 位置参数,请求体必须走 config.data。
    async excludeMomentAssets(id: string, ids: string[]): Promise<{ ok?: boolean; asset_count?: number }> {
      const res = await http.delete(`/photos/moments/${id}/assets`, { data: { ids } })
      return body<{ ok?: boolean; asset_count?: number }>(res.data) ?? {}
    },
    async deleteMoment(id: string): Promise<unknown> {
      const res = await http.delete(`/photos/moments/${id}`)
      return body<unknown>(res.data)
    },
    async exportMomentAlbum(id: string): Promise<{ albumId?: string; name?: string; count?: number }> {
      const res = await http.post(`/photos/moments/${id}/album`, {})
      return body<{ albumId?: string; name?: string; count?: number }>(res.data) ?? {}
    },
    async reorderMoments(ids: string[]): Promise<unknown> {
      const res = await http.put('/photos/moments/order', { ids })
      return body<unknown>(res.data)
    },
    // 后端 202 + 异步重算。本期**不接 UI 入口**(Vue2 也没有,见 spec §1.2);
    // 保留方法是为验收时能在浏览器控制台里调用。
    async recomputeMoments(): Promise<unknown> {
      const res = await http.post('/photos/moments/recompute', {})
      return body<unknown>(res.data)
    },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run packages/service/src/photos.moments.test.ts --reporter=verbose`
Expected: PASS，5 个用例

- [ ] **Step 5: 提交**

```bash
git add packages/service/src/photos.ts packages/service/src/photos.moments.test.ts
git commit -m "feat(photos): add the moments HTTP methods

Ported from Vue 2 src/service/photos.js:164-183. The list endpoint wraps its
payload in a \"moments\" key rather than returning a bare array, and the assets
endpoint changes shape depending on with_members, so both quirks are asserted
rather than assumed. Normalisation to camelCase is deliberately left to the
store so the two callers cannot drift apart."
```

---

