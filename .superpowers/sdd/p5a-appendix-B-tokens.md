## 附录 B:`.knowledge-app` token 映射表(偏离 K2)

**规则**:全局 `theme.css` 有同语义 token 的 → 写 `var(--全局token)`(浅色档才有意义,故只在浅色档这么写);没有同语义的 → 落字面值并在行尾注释出处。暗色档一律落 AI `tokens.scss` 暗色块的字面值(它是本仓已有的暗色调色板)。**结构量(`--r-*`/`--font-*`/`--shadow-*`)两档共享,只写在基础块。**

### 基础块 `.knowledge-app`(= 暗色档,New-UI 默认 `<html>` 无 `data-theme`)

| token | 值 | 出处 |
|---|---|---|
| `--bg-app` / `--bg-canvas` | `#1C1C1E` | AI tokens 暗色 |
| `--bg-elevated` | `#242426` | 同上 |
| `--bg-sunken` | `#161617` | 同上 |
| `--bg-chip` | `#2A2A2C` | 同上 |
| `--glass-strong` / `--glass-medium` / `--glass-weak` | `rgba(28,28,30,0.82)` / `0.6` / `0.45` | 同上 |
| `--text-primary` | `#E9E7E3` | 同上 |
| `--text-secondary` | `#A3A09A` | 同上 |
| `--text-tertiary` | `#6E6C68` | 同上 |
| `--text-quaternary` | `#4D4B48` | 同上 |
| `--text-on-accent` | `#ffffff` | 同上 |
| `--accent` | `#5E97F2` | 同上 |
| `--accent-hover` | `#7AABF5` | 同上 |
| `--accent-soft` | `rgba(94,151,242,0.14)` | 同上 |
| `--accent-softer` | `rgba(94,151,242,0.10)` | 同上 |
| `--success` | `#4FB870` | 同上 |
| `--warning` | `#E0A53B` | 同上 |
| `--danger` | `#F0776B` | 同上 |
| `--purple` | `#AF52DE` | AI tokens(两档同值) |
| `--pink` | `#FF2D55` | 同上 |
| `--teal` | `#30B0C7` | 同上 |
| `--line` | `#2E2E31` | AI tokens 暗色 |
| `--line-strong` | `#3A3A3D` | 同上 |
| `--line-faint` | `#262628` | 同上 |
| `--ly-wiki` / `-soft` / `-line` | `oklch(0.78 0.11 80)` / `oklch(0.78 0.11 80 / 0.15)` / `oklch(0.78 0.11 80 / 0.35)` | **蓝本 `:2445` 暗色值**(三层身份色,与 `.ic-*` 品牌渐变同类,两档各一份) |
| `--ly-vec` / `-soft` / `-line` | `oklch(0.76 0.10 210)` / `… / 0.15` / `… / 0.35` | 蓝本 `:2446` |
| `--ly-note` / `-soft` / `-line` | `oklch(0.76 0.12 300)` / `… / 0.15` / `… / 0.35` | 蓝本 `:2447` |
| `--r-xs…--r-pill` | `6px/10px/14px/18px/24px/32px/999px` | 蓝本原值(与 AI tokens 一致) |
| `--shadow-xs/sm/md/lg` | AI tokens 的四条(`rgba(40,35,25,…)` 暖投影) | AI tokens `:107-110` |
| `--font-sans` / `--font-mono` | 蓝本原值(与 AI tokens 逐字相同) | 蓝本 `:56-57` |
| `--grad-iri` / `--grad-iri-soft` | AI tokens `:119-120` 的两条 | 与 Agent 区同族 |

### 浅色档 `:root[data-theme="light"] .knowledge-app`

| token | 值 | 说明 |
|---|---|---|
| `--bg-app` / `--bg-canvas` | `var(--bg)` | 主页浅色纸底 `#f7f5ef` |
| `--bg-elevated` | `var(--card-bg)` | `#ffffff` |
| `--bg-sunken` | `var(--tool-bg)` | `#f0eee8`,比 canvas 深一档 |
| `--bg-chip` | `var(--tool-bg-hi)` | `#e7e3d9`,再深一档 |
| `--glass-strong` / `--glass-medium` / `--glass-weak` | `rgba(247,245,239,0.82)` / `0.6` / `0.45` | `--bg` 的 RGB 加透明;全局无 glass 语义 |
| `--text-primary` | `var(--fg)` | |
| `--text-secondary` | `var(--fg-muted)` | |
| `--text-tertiary` | `var(--fg-faint)` | |
| `--text-quaternary` | `#BCB8AD` | 全局只有三档文字;取 AI tokens 浅色第四档(同族暖中性) |
| `--text-on-accent` | `var(--on-accent)` | |
| `--accent` | `var(--accent)` | `#3b5bdb` |
| `--accent-hover` | `var(--accent-text)` | `#3550c4`,全局的"更深强调"档 |
| `--accent-soft` | `var(--accent-soft)` | `rgba(59,91,219,0.11)` |
| `--accent-softer` | `rgba(59, 91, 219, 0.06)` | 全局最淡档是 0.11,蓝本要 0.06 |
| `--success` | `var(--success)` | `#15754c` |
| `--warning` | `var(--toast-warn-fg)` | `#92600c`(全局无 `--warning`,这是它的警告前景色) |
| `--danger` | `var(--toast-danger-fg)` | `#c0392b`(同上) |
| `--purple` / `--pink` / `--teal` | `#AF52DE` / `#FF2D55` / `#30B0C7` | 全局无;取 AI tokens 浅色值 |
| `--line` | `var(--card-border)` | `#e7e3d9` |
| `--line-strong` | `#D8D3C7` | 全局无 strong 档;AI tokens 浅色值 |
| `--line-faint` | `#EEEBE3` | 同上 |
| `--ly-wiki` / `-soft` / `-line` | `oklch(0.60 0.12 75)` / `oklch(0.60 0.12 75 / 0.11)` / `oklch(0.60 0.12 75 / 0.32)` | **蓝本 `:2287` 浅色值** |
| `--ly-vec` / `-soft` / `-line` | `oklch(0.56 0.11 210)` / `… / 0.11` / `… / 0.32` | 蓝本 `:2288` |
| `--ly-note` / `-soft` / `-line` | `oklch(0.55 0.13 300)` / `… / 0.11` / `… / 0.32` | 蓝本 `:2289` |

### 规则段落里的裸色 → token 对照(T4/T11 用)

蓝本规则里出现的裸色一律按语义换成上表的 token 的**透明变体 token**,New-UI 已有的直接用:
`rgba(52,199,89,0.1x)` → `var(--success-soft)` · `rgba(52,199,89,0.2x)` → `var(--success-soft-border)` ·
`rgba(255,59,48,0.0x)` → `var(--danger-soft-faint)` · `rgba(255,59,48,0.1x)` → `var(--danger-soft)` ·
`rgba(255,59,48,0.2x~0.3x)` → `var(--danger-soft-border)` · `rgba(255,149,0,0.1x)` → `var(--warning-soft)` ·
`rgba(255,149,0,0.2x~0.3x)` → `var(--warning-soft-border)` · `rgba(175,82,222,0.1x)` → `var(--purple-soft)` ·
`rgba(0,122,255,0.2x)` → ⚠️ **`--accent-soft-2` 只存在于全局 `theme.css`(`:60` 暗色 `rgba(138,180,255,0.24)` / `:275` 浅色 `rgba(59,91,219,0.2)`),AI `tokens.scss` 里没有** —— 而 `.knowledge-app` 的 token 声明层是自成一档的,`var(--accent-soft-2)` 在两档里都能解析到全局值(知识库跟随全局主题,这是本期唯一能直接借全局 token 的好处)。**可以直接用 `var(--accent-soft-2)`,不需要新增 token,也不要退回 `--accent-soft`(透明度差一倍)。** ·
`#1f9c47`/`#5BD876` → `var(--success)` · `#d8362b` → `var(--danger)` · `#9a3fd0` → `var(--purple)` ·
`white`/`#fff`(前景)→ `var(--text-on-accent)` · `rgba(255,255,255,0.1~0.2)`(暗色下的浅底)→ `var(--bg-chip)` ·
`rgba(15,20,30,0.32)`(遮罩)→ `var(--modal-scrim)`。
**表里没有的、或换完视觉明显不对的 → 停下写 `NEEDS_CONTEXT`,不许自己发明新 token。**

---

