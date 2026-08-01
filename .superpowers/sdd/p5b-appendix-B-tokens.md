# P5b 附录 B —— 色值映射表(**32 行 / 39 处色字面量**)

> **权威源**:蓝本 `git show main:src/views/AI/Knowledge/styles/knowledge.scss`(Vue2 `main`@`7a6ee6b7`,共 2561 行)。
> 本表的每一行号 T0 都 `sed -n '<L>p'` 逐行打开核过,并**独立重扫**了两段的全部色字面量
> (正则 `#[0-9a-fA-F]{3,8}|rgba?\(…\)|(?<![\w-])(white|black|red|green|blue|transparent|currentColor)(?![\w-])`),
> 与计划书 §7 的清单做了双向 diff。**行号一条都没错;只有「处数」错了**(见 §B.6)。

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
> 该文件里 **`:60-150` 是浅色块、`:280-320` 是暗色块**(与 `.knowledge-app` 的档次是反的,别搞混)。
> T0 已逐行核过上面 6 个 `tokens.scss` 行号,值逐字相同。

**`--danger-hover` 的两个值不许重算。** 设计 §6.2 写的派生规则是「对本档 `--danger` 做与蓝本同比例的加深
(蓝本 `#FF3B30` → `#e6342a`,亮度 −9%)」。T0 实测:**这条规则复算不出给定的十六进制**
(暗档 `#F0776B` 按任何一种「−9%」解释都得不到 `#E35F52`;浅档 `#c0392b` → `#A83226` 倒是接近逐通道 ×0.877)。
→ **以设计 §6.2 给出的十六进制为准,规则描述只是说明性文字,禁止下游按规则重算出别的值。**

**T2 声明 3 个、T6 声明 1 个。除这 4 个之外不许新造 token。**

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

## B.5 🔴 T2 必须同时扩「没有搬多」守卫的正则(T0 新发现)

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

---

## B.6 计数订正(计划书 §7 的三个数字都不对)

| 项 | 计划书写的 | T0 实测 | 说明 |
|---|---|---|---|
| T2 段色字面量 | 18 处 | **19 行 / 22 处** | 见 B.2;`:2036`/`:2038`/`:2039` 每行各 2 处 |
| T6 段色字面量 | 22 处 | **13 行 / 17 处** | 见 B.3;`:1857`/`:1890`/`:1893`/`:1894` 每行各 2 处 |
| 全期合计 | 40 处 | **32 行 / 39 处** | 两段的「18/22」看起来是被写反了 |

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
