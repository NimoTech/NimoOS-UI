### Task 8: `FavoritesView.vue` — 收藏视图

**Files:**
- Create: `src/views/PhotosFavorites.vue`
- Test: `src/views/__tests__/PhotosFavorites.test.ts`

**Interfaces:**
- Consumes:`AreaShell`(`src/components/shell/AreaShell.vue`,`<AreaShell :title>`)、`PhotosSidebar`、`PhotosToolbar`(P1,tab/count,`@update:tab`)、`PhotosGrid`(T5,`:months`/`:tab`/`:selected`/`@open`/`@toggle-select`)、`PhotoLightbox`(P2,`@delete`/`@toggle-fav`)、Task 1 `usePhotosFavorites`、`useLightbox`(P2)、`useToast`、`matchesTab`(`src/photos/util/tabFilter.ts`)、i18n(T7)。
- Produces:路由组件(T10 注册 `/photos/favorites`);结构照 `Photos.vue`(时间线视图)的壳:
  ```
  <AreaShell :title="t('photosFavTitle')">
    <div class="photos-layout"> <PhotosSidebar/>
      <main class="photos-main">
        <!-- 顶部:导出 zip 按钮(fav.favoritesList?.length 时启用)+ 计数 -->
        <!-- 空态:favoritesLoaded && (favoritesList?.length ?? 0)===0 → photosFavEmpty* -->
        <!-- 否则:PhotosToolbar(tab/count) + PhotosGrid(:months=fav.favoritesMonths :tab :selected @open) -->
      </main>
    </div>
  </AreaShell>
  <PhotoLightbox @delete="onLightboxDelete" @toggle-fav="() => {}" />
  ```
  - `onMounted`:`fav.reconcileFavIds()` + `fav.fetchFavorites()`(仅当 `!favoritesLoaded` 或强制;进视图刷新)。
  - tab 本地 `ref('all')`(收藏视图默认 all,与时间线默认 photo 不同);count = `fav.favoritesMonths.flatMap(m=>m.photos).filter(p=>matchesTab(p,tab)).length`。
  - `onOpenTile(photo,_list,startMs)`:翻页集 = `fav.favoritesMonths.flatMap(m=>m.photos).filter(p=>matchesTab(p,tab))`(tab 过滤后收藏集,与所见一致)→ `lb.openAt(photo, filtered, startMs)`。
  - `onExport()`:`fav.exportZip()` + `toast.show(t('photosFavExporting'), 4000)`。
  - `onLightboxDelete(id)`:`await store.deleteAssets([String(id)])`(时间线 store,删除是全局)+ `toast` + `fav.fetchFavorites()`(刷新收藏列表);灯箱已自 close。
  - per-tile 星标由 PhotosGrid 内部提供(T5),此处不接;`@toggle-fav` 空接(store 同源自动更新)。
- **样式**:`.photos-layout`/`.photos-main` 照 `Photos.vue:176-180` 复制(或抽到共享 css,择一);导出按钮 token 化。

- [ ] **Step 1: 写失败测试**（挂 Pinia + i18n + router stub;mock 共享包收藏方法）
  - `favoritesLoaded` 且列表空 → 渲染 `photosFavEmptyTitle`,不渲染 PhotosGrid。
  - 列表非空 → 渲染 PhotosGrid(stub),`:months` = favoritesMonths;导出按钮启用。
  - 点导出按钮 → `fav.exportZip` 被调(spy)+ toast。
  - PhotosGrid emit `open` → `useLightbox().open.value===true`,翻页集为 tab 过滤后收藏集。
  - PhotoLightbox emit `delete(id)` → `store.deleteAssets([String(id)])`(spy)+ `fav.fetchFavorites` 被调。
- [ ] **Step 2: RED**;**Step 3: 实现**;**Step 4: GREEN + 全量 + tsc + color-guard**。
- [ ] **Step 5: Commit** — `feat(photos): 收藏视图(PhotosGrid 基座 + 导出 zip + 空态 + 灯箱接线)`

---

