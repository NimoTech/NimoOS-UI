### Task 3: i18n — 相册 P4 键(zh_cn + en_us,过 parity)

**Files:**
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`

**Interfaces:**
- **开工先 `grep -o "photos[A-Za-z0-9]*:" src/i18n/zh_cn.ts | sort` 去重**(基线 105 键)。**明确复用、不重加**:`photosCancel`、`photosDelete`、`photosClose`、`photosConfirmDelete`、`photosItemsCount`(`{count} 项` / `{count} items`)、`photosSelectedCount`、`photosDensityComfortable`、`photosDensityCompact`。
- 新增键(zh_cn / en_us,`{…}` 插值双语一致;英文值取 Vue2 原文,中文参 Vue2 `src/assets/lang/zh_CN.json` 同条目,查不到时按下表给):

  **侧栏 / 列表页**
  - `photosAlbums` 相册 / Albums(侧栏条目,T11 用)
  - `photosAlbumsTitle` 相册 / Albums
  - `photosAlbumsCount` {count} 个相册 / {count} albums
  - `photosAlbumsMine` 我的相册 / My Albums
  - `photosAlbumsMineHint` 你创建的相册 / Albums you created
  - `photosAlbumNew` 新建相册 / New album
  - `photosAlbumNewHint` 点击创建 / Click to create
  - `photosAlbumUntitled` 未命名 / Untitled
  - `photosAlbumsEmptyTitle` 还没有相册 / No albums yet
  - `photosAlbumsEmptyHint` 新建一个相册,把照片归到一起。 / Create an album to group photos together.
  - `photosAlbumSort` 排序: / Sort:
  - `photosAlbumSortUpdated` 最近更新 / Last updated
  - `photosAlbumSortUpdatedHint` 保持服务端顺序 / Server order
  - `photosAlbumSortCreated` 最近添加 / Recently added
  - `photosAlbumSortCreatedHint` 最新的相册在前 / Newest album first
  - `photosAlbumSortName` 名称(A–Z) / Name (A–Z)
  - `photosAlbumSortNameHint` 按字母序 / Alphabetical
  - `photosAlbumSortNameR` 名称(Z–A) / Name (Z–A)
  - `photosAlbumSortNameRHint` 反字母序 / Reverse alphabetical
  - `photosAlbumSortCount` 照片数量 / Photo count
  - `photosAlbumSortCountHint` 最多的在前 / Largest first
  - `photosAlbumSortDate` 拍摄日期 / Date taken
  - `photosAlbumSortDateHint` 最新的瞬间在前 / Newest moments first

  **新建相册模态**
  - `photosAlbumCreateTitle` 新建相册 / New album
  - `photosAlbumCreateSub` 起个名字,再决定怎么填充 / Give it a name, then decide how to fill it
  - `photosAlbumNameLabel` 相册名称 / Album name
  - `photosAlbumNamePlaceholder` 例如 东京 · 春天 / e.g. Tokyo · Spring
  - `photosAlbumFillLabel` 如何填充 / How to fill it
  - `photosAlbumFillEmpty` 空相册 / Empty album
  - `photosAlbumFillEmptyHint` 之后再添加照片 / Add photos later
  - `photosAlbumFillRecent` 最近 30 天的照片 / Photos from the last 30 days
  - `photosAlbumFillRecentHint` 自动填入所有近期照片 / Automatically fill with everything recent
  - `photosAlbumFillSelect` 手动挑选照片… / Choose photos…
  - `photosAlbumFillSelectHint` 打开图库逐张挑选 / Open Library and pick one by one
  - `photosAlbumCreating` 创建中… / Creating…
  - `photosAlbumCreate` 创建相册 / Create album
  - `photosAlbumCreatedToast` 相册已创建:{name} / Album created: {name}
  - `photosAlbumCreateFailed` 创建失败 / Create failed
  - `photosAlbumNameExists` 已存在同名相册 / An album with this name already exists

  **详情页**
  - `photosAlbumBack` 相册 / Albums(返回)
  - `photosAlbumLabel` 相册 / Album
  - `photosAlbumClickToRename` 点击重命名 / Click to rename
  - `photosAlbumEdit` 编辑 / Edit
  - `photosAlbumDone` 完成 / Done
  - `photosAlbumRename` 重命名相册 / Rename album
  - `photosAlbumDelete` 删除相册 / Delete album
  - `photosAlbumDeleteHint` 照片会保留在图库中 / Photos stay in your library
  - `photosAlbumDeleteTitle` 删除「{name}」? / Delete "{name}"?
  - `photosAlbumDeleteBody` 只删除相册本身,其中 {count} 张照片仍保留在图库中。 / The album wrapper is removed but the {count} items stay in your library.
  - `photosAlbumItemsShown` 显示 {count} 项 / {count} items shown
  - `photosAlbumHintSelectDragCover` 点击选择 · 拖拽排序 · ★ 设为封面 / Click to select · Drag to reorder · ★ to set cover
  - `photosAlbumHintSelectCover` 点击选择 · ★ 设为封面 / Click to select · ★ to set cover
  - `photosAlbumRemoveFrom` 从相册移除 / Remove from album
  - `photosAlbumAddPhotos` 添加照片 / Add photos
  - `photosAlbumSortManual` 手动排序 / Manual order
  - `photosAlbumSortTaken` 拍摄日期 / Date taken
  - `photosAlbumSortAdded` 添加日期 / Date added
  - `photosAlbumCurrentCover` 当前封面 / Current cover
  - `photosAlbumSetCover` 设为相册封面 / Set as album cover
  - `photosAlbumEmptyTitle` 相册是空的 / This album is empty
  - `photosAlbumEmptyHint` 点「添加照片」从图库中挑选。 / Use "Add photos" to pick from your library.
  - `photosAlbumRenamedToast` 相册已重命名 / Album renamed
  - `photosAlbumRenameFailed` 重命名失败 / Rename failed
  - `photosAlbumDeletedToast` 相册已删除:{name} / Album deleted: {name}
  - `photosAlbumDeleteFailed` 删除失败 / Delete failed
  - `photosAlbumCoverUpdatedToast` 封面已更新 / Cover updated
  - `photosAlbumCoverFailed` 封面更新失败 / Failed to update cover
  - `photosAlbumOrderFailed` 排序保存失败 / Failed to save order
  - `photosAlbumRemovedToast` 已从相册移除 {count} 项 / Removed {count} from album
  - `photosAlbumRemoveFailed` 移除失败 / Remove failed

  **库选择器(添加照片)**
  - `photosAlbumPickerTitle` 添加照片到「{name}」 / Add photos to {name}
  - `photosAlbumPickerEmpty` 没有可添加的照片。 / No photos available to add.
  - `photosAlbumPickerAlready` 已在相册中 / Already in album
  - `photosAlbumPickerAdding` 添加中… / Adding…
  - `photosAlbumPickerAdd` 添加({count}) / Add ({count})
  - `photosAlbumPickerDiscard` 还有未保存的选择,确定关闭吗? / You have unsaved selections. Close anyway?
  - `photosAlbumAddedToast` 已添加 {count} 项到「{name}」 / Added {count} to {name}
  - `photosAlbumAddFailed` 添加失败 / Add failed

  **相册选择器(加入相册)**
  - `photosAddToAlbum` 加入相册 / Add to album
  - `photosAddToAlbumTitle` 加入相册 / Add to album
  - `photosAddToAlbumEmpty` 还没有相册,先新建一个。 / No albums yet — create one first.
  - `photosAddToAlbumNew` + 新建相册 / + New album

  **收藏视图 Save as Album**
  - `photosFavSaveAlbum` 存为相册 / Save as album
  - `photosFavSaveAlbumTitle` 把收藏存为相册 / Save favorites as album
  - `photosFavSaveAlbumDefault` 收藏 · {year} / Favorites · {year}
  - `photosFavSavedToast` 「{name}」已保存 · {count} 张照片 / "{name}" saved · {count} photos
  - `photosFavSaveFailed` 保存失败 / Save failed

- [ ] **Step 1: 双文件加 key**(parity 测试即门槛)。**确认命名与 T5-T10 模板引用逐字一致**;确认无重复属性名(`grep -o "photos[A-Za-z0-9]*:" src/i18n/zh_cn.ts | sort | uniq -d` 须为空 —— P3 T6/T7 曾差点撞名)。
- [ ] **Step 2: GREEN** — `pnpm vitest run src/i18n` 全绿(parity + 非空);全量 + tsc。
- [ ] **Step 3: Commit** — `feat(photos): P4 相册 i18n 键(zh_cn/en_us)`

---

