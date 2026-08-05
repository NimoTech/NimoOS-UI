### Task 6: `PhotoLightbox.vue` 壳 — 遮罩/工具栏/舞台分发/翻页/键盘/自隐/删除确认/视频/实况

**Files:**
- Create: `src/photos/lightbox/PhotoLightbox.vue`
- Test: `src/photos/lightbox/__tests__/PhotoLightbox.test.ts`

**Interfaces:**
- Consumes:`useLightbox()`(T2/T3 全量:open/current/detail/index/list/isFav/hasPrev/hasNext/prev/next/close/toggleFav/searchQuery)、`PhotoImageViewer`(T5,image 模式)、`service.photos.originalUrl/thumbnailUrl/liveUrl/previewUrl`、i18n(T4)。删除向上 emit,由 T9 接 store。
- Produces:
  - props **无**(全读单例);emits `delete(id)`(父在 T9 接 `store.deleteAssets([id])` + toast + `close`)、`toggle-fav(id, fav)`(P3 用;P2 已在 useLightbox 落库,这里仅广播)。
  - `v-if="lb.open.value"` 全屏遮罩层(`.lightbox`,`position:fixed; inset:0; z-index:200`,背景 `var(--app-bg)` + 可选暗化;chrome 色 token 化,固定播放器色用 theme-exception)。
  - **顶部工具栏**(照 Vue2 `PhotosLightbox.vue:3-22`,删「加入相册」`:13-15` 与「交给 Nimo」`:84-87`):左 关闭 `✕`(`lb.close`);中 标题 = `detail.title` + 计数 `photosLightboxCounter({idx:index+1,total:list.length})` + `detail.date · detail.time`;右 收藏(`lb.toggleFav`,`isFav` 决定实心/描边星、`photosFavorite`/`photosUnfavorite`)、下载(`<a :href="originalUrl(id)" :download>`)、详情开关(`photosInfoToggle`,toggle `showInfo` 传给 T7)、删除(开 `confirmDelete` 模态)。
  - **舞台分发**(按 `current`):
    - `current.isVideo` → 原生 `<video :src="originalUrl(id)" :poster="thumbnailUrl(id,'large')" controls preload=metadata playsinline @loadedmetadata=applyStartTime>`(照 Vue2 `:27-37`+`applyStartTime` `:335-344`:仅首个匹配 `lb.startMs` 的视频 seek 一次)。
    - `current.isLivePhoto`(且非视频)→ 静图(PhotoImageViewer)+ 右下 `photosLivePhoto` 徽标 + **按住播放**:pointerdown 徽标/图上覆盖 `<video :src="liveUrl(id)" muted playsinline>` 播放,pointerup/leave 停并隐藏(**net-new:Vue2 灯箱未实现,无照抄源;逻辑自拟、行为最小可用**)。
    - 否则 → `<PhotoImageViewer :asset-id=current.id :mime-type=current.mimeType :ocr-lines=lb.ocrLines.value>`(引用 T5 的 `defineExpose` 缩放钮接到工具栏,或工具栏缩放钮改由 PhotoImageViewer 内自带——见 delta)。
  - **翻页箭头** `.lb-nav`(照 Vue2 `:56-71`):左右浮动箭头,`:disabled="!hasPrev"`/`!hasNext"`,点击 `lb.prev/next`。
  - **键盘**(照 Vue2 `:360-370`,window `keydown`):`ArrowLeft→prev`、`ArrowRight→next`、`Escape→close`(confirmDelete 开时 Escape 只关模态)、`f/F→toggleFav`、`Delete/Backspace→开 confirmDelete`。挂载加、卸载移。
  - **chrome 自隐**:复用 T5 同款 `isMoving` + 5s 计时(鼠标不动 5s 隐藏工具栏/箭头);`v-if="isMoving"`。
  - **删除确认模态**(照 Vue2 `:151-165`):`photosDeleteConfirmTitle`/`Body` + 确认(`photosConfirmDelete`)→ `emit('delete', current.id)` 然后 `lb.close()`;取消(`photosCancel`)关模态。
- **移植 delta(报告逐条确认)**:
  1. 删「加入相册」「交给 Nimo」两钮及其 emit(P4 / SP8)。
  2. 详情栏改为可 toggle(Vue2 恒显);窄屏 T7 走抽屉。
  3. 舞台缩放钮:工具栏放 放大/缩小/旋转/复位,点击调 `PhotoImageViewer` `defineExpose` 方法(通过 `ref`);或(更简)缩放钮不进顶栏、由 PhotoImageViewer 保留自己的底部工具栏。**二选一,实现者择一并在报告注明**(推荐后者:PhotoImageViewer 自带底部缩放条,顶栏只放 关闭/收藏/下载/详情/删除,减少跨组件 ref)。若选后者,T5 需保留底部工具栏渲染(delta-4 相应调整)。
  4. 引用比较全按 id(current 变化驱动)。

- [ ] **Step 1: 写失败测试**(用 `useLightbox().openAt(...)` 造开态;i18n plugin 挂载;service mock)
  - open=false 不渲染;openAt 后渲染遮罩 + 标题 + 计数 `1 / N`。
  - `current.isVideo` 渲染 `<video>` 且 src=originalUrl;非视频渲染 `PhotoImageViewer`(stub)。
  - 点关闭调 `lb.close`(spy);ESC 键关闭;confirmDelete 开时 ESC 只关模态不关灯箱。
  - 翻页箭头:头部 prev 禁用、点 next 调 `lb.next`;ArrowRight 调 next。
  - 收藏钮点 → `lb.toggleFav`(spy);`isFav` 真时星为实心(class 断言)。
  - 删除:点垃圾桶开模态、确认 emit `delete` 携 current.id 并调 close。
  - 自隐:`vi.useFakeTimers()`,mousemove 后 5s → 工具栏 v-if 收起。
  - live photo:`isLivePhoto` 项渲染 `photosLivePhoto` 徽标;pointerdown 出现 `<video src=liveUrl>`(jsdom `video.play` mock)。
- [ ] **Step 2: RED**;**Step 3: 实现**;**Step 4: GREEN + 全量 + tsc**。
- [ ] **Step 5: Commit** — `feat(photos): 灯箱壳(工具栏/舞台分发/翻页/键盘/自隐/删除确认/视频/实况)`

---

