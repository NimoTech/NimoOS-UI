# P5b 附录 D —— CSS 类白名单(新增 **85** 类,`WHITELIST_102` → **187**)

> **权威源**:蓝本 `git show main:src/views/AI/Knowledge/{QueueView,IndexedFilesView}.vue` 的 `<template>`
> 与 `git show main:src/views/AI/Knowledge/styles/knowledge.scss` 的对应段。
> T0 用脚本从两个模板抽了全部 `class="…"` 与 `:class` 里的字符串字面量(**97 个 `k*` 类**),
> 又从 scss 各段抽了全部 `.k…` 选择器,与计划书附录 D 做了**双向 diff**。

## D.0 计数订正(计划书说 101 → 186,实际 102 → 187)

`src/ai/styles/knowledgeStyles.test.ts:41` 的常量名就叫 **`WHITELIST_102`**,数组实测 **102 项**
(P5a T11 已把 brief 的 103 订正成 102,注释里写着理由)。所以:

| 阶段 | 白名单类数 | 常量名建议 |
|---|---|---|
| 起点(`d8efb0e`) | **102** | `WHITELIST_102`(现状) |
| T2 后 | 102 + 32 = **134** | 重命名成 `WHITELIST_134` |
| T6 后 | 134 + 53 = **187** | 重命名成 `WHITELIST_187` |

**DoD 里凡引用「133 / 186 / 101」的,一律改用 134 / 187 / 102。**
(常量名跟着数字改是本档既定习惯 —— 名字本身就是防漂移断言的一部分。)

## D.0.1 🔴 T2 必须同时扩「没有搬多」守卫的正则

见 `p5b-appendix-B-tokens.md` §B.5:现有正则 `/\.k2?-[a-z0-9-]+/g` **扫不到 `.kn-badge`**,
而 T2 恰好要搬 `.kn-*` 前缀的 S7 段。T2 必须扩成 `/\.k(?:2|n)?-[a-z0-9-]+/g` 并做 RED 探针。
(白名单的**存在性**断言用 `new RegExp('\\.'+c+'(?![\\w-])')`,对 `kn-badge` 本来就有效,不用改。)

---

## D.1 T2(scss A / 共享底座段)新增 **32 类**

对应蓝本段:S1 `:241-252` · S2 `:253-257` · S3 `:735-968` · S4 `:1296-1316`+`:1335-1341` ·
S5 `:1398-1430` · S6 `:1484-1499` · S7 `:2031-2039`。

```
k-banner-close  k-confirm-body  k-confirm-icon  k-confirm-summary  k-confirm-title
k-done-stat  k-done-stat-label  k-done-stat-num
k-filter-pill  k-filter-pill-count
k-modal  k-modal-bg  k-modal-foot
k-queue-head
k-row  k-row-action  k-row-actions  k-row-badges  k-row-check  k-row-error
k-row-head  k-row-name  k-row-path  k-row-retry  k-row-status  k-row-time
k-table  k-table-foot
k-toolbar  k-toolbar-label
k-view
kn-badge
```

粘贴用(TS 数组片段,按字母序):

```ts
  // ---- P5b T2:附录 D.1(32 个)----
  'k-banner-close', 'k-confirm-body', 'k-confirm-icon', 'k-confirm-summary',
  'k-confirm-title', 'k-done-stat', 'k-done-stat-label', 'k-done-stat-num',
  'k-filter-pill', 'k-filter-pill-count', 'k-modal', 'k-modal-bg',
  'k-modal-foot', 'k-queue-head', 'k-row', 'k-row-action',
  'k-row-actions', 'k-row-badges', 'k-row-check', 'k-row-error',
  'k-row-head', 'k-row-name', 'k-row-path', 'k-row-retry',
  'k-row-status', 'k-row-time', 'k-table', 'k-table-foot',
  'k-toolbar', 'k-toolbar-label', 'k-view', 'kn-badge',
```

**T0 双向 diff 结论**:这 32 个与「T2 七段 scss 里定义的全部 `.k…` 选择器」完全一致,
唯二的差集是 `k-btn` 与 `k-scroll` —— 这两个**已在 `WHITELIST_102` 里**(P5a 搬的),不重复计。

**K17 排除的 4 个**(本期不搬,留 P5c):`k-modal-head` · `k-modal-title` · `k-modal-x` · `k-modal-body`。
它们在蓝本 `:1318-1334`,正好夹在 S4a(`:1296-1316`)与 S4b(`:1335-1341`)中间 —— **T2 要跳过这一段**。

---

## D.2 T6(scss B / 已收录文件段)新增 **53 类**

对应蓝本段:S8 `:1705-2022`(整段重新嵌套进 `.knowledge-app`,K9)。

```
k-ab-actions  k-ab-info  k-ab-inner  k-ab-warn
k-fd-error  k-fd-grid  k-fd-item  k-fd-k  k-fd-mod  k-fd-mods  k-fd-sha  k-fd-v  k-fd-wide
k-file-detail
k-files-actionbar  k-files-count  k-files-meta  k-files-tools
k-filt  k-filt-check  k-filt-chip  k-filt-clear  k-filt-grow  k-filt-input  k-filt-label  k-filt-select
k-filter-bar
k-frow-errhint  k-frow-expand  k-frow-f  k-frow-fhead  k-frow-num  k-frow-pathcell
k-frow-pathtxt  k-frow-rebuild  k-frow-skel  k-frow-status  k-frow-time  k-frow-vec  k-frow-zerohint
k-ftable
k-pager  k-pager-ctrls  k-pager-info  k-pager-page  k-pager-size
k-poll  k-rebuild-btn
k-sort  k-sort-dir
k-status-badge  k-type-legacy  k-type-tag
```

粘贴用:

```ts
  // ---- P5b T6:附录 D.2(53 个)----
  'k-ab-actions', 'k-ab-info', 'k-ab-inner', 'k-ab-warn',
  'k-fd-error', 'k-fd-grid', 'k-fd-item', 'k-fd-k',
  'k-fd-mod', 'k-fd-mods', 'k-fd-sha', 'k-fd-v',
  'k-fd-wide', 'k-file-detail', 'k-files-actionbar', 'k-files-count',
  'k-files-meta', 'k-files-tools', 'k-filt', 'k-filt-check',
  'k-filt-chip', 'k-filt-clear', 'k-filt-grow', 'k-filt-input',
  'k-filt-label', 'k-filt-select', 'k-filter-bar', 'k-frow-errhint',
  'k-frow-expand', 'k-frow-f', 'k-frow-fhead', 'k-frow-num',
  'k-frow-pathcell', 'k-frow-pathtxt', 'k-frow-rebuild', 'k-frow-skel',
  'k-frow-status', 'k-frow-time', 'k-frow-vec', 'k-frow-zerohint',
  'k-ftable', 'k-pager', 'k-pager-ctrls', 'k-pager-info',
  'k-pager-page', 'k-pager-size', 'k-poll', 'k-rebuild-btn',
  'k-sort', 'k-sort-dir', 'k-status-badge', 'k-type-legacy',
  'k-type-tag',
```

**T0 双向 diff 结论**:这 53 个与 `:1705-2022` 里定义的全部 `.k…` 选择器完全一致,
唯一差集是 `k-btn`(已在白名单)。

**T6 段内的 keyframes**:只有 `@keyframes row-done`(`:1844-1847`)是新的,
放到文件末尾的**全局 keyframes 区**(照 P5a T11 处理 `k2pulse`/`k2spin` 的先例,
现状文件 `:814-815` 就是那两条)。
段内引用的另一个 `k-pulse`(`:1859` `.k-status-badge[data-s="indexing"] svg` 与
`:1799` `.k-poll svg`)**已经在现状文件里**(P5a 搬的 7 条之一),**不要重复定义**。

---

## D.3 属性态清单(**逐处照蓝本**,测试两侧都要覆盖)

🔴 **T0 订正:计划书 D.3 那句「所有布尔属性在模板里必须套 `String()`」与蓝本不符。**
蓝本 `QueueView.vue` 的 7 处套了 `String()`,`IndexedFilesView.vue` 的 5 处**没套**。
**裁定:逐处照抄蓝本**(下表 `String()` 列),理由见 §D.3.1。

| 宿主类 | 属性 | 蓝本位置 | 取值 | 蓝本是否套 `String()` |
|---|---|---|---|---|
| `.k-filter-pill` | `data-on` | `QueueView.vue:7,10,18,24,30` | `"true"` / `"false"` | ✅ 套 |
| `.k-filter-pill` | `data-tone` | `QueueView.vue:29` | `danger`(静态字面量) | — |
| `.k-toolbar` | `data-selecting` | `QueueView.vue:44` | `"true"` / `"false"` | ✅ 套 |
| `.k-row` | `data-selected` | `QueueView.vue:110` | `"true"` / `"false"` | ✅ 套 |
| `.k-row` | `data-scope` | `QueueView.vue:146,155` | `distill`(静态字面量) | — |
| `.k-row-status` | `data-state` | `QueueView.vue:112`(= `filter`)、`:156`(= `distillIconState(row)`) | `pending` / `running` / `failed` | — |
| `.k-row-action` | `data-tone` | `QueueView.vue:128,173` | `danger`(静态字面量) | — |
| `.kn-badge` | `data-s` | `QueueView.vue:164`(`curated`/`archived`)、`:167`(`draft`)、`:168`(`failed`) | `draft`/`archived`/`curated`/`failed` | — |
| `.k-filt-check` | `data-on` | `IndexedFilesView.vue:49` | `"true"` / `"false"` | ✅ 套 |
| `.k-banner` | `data-tone` | `IndexedFilesView.vue:93,365` | `warn`(静态字面量) | — |
| `.k-frow-f` | `data-selected` | `IndexedFilesView.vue:174` | 布尔 | ❌ **不套** |
| `.k-frow-f` | `data-status` | `IndexedFilesView.vue:175` | `ok`/`indexing`/`error`/`tombstoned`(直接是 `file.status`) | — |
| `.k-frow-f` | `data-done` | `IndexedFilesView.vue:176` | 布尔 | ❌ **不套** |
| `.k-status-badge` | `data-s` | `IndexedFilesView.vue:190` | `ok`/`indexing`/`error`/`tombstoned` | — |
| `.k-type-tag` | `data-kind` | `IndexedFilesView.vue:220` | `doc`/`pdf`/`md`/`txt`/`code` | — |
| `.k-frow-vec` | `data-zero` | `IndexedFilesView.vue:231` | 布尔 | ❌ **不套** |
| `.k-frow-expand` | `data-open` | `IndexedFilesView.vue:253` | 布尔 | ❌ **不套** |
| `.k-files-actionbar` | `data-active` | `IndexedFilesView.vue:323` | 布尔 | ❌ **不套** |

**T0 已核**:上面出现的每一个 `[data-x="…"]` 在蓝本 scss 里都写成 **`="true"` / 具名值**的形式,
没有任何「属性存在性」选择器(`[data-x]` 裸形)。

### D.3.1 为什么「照抄」是安全的 —— Vue 3 的实际行为(T0 读源码实证)

`node_modules/.pnpm/@vue+runtime-dom@3.5.39/…/runtime-dom.cjs.js:560-577` 的 `patchAttr`:

```js
if (value == null || isBoolean && !includeBooleanAttr(value)) el.removeAttribute(key)
else el.setAttribute(key, isBoolean ? "" : ... value)
```

`data-*` 不属于 `isSpecialBooleanAttr` → `isBoolean === false` → **只有 `null`/`undefined` 才删属性,
`false` 会照样 `setAttribute(key, false)` 渲染成 `data-x="false"`。**
所以在 Vue 3 里 `:data-x="bool"` 与 `:data-x="String(bool)"` **渲染结果完全一致**。

(Vue 2 不同:`isFalsyAttrValue` 把 `false` 也当删除条件 → Vue2 里 `data-selected` 在 false 时**没有这个属性**。
这是 Vue2→Vue3 的框架差,不是移植选择,两种写法都改变不了它;而由于 CSS 只有 `="true"` 选择器,
**视觉零差异**。)

→ **结论:套不套都不影响渲染,所以没有任何「修正可复现错误行为」的理由去改写蓝本
=「与需求无关的顺手改动」,禁。逐处照抄。**

### D.3.2 测试断言口径(所有属性态一律如此)

```ts
expect(el.attributes('data-selected')).toBe('true')    // 真侧
expect(el.attributes('data-selected')).toBe('false')   // 假侧 —— 不许写 toBeUndefined()
```

- **两侧都要断言**,不能只测一边(P5a T12 的 I-3:只覆盖 4 个宿主里的 1 个)。
- 🔴 P5a `.k2-cc` 那次事故的**真实教训是属性名错**(附录写 `[data-active]`,蓝本实际是 `[data-on]`),
  **不是 `String()`**。计划书 D.3 把这条教训引错了。真正要防的是:
  **每个属性名都自己回蓝本 scss `grep` 一次,别信附录**。

---

## D.4 🔴 蓝本自身的未定义类(**2 个**,一律不进白名单)

计划书 D.4 只登记了 1 个(N10)。T0 用「模板抽类 ∖ (白名单 ∪ D.1 ∪ D.2)」的差集扫出**第 2 个**:

| 类名 | 模板用处 | 蓝本 scss 里有定义吗 | 处理 |
|---|---|---|---|
| `k-empty-btn` | `IndexedFilesView.vue:139`(空态的「清空筛选」按钮) | ❌ 无(`git grep k-empty-btn main` 只命中这一行模板) | **N10** —— 类名照抄,渲染成无样式按钮,与 Vue2 一致。**不进白名单**(它不是 scss 类),T8 报告显式说明 |
| `k-status-badge-cn` | `IndexedFilesView.vue:197`(状态徽标里的文字 span) | ❌ 无(同上,`git grep` 只命中这一行) | **N13(T0 新登记)** —— 同 N10 的处理:类名照抄、不进白名单、不许为它凭空写规则。T9 报告显式说明 |

> 为什么必须登记而不是「顺手补个样式」:补了就是**凭空多出 Vue2 没有的样式** = 界面不 1:1。
> 为什么必须**不进白名单**:白名单的「每个类都要有对应规则」断言会因为找不到规则而报红,
> 那时实现者很可能去「放宽正则」而不是查清原因(P5a 同族事故已 6 次)。

## D.5 蓝本里的死规则(**不搬**)

| 蓝本行 | 规则 | 为什么不搬 |
|---|---|---|
| `:1675-1703` | 顶层的 `.k-confirm-icon` / `.k-confirm-title` / `.k-confirm-summary` | **K10** —— 与 `:1398-1430` 的嵌套版声明逐字等价,级联上 `.knowledge-app .k-confirm-icon`(0,2,0)完胜顶层版(0,1,0)→ **Vue2 里就永不生效**。只搬嵌套版(它还多一条 `.k-confirm-summary b`) |
| `:1500-1503` | `@media` 里的 `.k-frow { grid-template-columns: 80px 1fr 70px 28px; font-size: 12px; }` | **T0 新发现的死规则**:两个蓝本模板里**没有任何元素用 `class="k-frow"`**(文件表格行用的是 `.k-frow-f`)。既不在 D.1 也不在 D.2,**不搬**,也不要"顺手改成 `.k-frow-f`"(那会凭空多出 Vue2 没有的窄屏栅格) |

## D.6 T2 的 S6 段落地提示(容易搬错)

S6(`:1484-1499`)的两条规则(`.k-row` 与 `.k-row[data-scope="distill"]`)在蓝本里是
**`@media (max-width: 860px)` 块内部**的。现状文件 `src/ai/styles/knowledge.scss` 里
**已经有**这个 `@media (max-width: 860px) { … }` 块(P5a 搬 `.k-rail`/`.k-mobile-tabs` 时建的),
**T2 要把这两条加进那个既有块内部,不要另起一个 `@media`。**
蓝本 **`:1498` 单行**的 `> *:nth-child(6) { display: revert; }`(T0 实测:`:1497` 是另一条
`nth-child(3)/(4)/(5)`、`:1499` 是闭合 `}`)与它**上面 `:1488-1494` 共 7 行**的解释性注释
**一起照抄**(注释解释了为什么必须显式 un-hide —— 基础 `.k-row` 规则也匹配这个元素、
否则会把第 6 个子元素一起隐藏,只剩 3 个可见子元素撑不满 4 列栅格。是有信息量的)。
