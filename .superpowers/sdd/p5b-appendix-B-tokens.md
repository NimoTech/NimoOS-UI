# P5b 附录 B —— 色值映射表(**scss 32 行 / 39 处 + 模板内联 1 行 / 3 处 = 42 处**)

> **权威源**:蓝本 `git show main:src/views/AI/Knowledge/styles/knowledge.scss`(Vue2 `main`@`7a6ee6b7`,共 2561 行)。
> 本表的每一行号 T0 都 `sed -n '<L>p'` 逐行打开核过,并**独立重扫**了两段的全部色字面量
> (正则 `#[0-9a-fA-F]{3,8}|rgba?\(…\)|(?<![\w-])(white|black|red|green|blue|transparent|currentColor)(?![\w-])`),
> 与计划书 §7 的清单做了双向 diff。**行号一条都没错;错的是「处数」**(见 §B.6)。
>
> 🔴 **计划书 §7 只统计了 `.scss` 里的色字面量,漏掉了蓝本 `.vue` 模板 `style="…"` 属性里的 3 处**
> (评审 2026-08-01 Critical 1 指出)。那 3 处在 **§B.0**,**它们同样是本表的一部分** ——
> T5 必须按 §B.0 落地,不要停下问、更不要就地硬编码。

## 🔴 三条硬约束(违反即停)

1. **表里没有的色字面量 → 停下写 `NEEDS_CONTEXT`,不许自己发明映射。**
   (承 P5a T11 R9 教训:自行发明 `color-mix` 蒙版比例本该先问。)
2. **注释里也不许出现色字面量**(R5),一律改「蓝本 `file:line` + 中文描述」。
   **唯一豁免:下面 B.1 的两个 token 声明块内部**(它就是 token 的定义处)。
3. **禁用 `theme-exception` 逃逸**(豁免会延续到下一个 `;` 或 `}`,连带豁免后面真正的声明)。

## 🔴 F1 —— 「T4 已做 / 承 T11 先例 / 照 T10/T12 先例」全是 **P5a** 的任务号

计划书附录 B 与 §2 里凡出现 `T4` / `T10` / `T11` / `T12`,指的都是 **P5a 的任务编号**,
**不是本期的 T4/T10**。一律读作:「P5a 已经做过,现状就在 `src/ai/styles/knowledge.scss` 里,本期不要重复改」。

**唯一落地判据:下笔前 `grep` 现状文件,已存在即不动。** 例:

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
grep -n "text-on-accent\|accent-soft-2" src/ai/styles/knowledge.scss   # .k-btn.primary 已是 token
grep -n "^\s*--danger-hover\|^\s*--purple-soft\|^\s*--success-soft-border\|^\s*--danger-soft-faint" src/ai/styles/knowledge.scss
```

T0 已代跑:`.k-btn` 基类连 `&.ghost` / `&.outline` / `&.primary` / `&:disabled` **都已在**
`src/ai/styles/knowledge.scss` 的 `.k-btn { … }` 块里(`--text-on-accent`、`--accent-soft-2` 均已到位),
**T2 只在这个既有块内部、`&.primary` 与 `&:disabled` 之间插入 `&.danger`,不要重写整块。**

---

## B.0 🔴 蓝本模板内联 `style=` 里的 3 处色字面量(T5,**计划书整条漏掉**)

**唯一命中点**:`git show main:src/views/AI/Knowledge/QueueView.vue` 的 **`:87`** ——
failed 桶空态的**专属**插画渐变(内联覆盖 `.k-empty-illust` 的基础 `background`):

```html
<div class="k-empty-illust" style="background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5), transparent 60%), linear-gradient(135deg, rgba(52,199,89,0.2), rgba(0,122,255,0.2))">
```

T0 已用脚本把两个蓝本模板的**全部** `style="…"` / `:style="…"` / `color="…"` 逐行列出复核:
**内联色字面量只有这一处**;`IndexedFilesView.vue` **零处**;其余 `style=` 全是布局/尺寸,
其余 `color="…"` 全是 `var(--…)`。**没有第二处**(与评审的结论一致)。

### B.0.1 映射(照 P5a 处理**同一个类**的既有先例派生,别另发明一套)

P5a 搬 `.k-empty-illust` 的**基础**渐变时已经立过先例 —— 现状文件
`src/ai/styles/knowledge.scss:452-467`(蓝本 `knowledge.scss:690-700`),连注释理由都写好了:

```scss
/* 蓝本 :693 是一处白色半透明高光裸值 …… --text-on-accent 在两档都是不透明的纯白色,
   与蓝本这处装饰性高光同源(都是"纯白,半透明叠加"),用 color-mix 在既有 token 上派生出
   等价的透明度,不新增自定义属性、不写死颜色字面量。 */
radial-gradient(circle at 30% 30%, color-mix(in srgb, var(--text-on-accent) 60%, transparent), transparent 60%),
var(--grad-iri-soft);
```

三处的映射(T0 已核,与协调者给的目标一致):

| # | 蓝本原值 | → 映射 | 依据 |
|---|---|---|---|
| ① | `rgba(255,255,255,0.5)` | `color-mix(in srgb, var(--text-on-accent) 50%, transparent)` | **与 P5a 先例逐字同款,只是比例 60% → 50%**(蓝本基础规则 `:694` 是 0.6,这处内联覆盖成 0.5)。`--text-on-accent` 两档都是不透明纯白 |
| ② | `rgba(52,199,89,0.2)` | `color-mix(in srgb, var(--success) 20%, transparent)` | `rgba(52,199,89,·)` 就是蓝本的成功绿 `#34C759`;§B.2/§B.3 已把同族的 `0.12`/`0.22` 归到 `--success-soft`、`#1f9c47` 归到 `--success`。alpha 0.2 没有现成 token,按 ① 的手法在 `--success` 上派生 |
| ③ | `rgba(0,122,255,0.2)` | `color-mix(in srgb, var(--accent) 20%, transparent)` | `rgba(0,122,255,·)` 就是蓝本的强调蓝 `#007AFF`;同上,在 `--accent` 上派生 |

**为什么 ③ 不用 `var(--accent-soft-2)`**(它的浅档正好是 `rgba(59,91,219,0.2)`,看着很像):

1. ②③ 在蓝本里是**同一条 `linear-gradient` 的一对色标,alpha 完全相同(都是 0.2)**。
   `--accent-soft-2` 的两档 alpha **不一样**(暗 `rgba(138,180,255,0.24)` / 浅 `rgba(59,91,219,0.2)`,
   `src/styles/theme.css:60` / `:275`,T0 已核)→ 暗档下会变成「绿 20% / 蓝 24%」,凭空破坏蓝本的对称。
2. `--accent-soft-2` 是**已登记在案的色相错配**(设计 §3 E7:用户 2026-08-01 决定继续挂账),
   拿它当**可见的渐变色标**会把那个已知缺陷放大;§B.2 `:840` 用它只是一层 `box-shadow`,性质不同。
3. 它还是 `knowledgeStyles.test.ts:270-276` 钉死的「不在本档声明、跟随全局解析」例外,
   语义上属于「阴影/焦点环层」,不是「主题实色的透明变体」。

### B.0.2 🔴 落地位置裁定:**留在模板 `style=` 属性里,照抄蓝本结构**

给 T5 一个不用想的答案:

- **不要**把它挪进 `knowledge.scss`。挪进去必然要造一个蓝本没有的新类
  (`.k-empty-illust[data-tone="failed"]` 之类)→ **DOM / class 就不是 1:1 了**,
  还要往白名单里加一个蓝本 scss 里根本不存在的类(同 N10/N13 的坑)。
- P5a 把**基础** `.k-empty-illust` 搬进 scss 是对的,因为**它在蓝本里本来就是 scss 规则**(`:690-700`);
  这一处在蓝本里本来就是**内联属性**。**东西在哪儿就搬到哪儿。**
- 写法:静态 `style="…"` 字符串照抄(**不要**改成 `:style` 对象、**不要**抽成 computed),
  渐变结构 / 角度 `135deg` / 圆心 `circle at 30% 30%` / 停止位 `transparent 60%` **逐字不变**,
  只把三处字面量换成上表右列。行**上方**加一条 Vue 注释:
  `<!-- 蓝本 QueueView.vue:87 的内联渐变;三处裸色按附录 B §B.0 换成 token 派生,渐变结构逐字不变 -->`
  🔴 注释里**不许**写出原始色字面量(R5)。

### B.0.3 必须显式登记的取舍(**别让 T5 / 评审以为是 bug**)

②③ 走的是**主题 token**,所以**暗档渲染值与蓝本的 `rgba(52,199,89,·)` / `rgba(0,122,255,·)` 有微小色相偏移**
(暗档 `--success: #4FB870`、`--accent: #5E97F2`,不是蓝本的 `#34C759` / `#007AFF`)。

**这和 §B.2 已经接受的 `rgba(52,199,89,0.12)` → `var(--success-soft)`、
`rgba(0,122,255,0.1)` → `var(--accent-soft)` 是同一个取舍,不是新问题,也不是回归。**
整个 `.knowledge-app` 的两档 token 映射(偏离 K2)就建立在「按语义换档、不照抄蓝本冷蓝调色板」之上。
评审**不要**按「与蓝本像素不同」报缺陷;要按「语义对不对、两档都可读、渐变结构逐字不变」判。

### B.0.4 🔴 守卫缺口③ —— `color-guard` 不扫模板 `style=` 属性

`src/styles/color-guard.test.ts:44-56` 的 `styleLines()` 对 `.vue` **只取 `<style>` 块**
(正则 `/<style[^>]*>([\s\S]*?)<\/style>/gi`)→ **模板里的 `style="…"` 属性根本不进扫描**;
`knowledgeStyles.test.ts` 只读 `.scss`。**这 3 处色字面量现有守卫一条都抓不到。**
(与已登记的守卫缺口 ①「`/\.k2?-/` 扫不到 `.kn-` 前缀」、②「`color-guard` 不扫 `.scss`」并列。)

**T5 必须自己补一条定向断言把这个盲区堵上**(治理文件 §9 已写成硬要求):

```ts
// 🔴 读源文件一律 node:fs —— 不许用 Vite 的 ?raw(vitest 的 CSSEnablerPlugin 会把样式源
// 整体替换成空串,断言会对空字符串"假通过";先例见 knowledgeStyles.test.ts 头注释 ③)
const src = readFileSync(resolve(__dirname, './QueueView.vue'), 'utf8')
const tmpl = /<template>([\s\S]*?)\n<\/template>/.exec(src)![1]
// 先整段剥掉 var(…) 与 color-mix(…) 的内部(照 color-guard.test.ts:19-41 的 stripVar 同款手法),
// 再扫裸色 —— 否则 color-mix(in srgb, var(--success) 20%, transparent) 里的 `srgb`/token 名不会误伤,
// 但 var(--x, #fff) 这种 fallback 写法会。
const scrubbed = stripFns(tmpl, ['var(', 'color-mix('])
expect(scrubbed).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\s*\(/)
```

- 判据**必须**是「整个 `<template>` 块」而不是只看那一行 —— 否则以后别处再冒出内联色仍然抓不到。
- **必做 RED 探针**:临时把 `color-mix(in srgb, var(--success) 20%, transparent)` 改回
  `rgba(52,199,89,0.2)` → 必须精确报红 → 还原(`git status` 必须干净)。
- T8 的 `IndexedFilesView.vue` **建议照抄同一条断言**(现在是零处内联色,加了就能防未来回归)。

---

## B.1 新 token 的两档声明(**4 个,分派到两个任务**)

声明位置:`.knowledge-app { … }` 基础块(= 暗档)与 `:root[data-theme="light"] .knowledge-app { … }`(= 浅档)。
**这两个块内允许字面量,块外全文零字面量。**

### 🔴 F2 勘误 —— 计划书 §2 T2 第 4 条的枚举是笔误

计划书 T2 第 4 条写「本段用到 `--success-soft-border` / `--purple-soft` / `--danger-hover`,`--danger-soft-faint` 留 T6」。
**T0 按附录 B.2 / B.3 逐行核过,这句枚举把两个 token 的归属写反了:**

- `--purple-soft` 在 B.2(T2 段)里**一处都没有**,只出现在 B.3(T6 段)的 `:1894`。
- `--danger-soft-faint` 在 B.2(T2 段)的 `:1417` 就已经用到,B.3(T6 段)`:1972` 再用一次。

**裁定:「只声明真正用到的」是硬规则,附录 B 的逐行映射表是权威,T2 第 4 条那句枚举是笔误。**
按下表执行:

| token | 在哪个任务声明 | 暗档值(基础块) | 浅档值(`:root[data-theme="light"] .knowledge-app`) | 被哪几行用到 | 值的出处(T0 已逐行核) |
|---|---|---|---|---|---|
| `--success-soft-border` | **T2** | `rgba(79, 184, 112, 0.28)` | `rgba(46, 158, 84, 0.2)` | 蓝本 `:2038`(T2 段) | `src/ai/styles/tokens.scss:307` / `:130` |
| `--danger-hover` | **T2** | `#E35F52` | `#A83226` | 蓝本 `:846`(T2 段) | **全仓无源,本期新造**,见下方注 |
| `--danger-soft-faint` | **T2** | `rgba(240, 119, 107, 0.1)` | `rgba(215, 73, 59, 0.06)` | 蓝本 `:1417`(T2 段)**与** `:1972`(T6 段) | `src/ai/styles/tokens.scss:314` / `:145` |
| `--purple-soft` | **T6** | `rgba(175, 82, 222, 0.18)` | `rgba(175, 82, 222, 0.1)` | 蓝本 `:1894`(T6 段) | `src/ai/styles/tokens.scss:310` / `:133` |

> `tokens.scss` 的正确路径是 **`src/ai/styles/tokens.scss`**(不是 `src/styles/tokens.scss`)。
> 🔴 **该文件的两个块与 `.knowledge-app` 的档次是反的**(T0 已逐行核出选择器与闭合大括号):
> - **浅色块 = `.agent-app, .ai-toast-scope { … }`,`:31-247`**(选择器 `:31-32`,闭合 `}` 在 `:247`)
> - **暗色块 = `.agent-app[data-theme="dark"], .ai-toast-scope[data-theme="dark"] { … }`,`:249-365`**
>
> 所以 `:130` / `:133` / `:145` 落在**浅色块**、`:282` / `:307` / `:310` / `:314` 落在**暗色块**,
> 与上表的取值方向一致。T0 已逐行核过这 7 个行号,值逐字相同。
> (本仓 `src/ai/styles/knowledge.scss:17-26` 的 R2 注释记的 `:32` / `:250` 指的是同两个块,
> 只是它引的是选择器第二行 / 块内第一行,不是块边界。)

**`--danger-hover` 的两个值不许重算。** 设计 §6.2 写的派生规则是「对本档 `--danger` 做与蓝本同比例的加深
(蓝本 `#FF3B30` → `#e6342a`,亮度 −9%)」。T0 实测:**这条规则复算不出给定的十六进制**
(暗档 `#F0776B` 按任何一种「−9%」解释都得不到 `#E35F52`;浅档 `#c0392b` → `#A83226` 倒是接近逐通道 ×0.877)。
→ **以设计 §6.2 给出的十六进制为准,规则描述只是说明性文字,禁止下游按规则重算出别的值。**

**T2 声明 3 个、T6 声明 1 个。除这 4 个之外不许新造 token。**
本附录 **§B.0 + §B.2 + §B.3** 三节合起来覆盖 **全部 42 处**色字面量(scss 39 + 模板内联 3);
**表里没有的一律 `NEEDS_CONTEXT`。**

### 已存在、直接用即可的 token(T0 已 grep 确认两档都有)

`--danger-soft` · `--danger-soft-border` · `--success-soft` · `--warning-soft` · `--warning-soft-border` ·
`--modal-scrim` · `--bg-chip` · `--line` · `--line-faint` · `--purple` · `--success` · `--danger` ·
`--warning` · `--accent` · `--accent-soft` · `--text-on-accent` · `--text-primary` · `--text-tertiary` ·
`--text-quaternary`。
`--accent-soft-2` 是**登记在案的例外**:它在全局 `src/styles/theme.css` 的 `:root`(`:60`)与浅色块(`:275`)里,
`.knowledge-app` **不重复声明**、跟随全局解析(`knowledgeStyles.test.ts:270-276` 有专门断言钉住这一条,别去动它)。

---

## B.2 T2 段的裸色 → token(**19 行 / 22 处字面量**)

T2 段 = S1 `:241-252` · S2 `:253-257` · S3 `:735-968` · S4 `:1296-1316`+`:1335-1341` ·
S5 `:1398-1430` · S6 `:1484-1499` · S7 `:2031-2039`。

| 蓝本行 | 蓝本原文(逐字) | → 映射 | 说明 |
|---|---|---|---|
| `:247` | `&:hover { background: rgba(0,0,0,0.06); color: var(--text-primary); }`(`.k-banner-close:hover`) | `var(--line)` | 与 `.k-filt-clear:hover`(`:1759`)同款中性加深,两档已有 token |
| `:770` | `background: rgba(255,255,255,0.18);` | `color-mix(in srgb, var(--text-on-accent) 18%, transparent)` | 实底 accent 胶囊上的白色蒙版;承 **P5a T11** 的 `color-mix` 先例 |
| `:771` | `color: white;` | `var(--text-on-accent)` | |
| `:774` | `background: rgba(255, 59, 48, 0.12);` | `var(--danger-soft)` | |
| `:778` | `background: rgba(255,255,255,0.22);` | `color-mix(in srgb, var(--text-on-accent) 22%, transparent)` | |
| `:779` | `color: white;` | `var(--text-on-accent)` | |
| `:839` | `color: white;`(`.k-btn.primary`) | `var(--text-on-accent)` | 🔴 **P5a 已做,现状文件里就是 token,不要重复改** |
| `:840` | `box-shadow: 0 2px 6px rgba(0,122,255,0.22);` | `var(--accent-soft-2)` | 🔴 **P5a 已做,同上** |
| `:845` | `color: white;`(`.k-btn.danger`) | `var(--text-on-accent)` | 本期新增(`&.danger` 整块 P5a 没搬) |
| `:846` | `&:hover:not(:disabled) { background: #e6342a; }` | `var(--danger-hover)` | **新 token**(B.1) |
| `:899` | `&[data-state="failed"]  { background: rgba(255, 59, 48, 0.12); color: var(--danger); }` | `var(--danger-soft)` | `color` 已是 token |
| `:958` | `&[data-tone="danger"]:hover { background: rgba(255, 59, 48, 0.12); color: var(--danger); }` | `var(--danger-soft)` | `color` 已是 token |
| `:1298` | `background: rgba(15, 20, 30, 0.32);`(`.k-modal-bg`) | `var(--modal-scrim)` | 两档均已声明为 `rgba(0, 0, 0, 0.5)`(P5a 做的) |
| `:1405` | `background: rgba(255, 59, 48, 0.12);` | `var(--danger-soft)` | |
| `:1417` | `background: rgba(255, 59, 48, 0.06);` | `var(--danger-soft-faint)` | **新 token**(B.1,T2 声明) |
| `:1418` | `border: 1px solid rgba(255, 59, 48, 0.2);` | `var(--danger-soft-border)` | 两档已有 |
| `:2036` | `.kn-badge[data-s="draft"] { background: rgba(255,149,0,0.14); color: var(--warning); border: 1px solid rgba(255,149,0,0.28); }` | `var(--warning-soft)` / `var(--warning-soft-border)` | **2 处**;两档已有 |
| `:2038` | `.kn-badge[data-s="curated"] { background: rgba(52,199,89,0.12); color: var(--success); border: 1px solid rgba(52,199,89,0.25); }` | `var(--success-soft)` / `var(--success-soft-border)` | **2 处**;后者是**新 token**(B.1,T2 声明) |
| `:2039` | `.kn-badge[data-s="failed"] { background: rgba(255,59,48,0.12); color: var(--danger); border: 1px solid rgba(255,59,48,0.25); }` | `var(--danger-soft)` / `var(--danger-soft-border)` | **2 处**;两档已有 |

**T2 段里另外还有 1 处 `transparent`**:`:828` `border: 1px solid transparent;`(`.k-btn.ghost`)——
`transparent` 是 CSS 关键字不是配色,**照抄**,不计入映射,也不算违规
(先例:P5a T11 评审已按同一口径放行 `.k2-search input` / `.k2-root-add` / `.k2-cc button` 的 3 处 `transparent`)。

`:2037` `.kn-badge[data-s="archived"]` 全走 token(`--bg-chip` / `--text-tertiary` / `--line-faint`),无需改。

---

## B.3 T6 段的裸色 → token(**13 行 / 17 处字面量**)

T6 段 = S8 `:1705-2022`(318 行,**整段重新嵌套进 `.knowledge-app`**,K9)。

| 蓝本行 | 蓝本原文(逐字) | → 映射 |
|---|---|---|
| `:1845` | `0% { background: rgba(52, 199, 89, 0.22); }`(`@keyframes row-done`) | `var(--success-soft)` |
| `:1857` | `.k-status-badge[data-s="ok"] { background: rgba(52,199,89,0.12); color: #1f9c47; }` | `var(--success-soft)` / `var(--success)` **(2 处,见 B.4 ①)** |
| `:1860` | `.k-status-badge[data-s="error"] { background: rgba(255,59,48,0.12); color: var(--danger); }` | `var(--danger-soft)` |
| **`:1862`** | `[data-theme="dark"] .k-status-badge[data-s="ok"] { color: #5BD876; }` | **该选择器整条删除,并进两档(B.4 ①)** |
| `:1890` | `.k-type-tag[data-kind="pdf"] { background: rgba(255,59,48,0.1); color: #d8362b; }` | `var(--danger-soft)` / `var(--danger)` **(2 处)** |
| `:1891` | `.k-type-tag[data-kind="doc"] { background: rgba(0,122,255,0.1); color: var(--accent); }` | `var(--accent-soft)` |
| `:1892` | `.k-type-tag[data-kind="md"]  { background: rgba(20,20,20,0.07); color: var(--text-primary); }` | `var(--bg-chip)` **(见 B.4 ②)** |
| `:1893` | `.k-type-tag[data-kind="txt"] { background: rgba(52,199,89,0.1); color: #1f9c47; }` | `var(--success-soft)` / `var(--success)` **(2 处)** |
| `:1894` | `.k-type-tag[data-kind="code"]{ background: rgba(175,82,222,0.1); color: #9a3fd0; }` | `var(--purple-soft)` **新 token(T6 在此声明)** / `var(--purple)`(两档已有) **(2 处)** |
| **`:1895`** | `[data-theme="dark"] .k-type-tag[data-kind="md"] { background: rgba(255,255,255,0.1); }` | **该选择器整条删除,并进两档(B.4 ②)** |
| `:1899` | `background: var(--warning); color: white;`(`.k-type-legacy`) | `color` → `var(--text-on-accent)` |
| `:1972` | `background: rgba(255,59,48,0.07);`(`.k-fd-error`) | `var(--danger-soft-faint)`(T2 已声明,T6 直接用) |
| `:1973` | `border: 1px solid rgba(255,59,48,0.2);` | `var(--danger-soft-border)` |

**T6 段里另外还有 3 处 `transparent`**:`:1748`(`.k-filt-input` 的 `background: transparent`)、
`:1846`(`@keyframes row-done` 的 `100% { background: transparent; }`)、`:1921`(`border-color: transparent`)——
同 B.2 的口径,**照抄**,不计入映射。

---

## B.4 两处 `[data-theme="dark"]` 的并档处理(K2)

蓝本这两条选择器在 **Vue2 与 New-UI 都永不命中**(Vue2 只有 `.agent-app` 带 `data-theme`;
New-UI 的 `<html>` 只可能是**无属性**或 `data-theme="light"`,从不置 `"dark"`)。
正解是让两档各自取对的值,**把这两条选择器整条删掉**:

### ① `.k-status-badge[data-s="ok"]` 的前景色

- 蓝本浅色 `#1f9c47`(`:1857`)、暗色 `#5BD876`(`:1862`)→ 两者都是「成功语义的可读前景」。
- → 基础块直接写 `color: var(--success)`,天然分档:
  暗档 `#4FB870`(`src/ai/styles/tokens.scss:282`,现状文件已声明)/ 浅档 `#15754c`(`src/styles/theme.css:281`,现状文件已声明)。
- **删掉 `:1862` 那条选择器。**

### ② `.k-type-tag[data-kind="md"]` 的底色

- 蓝本浅色 `rgba(20,20,20,0.07)`(`:1892`)、暗色 `rgba(255,255,255,0.1)`(`:1895`)→ 中性 chip 底。
- → 写成 `background: var(--bg-chip)`,两档已有值(暗 `#2A2A2C` / 浅 `var(--tool-bg-hi)`)。
- **删掉 `:1895` 那条选择器。**

两条都要在**代码注释**里注明「蓝本 `knowledge.scss:1862`(/`:1895`)的 `[data-theme="dark"]` 在 Vue2 与 New-UI 两边都不命中,按 K2 并进两档」——
注释里**不许**写出被删掉的那个色字面量(R5)。

---

## B.5 🔴 守卫缺口① —— T2 必须同时扩「没有搬多」守卫的正则(T0 新发现)

`knowledgeStyles.test.ts:94-98` 的「全部 k-/k2- 类都在白名单内」扫描用的是:

```ts
const found = Array.from(new Set(css.match(/\.k2?-[a-z0-9-]+/g) || [])).map((s) => s.slice(1))
```

这个正则**匹配不到 `.kn-badge`**(`k2?` 吃掉 `k` 后要求下一个字符是 `-`,而这里是 `n`)。
本期 T2 要搬的 S7 段正是 `.kn-*` 前缀,而蓝本 `:2023-2281` 那一大段(P5d 笔记)还有几十个
`.kn-*` 类 —— **如果 T2 手滑多搬了 `.kn-*`,现有守卫一条都抓不到。**

→ **T2 必须把这个正则扩成同时覆盖 `kn-`**,例如 `/\.k(?:2|n)?-[a-z0-9-]+/g`,
并做一次 RED 探针证明它现在真能抓到多余的 `.kn-*`(临时塞一条 `.kn-foo { }` → 报红 → 还原)。
**扩正则不等于放宽 —— 这里是让扫描范围变大,不是让断言变松。**

> 三个守卫缺口的完整清单:**①** 本节(`/\.k2?-/` 扫不到 `.kn-` 前缀,T2 修)·
> **②** `color-guard` 不扫 `.scss`(P3a RED 探针实证,**无法修**,只能靠 `knowledgeStyles.test.ts` +
> 人肉逐行评审)· **③** `color-guard` 不扫模板 `style=` 属性(§B.0.4,T5 补定向断言)。

---

## B.6 计数订正(计划书 §7 的三个数字都不对)

| 项 | 计划书写的 | T0 实测 | 说明 |
|---|---|---|---|
| T2 段色字面量 | 18 处 | **19 行 / 22 处** | 见 B.2;`:2036`/`:2038`/`:2039` 每行各 2 处 |
| T6 段色字面量 | 22 处 | **13 行 / 17 处** | 见 B.3;`:1857`/`:1890`/`:1893`/`:1894` 每行各 2 处 |
| 全期合计(scss) | 40 处 | **32 行 / 39 处** | 两段的「18/22」看起来是被写反了 |
| **模板内联 `style=`** | **完全没统计** | **1 行 / 3 处**(`QueueView.vue:87`) | 🔴 计划书 §7 只扫了 `.scss`。见 §B.0;两个模板加起来只有这一处 |
| **全期总计** | 40 处 | **42 处** | 39 + 3 |

**行号一条都没错,映射一条都没错** —— 只有处数统计错。DoD 里凡引用「18 处 / 22 处 / 40 处」的,
一律改用本节的数字。

## B.7 自检命令(T2 / T6 提交前照跑,输出完整落盘)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
# ① 规则段落零色字面量(两个 token 声明块之外)
grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|(^|[^-[:alnum:]])(white|black|red|green|blue)([^-[:alnum:]]|$)' \
  src/ai/styles/knowledge.scss
# 期望:命中的行全部落在 `.knowledge-app {` 与 `:root[data-theme="light"] .knowledge-app {`
# 两个声明块内部,以及既有的 --shadow-*/--glass-*/--grad-* 声明行。规则段落 0 命中。
# ② 禁 theme-exception
grep -c 'theme-exception' src/ai/styles/knowledge.scss    # 期望 0
# ③ 单独编译
pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null; echo "exit=$?"
```
