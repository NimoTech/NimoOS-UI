# Task 7 Report — PhotoInfoPanel.vue（EXIF/详情栏 + OSM 小地图）

## Implemented

Created `src/photos/lightbox/PhotoInfoPanel.vue`：纯展示组件，`<script setup lang="ts">`，
props `{ photo: Photo | null; visible: boolean }`，emits 无。移植自 Vue2
`NimoOS-UI/src/views/Photos/PhotosLightbox.vue:74-149`（`<aside class="lb-info">`）。

结构（按 brief）：
- 图片段（`!photo.isVideo`，`photosInfoCameraCapture`）：Camera/ISO/Shutter/Aperture(`f/{toFixed(1)}`)/
  Focal(`{toFixed(0)} mm`)/Dimensions/File size；空字段对应行不渲染（`v-if` 挂在每个 `.info-row` 上）。
- 视频段（`photo.isVideo`，`photosInfoVideo`）：Duration/Resolution(dim)/Video codec/Audio codec/
  Frame rate/Bit rate/Rotation(`{rotation}°`)/File size。
- 位置段（外层容器 `photo.place || photo.coords`，照 Vue2 :115 原判定）：Place/Coordinates +
  地图仅在 `lat && lon` 时渲染 `<iframe :src="osmEmbedSrc(lat,lon)" loading="lazy">` + `.map-pin`
  覆盖层（brief 摘要句写的"位置段（lat&&lon）"就落在这个地图子块上，避免"只有地名没有精确坐标"
  时整段消失）。
- 人物段（`faces.length>0`，`photosInfoPeople`）：face chip，首字母占位头像（不引入
  asset-scoped face-thumbnail）。
- Nimo 段（`tags.length>0`，`photosInfoNimoSees`）：tag chip + `photo.scene`（有值才拼接到标题）。
- 文件段（`photosInfoFile`）：`photo.filePath` + 复制按钮，点击调用剪贴板 util 后文案切
  `photosCopied` 约 2s（`setTimeout(2000)`）。
- `visible=false` 或 `photo=null` → 整个 `<aside>` 不渲染（`v-if="visible && photo"`）。
- 窄屏（`≤768px`）：CSS media query 把桌面右栏（`width:360px`）改成 `position:fixed` 贴底浮层
  （`max-height:70vh`），独立浮层，未接 `useSidebarDrawer`（那是侧栏专用组合式函数，本组件语义
  不同，brief 也明确说"不必接"）。

## Deltas confirmed

1. **删 ask-nimo 按钮** — Vue2 `:84-87` 的「Hand off to Nimo」`<button class="give-nimo">` 整体
   未移植；测试 `does not render the ask-nimo hand-off button` 断言 `.give-nimo` 不存在、正文不含
   "Nimo" 字样，PASS。
2. **face chip 无 asset-scoped face-thumbnail** — 人物段 chip 用 `f[0]`（姓名首字母）文字占位，
   跟 Vue2 源码逻辑一致（源码本来就是 `{{ f[0] }}`，Vue2 侧也没接过真实人脸缩略图接口），未引入
   任何 `/assets/:id/face-thumbnail` 之类 URL 生成器。测试
   `renders face and tag chips ... without an asset-scoped face-thumbnail` 断言 `.face-chip img`
   不存在，PASS。
3. **faces/tags/scene 空时段落整体隐藏** — `data-section="people"` / `data-section="nimo-sees"`
   容器 `v-if` 挂在 `faces.length > 0` / `tags.length > 0` 上（P2 时间线路径两者恒为 `[]`），
   结构保留（后续接入真实数据时模板无需改）。测试
   `hides the people/nimo-sees sections when faces/tags are empty` PASS。

## Clipboard fallback used

复用既有 `src/files/util/clipboard.ts` 的 `copyText()`（未新写一份）：
`navigator.clipboard.writeText` 优先，失败/不可用（局域网 IP 明文 HTTP 访问的非安全上下文）时
降级 `document.execCommand('copy')`，两条都失败才 throw，由调用方（本组件 `onCopyPath`）静默
吞掉（未做 toast，与 Vue2 源行为一致——源码 `copyPath` 本身也没有失败提示）。测试里对
`../../../files/util/clipboard` 做 `vi.mock`，只验证"点击调用了 `copyText(path)`"这一层集成，
不重复测 `copyText` 内部降级细节（已由 `src/files/util/clipboard.test.ts` 覆盖）。

## TDD RED → GREEN

**RED**（组件文件不存在前先写测试并跑）：
```
$ pnpm vitest run src/photos/lightbox/__tests__/PhotoInfoPanel.test.ts
 FAIL  src/photos/lightbox/__tests__/PhotoInfoPanel.test.ts
Error: Failed to resolve import "../PhotoInfoPanel.vue" ... Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

**实现后 GREEN：**
```
$ pnpm vitest run src/photos/lightbox/__tests__/PhotoInfoPanel.test.ts
 Test Files  1 passed (1)
      Tests  11 passed (11)
```

11 个用例覆盖：相机段字段渲染 + 空字段不渲染（aperture=null 场景）、aperture/focal 格式化
（`f/1.8`、`35 mm`）、视频段渲染且相机段不渲染、有经纬度渲染 iframe（src 严格等于
`osmEmbedSrc(lat,lon)`）+ `.map-pin`、无经纬度不渲染 iframe、faces/tags 空时人物/Nimo 段隐藏、
faces/tags 有值时渲染 chip 且无 face-thumbnail `<img>`、无 ask-nimo 按钮、`visible=false`/
`photo=null` 均不渲染 `.info-panel`、复制路径调用 copyText + 文案 2s 后复位（`vi.useFakeTimers`
推进）。

**全量 + tsc + color-guard：**
```
$ pnpm test
 Test Files  235 passed (235)
      Tests  1419 passed (1419)

$ pnpm exec vue-tsc --noEmit
(no output — clean)

$ pnpm vitest run src/styles/color-guard.test.ts
 Test Files  1 passed (1)
      Tests  107 passed (107)
```
color-guard 通过 `import.meta.glob('../**/*.vue', ...)` 动态扫描全部 `.vue`，本次新文件已被
纳入扫描（非硬编码清单），107 条断言含新组件仍全绿，确认组件内颜色全部走 token
（`--panel-bg`/`--card-border`/`--fg`/`--fg-muted`/`--accent`/`--chip-bg`/`--chip-bg-hi`/
`--radius`/`--blur`/`--panel-shadow`），未新增裸色字面量、未使用未定义 token 名。

（过程中 tsc 曾报一处测试自身的类型错：`copyText = vi.fn(() => Promise.resolve())` 签名 0 参，
`vi.mock` 里却按 1 参调用 `copyText(t)`；改成 `vi.fn((_text: string) => Promise.resolve())`
后清干净——这是本任务测试文件自身的类型修复，非跨任务改动。）

## Files changed

- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/lightbox/PhotoInfoPanel.vue`（新建）
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/lightbox/__tests__/PhotoInfoPanel.test.ts`（新建）

Commit: `016b4b7` — `feat(photos): 灯箱详情/EXIF 栏 + OSM 小地图`（仅这两个文件；提交前
`git status --short` 确认过工作区无其它改动被误带入）。

## Self-review

- Aperture/focal 格式化严格照抄 Vue2 `Number(x).toFixed(1/0)` 规则，而非 brief 摘要句里简化写的
  `f/{aperture}`（brief 正文明确说"结构照 Vue2 :74-149"，以源码行号为准，摘要句是简写）。
- 位置段外层容器沿用 Vue2 `photo.place || photo.coords` 的判定，而不是只用 `lat && lon`——
  地图 iframe 本身仍严格用 `lat && lon` 门控，与 brief"位置段（lat&&lon）"的意图一致：如果只有
  地名没有精确坐标，仍展示地点文字行，只是不渲染地图（源码原本行为，避免"位置段标题在但一行
  内容都没有"的空段）。
- `justCopied` 用 `setTimeout` 手动清定时器，组件卸载时未显式 `onUnmounted` 清理——面板跟随
  灯箱整体卸载/重建，2s 内卸载导致 timer 泄露的窗口很小且无副作用（回调只是设一个已被丢弃组件
  实例的本地 ref），评估为可接受的小暇疵，未过度设计加 onUnmounted。
- 未修改 `PhotoLightbox.vue`（T6 产物，其 `<aside class="lb-info">` 目前用具名 slot 占位）——
  接入 PhotoInfoPanel 是集成步骤，brief 本任务的 Produces 清单只要求创建
  `src/photos/lightbox/PhotoInfoPanel.vue`，未提及改 PhotoLightbox.vue，按"只提交本任务文件"
  的硬约束未动它。

## Concerns

- **集成缺口**：PhotoInfoPanel.vue 目前是孤立组件，尚未被 `PhotoLightbox.vue` 引用/挂载
  （T6 里的 `<aside class="lb-info">` 仍是占位 slot + 默认内容）。若后续任务未显式安排"把
  T7 接进 T6"，实际灯箱详情栏在真机上不会变化，需要跟进确认这一接线归属哪个任务。
- **窄屏行为未做真机验收**（brief 里其它同类任务多次提到"待真机验收"的教训）——仅 CSS
  media query 静态实现，未在浏览器里量过手机/平板尺寸下与顶栏/舞台的层叠、滚动是否顺手。
- 复制失败（两条兜底都挂）目前完全静默，与 Vue2 一致但用户体验上不会有任何反馈；如果之后
  产品想要失败提示，需要额外加 toast，目前范围内未做。
