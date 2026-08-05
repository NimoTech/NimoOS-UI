### Task 5: `PhotoImageViewer.vue` — 静图缩放/平移/旋转 + OCR 覆盖层

**Files:**
- Create: `src/photos/lightbox/PhotoImageViewer.vue`
- Test: `src/photos/lightbox/__tests__/PhotoImageViewer.test.ts`

**Interfaces:**
- Consumes:变换骨架**逐段照抄** `src/files/viewers/ImageViewer.vue:18-152,184-241`(变换状态模型、`COMMIT_DELAY=150` 停手落盘、`PAN_KEEP=48` clampPan、pointer-capture 吞 click 守卫 `:109-116`、丢失 pointerup 自愈 `:117-124`、`@dragstart.prevent`+`draggable=false`、wheel 缩放 clamp `[0.1,8]`、5s 工具栏自隐、`watch(index?,resetTransform)`——本组件单图无内部 index,改为 `watch(() => props.assetId, resetTransform)`);src 用 Task 1 `browserCanDisplayImage` + 共享包生成器。OCR 用 Task 1 `mapOcrBoxesToRects`。
- Produces:
  - props `{ assetId: string|number; mimeType: string; ocrLines?: Array<{box:number[]}> }`
  - emits **无**(翻页/工具栏钮由父壳 T6 提供;本组件只负责单图缩放/平移/旋转 + OCR)。**注意:去掉 files ImageViewer 的翻页(prev/next/disable*)与 ViewerShell 包裹**——本组件是「舞台内容」,不含 chrome。
  - 内部方法暴露给父(`defineExpose`)供工具栏调用:`zoomIn/zoomOut/rotate/resetTransform`。
  - **src 计算**:`browserCanDisplayImage(props.mimeType) ? service.photos.originalUrl(id) : service.photos.thumbnailUrl(id,'large')`(HEIC/TIFF/RAW 回退大图缩略图,照 Vue2 `imageSrc` `PhotosLightbox.vue:221-225`)。
- **OCR 覆盖层(关键设计:随变换移动)**:OCR rects 必须与 `<img>` 共处同一被 `imgStyle` transform 的容器内,缩放/平移时一起动。做法:舞台内包一层 `.img-wrap`(带 `imgStyle` transform),内含 `<img ref=imgEl class=img-el>` + `<div class=ocr-overlay>`(绝对定位,`pointer-events:none`);rects 相对 img 的**渲染尺寸**(`clientWidth/Height` + `naturalWidth/Height`)由 `mapOcrBoxesToRects` 算出,不再叠加 offsetLeft/Top(img 是 wrap 的唯一内容,原点对齐)。在 `<img @load>`、`watch(assetId)`、`watch(() => props.ocrLines)`、`ResizeObserver`(或 window resize)时 `recomputeOcrRects()`。`ocrLines` 为空 → rects 空、不渲染。
- **移植 delta(相对 files ImageViewer,报告逐条确认)**:
  1. 去掉 `filterImages/imageIndex/items/index/current/prev/next/disablePrev/disableNext` 与 `<ViewerShell>` 包裹;src 改 assetId 制(上述)。
  2. `watch(index, resetTransform)` → `watch(() => props.assetId, resetTransform)`(换图复位变换)。
  3. 新增 OCR 覆盖层(上述),与 `<img>` 同 transform 容器;clampPan 的 `el`/尺寸仍取 `imgEl`(不变)。
  4. 工具栏钮**不在本组件**渲染(父壳统一);保留缩放/平移/旋转逻辑并 `defineExpose`。
  5. 键盘翻页 `onKey`(ArrowLeft/Right)**不在本组件**(父壳统一);本组件只留 wheel/pointer。
  6. 样式沿用 files `.img-stage`/`.img-el`(**保留 `.img-el` 不加 `will-change` 的瓦线注释**),新增 `.img-wrap`(transform 载体)/`.ocr-overlay`/`.ocr-hit`(高亮框,色用 `var(--accent)` 类 token,脉冲动画可简化)。

- [ ] **Step 1: 写失败测试**(mock `@nimotech/nimoos-service` 的 `service.photos.originalUrl/thumbnailUrl` 返确定串;jsdom 造 offset/natural 尺寸)
  - `browserCanDisplayImage=true` 时 img src 用 originalUrl;`image/heic` 时用 thumbnailUrl(id,'large')。
  - wheel down → 有效缩放减、wheel up → 增;`defineExpose` 的 `zoomIn` 调用后 img style `transform` 含 `scale(...)`。
  - pointerdown 起于 `.img-toolbar`(本组件无工具栏,可用 `.tb-item` 桩验证守卫逻辑存在)→ 不进入拖拽(照 ImageViewer.test.ts:26-32 的守卫用例改写:pointerdown 起于普通舞台才拖拽)。
  - clampPan:造 stage 800×600、img offset 1000×800,拖到极端 → tx 被钳(照 `ImageViewer.test.ts:66-89`)。
  - 停手落盘:`vi.useFakeTimers()`,缩放后 `advanceTimersByTime(150)` → img style 出现 `width:` 落盘尺寸(照 `ImageViewer.test.ts` 落盘用例)。
  - OCR:喂 `ocrLines=[{box:[0,0,1,0,1,1,0,1]}]` + 造 img 200×200 natural 100×50 → overlay 内出现 1 个 `.ocr-hit`,`left/top/width/height` 与 `mapOcrBoxesToRects` 一致;`ocrLines=[]` → 无 `.ocr-hit`。
- [ ] **Step 2: RED**;**Step 3: 实现**;**Step 4: GREEN + 全量 + tsc**。
- [ ] **Step 5: Commit** — `feat(photos): 灯箱静图查看器(缩放/平移/旋转骨架 + OCR 覆盖层)`

---

