## Task 2: service `exportAlbumZipUrl` + store `duplicateAlbum`

**Files:**
- Modify: `packages/service/src/photos.ts`（在 `exportFavoritesUrl` 附近，`:140`）
- Modify: `src/photos/stores/albums.ts`（在 `saveAsAlbum` 之后，`:205` 附近）
- Test: `packages/service/src/photos.albums.test.ts`、`src/photos/stores/__tests__/albums.test.ts`

**Interfaces:**
- Produces: `service.photos.exportAlbumZipUrl(id: string | number): string` —— T5 消费
- Produces: `albums.duplicateAlbum(id: string | number): Promise<RawAlbum>` —— T5 消费

**取证依据:** E1（后端端点已存在且 JWT 豁免）、E2（favorites 同形前例）、E3（store 已有组合件）。

**适配点:**
- Vue2 注释写「后端端点并行开发中」——**这句已过期**，端点 `route/router.go:178` 已实装。
- `exportAlbumZipUrl` 照抄 `exportFavoritesUrl` 的 `tokenQ('?')` 手法，路径换 `albums/${id}/export`。
- `duplicateAlbum` = `createAlbum(新名)` + `addAssetsToAlbum(新 id, 原成员 id 列表)`。
  新名规则照靶子：`33b05636:src/views/Photos/PhotosAlbumDetail.vue` 的 `duplicateAlbum` 方法，
  **实现前打开核对命名后缀与是否复制封面**。
- 复用 `saveAsAlbum` 还是新写，由实现者读完 `saveAsAlbum`(`:205`) 后决定；若复用，在注释里登记为什么
  它的语义正好吻合。**若两者语义不同（例如 saveAsAlbum 不搬顺序），必须新写，不要硬套。**
- 需要重入守卫（照 store 内既有 `duplicateBusy`(`smartViews.ts:170`) 的写法）——
  P1 终审逮到过「`doDelete` 是全页唯一没有重入守卫的写操作，双击会为一次成功的删除报失败」。

- [ ] **Step 1: 写失败测试（service 层）**

```ts
// packages/service/src/photos.albums.test.ts — append
it('builds the album zip export url with the auth token in the query', () => {
  setToken('tok123')
  expect(service.photos.exportAlbumZipUrl(7)).toBe('/v1/photos/albums/7/export?token=tok123')
})

it('builds the album zip export url without a query when there is no token', () => {
  setToken('')
  expect(service.photos.exportAlbumZipUrl(7)).toBe('/v1/photos/albums/7/export')
})
```

> `setToken` 的实际名字以该测试文件里 `exportFavoritesUrl` 现有用例的写法为准 —— **打开文件照抄它的
> 夹具，不要照本计划猜**（P2b 的 T1 就因为计划没提到 5 个夹具文件而让 vue-tsc 变红）。

- [ ] **Step 2: 写失败测试（store 层）**

```ts
// src/photos/stores/__tests__/albums.test.ts — append
it('duplicates an album by creating a new one and batch-adding the source members', async () => {
  const s = usePhotosAlbums()
  s.__resetForTest()
  // seed one album with two assets, then assert BOTH calls happen and in this order
  // (create first -- the batch-add needs the new id).
  const created = await s.duplicateAlbum('1')
  expect(createSpy).toHaveBeenCalledBefore(addSpy)
  expect(addSpy).toHaveBeenCalledWith(created.id, ['a1', 'a2'])
})

it('prepends the duplicate to the album list so it is visible without a refetch', async () => {
  // assert the new album is at index 0 of the store's list
})

it('ignores a second duplicate call while the first is still in flight', async () => {
  // the re-entry guard: fire twice without awaiting, assert createAlbum ran once
})

it('clears the in-flight guard after a failure so a retry can proceed', async () => {
  // first call rejects; a second call must still be able to run
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm exec vitest run packages/service/src/photos.albums.test.ts src/photos/stores/__tests__/albums.test.ts`
Expected: FAIL —— `exportAlbumZipUrl is not a function` / `duplicateAlbum is not a function`

- [ ] **Step 4: 实现两处**

service 层（`packages/service/src/photos.ts`，紧跟 `exportFavoritesUrl`）：

```ts
    // SP15-P2c Task 2. Same GET + token shape as exportFavoritesUrl above: the backend serves
    // this as a plain download URL the browser navigates to, and Photos exempts the
    // `/albums/:id/export` suffix from JWT so the query token is the only credential
    // (NimoOS-Photos route/router.go:52, :178).
    exportAlbumZipUrl(id: string | number): string {
      return `/v1/photos/albums/${id}/export${tokenQ('?')}`
    },
```

store 层（`src/photos/stores/albums.ts`，紧跟 `saveAsAlbum`）。下面是骨架，**成员 id 的取法与新名
规则必须先读靶子的 `duplicateAlbum` 方法核对**（`33b05636:src/views/Photos/PhotosAlbumDetail.vue`）：

```ts
  // SP15-P2c Task 2. Vue2 does this purely on the front end -- there is no duplicate endpoint
  // (33b05636 PhotosAlbumDetail.vue duplicateAlbum). Create the new album first, because the
  // batch add needs its id.
  const duplicateBusy = ref(false)
  async function duplicateAlbum(id: string | number): Promise<RawAlbum> {
    // Re-entry guard, same shape as smartViews.ts:170's duplicateBusy. Without it a double
    // click creates two albums, and P1's final review caught exactly this class of bug on the
    // one write path that lacked a guard.
    if (duplicateBusy.value) throw new Error('duplicate already in flight')
    duplicateBusy.value = true
    try {
      const source = albumById(id)
      if (!source) throw new Error('album not found')
      const assetIds = assetsOf(id).map((p) => p.id)
      const created = await createAlbum(/* name per the target's rule */)
      if (assetIds.length) await addAssetsToAlbum(created.id, assetIds)
      return created
    } finally {
      // Always clear, so a failed attempt does not wedge the button for the rest of the session.
      duplicateBusy.value = false
    }
  }
```

`createAlbum` 已经把新相册 prepend 进列表（见其实现），所以不需要再手动 unshift ——
**动手前确认这一点仍然成立**，若不成立则补，并在注释里登记。
`return` 时记得把 `duplicateAlbum` 与 `duplicateBusy` 一起加进 store 的返回对象
（SP17 栽过：Pinia store 的 ref 漏写 return 不报错，外部读恒 `undefined`）。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm exec vitest run packages/service/src/photos.albums.test.ts src/photos/stores/__tests__/albums.test.ts`

- [ ] **Step 6: 变异验证**

1. 去掉重入守卫 → 「ignores a second duplicate call」应红
2. 把 `tokenQ('?')` 换成写死 `''` → 「with the auth token」应红
3. 失败路径不清守卫 → 「clears the in-flight guard after a failure」应红

- [ ] **Step 7: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add packages/service/src/photos.ts packages/service/src/photos.albums.test.ts src/photos/stores/albums.ts src/photos/stores/__tests__/albums.test.ts
git commit -m "feat(photos): add album zip export url and album duplication"
```

---

> **2026-08-10 pre-flight 修正（控制器，执行前）**：原计划把「删 `.album-toolbar`」（T3）与
> 「编辑态按钮落到底部浮条」（原 T6）拆成两个任务 —— 但那两个按钮就住在被删的容器里，拆开会让
> T4/T5 两个任务期间功能缺失，且 T3 的既有测试无处可搬。**原 T6 已并入 T3**，`.sv-side-actions`
> 容器改由 T5 自建（原 T4 不再建空壳）。**任务数 12 → 11，原 T7-T12 顺延为 T6-T11。**
> 这与 P2b「删共享比较器 + 视图仍调用它」是同一形状的计划缺陷，这次在派工前扫出来了。

