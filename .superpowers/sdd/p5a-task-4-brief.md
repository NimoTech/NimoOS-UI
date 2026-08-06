## Task 4: `knowledge.scss` —— token 声明层 + 壳段 + keyframes

**Files:**
- Create: `src/ai/styles/knowledge.scss`

**Interfaces:**
- Produces:`.knowledge-app` 作用域内的全套 token(§附录 B)+ 壳的 `.k-rail*` / `.k-main` / `.k-topbar*` / `.k-banner*` / `.k-mobile-tab*` / `.k-btn` / `.k-scroll*` / `.k-badge*` / `.k-skel` 等类;`@keyframes k-pulse` / `k2pulse` / `k2spin` 等全局关键帧。

- [ ] **Step 1: 读蓝本对应段**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git show main:src/views/AI/Knowledge/styles/knowledge.scss | sed -n '1,58p'      # 头注释 + token 块
git show main:src/views/AI/Knowledge/styles/knowledge.scss | sed -n '59,1509p'   # .knowledge-app 壳 + 通用件
git show main:src/views/AI/Knowledge/styles/knowledge.scss | sed -n '1510,1539p' # 全局 keyframes
```
> `:59-1509` 那一大段里混着后续批次才用到的类(表格、抽屉、笔记、Wiki…)。**切档判据不靠感觉 —— 照 §附录 D 的白名单**:本任务只搬 D.1 那 32 个 `k-*` 类 + D.3 的修饰类,外加 `.knowledge-app` 自身的布局(`:59` 起那几行 `display:grid` 等)。**白名单以外的一律不搬**,文件末尾留一行注释 `/* P5b–P5f 的段落按 Vue2 原序续写在此之后 */`。
> **`.k-toast` / `.k-toast-ico` 两段不搬**(偏离 K3)。
> 白名单里某个类在蓝本里带 `:hover` / `[data-*]` / `@media` 变体时,**变体一起搬**(它们是同一个类的组成部分)。若某条规则同时命中白名单类与非白名单类(如 `.k-btn, .k-filt-select { … }`),**拆成两条,只留白名单那半**,并在原处注释 `/* 另一半随 P5b 的 .k-filt-* 段落补 */`。

- [ ] **Step 2: 写 token 声明层**

严格照 **§附录 B** 的映射表逐条写。结构:
```scss
/* 1:1 移植自 Vue2 src/views/AI/Knowledge/styles/knowledge.scss。
   【偏离 K2 —— 主题】蓝本在 .knowledge-app 里自带一整套冷蓝/oklch token
   (--accent:#007AFF 等),且暗色块写作 `[data-theme="dark"] .knowledge-app`,
   而 Vue2 只有 .agent-app 容器带 data-theme、New-UI 的 <html> 只会是无属性
   (默认暗)或 data-theme="light" —— 那条选择器两边都永不命中,知识库在 Vue2
   实际只有浅色一套。用户 2026-07-31 拍板:浅色取全局主页那套、暗色取 AI 区
   那套,跟随 <html> 全局主题。故 token 值全部重写,映射表见
   plans/2026-07-31-vue3-migration-sp8-p5a-knowledge-shell.md 附录 B。

   【为什么不声明 color-scheme】.agent-app 必须自己声明(它与全局主题可以不同步,
   见 tokens.scss:33-38),而 .knowledge-app 跟随全局主题 → 继承 :root 的
   color-scheme 天然正确,再声明是多余的。

   【整档移植件豁免】与 settings-styles.scss / sk-shared.scss 同类,已在
   tokens.scss 头部例外清单登记:token 声明层里的色字面量是本作用域的调色板
   定义,不是"该用 token 的地方写死了颜色"。**除 token 声明层外,本档其余
   任何位置不许出现色字面量。** */

/* ===== 暗色档(New-UI 默认:<html> 无 data-theme)===== */
.knowledge-app { /* …附录 B「暗色档」列… */ }

/* ===== 浅色档 ===== */
:root[data-theme="light"] .knowledge-app { /* …附录 B「浅色档」列… */ }
```

- [ ] **Step 3: 搬壳样式与 keyframes**

规则:
- 结构量(尺寸/间距/圆角/字号/`grid-template`/`transition`)**逐字照抄**
- 颜色一律 `var(--…)`;蓝本里已经是 `var(--…)` 的**原样保留**(token 名不变,只是值来源换了)
- 蓝本壳段里若出现裸色(如 `rgba(255,59,48,0.12)`),按 §附录 B 末尾的「裸色 → token」对照处理;**需要新 token 就停下写 `NEEDS_CONTEXT`,不许自己发明**
- 全局 keyframes 放文件末尾,名字照抄(`k-pulse`/`k2pulse`/`k2spin` 等),**不许加前缀**(蓝本模板里 `animation: k-pulse …` 引用它们)

- [ ] **Step 4: 逐行色扫(本档无自动守卫)**

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|oklch\(|\b(white|black|red|green|blue|orange|gray|grey)\b' \
  src/ai/styles/knowledge.scss
```
预期:命中**只出现在两个 token 声明块内**(行号区间要在报告里贴出来)。声明块之外一处都不许有。

- [ ] **Step 5: 三门**

`knowledge.scss` 本任务还没有人 import → `pnpm build` 不会打包它,但 `pnpm test`/`tsc` 必须仍绿(303 文件 + T3 的 1 = 304 文件)。

- [ ] **Step 6: 提交**

```bash
git add src/ai/styles/knowledge.scss
git commit -m "feat(knowledge): SP8-P5a knowledge.scss token 映射层 + 壳段"
```

---


---

# 附 1:附录 B —— `.knowledge-app` token 映射表(偏离 K2)

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


---

# 附 2:附录 D —— CSS 类白名单(本任务的切档判据,只做 D.1 + D.3 属于 T4 的那半)

## 附录 D:CSS 类白名单(T4 / T11 的切档判据)

从蓝本 `KnowledgeLayout.vue` 与 `DashboardView.vue` 的 `<template>` 里程序化抽取(`class="…"` 与 `:class` 里的字面量),**共 98 个 `k*` 类 + 6 个修饰类**。这就是 P5a 需要的全部样式,一个不多一个不少。

### D.1 T4 负责(壳 + 通用原语,32 个)
```
knowledge-app
k-rail  k-rail-head  k-rail-title  k-rail-sub  k-rail-section  k-rail-nav
k-rail-item  k-rail-item-label  k-rail-item-cn  k-rail-item-en
k-rail-svc  k-rail-svc-row  k-rail-svc-dot  k-rail-svc-name  k-rail-svc-meta
k-rail-foot
k-main  k-topbar  k-topbar-title  k-topbar-sub  k-topbar-spacer
k-banner  k-banner-icon
k-mobile-tabs  k-mobile-tab
k-badge  k-badge-dot
k-btn
k-scroll  k-scroll-inner
k-skel
```
**不搬**:`k-toast`、`k-toast-ico`(偏离 K3,改走全局 toast)。

### D.2 T11 负责(仪表盘,65 个)
```
k-suggest-chip
k2-search  k2-search-dots  k2-suggest  k2-suggest-label
k2-sec-head  k2-sec-title  k2-sec-en  k2-sec-link
k2-onboard  k2-onboard-orb  k2-onboard-cta  k2-onboard-layers
k2-ob-layer  k2-ob-name  k2-ob-desc  k2-tag
k2-layers  k2-layer  k2-layer-top  k2-layer-name  k2-layer-name-en  k2-layer-chev
k2-layer-num  k2-layer-bar  k2-layer-sub  k2-layer-desc  k2-drafts
k2-glue  k2-glue-id
k2-roots  k2-root  k2-root-top  k2-root-ico  k2-root-path  k2-root-level
k2-root-badges  k2-root-meta  k2-root-add  k2-roots-off  k2-chip
k2-live  k2-live-top  k2-live-ico  k2-live-title  k2-live-sub
k2-live-grid  k2-live-cell  k2-cell-label
k2-prog  k2-prog-pct  k2-paused-note  k2-cc
k2-qrow  k2-qchip
k2-distill  k2-distill-sub
k2-entries  k2-entry  k2-entry-ico  k2-entry-cn  k2-entry-en  k2-entry-badge
k2-skel-card
```
(含 `k2-*` 64 个 + `k-suggest-chip`)

### D.3 修饰类(跟着各自的基类搬)
`k-btn` 的 `ghost` / `outline` / `primary`(T4)· `k2-layer-num` 里的 `second` / `suffix`(T11)· `k2-live-ico` 里的 `spin`(T11)。
另有一批**属性选择器态**,搬基类时必须一并搬:`[data-active]`(rail 项 / 移动端 tab / `k2-cc` 按钮 / `kw-node`)·`[data-tone]`(`k-badge` / `k-badge-dot` / `k-banner` / `k2-chip` / `k2-entry-ico` / `k2-entry-badge` / `k2-qchip`)·`[data-state]`(`k-rail-svc-dot` 的 error/paused/running 三态)·`[data-layer]`(`k2-layer` / `k2-ob-layer` 的 wiki/vec/note 三色)·`[data-disabled]`(`k2-entry`)·`[data-ok]`(`k2-live-ico`)。
**这些态是 1:1 的关键**:`data-state="paused"` 的橙点、`data-tone="warn"` 的橙徽标、`data-layer` 的三层配色,漏一个就是可见回归,而单测只查属性值不查颜色。

### D.4 自检命令(T4 / T11 各自跑一次,结果贴报告)
```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
# ① 白名单里的类是否都已落地(应无输出)
for c in <把上面对应小节的类名粘进来>; do
  grep -q "\.$c\b" src/ai/styles/knowledge.scss || echo "MISSING .$c"
done
# ② 是否搬多了(白名单外的 k-/k2- 类)——人工看这份清单,凡不在 D.1/D.2 里的都要删回
grep -oE '\.k2?-[a-z0-9-]+' src/ai/styles/knowledge.scss | sort -u
```

