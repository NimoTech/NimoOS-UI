### Task 5: 地点

**Files:**
- Modify: `src/photos.ts`
- Create: `src/photos.places.test.ts`

**Interfaces:**
- Produces: `listPlaces(params={})`, `listAssetsByPlace(placeKey, spotKey='', limit=500, lat=null, lon=null)`, `getPlace(key)`, `placeCoverCandidates(key, {tab='recent', q='', page=0})`, `setPlaceCover(key, assetId)`, `resetPlaceCover(key)`, `setSpotName(key, spotKey, name)`, `resetSpotName(key, spotKey)`, `createPlaceAlbum(key, {name, from='', to=''})`。

- [ ] **Step 1: 写失败测试**(`src/photos.places.test.ts`,复制 capture 辅助)

```ts
describe('photos 地点', () => {
  it('listAssetsByPlace 条件参数:spotKey 与 spot_lat/lon 成对才带(对齐 Vue2 注释:质心钉住精确 spot 簇)', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.listAssetsByPlace('cn-hz')
    expect(calls[0]).toMatchObject({ url: '/photos/assets', params: { place_key: 'cn-hz', limit: 500 } })
    await p.listAssetsByPlace('cn-hz', 's1', 100, 30.2, 120.1)
    expect(calls[1].params).toEqual({ place_key: 'cn-hz', limit: 100, spot_key: 's1', spot_lat: 30.2, spot_lon: 120.1 })
    await p.listAssetsByPlace('cn-hz', '', 100, 30.2, 120.1) // 无 spotKey 时坐标不带
    expect(calls[2].params).toEqual({ place_key: 'cn-hz', limit: 100 })
  })
  it('详情/封面候选/封面设复位', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.listPlaces({ q: '杭' })
    await p.getPlace('cn-hz')
    await p.placeCoverCandidates('cn-hz', { tab: 'best', q: '塔', page: 2 })
    await p.setPlaceCover('cn-hz', 'a1')
    await p.resetPlaceCover('cn-hz')
    expect(calls[0]).toMatchObject({ url: '/photos/places', params: { q: '杭' } })
    expect(calls[1]).toMatchObject({ url: '/photos/places/cn-hz' })
    expect(calls[2]).toMatchObject({ url: '/photos/places/cn-hz/cover-candidates', params: { tab: 'best', q: '塔', page: 2 } })
    expect(calls[3]).toMatchObject({ method: 'put', url: '/photos/places/cn-hz/cover', body: { assetId: 'a1' } })
    expect(calls[4]).toMatchObject({ method: 'delete', url: '/photos/places/cn-hz/cover' })
  })
  it('spot 命名:set 走 PUT 体,reset 走 DELETE 且 spotKey 在请求体(api.delete(url,data) 语义)', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.setSpotName('cn-hz', 's1', '西湖')
    await p.resetSpotName('cn-hz', 's1')
    expect(calls[0]).toMatchObject({ method: 'put', url: '/photos/places/cn-hz/spot-name', body: { spotKey: 's1', name: '西湖' } })
    expect(calls[1].method).toBe('delete')
    expect((calls[1].cfg as { data?: unknown })?.data).toEqual({ spotKey: 's1' })
  })
  it('createPlaceAlbum 默认 from/to 空串', async () => {
    const { http, calls } = capture()
    await createPhotos(http, noToken).createPlaceAlbum('cn-hz', { name: '杭州行' })
    expect(calls[0]).toMatchObject({ method: 'post', url: '/photos/places/cn-hz/album', body: { name: '杭州行', from: '', to: '' } })
  })
})
```

- [ ] **Step 2: 确认失败**;**Step 3: 实现**(追加):

```ts
    // ─── 地点 ───
    async listPlaces(params: Record<string, unknown> = {}): Promise<unknown[]> {
      const res = await http.get('/photos/places', { params })
      return loose<unknown[]>(res.data)
    },
    async listAssetsByPlace(placeKey: string, spotKey = '', limit = 500, lat: number | null = null, lon: number | null = null): Promise<unknown> {
      const params: Record<string, unknown> = { place_key: placeKey, limit }
      if (spotKey) params.spot_key = spotKey
      // 质心钉住精确 spot 簇(避免网格 key 撞车);仅与 spotKey 成对时有意义,后端要求成对
      if (spotKey && lat != null && lon != null) { params.spot_lat = lat; params.spot_lon = lon }
      const res = await http.get('/photos/assets', { params })
      return unwrap<unknown>(res.data)
    },
    async getPlace(key: string): Promise<unknown> {
      const res = await http.get(`/photos/places/${key}`)
      return unwrap<unknown>(res.data)
    },
    async placeCoverCandidates(key: string, { tab = 'recent', q = '', page = 0 }: { tab?: string; q?: string; page?: number } = {}): Promise<unknown> {
      const res = await http.get(`/photos/places/${key}/cover-candidates`, { params: { tab, q, page } })
      return unwrap<unknown>(res.data)
    },
    async setPlaceCover(key: string, assetId: string | number): Promise<unknown> {
      const res = await http.put(`/photos/places/${key}/cover`, { assetId })
      return unwrap<unknown>(res.data)
    },
    async resetPlaceCover(key: string): Promise<unknown> {
      const res = await http.delete(`/photos/places/${key}/cover`)
      return unwrap<unknown>(res.data)
    },
    async setSpotName(key: string, spotKey: string, name: string): Promise<unknown> {
      const res = await http.put(`/photos/places/${key}/spot-name`, { spotKey, name })
      return unwrap<unknown>(res.data)
    },
    async resetSpotName(key: string, spotKey: string): Promise<unknown> {
      const res = await http.delete(`/photos/places/${key}/spot-name`, { data: { spotKey } })
      return unwrap<unknown>(res.data)
    },
    async createPlaceAlbum(key: string, { name, from = '', to = '' }: { name: string; from?: string; to?: string }): Promise<unknown> {
      const res = await http.post(`/photos/places/${key}/album`, { name, from, to })
      return unwrap<unknown>(res.data)
    },
```

- [ ] **Step 4: 确认通过**;**Step 5: Commit** — `git add src/photos.ts src/photos.places.test.ts && git commit -m "photos 域:地点全套(spot 簇质心/封面/命名)"`

---

