# SP8-P5a Task 12 —— 独立评审(本期最后一个任务)

评审者:独立评审 agent(opus)· 日期 2026-08-01 · 被评审提交 `7b215a0`(分支 `sp8-ai`)
蓝本取源:`git -C /home/nimo/NimoTech/NimoOS-UI show main:src/views/AI/Knowledge/DashboardView.vue`(371 行,`main@7a6ee6b7`)—— 全文自读,未采信实现者报告。

## 0. 判定

| 项 | 结论 |
|---|---|
| **Spec 合规** | ❌(1 条 Critical:`emptyEntries` 掉了 `tone: 'wiki'`,界面 1:1 违反且未申报) |
| **任务质量** | **不通过**(须改:1 Critical + 4 Important;其余全部达标) |

Critical 1 条 · Important 4 条 · Minor 3 条。修完即可放行 —— 所有问题都是加一个 token / 加断言,零架构改动。

---

## 1. 七块逐块对照表(结构 + class + 层级 + 顺序 + 文案)

对照方法(两条独立机械核验,不靠肉眼):

**① 结构 token 流 diff** —— 把两侧 `<template>` 归一化成「标签 + class + 全部 `data-*` + `v-if/v-else/v-for` + `name`」的 token 序列后 unified diff:

```
bp tokens 404   new tokens 404
仅 3 处差异:
-  <span class=k2-paused-note v-if=store.state.controlState.paused
+  <span class=k2-paused-note v-if=store.controlState.paused
-  <button :data-on=String(store.state.controlState.concurrency === c.n) ...
+  <button :data-on=String(store.controlState.concurrency === c.n) ...
-  <span class=k2-entry-badge :data-tone=e.badgeTone v-if=e.badge > 0
+  <span class=k2-entry-badge :data-tone=e.badgeTone v-if=(e.badge || 0) > 0
```
前两处 = 偏离 **P1**(`Vue.observable` → Pinia,`store.state.x` → `store.x`)已授权;第三处 = TS 窄化(`badge?: number`,`undefined > 0` 与 `(undefined||0) > 0` 同为 `false`),行为等价。**DOM 结构 / class / 层级 / 顺序:零差异。**

**② 文案序列 diff** —— 按出现顺序抽取蓝本 `$t('literal')` 与本仓 `t('aiKbXxx')`,用 `src/i18n/en_us.ts` 把键翻回英文值后逐位比对:

```
blueprint $t: 59   new t: 59   mismatches: 0
```
59 处文案键映射与蓝本逐位对齐,零错位、零漏译、零合并。非 `$t` 的字面英文文本节点(`Go to` / `What's inside` / `Knowledge roots` / `Live` / `Go deeper` / `TREE` / `SEMANTIC` / `BACKLINKS` / `· Wiki` / `· Vectors` / `· Notes` / `file_id` / `root_id` / `session_id` / `→` / `&lrm;`)两侧逐字相同 —— 蓝本自己也没走 `$t`,照抄正确(与 T10 `TITLES[].en` 同一先例)。

| # | 块 | 蓝本行号 | 本仓行号 | 结论 |
|---|---|---|---|---|
| 1 | 搜索 hero + 建议 chips | `:43-59` | `:253-274` | ✅ 逐字一致(`KIcon search size17 color=var(--text-tertiary)` · `ref="hero"` · `autofocus` · `k2-search-dots` 三个 `<i/>` + `:title` · `k-btn primary :disabled="!query.trim()"` · `SAMPLE_QUERIES` 5 条 → `k-suggest-chip` `@click="goSearch(t(q))"`) |
| 2 | 三层组成卡 TREE/SEMANTIC/BACKLINKS | `:61-136` | `:276-377` | ✅ 三卡 `data-layer=wiki/vec/note` · `k2-layer-top/name/name-en/chev` · `k2-layer-num` + `suffix`/`second`/`k2-drafts` · `k2-layer-bar` 的 `flex`/`opacity` 数值(`1`/`0.35`;`vectorsVisual*8`;`0.001` 下限;notes 三段 `1/0.55/0.22`)逐字一致 · `k2-layer-sub`/`desc` 一致 · glue 行一致 |
| 3 | 知识根一览 | `:138-178` | `:379-421` | ✅ `k2-sec-link`「管理知识根 →」· 3 骨架卡(2 条 `k-skel`)· `k2-root` 只渲染 `enabledRoots` · `k2-root-ico` 三元 `drive`/`folder` · `&lrm;{{ r.path }}` + `:title` · `k2-root-level` Space/Project · 三个 `k2-chip`(live / 无 tone / warn)· `k2-root-meta` + `fmtAgo`/never · `k2-root-add` · `k2-roots-off`(eye 12 + `<code v-for>` + 按钮) |
| 4 | 解析进度(Surface C) | `:180-245` | `:423-505` | ✅ 单骨架卡(16px/45% + 10px/90%)· `backlog>0` 分支(`k2-live-ico > span.spin > KIcon spinner 16`,`k2-prog` `<i :style width>`,`k2-prog-pct`)· `else` 分支(`data-ok="true"` + `check 16` + `lastSyncFmt` + `done10m`)· `k2-live-grid` 三 cell(Throttle / Queue health / Auto-distill)顺序与内部结构一致 |
| 5 | 三 id 说明条 | `:130-135` | `:365-376` | ✅ 顺序 `file_id(--ly-vec)` → `root_id(--ly-wiki)` → `session_id(--ly-note)`,inline `--g` 三处逐字照抄(见 §4) |
| 6 | 快捷入口格(7 项) | `:247-263` | `:507-526` | ✅ `entries` 7 项的 `id/en/key/icon/tone/badge/badgeTone` 全部对齐(见下表) |
| 7 | 空库 onboarding 态 | `:4-39` | `:208-249` | ❌ **1 处**:`emptyEntries[1]`(roots)掉了 `tone: 'wiki'`(蓝本 `:342` vs 本仓 `:171`)。其余(orb + h2 + p + 两 CTA + 三层 intro + `Go deeper`/`Go to` sec-head + 4 项 `k2-entry` `:data-disabled="String(!!e.disabled)"` + `@click="!e.disabled && go(e.id)"`)全部一致 |

### 常量三件套逐字段核对

`SAMPLE_QUERIES`(蓝本 `:274`)5 条顺序一致 → `aiKbSampleThyroid/PythonAsync/Contract/Iphone/Skating`,en 值回译逐字命中。
`LAYER_INTROS`(蓝本 `:278-285`)`id`/`tag`/`name`/`desc` 三条全对(`tag` 不译,照抄)。
`CC_LEVELS`(蓝本 `:287-291`)`{1,2,4}` × `Power saver/Balanced/Full speed` 全对。

`entries`(蓝本 `:328-338` → 本仓 `:150-166`):7 项 × 全字段 ✅
`emptyEntries`(蓝本 `:339-346` → 本仓 `:169-174`):

| 项 | 蓝本 | 本仓 | |
|---|---|---|---|
| search | `tone: 'accent', disabled: true` | 同 | ✅ |
| **roots** | `icon: 'drive', **tone: 'wiki'**` | `icon: 'drive'`(无 tone) | ❌ **C-1** |
| allowlist | `icon: 'folder'`(无 tone) | 同 | ✅ |
| settings | `icon: 'settings'`(无 tone) | 同 | ✅ |

---

## 2. CSS 类清单(全部 grep 核实)

程序化从 `<template>` 抽取 `class="…"` 字面量(无 `:class` 动态绑定),**共 73 个**(65 个 `k2-*`/`k-*` 基类 + 5 个修饰类 `outline`/`primary`/`second`/`spin`/`suffix`,其余为 `k-scroll`/`k-scroll-inner`/`k-skel`/`k-btn`/`k-suggest-chip`),逐个 `grep -E '\.<class>(?![\w-])' src/ai/styles/knowledge.scss`:

```
k-btn k-scroll k-scroll-inner k-skel k-suggest-chip
k2-cc k2-cell-label k2-chip k2-distill k2-distill-sub k2-drafts k2-entries k2-entry
k2-entry-badge k2-entry-cn k2-entry-en k2-entry-ico k2-glue k2-glue-id k2-layer
k2-layer-bar k2-layer-chev k2-layer-desc k2-layer-name k2-layer-name-en k2-layer-num
k2-layer-sub k2-layer-top k2-layers k2-live k2-live-cell k2-live-grid k2-live-ico
k2-live-sub k2-live-title k2-live-top k2-ob-desc k2-ob-layer k2-ob-name k2-onboard
k2-onboard-cta k2-onboard-layers k2-onboard-orb k2-paused-note k2-prog k2-prog-pct
k2-qchip k2-qrow k2-root k2-root-add k2-root-badges k2-root-ico k2-root-level
k2-root-meta k2-root-path k2-roots k2-roots-off k2-search k2-search-dots k2-sec-en
k2-sec-head k2-sec-link k2-sec-title k2-skel-card k2-suggest k2-suggest-label k2-tag
outline primary second spin suffix
```
**MISSING = 0**。零凭空造类。

反向核:`knowledge.scss` 里 `.k2-*` 唯一类 **63 个**,`dist/assets/index-*.css` 里 **63 个**,`comm` 双向零差集 —— 声明的全部进了产物,产物里没有多余类。
(附注:协调者附录 D.2 写「`k2-*` 64 个」,逐行数实为 **63** 个 —— 附录计数偏差,不是漏类。T11 范围,登记即可。)

**零 `<style>` 块**:`grep -c '<style' = 0` ✅
**零硬编码可见文案**:`<template>` 内中文仅出现在 3 条 HTML 注释里(`:4`/`:49`/`:72`),无中文文本节点;`<script setup>` 非注释行零中文 ✅
**零色字面量**:`grep -nE '#[0-9a-f]{3,8}|rgba?\(|\b(white|black|red|blue|green|orange)\b'` → NONE ✅

---

## 3. 图标名清单(逐个对 `KIcon.vue` 的 `PATHS`,42 glyph)

静态 `<KIcon name="…">`:`layers` `plus` `search` `arrowRight` `chev` `clock` `eye` `spinner` `check` `pause` `sparkle` —— **11 个全部命中**。
动态 `:name`:`e.icon`(entries/emptyEntries → `search` `layers` `file` `edit` `drive` `history` `settings` `folder`)与 `r.level === 'space' ? 'drive' : 'folder'` —— **展开后 8 个全部命中**。
**不存在的 glyph:0 个** ✅(但 glyph 名无任何测试守卫,见 I-2)

---

## 4. 属性态五组 + inline `--g` 三处

| 组 | 元素 | 实际渲染 | 蓝本 | 结论 |
|---|---|---|---|---|
| `[data-on]` | `.k2-cc button` ×3 | `String(concurrency === c.n)` → `"true"`/`"false"` | `:219` 同 | ✅ 选择器实为 `.k2-cc button[data-on="true"]`(`knowledge.scss:739`),**不是**附录 D.3 的 `[data-active]` —— 交接项 1 落地正确 |
| `[data-tone]` | `.k2-chip` | `live` / 无 / `warn` | `:159-161` | ✅ 渲染对(但无断言,见 I-3) |
| | `.k2-entry-ico` | `e.tone` = accent/wiki/vec/note | `:32`/`:255` | ❌ `emptyEntries[1]` 掉 `wiki`(C-1);其余对;无断言(I-3) |
| | `.k2-entry-badge` | `e.badgeTone` = `note` | `:260` | ✅ 渲染对,无断言(I-3) |
| | `.k2-qchip` | `danger` | `:228` | ✅ 有断言且经探针 D 证明报红 |
| `[data-layer]` | `.k2-layer` ×3 | `wiki`/`vec`/`note` 静态 | `:76/93/111` | ✅ 有三色顺序断言 |
| | `.k2-ob-layer` ×3 | `l.id` = `wiki`/`vec`/`note` | `:17` | ✅ 有三色顺序断言 |
| `[data-disabled]` | `.k2-entry`(空库) | `String(!!e.disabled)` → `"true"`/`"false"` | `:31` | ✅ 渲染对;仅 `"true"` 侧有断言,`"false"` 侧无(M-2) |
| `[data-ok]` | `.k2-live-ico` | 静态 `"true"` | `:204` | ✅ 渲染对,**零断言**(报告表格声称「backlog 为 0」用例覆盖 —— 该用例只断言 `k2-live-title` 文本与 `k2-prog` 不存在,不查该属性;探针 G 实证)。见 I-3 |

**inline `--g` 三处**(蓝本 `:132-134` 的静态 inline style):

| 位置 | 蓝本 | 本仓 `:367/370/373` |
|---|---|---|
| `file_id` | `style="--g: var(--ly-vec)"` | 同 ✅ |
| `root_id` | `style="--g: var(--ly-wiki)"` | 同 ✅ |
| `session_id` | `style="--g: var(--ly-note)"` | 同 ✅ |

`knowledge.scss:688` = `.k2-glue-id i { background: var(--g, var(--text-quaternary)) }` —— 与交接项 2「不传就落兜底灰」描述一致,三条各自一色。有精确断言(`toContain('--g: var(--ly-vec)')` 等三条),探针已由实现者证明报红。

---

## 5. 逻辑核对

| 项 | 蓝本 | 本仓 | 结论 |
|---|---|---|---|
| `isEmpty` | `:323-327` `ready && overviewLoaded && wikiRoots.length === 0 && (indexed_files||0) === 0` | `:141-147` 逐字同 | ✅ 两侧混合态各有一条对照用例(`补强:wikiRoots 空但 indexed_files>0` / `补强:wikiRoots 非空但 indexed_files=0`) |
| `progressPercent` | `:314` `progressPercent(this.backlog, this.store.state.backlogPeak)` | `:132` `progressPercent(backlog.value, store.backlogPeak)` | ✅ 实参顺序一致;探针 E 证明换序报红 |
| `fmtEta` | `:313` `fmtEta(this.stats.eta_s)` | `:131` 同 | ✅;`util/dashboardHelpers.ts` 与蓝本 `dashboardHelpers.js` 逐行等价(已 diff) |
| **K1 单层取数** | — | 组件内 `grep '\.data\b'` → **NONE**,只读 store 已归一化值 | ✅ |
| **K5** 失败不回显 body | — | 组件不发 HTTP、不渲染任何后端 body | ✅ |
| **K6** `console.error` | — | `grep 'console\.'` → **NONE** | ✅ |
| 搜索回车 | `:361` `push({path:'/ai/knowledge/search', query:{q}})` | `:186` 同;`submit()` 先 `trim()` 空判 | ✅ 有「空查询不跳 + 非空跳且 trim」双侧断言 |
| `go()` | `:366-368` `id==='dashboard' ? '/ai/knowledge' : '/ai/knowledge/'+id` | `:193-195` 同 | ✅ |
| `queueDepth` 兜底 | `this.stats.queue_depth || {}` | `|| { pending:0,running:0,failed:0,done:0 }` | ⚠️ M-1(等价,TS 驱动;下游全部有 `|| 0`,行为无差) |
| `hero` ref | 蓝本声明但从不使用 | 同样声明不使用 | ✅ 死代码照抄,忠于蓝本 |

### §3.5「照抄不改」命中项

**N2 —— ✅ 确认照抄,未被"顺手优化"。**
`:127` `rate = stats.rate_per_min || 0` · `:129` `done10m = stats.done_last_10m || 0` · `:131` `etaText = fmtEta(stats.eta_s)`(`fmtEta` 内 `etaS == null → ''`)。三个字段走本地窄化类型 `DashboardStats extends ParserStats`(不回改 T6 的 `ParserStats`),`|| 0` 兜底一个不少;模板 `v-if="rate > 0"` / `v-if="etaText"` 与蓝本 `:196` 逐字同 —— **没有任何「无数据就隐藏整块」的改写**。
钉子用例:
- `DashboardView — 数值与文案 > N2:后端不下发 rate/eta/done10m 时,速率行落到「等待解析器…」而不是 NaN`(精确 `toBe('等待解析器…')`)
- `DashboardView — 数值与文案 > N2 钉子:done_last_10m 缺失时 all-synced 行渲染数字 0(不是隐藏这一块)`(整串精确 `toBe('上次同步 — · 近 10 分钟完成 0 个')`)
- `DashboardView — 数值与文案 > 补强:rate_per_min/eta_s 字段存在时正确渲染(fmtEta 接线,假设性覆盖,非真机现状)`

**N3 —— ✅ 确认照抄生产代码,未改 `allSettled`、未给 `loadRoots` 单独超时。**
`:198-202` `onMounted(() => { Promise.all([loadOverview(), loadRoots(), loadNotesSummary()]).finally(() => { ready.value = true }) })` —— 与蓝本 `:348-352` 逐字等价(`created` → `onMounted` 是 Vue3 机械替换)。
钉子用例:`DashboardView — 生命周期(N3) > 挂载时三个来源并发拉取;任一失败也把 ready 置起(Promise.all + finally,照抄)` + `补强:三个来源里只要有一个还没 settle,骨架仍在`。
**⚠️ 但这两条都钉不住 `all` → `allSettled` 的回归 —— 见 I-1(探针 C 实证 + 我实证了一条能钉住的写法)。**

其余 N1/N4/N5/N6/N7/N8 不在本任务范围(store/scss/rail 侧,T6/T7/T10/T11 已评)。

---

## 6. 路由反转

| 核对项 | 结论 |
|---|---|
| `knowledgeRoutes.ts` 是否只改 `''` 那一行 | ✅ `git show 7b215a0` 的该文件 diff = 新增 1 行 `import DashboardView` + 3 行说明注释 + `''` 那一行的 `component` 换掉,**其余 10 条(8 子路由 + 2 parser)原封不动** |
| 父路由 | ✅ 仍是 `KnowledgeLayout`(T10 R8 接上的,未被动) |
| 旧断言是删还是反转 | ✅ **反转**;T5 原文与 R8 原文两版全文都以注释形式留痕(`:33-41` + `:45-60`),改后断言把 `''` 单独钉 `DashboardView` + `not.toBe(KnowledgeDeferred)`,`stillDeferred` 从 11 降到 10 |
| 反转后是否仍能分辨 | ✅ **探针 F**:把 `'search'` 子路由改成 `DashboardView` → `× 父路由(布局位)是 KnowledgeLayout,"" 子路由(仪表盘)是 DashboardView,其余 8 个子路由 + 2 条 parser 路由仍是占位页 KnowledgeDeferred`(`Tests 1 failed | 2 passed`)。已精确还原 |
| 另两条 `it` 是否被削弱 | ✅ 未动(路径表、name 表逐字保留) |
| `deferred.ts` | ✅ `DEFERRED_TABS` 8 项不含 `dashboard`;**本任务未修改该文件**(不在 commit 的 4 个文件里) |

---

## 7. 测试质量审计

**基本面**:22 条用例、零 `it.skip`、零空转(每条都能被对应生产代码破坏触发红,除下述例外)。`flushPromises()` 全程使用(无裸 `nextTick`)✅。未用 `vi.mock`(全部走 `vi.spyOn(store, …)`),故不需要 `vi.hoisted()` —— 不是遗漏 ✅。既有 312 个测试文件**零改动**(`git show --stat` 只含 4 个文件,唯一被改的既有测试文件是 `knowledgeRoutes.test.ts`,且是反转不是削弱)✅。

**已有真判别力**(经我独立探针或逐条推演确认):`isEmpty` 两侧混合态 · `[data-layer]` 三色(正常态 + onboarding 两条,`toEqual(['wiki','vec','note'])` 顺序敏感)· `[data-on]` 三个档位的 true/false 值 · inline `--g` 三条 · `progressPercent` 实参顺序(探针 E 报红)· `.k2-qchip[data-tone=danger]`(探针 D 报红)· N2 三个字段(整串精确匹配)· 交接项 3 的子元素 class(选择器带父级 `.k2-layer-num .second`,挪到父元素即红)· `k2-entry` 数量 7/4 两侧 · 三层卡跳转三个目标 · 搜索空/非空双侧 · 三个 loader 各调一次。

**弱断言 / 缺口**(逐条:)
1. **I-1** N3 的 `Promise.all` vs `allSettled` 无任何钉子(探针 C)。测试文件 `:428-438` 的长注释断言两者「完全等价,无法从组件外部区分」—— **这个论断是错的**:`Promise.all` 是 fail-fast(有一个 reject 就立刻 settle,不等其余),`allSettled` 必等全部。我写了一条临时用例实证:`loadRoots` 立即 reject + `loadOverview` 永久悬挂 → `Promise.all` 下骨架消失(绿)、`allSettled` 下骨架仍在(红)。用例已删除,`git status` 干净。
2. **I-2** 图标名零守卫(探针 B / B2):`sparkle → sparkleXX`、entries 的 `file → fileXX` 都全绿。`KIcon.vue:79` 是 `PATHS[props.name] || ''`,未命中静默渲染空 `<svg>` —— 空白图标不可能被现有用例抓到。
3. **I-3** 属性态断言覆盖不全(探针 G/H/I 三次全绿):删掉 `data-ok="true"`、把 `.k2-chip` 的 `live` 改 `warn`、把 `emptyEntries[0]` 的 `tone: 'accent'` 改 `'vec'` —— 三次都 22 passed。即 `[data-ok]` 零断言、`.k2-chip`/`.k2-entry-ico`/`.k2-entry-badge` 的 `[data-tone]` 零断言(只有 `.k2-qchip` 有)。报告 §5 的五组表格声称 `[data-ok]` 由「backlog 为 0」用例覆盖 —— **属报告overclaim**,该用例不查该属性。**C-1 那条界面缺陷正是从这个缺口漏出去的。**
4. **M-3** `toContain` 数字型弱断言 2 处:`:242` `expect(nums[0]).toContain('1')` · `:244` `expect(nums[2]).toContain('5')`。推演确认当前不会被文案里的数字撞对(`「个知识根」`/`「条笔记」` 无数字;`nums[2]` 全文是 `5条笔记2 待确认`),但同一文件里 `nums[1]` 已用 `toContain('1,234')`、N2 钉子已改整串精确匹配 —— 这两处应统一成整串精确匹配才与本文件自己的标准一致。
5. **M-2** `[data-disabled]` 只断言 `"true"` 侧(`emptyEntries[0]`),`"false"` 侧(其余三项)无断言。

**实现者自报的那条弱断言修法核查**(申报 2):`.toContain('0')` → 整串 `toBe('上次同步 — · 近 10 分钟完成 0 个')` —— 修法**彻底、正确**(整串匹配同时钉住了 `lastSyncFmt` 兜底 `—` 与分隔符 `·`)。但**同文件仍有另 2 处同类 `toContain` 数字**(M-3),说明修的是被探针撞到的那一处,没做同类扫描。

---

## 8. 五次独立 RED 探针(+4 次追加)全部精确还原

每次探针后 `git checkout -- <file>` + `git status --short` 确认空。

| # | 破坏什么 | 改前 → 改后 | 结果 |
|---|---|---|---|
| **A** | `data-on` 去 `String()`(`false` 侧) | `:data-on="String(store.controlState.concurrency === c.n)"` → `:data-on="store.controlState.concurrency === c.n"` | **全绿 22/22** —— 无人报红。现有用例 `:155-157` **已经**在断言 `false` 侧「属性存在且等于 `"false"`」(`toBe('false')`),但 Vue 3 的 `patchAttr` 对不在 `isSpecialBooleanAttr` 名单里的 `data-*` 走 `el.setAttribute(k, v)`,jsdom/浏览器把 `false` 隐式转 `"false"` —— **属性不会被删掉**,所以连这个最强角度也分辨不出来 |
| **B** | `<KIcon name="sparkle">` → `sparkleXX` | 同 | **全绿 22/22** —— 无人报红(**I-2**) |
| **B2** | entries 的 `icon: 'file'` → `'fileXX'` | 同 | **全绿 22/22** —— 无人报红(**I-2**) |
| **C** | `Promise.all` → `Promise.allSettled` | `Promise.all([store.loadOverview(), …])` → `Promise.allSettled([…])` | **全绿 22/22** —— 无人报红(**I-1**) |
| **D** | `.k2-qchip` 的 `data-tone="danger"` → `"warn"` | 同 | **RED** ✅ `× failed > 0 时队列健康里那个 chip 可点并跳带 filter 的队列页`(`1 failed | 21 passed`) |
| **E** | `progressPercent` 两实参换序 | `progressPercent(backlog.value, store.backlogPeak)` → `progressPercent(store.backlogPeak, backlog.value)` | **RED** ✅ `× 补强:progressPercent 接线 —— backlogPeak 与 backlog 传参顺序不能颠倒`(`1 failed | 21 passed`) |
| **F**(追加) | `'search'` 子路由 → `DashboardView` | 同 | **RED** ✅ `× 父路由(布局位)是 KnowledgeLayout,"" 子路由(仪表盘)是 DashboardView,…`(`1 failed | 2 passed`) |
| **G**(追加) | 删 `.k2-live-ico` 的 `data-ok="true"` | 同 | **全绿 22/22** —— 无人报红(**I-3**) |
| **H**(追加) | `.k2-chip` 的 `data-tone="live"` → `"warn"` | 同 | **全绿 22/22** —— 无人报红(**I-3**) |
| **I**(追加) | `emptyEntries[0]` 的 `tone: 'accent'` → `'vec'` | 同 | **全绿 22/22** —— 无人报红(**I-3**;C-1 的漏网机制) |
| **J**(追加,验证补救可行) | 临时新增 `__probe_n3.test.ts`(fail-fast 判别用例)后再切 `allSettled` | — | `Promise.all` 下 **1 passed**;`allSettled` 下 **1 failed** → **判别写法可行**。临时文件已删,`git status` 干净 |

---

## 9. 三门与产物(我实测)

```
pnpm test                  exit=0   Test Files  313 passed (313)   Tests  2858 passed (2858)
pnpm exec vue-tsc --noEmit exit=0   (输出 0 行)
pnpm build                 exit=0   (仅既有第三方包 + >500KB chunk 警告)

dist/assets/*.css 里 `.k2-` 唯一类:63
grep -c 'knowledge-app' dist/assets/*.css → index-DfgHL4qe.css:1(其余 8 个 viewer 专用 css 为 0)
```
已知噪声(`src/files/upload/persist.test.ts > dropPersisted …` · `AgentComposer.test.ts` i18n teardown)**本轮未出现**,全绿无红项。与实现者报的 313/2858 一致。

### 收官算术核对 ✅ 自洽

- 起点 `99ee99a` = **303 文件 / 2719 例** → 现在 **313 / 2858**。
- `git diff --name-status 99ee99a..HEAD`:新增 **10 个** `*.test.ts`(KIcon · deferred · knowledgeRoutes · knowledgeStore.notesWiki · knowledgeStore.parser · dashboardHelpers · indexedFiles · DashboardView · KnowledgeLayout · knowledgeStyles)→ 303 + 10 = **313** ✅
- `git diff --stat 99ee99a..HEAD -- '*.vue'`:新增 **4 个** `.vue`(`KIcon.vue` T3 · `KnowledgeDeferred.vue` T5 · `KnowledgeLayout.vue` T10 · `DashboardView.vue` T12)→ color-guard **+4** ✅
  独立验证 color-guard 确按 `.vue` 逐个生成:`find src -name '*.vue' | wc -l` = **173**,`vitest run src/styles/color-guard.test.ts` = **175 例**(173 + 2 条非 `.vue` 守卫)→ 一一对应成立。
- 用例增量 2858 − 2719 = **+139** = 4(color-guard)+ 135(P5a 十个测试文件的自有用例)。
- T12 单步:312 → 313 文件(+1)、2835 → 2858 例(+22 自有 + 1 color-guard = +23);`DashboardView.test.ts` 实数 `it(` = **22** ✅。治理文件 §8 原写「收官应为 307 文件」是按「只加 4 个 `.vue`」估的,**没算上 10 个新测试文件**;实测 313 才对 —— 计划作者算术偏差,不是实现者问题。

### 提交卫生 ✅

- `git show --stat 7b215a0` 恰好 4 个文件 / +1020 −4,与要求一致(`knowledgeRoutes.test.ts` 30± · `knowledgeRoutes.ts` 7± · `DashboardView.test.ts` +457 · `DashboardView.vue` +530)。
- `git status --short`(New-UI)= 空。
- `.sp8/NimoOS-Service` HEAD 仍是 `03d3028`(T2 的 fixup),**无本任务新提交**,工作树干净。
- `NimoOS-UI` 无任何提交(`git log` HEAD 仍 `65aea806`,SP7 的文档提交),工作树仅 1 个与本任务无关的未跟踪文件 `FRONTEND_API_GUIDE.md`(非本任务产物,未触碰)。

---

## 10. 发现清单

### Critical

**C-1 · `emptyEntries` 的 roots 项掉了 `tone: 'wiki'` —— 界面 1:1 违反,且未申报**
`src/ai/knowledge/views/DashboardView.vue:171`;蓝本 `NimoOS-UI@main src/views/AI/Knowledge/DashboardView.vue:342`。
蓝本 `{ id: 'roots', en: 'Roots', key: 'Index Roots', icon: 'drive', tone: 'wiki' }`,本仓写成 `{ id: 'roots', en: 'Roots', key: 'aiKbNavRoots', icon: 'drive' }`。
`:data-tone="e.tone"` 的 `undefined` 会被 Vue 删掉属性 → 该磁贴的图标方块落 `knowledge.scss:759` 的默认档(`background: var(--bg-chip); color: var(--text-secondary)` 灰),而蓝本走 `:761` `.k2-entry-ico[data-tone="wiki"]`(`var(--ly-wiki-soft)` / `var(--ly-wiki)` 琥珀色)。
**空库 onboarding 是新装用户看到的第一屏**,第 2 张磁贴颜色不对,正是协调者说的「漏一个 = 可见回归」。治理文件 §2「未申报的偏离本身就是缺陷」。
**应改成**:`{ id: 'roots', en: 'Roots', key: 'aiKbNavRoots', icon: 'drive', tone: 'wiki' }`;并补一条断言(见 I-3 的补救),否则同类回归还会漏。

### Important

**I-1 · N3 缺「`Promise.all` 而非 `allSettled`」的防回归钉子,且测试注释里的等价性论断是错的**
`src/ai/knowledge/views/DashboardView.test.ts:428-438`(注释)+ 生产 `DashboardView.vue:199`。
探针 C:`all → allSettled` 全绿。注释声称两者「在组件外部可观察行为上完全等价」—— 错:`Promise.all` fail-fast(任一 reject 立刻 settle,**不等**其余),`allSettled` 必等全部。
**应改成**:删掉那段错误论断,补一条用例(我已实证可行):
```ts
// loadRoots 立即 reject + loadOverview 永久悬挂
vi.spyOn(s, 'loadOverview').mockReturnValue(new Promise<void>(() => {}))
vi.spyOn(s, 'loadRoots').mockRejectedValue(new Error('boom'))
vi.spyOn(s, 'loadNotesSummary').mockResolvedValue()
// Promise.all 的 fail-fast 语义 → ready 立刻置起,骨架消失
expect(w.find('.k2-skel-card').exists()).toBe(false)   // allSettled 下会是 true
```
(沿用现有那条 `unhandledRejection` 吞噪声脚手架即可。)

**I-2 · `<KIcon name>` 的 glyph 名零守卫 —— 空白图标不可能被抓到**
`DashboardView.vue` 全部 19 个 glyph 引用 + `KIcon.vue:79`(`PATHS[props.name] || ''`)。
探针 B/B2:两个不同位置改成不存在的 glyph 名都全绿。
**应改成**:补一条用例,把模板渲染出的所有 `<svg>` 断言 `innerHTML` 非空(或对 `entries`/`emptyEntries`/`LAYER_INTROS` 里的 `icon` 字段逐个 `expect(Object.keys(PATHS)).toContain(icon)`)。本期后续批次(P5b–P5f)会大量新增 `KIcon` 引用,这条守卫越早补越省事。

**I-3 · 属性态断言覆盖不全:`[data-ok]` 零断言,`[data-tone]` 只覆盖 4 个元素里的 1 个**
`DashboardView.test.ts` 全文只有 1 处 `data-tone`(`:312`,`.k2-qchip`)、0 处 `data-ok`。
探针 G(删 `data-ok="true"`)· H(`.k2-chip` live→warn)· I(`emptyEntries[0]` tone accent→vec)三次全绿。
报告 §5 的表格把 `[data-ok]` 记成「由『backlog 为 0』用例覆盖」,与实际不符。
**应改成**:在「backlog 为 0」用例里加 `expect(w.find('.k2-live-ico').attributes('data-ok')).toBe('true')`;在根卡用例里加 `expect(w.findAll('.k2-chip').map(c => c.attributes('data-tone'))).toEqual(['live', 'warn'])`(启用根 auto + needsReconcile 组合);在两个 entries 用例里各加一条 `data-tone` 序列断言 —— 后者同时钉住 C-1。

**I-4 · 报告 §5 属性态表格与 §11 dist 产物描述均含未经验证的 overclaim**
`.superpowers/sdd/p5a-task-12-report.md:66`(`[data-ok]` 声称有用例覆盖 —— 实无)与 `:71`(N2 补强钉子表述正确)对比。
虽不影响生产代码,但「报告说有钉子、实际没有」会误导下一期评审跳过复核。
**应改成**:报告表格里把无断言的格子标成「渲染确认(无断言)」,或按 I-3 补上断言后再声称覆盖。

### Minor

**M-1** `queueDepth` 兜底从蓝本 `|| {}`(`:308`)改成 `|| { pending:0,running:0,failed:0,done:0 }`(`:123`)。行为等价(下游全部 `|| 0`),TS 驱动,但属未申报的写法偏离 —— 补一行注释说明即可,不必改代码。

**M-2** `[data-disabled]` 只断言 `"true"` 侧(`:107`),`"false"` 侧(其余 3 项)无对照 —— 治理文件 §9「A/B 二选一必须两边都测」。建议 `expect(w.findAll('.k2-entry').map(e => e.attributes('data-disabled'))).toEqual(['true','false','false','false'])` 一条搞定。

**M-3** `toContain` 数字型弱断言 2 处:`:242` `toContain('1')` · `:244` `toContain('5')`。当前推演不会被撞对,但与同文件 `:243`/`:279` 已采用的整串精确匹配标准不一致,建议统一。

### 实现者三条申报的裁定

1. **`String()` 探针「全绿」的解释 —— ✅ 成立,我独立复现(探针 A,22/22 全绿)。**
   ① 解释**正确**:Vue 3 `patchAttr` 只对 `isSpecialBooleanAttr` 名单内的属性做「假值→`removeAttribute`」,`data-on` 不在名单,走 `el.setAttribute(key, value)`,`false` 被隐式转成 `"false"`。
   ② 保留 `String()` **仍是正确选择** —— 蓝本 `:219` 就写着 `String(...)`,1:1 照抄;且 `knowledge.scss:739` 的选择器确实比字符串 `[data-on="true"]`。
   ③ **协调者建议的「更能分辨的断言」(断言 `false` 侧属性存在且等于 `"false"`)已经在用例里了**(`:155`/`:157` 的 `toBe('false')`)——**且依然分辨不出**,因为 Vue3 根本不会删这个属性。也就是说本例不存在能钉住 `String()` 的角度,实现者「不硬造假钉子、如实上报」的处理正确。
2. **自查到的弱断言修法 —— ✅ 修法彻底(整串 `toBe`),但没做同类扫描:同文件仍有 2 处 `toContain` 数字(M-3)。**
3. **`updatePeak` 是蓝本死代码 —— ✅ 属实,已回权威源核实。** `git -C NimoOS-UI grep -n updatePeak main -- src` 只命中 `dashboardHelpers.js:6`(定义)、`:3`(注释)与 `__tests__/dashboardHelpers.spec.js` 4 处;`knowledgeStore.js:88-90`(`loadOverview`)用的是内联 `Math.max(state.backlogPeak, backlog)`,本仓 `knowledgeStore.ts:315-317` 逐行照抄。`DashboardView` 不调 `updatePeak` **是忠于蓝本**,不是缺陷。附带发现:`util/dashboardHelpers.ts` 头注释里「供 T12 消费 `updatePeak`」的说法与蓝本事实不符 —— T9 遗留的注释错误,建议顺手改掉(Minor,不阻塞)。

### ⚠️ 待协调者裁定

**⚠️-1 C-1 的严重度**:掉的是一个磁贴的图标配色,后果轻微(灰 vs 琥珀),但性质上正是「界面 1:1 + 未申报偏离 + 属性态漏一个」三条硬约束同时命中。我按 **Critical** 报;若协调者认为「一处图标配色」按 Important 处理更合适,请裁定 —— 无论哪档,**都必须在用户人眼验收前改掉**(附录 C 第 1 条就要看知识库首屏,新装设备直接进 onboarding 态)。

**⚠️-2 附录 D.2 的「64 个 `k2-*` 类」计数**:逐行数与 scss/dist 实测都是 **63**。属附录计数偏差,不影响任何落地(零缺类、零多类),建议协调者在台账里订正,免得后续批次照着 64 去找那个「缺的类」。

**⚠️-3 治理文件 §8 的「收官应为 307 文件」**:该数字只算了 4 个新 `.vue` 带来的 color-guard 增量,漏算 10 个新测试文件本身。实测 **313** 才是正确收官数。建议订正,避免下一期把 313 当成「多出 6 个文件」的异常。

---

## 11. 结论

生产代码质量高:404 个结构 token、59 处文案键、73 个 CSS 类、19 个 glyph 引用全部与蓝本逐位对齐,N2/N3 两条「照抄不改」逐行照抄且**没有**被顺手优化,K1/K5/K6 干净,路由反转最小且旧断言留痕、反转后仍有判别力,三门全绿、提交卫生完美、收官算术自洽。

唯一的生产缺陷是 **C-1**(一个 `tone: 'wiki'`),而它之所以漏出去,根因是 **I-3**(`[data-tone]`/`[data-ok]` 的属性态断言只覆盖了五组里的一部分)。修 C-1 + 补 I-1/I-2/I-3 三条守卫(合计约 15 行测试代码 + 1 个 token),即可放行整期终审与用户验收。
