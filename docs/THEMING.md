# NimoOS-New-UI 配色主题参考（Theming）

本文件是 New-UI（Vue 3 + TS + Vite，挂载于 `/app/`）**配色系统的权威参考**。它记录一套
可切换的颜色 token 体系，以及「一切可见颜色必须走 token」这条贯穿后续开发的约定。

- 源代码真相：`src/styles/theme.css`（token 定义）。本文的「蓝色（现值）」列逐条对应该文件
  `:root` 块的**当前实际值**；改 `theme.css` 后须同步本表。
- 设计依据：`docs/superpowers/specs/2026-07-10-new-ui-theme-system-design.md`（下称「spec」）。

---

## 0. 约定（第一位，必须遵守）★

> **New-UI 里一切可见颜色必须来自 theme token（`var(--…)`），禁止在组件/样式里写死
> `#hex` / `rgb()` / `rgba()` / 具名色（`white`、`red` 等）。**

- 「留空成 token」的含义：写样式时颜色位置一律填 `var(--card-bg)` / `var(--fg)` /
  `var(--accent)` 这类变量，其实际值由**当前主题**决定。组件不关心自己是蓝色还是白色。
- 现有 token 表达不了某个**新语义**（例如某种警示色）时，**新增一个语义 token**
  （见 §5），并在**每一套主题块里都给它一个值**——绝不就地写死一个字面色。
- **三类例外**（有意为之，非历史残留，代码里须有注释标明）：
  1. `theme.css` 的 `.ic-*` app 图标渐变——**品牌识别色，皮肤无关**，两套主题都原样保留。
  2. 第三方组件内部无法 token 化的颜色（如 CodeMirror 编辑器主题）——走该库自身的主题机制。
  3. **数据可视化分类色板**（如人物地点页 `PLACE_PALETTE`）——同一视图上要互相区分的
     数据系列颜色，与主题皮肤无关，值放 `.ts` 而非 `theme.css`（不造一次性 token）。

  这三类是「刻意跳过 token」，不是「忘了 token 化」。完整例外清单见 §6。
- 落地保障：`NimoOS-New-UI/CLAUDE.md` 写入同一强约束（自动注入后续会话）；本文件
  提供完整 token 目录，作为开发者与 AI 的查阅入口。

---

## 1. 切换机制

主题通过**根节点 `document.documentElement` 上的 `data-theme` 属性**整块切换，变量名不变、
组件零改动：

| 主题 | 选择器 | 说明 |
|---|---|---|
| **蓝色 blue**（默认 / 兜底） | `:root { … }` | 现有深色玻璃观感，`theme.css` 原始 `:root` 块 |
| **白色 light**（纸感 paper） | `:root[data-theme="light"] { … }` | 覆盖全部颜色 token，纯米白纸感 |

切换与持久化由 `src/stores/theme.ts` 负责（仿 `src/stores/locale.ts`）：

```
THEMES = ['blue', 'light'] as const          // blue = 默认
setTheme(t):  documentElement.dataset.theme = (t === 'blue' ? '' : t)   // blue 即移除属性，回落 :root
              localStorage.setItem('theme', t)
```

- 选 `blue` 时**移除/置空** `data-theme`，自然回落到 `:root` 默认块。
- 选 `light` 时置 `data-theme="light"`，`:root[data-theme="light"]` 覆盖块生效。
- **冷启动防闪**：`main.ts` 必须在 `app.mount()` **之前**读 `localStorage['theme']` 并写好
  `documentElement.dataset.theme`（早于首帧渲染），避免先渲染默认蓝再跳白的闪烁。
- 这与既有约定一致：`useParallax` / `useGridMeasure` 已经在往 `document.documentElement`
  写 CSS 变量，本机制沿用同一根节点。
- **服务器同步**（`system.json`，仿 `locale.persist`）预留 `persist()` 壳，本轮不接线，
  localStorage 先行。

---

## 2. 完整 Token 目录（蓝 → 白 映射）

白色主题取向：**纯米白纸感**，复用 `SearchDialog.vue` 已验证的调色板
（底 `#f7f5ef`、白卡 `#ffffff`、近黑字 `#1c1b19`、Azure 强调 `#3b5bdb` / `#6e5ae0`、
暖灰描边 `#e7e3d9`）。**无背景光斑、无 backdrop-blur 玻璃**，改用**实色卡片 + 暖色柔影**。

说明：
- 「蓝色（blue）」列 = `theme.css` `:root` 的**精确现值**，改代码须同步此列。
- 「白色（light）」列：spec §4 给出明确值的直接采用；spec 只给规则的、以及 spec 未覆盖的，
  由本文按规则**推导出具体值**并以 **†** 标记——这些是「推导值，实现时可微调」，非最终定案。

### 2.1 基础色

| Token | 用途/含义 | 蓝色（blue，现值） | 白色（light，新值） |
|---|---|---|---|
| `--bg` | 全局底色 | `#1a2138` | `#f7f5ef` |
| `--fg` | 主前景/正文色 | `#ffffff` | `#1c1b19` |
| `--fg-muted` | 次要文字 | `rgba(255,255,255,0.74)` | `#6e6a61` |
| `--fg-faint` | 更弱的提示文字 | `rgba(255,255,255,0.52)` | `#9a958a` |
| `--accent` | 主强调色（Azure） | `#8ab4ff` | `#3b5bdb` |
| `--accent2` | 次强调色（紫） | `#b79bff` | `#6e5ae0` |
| `--good` | 成功/正向色 | `#5fe3b0` | `#15754c` |
| `--on-accent` | 强调色之上的文字 | `#16203a` | `#ffffff` |

### 2.2 品牌渐变

| Token | 用途/含义 | 蓝色（blue，现值） | 白色（light，新值） |
|---|---|---|---|
| `--brand-bg` | 品牌渐变底（Welcome/登录等） | `linear-gradient(150deg, #a8c6ff, #7a98ff 55%, #b79bff)` | `linear-gradient(135deg, #4c6fe8, #6e5ae0)`（Azure，同 SearchDialog `--grad-a/--grad-b`） |
| `--brand-shadow` | 品牌元素投影 | `0 12px 30px rgba(120,150,255,0.45)` | `0 12px 30px rgba(59,91,219,0.30)` **†**（按 accent 重算） |

### 2.3 Chip / 通透按钮

| Token | 用途/含义 | 蓝色（blue，现值） | 白色（light，新值） |
|---|---|---|---|
| `--chip-border` | chip/按钮描边 | `rgba(255,255,255,0.4)` | `#e7e3d9` |
| `--chip-bg` | chip 底 | `linear-gradient(160deg, rgba(255,255,255,0.26), rgba(255,255,255,0.1))` | `#ffffff` |
| `--chip-bg-hi` | chip 悬停底 | `linear-gradient(160deg, rgba(255,255,255,0.36), rgba(255,255,255,0.16))` | `#f2efe7` |
| `--dot` | 分页点（未激活） | `rgba(255,255,255,0.45)` | `rgba(28,27,25,0.35)` **†** |
| `--dot-on` | 分页点（激活） | `#fff` | `#1c1b19` **†**（= `--fg`） |

### 2.4 玻璃卡片 / 浮层

| Token | 用途/含义 | 蓝色（blue，现值） | 白色（light，新值） |
|---|---|---|---|
| `--card-bg` | 悬浮玻璃卡片底 | `linear-gradient(157deg, rgba(255,255,255,0.26), rgba(255,255,255,0.085) 62%)` | `#ffffff`（实色） |
| `--popup-bg` | 深色浮层底（Dialog/ContextMenu 等） | `linear-gradient(157deg, rgba(30,34,52,0.9), rgba(16,19,30,0.95) 62%)` | `#ffffff`（实色） |
| `--card-border` | 卡片描边 | `rgba(255,255,255,0.36)` | `#e7e3d9` |
| `--card-shadow` | 卡片柔投影 | `inset 0 1px 0 rgba(255,255,255,0.6), inset 0 0 0 0.5px rgba(255,255,255,0.12), 0 2px 6px rgba(8,12,28,0.18), 0 26px 50px -20px rgba(6,10,26,0.7)` | `0 2px 6px rgba(60,50,30,0.06), 0 26px 50px -20px rgba(60,50,30,0.3)` **†**（暖色柔影，去掉 inset 白高光） |
| `--card-shadow-hi` | 卡片高亮态投影 | `inset 0 1px 0 rgba(255,255,255,0.7), 0 4px 10px rgba(8,12,28,0.2), 0 40px 70px -22px rgba(6,10,26,0.8)` | `0 4px 10px rgba(60,50,30,0.08), 0 40px 70px -22px rgba(60,50,30,0.34)` **†** |
| `--card-shadow-drag` | 拖拽时更高一档投影 | `inset 0 1px 0 rgba(255,255,255,0.72), 0 10px 20px rgba(8,12,28,0.3), 0 60px 90px -28px rgba(6,10,26,0.85)` | `0 10px 20px rgba(60,50,30,0.12), 0 60px 90px -28px rgba(60,50,30,0.4)` **†** |
| `--clock-bg` | 时钟组件底 | `linear-gradient(157deg, rgba(168,198,255,0.34), rgba(255,255,255,0.08) 60%)` | `linear-gradient(157deg, rgba(59,91,219,0.1), #ffffff 60%)` **†**（Azure 微染白） |
| `--folder-glass` | 文件夹磨砂容器底 | `linear-gradient(157deg, rgba(255,255,255,0.22), rgba(255,255,255,0.075))` | `linear-gradient(157deg, #ffffff, #f4f1e9)` **†** |
| `--folder-mini` | 文件夹内 2×2 缩略底 | `linear-gradient(150deg, rgba(255,255,255,0.62), rgba(255,255,255,0.22))` | `linear-gradient(150deg, #ece7dc, #dcd6c8)` **†** |
| `--toast-bg` | Toast 底 | `linear-gradient(160deg, rgba(255,255,255,0.28), rgba(255,255,255,0.12))` | `#ffffff` **†** |

### 2.5 工具/内嵌面 & 内嵌控件

| Token | 用途/含义 | 蓝色（blue，现值） | 白色（light，新值） |
|---|---|---|---|
| `--tool-bg` | 工具按钮底 | `rgba(255,255,255,0.16)` | `#f0eee8` **†** |
| `--tool-bg-hi` | 工具按钮悬停底 | `rgba(255,255,255,0.3)` | `#e7e3d9` **†** |
| `--inner-bg` | 内嵌面板底 | `rgba(255,255,255,0.12)` | `#f7f5ef` **†** |
| `--inner-bg-hi` | 内嵌面板高亮底 | `rgba(255,255,255,0.22)` | `#f0eee8` **†** |
| `--inner-border` | 内嵌面板描边 | `rgba(255,255,255,0.2)` | `#e7e3d9` |
| `--grid-dot` | 编辑态网格点/虚线 | `rgba(255,255,255,0.17)` | `rgba(28,27,25,0.14)` **†** |

### 2.6 组件专属：环形图 / 迷你图 / AI 光球

| Token | 用途/含义 | 蓝色（blue，现值） | 白色（light，新值） |
|---|---|---|---|
| `--ring-hole` | 环形/甜甜圈图中心孔色 | `rgba(26,33,56,0.55)` | `rgba(255,255,255,0.85)` **†**（= 卡片底色） |
| `--ring-track` | 环形图底轨 | `rgba(255,255,255,0.18)` | `rgba(28,27,25,0.1)` **†** |
| `--spark-fill` | 迷你折线填充 | `rgba(138,180,255,0.3)` | `rgba(59,91,219,0.14)` **†**（按 accent 重算） |
| `--spark-grid` | 迷你图网格线 | `rgba(255,255,255,0.08)` | `rgba(28,27,25,0.06)` **†** |
| `--num-color` | 数值大字色 | `#fff` | `#1c1b19` **†**（= `--fg`） |
| `--orb-core` | AI 光球核心色 | `#2a3566` | `#d9def5` **†**（Azure 微染浅底） |
| `--orb-glow` | AI 光球辉光（`@keyframes pulse` 也用） | `rgba(138,180,255,0.5)` | `rgba(59,91,219,0.4)` **†**（按 accent 重算） |

### 2.7 图标 / 标签 / 文件夹

| Token | 用途/含义 | 蓝色（blue，现值） | 白色（light，新值） |
|---|---|---|---|
| `--folder-bg` | 文件夹图标渐变底 | `linear-gradient(180deg, #8fd0ff, #5a8bf0)` | `linear-gradient(180deg, #a9c2f5, #6e8fe8)` **†**（Azure 化，非 `.ic-*` 品牌图标） |
| `--icon-shadow` | 图标方格投影 | `0 14px 30px -8px rgba(6,10,26,0.6), inset 0 1px 0 rgba(255,255,255,0.4)` | `0 14px 30px -8px rgba(60,50,30,0.22)` **†**（暖色柔影，去 inset 白高光） |
| `--label-color` | 图标标签文字 | `rgba(255,255,255,0.92)` | `rgba(28,27,25,0.92)` **†** |
| `--label-shadow` | 图标标签文字投影 | `0 1px 4px rgba(0,0,0,0.45)` | `none` **†**（纸底不需暗投影） |

### 2.8 Dock / 全部应用

| Token | 用途/含义 | 蓝色（blue，现值） | 白色（light，新值） |
|---|---|---|---|
| `--dock-bg` | Dock 底 | `linear-gradient(160deg, rgba(255,255,255,0.24), rgba(255,255,255,0.09))` | `rgba(255,255,255,0.9)` **†** |
| `--dock-border` | Dock 描边 | `rgba(255,255,255,0.38)` | `#e7e3d9` |
| `--dock-shadow` | Dock 投影 | `inset 0 1px 0 rgba(255,255,255,0.6), 0 30px 60px -18px rgba(6,10,26,0.75)` | `0 30px 60px -18px rgba(60,50,30,0.32)` **†**（暖色柔影，去 inset 白高光） |
| `--all-bg` | 「全部应用」按钮底 | `linear-gradient(160deg, rgba(255,255,255,0.3), rgba(255,255,255,0.12))` | `#f0eee8` **†** |
| `--all-fg` | 「全部应用」前景 | `#fff` | `#1c1b19` **†**（= `--fg`） |
| `--all-border` | 「全部应用」描边 | `rgba(255,255,255,0.4)` | `#e7e3d9` **†** |

### 2.9 浮层 / 背景 / 危险色 / 拖放

| Token | 用途/含义 | 蓝色（blue，现值） | 白色（light，新值） |
|---|---|---|---|
| `--overlay-bg` | 模态遮罩底 | `rgba(20,26,46,0.46)` | `rgba(40,36,28,0.28)` |
| `--remove-bg` | 移除/危险色（删除按钮、bad-size 描边） | `#ff708a` | `#e0466a`（浅底加深保对比） |
| `--drop-bg` | 拖放落点提示底 | `rgba(138,180,255,0.22)` | `rgba(59,91,219,0.12)` **†**（按 accent 重算） |
| `--app-bg` | 主页纵深背景（body 与文件预览浮层共用） | `radial-gradient(62% 52% at 18% 16%, #4a5d92 0%, transparent 60%), radial-gradient(58% 50% at 84% 10%, #6a5aa0 0%, transparent 60%), radial-gradient(64% 58% at 62% 96%, #356f86 0%, transparent 62%), linear-gradient(180deg, #2a3354 0%, #1c2339 58%, #141a2b 100%)` | `#f7f5ef`（纯米白，无 radial） |

### 2.10 模糊 / filter（非颜色，但主题相关）

`--blur` / `--overlay-blur` 是 backdrop-filter 值，语义上属结构量，但**白色纸感主题不用玻璃模糊**，
故 light 块须**降低或去除**它们（否则纸卡上仍有毛玻璃感）。因此它们**随主题变化**，
不属于 §3 的「跨主题共享」结构 token。

| Token | 用途/含义 | 蓝色（blue，现值） | 白色（light，新值） |
|---|---|---|---|
| `--blur` | 通用玻璃 backdrop-filter | `blur(44px) saturate(1.7) brightness(1.08)` | `none` **†**（或最多 `blur(4px)`；纸感建议去除） |
| `--overlay-blur` | 遮罩 backdrop-filter | `blur(50px) saturate(1.5) brightness(1.05)` | `blur(8px)` **†**（大幅降低，或 `none`） |

### 2.11 全局属性 / 滚动条（light 块内需翻转）

以下不是 `var(--…)` token，但白色主题块（或其配套全局规则）里必须一并翻转：

| 项 | 蓝色（blue） | 白色（light） |
|---|---|---|
| `color-scheme`（`:root`） | `dark` | `light`（影响原生控件、默认滚动条外观） |
| 滚动条滑块 `scrollbar-color` / `::-webkit-scrollbar-thumb` | `rgba(255,255,255,0.22)`（浅色滑块贴深底） | `rgba(28,27,25,0.22)` **†**（深色滑块贴浅底） |
| `body::before`（散景光斑层） | 多层 radial 光斑 + `blur(46px)` + 视差动画 | `background: none`（关闭光斑） |
| `body::after`（顶部柔光 + 暗角） | `linear-gradient(...) , radial-gradient(...)` | `background: none`（关闭暗角） |

> 关闭 `body::before/::after` 是白色纸感的关键——纸感不要 bokeh 光斑与暗角。

### 2.12 扩展/语义 token（SearchDialog·MediaViewer 提升为全局）

以下 token 原为 SearchDialog/MediaViewer 的本地调色板，现已提升为全局可用。涵盖卡片、描边、
文字微调、悬停、渐变、语义色（成功/警告/演示/普通/点击）、高光等：

| Token | 用途/含义 | 蓝色（blue，现值） | 白色（light，现值） |
|---|---|---|---|
| `--card` | 卡片/面板底 | `#232a45` | `#ffffff` |
| `--border` | 细描边（略深于分割线） | `rgba(255,255,255,0.14)` | `#e7e3d9` |
| `--fg-subtle` | 极弱文字提示 | `rgba(255,255,255,0.4)` | `#9a958a` |
| `--divider` | 水平/垂直分割线 | `rgba(255,255,255,0.1)` | `rgba(28,27,25,0.08)` |
| `--hover` | 悬停浅底 | `rgba(255,255,255,0.08)` | `rgba(28,27,25,0.045)` |
| `--accent-text` | 强调文字（配文案） | `#a9c6ff` | `#3550c4` |
| `--grad-a` | 渐变左/起点色 | `#7a98ff` | `#4c6fe8` |
| `--grad-b` | 渐变右/终点色 | `#b79bff` | `#6e5ae0` |
| `--album-cover-fallback` | 相册无封面渐变占位（PhotosAlbums/PhotosAlbumDetail 共用） | `linear-gradient(135deg, color-mix(in srgb, var(--accent) 35%, var(--panel-bg)), var(--accent))` | 同公式（两套主题各自的 `--accent`/`--panel-bg`） |
| `--avatar-fallback` | 人物头像三级兜底渐变实底（`PersonAvatar.vue`，SP7-P5；对齐 Vue2 5 处重复的紫渐变，统一成一份 token） | `linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #000))` | `linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #000))`（mix 百分比更高，避免纸感主题的深蓝 accent 糊成近黑） |
| `--accent-soft` | 强调软底（最浅） | `rgba(138,180,255,0.14)` | `rgba(59,91,219,0.11)` |
| `--accent-soft-2` | 强调软底（中浅） | `rgba(138,180,255,0.24)` | `rgba(59,91,219,0.2)` |
| `--accent-soft-bd` | 强调软底描边 | `rgba(138,180,255,0.36)` | `rgba(59,91,219,0.3)` |
| `--place-row-bg` | 地点 rail 选中城市行背景（`PlacesRail.vue`，P6a-T5；Vue2 该视图仅有深色设计，蓝值精确复刻 `photos-places.scss:153`，白值按 accent 家族深→浅收敛惯例约 ×0.83 推导，无原件可照） | `rgba(138,180,255,0.10)` | `rgba(59,91,219,0.08)` **†**（无 Vue2 白色原件，按 accent 家族深→浅收敛惯例推算） |
| `--place-row-border` | 地点 rail 选中城市行边框色（同上，蓝值复刻 `:154`） | `rgba(138,180,255,0.30)` | `rgba(59,91,219,0.25)` **†**（同上，无原件，按惯例推算） |
| `--place-thumb-active` | 地点 rail 选中城市行缩略图遮罩（同上，蓝值复刻 `:163`） | `rgba(138,180,255,0.18)` | `rgba(59,91,219,0.15)` **†**（同上，无原件，按惯例推算） |
| `--pin-bg` | 地图图钉底色（`PlacesMap.vue`，P6a-T6；精确复刻 Vue2 `photos-places.scss:367` 的 `rgba(var(--accent-rgb),0.16)`） | `rgba(138,180,255,0.16)` | `rgba(59,91,219,0.16)` |
| `--pin-stroke` | 地图图钉描边（同上，复刻 `:368` 的 α=.55） | `rgba(138,180,255,0.55)` | `rgba(59,91,219,0.55)` |
| `--pin-active-bg` | 激活图钉/簇图钉底色（同上，复刻 `:378`/`:401` 的 α=.30——Vue2 两处恰好同值，合并成一个 token） | `rgba(138,180,255,0.30)` | `rgba(59,91,219,0.30)` |
| `--pin-pulse` | 激活图钉的扩散脉冲环（同上，复刻 `:413` 的 α=.25） | `rgba(138,180,255,0.25)` | `rgba(59,91,219,0.25)` |
| `--pin-cluster-hover-bg` | 簇图钉悬停底色（同上，复刻 `:406` 的 α=.42） | `rgba(138,180,255,0.42)` | `rgba(59,91,219,0.42)` |
| `--pin-glow` | 图钉悬停外发光（同上，复刻 `:365` 的 α=.7） | `rgba(138,180,255,0.7)` | `rgba(59,91,219,0.7)` |
| `--pin-cluster-stroke` | 簇图钉描边（同上；Vue2 `:402` 原值是比 accent 更浅的淡紫 `rgba(196,184,255,0.85)`，这里 RGB 改取本仓 `--accent-text`——语义正是"比 accent 更浅/更可读的 accent 色"，alpha 精确复刻原值 0.85） | `rgba(169,198,255,0.85)` | `rgba(53,80,196,0.85)` |
| `--place-current-trip` | 当前行程标记色（同上，复刻 `:375` 的 `#34c759`，两套主题同值——不用 `--good`，那是本仓的青绿 `#5fe3b0`/`#15754c`，与 iOS 绿是近似而非精确复刻，已因此返工过一次） | `#34c759` | `#34c759` |
| `--map-dot-bg-fallback` | 地图陆地点阵底色的 CSS 回落值（`PlacesMap.vue`，P6a-T6 评审 I1；精确复刻 Vue2 `photos-places.scss:347` 的字面量 `rgba(255,255,255,0.10)`，theme-invariant——Vue2 最常见的两条路径`dotBg` 都是 `null`，即都吃这条 CSS 回落，不是罕见分支。不能用 `--fg-faint` 顶替：深色档是 `rgba(255,255,255,0.52)`，会亮到盖过已访问点；浅色档是不透明暖灰 `#9a958a`，铺在地图黑底画布上会变成一块不透明色块） | `rgba(255,255,255,0.10)` | `rgba(255,255,255,0.10)` |
| `--sem-bg` | 语义色/成功 背 | `rgba(95,227,176,0.14)` | `#e7f5ee` |
| `--sem-fg` | 语义色/成功 文 | `#5fe3b0` | `#15754c` |
| `--sem-bd` | 语义色/成功 描边 | `rgba(95,227,176,0.35)` | `#b7e2cc` |
| `--dem-bg` | 演示色 背 | `rgba(240,200,120,0.14)` | `#fbefd9` |
| `--dem-fg` | 演示色 文 | `#f0c878` | `#92600c` |
| `--dem-bd` | 演示色 描边 | `rgba(240,200,120,0.32)` | `#f0d9a8` |
| `--nrm-bg` | 普通/中性 背 | `rgba(255,255,255,0.08)` | `#f0eee8` |
| `--nrm-fg` | 普通/中性 文 | `rgba(255,255,255,0.7)` | `#5c584f` |
| `--nrm-bd` | 普通/中性 描边 | `rgba(255,255,255,0.16)` | `#e0dcd1` |
| `--hit-bg` | 点击/高亮 背 | `rgba(255,224,138,0.3)` | `#fce8a6` |
| `--hit-fg` | 点击/高亮 文 | `#ffe08a` | `#5a4a12` |
| `--success` | 成功指示色 | `#5fe3b0` | `#15754c` |
| `--hl-star` | 高光星标（特殊标记） | `#e8c06a` | `#c9992f` |
| `--warn-fg` | 警告/降级语义 文（人脸识别关闭、Photos AI 后端离线横幅，SP7-P5；对齐 Vue2 `#FF9F0A`，浅色主题按 `--dem-fg` 惯例压暗保对比度） | `#ff9f0a` | `#96610a` |
| `--warn-bg` | 警告/降级语义 背 | `rgba(255,159,10,0.08)` | `#fdf3e2` |
| `--warn-border` | 警告/降级语义 描边 | `rgba(255,159,10,0.32)` | `#f0d7a6` |
| `--remove-fg` | 危险/删除态文字（区别于 `--remove-bg`） | `#ff8a8a` | `#c0392b` |
| `--drop-bad` | 非法拖放落点提示底 | `rgba(255, 80, 100, 0.12)` | `rgba(224, 70, 106, 0.12)` |
| `--skeleton-bg` | 骨架屏/加载占位底 | `rgba(255, 255, 255, 0.06)` | `rgba(28, 27, 25, 0.05)` |
| `--spk-1` | 说话人配色 1（蓝）；音频转录/波形，最多 5 色循环 | `oklch(0.74 0.13 250)` | `oklch(0.52 0.15 255)` |
| `--spk-2` | 说话人配色 2（紫） | `oklch(0.72 0.13 305)` | `oklch(0.50 0.16 305)` |
| `--spk-3` | 说话人配色 3（青） | `oklch(0.77 0.12 190)` | `oklch(0.53 0.12 200)` |
| `--spk-4` | 说话人配色 4（珊瑚） | `oklch(0.73 0.15 18)` | `oklch(0.55 0.18 22)` |
| `--spk-5` | 说话人配色 5（绿） | `oklch(0.79 0.14 150)` | `oklch(0.52 0.15 150)` |
| `--wave-none` | 波形：静场/无人声竖条 | `var(--fg-subtle)` | `var(--fg-subtle)` |
| `--wave-dim` | 波形：过滤时被弱化的竖条 | `var(--fg-faint)` | `var(--fg-faint)` |

> `--hl-bg`/`--hl-bd`/`--hl-fg`（原高光背/描边/文字）已随 `feat/audio-speaker-waveform` 分支的金色高光背景退役并从 `theme.css` 移除，仅 `--hl-star` 仍有消费者，保留。

> 补充：`ClockWidget` 表盘面/刻度改用 `--spark-grid`/`--fg-faint`/`--fg-muted`;`ImageViewer` 悬浮工具条用 `--popup-bg`(蓝=深玻璃、白=白卡),避免单主题下失联。散落硬编码色收编时，`var(--token, <fallback>)` 形式视为合规(token 驱动主题);裸字面量须走 token 或加 `/* theme-exception */`,由 `src/styles/color-guard.test.ts` 守卫。

---

## 3. 跨主题共享的结构 token（只在 `:root`，不随主题覆盖）

以下是**非颜色**的排版/几何/动效量，两套主题**共用同一值**，**只定义在 `:root`**，
`[data-theme=…]` 覆盖块里**不要**重复它们：

| Token | 值 | 含义 |
|---|---|---|
| `--font` | `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif` | 主字体栈 |
| `--num-font` | `system-ui, -apple-system, "Segoe UI", sans-serif` | 数字字体栈 |
| `--stroke` | `1.9` | 图标线宽 |
| `--ease` | `cubic-bezier(0.16, 1, 0.3, 1)` | 通用缓动 |
| `--gap` | `clamp(12px, 1vw, 16px)` | 通用间距 |
| `--radius` | `28px` | 大圆角 |
| `--radius-sm` | `18px` | 小圆角 |
| `--icon-radius` | `22px` | 图标方格圆角 |
| `--chip-radius` | `999px` | chip 圆角（胶囊） |
| `--dock-radius` | `32px` | Dock 圆角 |
| `--app-size` | `64px` | 图标基准尺寸 |
| `--clock-weight` | `250` | 时钟字重 |
| `--card-hover` | `translateY(-6px) scale(1.012)` | 卡片悬停 transform |

> 注意：`--blur` / `--overlay-blur` 虽也是「非颜色」量，但**不属于共享**——它们随主题变化，
> 见 §2.10。

---

## 4. 如何新增一整套主题

以加一套「xxx」主题为例，**组件无需任何改动**：

1. 在 `src/styles/theme.css` 末尾加一个覆盖块，**逐条覆盖 §2 里的每一个颜色 token**
   （§2.1–§2.10 全部，含滚动条/`color-scheme`/`body::before/after` 相关）：
   ```css
   :root[data-theme="xxx"] {
     --bg: …; --fg: …; --accent: …; /* …全部颜色 token… */
   }
   ```
   结构 token（§3）**不要**写进来（沿用 `:root`）。
2. 在 `src/stores/theme.ts` 的 `THEMES` 数组里加 `'xxx'`。
3. 在 `ThemeToggle.vue` 的选项列表加一项 `xxx`。
4. i18n 加一个键（如 `themeXxx`），`en_us` + `zh_cn` 双份（过 i18n parity 测试）。

漏覆盖某个颜色 token 会**回落到 `:root` 的蓝色值**，导致该处在新主题下变蓝——所以第 1 步
必须以本文 §2 目录逐条核对，确保**无遗漏**。

---

## 5. 如何新增一个语义 token

当既有 token 无法表达某个新语义时（例如需要一种独立的「警告黄」）：

1. 起一个清晰的语义名（如 `--warn`、`--warn-bg`），避免直接叫颜色名。
2. 在 `:root`（蓝色）**和每一个 `[data-theme=…]` 覆盖块**里都给它一个值——一套都不能漏。
3. 在本文 §2 相应分组补一行。
4. 组件里用 `var(--warn)` 消费，**绝不**就地写 `#f5a623`。

---

## 6. 例外清单（刻意跳过 token，须有代码注释）

以下颜色**故意不走主题 token**，是有意设计而非残留。每处代码须有注释说明原因：

| 例外 | 位置 | 为何是有意例外 |
|---|---|---|
| `.ic-*` app 图标渐变（`.ic-files` / `.ic-photos` / `.ic-video` / `.ic-music` / `.ic-ai` / `.ic-backup` / `.ic-download` / `.ic-docker` / `.ic-vm` / `.ic-share` / `.ic-search` / `.ic-settings` / `.ic-users` / `.ic-storage` / `.ic-appstore` / `.ic-terminal` 等） | `theme.css` §「应用图标配色」 | **品牌识别色，皮肤无关**——文件蓝、照片虹彩、音乐粉紫等是产品视觉资产，两套主题都保持一致，不应随皮肤变。用户靠颜色识别应用。 |
| 第三方库内部主题（如 CodeMirror 编辑器配色） | 引入该库的组件 | 库有自己的主题机制，颜色由库内部管理，无法用 CSS 变量穿透。应走该库自身的 theme 配置，而非硬塞 token。 |
| `PLACE_PALETTE`（7 色循环：`#6E5BFF`/`#FF9AC2`/`#5AC8FA`/`#FFD60A`/`#34C759`/`#FF9F0A`/`#FF6B5C`） | `src/photos/util/peopleView.ts`（人物详情页地点 tab：迷你地图点 + 图例 + 地点卡片，消费于 `PersonPlacesTab.vue`） | **数据可视化分类色板**，不是主题皮肤色——同一张地图/图例上要把互不相同的地点互相区分开，颜色语义是"第几个数据系列"而不是"主题强调色"，两套主题下都必须保持同一组值不变。值放 `.ts`（不是 `theme.css`）刻意避免为 7 个数据系列各造一个一次性 token。 |

注：`.ic-ai` 与 `.ic-all` / `.ic-app` 例外地**引用了** token（`--accent` / `--accent2` /
`--orb-core` / `--all-bg` 等）——这部分仍随主题走，只有各图标的**固定品牌渐变**是例外。

补充：`.grid-item .remove`、`.resize-handle::after`、`.media-play` 等全局规则里仍有个别
`#fff` / `rgba(0,0,0,…)` 字面色（阴影、纯白箭头等中性值）。按 §0 约定，这些在收编硬编码色时
应逐步 token 化；若判定为主题无关的纯中性值而保留，须在该行加注释说明。

---

## 7. 相关文件

- `src/styles/theme.css` —— token 定义（本文的真相源）。
- `src/stores/theme.ts` —— 切换 + 持久化 store（`setTheme` / `THEMES`）。
- `src/main.ts` —— 冷启动 mount 前应用 `data-theme` 防闪。
- `src/home/components/ThemeToggle.vue` —— 顶栏切换 UI。
- `src/home/components/SearchDialog.vue` —— 白色纸感调色板来源（`#f7f5ef` / `#ffffff` /
  `#1c1b19` / `#e7e3d9` / `#3b5bdb` / `#6e5ae0`）。
- `docs/superpowers/specs/2026-07-10-new-ui-theme-system-design.md` —— 设计与决策记录。

---

## 8. 浮层层级（z-index）阶梯 ★

> **硬约束：toast 必须高于全仓所有模态遮罩。**

遮罩几乎都带 `backdrop-filter: var(--overlay-blur)`，任何被压在遮罩下方的浮层不是"看起来
偏灰"，而是**完全读不到**。因此层级不是随手取值，按下表落座：

| 层 | z-index | 例子 |
|---|---|---|
| 页内浮层 / 角标 / 悬浮控件 | 1 – 50 | 瓦片角标、hero 下拉菜单（20）、区内下拉（20）、侧栏抽屉遮罩（150） |
| 局部固定条 | 60 – 150 | 上传面板（70）、选择态浮动条（150） |
| 区级弹窗遮罩 + 面板 | 200 – 230 | `.mrd-overlay`（200）、`.pd-scrim` / `.cad-overlay`（220） |
| 通用弹窗遮罩 + 面板 | 1000 / 1001 | `ui-dialog-overlay`（1000）、`Dialog` / `AlertDialog` 面板（1001） |
| **Toast** | **1100** | `AppToast.vue` `.toast-stack` |

新增浮层时：**不要**在 1100 及以上落座，除非它确实比 toast 更该被看见（目前没有这种东西）。
`src/components/AppToast.zIndex.test.ts` 会把这条约定钉死——它直接读各组件
`<style>` 原文比较数值，新加的遮罩若高过 toast，测试即红。

---
