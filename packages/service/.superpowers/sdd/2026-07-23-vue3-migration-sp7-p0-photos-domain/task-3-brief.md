### Task 3: 相册

**Files:**
- Modify: `src/photos.ts`
- Create: `src/photos.albums.test.ts`

**Interfaces:**
- Produces: `listAlbums()`, `createAlbum(name)`, `getAlbum(id)`, `deleteAlbum(id)`, `addToAlbum(albumId, assetId)`, `removeFromAlbum(albumId, assetId)`, `batchAddToAlbum(albumId, assetIds)`, `updateAlbum(id, patch)`, `reorderAlbumAssets(id, assetIds)`。

- [ ] **Step 1: 写失败测试**(`src/photos.albums.test.ts`,复制 capture 辅助)

```ts
describe('photos 相册', () => {
  it('CRUD 路由与请求体正确', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.listAlbums()
    await p.createAlbum('旅行')
    await p.getAlbum(3)
    await p.deleteAlbum(3)
    expect(calls[0]).toMatchObject({ method: 'get', url: '/photos/albums' })
    expect(calls[1]).toMatchObject({ method: 'post', url: '/photos/albums', body: { name: '旅行' } })
    expect(calls[2]).toMatchObject({ method: 'get', url: '/photos/albums/3' })
    expect(calls[3]).toMatchObject({ method: 'delete', url: '/photos/albums/3' })
  })
  it('资产增删/批量/排序/更名', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.addToAlbum(3, 'a1')
    await p.removeFromAlbum(3, 'a1')
    await p.batchAddToAlbum(3, ['a1', 'a2'])
    await p.updateAlbum(3, { name: '新名' })
    await p.reorderAlbumAssets(3, ['a2', 'a1'])
    expect(calls[0]).toMatchObject({ method: 'post', url: '/photos/albums/3/assets', body: { assetId: 'a1' } })
    expect(calls[1]).toMatchObject({ method: 'delete', url: '/photos/albums/3/assets/a1' })
    expect(calls[2]).toMatchObject({ method: 'post', url: '/photos/albums/3/assets/batch', body: { assetIds: ['a1', 'a2'] } })
    expect(calls[3]).toMatchObject({ method: 'patch', url: '/photos/albums/3', body: { name: '新名' } })
    expect(calls[4]).toMatchObject({ method: 'patch', url: '/photos/albums/3/assets/order', body: { assetIds: ['a2', 'a1'] } })
  })
})
```

- [ ] **Step 2: 确认失败** — `pnpm vitest run src/photos.albums.test.ts` FAIL。

- [ ] **Step 3: 实现**(追加)

```ts
    // ─── 相册 ───
    async listAlbums(): Promise<unknown[]> {
      const res = await http.get('/photos/albums')
      return loose<unknown[]>(res.data)
    },
    async createAlbum(name: string): Promise<unknown> {
      const res = await http.post('/photos/albums', { name })
      return unwrap<unknown>(res.data)
    },
    async getAlbum(id: string | number): Promise<unknown> {
      const res = await http.get(`/photos/albums/${id}`)
      return unwrap<unknown>(res.data)
    },
    async deleteAlbum(id: string | number): Promise<unknown> {
      const res = await http.delete(`/photos/albums/${id}`)
      return unwrap<unknown>(res.data)
    },
    async addToAlbum(albumId: string | number, assetId: string | number): Promise<unknown> {
      const res = await http.post(`/photos/albums/${albumId}/assets`, { assetId })
      return unwrap<unknown>(res.data)
    },
    async removeFromAlbum(albumId: string | number, assetId: string | number): Promise<unknown> {
      const res = await http.delete(`/photos/albums/${albumId}/assets/${assetId}`)
      return unwrap<unknown>(res.data)
    },
    async batchAddToAlbum(albumId: string | number, assetIds: Array<string | number>): Promise<unknown> {
      const res = await http.post(`/photos/albums/${albumId}/assets/batch`, { assetIds })
      return unwrap<unknown>(res.data)
    },
    async updateAlbum(id: string | number, patch: Record<string, unknown>): Promise<unknown> {
      const res = await http.patch(`/photos/albums/${id}`, patch)
      return unwrap<unknown>(res.data)
    },
    async reorderAlbumAssets(id: string | number, assetIds: Array<string | number>): Promise<unknown> {
      const res = await http.patch(`/photos/albums/${id}/assets/order`, { assetIds })
      return unwrap<unknown>(res.data)
    },
```

- [ ] **Step 4: 确认通过** — 单文件 PASS + `pnpm test` 全绿 + `pnpm build`。
- [ ] **Step 5: Commit** — `git add src/photos.ts src/photos.albums.test.ts && git commit -m "photos 域:相册 CRUD/批量/排序"`

---

