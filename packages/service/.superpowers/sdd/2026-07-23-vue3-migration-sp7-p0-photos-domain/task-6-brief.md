### Task 6: 智能视图 + 回收站

**Files:**
- Modify: `src/photos.ts`
- Create: `src/photos.views.test.ts`

**Interfaces:**
- Produces: `listSmartViews()`, `createSmartView(payload)`, `getSmartView(id)`, `updateSmartView(id, patch)`, `deleteSmartView(id)`, `duplicateSmartView(id)`, `getSmartViewAssets(id, {limit=60, offset=0, recent=false})`, `getSmartViewActivity(id, limit=10)`, `previewSmartView({condsRaw, description, threshold, includeVideos})`, `exportSmartViewUrl(id, format)`, `exportSmartViewAlbum(id)`, `listTrash()`, `restoreFromTrash(id)`, `restoreTrashBatch(ids)`, `restoreAllTrash()`, `purgeTrash(id)`, `emptyTrash()`。

- [ ] **Step 1: 写失败测试**(`src/photos.views.test.ts`,复制 capture 辅助)

```ts
describe('photos 智能视图', () => {
  it('CRUD/复制', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.listSmartViews()
    await p.createSmartView({ name: '宝宝' })
    await p.getSmartView(5)
    await p.updateSmartView(5, { name: '娃' })
    await p.deleteSmartView(5)
    await p.duplicateSmartView(5)
    expect(calls[0]).toMatchObject({ method: 'get', url: '/photos/smart-views' })
    expect(calls[1]).toMatchObject({ method: 'post', url: '/photos/smart-views', body: { name: '宝宝' } })
    expect(calls[2]).toMatchObject({ method: 'get', url: '/photos/smart-views/5' })
    expect(calls[3]).toMatchObject({ method: 'put', url: '/photos/smart-views/5', body: { name: '娃' } })
    expect(calls[4]).toMatchObject({ method: 'delete', url: '/photos/smart-views/5' })
    expect(calls[5]).toMatchObject({ method: 'post', url: '/photos/smart-views/5/duplicate' })
  })
  it('资产/活动/预览/导出', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.getSmartViewAssets(5, { limit: 30, offset: 60, recent: true })
    await p.getSmartViewActivity(5, 20)
    await p.previewSmartView({ condsRaw: 'x', description: 'd', threshold: 0.6, includeVideos: true })
    await p.exportSmartViewAlbum(5)
    expect(calls[0]).toMatchObject({ url: '/photos/smart-views/5/assets', params: { limit: 30, offset: 60, recent: true } })
    expect(calls[1]).toMatchObject({ url: '/photos/smart-views/5/activity', params: { limit: 20 } })
    expect(calls[2]).toMatchObject({ method: 'post', url: '/photos/smart-views/preview', body: { condsRaw: 'x', description: 'd', threshold: 0.6, includeVideos: true } })
    expect(calls[3]).toMatchObject({ method: 'post', url: '/photos/smart-views/5/export?format=album' })
  })
  it('exportSmartViewUrl 带 format 与 token', () => {
    const p = createPhotos({} as AxiosInstance, () => 'T1')
    expect(p.exportSmartViewUrl(5, 'zip')).toBe('/v1/photos/smart-views/5/export?format=zip&token=T1')
  })
})
describe('photos 回收站', () => {
  it('列表/单恢复/批量/全部/清除/清空', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.listTrash()
    await p.restoreFromTrash('a1')
    await p.restoreTrashBatch(['a1', 'a2'])
    await p.restoreAllTrash()
    await p.purgeTrash('a1')
    await p.emptyTrash()
    expect(calls[0]).toMatchObject({ method: 'get', url: '/photos/trash' })
    expect(calls[1]).toMatchObject({ method: 'post', url: '/photos/trash/a1/restore' })
    expect(calls[2]).toMatchObject({ method: 'post', url: '/photos/trash/restore', body: { ids: ['a1', 'a2'] } })
    expect(calls[3]).toMatchObject({ method: 'post', url: '/photos/trash/restore', body: { ids: [] } })
    expect(calls[4]).toMatchObject({ method: 'delete', url: '/photos/trash/a1' })
    expect(calls[5]).toMatchObject({ method: 'post', url: '/photos/trash/empty' })
  })
})
```

- [ ] **Step 2: 确认失败**;**Step 3: 实现**(追加):

```ts
    // ─── 智能视图 ───
    async listSmartViews(): Promise<unknown[]> {
      const res = await http.get('/photos/smart-views')
      return loose<unknown[]>(res.data)
    },
    async createSmartView(payload: Record<string, unknown>): Promise<unknown> {
      const res = await http.post('/photos/smart-views', payload)
      return unwrap<unknown>(res.data)
    },
    async getSmartView(id: string | number): Promise<unknown> {
      const res = await http.get(`/photos/smart-views/${id}`)
      return unwrap<unknown>(res.data)
    },
    async updateSmartView(id: string | number, patch: Record<string, unknown>): Promise<unknown> {
      const res = await http.put(`/photos/smart-views/${id}`, patch)
      return unwrap<unknown>(res.data)
    },
    async deleteSmartView(id: string | number): Promise<unknown> {
      const res = await http.delete(`/photos/smart-views/${id}`)
      return unwrap<unknown>(res.data)
    },
    async duplicateSmartView(id: string | number): Promise<unknown> {
      const res = await http.post(`/photos/smart-views/${id}/duplicate`, {})
      return unwrap<unknown>(res.data)
    },
    async getSmartViewAssets(id: string | number, { limit = 60, offset = 0, recent = false }: { limit?: number; offset?: number; recent?: boolean } = {}): Promise<unknown> {
      const res = await http.get(`/photos/smart-views/${id}/assets`, { params: { limit, offset, recent } })
      return unwrap<unknown>(res.data)
    },
    async getSmartViewActivity(id: string | number, limit = 10): Promise<unknown> {
      const res = await http.get(`/photos/smart-views/${id}/activity`, { params: { limit } })
      return unwrap<unknown>(res.data)
    },
    async previewSmartView({ condsRaw, description, threshold, includeVideos }: { condsRaw?: unknown; description?: string; threshold?: number; includeVideos?: boolean }): Promise<unknown> {
      const res = await http.post('/photos/smart-views/preview', { condsRaw, description, threshold, includeVideos })
      return unwrap<unknown>(res.data)
    },
    exportSmartViewUrl(id: string | number, format: string): string {
      return `/v1/photos/smart-views/${id}/export?format=${format}${tokenQ('&')}`
    },
    async exportSmartViewAlbum(id: string | number): Promise<unknown> {
      const res = await http.post(`/photos/smart-views/${id}/export?format=album`, {})
      return unwrap<unknown>(res.data)
    },
    // ─── 回收站 ───
    async listTrash(): Promise<unknown[]> {
      const res = await http.get('/photos/trash')
      return loose<unknown[]>(res.data)
    },
    async restoreFromTrash(id: string | number): Promise<unknown> {
      const res = await http.post(`/photos/trash/${id}/restore`, {})
      return unwrap<unknown>(res.data)
    },
    async restoreTrashBatch(ids: Array<string | number>): Promise<unknown> {
      const res = await http.post('/photos/trash/restore', { ids })
      return unwrap<unknown>(res.data)
    },
    async restoreAllTrash(): Promise<unknown> {
      const res = await http.post('/photos/trash/restore', { ids: [] })
      return unwrap<unknown>(res.data)
    },
    async purgeTrash(id: string | number): Promise<unknown> {
      const res = await http.delete(`/photos/trash/${id}`)
      return unwrap<unknown>(res.data)
    },
    async emptyTrash(): Promise<unknown> {
      const res = await http.post('/photos/trash/empty', {})
      return unwrap<unknown>(res.data)
    },
```

注:`exportSmartViewUrl` 在 Vue2 无 token;统一口径加上(后端多余 query 忽略,无害;若真机验收发现该端点拒绝,退回无 token 并记台账)。

- [ ] **Step 4: 确认通过**;**Step 5: Commit** — `git add src/photos.ts src/photos.views.test.ts && git commit -m "photos 域:智能视图 + 回收站全套"`

---

