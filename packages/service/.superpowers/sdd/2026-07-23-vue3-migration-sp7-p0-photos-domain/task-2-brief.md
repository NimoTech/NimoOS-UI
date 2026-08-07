### Task 2: 搜索 + 收藏

**Files:**
- Modify: `src/photos.ts`(工厂返回对象内追加)
- Create: `src/photos.favorites.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `loose` / `unwrap` / `tokenQ`。
- Produces: `smartSearch(query, limit=50, offset=0, filters={})`, `searchFaces(personId, limit=50, offset=0)`, `listFavoriteIds()`, `listFavorites(limit=0, offset=0)`, `favorite(assetId)`, `unfavorite(assetId)`, `recordView(assetId)`, `topFavorites(limit=5)`, `exportFavoritesUrl()`。

- [ ] **Step 1: 写失败测试**

`src/photos.favorites.test.ts`(顶部复制 Task 1 的 `capture`/`noToken` 辅助,此处不再重复):

```ts
describe('photos 搜索+收藏', () => {
  it('smartSearch 发 POST /photos/search/smart 全参', async () => {
    const { http, calls } = capture()
    await createPhotos(http, noToken).smartSearch('猫', 50, 100, { type: 'image' })
    expect(calls[0]).toMatchObject({ method: 'post', url: '/photos/search/smart' })
    expect(calls[0].body).toEqual({ query: '猫', limit: 50, offset: 100, filters: { type: 'image' } })
  })
  it('searchFaces 发 GET /photos/search/faces/:personId 带分页', async () => {
    const { http, calls } = capture()
    await createPhotos(http, noToken).searchFaces('p1', 50, 0)
    expect(calls[0]).toMatchObject({ url: '/photos/search/faces/p1', params: { limit: 50, offset: 0 } })
  })
  it('listFavorites 无 limit 不带 params,有 limit 带分页(对齐 Vue2 条件参数)', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.listFavorites()
    expect(calls[0].params).toEqual({})
    await p.listFavorites(60, 120)
    expect(calls[1].params).toEqual({ limit: 60, offset: 120 })
  })
  it('topFavorites 传正确 params(修正 Vue2 的 {params:{limit}} 误包一层)', async () => {
    const { http, calls } = capture()
    await createPhotos(http, noToken).topFavorites(8)
    expect(calls[0]).toMatchObject({ url: '/photos/favorites/top', params: { limit: 8 } })
  })
  it.each([
    ['listFavoriteIds', 'get', '/photos/favorites/ids'],
  ] as const)('%s 发 %s %s', async (m, verb, url) => {
    const { http, calls } = capture()
    await (createPhotos(http, noToken) as never as Record<string, () => Promise<unknown>>)[m]()
    expect(calls[0]).toMatchObject({ method: verb, url })
  })
  it('favorite/unfavorite/recordView 路由正确', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.favorite('a1'); await p.unfavorite('a1'); await p.recordView('a1')
    expect(calls[0]).toMatchObject({ method: 'post', url: '/photos/favorites/a1' })
    expect(calls[1]).toMatchObject({ method: 'delete', url: '/photos/favorites/a1' })
    expect(calls[2]).toMatchObject({ method: 'post', url: '/photos/views/a1' })
  })
  it('exportFavoritesUrl 用注入 getToken(不读 localStorage)', () => {
    const p = createPhotos({} as AxiosInstance, () => 'T1')
    expect(p.exportFavoritesUrl()).toBe('/v1/photos/favorites/export?token=T1')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/photos.favorites.test.ts` → FAIL(方法不存在)。

- [ ] **Step 3: 实现**(`photos.ts` 工厂返回对象内追加)

```ts
    // ─── 搜索 ───
    // offset 须为 limit 整数倍;深页由后端标记 belowCut(对齐 Vue2 注释)
    async smartSearch(query: string, limit = 50, offset = 0, filters: Record<string, unknown> = {}): Promise<unknown> {
      const res = await http.post('/photos/search/smart', { query, limit, offset, filters })
      return unwrap<unknown>(res.data)
    },
    async searchFaces(personId: string | number, limit = 50, offset = 0): Promise<unknown> {
      const res = await http.get(`/photos/search/faces/${personId}`, { params: { limit, offset } })
      return unwrap<unknown>(res.data)
    },
    // ─── 收藏 ───
    async listFavoriteIds(): Promise<unknown[]> {
      const res = await http.get('/photos/favorites/ids')
      return loose<unknown[]>(res.data)
    },
    async listFavorites(limit = 0, offset = 0): Promise<unknown> {
      const params: Record<string, number> = {}
      if (limit > 0) { params.limit = limit; params.offset = offset }
      const res = await http.get('/photos/favorites', { params })
      return unwrap<unknown>(res.data)
    },
    async favorite(assetId: string | number): Promise<unknown> {
      const res = await http.post(`/photos/favorites/${assetId}`, {})
      return unwrap<unknown>(res.data)
    },
    async unfavorite(assetId: string | number): Promise<unknown> {
      const res = await http.delete(`/photos/favorites/${assetId}`)
      return unwrap<unknown>(res.data)
    },
    async recordView(assetId: string | number): Promise<unknown> {
      const res = await http.post(`/photos/views/${assetId}`, {})
      return unwrap<unknown>(res.data)
    },
    // Vue2 此处误传 { params: { limit } } 作 params(发出 params[limit]=N,后端走默认)——包内修正为正确形态
    async topFavorites(limit = 5): Promise<unknown> {
      const res = await http.get('/photos/favorites/top', { params: { limit } })
      return unwrap<unknown>(res.data)
    },
    // 浏览器原生下载用,token 走注入的 getToken(Vue2 版直读 localStorage)
    exportFavoritesUrl(): string {
      return `/v1/photos/favorites/export${tokenQ('?')}`
    },
```

- [ ] **Step 4: 跑测试确认通过** — `pnpm vitest run src/photos.favorites.test.ts` PASS;`pnpm test` 全绿;`pnpm build` 干净。

- [ ] **Step 5: Commit**

```bash
git add src/photos.ts src/photos.favorites.test.ts
git commit -m "photos 域:智能搜索/人脸搜索 + 收藏全套(修正 topFavorites params 误包层)"
```

---

