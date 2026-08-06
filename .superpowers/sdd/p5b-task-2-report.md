# SP8-P5b · T2 报告 —— scss A:共享底座段

- 分支 `sp8-ai`,BASE `8a934db`(开工前 `git rev-parse HEAD` 实测一致)
- 改动文件 **2 个,+0 新文件**:`src/ai/styles/knowledge.scss` · `src/ai/styles/knowledgeStyles.test.ts`
- 蓝本:`NimoOS-UI` `git show main:src/views/AI/Knowledge/styles/knowledge.scss`(`main`@`7a6ee6b7`,2561 行,
  只用 `git show` 取,未 `cat`/`Read` 那个工作树、未在那里提交任何东西)

---

## 1. 七段各自搬了什么 / 落在哪

**落点裁定**:任务书「🔴 全部写在既有 `.knowledge-app { … }` 基础块内部(K9,整段重新嵌套),段序照蓝本原序」
按字面执行 —— 全部插进本仓**既有的壳段** `.knowledge-app { … }`(P5a T4 建的那个,原 `:240-562`),
不新起顶层块。这同时解决了一个**级联陷阱**(见 §1.1)。

| 段 | 蓝本行 | 搬了什么 | 落在本仓何处(改后行号) |
|---|---|---|---|
| S1 | `:241-252` | `.k-banner-close`(含 `&:hover`)+ `:250-252` 那条解释 `.k-view` 存在理由的注释 | 壳段内,原「k-banner-close 不搬」注释处(`:521-540`),即 `.k-banner-icon` 之后、`.k-view` 之前 |
| S2 | `:253-257` | `.k-view` | 紧接 S1,在既有 `.k-scroll` 之前(`:541-546`) |
| S3 前半 | `:735-817` | `.k-queue-head` · `.k-filter-pill`(+3 条组合选择器)· `.k-filter-pill-count` · `.k-done-stat/-num/-label` · `.k-toolbar` · `.k-toolbar-label` | 既有 `.k-skel` 之后、既有 `.k-btn` 之前(`:617-702`) |
| S3 中 | `:843-847` | **只**在既有 `.k-btn { … }` 内、`&.primary` 与 `&:disabled` 之间插入 `&.danger`(3 行声明) | `:721-728`,`.k-btn` 整块未重写 |
| S3 后半 | `:854-967` | `.k-table` · `.k-row`(含 `:first-child`/`[data-selected]`/`:hover:not(.k-row-head)`)· `.k-row-head/-check/-status/-name/-path/-time/-retry` · `.k-row[data-scope="distill"]`(含蓝本 `:923-925` 的 3 行解释注释)· `.k-row-badges/-error/-actions` · `.k-row:hover .k-row-actions` · `.k-row-action` · `.k-table-foot` | 既有 `.k-btn` 闭合之后(`:737-855`) |
| S4 | `:1296-1316` + `:1335-1341` | `.k-modal-bg` · `.k-modal` · `.k-modal-foot`(含内部 `.right`) | `:857-895` |
| S5 | `:1398-1428` | `.k-confirm-body` · `.k-confirm-icon` · `.k-confirm-title` · `.k-confirm-summary`(含嵌套 `b`) | `:897-943` |
| S6 | `:1484-1499` | `@media (max-width:860px)` 里的 `.k-row` 与 `.k-row[data-scope="distill"]`,含蓝本 `:1488-1494` 那 7 行 `//` 解释注释与 `:1498` 的 `> *:nth-child(6) { display: revert; }` | 并入**既有** `@media (max-width: 860px) { … }`(附录 D.6),`.k-mobile-tab` 之后(`:1075-1096`) |
| S7 | `:2031-2039` | `.kn-badge` + 4 条 `[data-s=…]`(draft/archived/curated/failed) | **K9 从顶层裸选择器重新嵌套**进同一个壳段,`@media (min-width:861px)` 之后、壳段闭合 `}` 之前(`:1102-1120`) |

编译产物验证(`pnpm exec sass` 输出):`.kn-badge` 已落成 `.knowledge-app .kn-badge`(K9 生效,
四条属性态相对基类的优先级差不变);`.right` 落成 `.knowledge-app .k-modal-foot .right`(未泄漏)。

### 1.1 为什么不新起一个顶层 `.knowledge-app` 块(**一个会静默吃掉 S6 的级联陷阱**)

若照 T11 仪表盘的先例把 S1–S5/S7 写成**追加在文件末尾**的新顶层 `.knowledge-app { … }` 块,
而 S6 按附录 D.6 并进**位置更靠前**的既有 `@media`,那么:

- 媒体查询里的 `.knowledge-app .k-row`(0,2,0)在**源码更早**,基础 `.knowledge-app .k-row`(0,2,0)在**更晚**;
- 同优先级 → **后写的赢** → 窄屏栅格覆写**永远不生效**(蓝本里基础 `:861` 在媒体 `:1484` 之前,顺序正好相反)。

写进既有壳段后,编译产物里基础 `.k-row` 在 **`:792`**、媒体覆写在 **`:1084`**,顺序与蓝本一致。已实测确认。

### 1.2 段范围的两处边界说明(未改内容,只说明取舍)

- **S5 `:1398-1430`**:`:1429` 是空行、`:1430` 是下一节的节标题注释 `/* Toast */`。`.k-toast` 按 **K3** 不搬,
  那条节标题跟着它走,故实际搬到 **`:1428`** 为止。scss 里已写明这一点。
- **S1 `:241-252`**:`:249` 空行 + `:250-252` 是解释 `.k-view` 为什么存在的注释(蓝本把它放在 `.k-view` 之前)。
  该注释**已照搬**,与 S2 相邻,合起来正好等于蓝本 `:241-257` 连续区间。

### 1.3 转录保真度的机器化核对(无回归网的补偿手段)

任务书点名「搬错一个嵌套层 / 串一个类名,三门都不会红」。故额外写了一次性脚本:
把蓝本 10 个子区间逐段取出 → 按 §2 的 22 处映射做**字符串替换** → 剥注释 + 折叠空白 → 断言
「归一化后的蓝本段是归一化后的新文件的**子串**」。**10/10 全部 `OK`**,任一嵌套层/属性/类名/顺序被改动都会 MISS:

```
OK    S1  :241-248   OK    S2  :253-257   OK    S3a :735-817   OK    S3d :843-847
OK    S3b :854-967   OK    S4a :1296-1316 OK    S4b :1335-1341 OK    S5  :1398-1428
OK    S6  :1484-1499 OK    S7  :2031-2039
```

(脚本是临时核对工具,未入库。)

---

## 2. 22 处色映射逐行回执(附录 B §B.2,**19 行 / 22 处**)

先用附录 B.7 的正则对**七段原文**独立重扫,得 **19 行**;其中 `:2036`/`:2038`/`:2039` 每行各 2 处 →
**22 处**,与 T0 勘误 E-4 完全一致(计划书的「18 处」是错的)。

| # | 蓝本行 | 原值 | 落地写法 | 备注 |
|---|---|---|---|---|
| 1 | `:247` | `rgba(0,0,0,0.06)` | `background: var(--line)` | `.k-banner-close:hover`;两档已有 |
| 2 | `:770` | `rgba(255,255,255,0.18)` | `background: color-mix(in srgb, var(--text-on-accent) 18%, transparent)` | 承 P5a `.k-empty-illust` 同款派生手法 |
| 3 | `:771` | `white` | `color: var(--text-on-accent)` | |
| 4 | `:774` | `rgba(255, 59, 48, 0.12)` | `background: var(--danger-soft)` | 两档已有 |
| 5 | `:778` | `rgba(255,255,255,0.22)` | `background: color-mix(in srgb, var(--text-on-accent) 22%, transparent)` | |
| 6 | `:779` | `white` | `color: var(--text-on-accent)` | |
| — | `:839` | `white` | `color: var(--text-on-accent)` | 🔴 **P5a 已做,本任务未触碰** |
| — | `:840` | `rgba(0,122,255,0.22)` | `box-shadow: 0 2px 6px var(--accent-soft-2)` | 🔴 **P5a 已做,本任务未触碰** |
| 7 | `:845` | `white` | `color: var(--text-on-accent)` | `.k-btn.danger`,本期新增 |
| 8 | `:846` | `#e6342a` | `background: var(--danger-hover)` | **新 token**(见 §3) |
| 9 | `:899` | `rgba(255, 59, 48, 0.12)` | `background: var(--danger-soft)` | `.k-row-status[data-state="failed"]`;`color` 蓝本原文已是 token |
| 10 | `:958` | `rgba(255, 59, 48, 0.12)` | `background: var(--danger-soft)` | `.k-row-action[data-tone="danger"]:hover`;同上 |
| 11 | `:1298` | `rgba(15, 20, 30, 0.32)` | `background: var(--modal-scrim)` | 两档 P5a 已声明 |
| 12 | `:1405` | `rgba(255, 59, 48, 0.12)` | `background: var(--danger-soft)` | `.k-confirm-icon` |
| 13 | `:1417` | `rgba(255, 59, 48, 0.06)` | `background: var(--danger-soft-faint)` | **新 token**(见 §3) |
| 14 | `:1418` | `rgba(255, 59, 48, 0.2)` | `border: 1px solid var(--danger-soft-border)` | 两档已有 |
| 15 | `:2036` a | `rgba(255,149,0,0.14)` | `background: var(--warning-soft)` | `.kn-badge[data-s="draft"]` |
| 16 | `:2036` b | `rgba(255,149,0,0.28)` | `border: 1px solid var(--warning-soft-border)` | |
| 17 | `:2038` a | `rgba(52,199,89,0.12)` | `background: var(--success-soft)` | `.kn-badge[data-s="curated"]` |
| 18 | `:2038` b | `rgba(52,199,89,0.25)` | `border: 1px solid var(--success-soft-border)` | **新 token**(见 §3) |
| 19 | `:2039` a | `rgba(255,59,48,0.12)` | `background: var(--danger-soft)` | `.kn-badge[data-s="failed"]` |
| 20 | `:2039` b | `rgba(255,59,48,0.25)` | `border: 1px solid var(--danger-soft-border)` | |

表里 20 行 = **22 处新落地映射中的 20 处 + 2 处 P5a 已做**。逐项对齐附录 B.2:B.2 共 19 行(含 `:839`/`:840`
两行 P5a 已做的),22 处 = 19 行里三行各 2 处。**本任务实际动笔的是 17 行 / 20 处**,另 2 处(`:839`/`:840`)
按 F1 判据「grep 现状,已存在即不动」原样保留。

**其它未计入映射的**:`:828` `border: 1px solid transparent`(`.k-btn.ghost`)—— `transparent` 是关键字不是配色,
P5a 已搬且原样保留;`:2037` `.kn-badge[data-s="archived"]` 蓝本原文全走 token(`--bg-chip`/`--text-tertiary`/`--line-faint`),
逐字照搬无需改。

**附录 B 表外的色字面量:0 处**(七段实扫 19 行全部在表内,无需 `NEEDS_CONTEXT`)。

---

## 3. 新 token 的两档声明(治理 §6.2 归属表 / 附录 B §B.1)

**只声明本段真正用到的**,归属**一律照归属表**,不按语义猜(计划书 §2 T2 第 4 条的枚举是笔误 = E-5):

| token | 暗档(`.knowledge-app`) | 浅档(`:root[data-theme="light"] .knowledge-app`) | 用在哪 | 出处 |
|---|---|---|---|---|
| `--success-soft-border` | `rgba(79, 184, 112, 0.28)` | `rgba(46, 158, 84, 0.2)` | 蓝本 `:2038` | `src/ai/styles/tokens.scss:307` / `:130`,**已 sed 逐行打开复核,逐字相同** |
| `--danger-soft-faint` | `rgba(240, 119, 107, 0.1)` | `rgba(215, 73, 59, 0.06)` | 蓝本 `:1417`(T6 段 `:1972` 复用) | `tokens.scss:314` / `:145`,**已复核** |
| `--danger-hover` | `#E35F52` | `#A83226` | 蓝本 `:846` | 全仓无源,**设计 §6.2 给定的十六进制,未重算** |

- **`--purple-soft` 未声明**(归属表判给 T6,T2 段一处都没用到)。
- 声明位置:两个 token 声明块内部(§6 唯一豁免区),规则段落零字面量。
- 已把 T11 那条「附录 B 另外 4 个候选……未声明」的注释补注成现状(避免评审看到自相矛盾)。

---

## 4. 七条「必须做到的」逐条回执

1. ✅ **`.k-btn` 只补 `&.danger`,不重写整块。** 现状块在 `knowledge.scss`(改前 `:496-526`);只在 `&.primary` 闭合
   与 `&:disabled` 之间插入 8 行(蓝本 `:843-847`,**按 E-10 用 `:843-847` 不是 `:844-848`**)。
   `git diff` 里 `.k-btn` 基类与 `.ghost/.outline/.primary/:disabled` 四个修饰**零改动行**。
2. ✅ **K17**:`.k-modal-head` / `.k-modal-title` / `.k-modal-x` / `.k-modal-body`(蓝本 `:1317-1334`)**未搬**;
   `.k-modal-foot` 里的 `.right` **已搬**。编译产物里 grep 这四个类名只命中注释,无规则。
   守法:「没有搬多」那条断言会把它们当白名单外的类报红(已扩正则后仍有效)。
3. ✅ **K10**:只搬 `:1398-1428` 的嵌套版;`:1676-1702`(治理文件写 `:1675-1703`,实测 `:1675` 是节标题注释、
   `:1703` 是空行)的顶层重复段**丢弃**。段头注释写明理由:嵌套版 `.knowledge-app .k-confirm-*`(0,2,0)
   完胜顶层版 `.k-confirm-*`(0,1,0)→ **Vue2 里从未生效过**。
   另新增一条守卫钉住「每个 `.k-confirm-*` 只有一份规则」(见 §5,含 RED 探针)。
4. ✅ **新 token 两档声明照归属表**,见 §3。`--purple-soft` 未声明,`--danger-soft-faint` 由 T2 声明。
5. ✅ **19 行 22 处逐行映射**,见 §2。表外字面量 0 处。
6. ✅ **R5 注释口径**:新增的所有规则段落注释一律「蓝本行号 + 中文描述」,零色字面量。
   全文色扫命中行号 `85…258`,全部落在两个 token 声明块区间内(暗块 `:84-181`、浅块 `:183-262`),
   **规则段落 0 命中**。
7. ✅ **重名 grep**:32 个新类对 `src/` 下**全部** `.scss`/`.css`(不止任务书点名的 4 个)做
   `grep -rnE "\.<cls>([^a-z0-9-]|$)"` 排除本文件后 —— **零命中**。
   附带:`.k-modal-foot` 内的 `.right` 与 `agent-styles.scss:1239` / `sk-shared.scss:149` 的 `.right` 同名,
   但三者都各自嵌在自己的作用域里(本仓这条编译成 `.knowledge-app .k-modal-foot .right`),不互相污染。

---

## 5. 守卫缺口① 的修法 + 白名单扩容

### 5.1 修法

`knowledgeStyles.test.ts`「没有搬多」那条的类名提取正则:

```diff
- const found = Array.from(new Set(css.match(/\.k2?-[a-z0-9-]+/g)  || [])).map((s) => s.slice(1))
+ const found = Array.from(new Set(css.match(/\.k(?:2|n)?-[a-z0-9-]+/g) || [])).map((s) => s.slice(1))
```

原因:`k2?` 吃掉 `k` 后**要求下一个字符是 `-`**,`.kn-badge` 的 `n` 直接让整个匹配失败。
本任务 S7 搬的正是 `.kn-*`,而蓝本 `:2040-2281` 还有几十个 `.kn-*` 是 P5d 的 —— 手滑多搬没人抓。
**这是扩大扫描范围,不是放宽断言**:被扫到的类仍必须全部在白名单内。已在测试文件里写了完整理由注释。

### 5.2 白名单

- `WHITELIST_102` → **`WHITELIST_134`**(常量名连带改,3 处引用全部跟着改:存在性断言、「没有搬多」、新增的长度断言)。
- 新增 **32 类 = 附录 D.1 原文**,粘贴前做了一次独立核对:把七段用 `sed` 抽出来
  `grep -oE '\.k[a-z0-9-]*-[a-z0-9-]+|…' | sort -u` 得 **34 个**,减去已在白名单的 `k-btn`(P5a 搬的基类)
  与 `k-scroll`(只在蓝本 `:250-252` 注释里出现)→ 恰好 **32 个**,与 D.1 逐一相同。
- 新增一条**长度防漂移**断言:`toHaveLength(134)` + 去重后仍 134(防重复项)。
- R2 的两档 token 数组 **6 → 9**(加 `--success-soft-border` / `--danger-soft-faint` / `--danger-hover`)。
  标题同步改成「9 个」。
- 浅色档**集合式**覆盖断言与「例外清单恰好 11 个」两条**未动**(3 个新 token 两档都声明了,差集不变)。
- `var()` 闭环守卫**未动**,自动覆盖了 3 个新 token 的引用(全绿 = 没有漏声明)。
- `@keyframes` 守卫**未动**(本段引用的 `k-pulse` / `k-fade-in` / `k-modal-pop` P5a 都已有,未新增 keyframes,
  也未重复定义)。

### 5.3 用例数

`knowledgeStyles.test.ts` **16 → 19 例(+3)**:白名单长度防漂移 · K10 单份守卫 · `--danger-hover` 取值钉死。
任务书估的是 +3~5,落在下沿:因为**正则扩容 / 白名单 +32 / R2 6→9 都是既有用例内部的扩容**,不产生新 `it`。

---

## 6. RED 探针(6 次,每次都 `git status --short` 确认还原)

> 还原手段:改动前先 `cp knowledge.scss` 到 scratchpad,每次探针后 `cp` 回来并 `grep -c` 确认残留 0。

### 探针 1 —— 规则段落塞色字面量

改:`.k-queue-head` 里加 `outline: 1px solid #ff0000;`(`:543`)。

```
 ❯ src/ai/styles/knowledgeStyles.test.ts (19 tests | 1 failed)
   × token 声明层之外,全文(含注释)零色字面量(#hex / rgb() / hsl() / oklch() / 具名色…)
AssertionError: 声明层之外出现 #hex: expected '/* 1:1 移植自 Vue2 src/views/AI/Knowledg…' not to match /#[0-9a-fA-F]{3,8}\b/
```

### 探针 2 —— 删掉某个新类的规则

改:删 `.kn-badge` 基类整块,并把 4 条 `.kn-badge[data-s=…]` 改名成 `.kn-badgeZ[...]`。

```
 ❯ (19 tests | 1 failed)
   × 134 个白名单类全部有对应规则(附录 D.4 自检命令①的常驻版)
AssertionError: 缺失的类:kn-badge: expected [ 'kn-badge' ] to deeply equal []
```

### 探针 3 —— 删掉浅色档一个新 token

改:从浅色块删 `--danger-soft-faint: rgba(215, 73, 59, 0.06);` 一整行。**三条同时报红,且都指名到具体 token**:

```
 ❯ (19 tests | 3 failed)
   × R2 —— 9 个本档用到的 *-soft/-scrim/-hover token 两档都有值(T4 的 4 + T11 的 2 + P5b-T2 的 3)
   × 暗色块声明的每一个颜色 token,浅色块必须也声明(白名单外漏一个就精确指名)
   × 例外清单当前恰好是这 11 个,不多不少(防止清单被悄悄扩大当垃圾桶)

AssertionError: 浅色档缺 --danger-soft-faint:: expected ':root[data-theme="light"] .knowledge-…' to contain '--danger-soft-faint:'
AssertionError: 浅色档漏声明的颜色 token(白名单外):--danger-soft-faint: expected [ '--danger-soft-faint' ] to deeply equal []
AssertionError: expected [ '--danger-soft-faint', …(11) ] to deeply equal [ '--font-mono', '--font-sans', …(9) ]
```

### 探针 4 —— **专为守卫缺口① 做**(两次输出)

🔴 **先说明一点口径**:任务书写的是「删掉 `.kn-badge` 的规则(或改名)→ 修正后的正则确实让它报红」。
实测后发现**这个动作隔离不出缺口①** —— 白名单的**存在性**断言用的是
`new RegExp('\\.'+c+'(?![\\w-])')`,对 `kn-badge` **本来就有效**(附录 D §D.0.1 也这么写),
所以「删掉 `.kn-badge`」在**修正则之前就已经报红**(= 探针 2 的结果),证明不了缺口。

缺口① 的真实方向是**反向**的:「多搬了白名单外的 `.kn-*` 没人抓」。故按附录 B §B.5 原文的处方做:
**往规则段落塞一条白名单外的 `.kn-foo { color: var(--danger); }`**。

**(a) 修正则之前** —— 旧正则 `/\.k2?-[a-z0-9-]+/g`,`.kn-foo` 在文件里(`:928`):

```
$ grep -n "kn-foo" src/ai/styles/knowledge.scss
928:  .kn-foo { color: var(--danger); }

 Test Files  1 passed (1)
      Tests  17 passed (17)
```

**17/17 全绿放行 —— 缺口①(白名单外的 `.kn-*` 完全不进扫描)实证成立。**

**(b) 修正则之后** —— `.kn-foo` 原样不动,只把正则换成 `/\.k(?:2|n)?-[a-z0-9-]+/g`:

```
 ❯ src/ai/styles/knowledgeStyles.test.ts (17 tests | 1 failed)
   × 没有搬多 —— 全部 k-/k2-/kn- 类都在白名单内(附录 D.4 自检命令②的常驻版)
AssertionError: 白名单外的类:kn-foo: expected [ 'kn-foo' ] to deeply equal []
- []
+ [ "kn-foo", ]
```

**缺口① 已咬住。** `.kn-foo` 随后删除,`grep -c kn-foo` = 0。

### 探针 5 —— 新增的 K10 守卫(自证有判别力)

改:在文件末尾追加蓝本 `:1676-1702` 那份顶层重复的 `.k-confirm-icon/-title/-summary`(= 模拟「K10 没执行」)。

```
 ❯ (19 tests | 1 failed)
   × K10 —— .k-confirm-* 每个类只有一份规则(蓝本 :1676-1702 的顶层重复段已丢弃)
AssertionError: k-confirm-icon 出现 2 次(应为 1;>1 说明 K10 丢弃的顶层重复段被搬了进来): expected 2 to be 1
```

### 探针 6 —— 新增的 `--danger-hover` 取值守卫(自证有判别力)

改:把暗档 `--danger-hover: #E35F52;` 改成 `#E86657`(模拟「有人按设计 §6.2 那句『亮度 −9%』重算」)。

```
 ❯ (19 tests | 1 failed)
   × --danger-hover 两档取值逐字等于设计 §6.2 给定值(治理 §6.2:禁止按"亮度 −9%"重算)
AssertionError: 暗档 --danger-hover 取值被改动: expected '.knowledge-app {\n  --bg-app: #1C1C1E…' to contain '--danger-hover: #E35F52;'
```

**全部还原确认**:`git status --short` 只剩两个目标文件为 `M`;
`grep -c "kn-foo\|ff0000\|E86657\|kn-badgeZ" knowledge.scss` = **0**;还原后 19/19 全绿。

---

## 7. 三门 + sass 实测

| 项 | 基线(`8a934db`,协调者实测) | 本任务收官 | 增量 |
|---|---|---|---|
| `pnpm test` | 313 文件 / 2879 例全绿 | **313 文件 / 2882 例全绿,exit 0** | **+0 文件 / +3 例** |
| `pnpm exec vue-tsc --noEmit` | 0 | **exit 0**,日志 0 行 | — |
| `pnpm build` | 0 | **exit 0**(只有既有 >500KB chunk 警告) | — |
| `pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null` | — | **exit 0** | — |

- **红项:0**。已知噪声(`persist.test.ts` IndexedDB flaky / `AgentComposer.test.ts` vue-i18n teardown)本轮**未出现**,未复跑。
- 完整日志落盘:`/tmp/p5b-t2-test.log` · `/tmp/p5b-t2-tsc.log` · `/tmp/p5b-t2-build.log`(未 `| tail` 截断)。
- **+3 例与任务书估的 +3~5 落在下沿**,原因见 §5.3(正则/白名单/R2 都是既有用例内部扩容)。
- `color-guard` 用例数不变(本任务 +0 个 `.vue`),符合治理 §8 的算术。

## 8. DoD 自检

| DoD | 结果 |
|---|---|
| 三门全绿 + `sass` 单独编译 exit 0 | ✅ |
| 规则段落色字面量 = 0(两个声明块除外) | ✅ 色扫命中行 `85–258` 全在 `[84,181]∪[183,262]` 两个声明块内 |
| `theme-exception` 逃逸 = 0 | ✅ `grep -c` = 0 |
| 白名单 134/134 | ✅ 存在性断言 + `toHaveLength(134)` + 去重 134 |
| 附录 B T2 段 19 行 22 处逐行核过 | ✅ §2 |
| 7 条「必须做到的」逐条回执 | ✅ §4 |

## 9. K/N 条目申报

- **命中并执行**:**K9**(S7 从顶层重新嵌套;另 S1–S6 全部写进既有 `.knowledge-app` 基础块)·
  **K10**(丢弃 `:1676-1702` 顶层重复 confirm,段头注释写明理由 + 新增守卫)·
  **K17**(`.k-modal-head/-title/-x/-body` 不搬,`.k-modal-foot` 的 `.right` 搬)·
  **K2 的下游**(3 个新 token 两档各给一份值,不留 `[data-theme="dark"]` 祖先选择器 —— 本段无此类选择器)
- **附录 D.5 / D.6**:`:1500-1503` 的 `.k-frow` 死规则**未搬**、未「顺手改成 `.k-frow-f`」;
  S6 并进**既有** `@media (max-width: 860px)`,未另起 `@media`;`:1488-1494` 那 7 行解释注释与 `:1498` 单行
  `display: revert` **一起照抄**。
- **本任务不涉及**:K1/K3–K8、K11–K16、K18–K20、N1–N14(那些都是 `.vue`/store/i18n/测试形状的条目;
  本任务零 `.vue`、零 i18n、零 mock、零 fixture)。
- **fixture / mock**:本任务**一份都没用到**(纯 scss + 纯文本断言,不发请求、不 mock service)。
- **未申报的偏离:无。**

## 10. 遗留疑问 / 交接项

1. **`.kn-badge` 的落点略特殊**:蓝本它在 `.knowledge-app` 大段(`:59-1509`)**之外**(`:2031`),
   本任务按任务书「全部写在既有基础块内部」把它嵌进了壳段末尾。语义与优先级都正确,
   但如果 **P5d** 将来要搬蓝本 `:2040-2281` 那一大批 `.kn-*`,建议它**另起**一个顶层
   `.knowledge-app { … }` 块(照 T11 仪表盘先例)并把本任务这一小段一并挪过去,让 `.kn-*` 家族聚在一处。
   现在不动,是为了守住本任务「不做无关重构」的边界。
2. **`--purple-soft` 留给 T6**(归属表),T6 落地时 R2 数组要从 9 扩到 10。
3. **T6 直接复用 `--danger-soft-faint`**(本任务已在两档声明),`:1972` 不要重复声明。
4. **T6 扩白名单时常量名要改成 `WHITELIST_187`**,并连带改 3 处引用(存在性 / 没有搬多 / 长度防漂移),
   长度断言的数字也要跟着改 —— 本任务已经把这条「名字即断言」的习惯延续下来了。
5. **编译产物里有 35 个空的 `.knowledge-app { /* 注释 */ }` 规则**(BASE 是 24 个),
   是 sass 把「嵌套块之间的独立注释」包成规则的既有行为,构建压缩会去掉,无视觉影响。
   本任务新增的段头注释让它从 24 涨到 35;已确保**没有新增具名空规则**(如 `.k-row-status {}`)。
