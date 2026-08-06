# P5e Task 2 报告 —— `knowledge.scss` 搬附录 D 的 TO-MOVE 全部类 + M-4

> 实现者自报,2026-08-05。起点 HEAD **`46cfdb1`**(自己现测确认:
> `git log --oneline -3` = `46cfdb1 test(p5e-t1b) / 277dd9c docs(p5e) / 669f605 docs(p5e-t1)`)。
> 改动文件 **仅 2 个**:`src/ai/styles/knowledge.scss` · `src/ai/styles/knowledgeStyles.test.ts`。
> **产品 `.vue` 零改动 · `src/styles/color-guard.test.ts` 零改动 · `.sp8/NimoOS-Service` 零改动 ·
> `package.json` / `pnpm-lock.yaml` 零改动 · 未部署 · 未 push · 未合 master · 零新依赖。**
> **禁用操作全程未用**:无 `git commit --amend`(裁定 R11)· 无 `git add -A/.` · 无 rebase/reset/stash/merge/push ·
> 只读仓 `NimoOS-UI` 全程只 `git show` · dev server(`:5288`/`:5273`/`:5277`/`:5299`)一个都没碰。

---

## 0. DoD-7 —— 开工第一动作:独立复现附录 D 的三个数(**在动手改任何东西之前**)

```
$ node .superpowers/sdd/p5e-fixtures/scripts/sim-r8r9.mjs
段清单:
  S1  351-367   .k-hero-suggest + .k-suggest-chip 基类(E-52)   17 行
  S2  457-549   Search page: sticky/box/clear/adv-*   93 行
  S3  573-681   results: k-results … k-rerank-warn   109 行
  S4  726-732   .k-skel-rcard   7 行
  S5  1540-1563 keyframes + k-match-pill + k-more-hint   24 行
  S6  1571-1673 k-drawer* / k-chunk* / @media   103 行
  KF  KFileViewer.vue:71-76 + :102-119(K46 砍 :77-101)   24 行

=== 「没有搬多」白名单正则 ===
现状        : 292 类
追加 P5e 后 : 347 类
新增 55 个: [逐字与附录 D §D.7.1 的代码块相同,55 个]
丢失(必须为空): (none)

常量 WHITELIST_293 现长度 293;其中已含本期新类 0 个
=> 常量终值 = 293 + 55 = 348

=== NON_K_HELPER_CLASSES ===
现状 16: ["danger","dot","ghost","lbl","mono","outline","primary","right","second","sep","spacer","spin","suffix","text","warn","wide"]
追加后 19: ["chev","danger","dot","ghost","h-md","lbl","mono","outline","path","primary","right","second","sep","spacer","spin","suffix","text","warn","wide"]
新增: ["chev","h-md","path"]
=> NON_K_HELPER_CLASSES 终值 = 19
exit=0
```

```
$ node .superpowers/sdd/p5e-fixtures/scripts/classes2.mjs | tail
--- 合计 74 个 token ---
TO-MOVE: 54          [chev k-adv-chip … k-skel-rcard path]
ALREADY-MOVED: 17    [ghost k-btn k-empty … k-suggest-chip outline primary]
NO-RULE-EITHER-SIDE: 3  [k-fileviewer-empty k-fileviewer-fallback k-fileviewer-host]
exit=0
```

| 量 | 附录 D / 裁定 R8 的终值 | 我的独立复现 |
|---|---|---|
| `NEW_RE` 扫出类数 | 292 → **347** | ✅ **292 → 347** |
| 白名单常量长度 | 293 → **348** | ✅ **293 → 348** |
| `NON_K_HELPER_CLASSES` | 16 → **19** | ✅ **16 → 19** |
| TO-MOVE 清单 | 74 = 54 / 17 / 3 | ✅ **74 = 54 / 17 / 3** |

**落地后对真实文件的实测**(独立脚本,把 `stripComments` / `NEW_RE` / `nonKClassNames` 从
`knowledgeStyles.test.ts` 逐字复制):

```
NEW_RE 扫出类数 = 347
NON_K 实测 = 19 ["chev","danger","dot","ghost","h-md","lbl","mono","outline","path","primary",
                 "right","second","sep","spacer","spin","suffix","text","warn","wide"]
顶层裸选择器 = [".nme-content .ProseMirror"]
depth-0 全部 = [".knowledge-app, .parser-app", ":root[data-theme=\"light\"] .knowledge-app, …",
  ".knowledge-app", ".nme-content .ProseMirror", "@keyframes k-float", "@keyframes k-pulse-orb",
  "@keyframes k-pulse", "@keyframes k-shimmer", "@keyframes k-fade-in", "@keyframes k-modal-pop",
  "@keyframes k-toast-rise", "@keyframes row-done", "@keyframes k-drawer-fade",
  "@keyframes k-drawer-in", ".knowledge-app", ".knowledge-app", "@keyframes k2pulse",
  "@keyframes k2spin", ":root[data-theme=\"light\"] .knowledge-app .k2-ob-layer .k2-tag"]
```

🔴 **「常量长度 348 ≠ 扫出数 347」那 1 差我没有去「修平」**。已按裁定 R8 在
`knowledgeStyles.test.ts` 的常量头注释里记下真因(`knowledge-app` 匹配不上 `NEW_RE` 的
`k(?:2|n)?-` 分支 —— `kn` + `o`)并**明写附录 §D.7.1 给的「贪婪吃前缀」理由是错的**。

⚠️ **基线守卫已按提示用 PRE 副本重跑**(避免「T2 搬过之后双算」):
`P5E_SCSS=<PRE 副本> node sim-r8r9.mjs` → 仍是 `292 → 347` / `16 → 19`,
且「常量 WHITELIST_348 现长度 348;其中已含本期新类 55 个 => 348 + 0 = 348」——
自洽:常量已加完,scss 侧的增量与常量侧的增量对齐,零丢失(`lost = (none)`)。

---

## 1. 逐段「蓝本行段 → New-UI 落点」对照 + 程序化逐字比对

### 1.1 落点(按**蓝本相对源序**插,不是追加到文件末尾)

| # | 蓝本行段 | 内容 | New-UI 落点 | 为什么在这 |
|---|---|---|---|---|
| **S1** | `knowledge.scss:351-367`(17) | `.k-hero-suggest` + **`.k-suggest-chip` 基类** | 主 `.knowledge-app` 块内,既有「P5b-T2 · S2(蓝本 :253-257)」之后 / 「Empty / loading(蓝本 :683-715)」之前 | 蓝本序 `257 < 351 < 683` |
| **S2** | `:457-549`(93) | Search page:sticky / inner / box / clear / adv-toggle + `.chev` / adv-panel / field / label / chips / chip | 紧接 S1 | 蓝本序 `367 < 457 < 683` |
| **S3** | `:573-681`(109) | `.k-results` … `.k-rerank-warn`(含 `.k-rcard-*` / `.k-rel*` / 嵌套 `mark` / `.h-md` / `.path`) | 紧接 S2 | 蓝本序 `549 < 573 < 683` |
| **S4** | `:726-732`(7) | `.k-skel-rcard` | 主块内既有 `.k-skel` 基类(蓝本 `:720-725`)之后 / 「S3 前半(蓝本 :735-817)」之前 | 蓝本序 `725 < 726 < 735` |
| **S5** | `:1548-1562`(15) | `.k-match-pill` + `.k-more-hint`(含 `b` / `.chev` / `.k-rcard:hover` 三条后代) | **新建的顶层 `.knowledge-app { … }` 块**,顶层 keyframes 区之后 / Dashboard v2 段(蓝本 `:2282-2452`)之前 | 蓝本自己这段就是一个独立顶层 `.knowledge-app` 块(`:1547-1673`),**原样保留那层包裹**(附录 D §D.8);蓝本序 `1539 < 1548 < 2282` |
| **S6** | `:1572-1672`(101) | `.k-drawer-bg` … `.k-chunk-viewer-foot` + 嵌套 `@media (max-width: 720px)` | 紧接 S5,同一个新块内 | 同上 |
| **KF** | `KFileViewer.vue:71-76` + **`:102-119`** | `.k-fileviewer-host` / `-fallback` / `-empty` | 同一个新块内,`@media` 之后,独立小节标注 | **K44**:`.vue` 侧零 `<style>` 块 |
| **KF-@** | `knowledge.scss:1541-1545` | `@keyframes k-drawer-fade` / `k-drawer-in` | **顶层全局 keyframes 区**(既有 `row-done` 之后) | 本档既定惯例(T4/T11/T6 三批都这么做):嵌进选择器的 `@keyframes` 会跟着作用域走,而 `animation: X` 引用不带作用域前缀 |
| **Token** | 附录 B §B.0 的 17 处色字面量 | 8 个声明 × 2 档 | 暗档块(选择器 `.knowledge-app, .parser-app {`)与浅档块各自末尾、`color-scheme` 之前 | 与既有 K39/P5c-T2a 分组同款位置 |

🔴 **M-1 已遵守**:KFileViewer 的搬运范围是 **`:71-76` + `:102-119`**(裁定 R3.1 / M-1)。
附录 B §B.4 / D §D.2 正文写的 `:103-119` 会丢掉 `:102` 那个闭合 `}`。我按订正后的范围搬,
`sass` 门 exit 0 也侧面证实闭合正确。

### 1.2 🔴 程序化逐字比对(不是眼看)

写了 `seg-diff.mjs`:从 `7a6ee6b7` 现取蓝本 → 按上表行段切片 → 剥注释/空行只留规则行 →
**对蓝本侧套用附录 B §B.0 声明的 14 条 token 映射** → 在 New-UI 的规则行序列里找**连续等价子序列**,
并要求**每一段的起点都在前一段终点之后**(= 相对顺序保序)。

```
✅ S1: 17 行逐字连续等价(New-UI 规则行序号 338..354);顺序在前一段之后
✅ S2: 90 行逐字连续等价(New-UI 规则行序号 355..444);顺序在前一段之后
✅ S3: 105 行逐字连续等价(New-UI 规则行序号 445..549);顺序在前一段之后
✅ S4: 7 行逐字连续等价(New-UI 规则行序号 590..596);顺序在前一段之后
✅ S5: 15 行逐字连续等价(New-UI 规则行序号 1784..1798);顺序在前一段之后
✅ S6: 98 行逐字连续等价(New-UI 规则行序号 1799..1896);顺序在前一段之后
✅ KF: 23 行逐字连续等价(New-UI 规则行序号 1897..1919);顺序在前一段之后

全部 7 段逐字连续等价 + 相对顺序保序 ✅
```

⇒ **结构 / 顺序 / 嵌套逐字一致 · 边界无截断 · 无重复定义**(「连续等价子序列」这个判据同时
覆盖三件事:少一行→找不到;多一行→找不到;顺序乱→找不到)。
搬入的**规则行合计 355 行**(17+90+105+7+15+98+23);`git diff --stat` 的 `knowledge.scss +565`
差额是申报注释与 token 声明,不是代码。

### 1.3 声明的 token 映射(附录 B §B.0 逐处,共 14 条替换规则 / 覆盖 17 处字面量)

| 蓝本 `file:line` | 蓝本字面量语义 | New-UI |
|---|---|---|
| `knowledge.scss:599` | `.k-rcard-icon` 纸片底色(具名) | `var(--paper-surface)` |
| `:616` | `.k-rcard-tag` 实底胶囊上的前景(具名) | `var(--text-on-accent)` |
| `:618` / `:619` / `:620` / `:621` / `:622` | `[data-kind]` 五个不透明实底 | `var(--rtag-pdf/-md/-doc/-txt/-code)` |
| `:639` ×2 / `:640` ×2 / `:641` ×2 | `.k-rel[data-level]` 三档(半透明底 + 实前景) | `var(--success-soft)/var(--success)` · `var(--warning-soft)/var(--warning)` · `var(--danger-soft)/var(--danger)` |
| `:1574` | `.k-drawer-bg` 冷调半透明遮罩 | `var(--modal-scrim)` |
| `:1582` | `.k-drawer` 方向性投影(整条 `box-shadow`) | `var(--shadow-drawer)` |
| `:1660` | `.k-chunk-content mark` 正文高亮底 | `var(--mark-hl-bg)` |
| `KFileViewer.vue:75` | `.k-fileviewer-host` 底色 | `var(--bg-canvas)`(**K47**) |
| `KFileViewer.vue:84` | `::v-deep .overlay` 底色 | 🔴 **随 K46 整段删除,不搬** |

**附录 B 用到的行**:§B.0 全表(20-39 行)· §B.1 全表(54-62)· §B.2.1(70-92)·
§B.2.2(96-108)· §B.2.3(112-128)· §B.4(191-199)· §B.4.1(219-228)· §B.5(234-241)。
🔴 **附录 B 表以外的色字面量:零处**(全文色扫见 §5),**没有任何一处需要 `NEEDS_CONTEXT`**。

### 1.4 新建 / 补声明的 token(8 个 × 2 档 = 16 行)

| token | 暗档 | 浅档 | 性质 |
|---|---|---|---|
| `--paper-surface` | `#ffffff` | `#ffffff` | 🔴 **不是新建** —— 本档尚未声明的**既有例外 token**(AI `tokens.scss:342`/`:193`) |
| `--rtag-pdf` | `#FF3B30` | 同 | 新建,theme-invariant;与 `--kind-pdf` 逐字同值 |
| `--rtag-md` | `#1a1a1a` | 同 | 新建;与 `--kind-md` 逐字同值 · 🔴 **验收拍板项** |
| `--rtag-doc` | `#007AFF` | 同 | 新建;与 `--kind-doc` 逐字同值 |
| `--rtag-txt` | `#34C759` | 同 | 新建;与 **`--kind-xls`** 逐字同值(⚠️ **不是** `--kind-txt`) |
| `--rtag-code` | `#AF52DE` | 同 | 新建;与本档 `--purple` 逐字同值 |
| `--shadow-drawer` | `-20px 0 60px rgba(0, 0, 0, 0.55)` | `-20px 0 60px rgba(40, 35, 25, 0.10)` | 新建整值阴影 token,**两档不同值**(裁定 R4) |
| `--mark-hl-bg` | `rgba(255, 235, 0, 0.22)` | `rgba(255, 235, 0, 0.40)` | 新建,**两档不同值** · 🔴 **验收拍板项** |

- 每一行**声明处都有行尾注释写明蓝本 `file:line` + 仓内同值出处**;分组头注释写明附录 B 小节号。
- 🔴 **注释里零色字面量**(裁定 R17):理由描述一律用中文语义词(「纯色投影」「暖调投影」
  「中性灰」「浅灰白」),**没有写任何英文具名色或 hex/rgba**。全文含注释色扫(§5)+ 三条
  专门的 RED 探针(P15/P16/P17)证明这条真有牙。
- `--rtag-*` 另起前缀而不借 `--kind-*` / `--purple` 的名字,三条理由逐字写在声明处注释里
  (核心是 `--kind-txt` **同名异值**,借名会造成全仓同名两值)。**并配了反向断言:本档
  不许出现 `--kind-txt:`**。
- 🔴 **浅档 `--mark-hl-bg` 用附录 B §B.2.3 表里的 `0.40`**;蓝本 `:1660` 原文写 `0.4` ——
  **数值完全相同**,取表里的两位小数写法与本档 `--shadow-lg: … 0.10` 的既定写法一致。**显式申报。**

---

## 2. 🔴 24 个死代码类 —— 一个都没搬

### 2.1 落地

新增常量 `BLUEPRINT_DEAD_CLASSES`(24 项,逐字抄自 `p5-master-plan.md` §2.2 / 附录 D §D.3)
+ **26 条断言**:
- 1 条「24 个死类在 `knowledge.scss`(剥注释后)零出现」(集合形式,报红时精确指名)
- 1 条「死类清单恰好 24 项(7+5+6+6),无重复」(清单不许被悄悄缩短)
- 🔴 **24 条参数化独立用例**(每个类一条)—— **防空循环**:`--reporter=verbose` 逐条数到
  `死类 k-hero 零出现` … `死类 k-progress-fill 零出现` **24 条全在 passed 列表**(非 skip/todo),
  已在 §6 贴出。

判据口径:`(?![\w-])` 负向前瞻,🔴 **没有用 `\b`** —— `\b` 在字母↔连字符过渡处同样成立,
`/\.k-hero\b/` 会被本刀真要搬的 `.k-hero-suggest` **假命中**(E-25 的坑)。

### 2.2 🔴 「白名单报红时先回查死类清单、不许改白名单」—— 这条我已遵守

**本刀全程一次都没有为了让自己绿而修改白名单的数字或内容。**
白名单的每一次改动都只有一个来源:**附录 D §D.7.1 逐字列出的 55 个类**(独立复现过,见 §0)。
落地过程中:
- 三门与守卫在**第一次**跑就全绿(没有出现「报红→改数字」的循环);
- 唯一一次意外报红是自查里的死类 raw-grep(见 §2.3),它**不是**白名单断言,处置方式是
  **改我自己的注释写法 + 记勘误**,**没有动任何清单**。

### 2.3 🔴 新勘误 —— 附录 D §D.3 的复现命令在 **T2 之前的基线上就已有 2 处假阳性**

附录 D §D.3 写「T0 现测基线(2026-08-05):24 个死类在 `src/ai/styles/knowledge.scss` 里
**0 个出现** ✅」,并给了一条对**原始文本**裸 `grep` 的复现命令。**实测那条命令在 PRE-T2
副本上就报 2 处**:

```
$ 对 T2 之前的 knowledge.scss 副本跑附录 D §D.3 的原命令
PRE-LEAKED(raw): k-quick-grid
PRE-LEAKED(raw): k-progress-card
```

来源是本档**三条既有注释**里带前导点的类名引用:`knowledge.scss:61` / `:1318`(N15 说明:
「蓝本 :1151-1157 的 `.k-progress-card` / -row / …」)· `:1605`(「蓝本 :1482-1483 的
`.k-quick-grid` /…」)。**剥注释后两侧都是零**:

```
knowledge.PRE-T2.scss stripped leaked = []
knowledge.scss        stripped leaked = []
```

⇒ **附录 D §D.3 的 raw-grep 命令不是权威判据**(它把注释里的说明文字当成真泄漏);
权威判据是新加的那条跑在**剥注释后** `css` 上的断言。
**处置**:① 断言跑在剥注释后的文本上,并在注释里写明这件事;
② 我自己的 S1 段说明注释**刻意不写带前导点的死类名**(改写成「k-hero 系」「k-stat 系」
「k-quick 系」),避免给那条有瑕疵的命令再添噪音;③ 既有的三条注释按「反转不删」**不动**。
🔴 **登记为本报告的勘误项,请协调者决定是否入裁定书/附录订正。**

---

## 3. 🔴 不许重复搬 —— 逐条自证

| 类 | 归属 | 自证 |
|---|---|---|
| `.k-seg` | K43(P5d-T2) | 本档 `.k-seg` 规则**仍只有一份**(在既有位置);S2 段搬到蓝本 `:549` 为止,**没碰蓝本 `:551-571`** |
| **`.k-btn.text`** | K45(P5d-T2) | 🔴 S5/S6 段**跳过蓝本 `:1564-1570` 那 7 行**。「`.k-btn{…}` 区间内 `&.text` 恰好 2 次」的计数断言**全程绿** ⇒ 没有重复搬 |
| `.k-btn.outline` | P5a | 同上,`:1564-1568` 是蓝本自己的重复段(它在 `:831` 也有一份),未搬 |
| `.k-empty` / `-illust` / `-title` / `-sub` / `-tips` / `-tip` | P5a | S3 段搬到蓝本 `:681` 为止,**没碰 `:683-717`** |
| `.k-skel` **基类** | P5a | S4 段从蓝本 `:726` 起,**不含 `:720-725`** |
| `.k-modal-x` / `.k-row-action` / `.k-scroll` / `.k-btn` | P5a/P5b | 本刀零改动;「K10 每个 `.k-confirm-*` 只有一份规则」等既有断言全绿 |
| 🔴 **`.k-skel-rcard`** | **本期必搬** | ✅ 已搬(蓝本 `:726-732`)。并**顺手订正**了 `.k-skel` 上方那句已过期的注释「`k-skel-rcard` 不在白名单」——**按「反转不删」保留原文 + 加一段 P5e 订正块** |

---

## 4. 🔴 E-52 `.k-suggest-chip` 基类

**落地**:基类(蓝本 `:357-367`)搬进主 `.knowledge-app` 块的 S1 段,**行号 < 那条
`.k2-suggest .k-suggest-chip { white-space: nowrap; }` 覆盖**(蓝本源序:基类 `:357` / 覆盖 `:2291`)。

**两条断言**:
1. `基类声明行号 < k2 后代覆盖行号` —— 用**保行版 `blankComments()`**(新加,手法逐字照
   `parserStyles.test.ts:43-48` 的既定先例)+「整行 trim 后精确匹配」定位,**不是子串搜索**
   (承本档四次「子串检查抓不住真实缺陷」的教训)。判据:**调换 → 报红**(探针 P2)。
2. `基类块含蓝本 :358-366 的六项声明 + :hover`(漏一条即 E-52 没补干净)。判据:
   **删掉 `border-radius` → 报红**(探针 P12)。光有顺序不够。

🔴 **注释与用例名里没有写「防级联反掉」**(裁定 R7 / 勘误 E-56)。写的是:
- **顺序断言的价值 = 钉蓝本源序的移植忠实性**;
- 并**明写为什么那个理由是假的**:基类 `(0,2,0)` vs 覆盖 `(0,3,0)`,且覆盖**只声明
  `white-space`** ⇒ **属性集完全不相交、顺序不影响任何渲染**。

✅ **E-52 的另一半已在注释里写明**:P5a 只搬了覆盖、**基类整条漏搬**,而蓝本
`DashboardView.vue:292` 与 `SearchView` **都在用它** ⇒ **P5a 已交付的仪表盘建议 chip 缺全部
基类样式(圆角/内距/边框/底色/hover)= 已交付产出里的真实视觉缺陷,本刀补。**
⇒ 验收清单那条「顺带看一眼仪表盘的建议 chip」照原样保留(附录 D §D.4 末)。

---

## 5. 🔴 配色

### 5.1 全文色扫结果

`knowledgeStyles.test.ts` 的「token 声明层之外,全文(**含注释**)零色字面量」断言**全程绿**。
它跑在**未剥注释的 `rawSource`** 上,只切掉两个 token 声明块的字符区间,覆盖
`#hex` / `rgb()` / `rgba()` / `hsl()` / `oklch()` / `lab()` / `lch()` / `hwb()` / `color()` +
8 个具名色(`white`/`black`/`red`/`green`/`blue`/`orange`/`gray`/`grey`,双向 `(?![\w-])`)。

🔴 **三条 RED 探针证明它对我的新增段真有牙**(不是「反正现在是绿的」):

| 探针 | 注入 | 结果 |
|---|---|---|
| **P15** | 新增段**规则里**塞裸 hex(`.k-rerank-warn` 加一行前景色) | ✅ RED |
| **P16** | 新增段**注释里**塞裸 hex | ✅ RED |
| **P17** | 新增段**注释里**塞英文具名色 | ✅ RED |

🔴 **零 `theme-exception` 逃逸**(全文 `grep` 无该字符串)。

### 5.2 三处「附录 B 定死的色字面量」

- `.k-rcard-tag[data-kind]` 五个实底 → `--rtag-*` ✅
- `.k-rel[data-level]` 三组半透明底 + 三实字色 → `--success/warning/danger` 家族 ✅
- `.k-chunk-content mark`(`:1660`)高亮 → `--mark-hl-bg` ✅

⚠️ **另两条 `mark` 规则没有一起改** —— 并配了一条专门的断言
「三条 mark 规则各归其位」(附录 D §D.6):`.k-rcard-snippet mark`(`:653`)与
`.k-chunk-item-preview mark`(`:1645`)必须仍是 `var(--accent-soft)` / `var(--accent)`、
且**不含 `--mark-hl-bg`**;只有 `.k-chunk-content mark` 用 `--mark-hl-bg`。
断言带**覆盖度自检**(至少抓到 3 条 mark 规则,防正则失效导致零判别力)。
判据:**把 `.k-rcard-snippet mark` 也改成 `--mark-hl-bg` → 报红**(探针 P7)。

### 5.3 🔴 两档方位与主题写法

- 浅色档 = `:root[data-theme="light"] .knowledge-app, :root[data-theme="light"] .parser-app { … }`
- 暗色档 = 基础块 `.knowledge-app, .parser-app { … }`
- 🔴 **没有照抄蓝本的 `[data-theme="dark"] .knowledge-app`** —— 本刀搬的 7 段里蓝本本来就
  没有这种块(蓝本那两处在 `:1862`/`:1895`/`:2443`,分属 P5b-T6/P5a 的段,早已按 K2 并档)。

### 5.4 🔴 第四个嵌套主题作用域的重名串号排查(单测与 color-guard 都抓不到,只能人肉)

对 55 个新类 + `k-suggest-chip` + `chev` / `path` / `h-md`,逐个在
`src/ai/styles/*.scss` 与 `src/styles/*.css`(排除 `knowledge.scss`)里做选择器位置匹配:

```
COLLIDE: chev  ->  src/ai/styles/agent-styles.scss
COLLIDE: path  ->  src/ai/styles/parser-styles.scss
scan-done   (其余 56 个零命中)
```

**逐个查实,两处都不串号**:

| 类 | 别处的完整选择器 | 我这边的完整选择器 | 判定 |
|---|---|---|---|
| `chev` | `agent-styles.scss:663/:664`,在顶层 `.agent-app { … }`(`:8`)块内 | `.knowledge-app .k-adv-toggle .chev` / `.knowledge-app .k-more-hint .chev` | ✅ 祖先根不同(`.agent-app` vs `.knowledge-app`),两侧都要各自的父类;不相交 |
| `path` | `parser-styles.scss:154`,在 `.parser-app .parser-test-page { … }`(`:162`)内 | `.knowledge-app .k-rcard-meta-item .path` | ✅ 同上;即便 `.parser-app` 与 `.knowledge-app` 共用 token 块,规则侧仍各要 `.parser-test-page` / `.k-rcard-meta-item` 祖先,不相交 |

⇒ **零串号**。

---

## 6. 🔴 K46 / K47 落地

### 6.1 保留的三个属性(**三条独立断言**)

| 断言 | RED 探针 | 结果 |
|---|---|---|
| `K46-③a` `.k-fileviewer-host` 有 `position: fixed;` | **P3** 拿掉它 | ✅ RED |
| `K46-③b` 有 `inset: 0;` | **P4** 拿掉它 | ✅ RED |
| `K46-③c` 有 `z-index: 1100;` | **P5** 拿掉它 | ✅ RED |
| `K47` 底色是 `var(--bg-canvas)` | **P10** 换成别的 token | ✅ RED |
| `.k-drawer-bg` 是 `z-index: 1050` 且 `< 1100` | (与上面同族,数值断言) | 绿 |

🔴 **三条分开写而不是一条 `toContain` 三次** —— 一条断言里塞三个 `toContain`,vitest 在第一个
失败处就停,后两个失去判别力(本档 R4 那条「4 个 token 共享一个断言、改坏 1 个仍全绿」的
教训同款)。三条各自独立报红,已由 P3/P4/P5 三次独立探针逐条证明。

**注释里引了 `ViewerShell.vue:24`**(实读:`position: absolute; inset: 0; z-index: 200;
overflow: hidden;`)说明**为什么必须 `fixed`**:`ViewerShell` 需要一个**铺满视口的定位祖先**,
拿掉 host 的 `fixed` 会让预览器**塌进文档流**。

### 6.2 不搬的三条 `::v-deep`

蓝本 `KFileViewer.vue:77-101` 整段(含 `:84` 的一处色字面量)**不搬**。

**四条断言**:`.overlay` / `.v-container` / `.doc-container` **各一条**「在 `knowledge.scss`
(剥注释后)零出现」+ 一条「全文零 `::v-deep` / `:deep(`」。
判据:**把 `.k-fileviewer-host .overlay { position: absolute; inset: 0; }` 加回去 → 报红**
(探针 P6,同时也触发了 NON_K 登记表那两条 —— 双重网)。

⚠️ **诚实登记**(已写进 scss 注释,不许写成「全仓零 `.overlay`」):
`.overlay` **不是全仓零命中** —— `ViewerShell.vue:9` 会吐 `<div class="overlay">`。
**但这不削弱 K46,反而加强它**:`ViewerShell.vue:23-29` 的 scoped 规则已经把
`position/inset/z-index/overflow/flex` 全给了 `.overlay`,**正好就是蓝本那条 `::v-deep .overlay`
想补的东西**,补丁纯属重复。本断言的范围明确写成「**knowledge.scss 内**」。

### 6.3 `.k-modal-bg` 的 z-index

✅ **照搬,零决定**(裁定 R3.1 / M-3):蓝本 `:1302` 与本仓既有值都是 1100,与
`.k-fileviewer-host` 的 1100 **并列是蓝本原生行为**;`.k-drawer-bg` 的 1050 低于两者,不撞。
本刀**没有改动 `.k-modal-bg` 一个字**。

---

## 7. 守卫更新 + M-4 + §9.10 加固自证

### 7.1 改了什么

| 改动 | 内容 |
|---|---|
| `WHITELIST_293` → **`WHITELIST_348`** | 常量名跟着数字改(本档既定习惯);追加附录 D §D.7.1 逐字列出的 55 个类;三处引用同步改名 |
| `NON_K_HELPER_CLASSES` 16 → **19** | 追加 `chev` / `path` / `h-md`,**每条逐条写明蓝本出处与语义**(附录 D §D.7.2 要求) |
| 两条数字断言 | `白名单恰好 348 项` · `NON_K_HELPER_CLASSES 常量恰好 19 项` |
| describe 标题 | `(293 个,…)` → `(348 个,… + P5e-T2)`;`R8 终值 16` → `P5e 终值 19` |
| **新加** `blankComments()` + `cssKeepLines` | 保行版剥注释,手法逐字照 `parserStyles.test.ts:43-48` |
| **新加** 两个定位辅助 | `lineIndexOfExact()` / `nestedBlockBody()`(整行 trim 精确匹配 + 大括号配对) |
| **新加** 40 条断言 | 见 §7.3 |
| **M-4** | `knowledgeStyles.test.ts` 那条用例名改准 |

🔴 **既有的 `findKBtnBlockRange` / `declBlockRange` / `depthZeroSelectors` / `nonKClassNames` /
`stripComments` / 每一条既有断言体 —— 一行未动**(新辅助函数是**新加的**,没有把既有函数
「顺手抽象」成通用版,避免碰已过评审的代码)。

### 7.2 M-4(只改用例名,不动断言)

- 原名:`K45 —— &.text **只在** .k-btn{…} 作用域内出现,恰好 2 次(…)`
- 新名:`K45 —— .k-btn{…} **区间内** &.text 恰好 2 次(…)`
- **断言体一行未动**(`git diff` 可逐行核)。注释里写明为什么原名过宽:断言只在
  `.k-btn { … }` 区间内计数,对区间**之外**是否还有 `&.text` 一无所知(真要守「只在」,
  得再加一条「全文计数 − 区间内计数 === 0」)。

### 7.3 K44 —— 顶层裸选择器:**用具名例外机制,不放宽正则**

本期 **一个顶层裸选择器都没新增**:7 段全部包在 `.knowledge-app` 里(S1–S4 进主块;
S5/S6/KF 进新建的顶层 `.knowledge-app { … }` 块 —— **原样保留蓝本自己那层包裹**)。
⇒ `bareTopLevelSelectors()` 那条**集合相等**断言仍是 `['.nme-content .ProseMirror']`,
**一字未改**,实测输出见 §0。
🔴 **没有为了让自己绿而放宽那条正则**(那是违 §9.10 的 Critical 路径)。
**也没有往那个例外集合里加成员** —— 因为不需要:实测确认 KFileViewer 的三个类
包进 `.knowledge-app` 后**不需要**顶层身份(`position: fixed` 相对视口定位、与祖先无关)。
⚠️ 「`.knowledge-app` 祖先链上有没有 `transform`/`filter`/`will-change`」这项实测按附录 D §D.8
**派给 T4**,本刀不越权。

### 7.4 🔴 §9.10 —— 「加固而非改弱」的**程序化**证明(自我声明不算)

```
从测试文件真实读出:WHITELIST_348 = 348 · NON_K = 19
推出的 P5d 旧常量:  WHITELIST_旧 = 293 · NON_K_旧 = 16

---- T2 之前(PRE) ----
  断言① 覆盖面:旧常量要求 293 个类各有规则 → missing 0
             新常量要求 348 个类各有规则 → missing 55
  NON_K 实测 = 16
    集合相等 vs 旧 16 项 → PASS
    集合相等 vs 新 19 项 → FAIL

---- T2 之后(NOW) ----
  断言① 覆盖面:旧常量要求 293 个类各有规则 → missing 0
             新常量要求 348 个类各有规则 → missing 0
  NON_K 实测 = 19
    集合相等 vs 旧 16 项 → FAIL(差集 ["chev","h-md","path"])
    集合相等 vs 新 19 项 → PASS

---- 加固判据(把 .k-skel-rcard 规则改名,模拟"漏搬") ----
  旧常量(293 项)断言① missing = 0            → 旧守卫放行(零判别力)
  新常量(348 项)断言① missing = ["k-skel-rcard"] → 新守卫精确指名
```

⇒ ① 断言①「N 个白名单类全部有对应规则」的**覆盖面 293 → 348,严格变严 = 加固**
(旧守卫对「漏搬 `.k-skel-rcard`」零判别力,新守卫精确指名 —— 这就是「加固前 X 命中 N /
加固后 1」的等价形态,照 P5d-T8 `NoteEditPane.test.ts:533-542` 的先例)。
② `NON_K` 登记表 16 → 19 是**被迫的**:对 T2 后的 scss,保持 16 项会让**集合相等**断言
精确报红(上表 `FAIL(差集 ["chev","h-md","path"])`)⇒ 加长登记表 = 新扫到的类必须逐条
写明出处,**集合相等的判据本身没有放宽**(多一个少一个都报红,探针 P13 实证)。
③ 🔴 **本刀没有放宽任何既有守卫的范围或判据**;`src/styles/color-guard.test.ts` **零改动**
(`git status` 只有 2 个文件)。

---

## 8. RED→GREEN 证据(17 条探针,每条两段输出 + `md5sum` 还原确认)

**手法**(治理 §9.5):`cp` 存副本 → 精确锚定注入(要求锚点在文件里**唯一**,`count==1` 断言)
→ **先证注入落盘**(`evidence in file == True`)→ 副本覆盖还原 → `md5sum` 逐字节比对。
🔴 **全程禁 `git checkout/restore/stash`**;`.superpowers/` 被 gitignore 盖着,**md5/diff 才是证据,
`git status` 不构成任何证据**。

| # | 探针 | 注入落盘 | vitest exit | 报红的用例(完整名见下) | 还原 md5 相同 |
|---|---|---|---|---|---|
| P1 | 死类 `.k-hero` 泄漏 | True | 1 | 3 条(死类集合 + `死类 k-hero 零出现` + 没有搬多) | ✅ |
| P2 | E-52 基类整块挪到覆盖之后 | True | 1 | 1 条(基类行号 < 覆盖行号) | ✅ |
| P3 | 拿掉 `position: fixed` | True | 1 | 1 条(K46-③a) | ✅ |
| P4 | 拿掉 `inset: 0` | True | 1 | 1 条(K46-③b) | ✅ |
| P5 | 拿掉 `z-index: 1100` | True | 1 | 1 条(K46-③c) | ✅ |
| P6 | 加回 `.overlay` 补丁 | True | 1 | 3 条(K46 `.overlay` + NON_K 两条) | ✅ |
| P7 | `.k-rcard-snippet mark` 误改成 `--mark-hl-bg` | True | 1 | 1 条(三条 mark 各归其位) | ✅ |
| P8 | `--rtag-txt` 取值被重算 | True | 1 | 1 条(`--paper-surface` + 5 个 `--rtag-*`) | ✅ |
| P9 | `--shadow-drawer` 两档合并同值 | True | 1 | 1 条(`--shadow-drawer` / `--mark-hl-bg` 两档不同) | ✅ |
| P10 | K47 host 底色换 token | True | 1 | 1 条(K47) | ✅ |
| P11 | 删掉 `.k-skel-rcard` 规则 | True | 1 | 3 条(348 全部有规则 + 没有搬多 + 严格超集) | ✅ |
| P12 | 基类漏 `border-radius` | True | 1 | 1 条(基类块含六项声明 + hover) | ✅ |
| P13 | 引入未登记的非 k* 辅助类 | True | 1 | 2 条(NON_K 两条) | ✅ |
| P14 | 删掉 `@keyframes k-drawer-in` | True | 1 | 1 条(animation 与 keyframes 一一对应) | ✅ |
| P15 | 新增段**规则里**塞裸 hex | True | 1 | 1 条(全文含注释色扫) | ✅ |
| P16 | 新增段**注释里**塞裸 hex | True | 1 | 1 条(全文含注释色扫) | ✅ |
| P17 | 新增段**注释里**塞英文具名色 | True | 1 | 1 条(全文含注释色扫) | ✅ |

**17/17 全部有判别力(exit=1),0 条零判别力。**
**17/17 还原后 md5 与副本逐字节相同**(`a30da07adfc9acc609b2701a174f25ca`,前 14 条同一个值;
后 3 条同值),`git diff --stat` 复核也只有 2 个文件、没有残留。

报红用例的完整名(逐字):
```
× knowledge.scss —— 附录 D §D.3:24 个蓝本死代码类一个都没被搬进来(P5e-T2 新建) > 24 个死类在 knowledge.scss(剥注释后)零出现
× knowledge.scss —— 附录 D §D.3:24 个蓝本死代码类一个都没被搬进来(P5e-T2 新建) > 死类 k-hero 零出现
× knowledge.scss —— 附录 D 白名单落地(348 个,…) > 没有搬多 —— 全部 k-/k2-/kn-/fb/nme/ProseMirror 类都在白名单内(附录 D.4 自检命令②的常驻版,字符集含 A-Z)
× knowledge.scss —— 附录 D 白名单落地(348 个,…) > 348 个白名单类全部有对应规则(附录 D.4 自检命令①的常驻版)
× knowledge.scss —— 附录 D 白名单落地(348 个,…) > 严格超集自证 —— 新正则(含 A-Z + nme/ProseMirror)是旧正则的严格超集(old ⊆ new)
× knowledge.scss —— 附录 D 白名单落地(348 个,…) > 守卫缺口④ —— 非 k* 前缀的嵌套辅助类全部在登记表内(.right/.mono 这类)
× knowledge.scss —— 附录 D 白名单落地(348 个,…) > 守卫缺口④ —— 登记表恰好等于文件里真实存在的非 k* 类,不多不少(防清单变垃圾桶;P5e 终值 19)
× knowledge.scss —— E-52:.k-suggest-chip 基类必须在 k2 后代覆盖之前(P5e-T2 新建) > 基类声明行号 < k2 后代覆盖行号(钉蓝本源序的移植忠实性,不是钉级联结果)
× knowledge.scss —— E-52:… > 基类块含蓝本 :358-366 的六项声明 + :hover(漏一条即 E-52 没补干净)
× knowledge.scss —— K46 / K47:.k-fileviewer-host 三属性 + 三条 ::v-deep 不搬(P5e-T2 新建) > K46-③a —— .k-fileviewer-host 保留 position: fixed(拿掉 → 预览器塌进文档流)
× knowledge.scss —— K46 / K47:… > K46-③b —— .k-fileviewer-host 保留 inset: 0(拿掉 → 铺不满视口)
× knowledge.scss —— K46 / K47:… > K46-③c —— .k-fileviewer-host 保留 z-index: 1100(必须压在 .k-drawer-bg 的 1050 之上)
× knowledge.scss —— K46 / K47:… > K47 —— .k-fileviewer-host 底色是 var(--bg-canvas)(与蓝本兄弟规则 .k-fileviewer-fallback 同源)
× knowledge.scss —— K46 / K47:… > K46 —— .overlay 在 knowledge.scss(剥注释后)零出现(蓝本 :77-101 整段不搬)
× knowledge.scss —— 配色硬约束(…) > P5e-T2 —— --paper-surface + 5 个 --rtag-* 两档取值逐字相同(theme-invariant,附录 B §B.1/§B.2.1)
× knowledge.scss —— 配色硬约束(…) > P5e-T2 —— --shadow-drawer / --mark-hl-bg 两档取值不同(附录 B §B.2.2/§B.2.3,禁重算)
× knowledge.scss —— 配色硬约束(…) > 附录 D §D.6 —— 三条 mark 规则各归其位(只有 .k-chunk-content mark 用 --mark-hl-bg)
× knowledge.scss —— 配色硬约束(…) > token 声明层之外,全文(含注释)零色字面量(#hex / rgb() / hsl() / oklch() / 具名色…)
× knowledge.scss —— animation 引用与 @keyframes 声明一一对应(评审 Minor M-3) > 每一个 animation: X 引用都有对应的 @keyframes X(N11 的 fade-in 是唯一登记例外)
```

### 8.1 🔴 参数化守卫防空循环的证明(治理 §9.14-4)

`pnpm exec vitest run src/ai/styles/knowledgeStyles.test.ts --reporter=verbose` 里逐条数到
**24 条独立用例真在执行**(全在 `✓` passed 列表,**非 skip/todo**):
```
✓ … > 死类 k-hero 零出现 0ms
✓ … > 死类 k-hero-orb 零出现 0ms
✓ … > 死类 k-hero-title 零出现 0ms
✓ … > 死类 k-hero-sub 零出现 0ms
✓ … > 死类 k-hero-search 零出现 0ms
✓ … > 死类 k-hero-search-go 零出现 0ms
✓ … > 死类 k-hero-search-kbd 零出现 0ms
✓ … > 死类 k-stat 零出现 0ms
✓ … > 死类 k-stat-label 零出现 0ms
✓ … > 死类 k-stat-value 零出现 0ms
✓ … > 死类 k-stat-suffix 零出现 0ms
✓ … > 死类 k-stat-cn 零出现 0ms
✓ … > 死类 k-quick-grid 零出现 0ms
✓ … > 死类 k-quick-card 零出现 0ms
✓ … > 死类 k-quick-icon 零出现 0ms
✓ … > 死类 k-quick-card-title 零出现 0ms
✓ … > 死类 k-quick-card-en 零出现 0ms
✓ … > 死类 k-quick-card-desc 零出现 0ms
✓ … > 死类 k-progress-card 零出现 0ms
✓ … > 死类 k-progress-row 零出现 0ms
✓ … > 死类 k-progress-label 零出现 0ms
✓ … > 死类 k-progress-nums 零出现 0ms
✓ … > 死类 k-progress-bar 零出现 0ms
✓ … > 死类 k-progress-fill 零出现 0ms
```
同理 K46 的三条 `.overlay`/`.v-container`/`.doc-container` 也是 3 条独立用例,逐条可见。

---

## 9. 三门 + sass 门(完整终值,输出全落盘,无 `| tail` 截断)

```
$ pnpm test                      > /tmp/p5e-t2-test.log  2>&1
exit=0
 Test Files  331 passed (331)
      Tests  4026 passed (4026)
   Duration  68.65s

$ pnpm exec vue-tsc --noEmit     > /tmp/p5e-t2-tsc.log   2>&1
exit=0        (日志 0 行)

$ pnpm build                     > /tmp/p5e-t2-build.log 2>&1
exit=0        ✓ built in 13.68s
              (唯一告警是既有的 "Some chunks are larger than 500 kB",与本刀无关)

$ pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null
sass exit=0
```

| 量 | 起点基线(T1b 实测) | 本刀落地后 | 差 |
|---|---|---|---|
| `Test Files` | 331 passed (331) | **331 passed (331)** | 0(不新增测试文件,改的是既有 `knowledgeStyles.test.ts`) |
| `Tests` | 3986 passed (3986) | **4026 passed (4026)** | **+40** |
| `vue-tsc` | exit 0 | exit 0 | — |
| `vite build` | exit 0 | exit 0 | — |
| `sass` | — | exit 0 | — |

**+40 的算式逐条对得上**:死类段 26(1 集合 + 1 清单长度 + 24 参数化)+ E-52 段 2 +
K46/K47 段 9(③a/③b/③c + K47 + drawer-bg z-index + 3 条零出现 + 1 条零 `::v-deep`)+
配色段 3(rtag 组 + shadow/mark 组 + 三条 mark 各归其位)= **40**。

- 🔴 **红项:零。** 已知噪声(`persist.test.ts > dropPersisted …` IndexedDB flaky ·
  `AgentComposer.test.ts` vue-i18n teardown 竞态)**本次一次都没出现**,无需复跑说明。
- ⚠️ **本刀不新增 `.vue`**:`find src -name '*.vue' | wc -l` = **182**(与起点相同);
  `color-guard.test.ts` 单独跑 = `Tests 184 passed (184)`(与起点相同)。算式干净。

---

## 10. K / N 条目逐条显式申报

### 10.1 命中的 K 条目

| # | 命中情况 |
|---|---|
| **K9** | ✅ 命中。7 段**全部嵌进 `.knowledge-app`**(S1–S4 进主块;S5/S6/KF 进新建的顶层 `.knowledge-app { … }` 块,原样保留蓝本自己那层包裹) |
| **K44** | ✅ 命中(两个方面)。① `KFileViewer` 的 `<style scoped>` 内容**全部搬进 `knowledge.scss`**,T4 建 `.vue` 时侧零 `<style>` 块;② **一个顶层裸选择器都没新增**,`bareTopLevelSelectors()` 那条集合相等断言 `['.nme-content .ProseMirror']` **一字未改**,🔴 **没有放宽正则、也没有往例外集合里加成员**(不需要) |
| **K46** | ✅ 命中。三条 `::v-deep` 整段不搬 + 4 条断言(3 类名零出现 + 零 `::v-deep`);`position: fixed` / `inset: 0` / `z-index: 1100` 三属性保留 + **3 条独立断言**;注释引 `ViewerShell.vue:24`;诚实登记「`.overlay` 不是全仓零命中」;`.k-modal-bg` 照搬零决定(R3.1-M3) |
| **K47** | ✅ 命中。`KFileViewer.vue:75` 的底色裸值 → `var(--bg-canvas)`(**净剩 1 处**,`:84` 那处随 K46 消失)+ 1 条断言 |
| **K39**(同族政策) | ✅ 沿用。8 个 token **两档都显式写值** + 声明处逐行标蓝本 `file:line`;`--shadow-drawer` 是「新建整值阴影 token」,形态照 K39 的 `--shadow-warning-glow` 先例 |
| **K2 / R4**(主题映射既有口径) | ✅ 沿用。`--shadow-drawer` 的颜色部分不照抄蓝本冷调,按 R4 的暗/浅两套;蓝本 `[data-theme="dark"]` 这类块本刀 7 段里本来就没有 |
| **K43 / K45 / K10** | ✅ **不重复搬**(见 §3),对应的既有断言全绿 |
| **K52 / K48–K51 / K3 / K7 / K15** | 🔴 **本刀未命中**(K52 是 T7 的 `fetchBlobUrl`;K48/K49/K50/K51 是 T3/T5/T6/T7 的 JS 侧;K3 的 `.k-toast` 不移植由既有断言守;K7/K15 是模具引用,见下) |

### 10.2 命中的 N 条目(照抄了,没有「顺手修正」)

| # | 内容 | 自证 |
|---|---|---|
| **N24 同族** | 「纯尺寸/排版照抄」 | 355 行规则**逐字连续等价**(§1.2),没有任何一处被「优化」 |
| **附录 D §D.6**(K7 模具) | 三个「嵌套零引用规则」随父块整体搬、不单独摘除 | `.h-md`(蓝本自己零 class 引用)· `mark` ×3 全部随父块搬入;`.h-md` 已进 `NON_K_HELPER_CLASSES` 并写明「蓝本自身零 class 引用」 |
| **N11**(既有) | `.k-file-detail` 的悬空 `animation: fade-in` | 本刀零改动,那两条既有断言全绿 |
| **附录 D §D.5** 交接项 | `.k-adv-toggle` + 嵌套 `.chev` 归 P5e「先搬者得」 | 已搬,并在 scss 注释里写明 **P5f 的 `AllowlistView`/`RootsView` 不许重复搬**;`.k-section-body`(蓝本 `:985`)/ `.k-frow`(`:1077`)本刀**没搬**(归 P5f) |

### 10.3 用了哪几个 fixture / mock 层次

🔴 **本刀零 fixture 依赖、零 mock**(纯 scss + 静态文本断言,不挂载任何组件、不打任何网络)。
治理 §4.1 的 mock 层次表**与本刀无关**;`.REPLAYED` 四个 fixture 与 `F10` 的用法限制
(裁定 R3 / R9 / R10)一条都没碰。

---

## 11. 顾虑与交接项

1. 🔴 **勘误(§2.3)**:附录 D §D.3 给的 raw-grep 复现命令在 **T2 之前的基线上就有 2 处
   假阳性**(`k-quick-grid` / `k-progress-card`,来自 `knowledge.scss:61`/`:1318`/`:1605`
   三条既有注释)⇒ 附录里「T0 现测 0 个出现 ✅」这句**只在剥注释后成立**。
   请协调者决定是否入裁定书 / 订正附录。**权威判据已落成剥注释后的常驻断言。**
2. ⚠️ **浅档 `--mark-hl-bg` 取附录 B 表里的 `0.40`**,蓝本 `:1660` 原文是 `0.4` ——
   **数值完全相同**,写法与本档 `--shadow-lg: … 0.10` 一致。**显式申报,请评审确认可接受。**
3. ⚠️ **`.k-suggest-chip` 基类落在主 `.knowledge-app` 块(蓝本源序位),覆盖在下方
   Dashboard v2 块** —— 两者相隔约 2000 行。断言钉的是**行号先后**,不是相邻。
   将来若有人把 Dashboard v2 段整块挪到文件更前面,那条断言会报红提示重新核对源序。
4. ⚠️ **`.knowledge-app` 祖先链上有无 `transform`/`filter`/`will-change`**(会把
   `position: fixed` 的 containing block 从视口换成祖先)—— 附录 D §D.8 把这项实测**派给 T4**,
   本刀未越权做。T4 若测出有,按 §D.8 是 `NEEDS_CONTEXT`。
5. ⚠️ **两个验收拍板项**要写进验收清单(附录 B §B.2.1 末 / §B.2.3 末):
   `--rtag-md`(MD 标签的近黑实底,**暗色档下会比 `--bg-elevated` 更暗、与其余 4 个鲜色标签
   观感不平衡**,但白字压近黑底仍可读)· `--mark-hl-bg`(暗档 alpha 已按对比度降过一档)。
   🔴 但按裁定 R2,**结果卡与 chunk 阅读器在本机不可达** ⇒ 这两项**只能在单测 + 附录 B 评审
   层面确认**,实机拍板要等有真结果的环境;`--rtag-*` 唯一可能在本机出现的是 `TXT`
   (本机 7 个索引文件 `mime` 全是 `text/plain`)。**建议协调者把这条写清,别让机主找不到那 5 个色。**
6. ✅ **E-52 的连带验收项**(附录 D §D.4 末)照原样保留:「顺带看一眼**仪表盘**的建议 chip ——
   它这次才是蓝本该有的样子(圆角/内距/边框/底色/hover 全回来了)。这不是 P5e 把仪表盘
   改坏了,是补上了 P5a 的漏搬(E-52)。」**这一屏在本机 100% 可达**(仪表盘是知识库首页)。
7. ⚠️ **T4 的报告要指出 K46 三属性断言的坐标**(计划书 §T4-2 要求):它们在
   `src/ai/styles/knowledgeStyles.test.ts` 的
   `describe('knowledge.scss —— K46 / K47:.k-fileviewer-host 三属性 + 三条 ::v-deep 不搬(P5e-T2 新建)')`
   里,三条用例名分别以 `K46-③a` / `K46-③b` / `K46-③c` 开头。
8. 🟢 **无 `NEEDS_CONTEXT`**:附录 B 表覆盖了全部 17 处色字面量,没有任何一处需要自选;
   brief 的「不做」清单与 DoD 之间没有出现裁定 R16 那种矛盾。
