## Task 12: 回收站分页 + 清空文案降级

**Files:**
- Modify: `src/photos/stores/trash.ts`
- Modify: `src/views/PhotosTrash.vue`
- Modify: `src/i18n/zh_cn.photos.ts` / `en_us.photos.ts`（两键）
- Test: `src/photos/stores/__tests__/trash.test.ts`、`src/views/__tests__/PhotosTrash.test.ts`

**Interfaces:**
- Produces（trash store）：`trashExhausted`、`loadingMore`、`loadMoreTrash()`、
  `TRASH_PAGE_SIZE = 500`；`fetchTrash()` 语义变为「取第一页并复位游标」

- [ ] **Step 1: 写失败测试**

store 侧照 T11 的七个形状各写一遍（`listTrash(500, 0)`、追加、拒绝越界、并发去重、
**交错**陈旧丢弃、失败不推进游标、`fetchTrash` 复位）。视图侧三例：

```ts
  it('uses the size-less empty copy while pages remain', async () => {
    // trashExhausted false -> confirm dialog body is photosTrashEmptyBodyPartial
  })
  it('uses the exact copy with the freed size once everything is loaded', async () => {
    // trashExhausted true -> photosTrashEmptyBody with {size}
  })
  it('shows the load-more button only while pages remain', async () => { /* … */ })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/photos/stores/__tests__/trash.test.ts src/views/__tests__/PhotosTrash.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现（store）**

与 T11 同构：`TRASH_PAGE_SIZE = 500`、`_offset`、`_generation`、`trashExhausted`、
`loadingMore`、`loadMoreTrash()`；`fetchTrash()` 改成 `service.photos.listTrash(500, 0)`
并复位游标；`restore/restoreAll/purge/empty/undoRestore` 结尾的 `await fetchTrash()`
保持不变（它现在就是「回到第一页」，语义正确）。

- [ ] **Step 4: 改视图**

`src/views/PhotosTrash.vue`：
- 「清空回收站」确认框：`trash.trashExhausted ? t('photosTrashEmptyBody', { size }) : t('photosTrashEmptyBodyPartial')`；
  成功 toast 同理在 `photosTrashEmptiedToast` / `photosTrashEmptiedToastPartial` 之间选
- **「恢复全部」那一路不改**（`photosTrashRestoreAllBody` / `photosTrashRestoredToast`
  本来就不带容量，见 Global Constraints 的键表）
- Hero 里那行 `<b>{{ totalSize }} MB</b>`：未取完时容量只是已加载部分 ⇒ 在它后面接
  `t('photosLoadedSubsetHint', { n: trash.items.length })`（复用 T11 的键，不新增）
- 网格下方「加载更多」按钮，同 T11 形态

- [ ] **Step 5: 加 i18n 两键**

```ts
  photosTrashEmptiedToastPartial: '最近删除已清空',
  photosTrashEmptyBodyPartial: '这将释放 NAS 上的空间，原始文件将无法恢复。',
```
```ts
  photosTrashEmptiedToastPartial: 'Trash emptied',
  photosTrashEmptyBodyPartial: "This frees up space on the NAS. Once gone, the originals can't be recovered.",
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm test src/photos/stores/__tests__/trash.test.ts src/views/__tests__/PhotosTrash.test.ts src/i18n && pnpm exec vue-tsc --noEmit`
Expected: 全绿。

- [ ] **Step 7: 提交**

```bash
git add src/photos/stores/trash.ts src/views/PhotosTrash.vue src/views/__tests__/PhotosTrash.test.ts src/photos/stores/__tests__/trash.test.ts src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts
git commit -m "fix(photos): page the trash list and stop promising a size it cannot know

Trash pages for the same reason favorites does: an absent limit now means 500.
The freed-space figure is computed from the loaded items, so while pages remain
the empty-trash confirmation drops the megabyte figure instead of quoting a
number that only covers part of the bin. Restore-all needs no such split — its
copy never quoted a size."
```

---

