# P5e 附录 D —— CSS 类清单 / 白名单终值 / 可测性结论(T0 产出)

> 实测于 **2026-08-05**。蓝本锁 `NimoOS-UI@7a6ee6b7`;本仓 `.sp8/NimoOS-New-UI@ec6a000`,
> `src/ai/styles/knowledge.scss` = **2381 行**(蓝本 2562 行)。
> ⚠️ **具体计数有保质期**(治理 §13-2)—— 每一节都附了复现命令,用之前先现测。
>
> 🔴 **匹配口径**:一律「**class 属性里的完整 token 精确匹配**」/「**选择器位置精确匹配**」。
> **不许用 `\b` 词边界** —— `k-hero` 会被 `k-hero-suggest` 假命中(E-25 的坑,协调者规划时栽过一次)。
> 本附录用的正则是 `\.<cls>(?![\w-])`,且只在**每行第一个 `{` 之前的选择器部分**里匹配。

---

## D.0 三态总账

**基准 = 蓝本三个 `.vue` 模板里真正用到的 class token 全集 = 74 个**(不是 `p5-master-plan.md` §2.4 的 52)。

| 状态 | 个数 | 含义 |
|---|---|---|
| **TO-MOVE(未搬,本期必搬)** | **54** | 蓝本 scss 有规则、本仓 `knowledge.scss` 无规则 |
| **ALREADY-MOVED(已搬,不许重复搬)** | **17** | 两边都有规则 |
| **NO-RULE-EITHER-SIDE** | **3** | 只有 `KFileViewer.vue` 的 `<style scoped>` 里有,`knowledge.scss` 两边都没有 |
| 其中 🔴 **HALF-MOVED(半搬)** | **1** | `k-suggest-chip` —— 只搬了后代覆盖、基类缺失(**E-52**) |

🔴 **与 `p5-master-plan.md` §2.4 的 52 个逐个对齐结果:52 个全部落在 TO-MOVE 里 ✅,但 §2.4 漏了 2 个真实需要的类** ——
见 **§D.2**。

复现:
```bash
# 见 T0 报告 §7 的 classes2.mjs(脚本原文已贴进报告),核心逻辑:
#   1) 从蓝本三个 .vue 的 <template> 段抽 class="…" 的完整 token
#   2) 用 /\.<cls>(?![\w-])/ 在「行内第一个 { 之前的选择器部分」匹配,分别扫蓝本与本仓 knowledge.scss
#   3) 两边都有 = ALREADY-MOVED;只蓝本有 = TO-MOVE;都没有 = NO-RULE-EITHER-SIDE
```

---

## D.1 逐类三态表(74 个,**T2 的搬运清单就是 TO-MOVE 那 54 个**)

| class | 状态 | 蓝本声明行 | 本仓声明行 | 被谁用 |
|---|---|---|---|---|
| `chev` | TO-MOVE | `509`,`510`,`1561` | — | SV |
| `k-adv-chip` | TO-MOVE | `533` | — | SV |
| `k-adv-chips` | TO-MOVE | `532` | — | SV |
| `k-adv-field` | TO-MOVE | `524` | — | SV |
| `k-adv-label` | TO-MOVE | `525` | — | SV |
| `k-adv-panel` | TO-MOVE | `513` | — | SV |
| `k-adv-toggle` | TO-MOVE ‡ | `498` | — | SV |
| `k-chunk-content` | TO-MOVE ★色 | `1656`,`1660` | — | FD |
| `k-chunk-item` | TO-MOVE | `1625`,`1631`,`1632`,`1637` | — | FD |
| `k-chunk-item-body` | TO-MOVE | `1638` | — | FD |
| `k-chunk-item-head` | TO-MOVE | `1639` | — | FD |
| `k-chunk-item-preview` | TO-MOVE | `1641`,`1645` | — | FD |
| `k-chunk-list` | TO-MOVE | `1620`,`1669` | — | FD |
| `k-chunk-loc` | TO-MOVE | `1640` | — | FD |
| `k-chunk-nav` | TO-MOVE | `1653`,`1655` | — | FD |
| `k-chunk-nav-count` | TO-MOVE | `1654` | — | FD |
| `k-chunk-rank` | TO-MOVE | `1633`,`1637` | — | FD |
| `k-chunk-viewer` | TO-MOVE | `1647` | — | FD |
| `k-chunk-viewer-foot` | TO-MOVE | `1661` | — | FD |
| `k-chunk-viewer-head` | TO-MOVE | `1648` | — | FD |
| `k-chunk-viewer-title` | TO-MOVE | `1652` | — | FD |
| 🔴 `k-drawer` | TO-MOVE ★色 ✚ | `1579`,`1667` | — | FD |
| `k-drawer-actions` | TO-MOVE | `1611`,`1671` | — | FD |
| `k-drawer-back` | TO-MOVE | `1594`,`1601` | — | FD |
| 🔴 `k-drawer-bg` | TO-MOVE ★色 ✚ | `1572` | — | FD |
| `k-drawer-body` | TO-MOVE | `1618`,`1668` | — | FD |
| `k-drawer-fileinfo` | TO-MOVE | `1603`,`1670` | — | FD |
| `k-drawer-filename` | TO-MOVE † | `1607` | — | FD,FV |
| `k-drawer-head` | TO-MOVE † | `1587` | — | FD,FV |
| `k-drawer-head-spacer` | TO-MOVE † | `1602` | — | FD,FV |
| `k-drawer-summary` | TO-MOVE | `1612`,`1617` | — | FD |
| `k-hero-suggest` | TO-MOVE ⛔邻 | `351` | — | SV |
| `k-match-pill` | TO-MOVE | `1548` | — | SV |
| `k-more-hint` | TO-MOVE | `1556`,`1560`,`1561`,`1562` | — | SV |
| `k-rcard` | TO-MOVE | `581`,`1562` | — | SV |
| `k-rcard-body` | TO-MOVE | `625` | — | SV |
| `k-rcard-head` | TO-MOVE | `626` | — | SV |
| `k-rcard-icon` | TO-MOVE ★色 | `596` | — | SV,FD |
| `k-rcard-meta` | TO-MOVE | `662` | — | SV,FD |
| `k-rcard-meta-item` | TO-MOVE | `669`,`670` | — | SV,FD |
| `k-rcard-name` | TO-MOVE | `627` | — | SV |
| `k-rcard-snippet` | TO-MOVE | `645` | — | SV |
| `k-rcard-tag` | TO-MOVE ★色 | `611` | — | SV,FD |
| `k-rel` | TO-MOVE ★色 | `633` | — | SV,FD |
| `k-rel-dot` | TO-MOVE | `643` | — | SV,FD |
| `k-rerank-warn` | TO-MOVE | `675` | — | SV |
| `k-result-count` | TO-MOVE | `575` | — | SV |
| `k-results` | TO-MOVE | `574` | — | SV |
| `k-search-box` | TO-MOVE | `471` | — | SV |
| `k-search-clear` | TO-MOVE | `488` | — | SV |
| `k-search-sticky` | TO-MOVE | `458` | — | SV |
| `k-search-sticky-inner` | TO-MOVE | `466` | — | SV |
| `k-skel-rcard` | TO-MOVE | `726` | — | SV |
| `path` | TO-MOVE(嵌套辅助类) | `670` | — | SV,FD |
| — | — | — | — | — |
| `ghost` | ALREADY-MOVED | `825` | `786` | FD |
| `k-btn` | ALREADY-MOVED | `818`,`1564`,`1568`,`1569`,`1570`,… | `779`,… | SV,FD,FV |
| `k-empty` | ALREADY-MOVED | `684` | `639` | SV |
| `k-empty-illust` | ALREADY-MOVED | `690` | `645` | SV |
| `k-empty-sub` | ALREADY-MOVED | `702` | `662` | SV |
| `k-empty-tip` | ALREADY-MOVED | `711` | `671` | SV |
| `k-empty-tips` | ALREADY-MOVED | `706` | `666` | SV |
| `k-empty-title` | ALREADY-MOVED | `701` | `661` | SV |
| `k-modal-x` | ALREADY-MOVED | `1322` | `1167` | FD,FV |
| `k-row-action` | ALREADY-MOVED | `951` | `927` | FD |
| `k-scroll` | ALREADY-MOVED | `258` | `625` | SV |
| `k-scroll-inner` | ALREADY-MOVED | `264` | `631` | SV |
| `k-seg` | ALREADY-MOVED(K43) | `551` | `2057` | SV |
| `k-skel` | ALREADY-MOVED(基类) | `720` | `680` | SV |
| 🔴 `k-suggest-chip` | **HALF-MOVED = E-52** | `357`(基类)+ `2291`(k2 覆盖) | **只有 `2198` 的覆盖** | SV(+DashboardView) |
| `outline` | ALREADY-MOVED | `831`,`1564`,`1568` | `792` | FD |
| `primary` | ALREADY-MOVED | `837` | `798` | SV,FD,FV |
| — | — | — | — | — |
| `k-fileviewer-host` | NO-RULE-EITHER-SIDE | KFileViewer.vue `:71` | — | FV |
| `k-fileviewer-fallback` | NO-RULE-EITHER-SIDE | KFileViewer.vue `:103` | — | FV |
| `k-fileviewer-empty` | NO-RULE-EITHER-SIDE | KFileViewer.vue `:110` | — | FV |

**图例**:`★色` = 含色字面量,见附录 B · `‡` = P5f 也用,先搬者得 · `†` = KFileViewer 也用 ·
`✚` = **`p5-master-plan.md` §2.4 漏列** · `⛔邻` = 紧邻死代码段,整段搬会带进死类 ·
`SV`=SearchView · `FD`=FileDetailDrawer · `FV`=KFileViewer。

---

## D.2 🔴 `p5-master-plan.md` §2.4 的 52 类清单 —— 逐个对齐 + **2 处漏列(勘误 E-55)**

**§2.4 的 52 个全部在 TO-MOVE 里,零错判 ✅。** 但 §2.4 **漏了 2 个真实必须搬的类**:

| 漏列的类 | 蓝本行 | 谁在用 | 为什么必须搬 | 连带影响 |
|---|---|---|---|---|
| 🔴 **`.k-drawer-bg`** | `1572-1578` | `FileDetailDrawer.vue:2` 根元素 | 抽屉的**全屏遮罩**:`position: fixed; inset: 0` + `backdrop-filter: blur(8px)` + `z-index: 1050` + `animation: k-drawer-fade` | 不搬 = 抽屉没有遮罩、**没有定位、直接塞进文档流**;且 `z-index: 1050` 是 **K46 判据里 `.k-fileviewer-host` 1100 的对照基准** |
| 🔴 **`.k-drawer`** | `1579-1586`,`1667` | `FileDetailDrawer.vue:3` `<aside>` | 抽屉主体:`width: min(860px, 90vw)`、`height: 100%`、`border-left`、`box-shadow`(★色)、`animation: k-drawer-in` | 不搬 = 抽屉没宽度、没动画、没投影 |

**连带漏列的 3 样非 class 结构**(§2.4 只列 class,这三样必须一并搬):

| 结构 | 蓝本行 | 说明 |
|---|---|---|
| `@keyframes k-drawer-fade` | `1541` | `.k-drawer-bg` 的入场动画,不搬则 `animation` 引用一个不存在的名字(静默无动画) |
| `@keyframes k-drawer-in` | `1542-1545` | `.k-drawer` 的入场动画,同上 |
| `@media (max-width: 720px) { … }` | `1666-1672` | 5 条移动端覆盖:`.k-drawer` 宽度 / `.k-drawer-body` 网格 / `.k-chunk-list` 边框 / `.k-drawer-fileinfo` 换行 / `.k-drawer-actions` 宽度 |

🔴 **`.k-btn.outline`(蓝本 `:1564-1568`)不许再搬** —— 本仓 `knowledge.scss:792-797` 的
`.k-btn { &.outline { … } }` 声明**与蓝本那段逐字等价**(`background: var(--bg-elevated)` /
`color: var(--text-primary)` / `border: 1px solid var(--line)` / hover 换 `--bg-chip` + `--line-strong`)。
蓝本 `:1564-1568` 是**重复段**(蓝本自己在 `:831` 也有一份)。**搬了会触发 M-4 那条 `&.text` 计数断言的邻域改动。**

→ **T2 的实际搬运范围(6 段)**:

| # | 蓝本行段 | 内容 | 注意 |
|---|---|---|---|
| S1 | `351-367` | `.k-hero-suggest` + `.k-suggest-chip` **基类** | 🔴 **只搬这 17 行**,不许扩到 `:272-349` / `:369+`(死类 + 别期的类) |
| S2 | `457-549` | Search page:sticky / inner / box / clear / adv-toggle+chev / adv-panel / adv-field / adv-label / adv-chips / adv-chip | 🔴 **到 `:549` 为止** —— `:551-571` 是 `.k-seg`(K43 已搬) |
| S3 | `573-681` | `.k-results` … `.k-rerank-warn`(含 `.k-rcard-*` / `.k-rel*` / 嵌套 `mark` / 嵌套 `.h-md` / `.path`) | 🔴 **到 `:681` 为止** —— `:683-717` 是 `.k-empty*`(已搬) |
| S4 | `726-732` | `.k-skel-rcard` | 🔴 **不含 `:720-725` 的 `.k-skel` 基类**(已搬) |
| S5 | `1540-1563` | 两个 `@keyframes` + `.k-match-pill` + `.k-more-hint`(含 `b` / `.chev` / `.k-rcard:hover` 三条后代) | |
| S6 | `1571-1673` | `.k-drawer-bg` … `.k-chunk-viewer-foot` + `@media` | 🔴 **跳过 `:1564-1570`**(`.k-btn.outline` 重复段 + `.k-btn.text` 的 K45 已搬) |

外加 `KFileViewer.vue:71-76` + `:103-119`(K46 砍掉 `:77-101`)。

---

## D.3 ⛔ 24 个「蓝本死代码」类 —— **一个都不许搬**(逐字抄自 `p5-master-plan.md` §2.2)

这些类在**蓝本自己**的 13 个 `.vue` 里 **零 class 引用**,是 v1 仪表盘 / v1 进度卡被
`k2-*` Dashboard v2(`:2282-2452`)取代后留下的遗迹。**P5a 正确地没搬。**

```
:272-349  .k-hero  .k-hero-orb  .k-hero-title  .k-hero-sub
          .k-hero-search  .k-hero-search-go  .k-hero-search-kbd        (7)
:380-411  .k-stat  .k-stat-label  .k-stat-value  .k-stat-suffix  .k-stat-cn (5)
:413-455  .k-quick-grid  .k-quick-card  .k-quick-icon
          .k-quick-card-title  .k-quick-card-en  .k-quick-card-desc      (6)
:1152-1160 .k-progress-card  .k-progress-row  .k-progress-label
           .k-progress-nums  .k-progress-bar  .k-progress-fill          (6)
```

🔴 **为什么这是真陷阱**:P5e 要搬的 `.k-hero-suggest`(`:351`)与 `.k-suggest-chip`(`:357`)
**紧夹在 `.k-hero-search-kbd`(`:343`)与 `.k-stat`(`:380`)中间** ——
「整段搬 `:272-455`」会一次带进 **18 个死类**;而「没有搬多」白名单断言会报红,
**实现者极可能误判成「白名单数字错了」而去改白名单**。

🔴 **落地要求**:
1. **一条断言证明这 24 个类名在 `knowledge.scss` 里零出现**(判据:加进任一 → 报红)。
2. 🔴 **白名单报红时,先回查本节这 24 个,不许改白名单。**
3. 报告必须明写「第 2 条已被遵守」。

**T0 现测基线(2026-08-05)**:
- 24 个死类在 `src/ai/styles/knowledge.scss` 里 **0 个出现** ✅
- 24 个死类在 `WHITELIST_293` 常量里 **0 个出现** ✅
→ 这条断言的起点是干净的。

复现:
```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
for c in k-hero k-hero-orb k-hero-title k-hero-sub k-hero-search k-hero-search-go k-hero-search-kbd \
         k-stat k-stat-label k-stat-value k-stat-suffix k-stat-cn \
         k-quick-grid k-quick-card k-quick-icon k-quick-card-title k-quick-card-en k-quick-card-desc \
         k-progress-card k-progress-row k-progress-label k-progress-nums k-progress-bar k-progress-fill; do
  grep -qE "\.$c([^A-Za-z0-9_-]|\$)" src/ai/styles/knowledge.scss && echo "LEAKED: $c"
done; echo done
```
⚠️ **`.k-hero-suggest` 会被 `\.k-hero([^A-Za-z0-9_-]|$)` 排除掉**(因为 `-s` 是 `[\w-]`)——
这正是为什么必须用 `(?![\w-])` 而**不能**用 `\b`。上面的命令已经按这个口径写好。

---

## D.4 🔴 E-52 —— `.k-suggest-chip` 的级联处置(**诚实版,别写成假断言**)

**事实**:
- 蓝本基类 `knowledge.scss:357-367`(**零色字面量**,全是 token:`--bg-elevated` / `--line-faint` /
  `--r-pill` / `--text-secondary`,`:hover` 换 `--accent`)。
- 蓝本 k2 覆盖 `:2291`:`.k2-suggest .k-suggest-chip { white-space: nowrap; }`。
- 🔴 **本仓只搬了覆盖**(`knowledge.scss:2198`),**基类整条缺失** → P5a 已验收的仪表盘建议 chip
  目前跑在「只有一条 `white-space`、零基类样式」上。

**T2 落地**:补基类,**插在 `:2198` 那条覆盖之前**(蓝本源序)。

🔴🔴 **但断言必须诚实 —— 治理说「否则级联反掉而三门全绿」,T0 实测这句在本例里不成立**:
| 选择器 | 特异度 | 声明的属性 |
|---|---|---|
| `.knowledge-app .k-suggest-chip`(基类) | (0,2,0) | padding / background / border / border-radius / font-size / color / cursor / transition + `:hover` |
| `.knowledge-app .k2-suggest .k-suggest-chip`(覆盖) | (0,3,0) | **只有 `white-space`** |

→ ① 特异度 (0,3,0) > (0,2,0),**顺序颠倒也不会反掉**;② 两者**属性集完全不相交**。
**所以「顺序错了会有可见回归」是假的。**

🔴 **T2 的断言因此必须钉「源序」这件事本身,而不是编造一个不存在的级联后果**:
- ✅ 允许的断言形态:`knowledge.scss` 里 `.k-suggest-chip` **基类声明的行号 < `.k2-suggest .k-suggest-chip` 覆盖的行号**
  (判据:把两段调换 → 报红)。用例名要写清「**钉蓝本源序,不是钉级联结果**」。
- ❌ **禁止**写成「顺序反了样式会失效」之类的用例名/注释 —— 那是**零判别力 + 事实错误**,评审会逮到。
- 注释要写:「P5a 只搬了覆盖、基类漏搬 = **E-52**;本刀补基类。**本例中特异度差 (0,2,0) vs (0,3,0)
  且属性集不相交 → 顺序不影响渲染,断言纯粹为守蓝本源序纪律。**」

🔴 **连带影响必须写进验收清单**(承 `cross-area-impacts.md` §2.1):
> 「顺带看一眼**仪表盘**的建议 chip —— 它这次才是蓝本该有的样子(圆角/内距/边框/背景/hover 全回来了)。
> 这不是 P5e 把仪表盘改坏了,是补上了 P5a 的漏搬(E-52)。」

---

## D.5 「先搬者得」与跨期交接项

| 类 | 归属 | 交接口径 |
|---|---|---|
| **`.k-adv-toggle`**(蓝本 `:498-511`)+ 嵌在它里的 **`.chev`**(`:509`,`:510` 的 `&[data-open="true"] .chev`) | 🔴 **P5e 搬** | 蓝本被 `SearchView` + **`AllowlistView` + `RootsView`(P5f)** 三家用 → **P5f 不许重复搬**(同 K43/K45 模具)。P5f 的 `AllowlistView`/`RootsView` 直接用 |
| **`.k-more-hint .chev`**(蓝本 `:1561`) | P5e 搬(在 S5 段里) | 与上面那个 `.chev` 是**两条不同的后代规则**,都要搬 |
| **`.k-section-body`**(蓝本 `:985`) | **P5f** | P5c 因 Allowlist 移出而故意没搬 = **E-3**。P5e **不搬**(本期三个模板零引用) |
| **`.k-frow`**(蓝本 `:1077`) | **P5f** | 只被 `AllowlistView` 用 |
| **`.k-btn.text`**(蓝本 `:1569-1570`) | **P5d 已搬(K45 / 裁定 R1)** | 🔴 **P5e 不许重复搬**。`knowledgeStyles.test.ts` 有一条锚定在 `.k-btn { … }` 区间内的「`&.text` 恰好 2 次」计数断言(**M-4 要求 T2 顺手把用例名改准,只改标题不动断言**) |
| **`.k-seg`**(蓝本 `:551-571`) | **P5d 已搬(K43)** | 🔴 P5e 直接用,不许重复搬 |
| **`.k-btn.outline`**(蓝本 `:1564-1568`) | **P5a 已搬**(本仓 `:792-797`) | 🔴 **P5e 不许重复搬**,见 §D.2 末尾 |
| **`openNoteInNewTab`** | **P5f** | 本期三个新 `.vue` 零引用(协调者已核,T0 复核:`grep -n openNoteInNewTab` 对三个蓝本文件零命中)→ **继续不补** |

---

## D.6 三个「嵌套零引用规则」—— 随父块整体搬,不单独摘除

| 规则 | 蓝本行 | 父块 | 蓝本自身引用 | 处置 |
|---|---|---|---|---|
| `.h-md` | `660` | `.k-rcard-snippet`(`:645`) | 🔴 **蓝本 13 个 `.vue` 里零 class 引用** | **随父块整体搬**(同 P5d「`statusBadge` 零消费者也照抄导出」的 K7 模具)。⚠️ 它会让 `NON_K_HELPER_CLASSES` +1(见 §D.8) |
| `mark`(元素选择器) | `653` | `.k-rcard-snippet` | 由 `v-html` 的 `highlight()` 动态注入(K49) | 搬。**用的是 token,不是字面量,别改** |
| `mark` | `1645` | `.k-chunk-item-preview` | 同上 | 搬。**用的是 token,别改** |
| `mark` | `1660` | `.k-chunk-content` | 同上 | 搬。🔴 **这一条是字面量 `rgba(255,235,0,0.4)` → `--mark-hl-bg`**(附录 B §B.2.3) |

⚠️ 三条 `mark` 都是**元素选择器**,不进任何 class 白名单(白名单正则只匹配 `.xxx`)。
🔴 **但 `.h-md` 会被 `nonKClassNames` 扫到** —— 它不是 `k-`/`k2-`/`kn-`/`fb`/`nme`/`ProseMirror` 前缀。

---

## D.7 🔴 `WHITELIST` / `NON_K_HELPER_CLASSES` 的本期终值(**程序化实测**)

**方法**:取本仓 `knowledge.scss` 现状 → **`stripComments()`**(与 `knowledgeStyles.test.ts:24-28` 逐字同款)
→ 追加 §D.2 那 6 段 + `KFileViewer` 的 `<style>` 净段(同样 strip)→ **跑 `knowledgeStyles.test.ts` 里那两段真实逻辑**。

⚠️ **`p5d-gen-r8r9-sim.mjs` 硬编码旧常量名,直接跑会抛** —— 本节没有用它,而是把
`NEW_RE` 与 `nonKClassNames()` **逐字复制**进一个独立脚本(见 T0 报告 §7 的 `sim-r8r9.mjs`)。

### D.7.1 「没有搬多」白名单

| 量 | 现状 | 追加 P5e 后 | 增量 |
|---|---|---|---|
| `NEW_RE` 扫出的 class 数(strip 注释后) | **292** | **347** | **+55** |
| `WHITELIST_293` 常量长度 | **293** | 🔴 **348** | **+55** |

- **常量长度 348 ≠ 扫出数 347**,这是**现状就有的 1 差**(常量里有 1 项只作为更长类名的前缀出现,
  被 `NEW_RE` 的贪婪匹配吃掉;实测「常量里没有一项在 scss 中无规则」= 0)。**不是错,别去「修平」。**
- 🔴 **新增的 55 个类**(逐字,T2 直接追加进常量):
```
k-adv-chip k-adv-chips k-adv-field k-adv-label k-adv-panel k-adv-toggle
k-chunk-content k-chunk-item k-chunk-item-body k-chunk-item-head k-chunk-item-preview
k-chunk-list k-chunk-loc k-chunk-nav k-chunk-nav-count k-chunk-rank
k-chunk-viewer k-chunk-viewer-foot k-chunk-viewer-head k-chunk-viewer-title
k-drawer k-drawer-actions k-drawer-back k-drawer-bg k-drawer-body
k-drawer-fileinfo k-drawer-filename k-drawer-head k-drawer-head-spacer k-drawer-summary
k-fileviewer-empty k-fileviewer-fallback k-fileviewer-host
k-hero-suggest k-match-pill k-more-hint
k-rcard k-rcard-body k-rcard-head k-rcard-icon k-rcard-meta k-rcard-meta-item
k-rcard-name k-rcard-snippet k-rcard-tag k-rel k-rel-dot k-rerank-warn
k-result-count k-results k-search-box k-search-clear k-search-sticky k-search-sticky-inner
k-skel-rcard
```
- ⚠️ **`k-suggest-chip` 不在这 55 个里** —— 它已经因为 `:2198` 那条覆盖被扫到、已在白名单里(§D.1 的 HALF-MOVED)。
  **补基类不会让白名单数字变。**
- ⚠️ **`chev` / `path` / `h-md` 不在这 55 个里** —— 它们不是 `k*` 前缀,归 `NON_K_HELPER_CLASSES`(§D.7.2)。
- **常量名跟着数字改**(本档既定习惯):`WHITELIST_293` → **`WHITELIST_348`**。
- 🔴 **零丢失自证**:现状 292 个类在追加后 **一个不少**(实测 `lost = (none)`)——
  证明这次只是扩集合、没有让任何类逃过扫描。

### D.7.2 `NON_K_HELPER_CLASSES`

| 量 | 现状 | 追加 P5e 后 | 增量 |
|---|---|---|---|
| `nonKClassNames(css)` 实测 | **16**(与裁定 R8 的终值逐字一致 ✅) | 🔴 **19** | **+3** |

现状 16(排序):
`danger dot ghost lbl mono outline primary right second sep spacer spin suffix text warn wide`

🔴 **新增 3 个,逐条出处**(T2 必须在登记表里逐条写理由,那条集合相等断言会钉死):

| 新增 | 蓝本出处 | 语义 |
|---|---|---|
| `chev` | `knowledge.scss:509`(`.k-adv-toggle .chev`)· `:510`(`&[data-open="true"] .chev`)· `:1561`(`.k-more-hint .chev`) | 折叠箭头图标的旋转容器,**嵌套后代辅助类**,与既有 `dot`/`sep`/`spacer` 同款 |
| `path` | `knowledge.scss:670`(`.k-rcard-meta-item .path`) | 结果卡 meta 里的等宽路径片段,**嵌套后代辅助类**,与既有 `mono` 同款 |
| `h-md` | `knowledge.scss:660`(`.k-rcard-snippet .h-md`) | 摘要里的「Markdown 标题行」高亮,**嵌套后代辅助类**;🔴 **蓝本自身零 class 引用**(§D.6),随父块整体搬 |

→ **`NON_K_HELPER_CLASSES` 终值 = 19**,`R8 —— … 恰好 16 项` 那三条断言的数字要同步改成 **19**。
🔴 **这是「加固」(登记表变长 = 扫到的类都必须写明出处),不是放宽** ——
那条「登记表恰好等于文件里真实存在的非 k* 类,不多不少」的**集合相等**断言仍然生效,
多写一个/少写一个都报红。T2 报告要贴「加固前/加固后」两次 `nonKClassNames()` 输出。

### D.7.3 复现命令

```bash
cd /tmp && cat > sim.mjs <<'EOF'
# 见 T0 报告 §7 的 sim-r8r9.mjs 原文(含 stripComments / NEW_RE / nonKClassNames 三段逐字复制)
EOF
node sim.mjs
```
🔴 **T2 必须自己重跑一遍**(治理 §10 申报纪律:带 🔴 的复核项不许采信上一刀的结论)。

---

## D.8 K44 顶层裸选择器例外 —— 现状与本期口径

| 项 | 现状(实测) |
|---|---|
| 例外集合 | `['.nme-content .ProseMirror']`(承裁定 **R4**) |
| 常驻断言 | `knowledgeStyles.test.ts:766-768`:`expect(bareTopLevelSelectors()).toEqual(['.nme-content .ProseMirror'])` |
| 现状顶层裸选择器数 | **1**(就是上面那一条) |

🔴 **本期口径:P5e 一个顶层裸选择器都不许新增。**
- 6 段 scss 全部包在 `.knowledge-app { … }` 里(蓝本 S1–S4 本来就嵌在 `.knowledge-app` 内;
  S5/S6 蓝本是 `.knowledge-app { … }` 顶层块,原样保留那层包裹)。
- 🔴 **`KFileViewer.vue` 的 `<style scoped>` 三个类(`k-fileviewer-host/-fallback/-empty`)也必须进
  `knowledge.scss` 的 `.knowledge-app` 块内**(K44 纪律:`.vue` 侧零 `<style>` 块)。
  ⚠️ **`.k-fileviewer-host` 是 `position: fixed; inset: 0`,包进 `.knowledge-app` 后依然铺满视口**
  (`fixed` 相对视口定位,与祖先无关,除非祖先有 `transform`/`filter`/`will-change` 造成 containing block ——
  🔴 **T4 必须实测 `.knowledge-app` 及其祖先链上没有这三个属性**,有就是 `NEEDS_CONTEXT`)。
- → `bareTopLevelSelectors()` 那条断言**保持 `['.nme-content .ProseMirror']` 不变**,一字不改。

---

## D.9 🔴 `@vue-office` 在 jsdom 下的可测性结论(治理 §9.12,**T4/T5 的开工前提**)

**T0 实测**(临时探针放在**仓根**,不在 `src/` 下;跑完已删除并自证)。

### D.9.1 三条实测结论

| # | 问题 | 答案 |
|---|---|---|
| ① | vitest(jsdom)能不能**静态 import** `src/files/viewers/DocViewer.vue` / `ExcelViewer.vue`? | ✅ **能**。两个 SFC 及其 `@vue-office/{docx,excel}` + `lib/index.css` 都能被解析(vitest 的 CSSEnablerPlugin 把 css 换成空串,不影响 import) |
| ② | 能不能真挂载 `DocViewer`? | ✅ **能,而且干净**。实测渲染出 `ViewerShell > .overlay > .viewer-head/.viewer-body > .office-body > .office-scroll > .vue-office-docx > .vue-office-docx-main`,**零报错** |
| ③ | 能不能真挂载 `ExcelViewer`? | 🔴 **能挂载,但会污染整个测试进程** |

### D.9.2 🔴 `ExcelViewer` 的致命细节 —— **`pnpm test` 会 exit 1 而 0 个用例失败**

实测证据:
```
stderr:  Error: Not implemented: HTMLCanvasElement.prototype.getContext
             (without installing the canvas npm package)
           at new e (@vue-office/excel/lib/index.js:1:73232)   ← x-spreadsheet 构造函数

Unhandled Rejection:  TypeError: Cannot read properties of null (reading 'scale')
           at new e (@vue-office/excel/lib/index.js:1:73275)

 Test Files  1 passed (1)
      Tests  2 passed (2)
     Errors  1 error
EXIT=1                    ← 🔴 0 失败,退出码仍是 1
```
`@vue-office/excel` 内部是 **x-spreadsheet**,构造时无条件调 `canvas.getContext('2d')`;
jsdom 不实现它、返回 `null` → 紧接着读 `null.scale` → **unhandled rejection**。
vitest 把 unhandled error 记成 `Errors 1 error` 并**让整个 run 的退出码变成 1**。

🔴 **这正是记忆里「5908 例零失败但 vitest exit 1」那一类问题的同款成因。**
如果 T4/T5 让真 `ExcelViewer` 渲染,**三门里的 `pnpm test` 会红,而报告里的 `Tests N passed` 全绿**
—— 极容易被误判成「已知噪声」。

### D.9.3 🔴 mock 边界画在哪(**T4/T5 照此执行**)

**结论:`KFileViewer.test.ts` 里把两个 viewer 组件 mock 成 stub。**

```ts
// KFileViewer.test.ts —— 依据附录 D §D.9:@vue-office/excel 内部的 x-spreadsheet 会调
// HTMLCanvasElement.getContext,jsdom 返回 null → unhandled rejection → 整个 vitest run
// exit 1(0 个用例失败)。故把两个 viewer stub 掉;契约形状必须保留。
vi.mock('../../../files/viewers/DocViewer.vue', () => ({
  default: {
    name: 'DocViewer',
    props: { item: { type: Object, required: true }, list: { type: Array, required: true } },
    emits: ['close', 'download'],
    template: '<div data-stub="doc-viewer" />',
  },
}))
vi.mock('../../../files/viewers/ExcelViewer.vue', () => ({ /* 同款 */ }))
```

🔴 **契约形状必须保留(治理 §9.12 明令)**:`item` / `list` 两个 props + `close` / `download` 两个 emit。
依据:`DocViewer.vue:9-10` / `ExcelViewer.vue:9-10`
`defineProps<{ item: FileEntry; list: FileEntry[] }>()` + `defineEmits<{ (e:'close'):void; (e:'download', entry: FileEntry):void }>()`。

⚠️ **`DocViewer` 本来可以不 mock(实测干净)**,但**两个必须一致 mock** ——
`KFileViewer` 的 `VIEWER_MAP` 会按扩展名在两者之间路由,只 stub 一个会让「同一批用例两套挂载语义」。

### D.9.4 🔴 走 stub 路线后,三条断言必须落在能真报红的层次上

治理 §9.12 明令(否则就是零判别力用例)。T5 要为每条附**变异证据**:

| 断言 | 落点 | 变异判据 |
|---|---|---|
| `VIEWER_MAP` 五个扩展名的映射 | 断言渲染出的 stub 的 `data-stub` 值:`docx`/`wps` → `doc-viewer`;`xls`/`xlsx`/`csv` → `excel-viewer` | 把 `wps` 从 map 里删掉 → 那条用例必须红 |
| fallback 分支 | 扩展名不在 map 里(如 `.pdf`/无扩展名/空 name)→ 渲染 `.k-fileviewer-fallback`(含 `$t('Preview not supported for this format')` 与下载按钮) | 把 `VIEWER_MAP[ext] \|\| null` 改成 `VIEWER_MAP[ext] \|\| 'DocViewer'` → 必须红 |
| Esc 监听的注册/注销 | 用 `vi.spyOn(window,'addEventListener')` / `removeEventListener` 断言**同一个函数引用**被注册与注销;并断言按 Esc 真的 emit `close` | 删掉 `onBeforeUnmount` 的 remove → 必须红(判据落在「同一引用」上,不是「调过一次」) |

⚠️ **`item` computed 的形状**:蓝本 `KFileViewer.vue:52-54` 返回
`{ path: this.file.fullPath, name: this.file.name, is_dir: false }`,
而本仓 `DocViewer`/`ExcelViewer` 的 props 类型是 **`FileEntry`**(`src/files/stores/files.ts:8-16`:
必需 `name` / `path` / `is_dir`,其余可选)→ **形状恰好满足,`vue-tsc` 不会报**。
🔴 **T4 仍要现测一遍 `pnpm exec vue-tsc --noEmit`**,别假设。

### D.9.5 ⚠️ 另一个 T4 必须知道的既有差异(**不是要改,是要知道**)

| | 蓝本 `KFileViewer.VIEWER_MAP` | 本仓 `src/files/viewers/panelMap.ts` |
|---|---|---|
| `docx` | DocViewer | `doc-viewer` ✅ 一致 |
| `xlsx` / `csv` | ExcelViewer | `excel-viewer` ✅ 一致 |
| 🔴 **`wps`** | **DocViewer** | **`pdf-viewer`**(后端 LibreOffice 转 PDF) |
| 🔴 **`xls`** | **ExcelViewer** | **`pdf-viewer`**(同上) |

`@vue-office/docx|excel` 只吃 OOXML,**`wps`/`xls` 这两个旧二进制格式它渲染不了** →
蓝本把它们送进 DocViewer/ExcelViewer 会落到 viewer 自己的 `state === 'error'` 分支
(`filesViewerError` + 「改为下载」按钮)。
🔴 **这是蓝本的既有行为,按 N 系列照抄,不许「顺手改成 pdf-viewer」** ——
本仓 `ViewerHost` 走的是另一条链路(`useViewer` + `panelMap`),与 `KFileViewer` 零耦合。
**但要在验收清单里说明**:搜到 `.wps`/`.xls` 点「打开原文件」会进 in-app 预览器**并显示渲染失败**,与旧版一致。

### D.9.6 本仓既有先例(T0 已读,T4 应照抄手法)

| 文件 | 怎么处理 viewer |
|---|---|
| `src/files/viewers/ViewerHost.vue:10-19` | 🔴 **七个 viewer 全部 `defineAsyncComponent(() => import(...))` 懒加载** —— 全仓**没有任何静态 import `@vue-office` 的先例**。`KFileViewer` 蓝本是静态 import,这是本期第一次 |
| `src/files/viewers/panelMap.test.ts` | 只测 `getPanelType()` 纯函数,**根本不挂载 viewer** |
| `src/files/viewers/useViewer.test.ts` | 只测 `useViewer` composable 的状态机,**不挂载 viewer** |
| `src/files/viewers/useOfficeBytes.test.ts` | mock `@nimotech/nimoos-service` 的 `service.file.getBytes`,只测取字节的 composable |

→ **全仓零「挂载真 DocViewer/ExcelViewer」的先例** ⇒ D.9.3 的 stub 路线是**新建的做法**,
T5 报告必须显式申报它,并贴 D.9.2 的实测输出当依据。

---

## D.10 🔴 §9.11 可点性清单(T0 实测补全,**协调者写验收清单时逐条照抄**)

> 🔴 **总前提(本节最重要的一条)**:**本机 `/v1/ai/search/text` 对任何查询词都返回零结果**,
> 与查询内容无关。原因见 `p5e-fixtures/README.md` §3(Qdrant 里 5592 个向量的 `root_ids` 全是
> `dfcd1840…`,而核心告诉 Search「用户被授权的 root」只有 `["photos"]`,交集为空)。
> 这是 **D1(Wiki 后端本期不动)在搜索链路上的连带后果**,不是 P5e 的问题。
> ⇒ **`phase === 'results'` 整个分支在本机不可达**,结果卡 / 详情抽屉 / in-app 预览器 / distill 按钮
> **一个都点不到**。

| # | 屏 / 元素 | 渲染条件 | 本机可达? | 怎么验 / 为什么不可达 |
|---|---|---|---|---|
| 1 | `phase === 'idle'`(首屏空态 + 建议 chip) | 初始态 | ✅ **可达** | 进 `/ai/knowledge/search` 即是 |
| 2 | 5 个建议 chip 点击 → 填入并搜索 | idle 态 | ✅ **可达**(点得到,但结果是 empty) | 点「甲状腺」→ 走完搜索 → 落 `phase='empty'` |
| 3 | `phase === 'loading'`(6 条骨架) | 搜索中 | ✅ **可达**(Parser 冷启时看得清;热态只闪 <1 s) | 见 §D.10.1 的耗时数据 |
| 4 | `phase === 'empty'`(无结果三提示) | `results.length === 0` | ✅ **可达** | 🔴 **本机任何词都会落到这里**。「本机必然搜不到的词」= **随便什么词**;若要一个确定的:**`zzqqxxvv不存在的词`** |
| 5 | `phase === 'error'` | `run()` 抛异常 | ✅ **可达,需人为造** | 见 §D.10.2 |
| 6 | `phase === 'results'` 结果卡 | `results.length > 0` | 🔴 **不可达** | 见本节总前提 |
| 7 | `.k-rcard-tag` 五个类型色 | 结果卡内 | 🔴 **不可达**;且**即使可达也只会出现 `TXT`** | 本机 7 个已收录文件 `mime` 全是 `text/plain` → `kindFromMime` 恒返 `'txt'`。**5 个颜色只能靠单测 + 附录 B 评审** |
| 8 | `.k-match-pill` / `.k-rel` 高中低 | 结果卡内 | 🔴 **不可达** | score 三档在 Qdrant 层实测分得开(0.4666 / 0.60 / 0.7380),但结果到不了前端 |
| 9 | `.k-more-hint`「还有 N 段」 | `r.chunks.length > 1` | 🔴 **不可达** | 同上 |
| 10 | `.k-rerank-warn` | `warnings` 含 `rerank_unavailable`,**且 5 秒后自动消失** | 🔴 **不可达** | 双重不可达:① `service/search.go:176` 是 `if req.Rerank && len(hits) > 0`,本机 `len(hits)` 恒 0 → rerank 分支不进;② Parser 的 rerank 端点本身 **500**(`XLMRobertaTokenizer has no attribute prepare_for_model`,见 fixtures `F9`)。**「Accurate」档在本机等价于「Fast」,且不会有任何提示** |
| 11 | `.k-adv-panel` 展开 | `advOpen` | ✅ **可达** | 点「高级筛选」 |
| 12 | 高级面板四组控件(类型 chips / 时间 chips / 质量 seg / Top-K seg) | `advOpen` | ✅ **可达** | 都能点、`data-on` 都会翻转 |
| 13 | 「高级筛选 · 启用」小字 | `advEnabled` = `types.size < 5 \|\| mtime !== 'any' \|\| quality !== 'fast' \|\| topK !== 10` | ✅ **可达** | 🔴 **N34:初值是全 5 类选中 = 「未启用」** → 要看到这个小字,必须**取消勾选至少一类**(或改时间/质量/Top-K) |
| 14 | 筛选真生效(发 `mime_prefix`) | `types.size < 5` | ✅ 请求侧可验,结果侧无从对比 | 🔴 全选 = 不发 `mime_prefix`(N34)。取消勾选任何一类 → 请求体里出现 `mime_prefix`(可在浏览器 Network 面板看)。**结果集恒空,看不出筛选差别** |
| 15 | 详情抽屉(`.k-drawer-bg` / `.k-drawer` / chunk 列表 / chunk 阅读器) | 点结果卡 | 🔴 **不可达** | 同 #6 |
| 16 | 「沉淀成笔记」按钮 | `isDistillableName(file.name)` | 🔴 **双重不可达** | ① 抽屉打不开;② **即使打开也不渲染** —— 本机 7 个文件的扩展名是 `.log` ×6 / `.json` ×1,`DISTILL_EXTS` = `.md .txt .rst .pdf .docx .doc .wps .pptx .ppt .xlsx .xls .odt .html .htm`,**一个都不在里面** |
| 17 | `KFileViewer` in-app 预览 | 扩展名 ∈ `{docx, wps, xls, xlsx, csv}` | 🔴 **不可达** | 本机索引里 **零** 这五类文件(全是 `.log`/`.json`) |
| 18 | 「该格式暂不支持预览,请下载查看」toast | 扩展名 ∈ `{doc, ppt, pptx}` | 🔴 **不可达** | 同上,零这三类 |
| 19 | 「打开原文件」新标签页预览 | 其余扩展名 | 🔴 **不可达**;🔴 **且 K50 未定案前必然 401** | 见 `p5e-fixtures/README.md` §2 的 `/v3/file` 认证结论 |
| 20 | 「下载」 | 抽屉内 | 🔴 同上 | 同上 |
| 21 | 「复制内容」→「已复制」 | 抽屉内 | 🔴 **不可达** | ⚠️ 但**逻辑上应该能成功** —— `FileDetailDrawer.copy()` 蓝本自带 `execCommand` 兜底(`:171-179`),HTTP-IP 非安全上下文下也能复制。🔴 **与笔记区(P5d,无兜底、会弹「操作失败」)行为不同,验收清单要写清两者差异** |
| 22 | `?q=` 深链 | `route.query.q` 存在且 `!== q` | ✅ **可达** | URL:`http://<设备IP>/app/#/ai/knowledge/search?q=甲状腺`(**hash 路由 + `/app/` 前缀**;收官刀把 `search` 从 `DEFERRED_TABS` 反转之后才成立) |
| 23 | 按 Esc 同时关掉预览 + 抽屉 | 两者同时挂载 | 🔴 **不可达** | N41 的行为无从实机验;**验收清单仍要写明这是与旧版一致的预期** |

### D.10.1 第一次搜索要等多久(**必须写进验收清单,否则机主必然报 bug**)

| 场景 | 实测 |
|---|---|
| Parser **未重启**(当前状态,模型已驻留) | 当天首调 **5.04 s**;之后不同词 **0.23–0.38 s**;同词重复 **0.001 s**(Search 侧 EmbedCache) |
| Parser **刚重启过**(冷进程) | 回到上级设计 §6.1 记的 **≈16.7 s 首调**,Parser RSS 涨到 **≈2.8 GB** |

🔴 验收清单写成条件句;验收前先 `curl http://127.0.0.1:8283/v1/parser/stats` 确认 Parser 在跑,
或先用任意查询预热一次。

### D.10.2 怎么人为造 `phase === 'error'` + 怎么恢复

`run()` 的 catch 只在请求抛异常时触发。最轻的造法(**按可逆性从高到低**):

| 造法 | 命令 | 恢复 |
|---|---|---|
| **推荐** —— 浏览器 DevTools Network 面板设 **Offline**,然后点搜索 | 无需碰设备 | 取消 Offline |
| DevTools 里对 `**/v1/ai/search/text` 设 **Block request URL** | 无需碰设备 | 右键取消 block |
| 停 Parser(embedder unavailable → Search 返 503 → axios 抛) | `sudo systemctl stop nimoos-parser` | 🔴 `sudo systemctl start nimoos-parser` —— **重启后模型冷加载,首次搜索回到 ≈16.7 s / +2.8 GB** |

🔴 **验收清单只写前两种**(浏览器侧,零设备风险)。停 Parser 那条**标红**并注明代价。

### D.10.3 「这一屏怎么从产品的正常导航走到」(治理 §13-4,清单第一项)

`/ai/settings`(AI 设置页)顶栏「**详情**」→ `/ai/knowledge`(知识库概览)→ 左栏 rail **第 2 项「搜索」**。
🔴 **收官刀把 `search` 从 `DEFERRED_TABS` 反转之后才成立**(在那之前点第 2 项落占位页)。
深链(可直接粘贴):`http://<设备IP>/app/#/ai/knowledge/search`
带查询:`http://<设备IP>/app/#/ai/knowledge/search?q=甲状腺`

---

## D.11 T2 的 `sass` 与守卫门

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null   # exit 0
pnpm exec vitest run src/ai/styles/knowledgeStyles.test.ts --reporter=verbose
```
- 🔴 **`knowledgeStyles.test.ts` 是 `knowledge.scss` 唯一的配色防线**(`color-guard.test.ts` 不扫 `.scss`,
  且本期它在**全期零改动清单**上,一行不许动 —— 治理 §0.3 / §9.10)。
- **M-4**:`knowledgeStyles.test.ts:399` 的用例名「`&.text` **只在** `.k-btn{…}` 内」比断言实际做的事宽
  → **T2 顺手改准标题(只改用例名,不动断言)**。
