### Task 8: `PhotosAlbumDetail.vue` — 相册详情视图

> 本期最大的一件。实现者**必须打开 Vue2 `PhotosAlbumDetail.vue`(419 行)逐段对照移植**,本 brief 给结构清单与接口契约,不是行为的唯一来源。

**Files:**
- Create: `src/views/PhotosAlbumDetail.vue`
- Test: `src/views/__tests__/PhotosAlbumDetail.test.ts`

**Interfaces:**
- Consumes:`AreaShell`、`PhotosSidebar`、T2 `usePhotosAlbums`、T1 `albumToView`/`sortAlbumPhotos`、T4 `useAlbumDragSort`、T6 `AlbumLibraryPicker`、`PhotoLightbox` + `useLightbox`(P2)、`useToast`、`service.photos.thumbnailUrl`、i18n(T3)、`useRoute`/`useRouter`。
- 路由参数:`route.params.id`(**字符串**)。`album` computed = `albums.albumById(route.params.id)` → `albumToView(...)`;**为 null 时**(直链进来、列表未加载)渲染骨架,并靠 `onMounted` 的 `fetchAlbums()` 补齐;`fetchAlbums` 完成后仍为 null(相册不存在)→ 渲染「相册不存在」空态 + 返回按钮(New-UI 补齐项,Vue2 因页内 state 不会出现此情形,记账)。
- 本地状态:`edit`(ref false)、`selected`(`ref<Set<string>>`,String 归一)、`sortBy`(ref `'manual'`)、`density`(ref `'comfortable'`)、`titleEditing`/`titleDraft`、`menuOpen`、`confirmDelete`、`pickerOpen`。
- 结构(照 Vue2 `:4-188`,**去掉 Slideshow 与 Ask Nimo**):
  - **Hero**:背景 = 封面大图(`thumbnailUrl(album.cover,'large')`,无封面 → 渐变,照 Vue2 `coverBgImage:220-223`);返回按钮(`photosAlbumBack`,→ `router.push('/photos/albums')`);`photosAlbumLabel` 小标签;标题(点击进编辑,`title` 属性 `photosAlbumClickToRename`);编辑态 `<input>`(Enter 提交 / Esc 取消 / blur 提交,进入时全选,照 `:321-351`);`photosItemsCount` + `album.dateRange`;右侧按钮:Edit/Done 切换 + ⋯ 菜单(`photosAlbumRename` / `photosAlbumDelete` + `photosAlbumDeleteHint`)。⋯ 菜单点外部关闭(`document mousedown`,照 `:264-280` 的 `_onDoc`,`onUnmounted` 必须移除)。
  - **工具条**(edit 态才显示批量区,照 `:74-125`):左 = `photosAlbumItemsShown {count}` 或 `photosSelectedCount {count}`,以及提示语(edit&&manual → `photosAlbumHintSelectDragCover`,edit 非 manual → `photosAlbumHintSelectCover`,照 `:377-378`);中 = 排序下拉(`photosAlbumSortManual`/`photosAlbumSortTaken`/`photosAlbumSortAdded`)+ density 切换(`photosDensityComfortable`/`photosDensityCompact`);右(仅 edit)= `photosAlbumRemoveFrom`(选中为 0 时 disabled)+ `photosAlbumAddPhotos`。
  - **网格** `.album-photo-grid`(自绘扁平;`ref` 给 T4 的 container):
    - 加载态(`albums.isLoadingAssets(id) && photos.length===0`)→ 6 个骨架瓦片(照 `:132-134`)。
    - 空态(非加载且 `photos.length===0`)→ `photosAlbumEmptyTitle` / `photosAlbumEmptyHint`(New-UI 补齐)。
    - 瓦片 `.tile` **必须带 `:data-id="p.id"`**(T4 的 `onEnd` 从 DOM 按此属性读序);`<img :src="thumbnailUrl(p.id,'small')">`;右上封面星标 `.tile-cover-btn`(`@click.stop="setCover(p)"`;当前封面项显示实心并加 `photosAlbumCurrentCover` title,其余 `photosAlbumSetCover`,**判定用 `String(p.id) === String(album.cover)` 值比较**);edit 态左上勾选圈(`selected.has(String(p.id))`)。
    - `@contextmenu.prevent="setCover(p)"`(照 Vue2 `:144` + `:362-365`,右键即设封面)。
  - **删除确认模态**(照 `:164-181`):`photosAlbumDeleteTitle {name}` / `photosAlbumDeleteBody {count}` / `photosCancel` / danger 主按钮 `photosAlbumDelete`;Esc 关。面板底色用 `--popup-bg`(P2 血泪)。
  - `<AlbumLibraryPicker v-model:open="pickerOpen" :album-id :album-name @added="onPickerAdded">`。
  - `<PhotoLightbox @delete="onLightboxDelete" @toggle-fav="() => {}" @add-to-album="onAddToAlbum">`(`add-to-album` 由 T9 加进灯箱;**T8 先接 handler 占位,T9 落地按钮后即通**;若 T9 尚未完成,此 emit 尚不存在 —— 实现顺序上 T8 在 T9 之前,故 **T8 只挂 `@delete`,`add-to-album` 的接线归 T9**)。
- 行为:
  - `photos` computed = `sortAlbumPhotos(albums.assetsOf(route.params.id), sortBy)`。
  - `onMounted`:`if (!albums.albumsLoaded) void albums.fetchAlbums()`;`void albums.fetchAlbumAssets(id)`;`nextTick(() => drag.refresh())`。
  - `watch(() => route.params.id)` → 重新 `fetchAlbumAssets` + 清 `selected` + `nextTick(drag.refresh)`(照 Vue2 `watch['album.id']:258-260`)。
  - `watch([edit, sortBy])` → `nextTick(() => drag.refresh())`(照 `:261-262`)。
  - `onBeforeUnmount` → `drag.destroy()` + 移除 document 监听。
  - `onTileClick(p)`:**`if (drag.isDragging()) return`**(拖拽后守卫,照 Vue2 `:380-384` 的 `_dragging`);`edit` → toggle `selected`;否则 → `lb.openAt(p, photos.value, 0)`(**翻页集 = 当前排序后的相册资产**,照 Vue2 `$emit('open-photo', p, this.photos)`)。
  - `commitTitle()`(照 `:328-347`):draft trim 为空或与原名相同 → 直接退出编辑;否则 `await albums.renameAlbum(id, draft)` → toast `photosAlbumRenamedToast`;catch → 409 → `photosAlbumNameExists`,否则 `photosAlbumRenameFailed`,**并把标题还原为原名**。
  - `setCover(p)`:`await albums.setAlbumCover(id, p.id)` → toast `photosAlbumCoverUpdatedToast`;catch → `photosAlbumCoverFailed`(store 已回滚)。
  - `removeSelected()`(照 `:300-315`):`await albums.removeAssetsFromAlbum(id, [...selected])` → toast `photosAlbumRemovedToast {count}` + 清空 selected;catch → `photosAlbumRemoveFailed`。**无二次确认**(忠于 Vue2 —— 移除不删照片本体)。
  - `doDelete()`:`await albums.deleteAlbum(id)` → toast `photosAlbumDeletedToast {name}` → `router.push('/photos/albums')`;catch → `photosAlbumDeleteFailed`,模态关闭。
  - `onOrder(ids)`(T4 回调):`albums.reorderAlbumAssets(id, ids).catch(e => { console.error(...); toast(photosAlbumOrderFailed) })`(照 Vue2 `persistOrder:406-416` 的 catch + toast)。
  - `onLightboxDelete(assetId)`:`await timelineStore.deleteAssets([String(assetId)])` + toast `photosDeletedToast` + `void albums.fetchAlbumAssets(id)`(**从库里真删后相册内也要消失**;照 P3 收藏视图 T8 的同款处理)。
- **样式**:整屏 token 化;`.tile-drag-ghost` 见 T4 说明;`.tile-cover-btn` 的 Vue2 `rgba(0,0,0,.55)` 底 → `--overlay-bg`;`★ Cover` 徽章 Vue2 `rgba(110,91,255,.85)` → `color-mix(in srgb, var(--accent) 85%, transparent)`;`color="white"` → `--on-accent`;density `compact` 与 `comfortable` 的列宽照 `photos.scss` 相册段取值。

- [ ] **Step 1: 写失败测试**(挂 Pinia + i18n + router[带 `/photos/albums/:id`];mock 共享包 + `sortablejs`;预置 store 的 `albums` 与 `albumAssetsByID`):
  - 路由 `params.id='7'` 命中后端**数字 id `7`** 的相册(铁律回归测试),渲染标题/计数/日期区间。
  - 资产加载中且无数据 → 渲染骨架;非加载且空 → 渲染 `photosAlbumEmptyTitle`。
  - 瓦片渲染 `data-id` 属性、img src === `thumbnailUrl(id,'small')`;当前封面项标记为「当前封面」(用数字 cover id vs 字符串 photo id 交叉验证值比较)。
  - 非 edit 点瓦片 → `useLightbox().open===true` 且 `list` 为**当前排序后的**相册资产(切到 `taken` 后再点,断言 list 顺序变了)。
  - edit 态点瓦片 → 进 `selected`、不开灯箱;`photosAlbumRemoveFrom` 由 disabled 变可用;点它 → `removeAssetsFromAlbum(id, [选中 ids])` 被调 + toast + selected 清空。
  - `drag.isDragging()` 为 true 时点瓦片 → **既不开灯箱也不选中**(守卫回归;通过 mock `useAlbumDragSort` 或触发 mock sortable 的 onStart 实现)。
  - 点标题 → 出 input;改名回车 → `renameAlbum(id,'新名')` 被调 + toast;抛 409 → 显示重名文案且标题还原原名。
  - 点 ⋯ → 菜单出现;点删除 → 确认模态;确认 → `deleteAlbum` 被调 + `router.push('/photos/albums')`。
  - 点星标 → `setAlbumCover(id, p.id)` 被调 + toast。
  - 点「添加照片」→ `AlbumLibraryPicker` `open===true`;其 `@added` → `fetchAlbumAssets` 被再调。
  - 切 `sortBy` 与 `edit` → `drag.refresh()` 被调(spy);卸载 → `drag.destroy()` 被调。
  - `onOrder` 回调触发且 store 抛错 → toast `photosAlbumOrderFailed`。
- [ ] **Step 2: RED**;**Step 3: 实现**(逐段对照 Vue2 源);**Step 4: GREEN + 全量 + tsc + color-guard**。
- [ ] **Step 5: Commit** — `feat(photos): 相册详情视图(hero 改名/删除/封面 + edit 多选移除 + 添加照片 + 拖拽排序 + 灯箱)`

---

