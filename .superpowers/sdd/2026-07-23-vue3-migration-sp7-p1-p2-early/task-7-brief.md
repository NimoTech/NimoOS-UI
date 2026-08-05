### Task 7: `PhotoInfoPanel.vue` — EXIF/详情栏 + OSM 小地图

**Files:**
- Create: `src/photos/lightbox/PhotoInfoPanel.vue`
- Test: `src/photos/lightbox/__tests__/PhotoInfoPanel.test.ts`

**Interfaces:**
- Consumes:`Photo`(`assetToPhoto.ts:264-309`,由 T6 传入 `lb.detail`)、Task 1 `osmEmbedSrc`、i18n(T4)、剪贴板(照现有 `src/files` 复制路径的兜底写法,HTTP 非安全上下文 `navigator.clipboard` 不可用时 `execCommand` 兜底——见 New-UI 既有剪贴板 util 若有则复用)。
- Produces:
  - props `{ photo: Photo | null; visible: boolean }`;emits **无**(纯展示)。
  - 结构照 Vue2 `PhotosLightbox.vue:74-149`,删「交给 Nimo」`:84-87`:
    - 图片段(`!photo.isVideo`,`photosInfoCameraCapture`):Camera(`photo.camera`)、ISO、Shutter、Aperture(`f/{aperture}`)、Focal(`{focal} mm`)、Dimensions(`photo.dim`)、File size(`photo.size`)——空字段不渲染该行。
    - 视频段(`photo.isVideo`,`photosInfoVideo`):Duration、Resolution(`dim`)、Video codec、Audio codec、Frame rate、Bit rate、Rotation(`{rotation}°`)、File size。
    - 位置段(`photo.latitude && photo.longitude`,`photosInfoLocation`):Place(`photo.place`)、Coordinates(`photo.coords`)、OSM `<iframe :src="osmEmbedSrc(lat,lon)" loading=lazy>` + `.map-pin` 覆盖。
    - 人物段(`photo.faces?.length`,`photosInfoPeople`):face chips(P2 时间线路径 faces 多为空 → 段隐藏;有则渲染,头像可暂用文字/占位,**不引入 asset-scoped face-thumbnail**,归后续)。
    - Nimo 段(`photo.tags?.length`,`photosInfoNimoSees`):tags chips + scene(P2 恒空 → 隐藏,保留结构)。
    - 文件段(`photosInfoFile`):`photo.filePath` + 复制按钮(`photosCopyPath`→点后 `photosCopied` 2s)。
  - 窄屏(≤768px)行为:桌面态并列右栏(宽 ~360px);窄屏改底部抽屉/全宽覆盖(用 CSS media query,不必接 useSidebarDrawer——它是独立浮层)。
- **样式**:token 化(`--panel-bg`/`--card-border`/`--fg`/`--fg-muted` 等,参照 `src/files/components/FilesSidebar.vue` 五件套);不搬 Vue2 `photos.scss`。

- [ ] **Step 1: 写失败测试**(i18n plugin)
  - 图片 photo(有 camera/iso/dim/size)→ 渲染相机段且含这些值;缺 aperture 的行不出现。
  - 视频 photo → 渲染视频段(Duration/Resolution),不渲染相机段。
  - 有经纬度 → `<iframe>` src = `osmEmbedSrc(lat,lon)`;无经纬度 → 无 iframe。
  - `visible=false` 不渲染面板。
  - 复制路径:点按钮调剪贴板(spy)、文案切 `photosCopied`。
- [ ] **Step 2: RED**;**Step 3: 实现**;**Step 4: GREEN + 全量 + tsc**。
- [ ] **Step 5: Commit** — `feat(photos): 灯箱详情/EXIF 栏 + OSM 小地图`

---

