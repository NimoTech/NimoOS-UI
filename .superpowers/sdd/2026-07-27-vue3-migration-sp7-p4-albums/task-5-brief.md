### Task 5: `AlbumPickerDialog.vue` — 「加入相册」选择器

**Files:**
- Create: `src/photos/components/AlbumPickerDialog.vue`
- Test: `src/photos/components/__tests__/AlbumPickerDialog.test.ts`

**Interfaces:**
- Consumes:T2 `usePhotosAlbums`、T1 `albumToView`、`useToast`(`src/stores/toast.ts`,`show(text, duration=1500, action?)`)、`service.photos.thumbnailUrl`、i18n(T3)。
- Produces(T9 三处宿主消费):
  ```ts
  props:  { open: boolean; assetIds: Array<string | number> }
  emits:  { 'update:open': [boolean]; added: [albumId: string | number, count: number] }
  ```
- 结构照 Vue2 `PhotosTimeline.vue:1040-1065` 的相册选择覆盖层:
  - 遮罩(`@click.self` 关闭)+ 面板;标题 `photosAddToAlbumTitle`;列表逐项 = 封面小图(`thumbnailUrl(view.cover,'small')`,无封面用渐变占位)+ 标题 + `photosItemsCount`;点击项 → `pick(albumId)`。
  - 列表末尾一项 `photosAddToAlbumNew`(`+ 新建相册`);点击后**在原位展开内联输入行**(`v-model` + 回车提交 + Esc 收起,自动 focus)——见范围收口的形态偏离登记(Vue2 用 `window.prompt`)。
  - 相册为空时显示 `photosAddToAlbumEmpty` + 保留「新建」行。
  - Esc 关闭整个面板(与内联输入的 Esc 分层:输入展开时 Esc 先收起输入,再按才关面板)。
- 行为:
  - `watch(() => props.open)`,变 true 时 `void albums.fetchAlbums()`(照 Vue2 `onBatchAlbum:584` 打开前刷新;Vue2 未 await,这里同样不阻塞渲染)。
  - `pick(albumId)`:`await albums.addAssetsToAlbum(albumId, props.assetIds)` → 成功 `emit('added', albumId, props.assetIds.length)` + toast `photosAlbumAddedToast {count, name}` + 关闭;**catch → toast `photosAlbumAddFailed`,面板不关**(store 会抛)。
  - `createAndPick(name)`:`const created = await albums.createAlbum(name)` → 再走 `pick(created.id)`;catch → 409 判定(`e?.response?.status === 409` 或 message 含 409)显示 `photosAlbumNameExists`,否则 `photosAlbumCreateFailed`;**面板不关,输入行保留内容**。
  - **`props.assetIds` 为空数组时**「加入」不可用(按钮/项 disabled),避免空提交。
- 样式:遮罩用 `--overlay-bg`,面板用 `--popup-bg`(**P2 血泪:`--card-bg` 在深色主题近透明,叠在暗底上会看穿**),边框 `--card-border`,悬停 `--chip-bg-hi`;全 token。

- [ ] **Step 1: 写失败测试**(挂 Pinia + i18n;mock 共享包):
  - `open` 由 false→true → `listAlbums` 被调;渲染出相册项(标题 + 计数)与「+ 新建相册」行。
  - 点某相册项 → `addAssetsToAlbum(该 id, assetIds)` 被调 → emit `added` + `update:open(false)` + toast。
  - store 抛错 → 面板**仍 open**,toast 文案为失败键。
  - 点「+ 新建相册」→ 出现输入框;输入名 + 回车 → `createAlbum(name)` 然后 `addAssetsToAlbum(新id, ids)` 依次被调。
  - `createAlbum` 抛 409 → 显示重名提示,`addAssetsToAlbum` **未**被调,输入内容仍在。
  - 相册列表为空 → 渲染 `photosAddToAlbumEmpty`,「新建」行仍在。
  - `assetIds` 为空 → 相册项 disabled(点击不触发 store)。
- [ ] **Step 2: RED**;**Step 3: 实现**;**Step 4: GREEN + 全量 + tsc + color-guard**。
- [ ] **Step 5: Commit** — `feat(photos): 加入相册选择器(列表 + 内联新建 + 失败不关闭)`

---

