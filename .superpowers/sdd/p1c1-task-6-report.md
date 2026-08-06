# P1c1 Task 6 — ContextUsageBar 移植报告

## 做了什么

移植 Vue2 `NimoOS-UI/src/views/AI/Agent/blocks/ContextUsageBar.vue`：
- 模板部分（33-61 行）→ `src/ai/components/blocks/ContextUsageBar.vue` 的 `<template>`，逐字保留 SVG 结构（`viewBox="0 0 36 36"`、`cx/cy/r=18/18/15.5`、`stroke-width="3.5"`、`stroke-linecap="round"`、`transform="rotate(-90 18 18)"`）与类名（`.ctx-usage`/`.ctx-ring`/`.ctx-ring-track`/`.ctx-ring-arc`/`.ctx-usage-tip`）。
- 样式部分（63-107 行）→ `<style scoped>`，逐条保留规则与颜色 token（`--line-strong`/`--accent`/`--warning`/`--danger`/`--text-secondary`/`--bg-elevated`/`--line`/`--shadow-pop`）、悬浮显隐 transition、tooltip 定位。**唯一形式改动**：原文件是 `lang="scss"` 用 `&.ok`/`&.warn`/`&.danger` 嵌套，这里展开成 `.ctx-ring-arc.ok` 等平铺选择器（纯 CSS，无 scss）——这不是设计改动，只是语法展开，因为搜了全仓库 `src/` 没有任何组件用 `lang="scss"`（New-UI 全仓库统一手写平铺 CSS），沿用项目约定而非引入新依赖。
- 逻辑部分（Vue2 script 2-28 行的 `RING_R`/`RING_C`/`computed.level`/`computed.dashArray`/`methods.formatTokens`）**全部删除**，改为从 `src/ai/util/contextUsage.ts`（Task 5 产物）导入 `formatTokens`/`levelFor`/`dashArrayFor`，组件内不再重算任何几何/阈值/格式化逻辑。
- props：`{ tokens?: number; window?: number; pct?: number }`，`withDefaults` 全部默认 0，与 Vue2 API 名称一致。组件内一律用 `props.window`（3 处：class 绑定走 `levelFor(props.pct)`、dasharray 走 `dashArrayFor(props.pct)`、tooltip 文本 `formatTokens(props.window)`），未出现裸 `window`。
- i18n：`$t('Context')` → `t('aiCtxLabel')`，用 `useI18n()` 标准写法（参照 `McpWarningCard.vue`）。

## Vue2 spec 处理

未移植旧 `blocks/ContextUsageBar.spec.js` 里伸手进 Options API 对象的用例（`ContextUsageBar.methods.formatTokens`、`computed.level.call({pct})`、`computed.dashArray.call({pct})`）——按任务说明，这部分纯几何/格式化已经在 `src/ai/util/contextUsage.ts` 自己的测试里覆盖了。新测试只保留原 spec 54-81 行的**渲染**用例（mount + 断言 DOM class/text/属性），完全对应本任务 brief 给的三个测试用例，逐字照抄。

## i18n key 新增

- `src/i18n/zh_cn.ts`：`aiCtxLabel: '上下文'`，加在文件末尾 `aiTimelineYou` 之后，带 `// SP8-P1c1 Task 6 — ContextUsageBar(上下文占用环)` 注释，跟随既有分节注释风格。
- `src/i18n/en_us.ts`：`aiCtxLabel: 'Context'`，同样位置，注释 `// SP8-P1c1 Task 6 — ContextUsageBar (context usage ring)`。

## 零颜色字面量验证

```
$ grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*white' src/ai/components/blocks/ContextUsageBar.vue
(无输出，grep exit code 1)
```

## 测试命令与结果

```
$ pnpm test -- src/ai/components/blocks/ContextUsageBar.test.ts src/i18n/parity.test.ts
 Test Files  2 passed (2)
      Tests  6 passed (6)

$ pnpm exec vue-tsc --noEmit
(无输出，类型检查通过)

$ pnpm test   # 全量回归
 Test Files  240 passed (240)
      Tests  1571 passed (1571)
```

TDD 过程：先写好 `ContextUsageBar.test.ts`（brief 给定的三个用例，逐字照抄），跑 `pnpm test -- src/ai/components/blocks/ContextUsageBar.test.ts` 确认失败（`Failed to resolve import "./ContextUsageBar.vue"` — 组件文件尚不存在），再实现组件与 i18n key，重跑确认全绿。

## 发现但未改动的东西

- 未发现 Vue2 源里有需要修的真 bug——`level`/`dashArray`/`formatTokens` 三个计算量此前已在 Task 5 的 `contextUsage.ts` 里原样搬运并测试过，本任务只是消费它们，没有引入新逻辑分歧。
- Vue2 `<script>` 块（1-31 行）先于 `<template>`（33-61 行）的反常文件顺序——纯粹是 Vue2 SFC 书写习惯，`<script setup>` 天然就在顶部，无需特别处理。
- 组件未接入实际数据源（`tokens`/`window`/`pct` 由未来的 composer 父组件传入）——符合任务描述"composer 两个任务后接入"的分工。

## Commit

`7d278b6` — "SP8-P1c1: ContextUsageBar (ring + hover tip) on pure geometry module"
文件：`src/ai/components/blocks/ContextUsageBar.vue`（新增）、`ContextUsageBar.test.ts`（新增）、`src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`（各 +2 行）。

---

## Fix Pass 2 — SCSS 嵌套恢复

**发现**：初次实现时错误假定 New-UI 无 SCSS，遂将 Vue2 的 `<style lang="scss" scoped>` 展开为平铺 CSS（`.ctx-ring-arc.ok` 等）。实际 New-UI 存在 `src/ai/styles/tokens.scss` 等真实 SCSS 导入，项目已有 `sass` devDependency。

**修复**：
- `src/ai/components/blocks/ContextUsageBar.vue` 第 44-63 行：`<style scoped>` → `<style lang="scss" scoped>`
- 恢复 SCSS 嵌套：`.ctx-ring-arc { transition: …; &.ok { stroke: var(--accent); } &.warn { stroke: var(--warning); } &.danger { stroke: var(--danger); } }`
- 删除错误注释（若有）

**验证**：
```
$ pnpm test -- src/ai/components/blocks/ContextUsageBar.test.ts
 Test Files  1 passed (1)
      Tests  3 passed (3)

$ pnpm build 2>&1 | tail -5
dist/assets/ExcelViewer-DAy1_LyM.js          1,681.55 kB │ gzip: 503.45 kB
dist/assets/index-CvXEsI6P.js                2,854.92 kB │ gzip: 834.21 kB
(!) Some chunks are larger than 500 kB after minification…
✓ built in 36.69s

$ grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*white' src/ai/components/blocks/ContextUsageBar.vue
(无输出，零颜色字面量，符合 theme 约定)
```

**Commit**：`b0887f2` — "SP8-P1c1: restore verbatim lang="scss" style block in ContextUsageBar (review fix)"
