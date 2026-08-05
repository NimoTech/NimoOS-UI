### Task 6: `AlbumLibraryPicker.vue` — 从图库挑照片加入本相册

**Files:**
- Create: `src/photos/components/AlbumLibraryPicker.vue`
- Test: `src/photos/components/__tests__/AlbumLibraryPicker.test.ts`

**Interfaces:**
- Consumes:`useTimelineStore`(`src/photos/stores/timeline.ts`,取 `months`)、T2 `usePhotosAlbums`、`service.photos.thumbnailUrl`、`useToast`、i18n(T3)。
- Produces(T7 的「手动挑选」填充方式 + T8 的「添加照片」按钮消费):
  ```ts
  props:  { open: boolean; albumId: string | number; albumName: string }
  emits:  { 'update:open': [boolean]; added: [count: number] }
  ```
- 结构照 Vue2 `PhotosAlbumLibraryPicker.vue`(142 行):
  - 标题 `photosAlbumPickerTitle {name}` + 已选计数 `photosSelectedCount`。
  - **照片来源**:`timeline.months` 展平后按 `takenAt` **降序**(照 Vue2 `flat` computed `:73-85`);扁平网格,瓦片 = `thumbnailUrl(id,'small')`。
  - **已在相册中的项**:`existingIds` = `albums.assetsOf(albumId).map(p => String(p.id))` 的 Set(**照 Vue2 `:86-89` 的语义,但用 String 归一的 Set 做值比较** —— 铁律),这些瓦片显示 `photosAlbumPickerAlready` 覆盖标记且**不可选**。
  - 底部:`photosCancel` + 主按钮 `photosAlbumPickerAdd {count}`(提交中显示 `photosAlbumPickerAdding`,禁用)。
  - 空(展平后无可添加照片)→ `photosAlbumPickerEmpty`。
  - 关闭时若有未保存选择 → `photosAlbumPickerDiscard` 二次确认(照 Vue2 `:112`;Vue2 用 `window.confirm`,这里改用面板内确认条,与本仓惯例一致 —— 记账,同 T5 的 prompt 偏离理由)。
- 行为 `confirm()`(照 Vue2 `:116-139`):`await albums.addAssetsToAlbum(albumId, [...selected])` → toast `photosAlbumAddedToast {count, name}` + `emit('added', count)` + 关闭;catch → toast `photosAlbumAddFailed`,**不关闭**,`adding` 复位。
- `open` 变 true 时:清空本地 `selected`;`timeline.months` 若为空则 `void timeline.fetchTimeline()`(避免从详情页直接进来时图库未加载)。
- 样式全 token(遮罩 `--overlay-bg`、面板 `--popup-bg`);Vue2 的 `color="white"` 勾选图标改 `--on-accent`。

- [ ] **Step 1: 写失败测试**(挂 Pinia + i18n;mock 共享包 + 预置 timeline months):
  - 渲染展平后的瓦片,且按 `takenAt` 降序(断言首个 id)。
  - 已在相册中的项渲染 `photosAlbumPickerAlready` 且点击不进 `selected`;**用数字 id 的相册资产 + 字符串 id 的时间线照片交叉验证 String 归一命中**。
  - 选中两张 → 主按钮文案含 2;点击 → `addAssetsToAlbum(albumId, [id1,id2])` 被调 → emit `added(2)` + `update:open(false)` + toast。
  - store 抛错 → 面板仍 open,失败 toast,按钮恢复可用。
  - 有选择时点取消 → 出确认条;再确认才关闭;无选择时点取消直接关闭。
  - 无可添加照片 → 渲染 `photosAlbumPickerEmpty`。
- [ ] **Step 2: RED**;**Step 3: 实现**;**Step 4: GREEN + 全量 + tsc + color-guard**。
- [ ] **Step 5: Commit** — `feat(photos): 图库选择器(挑照片加入相册,已在相册项禁选)`

---

