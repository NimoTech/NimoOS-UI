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

