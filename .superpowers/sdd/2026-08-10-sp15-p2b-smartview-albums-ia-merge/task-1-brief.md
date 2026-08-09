## Task 1: 数据层（service + store + AlbumView 扩字段）← 逐任务评审

**Files:**
- Modify: `packages/service/src/photos.ts`（在 `previewSmartView` 之后、
  `// ─── Smart view manual asset actions (SP15-P2a) ───` 之前插入）
- Create: `packages/service/src/photos.convert.test.ts`
- Modify: `src/photos/stores/smartViews.ts`
- Modify: `src/photos/stores/albums.ts`
- Modify: `src/photos/util/albumView.ts`
- Modify: `src/photos/util/__tests__/albumView.test.ts`
- Modify: `oss/manifest.mjs`
- Test: `packages/service/src/photos.convert.test.ts` ·
  `src/photos/stores/__tests__/smartViews.test.ts`（追加）·
  `src/photos/stores/__tests__/albums.test.ts`（追加）·
  `src/photos/util/__tests__/albumView.test.ts`（追加）

> 测试文件的**确切路径**先用
> `ls src/photos/stores/__tests__/ src/photos/util/__tests__/` 核一次；本仓测试与实现
> 同目录或同目录 `__tests__/` 两种形态都有，照该 store 已有测试的实际位置追加，
> **不要新建第二个位置**。

**Interfaces:**
- Produces（T2/T3/T7/T8 依赖这些确切签名）：
  - `service.photos.convertAlbumToSmart(albumId: string | number, payload: { description: string; threshold: number; name?: string; conds?: string[]; includeVideos?: boolean }): Promise<unknown>`
  - `service.photos.convertSmartToAlbum(smartViewId: string | number): Promise<unknown>`
  - `interface SmartView { …; createdAt: string }`（新增字段，缺失归一成 `''`）
  - `smartViewsStore.convertFromAlbum(albumId: string | number, input: { description: string; threshold: number }): Promise<SmartView>` —— 成功返回新 SmartView 并已 `unshift` 进 `smartViews`；失败 **throw**
  - `albumsStore.convertFromSmartView(smartViewId: string): Promise<Record<string, unknown>>` —— 成功返回新 album 原始对象并已插入 `albums`；失败 **throw**
  - `interface AlbumView { …; videoCount: number; dateStart: string | null }`

---

- [ ] **Step 1: 核对后端契约（只读，不改代码）**

跑这三条，把输出贴进任务报告 —— 后面每一步都以它们为准，不要凭本计划的转述：

```bash
cd /home/nimo/NimoTech/NimoOS-Photos
sed -n '230,265p' route/v1/smartviews.go        # FromAlbum：请求字段 + 400/404
sed -n '286,315p' route/v1/albums.go            # FromSmartView：请求字段 + 400/404/409
grep -n "CreatedAt" service/smartview.go        # 确认 SmartView DTO 有 createdAt
```

预期结论：`POST /photos/smart-views/from-album` 收
`{albumId, name?, description, conds?, threshold, includeVideos?}`、返回**完整 SmartView**；
`POST /photos/albums/from-smartview` 收 `{smartViewId}`、返回**完整 Album**，撞名 **409**；
`service/smartview.go:23` 有 `CreatedAt time.Time \`json:"createdAt"\``。

**若任一条与预期不符，停下来在报告里写清差异，不要按本计划继续。**

- [ ] **Step 2: 写失败测试（service 层）**

Create `packages/service/src/photos.convert.test.ts`。harness 逐字照
`packages/service/src/photos.smartviewAssets.test.ts:1-20` 的既有形态（同一个仓、同一层）：

```ts
// SP15-P2b-T1: the two album <-> smart-view conversion endpoints. Verified against
// NimoOS-Photos/route/v1/smartviews.go (FromAlbum) and route/v1/albums.go
// (FromSmartView): both return the full new object, not a change count, and the
// album-name collision surfaces as HTTP 409.
import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPhotos } from './photos.js'

type Call = { method: string; url: string; body?: unknown }

function harness(reply: unknown = {}) {
  const calls: Call[] = []
  const http = {
    post: async (url: string, body?: unknown) => { calls.push({ method: 'post', url, body }); return { data: reply } },
  } as unknown as AxiosInstance
  return { calls, photos: createPhotos(http, () => 'TOK') }
}

describe('album <-> smart view conversion API', () => {
  it('convertAlbumToSmart posts albumId alongside the payload and returns the new smart view', async () => {
    const a = harness({ id: 'sv-new', name: 'Trip' })
    const out = await a.photos.convertAlbumToSmart('al-1', { description: 'sunsets', threshold: 80 })
    expect(out).toEqual({ id: 'sv-new', name: 'Trip' })
    expect(a.calls[0]).toMatchObject({
      method: 'post',
      url: '/photos/smart-views/from-album',
      body: { albumId: 'al-1', description: 'sunsets', threshold: 80 },
    })
  })

  it('convertAlbumToSmart keeps a numeric album id intact in the body', async () => {
    const a = harness({ id: 'sv-new' })
    await a.photos.convertAlbumToSmart(7, { description: 'x', threshold: 60 })
    expect((a.calls[0].body as { albumId: unknown }).albumId).toBe(7)
  })

  it('convertAlbumToSmart forwards the optional fields when given', async () => {
    const a = harness({ id: 'sv-new' })
    await a.photos.convertAlbumToSmart('al-1', {
      description: 'x', threshold: 70, name: 'N', conds: ['scene: sunset'], includeVideos: true,
    })
    expect(a.calls[0].body).toEqual({
      albumId: 'al-1', description: 'x', threshold: 70, name: 'N', conds: ['scene: sunset'], includeVideos: true,
    })
  })

  it('convertSmartToAlbum posts only smartViewId and returns the new album', async () => {
    const a = harness({ id: 'al-new', name: 'Trip' })
    const out = await a.photos.convertSmartToAlbum('sv-1')
    expect(out).toEqual({ id: 'al-new', name: 'Trip' })
    expect(a.calls[0]).toMatchObject({
      method: 'post', url: '/photos/albums/from-smartview', body: { smartViewId: 'sv-1' },
    })
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

```bash
pnpm exec vitest run packages/service/src/photos.convert.test.ts
```

预期：FAIL —— `photos.convertAlbumToSmart is not a function`。

- [ ] **Step 4: 实现两个 service 方法**

在 `packages/service/src/photos.ts` 的 `previewSmartView` 之后插入。**不要**给
`payload` 加默认值（Vue2 那个 `= {}` 默认参数在本仓没有调用方会用到，加了只会让
`description` 可能缺失而后端解析不出条件）：

```ts
    // ─── Album <-> smart view conversion (SP15-P2b) ───
    // Both endpoints convert in place and delete the source object, and both answer
    // with the full new object rather than a change count — the callers push straight
    // into their store and navigate to the new detail route, so a count would be
    // useless. `conds` is deliberately optional: leaving it out lets the backend's
    // svparser derive the conditions from `description`, the same path Create takes.
    async convertAlbumToSmart(
      albumId: string | number,
      payload: { description: string; threshold: number; name?: string; conds?: string[]; includeVideos?: boolean },
    ): Promise<unknown> {
      const res = await http.post('/photos/smart-views/from-album', { albumId, ...payload })
      return body<unknown>(res.data)
    },
    async convertSmartToAlbum(smartViewId: string | number): Promise<unknown> {
      const res = await http.post('/photos/albums/from-smartview', { smartViewId })
      return body<unknown>(res.data)
    },
```

- [ ] **Step 5: 跑测试确认通过**

```bash
pnpm exec vitest run packages/service/src/photos.convert.test.ts
```

预期：4 例全绿。

- [ ] **Step 6: 登记新测试文件到 oss/manifest.mjs**

`packages/service/src/photos.*.test.ts` 在 `oss/manifest.mjs` 里是**逐个枚举**的
（见 `'src/photos.smartviewAssets.test.ts'` 那一段）。在同一段里加：

```js
  'src/photos.convert.test.ts',
```

（注意：那份清单的路径是**相对内嵌共享包根**的，所以是 `src/photos.convert.test.ts`
而不是 `packages/service/src/...` —— 照它同段邻居的写法，不要自己推。）

- [ ] **Step 7: 写失败测试（`SmartView.createdAt`）**

在 smartViews store 的既有测试文件里追加：

```ts
  it('normalises createdAt off the wire and falls back to an empty string', () => {
    // The backend has always returned it (NimoOS-Photos service/smartview.go:23);
    // the front-end type simply never carried it until the global album sort needed it.
    const store = usePhotosSmartViews()
    store.__seedForTest?.([])
    expect(toSmartViewForTest({ id: 'a', createdAt: '2026-01-02T03:04:05Z' }).createdAt)
      .toBe('2026-01-02T03:04:05Z')
    expect(toSmartViewForTest({ id: 'a' }).createdAt).toBe('')
  })
```

⚠ `toSmartView` 是模块私有函数，**没有**导出。实现者两条路选一条，**不要新增
`__resetForTest` 之外的测试后门**：

- 优先：通过 `fetchSmartViews` 的既有 service mock 喂一条带/不带 `createdAt` 的原始
  对象，再断言 `store.smartViews[0].createdAt`（该文件已有此形态的用例，照抄）。
- 备选（仅当上一条在该文件里不可行）：把断言写成上面那样，并**同时**导出 `toSmartView`，
  在导出处写明「为测试导出，属归一函数、无副作用」。

- [ ] **Step 8: 跑测试确认失败，然后实现**

```bash
pnpm exec vitest run src/photos/stores/__tests__/smartViews.test.ts
```

预期 FAIL（`createdAt` 是 `undefined`）。然后：

- `interface SmartView` 在 `evaluatedAt` 之后加一行：

```ts
  // Present on the wire since the backend's first version (service/smartview.go:23).
  // Carried here from SP15-P2b onward because the Albums page's global sort ranks
  // manual albums and smart albums against each other by creation time.
  createdAt: string
```

- `toSmartView` 在 `evaluatedAt` 之后加一行：

```ts
    createdAt: String(r.createdAt ?? ''),
```

再跑，预期绿。

- [ ] **Step 9: 写失败测试（两个 store 的 convert action）**

smartViews store 测试追加（service mock 的形态照该文件既有用例）：

```ts
  it('convertFromAlbum unshifts the new smart view and returns it', async () => {
    // ...mock service.photos.convertAlbumToSmart -> { id: 'sv-new', name: 'N', createdAt: '2026-02-01T00:00:00Z' }
    const store = usePhotosSmartViews()
    const sv = await store.convertFromAlbum('al-1', { description: 'sunsets', threshold: 80 })
    expect(sv.id).toBe('sv-new')
    expect(store.smartViews[0].id).toBe('sv-new')
  })

  it('convertFromAlbum rethrows so the caller can keep its dialog open', async () => {
    // ...mock convertAlbumToSmart -> rejects
    const store = usePhotosSmartViews()
    await expect(store.convertFromAlbum('al-1', { description: 'x', threshold: 80 })).rejects.toBeTruthy()
    expect(store.smartViews).toHaveLength(0)
  })
```

albums store 测试追加：

```ts
  it('convertFromSmartView unshifts the new album and returns the raw object', async () => {
    // ...mock service.photos.convertSmartToAlbum -> { id: 'al-new', name: 'N', videoCount: 2 }
    const store = usePhotosAlbums()
    const album = await store.convertFromSmartView('sv-1')
    expect(album.id).toBe('al-new')
    expect(store.albums[0].id).toBe('al-new')
  })

  it('convertFromSmartView rethrows instead of swallowing the failure', async () => {
    // ...mock convertSmartToAlbum -> rejects
    const store = usePhotosAlbums()
    await expect(store.convertFromSmartView('sv-1')).rejects.toBeTruthy()
    expect(store.albums).toHaveLength(0)
  })
```

- [ ] **Step 10: 实现两个 action**

`src/photos/stores/smartViews.ts` —— 放在 `duplicateSmartView` 之后，并加进 `return {}`：

```ts
  // SP15-P2b: a manual album turns into a smart view in place. The backend pins every
  // existing member, deletes the album, and hands back the full new smart view, so the
  // only thing left to do here is put it at the head of the list — no refetch needed.
  //
  // Deviation from Vue2 (939a7d3a:PhotosAlbumsView.vue:728-743): its handler refetched
  // both lists and then pushed an optimistic copy as a belt-and-braces measure, because
  // its list page stays mounted while the detail panel swaps in. Here the caller
  // navigates to the new smart view's own route and any return to the list remounts and
  // refetches, so neither the double fetch nor the optimistic slot has anything to do.
  //
  // Rethrows on failure (this store's established contract, same as createSmartView):
  // the dialog decides what to show and stays open so the user can retry.
  async function convertFromAlbum(
    albumId: string | number,
    input: { description: string; threshold: number },
  ): Promise<SmartView> {
    const raw = await service.photos.convertAlbumToSmart(albumId, {
      description: input.description,
      threshold: input.threshold,
    })
    const created = toSmartView(raw)
    smartViews.value.unshift(created)
    return created
  }
```

`src/photos/stores/albums.ts` —— 放在 `saveAsAlbum` 之后，并加进 `return {}`：

```ts
  // SP15-P2b: a smart view solidifies into a manual album in place. Mirror image of
  // smartViews.convertFromAlbum — see its comment for why there is no refetch and no
  // optimistic slot. The raw backend object is stored as-is, matching this store's
  // convention of keeping albums unmapped (the views map them through albumToView).
  //
  // Rethrows on failure. Note this store's fetchAlbums deliberately swallows errors;
  // that is not the pattern to follow for a user-initiated write.
  async function convertFromSmartView(smartViewId: string): Promise<RawAlbum> {
    const raw = await service.photos.convertSmartToAlbum(smartViewId)
    const album = (raw ?? {}) as RawAlbum
    albums.value = [album, ...albums.value]
    return album
  }
```

**不要**给这两个 action 加 `busy` 守卫 —— 调用方（弹窗）自己持有 `converting` 状态并
用它 disable 按钮，在 store 里再加一层会让"失败后立刻重试"被静默吞掉。

- [ ] **Step 11: 跑测试确认通过**

```bash
pnpm exec vitest run src/photos/stores
```

- [ ] **Step 12: `AlbumView` 扩两个字段**

先在 `src/photos/util/__tests__/albumView.test.ts` 的 `albumToView` describe 里追加：

```ts
  it('carries videoCount and dateStart through for the detail sidebar and the global sort', () => {
    const v = albumToView({ id: 1, videoCount: 3, dateStart: '2025-06-01' }, 'x')
    expect(v.videoCount).toBe(3)
    expect(v.dateStart).toBe('2025-06-01')
  })
  it('defaults videoCount to 0 and dateStart to null when absent', () => {
    // videoCount is not omitempty on the wire (NimoOS-Photos service/types.go:179), so
    // the fallback only covers a partial fixture, not a real response.
    const v = albumToView({ id: 1 }, 'x')
    expect(v.videoCount).toBe(0)
    expect(v.dateStart).toBeNull()
  })
```

再改 `albumView.ts`：`interface AlbumView` 加

```ts
  videoCount: number // P2b: the detail sidebar's Videos cell
  dateStart: string | null // P2b: raw taken_at of the earliest member; drives the 'date' sort
```

`albumToView` 的返回对象加

```ts
    videoCount: Number(a.videoCount ?? 0),
    dateStart: (a.dateStart as string | undefined) || null,
```

跑 `pnpm exec vitest run src/photos/util/__tests__/albumView.test.ts`，预期绿。

- [ ] **Step 13: vue-tsc + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add -A
git commit -m "feat(photos): add the album <-> smart view conversion data layer

The two endpoints have existed on the backend since before this UI work
(route/v1/smartviews.go FromAlbum, route/v1/albums.go FromSmartView) and both
answer with the full new object, so the store actions just put it at the head of
their list; there is no refetch and no optimistic slot because the callers
navigate to the new detail route and any return to a list remounts it.

SmartView gains createdAt. The field has been on the wire from the start
(service/smartview.go:23) but the front-end type never carried it, and the
Albums page's forthcoming global sort ranks manual and smart albums against each
other by creation time -- without the field every smart album would silently
fall into the missing-value branch and the tests would pass for the wrong
reason.

AlbumView gains videoCount and dateStart for the detail sidebar's Videos cell
and the 'date' sort's earliest-member semantics."
```

---

