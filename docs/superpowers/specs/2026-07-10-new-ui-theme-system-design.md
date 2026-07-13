# NimoOS-New-UI 可切换配色方案（Theme System）设计

- 日期：2026-07-10
- 状态：设计已定，待实现
- 范围仓库：`NimoOS-New-UI`（Vue 3 + TS + Vite，挂 `/app/`）

## 1. 背景与目标

New-UI 目前是**单一深色玻璃**观感：所有颜色 token 定义在 `src/styles/theme.css` 的 `:root`（蓝紫 accent `#8ab4ff`/`#b79bff`，深色纵深背景 `--app-bg` + `body::before` 光斑）。绝大多数组件已经消费 `var(--…)`。但有两处组件（`SearchDialog.vue`、`MediaViewer.vue` 音频面板）各自复制了一份**米白纸感 + Azure 蓝**的本地调色板，绕过了全局 token；另有 `AddPanel.vue`、`UploadPanel.vue` 等散落硬编码 hex。

目标有两层：

1. **产品能力**：做成**两套可切换的整体主题** —— 白色（浅色纸感）+ 蓝色（现有深色玻璃），用户在主页顶栏一键切换，立即全站生效。
2. **开发约定（更重要、要长期遵守）**：把"配色可切换"立成**贯穿后续开发的规则** —— 以后写任何带颜色的 UI，颜色处**一律留空成 theme token 变量,禁止写死 hex**，从而任何配色方案都能随时替换/新增。这条约定必须**留档**并对后续所有开发（含 AI 会话）生效。

## 2. 核心约定（第一支柱）★

> **New-UI 里一切可见颜色必须来自 theme token（`var(--…)`），不得在组件/样式里写死颜色字面量。**

- "留空"含义：写组件样式时，颜色位置填 `var(--card-bg)` / `var(--fg)` / `var(--accent)` 这类 token，而不是 `#fff` / `rgba(...)` / 具名色。token 的实际值由当前主题决定。
- 若现有 token 表达不了某个新语义（如某种警示色），**新增一个语义 token**（在 `theme.css` 两套主题块里都给值），而不是就地写死。
- 例外（**有意为之,非残留,须在代码注释标明**）：
  - `theme.css` 的 `.ic-*` app 图标渐变 —— 品牌识别色，皮肤无关，两套主题都保留。
  - 第三方组件内部无法 token 化的颜色（如 CodeMirror 编辑器主题）—— 走该库自身的主题机制。
- 落地保障：见 §8 留档产物（`CLAUDE.md` 强约束 + `docs/THEMING.md` token 目录）。

## 3. 架构：`data-theme` 属性切换 + 双 token 块

选定方案（对比见附录）：**保留现有变量名不动**，通过根节点 `data-theme` 属性切换整块 token 值。

- `:root { … }` 原样保留 = **蓝色主题（默认、兜底）**。
- 新增 `:root[data-theme="light"] { … }` 覆盖块 = **白色主题**，重定义所有颜色 token。
- 切换 = `document.documentElement.dataset.theme = 'light' | 'blue'`（`blue` 即移除属性/设空，回落到 `:root` 默认）。
- 所有消费 `var(--…)` 的组件**零改动**自动翻色。
- 与现有约定一致：`useParallax`/`useGridMeasure` 已经在往 `document.documentElement` 写 CSS 变量，本方案沿用同一根节点。
- 可扩展：以后加第三套主题，只是再加一个 `:root[data-theme="xxx"]` 块 + store 的枚举项，无需改组件。

非颜色 token（`--font`/`--radius`/`--ease`/`--blur` 等结构量）**两套主题共享**，只放 `:root`。

## 4. Token 目录（蓝 → 白 映射）

白色主题取向：**纯米白纸感**（复用 SearchDialog 已验证的调色板），无背景光斑、无 backdrop-blur 玻璃，改用实色卡片 + 暖色柔影。

`color-scheme: dark → light`；滚动条滑块 `rgba(255,255,255,.22) → rgba(28,27,25,.22)`。

关键映射（完整表进 `docs/THEMING.md`，实现时以 `theme.css` `:root` 现值为准逐条覆盖）：

| Token | 蓝色（现值） | 白色（新值） |
|---|---|---|
| `--bg` | `#1a2138` | `#f7f5ef` |
| `--fg` | `#ffffff` | `#1c1b19` |
| `--fg-muted` | `rgba(255,255,255,.74)` | `#6e6a61` |
| `--fg-faint` | `rgba(255,255,255,.52)` | `#9a958a` |
| `--accent` | `#8ab4ff` | `#3b5bdb` |
| `--accent2` | `#b79bff` | `#6e5ae0` |
| `--on-accent` | `#16203a` | `#ffffff` |
| `--good` | `#5fe3b0` | `#15754c` |
| `--card-bg` | 半透明白玻璃渐变 | `#ffffff` 实色 |
| `--popup-bg` | 深色玻璃渐变 | `#ffffff` 实色 |
| `--card-border` / `--chip-border` / `--dock-border` / `--inner-border` | `rgba(255,255,255,.36±)` | `#e7e3d9` |
| `--chip-bg` / `--chip-bg-hi` | 半透明白渐变 | `#ffffff` / `#f2efe7` |
| `--tool-bg` / `--tool-bg-hi` / `--inner-bg` / `--inner-bg-hi` | 半透明白 | 米白/白实色 + 暖灰描边 |
| `--card-shadow` / `--card-shadow-hi` / `--dock-shadow` / `--icon-shadow` | 深冷投影 | 暖色柔影（如 `0 26px 50px -20px rgba(60,50,30,.3)`），去掉 inset 白高光 |
| `--overlay-bg` | `rgba(20,26,46,.46)` | `rgba(40,36,28,.28)` |
| `--overlay-blur` / `--blur` | 强模糊 | light 下降或去（纸感不用玻璃） |
| `--app-bg` | 深色 radial+linear | 纯 `#f7f5ef` |
| `body::before` / `body::after` | 光斑层/暗角 | light 下 `background: none`（关掉） |
| `--drop-bg` / `--spark-fill` / `--orb-glow` 等 accent 衍生 | 蓝紫 rgba | 按 `#3b5bdb` 重算 rgba |
| `--remove-bg`（危险色） | `#ff708a` | `#e0466a`（浅底加深保证对比） |

`--brand-bg`（品牌渐变）在 light 下改为 Azure 渐变 `linear-gradient(135deg,#4c6fe8,#6e5ae0)`（与 SearchDialog 的 `--grad-a/--grad-b` 一致）。

## 5. 收编现有硬编码色（全站彻底化）

为达成"白色模式无深色残留"，把绕过 token 的地方收编：

- **删除 `SearchDialog.vue` / `MediaViewer.vue` 的本地纸感调色板**，改吃全局 token。副作用（预期且正确）：这两处在**蓝色模式下会变回深色玻璃**，符合"复用同一方案"。它们独有的语义色（SearchDialog 的语义排序绿/琥珀/灰、命中高亮；MediaViewer 的高光琥珀/星标）提升为全局语义 token，两套主题各给值。
- 逐个 token 化散落硬编码：`AddPanel.vue`、`UploadPanel.vue`、`OperationStatusBar.vue`、`NetworkStorageDialog.vue`、`ShareLinkDialog.vue`、各 Dialog（`RenameDialog`/`NewItemDialog`/`AlertDialog`/`ContextMenu`）、`Login.vue`、`Welcome.vue`、`ViewerShell.vue`、`FilesSidebar.vue`、`FileRow.vue` 等（探查清单见实现计划）。
- `viewers.css` 一并扫一遍。
- 保留 `.ic-*` app 图标彩色（见 §2 例外），在 `theme.css` 加注释说明。

## 6. 切换 store + 持久化

新建 `src/stores/theme.ts`（仿 `src/stores/locale.ts` 结构）：

```
THEMES = ['blue', 'light'] as const           // blue = 默认
type Theme = typeof THEMES[number]
setTheme(t):  documentElement.dataset.theme = (t === 'blue' ? '' : t)
              localStorage.setItem('theme', t)
// persist() 预留服务器同步壳（system.json，仿 locale.persist），本轮不接
```

- **持久化：localStorage 先行**（`localStorage['theme']`），服务器 `system.json` 同步留作后续（store 预留 `persist()`）。
- **冷启动无闪烁**：在 `main.ts` `app.mount()` **之前**读 `localStorage['theme']` 并设 `documentElement.dataset.theme`（早于首帧）。可另加一小段内联脚本于 `index.html` `<head>` 兜底防闪（可选）。

## 7. 切换 UI

- 新建 `src/home/components/ThemeToggle.vue`：一个 `.bar-btn`（◐ 图标），点击弹小浮层（复用 `reka-ui` Popover 或轻量自绘），两项：**白色 / 蓝色**，当前项打勾；选择即调 `themeStore.setTheme`。
- 挂到 `HomeTopbar.vue` 的 `.status` 区（搜索/添加/编辑旁）。
- i18n 新增键：`themeToggle` / `themeLight` / `themeBlue`（`en_us` + `zh_cn` 双份，过 `i18n` parity 测试）。

## 8. 留档产物（约定要能长期约束后续开发）

1. **`NimoOS-New-UI/CLAUDE.md`（新建，自动加载）** —— 写入强约束：New-UI 一切颜色走 theme token，禁止硬编码 hex；新语义须加 token；例外仅限 `.ic-*` 与第三方库主题；详见 `docs/THEMING.md`。（此文件在本目录工作时被 Claude Code 自动注入，保证后续会话遵守。）
2. **`docs/THEMING.md`（新建）** —— 完整 token 目录（每个 token 的含义 + 蓝/白两套值）、加新主题的步骤、加新语义 token 的步骤、例外清单。作为开发者与 AI 的权威参考。
3. **本 spec** —— 设计与决策记录。
4. **README.md** —— "开发"节加一句"配色约定"指向 `docs/THEMING.md`。

## 9. 验证

- `pnpm exec vue-tsc --noEmit` 通过。
- `pnpm exec vitest run` 全绿（含 i18n parity、既有 viewer 测试；`ThemeToggle` + `theme` store 补测）。
- `./scripts/deploy.sh` 后真机 `http://192.168.1.143/#/…`：白色、蓝色各切一遍，逐屏扫（主页/Dock/小组件/文件区/预览器/所有弹窗/登录/Welcome），确认白色模式无深色残留、蓝色模式与现状一致。

## 10. 非目标 / YAGNI

- 不做第三套主题、不做自定义 accent 取色器（架构已为其留口，但本轮不实现）。
- 不做服务器端主题同步（`persist()` 留壳）。
- 不重命名 token 到语义体系（保留现有变量名，避免全站 churn）。
- 不动 `.ic-*` app 图标配色（品牌识别，故意保留）。
- 不跟随系统 `prefers-color-scheme`（用户显式选择优先；可作后续增强）。

## 附录：架构方案对比

| 方案 | 做法 | 取舍 |
|---|---|---|
| **A ✅ 选定** | 保留变量名 + 加 `[data-theme=light]` 覆盖块 + 收编硬编码 | 改动最小、契合"往 documentElement 写变量"现有约定、可扩展 |
| B | 重命名为语义 token 体系，两套主题映射 | 更规整但全站 churn 巨大，YAGNI |
| C | 两套独立 CSS 文件按 class 切 | 重复维护两份，淘汰 |
