# 图标圆角与网格间距随页面缩放 — 设计

日期：2026-07-16
状态：已由用户批准（方案 A：纯 CSS 自适应）

## 问题

主页网格、Dock、添加面板的应用图标共用同一个尺寸变量 `--app-size`，
由 `src/home/composables/useGridMeasure.ts` 根据窗口可用空间实时算出（约 40–70px）。
但图标圆角是全局写死的 `--icon-radius: 22px`（`src/styles/theme.css:29`），
网格间距也写死为 `gap: 16px`（`src/home/components/GridCanvas.vue`）。

结果：窗口小、图标缩小时，22px 圆角显得"过圆"（接近圆形）；
窗口大、图标变大时又显得"太方"。间距同理，不随页面缩放。

## 方案（已批准）：纯 CSS 自适应，不动 JS

### 1. 圆角改百分比

`theme.css` 中 `--icon-radius: 22px` → `--icon-radius: 31%`。

- 31% ≈ 22px ÷ 70px（当前默认图标尺寸下的观感），默认布局下视觉无突变。
- CSS 百分比圆角按元素自身尺寸解析，图标多大圆角就等比多大，
  所有使用 `var(--icon-radius)` 的地方自动生效。
- 各组件里的 fallback 值（`var(--icon-radius, 22px)`、`var(--icon-radius, 16px)`）
  同步改为 `31%`，保持退化一致。
- 前提已核实：当前所有使用 `--icon-radius` 的元素均为正方形
  （AppTile `.app-ic`、theme.css `.app-ic`/`.folder-tile`/`.dock-ic`、
  HomeDock `.dock-ghost`、AddPanel `.lib-app-ic`），
  不存在百分比导致椭圆角的情况。photo-thumb / drop-ghost 用的是 `--radius`，不受影响。

### 2. 网格间距改 clamp

`GridCanvas.vue` 中 `.grid { gap: 16px }` → `gap: clamp(8px, 1.08vw, 16px)`。

- 1.08vw ≈ 16px ÷ 1480px（网格最大宽度），窗口 ≥1480px 时保持现在的 16px，
  窗口越窄间距等比收缩，下限 8px。
- `useGridMeasure.measure()` 本来就通过 `getComputedStyle(grid).columnGap`
  读取**渲染后的实际值**再算格子尺寸，因此 JS 零改动，无循环依赖。

### 3. Dock 内图标间距改比例

`HomeDock.vue` 中 `.dock-zone { gap: 14px }` → `gap: calc(var(--app-size, 64px) * 0.2)`。

- 0.2 × 70px = 14px，默认观感不变；图标缩小时间距等比缩小。
- ≤720px 媒体查询里现有的 `gap: 8px` 覆盖保留不动（后声明覆盖，作为小屏下限）。

## 不做的事（YAGNI）

- 不新增"图标大小/密度"用户设置。
- 不改 `useGridMeasure.ts` 的测量逻辑。
- 不动 AddPanel 内部列表布局、照片磁贴（`--radius`）、Dock 容器圆角（`--dock-radius`）。

## 验证

- `pnpm test`（vitest 全量）通过。
- `pnpm dev` 打开 `/app/#/`，将浏览器窗口从宽拉到窄：
  图标变小时圆角与间距应同步等比收缩，观感比例一致；
  Dock、添加面板、文件夹磁贴圆角与主页网格一致。
