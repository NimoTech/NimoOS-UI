### Task 8: 容器接线 —— 面板挂载 · `hasDetailPanel` 真实化 · 灯箱 · toast · 跳库导航

**Files:**
- Modify: `src/views/PhotosPlaces.vue`
- Modify: `src/views/__tests__/PhotosPlaces.test.ts`
- Modify: `src/photos/composables/__tests__/usePlacesView.test.ts`(四条通路补「面板打开时」断言)
- Read-only 参考: `PhotosPlacesView.vue:290-312`(watch)、`:450-484`、`:517-560`、`:578-583`;`PhotosTimeline.vue:736-760`(相册 toast)、`:756-788`(跳库语义);本仓灯箱用法 `PhotosPersonDetail.vue:502`、`src/photos/lightbox/useLightbox.ts:55-67`+`:95-124`

**Interfaces:**
- Consumes: T2-T7 全部产物
- Produces: 无对外接口(容器)

**结构规格:**

1. **`activePlace` / `activeDetail` 分流(偏离登记 4)**:
   ```ts
   const activePlace = computed<Place | null>(() =>
     store.places.find((p) => String(p.id) === String(activeId.value)) ?? null)
   // 详情只在 id 与当前选中一致时才认 —— 切城市后新详情回来前,store.detail 还是上一个
   // 城市的(Vue2 :204 的 `activeDetail || find()` 会让 hero 短暂显示上一个城市)。
   const activeDetail = computed<PlaceDetail | null>(() =>
     (store.detail && String(store.detail.id) === String(activeId.value)) ? store.detail : null)
   const hasPanel = computed(() => activePlace.value != null || activeDetail.value != null)
   ```
2. **`hasDetailPanel` 换真实状态**:`usePlacesView({ svgEl: svgRef, wrapEl, hasDetailPanel: () => hasPanel.value })`。**这一行改完,`visibleCenterVb` 的 `panelFrac` 首次真正生效**,`autoPanTo`/`centerOn`/`zoomBy`/`setScale` 四条通路的落点全变 —— 见下方测试要求。
3. **面板挂载**:`.map-canvas-wrap` 内、`PlacesMap` 之后、`.map-tip` 之前(DOM 顺序不影响层级,z-index 已定 6,但保持「地图 → 面板 → tip/家具」的可读顺序):
   ```vue
   <PlaceDetailPanel
     v-if="hasPanel"
     :place="activePlace" :detail="activeDetail" :detail-loading="store.detailLoading"
     :active-spot-key="activeSpotKey" :spot-busy="store.spotBusy"
     @close="activeId = null"
     @open-cover-picker="openCoverPicker"
     @open-library="goLibrary()"
     @save-album="onSaveAlbum"
     @open-photo="onOpenPhoto"
     @pick-spot="onPickSpot"
     @close-spot="activeSpotKey = null"
     @rename="onRenameSpot"
     @reset-name="onResetSpotName"
     @open-spot-library="onOpenSpotLibrary"
     @save-trip="onSaveTrip"
   />
   ```
4. **新增容器状态**(照 Vue2 `:114-121`):`activeSpotKey`、`coverOpen`、`coverTab`(初 `'recent'`)、`coverSearch`、`coverPage`。
5. **`activeId` watch 追加重置**(照 Vue2 `:295-301`):切城市时 `coverOpen = false`、`coverTab = 'recent'`、`coverSearch = ''`、`coverPage = 0`、`activeSpotKey = null`。**既有的 `autoPanTo` + `loadDetail` 两行不动。**
6. **封面候选的三个 watch**(照 Vue2 `:304-312`):`coverTab` 变 → `coverPage = 0` 且拉候选;`coverSearch` 变 → 同上;`coverPage` 变 → 拉候选。拉取前置条件 `activeId && coverOpen`(照 Vue2 `:523`)。`openCoverPicker()` = 置 `coverOpen = true` 后拉一次(照 Vue2 `:517-521` 的 toggle 语义:**打开时拉、关闭时不拉**)。**不加 debounce(偏离 15-①)。**
7. **封面提交**:
   ```ts
   async function onPickCover(assetId: string): Promise<void> {
     coverOpen.value = false                 // 照 Vue2 :538:先关弹层再提交
     if (!activeId.value) return
     try { await store.setPlaceCover(activeId.value, assetId) }
     catch { toast.show(t('photosPlacesCoverFailed')) }   // 偏离登记 6:Vue2 无 catch
   }
   ```
   `onResetCover()` 同形。
8. **spot 三个动作**:
   ```ts
   function onPickSpot(spot: PlaceSpot): void { activeSpotKey.value = String(spot.key) }
   async function onRenameSpot(name: string): Promise<void> {
     if (!activeId.value || !activeSpotKey.value) return
     try { await store.setSpotName(activeId.value, activeSpotKey.value, name) }
     catch { toast.show(t('photosPlacesSpotRenameFailed')) }
   }
   // D8。失败文案与重命名共用一条(同一资源的同类操作)。
   async function onResetSpotName(): Promise<void> { /* 同形,调 store.resetSpotName */ }
   ```
   **成功后不关弹窗、不再补 `loadDetail`**(偏离 7:`setSpotName` 已就地回写 `detail.spots`;`resetSpotName` 在 store 内部自己重拉)。弹窗的编辑态由组件自己在 `props.spot.name` 变化后退出(T4 已实现)。
9. **相册与 toast**:
   ```ts
   async function createAlbum(name: string, from?: string, to?: string): Promise<void> {
     if (!activeId.value) return
     try {
       const album = await store.createPlaceAlbum(activeId.value, { name, from, to })
       toast.show(
         t('photosPlacesAlbumCreated', { name: album.name, count: album.count }),
         5000,
         { label: t('photosPlacesToastOpen'), onClick: () => { void router.push(`/photos/albums/${album.albumId}`) } },
       )
     } catch (e) {
       // busy 重入不是错误,不弹 toast(见 T2 的 albumBusy 契约)
       if ((e as Error)?.message !== 'albumBusy') toast.show(t('photosPlacesAlbumCreateFailed'))
     }
   }
   function onSaveAlbum(): void { void createAlbum(activePlace.value?.city ?? '') }   // Vue2 :458-462
   function onSaveTrip(v: PlaceVisit): void {                                          // Vue2 :463-472
     void createAlbum(`${activePlace.value?.city ?? ''} · ${v.when}`, v.from, v.to)
   }
   ```
   **toast 时长 5000ms**(带 action 的 toast 照本仓上传/回收站先例给长时长,默认 1500 太短点不到)。
10. **灯箱(D9)**:
    ```ts
    // 详情 payload 只给 assetId 字符串,没有资产对象;灯箱 openAt 需要 Photo。
    // assetToPhoto({ id }) 产出带默认值的合法 Photo,useLightbox 打开后会用
    // getAsset(id) 水合真实明细(useLightbox.ts:95-124),所以占位对象足够。
    function onOpenPhoto(assetId: string, list: string[]): void {
      const ids = list.length ? list : [assetId]
      const photos = ids.map((id) => assetToPhoto({ id }))
      const target = photos.find((p) => String(p.id) === String(assetId)) ?? photos[0]
      lb.openAt(target, photos)
    }
    ```
    模板末尾(**`AreaShell` 之外**,同 `PhotosAlbumDetail`/`PhotosPersonDetail` 既有位置)挂 `<PhotoLightbox />`。
11. **跳库导航**:
    ```ts
    function goLibrary(): void {
      const key = activePlace.value?.key ?? activeId.value
      if (key == null) return
      void router.push(`/photos/places/${encodeURIComponent(String(key))}`)
    }
    function onOpenSpotLibrary(): void {
      const spot = activeDetail.value?.spots.find((s) => String(s.key) === String(activeSpotKey.value))
      const key = activePlace.value?.key ?? activeId.value
      if (key == null || !spot) return
      activeSpotKey.value = null                     // 照 Vue2 :484:跳走前关掉弹窗
      void router.push({
        path: `/photos/places/${encodeURIComponent(String(key))}`,
        query: { spot: String(spot.key), lat: String(spot.lat), lon: String(spot.lon) },
      })
    }
    ```
    **`key` 用后端原始 key(int32),不是归一后的 `activeId`** —— 跳库页要拿它直接打后端。
12. **封面弹层挂载**:`AreaShell` **之外**(偏离 11),`v-if` 由 `coverOpen` 控制,props 全量接线,`@pick="onPickCover"`、`@reset="onResetCover"`、`@close="coverOpen = false"`、三个 `update:*` 回写容器状态。
13. **三浮层同开时 Esc 各自都关**:Filters(P6a)、主题(P6a)、封面弹层(T7)—— 本任务写一条集成测试钉住。

- [ ] **Step 1: 写失败测试**

`PhotosPlaces.test.ts` 追加(**既有 28 条一条都不能删**;2026-07-31 实测 `grep -c "  it("` = 28):
- 面板显隐:`activeId` 命中列表项 → `PlaceDetailPanel` 挂载;`activeId = null` → 卸载;点面板的 `close` → `activeId` 变 null 且 `loadDetail(null)` 被调。
- **偏离 4 守卫**:`store.detail` 是 B 城的、`activeId` 是 A 城 → 面板的 `detail` prop 为 **null**、`place` prop 是 A 城(不把 B 城详情喂给 A 城面板)。
- **`hasDetailPanel` 真实化**:spy `usePlacesView` 的入参?**改成行为断言更稳** —— 面板打开时触发一次 `setScale`,断言最终 `view.tx` 落点与「面板关闭时」不同(数值先手算:`wrapEl` 宽 1000 → `panelFrac = 0.42` → 中心 x = 290 而非 500)。
- 切城市重置:先打开封面弹层 + 选中一个 spot + 翻到第 2 页,再改 `activeId` → 弹层关闭、`coverTab` 回 `'recent'`、`coverSearch` 空、`coverPage` 0、`activeSpotKey` null。
- 封面候选拉取:`openCoverPicker` 拉一次;改 `coverTab` → `coverPage` 归 0 且再拉一次;改 `coverSearch` → 同;改 `coverPage` → 拉一次;**`coverOpen = false` 时改 tab 不拉**。
- 封面提交:点 cell → 弹层先关、`setPlaceCover` 被调;store 抛错 → toast 文案是「封面更新失败」。`reset` 同形。
- spot:面板 emit `pick-spot` → 面板收到的 `activeSpotKey` 是 `String(spot.key)`;emit `rename` → `setSpotName` 被调且**没有**额外的 `loadDetail`(偏离 7 守卫);emit `reset-name` → `resetSpotName` 被调;两者抛错各弹一次 toast。
- 相册:emit `save-album` → `createPlaceAlbum` 收到 `{ name: 城市名 }`;emit `save-trip` → 收到 `` `城市 · when` `` + `from`/`to`;成功 → toast 文案含相册名与张数、**带 action**;点 action → `router.push('/photos/albums/<id>')`;失败 → 失败 toast;**`albumBusy` 错误不弹 toast**。
- 灯箱(D9):emit `open-photo('b', ['a','b','c'])` → `lb.openAt` 收到的 `list` 长度 3、当前项 id 是 `'b'`;emit `open-photo('x', [])` → list 长度 1。
- 跳库:emit `open-library` → `router.push` 到 `/photos/places/7`(fixture 的后端 key 是数字 7,**证明用的是 key 不是归一 id**);emit `open-spot-library` → path 同上且 query 含 `spot`/`lat`/`lon`,且 `activeSpotKey` 被清空。
- **三浮层同开时一次 Esc 三者都关**(`document` keydown + `bubbles: true`)。

`usePlacesView.test.ts` 追加(P6a 接缝二,**四条通路各一条**,`wrapEl` 宽 1000 → `panelFrac = 0.42` → 可见中心 x = 290):
- `centerOn(wx, wy, 2)` 在 `hasDetailPanel = () => true` 下,推完动画帧后 `tx === 290 - wx * 2`(先手算)。
- `zoomBy(2)` 从 scale 1 起:锚点是 `(290, 250)`,断言 `tx` 与「面板关闭时锚点 500」的结果不同且等于手算值。
- `setScale(4)`:同上。
- `autoPanTo(place)`:最终该点落在 x = 290(不是 500)。
> 现有三条 `visibleCenterVb` 算术用例(0.42 / 0.55 / 0)已覆盖 panelFrac 本身,这四条钉的是**四条消费通路真的走了它**。

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现**
- [ ] **Step 4: 跑全量 + tsc + 逐个删码验证**

Run: `pnpm exec vitest run && pnpm exec vue-tsc --noEmit`

删码清单(一次只删一处):①`hasDetailPanel` 改回 `() => false` → 四条通路用例 + 容器落点用例红;②`activeDetail` 的 id 匹配条件删掉 → 偏离 4 守卫红;③切城市重置那一段删掉 → 重置用例红;④`onPickCover` 里的 `coverOpen = false` 删掉 → 「先关弹层」红;⑤`createAlbum` 的 `albumBusy` 判据删掉 → 「busy 不弹 toast」红;⑥`goLibrary` 的 `activePlace.key` 换成 `activeId` → 跳库 URL 用例红(fixture 的 id 与 key 刻意不同);⑦`onOpenPhoto` 的 `list.length ? list : [assetId]` 改成恒 `[assetId]` → D9 用例红;⑧封面拉取的 `coverOpen` 前置条件删掉 → 「关闭时改 tab 不拉」红。

- [ ] **Step 5: Commit**

```bash
git add src/views/PhotosPlaces.vue src/views/__tests__/PhotosPlaces.test.ts src/photos/composables/__tests__/usePlacesView.test.ts
git commit -m "feat(photos): P6b-T8 容器接线 —— 详情面板/封面弹层/spot/灯箱/相册 toast/跳库导航

- hasDetailPanel 换真实状态,panelFrac 首次生效;四条居中通路补「面板打开时」断言(P6a 接缝二)
- activeDetail 只在 id 与 activeId 匹配时才认(偏离登记 4:Vue2 会短暂显示上一个城市)
- 灯箱翻页集取被点区块自己的数组(D9);占位 Photo 由 useLightbox 自行水合明细"
```

---

