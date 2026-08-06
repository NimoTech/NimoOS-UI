# SP8-P5a Task 11 独立评审 —— knowledge.scss 仪表盘 k2-* 段

评审对象:`sp8-ai@11c65a9`(父 `2677f61`),2 个文件:
`src/ai/styles/knowledge.scss`(+239/-0)· `src/ai/styles/knowledgeStyles.test.ts`(+76/-17)

**判定:Spec 合规 ✅ · 任务质量 通过**
Critical **0** · Important **3**(全部是**守卫覆盖缺口 / 流程口径**,无一条是产出物本身的配色或搬运错误)· Minor 3 · ⚠️ 待裁定 2

权威源一律 `git -C /home/nimo/NimoTech/NimoOS-UI show main:src/views/AI/Knowledge/styles/knowledge.scss` 自读,
未采信实现者报告任何数字。`NimoOS-UI` 只 `git show`,未做任何写操作。

---

## 0. 行号基准

`sed -n '2275,2460p'` 取 186 行 → 蓝本行号 = 2275 + (offset-1)。
- 2282 = `/* ===== Dashboard v2 … */` 注释首行
- 2285-2289 = `.knowledge-app {` + `--ly-*` 三组浅色声明
- 2291-2438 = k2-* 规则体(含两个 `@media`)
- 2439 = 规则块 `}` · 2440-2441 = `@keyframes k2pulse` / `k2spin`
- 2443-2447 = `[data-theme="dark"] .knowledge-app { --ly-* }`
- 2449/2450/2451 = dark 覆写三条(`k2-chip[live]` / `k2-chip[warn]` / `k2-ob-layer .k2-tag`)
- 2452 = 段末空行

---

## A. 配色逐行扫(头号任务)

### A.1 逐行色扫本次新增的 239 行(596-824)

```bash
sed -n '596,824p' src/ai/styles/knowledge.scss | grep -nE \
 '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|lab\(|lch\(|hwb\(|(^|[^\w-])(white|black|red|green|blue|orange|gray|grey|yellow|purple|pink|teal|cyan|magenta|silver|navy)([^\w-]|$)'
→ 无输出(exit 1)
grep -c 'theme-exception' src/ai/styles/knowledge.scss → 0
```

| 项 | 结果 |
|---|---|
| 规则段落里的色字面量 | **0** |
| 注释里的色字面量(596-824 全段,含 45 行 T11 头注释 + 8 处行尾注释) | **0** |
| `theme-exception` | **0**(全文) |

R5 口径已彻底执行:8 处行尾注释与 45 行头注释全部写成「蓝本 `:行号` + 中文描述颜色」
(例:`/* 蓝本 :2383 红色半透明背景裸值 → 附录 B「danger-soft」桶 */`),无一处抄裸值。
`transparent` 出现 3 次(`.k2-search input` / `.k2-root-add` / `.k2-cc button` 的 `background: transparent`,
以及 2 处 `color-mix(…, transparent)`)—— 蓝本逐字原文,按 T4 评审已定的口径不算色字面量。
`color-mix(` **不**被 `/\bcolor\(/` 断言撞对(`color` 后是 `-` 不是 `(`),已核。

### A.2 新补两个 token 的取值回源核

不看行尾注释,直接回 `src/ai/styles/tokens.scss` 取值:

| token | 声明处 | 值 | tokens.scss 对应 | 核 |
|---|---|---|---|---|
| `--danger-soft-border` 暗 | knowledge.scss:152 | `rgba(240, 119, 107, 0.24)` | `:309` | ✅ |
| `--danger-soft-border` 浅 | :229 | `rgba(215, 73, 59, 0.16)` | `:132` | ✅ |
| `--modal-scrim` 暗 | :153 | `rgba(0, 0, 0, 0.5)` | `:338` | ✅ |
| `--modal-scrim` 浅 | :230 | `rgba(0, 0, 0, 0.5)` | `:182` | ✅ |

两档都有值 ✅。附录 B 另 4 个候选(`--success-soft-border` / `--purple-soft` /
`--danger-soft-faint` / `--teal-soft`)—— 我自己逐行核了蓝本 2282-2452,确认本段确实未使用,
不声明是对的(声明用不到的 token 会让 R2 断言失去判别力)。

### A.3 🔴 `var()` 全量核查表(本任务最容易出、单测与 color-guard 都抓不到)

```bash
sed -n '596,824p' src/ai/styles/knowledge.scss | grep -oE 'var\(--[a-z0-9-]+' | sed 's/var(//' | sort -u
→ 43 个
```

| # | token | 解析处 | 结论 |
|---|---|---|---|
| 1 | `--accent` | knowledge.scss:90 / :193 | ✅ 两档 |
| 2 | `--accent-soft` | :92 / :194 | ✅ |
| 3 | `--accent-softer` | :93 / :198 | ✅ |
| 4 | `--bg-chip` | :78 / :165 | ✅ |
| 5 | `--bg-elevated` | :76 / :163 | ✅ |
| 6 | `--danger` | :97 / :201 | ✅ |
| 7 | `--danger-soft` | :146 / :226 | ✅ |
| 8 | `--danger-soft-border` | :152 / :229(T11 新补) | ✅ |
| 9 | `--font-mono` | :136(结构量,两档共享基础块) | ✅ |
| 10 | `--font-sans` | :135 | ✅ |
| 11 | `--g` | **规则内 fallback** `var(--g, var(--text-quaternary))`(:687,蓝本 :2327 逐字) | ✅ 模板 inline style 传入,有兜底 |
| 12 | `--line` | :102 / :206 | ✅ |
| 13 | `--line-faint` | :104 / :208 | ✅ |
| 14 | `--line-strong` | :103 / :207 | ✅ |
| 15 | `--ly` | **规则内**:`.k2-layer`(:666)与 `.k2-ob-layer`(:777)各自声明,`.k2-tag`/`.k2-layer-bar` 等从祖先继承 | ✅ 与蓝本同构 |
| 16 | `--ly-ln` | 同上 `.k2-layer`:666 | ✅ |
| 17 | `--ly-soft` | 同上 :666 / :777 | ✅ |
| 18-20 | `--ly-note` / `-note-line` / `-note-soft` | :111 / :212(T4) | ✅ |
| 21-23 | `--ly-vec` / `-vec-line` / `-vec-soft` | :110 / :211 | ✅ |
| 24-26 | `--ly-wiki` / `-wiki-line` / `-wiki-soft` | :109 / :210 | ✅ |
| 27 | `--modal-scrim` | :153 / :230(T11 新补) | ✅ |
| 28 | `--on-accent` | **仅出现在注释里**(:817 说明浅色 `--text-on-accent` 的来源);实体引用在 :175 `--text-on-accent: var(--on-accent)`,全局 `theme.css:48`(暗)/`:186`(浅 `#ffffff`)均有 | ✅ |
| 29 | `--r-lg` | :125 | ✅ |
| 30 | `--r-md` | :124 | ✅ |
| 31 | `--r-sm` | :123 | ✅ |
| 32 | `--shadow-md` | :132 / :219 | ✅ |
| 33 | `--shadow-sm` | :131 / :218 | ✅ |
| 34 | `--shadow-xs` | :130 / :217 | ✅ |
| 35 | `--success` | :95 / :195 | ✅ |
| 36 | `--success-soft` | :145 / :225 | ✅ |
| 37 | `--text-on-accent` | :88 / :175 | ✅ |
| 38 | `--text-primary` | :84 / :171 | ✅ |
| 39 | `--text-quaternary` | :87 / :174 | ✅ |
| 40 | `--text-secondary` | :85 / :172 | ✅ |
| 41 | `--text-tertiary` | :86 / :173 | ✅ |
| 42 | `--warning` | :96 / :200 | ✅ |
| 43 | `--warning-soft` | :143 / :223 | ✅ |

**43 / 43 全部可解析,0 个两处都找不到。** 没有任何一处会在真机渲染成透明/无色。
`--accent-soft-2`(R2 唯一例外)本段**未使用**,也未被重复声明 ✅。

### A.4 浅色档完整性

T11 新增的 2 个 token 两档都有值(见 A.2)。T4 已有的 4 个 `*-soft` 与 `--shadow-*` 四条
两档也都在(R2/R4 断言已钉住,我自己复核过 :143-146 / :223-226 与 :130-133 / :217-220)。
`.k2-ob-layer .k2-tag` 两档各有一条规则(暗 :786 / 浅 :820-822)✅。

**色值等价性验算**(我自己算,不信报告):
- 暗:`color-mix(in srgb, rgba(0,0,0,0.5) 50%, transparent)` → 预乘插值 → `rgba(0,0,0,0.25)` = 蓝本 `:2451` **精确等值** ✅
- 浅:`--text-on-accent` 浅档 = `var(--on-accent)` = `theme.css:186` `#ffffff`(已亲自打开核实,不是别的暖白)
  → `color-mix(in srgb, #ffffff 50%, transparent)` → `rgba(255,255,255,0.5)` = 蓝本 `:2416` **精确等值** ✅
- 层叠顺序:基础 `.knowledge-app .k2-ob-layer .k2-tag`(0,3,0)在前,浅色 `:root[…] .knowledge-app .k2-ob-layer .k2-tag`(0,4,0)在后 → 浅色档正确胜出 ✅
- dist 产物两条都在(见 E)✅

---

## B. 类与规则的搬运正确性

### B.1 类数(我自己数)

```bash
git show main:…/knowledge.scss | sed -n '2282,2452p' | grep -oE '\.k2?-[a-z0-9-]+' | sed 's/^\.//' | sort -u | wc -l
→ 64        (63 个 k2-* + 1 个 k-suggest-chip)
sed -n '/### D.2/,/### D.3/p' brief | grep -oE 'k2?-[a-z0-9-]+' | sort -u | wc -l
→ 64        且与上面那份集合 `diff` 零差异
```

**蓝本类集 = 64**(不是 65)。brief 结尾那句「(含 `k2-*` 64 个 + `k-suggest-chip`)」是复述句里的算术错
(`k-suggest-chip` 在小节里出现两次:类清单 + 复述句),清单本体没错。→ **实现者判断 1 成立**。

**白名单应是 38 + 64 = 102**(不是 103)→ **实现者判断 2 成立**。

**落地**:
```bash
grep -oE '\.k2?-[a-z0-9-]+' src/ai/styles/knowledge.scss | sort -u | wc -l → 101
```
101 = T4 的 37 个 `k-*` + `k-suggest-chip` + 63 个 `k2-*`;`knowledge-app` 不匹配 `\.k2?-` 正则,
单独由白名单条目 + 独立存在性断言覆盖 → 101 + 1 = 102 = `WHITELIST_102.length` ✅

`k2-*` 落地集与蓝本 `k2-*` 集 `diff` **零差异**(63/63)→ **一个不少,一个不多(搬多 0 个)**。

### B.2 规则内容逐行比对(比 brief 要求的 12 个抽查更强:全段 130 行机械 diff)

```bash
# 蓝本 2291-2438 剥注释 → bp-rules.txt(130 行,末行是块 })
# 新档 642-807   剥注释 → new-rules.txt(129 行,不含块 })
diff bp-rules.txt new-rules.txt
```

差异**恰好 7 处,全部是 K2 授权的裸色→token 替换,零结构/零数值/零顺序偏差**:

| # | 蓝本(行) | 新档(行) | 附录 B 依据 | 判 |
|---|---|---|---|---|
| 1 | `.k2-chip[data-tone="live"] { background: rgba(52,199,89,0.12); color: oklch(0.5 0.14 150); }` (2342) | `{ background: var(--success-soft); color: var(--success); }` (704) | bg 精确命中「`rgba(52,199,89,0.1x)` → `--success-soft`」;color 见「两处判断调用」 | ✅ / ⚠️ |
| 2 | `.k2-chip[data-tone="warn"] { background: rgba(255,149,0,0.13); color: oklch(0.55 0.13 65); }` (2344) | `{ background: var(--warning-soft); color: var(--warning); }` (708) | bg 精确命中「`rgba(255,149,0,0.1x)` → `--warning-soft`」;color 同上 | ✅ / ⚠️ |
| 3 | `.k2-live-ico[data-ok="true"] { background: rgba(52,199,89,0.12); color: var(--success); }` (2357) | `{ background: var(--success-soft); color: var(--success); }` (723) | 精确命中 success-soft 桶,color 原文已是 token | ✅ |
| 4 | `.k2-qchip[data-tone="danger"] { background: rgba(255,59,48,0.1); … }` (2375) | `background: var(--danger-soft)` (744) | 精确命中「`rgba(255,59,48,0.1x)` → `--danger-soft`」 | ✅ |
| 5 | `.k2-qchip[data-tone="danger"]:hover { background: rgba(255,59,48,0.18); }` (2376) | `background: var(--danger-soft-border)` (747) | 0.18 字面属于「0.1x」桶,他取了「0.2x~0.3x」桶 —— 见 Minor-1 | ⚠️ |
| 6 | `.k2-entry-badge { … color: #fff; … }` (2394) | `color: var(--text-on-accent)` (767) | 精确命中「`white`/`#fff`(前景)→ `--text-on-accent`」 | ✅ |
| 7 | `.k2-ob-layer .k2-tag { background: rgba(255,255,255,0.5); }` (2408) | `color-mix(in srgb, var(--modal-scrim) 50%, transparent)` (786) + 浅色档 :820-822 | **不在任何桶内** —— 见 Important-1 | ⚠️ |

其余 **123 行逐字节相同**(含 `.k2-search*`/`.k2-layer*`/`.k2-root*`/`.k2-live*`/`.k2-prog*`/
`.k2-entry*`/`.k2-onboard*`/`.k2-skel-card`/`.k-suggest-chip` 与两个 `@media` 的全部
`display`/`gap`/`padding`/`font`/`transition`/`grid-template-columns`/`min-width`/像素小数
`11.5px`/`9.5px`/`1.5px dashed`/`vertical-align: 3px` 等)。数值与属性顺序无一处被"顺手整理"。

浅色档那条追加规则(:820-822)是蓝本 `:2416` 基础值按 K2 拆档的另一半,选择器写成
`:root[data-theme="light"] .knowledge-app …`,**没有**留 `[data-theme="dark"]` 祖先 ✅。

### B.3 属性态五组

| 组 | 蓝本 | 新档 | 判 |
|---|---|---|---|
| `[data-on]` — `k2-cc` | `:2370` `.k2-cc button[data-on="true"]` | :738 逐字 `[data-on="true"]` | ✅ **附录 D.3 的 `[data-active]` 是错的** |
| `[data-tone]` — `k2-chip` | live / warn(+ 各自 ` i` 子规则,共 4 条) | :704/:705/:708/:709 四条全在 | ✅ |
| `[data-tone]` — `k2-entry-ico` | accent / wiki / vec / note 四色 | :759-762 四条全在 | ✅ |
| `[data-tone]` — `k2-entry-badge` | note | :768 | ✅ |
| `[data-tone]` — `k2-qchip` | danger + danger:hover | :744 / :747 | ✅ |
| `[data-layer]` — `k2-layer` | wiki / vec / note **三色** + 两个 `@media` 里的 `[data-layer="wiki"]` 两条 | :668/:669/:670 + :796/:800 **五条全在** | ✅ |
| `[data-layer]` — `k2-ob-layer` | wiki / vec / note **三色** | :778/:779/:780 | ✅ |
| `[data-disabled]` — `k2-entry` | `[data-disabled="true"]` | :757 | ✅ |
| `[data-ok]` — `k2-live-ico` | `[data-ok="true"]` | :723 | ✅ |

**五组无一遗漏。** 三色齐全(wiki/vec/note × 2 个宿主 = 6 条)。

### B.4 修饰类

| 修饰类 | 蓝本 | 新档 | 判 |
|---|---|---|---|
| `.k2-layer-num .second` | `:2336` | :679 逐字 | ✅ |
| `.k2-layer-num .suffix` | `:2335` | :678 逐字 | ✅ |
| `.k2-layer-num .k2-drafts` | `:2337` | :680 逐字 | ✅ |
| `.k2-live-ico .spin` | `:2358` | :724 逐字 | ✅ |

### B.5 `k2pulse` / `k2spin`

蓝本 `:2440-2441`:
```
@keyframes k2pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes k2spin { to { transform: rotate(360deg); } }
```
新档 :813-814 **逐字符相同** ✅。落点:T11 规则块之后、浅色档追加规则之前,**顶层全局**
(不嵌进任何选择器)—— 与 T4 的 7 个 keyframes 同一理由,正确。dist 里两个都在(见 E)。

### B.6 T4 那段有没有被动

```bash
git diff 2677f61..11c65a9 -- src/ai/styles/knowledge.scss | grep -c '^-[^-]'  → 0
```
**`-` 行 0 条 → knowledge.scss 是纯追加(239 insertions / 0 deletions)。T4 落的规则内容一行未动。**
T11 对声明层的改动是两处**纯插入**(:148-153 暗档 6 行 / :228-230 浅档 3 行),
既有 token 的值、顺序、注释一个字都没改。✅

---

## C. 守卫质量

### C.1 17 个 `-` 行逐条核(`knowledgeStyles.test.ts`)

| # | 被删/改的行 | 性质 | 是否削弱 |
|---|---|---|---|
| 1-2 | 两行 `WHITELIST_38` 说明注释 | 改写为「T4 的 38 个 + T11 的 64 个」 | 否 |
| 3 | `const WHITELIST_38 = [` | → `WHITELIST_102 = [`(重命名 + 扩容,原 38 项**一个没删**,我逐项核过) | 否 |
| 4 | `describe('…(38 个,R1 拍板)'` | → `'…(102 个,R1 + T11 拍板订正)'` 标题文字 | 否 |
| 5 | `it('38 个白名单类全部有对应规则…'` | → `'102 个…'` 标题文字 | 否 |
| 6 | `WHITELIST_38.filter(…)` | 同一逐类正则 `\\.${c}(?![\\w-])`,**只换常量名** | 否 |
| 7 | `!WHITELIST_38.includes(c)` | 同上,`found` 正则 `/\.k2?-[a-z0-9-]+/g` **一字未改** | 否 |
| 8-15 | 8 条具名色 `\bWORD\b` | → `(?<![\w-])WORD(?![\w-])`(见 C.2) | **否,是收紧** |
| 16 | `it('R2 —— 4 个…'` | → `'R2 —— 6 个…'` 标题文字 | 否 |
| 17 | `for (const tok of [4 项])` | → 6 项(4 项原封不动 + 2 项新增),循环体两条 `expect` 未动 | 否 |

**结论:17 个 `-` 行全部是重命名 / 标题文字 / 数组扩容 / 正则收紧,没有一条断言被削弱或删除。**
另外核过:
- 「没有搬多」断言的正则与过滤逻辑 **未变**,无新增豁免项 ✅(探针见 D 的实现者探针 4,我复核了逻辑)
- 「白名单类全部有规则」仍是**逐类精确**(`\\.${c}(?![\\w-])`),不是整体子串 ✅
- 色扫的豁免区间**未被 T11 扩大**(仍是 dark + light 两个 `declBlockRange`)—— 但区间本身有个 T4 遗留的洞,见 Important-2
- R2 断言**已覆盖新补的 2 个 token**,且是「两档各查一次」✅
- R4 / `--accent-soft-2` 例外 / 浅色档三项显式声明 / import 存在性 五条既有守卫**全部原样保留** ✅

### C.2 `\b` → `(?<![\w-])…(?![\w-])` 这个修法对不对

**对,且必要。** 两个方向都做了独立 RED 验证(见 D 的探针 5a/5b):
- 必要性:干净档上把正则改回 `\bwhite\b` → **立刻假阳性报红**(本段照抄蓝本用了 5 处 `white-space: nowrap`)。
  这是本期**第五次**「守卫自己有窟窿」同族事故(前四次:T4 `\b` 在 `-` 前成立 / T4 色扫跑在剥注释后 /
  T4 R4 子串检查 / T10 import 守卫被注释撞对),实现者自己抓到并修,属加分项。
- 没放宽:新正则在**两侧**都比 `\b` 严(`\b` 接受 `-` 作边界,新写法不接受)。
  唯一被新放过的形状是 `-red` / `red-` 这类连字符复合词 —— 在 CSS 里具名色永远前接
  `:` `,` `(` 或空白、后接 `;` `)` `,` 或空白,这些字符两个负向断言都满足,故**不存在真实漏网**。
  已用探针 5a 实证:`color: white;` 仍精确报红。
- 顺手放宽别的判据?**没有。** `#hex` / `rgba?\(` / `hsla?\(` / `oklch\(` / `lab\(` / `lch\(` /
  `hwb\(` / `color\(` 八条**一字未改**;`rest` 的拼接式(:150)与两个区间边界的取法也未改。

---

## D. 五次独立 RED 探针(全部与实现者的四次不同)

前置事实:`grep -rln "scss" src --include=*.test.ts` → 只有 `knowledgeStyles.test.ts` 读
`knowledge.scss` 的内容(`knowledgeRoutes.test.ts` 只提到文件名、不读内容);
`color-guard.test.ts:15-16` 只 glob `**/*.vue` 与 `**/*.css`,**不含 `.scss`**(已亲自打开核实)。
故对 `knowledge.scss` 的破坏,`knowledgeStyles.test.ts` 是唯一可能的报红方。

| # | 破坏什么 | 结果 | 报红用例完整名 | 还原 |
|---|---|---|---|---|
| 1 | `:729` `.k2-prog-pct { color: var(--ly-vec) }` → `var(--k2-nonexistent)`(两档都没声明的 token 名) | 🔴 **无人报红,10/10 全绿** | —— | ✅ |
| 2 | 删掉 `:669` `.k2-layer[data-layer="vec"]`(三色里的一色) | **无人报红,10/10 全绿** | —— | ✅ |
| 3 | 删掉 `:814` `@keyframes k2spin`(`animation: k2spin` 引用仍在) | **无人报红,10/10 全绿** | —— | ✅ |
| 4a | 在 T11 行尾注释 `:743` 里塞 `rgba(255, 59, 48, 0.1)` | **精确报红 1 条** | `knowledge.scss —— 配色硬约束(本档除声明层外无自动守卫,§6 豁免登记） > token 声明层之外,全文(含注释)零色字面量(#hex / rgb() / hsl() / oklch() / 具名色…)`,断言消息 `声明层之外出现 rgb()/rgba()` | ✅ |
| 4b(附加) | 同一个字面量塞进**文件头注释** `:20`(`#ff0000 rgba(1,2,3,0.4)`) | 🔴 **无人报红,10/10 全绿** —— 暴露豁免区间过宽(Important-2) | —— | ✅ |
| 5a | `:751` `.k2-paused-note` 的 `color: var(--warning)` → `color: white` | **精确报红 1 条** | 同 4a 的用例,断言消息 `声明层之外出现具名色 white: expected … not to match /(?<![\w-])white(?![\w-])/` | ✅ |
| 5b | 干净档上把 `:175` 的正则改回 `/\bwhite\b/` | **报红(假阳性)** —— 证明 `white-space` 确实会撞对、修法必要 | 同上用例 | ✅ |

还原核验:`cp` 回备份后 `git status --short` **空**、`git diff --stat` **空**、
`knowledgeStyles.test.ts` 重跑 **10/10 全绿**。全程未提交任何东西。

### 探针 1-3 的解读(→ Important-3 / Minor-2 / Minor-3)

三条都是**当前无实际缺陷、但零覆盖**的故障模式。其中探针 1 最危险:
「`var(--x)` 引用了一个两档都没声明的 token」在真机上是 `background`/`color` 落成
**guaranteed-invalid → 透明/继承**,页面看起来"少了一块颜色",而**单测、color-guard、sass 编译、
vue-tsc、vite build 五道门全部放过**(sass 不解析自定义属性引用)。本档已经因为
「R2 家族在 `.knowledge-app` 解析不到」踩过一次同款(见 knowledge.scss:16-20 的头注释),
说明这不是假想风险。

**最小补救建议**(给 T12 或独立补丁,一条断言即可):
```ts
it('本档所有 var(--x) 引用都能解析(本档两个声明层 或 全局 theme.css)', () => {
  const declaredHere = new Set(
    [...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]),          // 含规则内的 --ly/--ly-soft/--ly-ln
  )
  const theme = read('../../styles/theme.css')
  const declaredGlobal = new Set([...theme.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
  const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)(\s*,)?/g)]
    .filter((m) => !m[2])                                               // 带 fallback 的(如 --g)豁免
    .map((m) => m[1]))
  const unresolved = [...used].filter((t) => !declaredHere.has(t) && !declaredGlobal.has(t))
  expect(unresolved, `引用了未声明的 token(真机渲染成透明):${unresolved.join(', ')}`).toEqual([])
})
```
(用探针 1 的手法自验:换成 `var(--k2-nonexistent)` 必须报红。)

---

## E. 编译与三门(我自己实测)

```
pnpm exec sass --no-source-map src/ai/styles/knowledge.scss …/t11.css → exit=0
wc -l → 1626

pnpm test                  → exit=0 · Test Files 312 passed (312) · Tests 2831 passed (2831) · 0 红
pnpm exec vue-tsc --noEmit → exit=0(无输出)
pnpm build                 → exit=0(仅 >500 kB chunk 警告)

grep -oE '\.k2-[a-z0-9-]+' dist/assets/*.css | sort -u | wc -l → 63
grep -o 'knowledge-app'    dist/assets/*.css | wc -l           → 191
grep -oE 'k2(pulse|spin)'  dist/assets/*.css | sort -u         → k2pulse / k2spin(两个都在)
```

产物抽验(证明 K2 拆档在真产物里成立):
```
dist/assets/index-DfgHL4qe.css:
  …k2-ob-layer .k2-tag{background:color-mix(in srgb,var(--modal-scrim) 50%,transparent)}
  :root[data-theme=light] .knowledge-app .k2-ob-layer .k2-tag{background:color-mix(in srgb,var(--text-on-accent) 50%,transparent)}
```

**与实现者报的数字完全一致**(312/2831 · sass 0/1626 行 · dist 63 个 `.k2-`)。
已知噪声(`persist.test.ts` 的 IndexedDB flaky、`AgentComposer.test.ts` 的 i18n teardown)
本次**都没有出现**,零红项,无需归属。
算术核对:基线 `2677f61` 是 312 文件 / 2831 例;本任务不新增 `.vue`/不新增测试文件,数量应持平 → 持平 ✅
(T4/T10 已把 `.vue` 增量吃掉;§8 里"收官 307 文件"的估算已被后续任务的实际增量超过,与本任务无关。)

### 提交卫生

```
git show --stat 11c65a9 → 只含 src/ai/styles/knowledge.scss + src/ai/styles/knowledgeStyles.test.ts
git status --short       → 空
.sp8/NimoOS-Service      → HEAD 03d3028(T2 的 fixup),无本任务提交,工作树干净
NimoOS-UI                → HEAD 65aea806(SP7 的 docs 提交),本任务未在此提交任何东西 ✅
```

---

## F. 实现者四处「与 brief/附录 不符」的裁定

1. **类数 64 不是 65** — **成立**。我独立数出蓝本 `2282-2452` 类集 = **64**(63 `k2-*` + `k-suggest-chip`),
   与 brief D.2 清单去重后的集合 `diff` 零差异。brief 结尾复述句的算术错。
2. **白名单 102 不是 103** — **成立**。38 + 64 = 102;落地 101 + `knowledge-app` = 102,`extra` 为空。
3. **`k2-cc` 是 `[data-on="true"]` 不是 `[data-active]`** — **成立**。蓝本 `:2370`
   `.k2-cc button[data-on="true"]`。附录 D.3 写错了。**这是 T12 的交接项**(见 H)。
4. **修了守卫的 `\b` 假阳性 bug** — **成立且修法正确**。两个方向 RED 验证过(探针 5a/5b),
   没有顺手放宽任何别的判据(8 条色函数断言与豁免区间取法一字未改)。

---

## G. 实现者两处「判断调用」的裁定

### G.1 `.k2-chip[data-tone]` 文字色复用 `--success` / `--warning` → **不需要 NEEDS_CONTEXT,判定通过**

- 蓝本原值:浅 `oklch(0.5 0.14 150)` / `oklch(0.55 0.13 65)`(:2342/:2344),
  暗 `oklch(0.78 0.14 150)` / `oklch(0.8 0.12 70)`(:2449/:2450)。
- 附录 B 的裸色对照表**有**同族条目:`#1f9c47`/`#5BD876` → `var(--success)`(绿色前景 → success)。
  这两组 oklch 就是「成功态绿 / 警告态橙」的前景色,属于**表里已有的同语义 token 可用**。
- 等价性我自己验算了(近似换算):
  `--success` 浅 `#15754c` ≈ oklch(0.44 0.11 155) vs 蓝本 0.5 0.14 150;暗 `#4FB870` ≈ oklch(0.71 0.14 152) vs 0.78 0.14 150。
  `--warning` 浅 `#92600c` ≈ oklch(0.48 0.11 70) vs 0.55 0.13 65;暗 `#E0A53B` ≈ oklch(0.75 0.12 78) vs 0.8 0.12 70。
  **色相同、两档明暗关系同(浅档偏深/暗档偏亮),对比度在各自的 `*-soft` 底上都够** → 视觉无明显偏差。
- 属「表里有同语义 token 可用」,不是发明新映射。且报告 + 代码注释双申报齐全。
- ⚠️ 唯一保留:「橙色前景 → `--warning`」这一条在附录 B 表里**只有模式类推**(表里给的是绿/红/紫三条,
  没给橙),严格讲是从三条推出的第四条。视觉验算过没问题,列作 ⚠️-1 供协调者知情,不按缺陷记。

### G.2 `.k2-ob-layer .k2-tag` 的 `color-mix` 掺色 → **属「实质上新增了一条映射」,按 Important 报(Important-1)**

- 蓝本原值:基础 `rgba(255,255,255,0.5)`(:2408)、`[data-theme="dark"]` 覆写 `rgba(0,0,0,0.25)`(:2451)。
- 附录 B 覆盖范围:白色半透明只覆盖 **`rgba(255,255,255,0.1~0.2)` → `--bg-chip`**(0.5 不在内);
  遮罩条目是 **`rgba(15,20,30,0.32)` → `--modal-scrim`**(黑色 0.25 也不在内)。
  **两个值都落在所有桶之外** → 命中治理文件「表里没有的 → 停下写 `NEEDS_CONTEXT`」。
- 他选的路是:不新增 token(用 `--modal-scrim` / `--text-on-accent`)+ 用 `color-mix()` 现场派生透明度。
  技术上**没有发明新 token**,但**发明了一条新的映射手法**(「桶外的半透明蒙版 = 同色 token 经
  `color-mix` 降 alpha」),而这条手法附录 B 里没有,治理口径要求先停下问。
- 缓解因素(所以不是 Critical、也不建议返工):
  ① 数值**精确等值**(A.4 已验算,两档都是零误差);② 手法在 T4 的 `.k-empty-illust` 已有先例;
  ③ 报告偏离清单第 4 条 + 代码 :603-621 / :781-785 / :816-819 三处注释都写明了取舍。
- **裁定:属「后者」(未走 `NEEDS_CONTEXT` 就自行决定映射)→ Important(流程),产出物本身无需改。**
  建议协调者**追认**这条映射并写进附录 B(后续 P5b-P5f 还会遇到同类桶外蒙版),否则下一批会再吵一次。
- 语义耦合小隐患:`--modal-scrim` 的语义是「模态遮罩」。若将来主题把它改成带色调的遮罩
  (如蓝调 scrim),这个 tag 底色会跟着变。附录 B 追认时最好顺手给个专用 token 名。

---

## 发现清单

### Important

**I-1 · `.k2-ob-layer .k2-tag` 的两档蒙版映射不在附录 B 任何桶内,未走 `NEEDS_CONTEXT` 就自行决定**
`src/ai/styles/knowledge.scss:786` 与 `:820-822`。蓝本 `:2408` `rgba(255,255,255,0.5)` /
`:2451` `rgba(0,0,0,0.25)` —— 附录 B 的白色桶只到 0.2、遮罩桶是 `rgba(15,20,30,0.32)`,两者都不覆盖。
**数值经我验算精确等值、产出物无视觉缺陷,故不建议改代码**;应改的是流程:
请协调者**追认**这条「桶外半透明蒙版 → 同色 token + `color-mix` 降 alpha」映射并补进附录 B,
供 P5b-P5f 复用(否则同类蒙版每批都要重判一次)。

**I-2 · 色扫的豁免区间比声明块宽 65 行 —— `indexOf('.knowledge-app {')` 命中的是第 8 行的注释**
`src/ai/styles/knowledgeStyles.test.ts:104-111`(`declBlockRange`)+ `:145`。
实测(node):`rawSource.indexOf('.knowledge-app {')` 落在 **:8**(头注释里写了
`` `.knowledge-app { … }` ``),不是真正的声明块 `:73`;`indexOf('\n}')` 再走到 `:157`。
→ 豁免区间实为 **:8-157**,把 **:8-72 这 65 行头注释一并豁免掉了**。
后果已实证:探针 4b 在 `:20` 塞 `#ff0000 rgba(1,2,3,0.4)` → **10/10 全绿**;
而 T4 遗留的头注释 **:36 / :40 / :58 / :59** 里本来就有真实色字面量
(`rgba(40,35,25,…)` / `rgba(0,0,0,…)` / `#3b5bdb` / `rgba(59,91,219,0.11)` / `#15754c`),
按协调者 R5 口径这些是违规的,而**守卫看不见**。
**成因归属:T4 那轮把色扫从 `css` 改到 `rawSource` 时引入(改前剥了注释,`indexOf` 反而是对的);
T11 未引入、也未察觉**,但 T11 在 `:133-135` 新写的注释断言「只豁免两个 token 声明块本身」是事实错误。
**应改成**:`declBlockRange` 用行首锚定的正则定位,例如
`const m = /^\.knowledge-app \{$/m.exec(text)` / `/^:root\[data-theme="light"\] \.knowledge-app \{$/m`
(两个真声明块都是独占一行、零缩进,注释里的那份前面有 ` * ` 前缀,锚定后不会撞对);
并顺手把 `:36/:40/:58/:59` 四行头注释里的色字面量改写成「`tokens.scss:行号` + 中文描述」。

**I-3 · 「`var()` 引用了两档都没声明的 token」零覆盖 —— 真机渲染成透明,五道门全部放过**
探针 1:`:729` 的 `var(--ly-vec)` 换成 `var(--k2-nonexistent)` → `pnpm test` **10/10 全绿**、
`sass` exit 0、`vue-tsc` 0、`build` 0。本档正是因为这个故障模式才有 R2(见 `knowledge.scss:16-20`),
却没有任何自动化守卫。**本次产出物 43/43 全部可解析、无实际缺陷**,报的是覆盖缺口。
最小补救断言已在 D 节给出(约 10 行,复用本档既有 `read()`/`css`,需对 `var(--g, …)` 这类
带 fallback 的引用豁免)。建议由 T12 或一个独立小补丁落地。

### Minor

**M-1 · `.k2-qchip[data-tone="danger"]:hover` 的桶归属越了附录 B 的边界(`:747`)**
蓝本 `:2376` 是 `rgba(255,59,48,0.18)`,字面属于附录 B 的「`0.1x` → `--danger-soft`」桶,
他取的是「`0.2x~0.3x` → `--danger-soft-border`」桶。
**这个选择是对的**:落 `--danger-soft` 会让 hover 与常态同色(0.16 = 0.16),hover 反馈消失 = 可见回归;
取 border 档后是 0.16 → 0.24(蓝本是 0.1 → 0.18),强化关系保留。
代码 `:745-746` 注释写了理由,报告偏离清单只提了 token 未提桶越界。**只需协调者知情/追认边界口径。**

**M-2 · `[data-layer]` 三色缺一不报红**(探针 2)。白名单只查类是否存在,不查属性态。
brief 自己预警过「漏一个 = 可见回归,单测只查属性值不查颜色」。本次三色齐全,报的是缺口。
可选补救:一条断言遍历 `['wiki','vec','note']` × `['k2-layer','k2-ob-layer']` 查
`\.${cls}\[data-layer="${k}"\]` 存在。

**M-3 · `@keyframes k2spin` / `k2pulse` 被删不报红**(探针 3)。删掉 keyframes 后
`animation: k2spin …` 引用还在,spinner 静默不转。可选补救:凡 `animation: X` 出现,
断言同档存在 `@keyframes X`(能同时覆盖 T4 的 7 个)。

### ⚠️ 待协调者裁定

**⚠️-1 · 「橙色前景 oklch → `--warning`」是从附录 B 的绿/红/紫三条类推出的第四条**(`:708`)。
视觉验算无偏差(见 G.1),但严格讲表里没这一行。请一并在追认 I-1 时把它写进附录 B。

**⚠️-2 · `--modal-scrim` 被当作「半透明黑蒙版」的取色源使用**(`:786`),而它的语义是「模态遮罩」。
未来主题若给 scrim 加色调,这个 tag 底色会跟着变。追认 I-1 时可考虑给个专用 token 名
(如 `--k2-tag-veil`,两档各一份),或明确接受这层耦合。

---

## H. 给 T12(`DashboardView.vue`)的交接项

1. 🔴 **`.k2-cc` 的并发按钮必须输出 `data-on`,不是附录 D.3 写的 `data-active`。**
   样式只匹配 `.k2-cc button[data-on="true"]`(`knowledge.scss:738`,蓝本 `:2370`)。
   蓝本 `DashboardView.vue:219` 的写法是
   `:data-on="String(store.state.controlState.concurrency === c.n)"` ——
   **必须套 `String()`**(渲染成字面 `"true"`/`"false"`),否则选中态样式落空。
   附录 D.3 那份清单在这一条上是错的,别照它写。
2. 其余四组属性态照蓝本 `DashboardView.vue` 原样输出(我已核过模板):
   `data-layer="wiki|vec|note"`(`:17` 的 `.k2-ob-layer` 与 `:76/:93/:111` 的 `.k2-layer`,
   后三处是**静态**字面量)· `data-tone`(`:32/:255` 的 `.k2-entry-ico`、`:159/:161` 的
   `.k2-chip` 静态 `live`/`warn`、`:228` 的 `.k2-qchip` 静态 `danger`、`:260` 的 `.k2-entry-badge`)·
   `data-disabled="String(!!e.disabled)"`(`:31`)· `data-ok="true"`(`:204`,**静态**)。
3. `.k2-glue-id i` 的圆点颜色来自 **inline style 的 `--g`**(`knowledge.scss:687`
   `background: var(--g, var(--text-quaternary))`)—— T12 必须在模板里把 `--g` 通过
   `:style` 传下来,否则三个胶合点全落成兜底灰。
4. 修饰类写法:`.k2-layer-num` 里的子 `<span>` 用 `class="suffix"` / `class="second"` /
   `class="k2-drafts"`(不是 `k2-layer-num-suffix`);`.k2-live-ico` 的旋转态是子元素
   `class="spin"`。
5. 建议在 T12 顺手落地 I-3 的那条 `var()` 可解析性守卫(T12 是本批最后一个碰这套样式的任务)。

---

## 结论

产出物本身**零 Critical、零配色错误、零搬多、零搬少、零 T4 回退**:
239 行是蓝本 `2282-2452` 的逐字移植,7 处偏差全是 K2 授权的裸色→token 替换且 6 处精确命中附录 B 的桶;
43 个 `var()` 引用 100% 可解析;两个新 token 两档齐全且回源核对无误;
`k2pulse`/`k2spin` 逐字;五组属性态与 4 个修饰类无一遗漏;三门 312/2831 全绿、tsc 0、build 0。

3 条 Important 里 **2 条是守卫覆盖缺口**(I-2 成因在 T4、I-3 是全新发现的故障模式),
**1 条是流程口径**(I-1 该走 `NEEDS_CONTEXT`),没有一条要求改本次产出物的样式代码。

**Spec 合规 ✅ · 任务质量 通过。**

评审期间对仓库的全部改动均为 RED 探针,已逐次精确还原;
`git status --short` 空、`git diff --stat` 空,未做任何提交。
