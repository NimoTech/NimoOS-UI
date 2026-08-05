### Task 7: i18n — 收藏 + 回收站 P3 键(zh_cn + en_us,过 parity)

**Files:**
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`

**Interfaces:**
- Produces(T5/T6/T8/T9 模板用,key 名固定;中文值参照 Vue2 `zh_CN.json` 对应段;`{…}` 插值双语一致):
  - 侧栏/通用:`photosFavorites` 收藏/Favorites、`photosTrash` 回收站/Recently Deleted、`photosFavorite` 收藏/Favorite、`photosUnfavorite` 取消收藏/Unfavorite。
  - 收藏视图:`photosFavTitle` 收藏/Favorites、`photosFavEmptyTitle` 暂无收藏/No favorites yet、`photosFavEmptyHint` 在任意照片上点 ★ 即可收藏，收藏会永久保留。/Tap ★ on any photo to keep it here. Favorites are pinned forever.、`photosFavExport` 下载为 ZIP/Download as ZIP、`photosFavExporting` 开始打包下载…/Preparing download…、`photosFavCount` {count} 张收藏/{count} favorites。
  - 回收站视图:`photosTrashTitle` 最近删除/Recently Deleted、`photosTrashEmptyTitle` 回收站是空的/Trash is empty、`photosTrashEmptyHint` 已删除的照片和视频会在这里保留 {days} 天，之后从 NAS 永久移除。/Deleted items stay here for {days} days before being permanently removed.、`photosTrashRestore` 恢复/Restore、`photosTrashRestoreAll` 恢复全部/Restore all、`photosTrashEmpty` 清空回收站/Empty trash、`photosTrashDeleteForever` 永久删除/Delete forever、`photosTrashDaysLeft` 剩 {days} 天/{days}d left、`photosTrashFrom` 来自 {source}/From {source}、`photosTrashCanFree` 可释放/can be freed、`photosTrashItems` 项/items、`photosTrashSelectedCount` 已选择 {count} 项/{count} selected、`photosTrashSortDaysLeft` 剩余天数/Days left、`photosTrashSortRecent` 最近删除/Recently deleted、`photosTrashUndo` 撤销/Undo。
  - 分桶标题:`photosTrashBucketUrgent` 1–7 天内删除/Deleting in 1–7 days、`photosTrashBucketSoon` 8–14 天内删除/Deleting in 8–14 days、`photosTrashBucketLater` 15–21 天内删除/Deleting in 15–21 days、`photosTrashBucketFresh` 最近删除/Deleted recently（对应描述键 `photosTrashBucketUrgentDesc`/`...SoonDesc`/`...LaterDesc`/`...FreshDesc`,中文参 Vue2 `BUCKETS` desc,英文取原文)。
  - 确认弹窗:`photosTrashRestoreAllTitle` 恢复全部 {count} 项？/Restore all {count} item(s)?、`photosTrashRestoreAllBody` 它们会回到原来的位置，重新出现在资料库、相册和时间线中。/They'll go back to where they came from and resume appearing in your library, albums and timelines.、`photosTrashDeleteSelTitle` 永久删除 {count} 项？/Permanently delete {count} item(s)?、`photosTrashDeleteSelBody` 这将立即从 NAS 中清除,此操作无法撤销。/This will be wiped from the NAS immediately. This cannot be undone.、`photosTrashEmptyTitle2` 永久删除全部 {count} 项？/Permanently delete all {count} item(s)?、`photosTrashEmptyBody` 这将在 NAS 上释放 {size} MB,原始文件将无法恢复。/This frees {size} MB on the NAS. Once gone, the originals can't be recovered.
  - Toast:`photosTrashRestoredToast` {count} 项已恢复到资料库/{count} item(s) restored to Library、`photosTrashPurgedToast` {count} 项已永久删除 · 释放 {size} MB/{count} item(s) permanently deleted · {size} MB freed、`photosTrashEmptiedToast` 回收站已清空 · 释放 {size} MB/Trash emptied · {size} MB freed、`photosTrashRestoreFailed` 恢复失败/Restore failed、`photosTrashDeleteFailed` 删除失败/Delete failed、`photosTrashEmptyFailed` 清空失败/Empty failed、`photosFavExportFailed` 导出失败/Export failed。
  - filter chips 复用 P1 已有(`all`/`photo`/`video` 若已建则复用,否则用 P1 的 tab 键)。
- **不新增** `photosCancel`/`photosDelete`/`photosDeletedToast`(P1/P2 已有,复用)。

- [ ] **Step 1: 双文件加 key**(parity 测试即门槛,无需临时断言;确认命名与 T5/T6/T8/T9 引用一致)。
- [ ] **Step 2: GREEN** — `pnpm vitest run src/i18n` 全绿(parity + 非空);全量 + tsc。
- [ ] **Step 3: Commit** — `feat(photos): P3 收藏/回收站 i18n 键(zh_cn/en_us)`

---

