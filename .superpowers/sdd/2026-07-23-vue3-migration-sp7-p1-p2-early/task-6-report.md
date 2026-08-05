# Task 6 报告：`PhotoLightbox.vue` 壳

## 状态：DONE

## 实现概要
新建 `src/photos/lightbox/PhotoLightbox.vue`（`<script setup>` + TS），状态全读 `useLightbox()` 单例，无 props，emits `delete(id)` / `toggle-fav(id, fav)`。结构照 Vue2 `PhotosLightbox.vue` 移植：

- 全屏 `.lightbox`（`position:fixed; inset:0; z-index:200`，bg `var(--app-bg)`），`v-if="lb.open.value"`。
- **顶部工具栏**（`v-if="isMoving"`）：关闭 `.lb-close`(`lb.close`)、中部标题 `detail.title` + 计数 `photosLightboxCounter({idx,total})` + `detail.date · detail.time`；右侧收藏 `.lb-fav`（实心/描边星 + `is-fav` class）、下载 `<a.lb-download :href=originalUrl :download>`、详情开关 `.lb-info-toggle`（toggle 本地 `showInfo`）、删除 `.lb-delete`（开模态）。
- **舞台分发**（按 `current`，一律 id 驱动）：(a) `isVideo` → 原生 `<video :src=originalUrl :poster=thumbnailUrl(large) controls preload=metadata playsinline @loadedmetadata=applyStartTime>`；(b) `isLivePhoto && !isVideo` → `PhotoImageViewer` + `.lb-live-badge` 徽标 + 按住播覆盖 `<video.lb-live-video :src=liveUrl muted playsinline>`；(c) else → `PhotoImageViewer`。
- **翻页箭头** `.lb-nav-prev/.lb-nav-next`（`v-if=isMoving`，`:disabled=!hasPrev/!hasNext`，点击 `lb.prev/next`）。
- **键盘**（window keydown，mount 加 / unmount 移）：←prev、→next、Esc close（模态开时只关模态）、f/F toggleFav、Delete/Backspace 开模态。
- **chrome 自隐**：`isMoving` + 5s 计时（`onMouseMove` 重置，`onMounted` 触发一次）。
- **删除确认模态** `.lb-confirm`：确认 `.lb-confirm-ok` → `emit('delete', current.id)` + `lb.close()`；取消 `.lb-confirm-cancel` 只关模态。

## Delta 逐条确认
1. **删「加入相册」「交给 Nimo」两钮及其 emit** — 已删，顶栏与详情区均未渲染，emits 只保留 `delete` / `toggle-fav`。✅
2. **详情栏改为可 toggle**（Vue2 恒显）— 本地 `showInfo` ref（默认关），`.lb-info-toggle` 翻转；`<aside.lb-info>` 仅占位（含 `#info` 具名 slot 透传 `detail`），T7 填充。✅
3. **顶栏无缩放钮** — 采纳 brief 推荐的后者方案：PhotoImageViewer 自持底部缩放条（放大/缩小/旋转/复位），顶栏只放 关闭/收藏/下载/详情/删除，无跨组件 ref。T5 保留其底部工具栏（未改动）。✅
4. **当前项一律按 id 比较** — 舞台 `:key="String(current.id)"`，emit 用 `current.id`，续播锚点 `startPhotoId` 存 id 后比对 `cur.id !== startPhotoId`。无对象 ref 比较。✅

## 实况照片（net-new，自拟最小实现）
Vue2 灯箱无此功能。做法：静图仍走 `PhotoImageViewer`；右下 `.lb-live-badge` 徽标承载按住手势（`@pointerdown=liveStart`、`@pointerup/@pointerleave/@pointercancel=liveStop`）。press 时 `liveActive=true` 渲染覆盖 `<video.lb-live-video muted playsinline>` 并 `nextTick` 后 `play()`；松开 `pause()` 并隐藏。手势挂在徽标而非图上，避免与 PhotoImageViewer 的拖拽 pointer capture 打架，自包含。

## 视频续播（applyStartTime）
照 Vue2 :335-344 移植：`onMounted` 记 `startPhotoId = current.id`、`startApplied=false`；`@loadedmetadata` 触发 `applyStartTime`，仅当 `startMs>0` 且 `current.id===startPhotoId` 且未 applied 时 seek 一次（钳到 `min(startMs/1000, dur-0.1)`）后 `play().catch(()=>{})`。翻页到别的视频不触发。未卡壳。

## TDD RED / GREEN
- **RED**：先写 `__tests__/PhotoLightbox.test.ts`（19 用例）。`pnpm vitest run` → 组件文件不存在，transform 报 `Failed to resolve import "../PhotoLightbox.vue"`，`Test Files 1 failed / no tests`。
- **GREEN**：实现组件后 `pnpm vitest run src/photos/lightbox/__tests__/PhotoLightbox.test.ts` → `Test Files 1 passed (1) / Tests 19 passed (19)`。
- **tsc**：`pnpm exec vue-tsc --noEmit` → EXIT 0，无错。
- **全量**：`pnpm test` → `Test Files 234 passed (234) / Tests 1405 passed (1405)`（含 color-guard 守卫，绿）。

测试要点：`vi.mock('@nimotech/nimoos-service')` 提供 originalUrl/thumbnailUrl/liveUrl + 单例开态调的 recordView/getAsset(reject 使 detail 恒为占位)/getAssetOcr/listFavoriteIds/favorite/unfavorite；`useLightbox().openAt(...)` 驱动开态，`__resetForTest()` 于 beforeEach；PhotoImageViewer 用 `global.stubs` 打桩；`HTMLMediaElement.prototype.play/pause` mock；自隐用 `vi.useFakeTimers()`；每例 afterEach `unmount()` 防 window 监听残留（onKey 亦有 `if(!lb.open.value) return` 守卫）。

## 覆盖用例（19）
开合/标题/计数、视频舞台 src、静图查看器分发、关闭钮、ESC、模态开时 ESC 只关模态、首张 prev 禁用+点 next、末张 next 禁用、←/→ 键、收藏(favorite 调用+emit+星实心)、预置收藏星实心、f 键收藏、下载 href+download、详情 toggle、删除模态确认(emit delete + close)、取消只关模态、5s 自隐+mousemove 复现、实况徽标+按住播 liveUrl+松开消失。

## 文件变更
- 新增 `src/photos/lightbox/PhotoLightbox.vue`
- 新增 `src/photos/lightbox/__tests__/PhotoLightbox.test.ts`
- Commit `282278d` `feat(photos): 灯箱壳(工具栏/舞台分发/翻页/键盘/自隐/删除确认/视频/实况)`

## 颜色约定
所有可见色走 `var(--…)` token（含 fallback 形式）。固定媒体 chrome 色处均加 `/* theme-exception: 原因 */`：顶栏渐隐、收藏星金色、模态遮罩暗化。color-guard 测试随全量绿。

## 自查
- 舞台分发严格按 `current`（不用 detail），视频/实况标志稳定不被 detail 水合覆盖。
- 键盘监听 mount 加、unmount 移，且 `!open` 早退，无跨实例干扰。
- download 名回退 `photo-{id}`。
- `lb-info` 仅占位 + slot，未越界实现 T7 内容。

## Concerns
- 实况按住播放为 net-new，仅单测覆盖 DOM 出现/消失与 src；真机手势与自动暂停行为待 P2 眼验。
- 详情面板默认关（Vue2 默认开）——若产品要求默认开，T7 接入时一行改 `showInfo` 初值即可。
- `--star-fg`/`--media-chrome-bg`/`--scrim`/`--text-3` 等 token 若 theme.css 未定义则走 fallback；建议 T7/接入时确认这些语义 token 已在两套主题登记（当前 fallback 兜底，color-guard 通过）。
- **报告路径冲突**：写入前 `task-6-report.md` 存有一份无关的 VideoHoverPreview 报告（疑似跨计划编号撞车）；按本任务 brief 与父指令均指向 task-6-report.md，已覆盖为本任务报告。

---

## 修复:视频续播锚点在 open 变真时捕获(Important review finding)

### 根因
`PhotoLightbox.vue` 由父级**持久挂载**(父只 mount 一次,组件内部靠 `v-if="lb.open.value"` 自门控)。原代码在 `onMounted` 里捕获续播锚点:
```
startApplied = false
startPhotoId = lb.current.value?.id ?? null   // 旧 :104-108
```
但 `onMounted` 运行时灯箱通常还**关着**,`lb.current.value` 为 `null` → `startPhotoId` 恒为 `null`。于是 `openAt(video, list, 16000)` 打开视频后,`applyStartTime` 因 `cur.id !== startPhotoId(null)` 恒 early-return,悬停位续播功能形同虚设(dead feature)。

### 修复
把锚点捕获从 `onMounted` 挪到对 open 变化的 watcher:
```
watch(
  () => lb.open.value,
  (isOpen) => {
    if (isOpen) {
      startApplied = false
      startPhotoId = lb.current.value?.id ?? null
    }
  },
  { immediate: true }, // 兼容组件在灯箱已开时才挂载的边缘情况
)
```
- 保留 `startApplied` 一次性守卫(翻页不重复 seek)与既有 `applyStartTime` seek 逻辑(`currentTime = min(startMs/1000, duration-0.1)` 后 play)不变——只改了**何时捕获锚点**。
- `onMounted` 里那两行死代码删除,其余(`onMouseMove()` + keydown 监听)保留。
- `immediate: true` 覆盖「组件在灯箱已开时才挂载」的边缘;正常路径是 open 由 false→true。

### RED → GREEN 证据
新增 `describe('PhotoLightbox 视频起播位续播')` 两个用例:真正断言 `<video>.currentTime` 被 seek(用 `Object.defineProperty` 装 duration=60、getter/setter 追踪 currentTime,`trigger('loadedmetadata')` 后读回),并断言翻页到第二个视频**不再** seek(0)。

RED(git stash 掉 .vue 修复,仅跑新用例):
```
FAIL … 悬停位打开视频,loadedmetadata 后真的 seek 到 16s
FAIL … 翻页到另一视频不再 seek(startApplied 一次性守卫)
AssertionError: expected +0 to be 16   // startPhotoId 在 onMounted 时为 null
 Tests  2 failed | 19 skipped (21)
```

GREEN(修复恢复后):
```
pnpm vitest run src/photos/lightbox/__tests__/PhotoLightbox.test.ts
 Test Files  1 passed (1)
      Tests  21 passed (21)
```

全量与类型检查:
```
pnpm test        → Test Files 234 passed (234) / Tests 1407 passed (1407)
pnpm exec vue-tsc --noEmit → 无错误 (TSC_OK)
```
color-guard:未新增任何颜色字面量(改动仅 JS 逻辑 + 注释),无 CSS 变更;全量套件含主题 token 守卫测试全绿。
