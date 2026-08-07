### Task 4: 人物

**Files:**
- Modify: `src/photos.ts`
- Create: `src/photos.persons.test.ts`

**Interfaces:**
- Produces: `listPersons()`, `getPerson(id)`, `updatePerson(id, patch)`, `setPersonCover(id, assetId)`, `resetPersonCover(id)`, `deletePerson(id)`, `purgePerson(id)`, `restorePerson(id)`, `getPersonAssets(id, limit=100, offset=0)`, `personRelations(id)`, `personPlaces(id)`, `mergePersons(fromId, intoId)`, `mergeSuggestions()`, `rejectMergeSuggestion(fromId, intoId)`, `reclusterFaces()`, `detachAssetsFromPerson(personId, assetIds)`, `personFaceThumbnailUrl(id)`。

- [ ] **Step 1: 写失败测试**(`src/photos.persons.test.ts`,复制 capture 辅助)

```ts
describe('photos 人物', () => {
  it('列表/详情/更新/封面', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.listPersons()
    await p.getPerson('p1')
    await p.updatePerson('p1', { name: '张三' })
    await p.setPersonCover('p1', 'a1')
    await p.resetPersonCover('p1')
    expect(calls[0]).toMatchObject({ method: 'get', url: '/photos/persons' })
    expect(calls[1]).toMatchObject({ method: 'get', url: '/photos/persons/p1' })
    expect(calls[2]).toMatchObject({ method: 'put', url: '/photos/persons/p1', body: { name: '张三' } })
    expect(calls[3]).toMatchObject({ method: 'put', url: '/photos/persons/p1/cover', body: { assetId: 'a1' } })
    expect(calls[4]).toMatchObject({ method: 'delete', url: '/photos/persons/p1/cover' })
  })
  it('删除/彻底清除(?purge=true 在 URL)/恢复', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.deletePerson('p1'); await p.purgePerson('p1'); await p.restorePerson('p1')
    expect(calls[0]).toMatchObject({ method: 'delete', url: '/photos/persons/p1' })
    expect(calls[1]).toMatchObject({ method: 'delete', url: '/photos/persons/p1?purge=true' })
    expect(calls[2]).toMatchObject({ method: 'post', url: '/photos/persons/p1/restore' })
  })
  it('资产分页/关系/地点', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.getPersonAssets('p1', 100, 200)
    await p.personRelations('p1')
    await p.personPlaces('p1')
    expect(calls[0]).toMatchObject({ url: '/photos/persons/p1/assets', params: { limit: 100, offset: 200 } })
    expect(calls[1]).toMatchObject({ url: '/photos/persons/p1/relations' })
    expect(calls[2]).toMatchObject({ url: '/photos/persons/p1/places' })
  })
  it('合并建议流(snake_case 请求体对齐后端)与重聚类/摘除', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.mergePersons('p1', 'p2')
    await p.mergeSuggestions()
    await p.rejectMergeSuggestion('p1', 'p2')
    await p.reclusterFaces()
    await p.detachAssetsFromPerson('p1', ['a1'])
    expect(calls[0]).toMatchObject({ method: 'post', url: '/photos/persons/merge', body: { from_id: 'p1', into_id: 'p2' } })
    expect(calls[1]).toMatchObject({ method: 'get', url: '/photos/persons/merge-suggestions' })
    expect(calls[2]).toMatchObject({ method: 'post', url: '/photos/persons/merge-suggestions/reject', body: { from_id: 'p1', into_id: 'p2' } })
    expect(calls[3]).toMatchObject({ method: 'post', url: '/photos/persons/recluster' })
    expect(calls[4]).toMatchObject({ method: 'post', url: '/photos/persons/p1/detach', body: { assetIds: ['a1'] } })
  })
  it('personFaceThumbnailUrl 带 token', () => {
    const p = createPhotos({} as AxiosInstance, () => 'T1')
    expect(p.personFaceThumbnailUrl('p1')).toBe('/v1/photos/persons/p1/face-thumbnail?token=T1')
  })
})
```

- [ ] **Step 2: 确认失败**;**Step 3: 实现**(追加;全部对照 Vue2 `photos.js:62-106` 逐方法移植,HTTP 形态照上方测试断言:GET 无体、PUT/POST 带体、`purgePerson` 的 `?purge=true` 拼在 URL、合并类请求体用 `from_id`/`into_id` snake_case、`personFaceThumbnailUrl` 用 `tokenQ('?')`):

```ts
    // ─── 人物 ───
    async listPersons(): Promise<unknown[]> {
      const res = await http.get('/photos/persons')
      return loose<unknown[]>(res.data)
    },
    async getPerson(id: string | number): Promise<unknown> {
      const res = await http.get(`/photos/persons/${id}`)
      return unwrap<unknown>(res.data)
    },
    async updatePerson(id: string | number, patch: Record<string, unknown>): Promise<unknown> {
      const res = await http.put(`/photos/persons/${id}`, patch)
      return unwrap<unknown>(res.data)
    },
    async setPersonCover(id: string | number, assetId: string | number): Promise<unknown> {
      const res = await http.put(`/photos/persons/${id}/cover`, { assetId })
      return unwrap<unknown>(res.data)
    },
    async resetPersonCover(id: string | number): Promise<unknown> {
      const res = await http.delete(`/photos/persons/${id}/cover`)
      return unwrap<unknown>(res.data)
    },
    async deletePerson(id: string | number): Promise<unknown> {
      const res = await http.delete(`/photos/persons/${id}`)
      return unwrap<unknown>(res.data)
    },
    async purgePerson(id: string | number): Promise<unknown> {
      const res = await http.delete(`/photos/persons/${id}?purge=true`)
      return unwrap<unknown>(res.data)
    },
    async restorePerson(id: string | number): Promise<unknown> {
      const res = await http.post(`/photos/persons/${id}/restore`, {})
      return unwrap<unknown>(res.data)
    },
    async getPersonAssets(id: string | number, limit = 100, offset = 0): Promise<unknown> {
      const res = await http.get(`/photos/persons/${id}/assets`, { params: { limit, offset } })
      return unwrap<unknown>(res.data)
    },
    async personRelations(id: string | number): Promise<unknown> {
      const res = await http.get(`/photos/persons/${id}/relations`)
      return unwrap<unknown>(res.data)
    },
    async personPlaces(id: string | number): Promise<unknown> {
      const res = await http.get(`/photos/persons/${id}/places`)
      return unwrap<unknown>(res.data)
    },
    async mergePersons(fromId: string | number, intoId: string | number): Promise<unknown> {
      const res = await http.post('/photos/persons/merge', { from_id: fromId, into_id: intoId })
      return unwrap<unknown>(res.data)
    },
    async mergeSuggestions(): Promise<unknown[]> {
      const res = await http.get('/photos/persons/merge-suggestions')
      return loose<unknown[]>(res.data)
    },
    async rejectMergeSuggestion(fromId: string | number, intoId: string | number): Promise<unknown> {
      const res = await http.post('/photos/persons/merge-suggestions/reject', { from_id: fromId, into_id: intoId })
      return unwrap<unknown>(res.data)
    },
    async reclusterFaces(): Promise<unknown> {
      const res = await http.post('/photos/persons/recluster', {})
      return unwrap<unknown>(res.data)
    },
    async detachAssetsFromPerson(personId: string | number, assetIds: Array<string | number>): Promise<unknown> {
      const res = await http.post(`/photos/persons/${personId}/detach`, { assetIds })
      return unwrap<unknown>(res.data)
    },
    personFaceThumbnailUrl(id: string | number): string {
      return `/v1/photos/persons/${id}/face-thumbnail${tokenQ('?')}`
    },
```

- [ ] **Step 4: 确认通过** — 单文件 + 全量 + build。
- [ ] **Step 5: Commit** — `git add src/photos.ts src/photos.persons.test.ts && git commit -m "photos 域:人物全套(封面/合并建议/重聚类/摘除)"`

---

