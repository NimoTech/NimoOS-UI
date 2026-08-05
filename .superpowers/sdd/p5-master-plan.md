# SP8-P5 知识库迁移 —— 全期重算规划(按蓝本 `7a6ee6b7` 实测)

> **本文件不取代上级设计。** 上级设计 =
> `NimoOS-UI/docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p5-knowledge-design.md`(296 行,`6a8f7825`),
> **它仍是 P5 全期的最高权威**。本文件做三件上级设计当时做不到的事:
> 1. **按蓝本逐类实测**重算 P5a–P5d 到底搬了什么、P5e/P5f 究竟还剩什么(上级设计只能按**行段**估);
> 2. 登记 P5a–P5d 落地过程中**用户裁定 / 勘误对上级设计的覆盖**;
> 3. 点名蓝本自身的**死代码**,避免后两批「整段搬」时把它们带进来。
>
> 🔴 **权威优先级(P5e/P5f 一律照此)**:
> **上级设计 > 本文件 > 当期 `p5X-coordinator-rulings-T0.md` > 当期 `p5X-common-constraints.md` + 附录 > 当期 `p5X-plan.md` > 任务 brief。**
> ⚠️ **例外**:凡**用户明示裁定**的,压过上级设计(已发生 2 次,见 §4)。
>
> 测量口径:2026-08-05,协调者在 `.sp8/NimoOS-New-UI`@`a67e380` 实测。
> 🔴 **`src/**` 蓝本用 `git show 7a6ee6b7:` 读;上级设计与 roadmap 在 `docs/vue3-migration-sp3` 分支上、
> `7a6ee6b7` 里没有它们(实测 0 行)→ 用 `git show 6a8f7825:docs/…` 读。**
> 蓝本源码一律 `git show 7a6ee6b7:<path>` 读 —— **`NimoOS-UI` 工作树签出的是 `docs/vue3-migration-sp3`(2026-07-15),没有 `NotesView.vue`/`WikiView.vue`,禁读工作树。**

---

## 1. 文件级完成度(上级设计 §2.1 的 30 文件口径)

**27 个可核文件里 22 已落地、5 缺。** 逐个实测:

| 归属批 | 蓝本 | 行 | New-UI 落点 | 状态 |
|---|---|---|---|---|
| P5a | `KnowledgeLayout.vue` | 210 | `views/KnowledgeLayout.vue` | ✅ |
| P5a | `store/knowledgeStore.js` | 363 | `stores/knowledgeStore.ts` | ✅ |
| P5a | `DashboardView.vue` / `dashboardHelpers.js` | 371 / 37 | `views/` / `util/` | ✅ |
| P5a | `components/common/KIcon.vue` | 74 | `components/KIcon.vue` | ✅(**42** 个 glyph,见 §5-E-35) |
| P5b | `IndexedFilesView.vue` / `indexedFiles.js` | 826 / 42 | `views/` / `util/` | ✅ |
| P5b | `QueueView.vue` | 417 | `views/QueueView.vue` | ✅ |
| P5c | `SettingsView.vue` | 322 | `views/SettingsView.vue` | ✅ |
| P5c | `FolderBrowser.vue` / `folderBrowser.js` | 143 / 34 | `components/` / `util/` | ✅ |
| P5c | `Parser/ParserStatus.vue` / `ParserTest.vue` / `parserStore.js` | 164 / 369 / 65 | `parser/` / `stores/` | ✅ |
| P5d | `NotesView.vue` / `NoteEditPane.vue` / `NotesMarkdownEditor.vue` | 271 / 338 / 47 | `views/` / `components/` ×2 | ✅ |
| P5d | `notesViewHelpers.js` / `noteEditHelpers.js` | 50 / 11 | `util/` ×2 | ✅ |
| 🔴 **P5e** | **`SearchView.vue`** | **401** | `views/SearchView.vue` | ❌ |
| 🔴 **P5e** | **`searchAggregate.js`** | **79** | `util/searchAggregate.ts` | ❌ |
| 🔴 **P5e** | **`components/FileDetailDrawer.vue`** | **220** | `components/FileDetailDrawer.vue` | ❌ |
| 🔴 **P5e** | **`components/KFileViewer.vue`** | **120** | `components/KFileViewer.vue` | ❌ |
| 🔴 **P5f** | **`AllowlistView.vue`** | **249** | `views/AllowlistView.vue` | ❌ |
| 🔴 **P5f** | **`RootsView.vue`** | **289** | `views/RootsView.vue` | ❌ |
| 🔴 **P5f** | **`WikiView.vue`** / **`wikiViewHelpers.js`** | **314 / 95** | `views/` / `util/` | ❌ |
| 上游 | `service/notes.js` / `service/wiki.js` | 203 / 99 | `NimoOS-Service` 包(D3) | ✅ |
| **不移植** | `styles/knowledge.scss` | 2561 | 逐批增长进 `src/ai/styles/knowledge.scss`(现 **2380** 行) | 见 §2 |

---

## 2. 🔴 scss 逐类实测 —— 这是上级设计当时估不出来的部分

方法:蓝本 `knowledge.scss`(2561 行)提取 **693** 处选择器声明 → 去重;New-UI `knowledge.scss`(2380 行)提取 **293** 个;
取差集 → **149 个类蓝本有、New-UI 没有**。再用**「class 属性里的完整 token 精确匹配」**(⚠️ 不能用 `\b` 词边界 —— `k-hero` 会被
`k-hero-suggest` 假命中,同 E-25 的坑)逐个查「哪个蓝本 `.vue` 在用」。

### 2.1 结果:149 个缺失类的归属

| 归属 | 个数 | 蓝本行段 |
|---|---|---|
| 🔴 **P5e** | **52** | `:351-360` · `:458-680` · `:726-733` · `:1540-1674` |
| 🔴 **P5f** | **67** | `:985-1160`(Allowlist)· `:1342-1400`(Allowlist)· `:2453-2561`(Wiki) |
| ⛔ **蓝本死代码,任何一期都不搬** | **24** | `:272-455` · `:1152-1160` |
| ⛔ **K3 明令不移植** | **2** | `:1431-1450`(`.k-toast` / `.k-toast-ico`) |
| ✅ 计入 P5e 但已被 P5d 提前搬 | 4 | `.k-seg`(K43)· `.k-btn.text`(K45)等 |

### 2.2 🔴 24 个「蓝本死代码」清单(**必须写进 P5e/P5f 的治理,否则会被整段搬**)

这些类在**蓝本自己**的 13 个 `.vue` 里**零 class 引用** —— 是 v1 仪表盘 / v1 进度卡被
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

🔴 **为什么这是真陷阱**:P5e 要搬的 `.k-hero-suggest` 在 `:351`、`.k-suggest-chip` 在 `:357` ——
**紧夹在 `.k-hero-search-kbd`(`:343`)与 `.k-stat`(`:380`)中间**。
按「整段搬」的直觉会一次带进 18 个死类,而「没有搬多」白名单断言会报红,
**实现者极可能误判成「白名单数字错了」而去改白名单**。
→ **两批的治理都必须显式列出这 24 个,并要求「白名单报红时先回查本清单,不许改白名单」。**

### 2.3 🔴 跨期漏搬(勘误,不是设计)

| 类 | 事实 | 处置 |
|---|---|---|
| **`.k-suggest-chip`**(蓝本 `:357`) | 🔴 **P5a 搬了后代覆盖 `.k2-suggest .k-suggest-chip { white-space: nowrap }`(New-UI `knowledge.scss:2198`),却没搬基类。** 蓝本 `DashboardView` 与 `SearchView` **都用它** → **P5a 的仪表盘 chip 目前跑在「只有一条 `white-space` 覆盖、零基类样式」上** | **P5e 补基类**,且必须插在 `:2198` 那条覆盖**之前**(蓝本源序)。配断言钉住相对顺序。登记 **E-52** |
| **`.k-adv-toggle`** / **`.chev`**(嵌套) | 蓝本被 `SearchView` + **`AllowlistView`/`RootsView`(P5f)** 三家用 | **P5e 先搬者得**,P5f 不许重复搬(同 K43/K45 模具) |
| **`.k-section-body`**(`:985`) | 被 `AllowlistView` + `RootsView` 用 | **P5f 搬**(P5c 因 Allowlist 移出而故意没搬 = E-3,已登记) |
| **`.k-frow`**(`:1077`) | 只被 `AllowlistView` 用(⚠️ 粗匹配会假命中 `IndexedFilesView` 的 `k-frow-*`… 实测**不**命中) | **P5f 搬** |

### 2.4 P5e 的 52 个类(逐个,给 T0 当核对基准)

```
:351  .k-hero-suggest              :581  .k-rcard              :1587 .k-drawer-head †
:357  .k-suggest-chip  ★E-52       :596  .k-rcard-icon         :1594 .k-drawer-back
:458  .k-search-sticky             :611  .k-rcard-tag  ★色     :1602 .k-drawer-head-spacer †
:466  .k-search-sticky-inner       :625  .k-rcard-body         :1603 .k-drawer-fileinfo
:471  .k-search-box                :626  .k-rcard-head         :1607 .k-drawer-filename †
:488  .k-search-clear              :627  .k-rcard-name         :1611 .k-drawer-actions
:498  .k-adv-toggle  ‡             :633  .k-rel  ★色           :1612 .k-drawer-summary
:509    .chev(嵌套)               :643  .k-rel-dot            :1618 .k-drawer-body
:513  .k-adv-panel                 :645  .k-rcard-snippet      :1620 .k-chunk-list
:524  .k-adv-field                 :653    mark(嵌套)         :1625 .k-chunk-item
:525  .k-adv-label                 :660    .h-md(嵌套·零引用) :1633 .k-chunk-rank
:532  .k-adv-chips                 :662  .k-rcard-meta         :1638 .k-chunk-item-body
:533  .k-adv-chip                  :669  .k-rcard-meta-item    :1639 .k-chunk-item-head
:574  .k-results                   :675  .k-rerank-warn        :1640 .k-chunk-loc
:575  .k-result-count              :726  .k-skel-rcard         :1641 .k-chunk-item-preview
:1548 .k-match-pill                                            :1645   ..-preview mark(嵌套)
:1556 .k-more-hint                                             :1647 .k-chunk-viewer
                                                               :1648 .k-chunk-viewer-head
★色 = 含色字面量,进附录 B      ‡ = P5f 也用,先搬者得         :1652 .k-chunk-viewer-title
† = KFileViewer 也用             ★E-52 = 跨期漏搬              :1653 .k-chunk-nav
                                                               :1654 .k-chunk-nav-count
外加 KFileViewer.vue 的 <style scoped> 51 行(K44 落点 + K46 砍 ::v-deep) :1656 .k-chunk-content
                                                               :1660   ..-content mark ★色
                                                               :1661 .k-chunk-viewer-foot
```

🔴 **三处色字面量**(附录 B 定死):
- `.k-rcard-tag[data-kind]` 五个实底:`#FF3B30`(pdf)/ `#1a1a1a`(md)/ `#007AFF`(doc)/ `#34C759`(txt)/ `#AF52DE`(code)
- `.k-rel[data-level]` 三组 `rgba()` 底 + 三个实字色(`#1f9c47` / `#c97500` / `#c54a00`)
- 🔴 **`.k-chunk-content mark { background: rgba(255,235,0,.4) }`(`:1660`)—— 高亮黄,全仓大概率零同值先例,要新建 token**
  (⚠️ `.k-chunk-item-preview mark`(`:1645`)与 `.k-rcard-snippet mark`(`:653`)用的是 `var(--accent-soft)` / token,**只有 `:1660` 是字面量**)

---

## 3. i18n 全期账

| 口径 | 数 | 方法 |
|---|---|---|
| 上级设计 §2.4 | **461** 去重(457 有权威 zh / 4 无) | 未写明扫法 |
| 协调者 2026-08-05 实测 | **408** 去重(11 Knowledge `.vue` + 2 Parser `.vue`) | 只扫 **`$t('…')` 单引号**;不含双引号、helper `.js` 里的 `i18n.t()`、以及过 `$t(变量)` 的常量表 |
| 已落地 `aiKb*` | **387**(P5d 收官实测) | 真实模块导入 |
| 全表 | **1595 / 1595** zh/en | 真实模块导入,差集均空 |
| 🔴 **P5e** | **53** 静态 + **9** 动态(`MTIMES` 4 + `SAMPLE_QUERIES` 5)+ **1**(`searchAggregate` 的 `'(Untitled)'`)= **63 distinct** | 同上 |
| 🔴 **P5f** | **83** 静态(`WikiView`+`RootsView`+`AllowlistView`)+ `wikiViewHelpers` 待扫 | 同上 |

⚠️ **408 ≠ 461 是扫法差异,不是上级设计错** —— T0 要用与上级设计同口径复扫并给终值。
**别急着把 461 判成勘误**(P5d 就吃过「凭想象补一个不存在的问题、烧 46 万 token」的教训)。

---

## 4. 用户裁定 / 勘误对上级设计的覆盖(**下游必须知道**)

| # | 上级设计原文 | 覆盖 |
|---|---|---|
| **U-1** | §4 把 `AllowlistView.vue`(249)排在 **P5c** | 🔴 **用户 2026-08-03 明示移出 P5c;2026-08-04 拍板归 P5f** → **P5f = Wiki + Roots + Allowlist**,不是「Wiki + 索引根 698 行」 |
| **U-2** | §2 蓝本读 `git show main:` | 🔴 **用户 2026-08-04 拍板:P5 全期锁 `7a6ee6b7`,不换**(远端已到 `65cfda58`,领先 16 提交,但 P5 范围内差异**全是中文注释翻英文**,功能等价)。**每期 T0 第一动作 = SSH fetch 真远端 + 逐文件比对 + 写进报告**;比出**非注释**差异必须停下问用户 |
| **E-35** | §2.5 / §4 `KIcon` **43** 图标 | 🔴 **实测 42**(P5c 记 42 才对)。`p5d-common-constraints.md §1.2` 又写回 43 → **本文件与 P5e 治理一律用 42** |
| **E-49** | §4 P5d 段暗示 `notesMapper.spec.js` 归 P5d、P5d 又转判 P5e(E-27) | 🔴 **两处都不成立**:它测的是 `buildSemanticSearchBlock`(agent 卡片映射器,本仓 `src/ai/services/searchMapper.ts`),与 `searchAggregate.js`(搜索页文件级聚合)是**两个文件两条链路**。**转独立票**,见 §6 |
| **E-50** | §4 P5e「~820 行」 | **四个 `.vue`/`.js` 行数 4/4 全对** ✅,但**没算 scss**(同 §2.1 的 E-28 漏法)→ **P5e 真实体量 ≈ 820 + 425 = 1245 蓝本行** |
| **E-52** | — | 🔴 **本文件新增**:`.k-suggest-chip` 基类是 **P5a 的跨期漏搬**(见 §2.3) |
| **D-8** | — | `p5d-common-constraints.md` 有 **18 处已查实的错**(E-31~E-48),顶部已加勘误横幅。**P5e/P5f 不许引它的 A-10 / K37 / §4.2 / §7 原文当依据** |

---

## 5. 剩余两批的重算口径

### P5e 搜索(**≈ 1245 蓝本行**,原估 820)

| 块 | 量 |
|---|---|
| `SearchView.vue` | 401 |
| `FileDetailDrawer.vue` | 220 |
| `KFileViewer.vue` | 120(含 `<style>` 51,其中 21 行按 **K46 不搬**) |
| `searchAggregate.js` | 79 |
| **`knowledge.scss` 52 个类** | **≈ 425** |
| i18n | **63** distinct |
| Vue2 spec 承接 | `searchAggregate.spec.js`(46 行/2 例)· `fileDetailDrawerDistill.spec.js`(23 行/1 例,**测法必须改**) |

🔴 **上级设计 §4 给 P5e 的开工前置(我第一版漏了,必须补)**:
> **实测 `/v1/ai/search/text` 可用性(paused 模式下查询时仍会懒加载 BGE-M3,内存涨到 ~2.8 GB;首次调用约 16.7 s)。**

→ 三个后果全要落地:① **验收时第一次搜索要等约 17 秒** —— 不写进清单机主必然当卡死报 bug;
② 内存峰值 ~2.8 GB,验收前要看余量;③ 任何真机探测都属「会改设备状态」,T0 报告要写怎么恢复。

🔴 **上级设计 §6.4 的 distill 404 风险**:设备上 Python agent 曾落后于蓝本、`notes/distill` 四条路由全无
→ **`FileDetailDrawer` 的 distill 按钮真机恒 404**。
⚠️ 协调者记忆记「Python agent 2026-08-01 已重部署、distill 接口真机可用」——
🔴 **但这必须由 T0 实测坐实**,不许采信记忆。不可用则按 **D1 政策**(界面做完整、逻辑照抄、**不列真机验收项**、不编造 fixture)。

### P5f Wiki + 索引根 + 白名单(**≈ 1291 蓝本行**,原估 698)

`WikiView` 314 + `wikiViewHelpers` 95 + `RootsView` 289 + `AllowlistView` 249 = **947**
\+ **scss 67 个类 ≈ 344 行**(`:985-1160` + `:1342-1400` + `:2453-2561`)+ i18n **83+** distinct。
Vue2 spec 承接:`wikiRoots.spec.js`(73)· `wikiViewHelpers.spec.js`(119)· `knowledgeStoreRoots.spec.js`(65)·
`dashboardWikiViews.spec.js`(118,部分归 P5a)。
\+ **清空 `DEFERRED_TABS` 并保留机制**(K8,承 P4 I2 教训)。
🔴 **D1:Wiki 后端本期不动,不列真机验收项** —— 验收 = 界面走查 + 单测 + 逐行对标 + 明暗两套主题。

---

## 6. 不在 P5 范围(记账)

| # | 事 | 依据 |
|---|---|---|
| 1 | 🔴 **`color-guard` 盲区收口独立一期** —— 不扫 `.scss` · 不认具名色 · `.vue`+`.css` 的 `?raw` 恒空致 `.css` 扫描是空壳(**P5d 终审新发现,并入本票**)· `sk-shared.scss:52` 存量 | **上级设计 §10 明写「建议独立一期」**。⚠️ P5c-T8 / P5d-T5 / P5d-R17 已在批内**增量补过三次**(模板具名色、`src/ai/components/**` 扩范围、`<script>` 注释 hex)——**那是补 P5 自己产出的覆盖,不等于收口全仓**。全仓收口仍在票上 |
| 2 | **Agent 语义搜索卡补 `notes` 分组** —— 本仓 `searchMapper.ts`(95 行)零 `notes`、`SemanticSearchCard.vue`(957)与 `SearchFullResults.vue`(718)各 0 处;蓝本三处齐全 + 一份 `semanticSearchCardNotes.spec.js` | **E-49**。被改文件全在 P2a/P2b 地盘,与搜索页零耦合 |
| 3 | **Wiki 数据库运维票** —— 38 GB / 1.42 亿行 `file_events`,`SetMaxOpenConns(1)`;修复提交 `cff8a2c` 未装 | 上级设计 §10 + D1 |
| 4 | **其它区上游漂移补丁期** | 上级设计 §1.2 |
| 5 | **`sp8-ai` 合 master** —— 非快进、4 个冲突文件,与 `sp7-photos` 的合并顺序**待用户拍板** | 上级设计 §9-5 + P5d 收官 |
| 6 | Vue2 `src/views/AI/{Knowledge,Parser}/**` 随 **SP10** 删 | 上级设计 §10 |

---

## 7. 全期跨批生效的偏离与「照抄不改」(上级设计 §7 + 各批增量)

**上级设计 §7 的 K1–K8 全期生效**:K1 单层取数 · K2 主题映射层 · K3 `.k-toast` 不移植改全局 `useToast()` ·
K4 `KIcon` 独立组件 · K5 HTTP 失败不回显后端 body · K6 `console.error` 不照抄 ·
K7 弹窗一律 reka + `DialogPortal to` 指知识库容器 · K8 占位页机制。
**N1–N7 全期照抄不改。**

各批增量:P5a **K1–K8 / P1–P4**(细化)· P5b **K9–K20 / N9–N14** · P5c **K21–K36 / N15–N22** ·
P5d **K37–K45 / N23–N32** · **P5e 从 K46 / N33 起编号**(E 从 **E-52** 起,D 从 **D-10** 起,A 从 **A-12** 起)。

**流程(上级设计 §8,全期生效)**:subagent-driven,每任务 fresh implementer + 独立评审
(**最低 sonnet,禁 haiku**;评审须自读源文件、自己 grep、自做 RED 探针,**不许采信实现者报告**),
整批 **opus 全支线终审**。
🔴 **上级设计 §9-1 特别指示:每批 scss 任务单独派一个评审专做逐行色扫。**
