### Task 10: 路由注册 + Photos.vue 收尾 + 集成验收

**Files:**
- Modify: `src/router/index.ts`（加两路由 + import）
- Modify: `src/views/Photos.vue`（`@toggle-fav` 空接注释更新;确认时间线 per-tile 星标随 T5 自动生效——无需改）
- Test: `src/router/__tests__/routes.test.ts`（若无则轻量断言路由存在;或并入现有路由测试)

**Interfaces:**
- `router/index.ts`:`import PhotosFavorites from '../views/PhotosFavorites.vue'`、`import PhotosTrash from '../views/PhotosTrash.vue'`;在 `:32` `/photos` 行**之后**加:
  ```ts
  { path: '/photos/favorites', name: 'photos-favorites', component: PhotosFavorites },
  { path: '/photos/trash', name: 'photos-trash', component: PhotosTrash },
  ```
  (放在 `/photos` 之后即可;hash 路由精确匹配,无顺序陷阱。)
- `Photos.vue`:时间线视图现挂 PhotosGrid(T5 已让其显示星标)——**无需改逻辑**;仅把 `:172` `@toggle-fav="() => {}"` 的注释更新为「收藏态由 photosFavorites store 同源,空接即可」。确认时间线 store 与 favorites store 各自独立、per-tile 星标在时间线也生效(fav store 首次 `reconcileFavIds` 由灯箱 openAt 或首个收藏视图触发;**时间线首屏星标态**:在 Photos.vue `onMounted` 加一行 `usePhotosFavorites().reconcileFavIds()` 使时间线一进来星标即准——否则未开过灯箱/收藏视图时全为描边)。

- [ ] **Step 1: 写失败测试**（路由:import router,断言 `router.resolve('/photos/favorites').name==='photos-favorites'`、`/photos/trash` 同理;Photos.vue:断言 `onMounted` 调 `usePhotosFavorites().reconcileFavIds`)。
- [ ] **Step 2: RED**;**Step 3: 实现**(加路由 + Photos.vue onMounted 一行 reconcile);**Step 4: GREEN + 全量(1437+新增)+ tsc + color-guard**。
- [ ] **Step 5: Commit** — `feat(photos): 注册收藏/回收站路由 + 时间线首屏收藏态,P3 收官`
- [ ] **Step 6: 验收说明写进报告**（控制器转述用户):`cd /home/nimo/NimoTech/.sp7/NimoOS-New-UI && pnpm dev --host --port 5277`,浏览器 `http://192.168.1.143:5277/`(先登录)→ `/app/#/photos/favorites`、`/app/#/photos/trash`。看点见文末验收清单。

---

## Self-Review 记录

- **Spec 覆盖**(§7 P3 行「收藏:全局 favIds + per-tile 星标 + 浏览节流 + 导出 zip;回收站:恢复/清空/保留天数」):
  - 全局 favIds = T1 store;per-tile 星标 = T5(grid)+ T4(灯箱委托)+ T1(store);浏览节流 = T1 recordView 60s;导出 zip = T1 exportZip + T8 按钮;收藏视图完整 = T8。
  - 回收站恢复(选中/全部)= T3 restore/restoreAll + T9;清空(选中 purge/全部 empty)= T3 + T9;保留天数(只读显示 + setRetention action)= T3 + T9;回收站视图完整 = T9。
  - 侧栏两条目 + isActive 修复 = T6;i18n = T7;路由 + 收官 = T10。全覆盖。
- **范围收口**逐项记台账(见「P3 范围收口」节):收藏 hero stats/pinned/save-album/slideshow/place-filter 推迟、收藏取消不即时移除、favBatch 不做、retention 编辑归 P8、回收站不接灯箱。
- **类型一致性**:`Photo`/`Month` 全程引 `assetToPhoto.ts`;`TrashPhoto` T2 定义、T3/T9 消费同名;`usePhotosFavorites`(isFav/toggle/recordView/reconcileFavIds/fetchFavorites/favoritesMonths/exportZip)T1 定义,T4/T5/T8 消费同名;`usePhotosTrash`(fetchTrash/restore/restoreAll/purge/empty/undoRestore/fetchRetention/setRetention)T3 定义、T9 消费;`activeNavId` T6 定义、PhotosSidebar 消费;`groupPhotosByMonth` T1 定义、favoritesMonths 消费。
- **P1/P2 铁律落实**:收藏态一律 `favIds.has(String(id))`(值比较);星标判定 `fav.isFav(p.id)`;回收站选择/undo 用 id;无对象引用 `===`。
- **无占位**:纯函数(groupPhotosByMonth/trashAssetToPhoto/activeNavId)与 store(favorites/trash)给全码;大 .vue(T8/T9)按 P2 established「照抄 Vue2 源 file:line + 结构清单 + 接口签名 + 测试行为清单」模式,实现者可直读 Vue2 `PhotosFavoritesView.vue`/`PhotosTrashView.vue` 与 New-UI `Photos.vue` 壳。
- **Service 零改动假设**已在 Global Constraints 声明(收藏/回收站/retention 方法 P0 全在);若破按 P0 约定补并记账。
- **color-guard 重点**:T9 回收站 Vue2 满屏硬编码色,实现者必须全部 token 化(Global Constraints 已列清单)。

## 文末:真机验收清单(:5277)

**收藏 `/app/#/photos/favorites`**:①时间线里给几张照片点星标 → 星标实心、再点变空(乐观即时);②进收藏视图 → 只见已收藏项,按月分组;③收藏视图点星标取消 → 星标变空但项仍在(下次进才消失,已知/记账);④点「下载 ZIP」→ 浏览器触发下载(favorites/export JWT 豁免,裸下载可用);⑤点开某张 → 灯箱翻页集只在收藏集内;⑥空收藏时显空态文案;⑦tab 过滤 all/photo/video。
**回收站 `/app/#/photos/trash`**:①删几张照片后进回收站 → 见分桶(按剩余天数)+ 倒计时角标 + 缩略图;②多选 → bulk bar 出现;③恢复选中 → toast 带「撤销」,点撤销 → 项回到回收站;④恢复全部 → 二次确认 → 确认后清空视图、时间线恢复;⑤永久删除选中 / 清空回收站 → 二次确认(danger 样式);⑥空回收站显空态 + 保留天数文案;⑦深浅色主题切换下颜色正常(color-guard 已挡硬编码,真机复核倒计时三档色对比度)。
**侧栏**:三条目(收藏库/收藏/回收站),切到 favorites/trash 时**只该条高亮**(library 不再双高亮)。
