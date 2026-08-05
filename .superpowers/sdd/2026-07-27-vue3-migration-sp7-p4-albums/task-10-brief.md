### Task 10: 收藏视图「存为相册」(Save as Album)

**Files:**
- Modify: `src/views/PhotosFavorites.vue`
- Test: `src/views/__tests__/PhotosFavorites.test.ts`(补用例)

**Interfaces:**
- Consumes:T2 `usePhotosAlbums.saveAsAlbum`、`usePhotosFavorites`(`favoritesList`)、`useToast`、i18n(T3)。
- 结构(照 Vue2 `PhotosFavoritesView.vue:21-23` 入口 + `:260-287` 模态):
  - 在收藏视图顶部操作区(现有「下载 ZIP」按钮**旁边**)加 `photosFavSaveAlbum` 按钮;收藏为空时 disabled(与导出按钮同门控)。
  - 点击 → 命名模态:标题 `photosFavSaveAlbumTitle`;input 预填 `t('photosFavSaveAlbumDefault', { year: new Date().getFullYear() })`(照 Vue2 `openSaveAlbum:455-459`);`photosCancel` + 主按钮 `photosAlbumCreate`;名称 trim 为空时禁用。
- 行为 `confirmSaveAlbum()`(照 Vue2 `:461-478`):
  - `await albums.saveAsAlbum(name, fav.favoritesList?.map(p => p.id) ?? [])`
  - 成功 → 关模态 + toast `photosFavSavedToast {name, count}`
  - catch → 409 → toast `photosAlbumNameExists`;否则 toast `photosFavSaveFailed`;**模态不关**(Vue2 同样只在成功分支关)。

- [ ] **Step 1: 写失败测试**:
  - 收藏为空 → 按钮 disabled;非空 → 可用。
  - 点击 → 模态出现,input 预填含当前年份。
  - 提交 → `saveAsAlbum(name, [收藏 ids])` 被调 + 成功 toast + 模态关闭。
  - 抛 409 → 重名 toast,**模态仍在**;抛其它 → 通用失败 toast,模态仍在。
- [ ] **Step 2: RED**;**Step 3: 实现**;**Step 4: GREEN + 全量 + tsc + color-guard**。
- [ ] **Step 5: Commit** — `feat(photos): 收藏视图「存为相册」(P3 推迟项收口)`

---

