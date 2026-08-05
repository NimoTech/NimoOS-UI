# SP8-P5 跨区影响与独立票登记(2026-08-05,P5e 开工前由协调者落盘)

> **为什么这份文档在 `docs/superpowers/` 而不是 `.superpowers/sdd/`**:
> `.superpowers/` 被 `.gitignore:6` 盖着(`git status` 全程干净、零警告 —— SP7 就是这样整目录丢失的),
> 而本文件记录的是**跨出 P5 范围**、需要长期存活并跟着 `sp8-ai` 合并走的内容。`docs/superpowers/` 进 git。
>
> **触发**:P5e 开工前按蓝本 `7a6ee6b7` 重算全期(见 `.superpowers/sdd/p5-master-plan.md`),
> 挖出若干**影响已收官批次与其它区**的事实。用户 2026-08-05 批准四项裁定,并要求
> **「如果影响到其他部分需要落到文档上」** → 本文件。

---

## 0. 🔴 待并入上游登记处的动作项(**合 master 时一并做**)

跨期的权威登记处是 **`NimoOS-UI/docs/vue3-migration-roadmap.md`**(315 KB),
以及**上级设计** `NimoOS-UI/docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p5-knowledge-design.md`。

🔴 **两者都在 `NimoOS-UI` 这个只读共享检出上**(当前分支 `docs/vue3-migration-sp3`,
**被 SP7 / SP9 并发会话共用**),治理明令「可写仓只有 `.sp8/NimoOS-New-UI`;禁碰 `NimoOS-UI`」
→ **本期不写它们**,把要写的内容全部落在本文件,登记成动作项:

| # | 动作 | 目标文件 |
|---|---|---|
| A-1 | 把 **§1 的两张独立票(A / B)**+ 🔴 **P5e 收官新开的两张(C / D,见 §5)** 一并登记进 roadmap —— **共 4 张** | `NimoOS-UI/docs/vue3-migration-roadmap.md` |
| A-2 | 把 §3 的 5 处上级设计订正落进上级设计(或在其顶部加勘误横幅,承 `p5d-common-constraints.md` 的先例) | 上级设计 `2026-07-31-…-sp8-p5-knowledge-design.md` |
| A-3 | 把 §2.1(P5a 视觉缺陷)与 §2.4(P5f 体量与陷阱)同步进 roadmap 的 SP8 节 | roadmap |

⚠️ **A-1/A-2/A-3 的执行时机 = `sp8-ai` 合 master 那一刻**(合并顺序与时机**仍待用户拍板**,
非快进、4 个冲突文件、与 `sp7-photos` 压同一 base)。**在那之前本文件即唯一登记处。**

---

## 1. 两张独立票(**不在 P5e/P5f 范围**,用户 2026-08-05 批准)

### 票 A —— Agent 语义搜索卡补 `notes` 分组(影响 **SP8-P2a/P2b**)

**实测事实**(协调者 2026-08-05,蓝本 `7a6ee6b7` vs 本仓 `a67e380`):

| 项 | 蓝本 | 本仓 |
|---|---|---|
| `searchMapper.js` / `.ts` 的 `notes` 分组 | ✅ 完整(`:13` `rawNotes` · `:52-59` map · `:63` 计入 `totalCandidates` · `:83` 空判断 · `:99` 出参) | 🔴 **`src/ai/services/searchMapper.ts`(95 行)零 `notes`** |
| `SemanticSearchCard.vue` | ✅ **14 处** `notes`(独立 tab + 计数) | 🔴 **0 处**(957 行) |
| `SearchFullResults.vue` | ✅ 有 | 🔴 **0 处**(718 行) |
| Vue2 spec | `Knowledge/__tests__/notesMapper.spec.js`(30 行 / 2 例)· `Agent/blocks/__tests__/semanticSearchCardNotes.spec.js`(3 例) | 🔴 **两份都未承接** |

**为什么不塞进 P5e**(= 勘误 **E-49**):
1. `p5d-common-constraints.md` §4.3 的 **E-27** 把 `notesMapper.spec.js` 判给 P5e,依据是
   「它测 `searchMapper.js`,而 `searchAggregate` 归 P5e」。🔴 **该依据不成立** ——
   `buildSemanticSearchBlock`(agent 卡片映射器)与 `searchAggregate.js`(搜索页文件级聚合)
   是**两个不同文件、两条不同数据链**(agent tool 结果 vs `/v1/ai/search/text`),零耦合。
2. 被改文件全在 **`src/ai/services/` + `src/ai/components/blocks/`** = **P2a/P2b 的产出与范围**。
3. 两个消费组件 957 / 718 行,加一个 tab 是**跨区改动 + 大文件回归面**,
   塞进 P5e 会让本期评审同时对标两套蓝本。

**成因推测**(待该票开工时坐实):P2a/P2b 移植时锁的蓝本 sha 早于 notes 特性落地
(知识库 notes 是较新的功能)→ 属**上游漂移**,与上级设计 §1.2 列的其它区漂移同族。

### 票 B —— `color-guard` 盲区收口(影响 **全仓**)

🔴 **上级设计 §10 已把它记账为「建议独立一期」**,原文:
> 「`color-guard` 三个盲区收口:不扫 `.scss` · 不认 `white`/`black` 具名色 ·
> `sk-shared.scss:52` 的 `.sk-btn.danger { color: white }` 存量。P3a 起已记账,**建议独立一期**。」

**本次并入第四个同族盲区(P5d 终审新发现)**,并把已知修法留痕(别丢):

| 缺口 | 现状 | 修法 |
|---|---|---|
| 不扫 `.scss` | `color-guard.test.ts` 的 glob 只有 `../**/*.vue` 与 `../**/*.css`(**M-1**)→ `knowledge.scss` 的配色只有人肉评审一道防线 | 加 `.scss` glob。⚠️ 会扫出存量 |
| 不认具名色 | 只扫 `#hex` / `rgb()` / `hsl()`。P5c-T8 / P5d-T5 补的具名色扫描**钉在 `<template>` 属性值位置**,`<style>` 块与 `<script>` 注释里的具名色**全仓裸奔**(**D-5** + §0.3 位置③) | 复用「按属性值位置扫」的判据形态接到 `<style>` 与 `<script>` 注释。⚠️ **必须防假阳性**:`white-space: nowrap`(`QueueView.vue:474` 真有) |
| 🔴 **`.css` 侧是空壳(D-7,新)** | `?raw` 在 vitest 下**恒空**(CSSEnablerPlugin 把样式源整体替换成空串)→ DIAG 探针实测 `EMPTY=2 [viewers.css, ./theme.css]`,两条 `.css` 用例搜索域为空、0ms 通过。`theme.css` 实有 **105 行 hex + 117 行 `rgba(`**,若真被扫会炸 | 🔴 **改 `node:fs`** —— **且必须同时**修 `:65` 的 `theme.css` 跳过判断:`rel === 'styles/theme.css'` **从未生效**(Vite 把与 importer 同目录的 glob key 归一成 `./theme.css`),theme.css 不报红纯靠「内容恰好为空」的**巧合**。🔴 **只改一半会从「空壳」变成「大面积误报」** |
| 🔴 **`.ts` 完全裸奔**(§0.3 位置④) | `color-guard` 压根不扫 `.ts`。变异实测:往 `notesViewHelpers.ts` 注释注入 `#ff9500`/`rgba()`/`white` → **全量 3958 全绿**。现存唯一相关断言是 P5d-T3 的 K40 定向断言(只钉 `NOTE_TYPES` 那 4 个 `color` 字段) | 建**显式文件清单**(不是 glob 全仓),同 K40 定向断言形态 |
| `sk-shared.scss:52` 存量 | `.sk-btn.danger { color: white }` | 收口时一并处理 |

**为什么不在 P5e 做**(P5d 交接单曾说「P5e 一写 `<style>` 块就零保护」,**前提不成立**):
P5e 按 **K44 纪律** `.vue` 侧**零 `<style>` 块**(scss 全进 `knowledge.scss`),而 `knowledge.scss` 由
`knowledgeStyles.test.ts` 做**全文含注释色扫**(全仓覆盖最完整的一处);`searchAggregate.ts` 无任何颜色。
→ **四个缺口一条都不危及 P5e 自己的产出。**
且「改的是全仓守卫本身、改弱了没人看得出来」→ 值得一期专门的 RED 探针矩阵。

🔴 **P5e/P5f 期间对这些缺口的唯一义务 = 不让它退化**:
守卫**只许加固、不许放宽**;`src/styles/color-guard.test.ts` 在 P5e 全期零改动清单上。

---

## 2. 对**已收官批次**的影响

### 2.1 🔴 P5a —— 仪表盘的建议 chip 目前跑在「零基类样式」上(勘误 **E-52**)

**事实**:蓝本 `knowledge.scss:357` 有 `.k-suggest-chip` **基类**声明,
蓝本 `DashboardView.vue` 与 `SearchView.vue` **都用这个类**。
🔴 **P5a 只搬了后代覆盖** —— 本仓 `src/ai/styles/knowledge.scss:2198` 的
`.k2-suggest .k-suggest-chip { white-space: nowrap; }` —— **基类整条没搬**。

**后果**:P5a 已验收收官的仪表盘上,「建议 chip」**只有一条 `white-space`,没有任何基类样式**
(圆角 / 内距 / 边框 / 背景 / hover 全缺)。**这是已交付产出里的真实视觉缺陷,不是设计。**

🔴 **对 P5e 的连带影响(必须告知用户)**:
P5e-T2 补上基类后,**P5a 的仪表盘 chip 外观会跟着变**(变成蓝本本该有的样子)。
→ **P5e 验收清单必须带一条「顺带看一眼仪表盘的建议 chip,它这次才是蓝本该有的样子」**,
否则机主会以为 P5e 把仪表盘改坏了。

**落地约束**:基类必须插在 `:2198` 那条覆盖**之前**(蓝本源序)。P5e-T2 配了一条断言钉住相对顺序。

> 🔴 **2026-08-05 订正(勘误 E-56,P5e-T0 提出、T0 评审独立复核成立)**:
> 本段原文曾写「**否则级联反掉而三门全绿**」——**该理由不成立,已删**。
> 实读蓝本 `:357-367` 与本仓 `:2198`:基类选择器 `.k-suggest-chip` 特异度 `(0,2,0)`、
> 覆盖 `.k2-suggest .k-suggest-chip` 特异度 `(0,3,0)`,且**覆盖只声明 `white-space` 一个属性、
> 与基类的属性集不相交** ⇒ **两者顺序不影响任何渲染结果**。
> ⚠️ **但 E-52 的另一半仍然成立**:基类声明**整条缺失**、而 `DashboardView.vue:292` 真在用它
> ⇒ 「P5a 已交付产出里的建议 chip 缺全部基类样式(圆角/内距/边框/背景/hover)」这个**视觉缺陷是真的**,
> §2.1 的结论与「P5e 验收清单要带一条『顺带看一眼仪表盘的建议 chip』」的要求**都不变**。
> **要更正的只是「顺序」那条理由。** 顺序断言本身**保留**,但其价值改记为「钉住蓝本源序的移植忠实性」,
> **不再声称它防的是渲染回归**。

### 2.2 P5c —— `SettingsView.test.ts` 的全表键数快照改成下限断言(债务 **D-3**)

**改点**:`src/ai/knowledge/views/SettingsView.test.ts:1887-1888`,
`expect(Object.keys(zh)).toHaveLength(1595)` ×2 → **`toBeGreaterThanOrEqual(1595)`**。

**这是跨期约定变更,不只是 P5e 的一次修补**:

- **起因**:该快照由 **P5c-T9(`440c1bf`)引入**,嵌在一条只管 T9 那 29 个键的 task-scoped 用例里,
  **与整张表无逻辑关系**。P5d 是第一次跨期撞上(当期最后一个加键的刀不会触发),
  代价是一次 `NEEDS_CONTEXT` + 裁定 **R15** + 勘误 **E-43**。**全仓唯一一处这种快照。**
- **裁定理由**:精确键集一致性**已有更强的常驻守卫** —— `src/i18n/parity.test.ts` 断言
  zh/en **键集完全相等**(强于「两个数字相等」)。快照唯一多出的价值 = 「键总数不下降」(防批量误删)
  → **下限断言恰好只保留这个价值**,而把跨期成本永久归零。
  挪去 `parity.test.ts` = 换个地方保留同一个陷阱;删掉 = 违「反转不删」。
- 🔴 **对后续所有加键的期(P5f 及任何区)的意义**:
  **加键不会再让一个与本期毫不相干的文件变红。** 这条要写进后续期的治理。
- **留痕**:旧的两行 `toHaveLength(1595)` 留成注释,引条目编号(**R15 / E-43 / P5e 治理 §0.1**)
  **不引 `file:line`**(行号会随后续改动失效)。

### 2.3 P2 —— `aiCfgKnowledgeSoon` 删键(债务 **D-9**)

**事实**:P5d-T9 把 `src/ai/views/SettingsPage.vue` 顶栏「详情」的占位 `<button>`+toast
反转成 `<router-link to="/ai/knowledge">` 后,该 i18n 键**零生产消费点** ——
`grep -rw aiCfgKnowledgeSoon src/` 只剩 `SettingsPage.vue:187`,而那一行**在注释里**
(「反转不删」保留的原文)。

**裁定:从 `src/i18n/zh_cn.ts` 与 `en_us.ts` 同步删除。**
理由:「反转不删」保护的是**决策的历史记录**,而历史已完整留在 `SettingsPage.vue:187` 的注释里;
语言包里留一个零消费键会污染**所有后续的死键审计**(P5d 终审就撞到它、查不到来历 = Minor-2)。

**跨区改动**:`SettingsPage.vue`(**P2 的产出**)的 `:187` 注释补一句「该键已于 P5e 依治理 §0.2 删除」——
**只改那一行注释**,其余零改动。

### 2.4 P5f —— 体量修正与一个**整段搬陷阱**

| 项 | 上级设计 §4 | 重算(实测) |
|---|---|---|
| 范围 | 「Wiki + 索引根」`WikiView` 314 + `wikiViewHelpers` 95 + `RootsView` 289 = **698** | 🔴 **加 `AllowlistView` 249**(用户 2026-08-04 拍板 = **U-1**,上级设计原把它排在 P5c)→ **947** |
| scss | 未计 | 🔴 **67 个类 ≈ 344 行**(`:985-1160` + `:1342-1400` Allowlist · `:2453-2561` Wiki) |
| i18n | 未分摊 | **83+** distinct(`WikiView`+`RootsView`+`AllowlistView`,`wikiViewHelpers` 待扫) |
| Vue2 spec 承接 | 未列 | `wikiRoots.spec.js`(73)· `wikiViewHelpers.spec.js`(119)· `knowledgeStoreRoots.spec.js`(65)· `dashboardWikiViews.spec.js`(118,部分归 P5a) |
| **合计** | 698 | 🔴 **≈ 1291 蓝本行** |

🔴 **给 P5f 的整段搬陷阱(比 P5e 的更直接)**:
**`.k-progress-*` 六个死类在 `:1152-1160`,而 P5f 要搬的 Allowlist 段是 `:985-1160`
—— 死类正好压在它的段尾。** 按「整段搬 `:985-1160`」会直接带进 6 个蓝本零引用的死类。
完整的 24 个死类清单见 `.superpowers/sdd/p5-master-plan.md` §2.2。

🔴 **P5f 不许重复搬**(P5e 先搬者得,同 K43/K45 模具):
`.k-adv-toggle`(蓝本 `:498`)与嵌套在它里的 `.chev`(`:509`)——
蓝本被 `SearchView` + `AllowlistView` + `RootsView` 三家用,**P5e 搬**。
另 `.k-section-body`(`:985`)被 `AllowlistView` + `RootsView` 用,**P5c 因 Allowlist 移出而故意没搬(E-3)→ P5f 搬**。

---

## 3. 对**上级设计**的订正(动作项 A-2)

上级设计 = `NimoOS-UI/docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p5-knowledge-design.md`(296 行,`6a8f7825`)。
**它仍是 P5 全期最高权威**;下列是已查实需要订正之处(**用户明示裁定压过上级设计**,已发生 2 次):

| # | 上级设计原文 | 实际 |
|---|---|---|
| **U-1** | §4 把 `AllowlistView.vue`(249)排在 **P5c** | 🔴 **用户 2026-08-03 明示移出 P5c、2026-08-04 拍板归 P5f** → P5f = Wiki + Roots + **Allowlist** |
| **U-2** | §2 蓝本一律 `git show main:` 读 | 🔴 **用户 2026-08-04 拍板:P5 全期锁 `7a6ee6b7` 不换**(远端已到 `65cfda58`,领先 16 提交,但 P5 范围内差异**全是中文注释翻英文**、功能等价)。**每期 T0 第一动作 = SSH fetch 真远端 + 逐文件比对 + 写进报告**;比出**非注释**差异必须停下问用户 |
| **E-35 / E-51** | §2.5 与 §4 都写 `KIcon` = **43** 图标 | 🔴 **实测 42**(P5c 记 42 才对;`p5d-common-constraints.md §1.2` 又写回 43) |
| **E-50** | §4「P5e 搜索 **~820** 行」 | 四个 `.vue`/`.js` 行数 **4/4 全对** ✅,但**没算 scss**(同 §2.1 的 E-28 漏法)→ **P5e ≈ 1245 蓝本行** |
| **E-53** | §2.4「蓝本 11 个 `.vue` 共 **461** 条去重 `$t()`」 | ⚠️ 协调者按 **`$t('…')` 单引号**扫 13 个 `.vue` 得 **408**。🔴 **这大概率只是扫法差异**(未含双引号 / helper `.js` 里的 `i18n.t()` / 过 `$t(变量)` 的常量表),**不是上级设计错** —— **别急着判成勘误**(P5d 吃过「凭想象补一个不存在的问题、烧 46 万 subagent token」的教训)。**由 P5e-T0 用同口径复扫并给终值。** ⟵ 🔴 **2026-08-05 结案(裁定 R4)**:T0 复扫**未能兑现「同口径」**(它扫 16 个 `.vue`,上级设计说的是 11 个;**没有任何口径能扫出 461**)⇒ **定案:461 与 408 的差异原因未查明,但不影响本期**(本期 i18n 依据是附录 A 的 **63 distinct 终值**,已逐码点复核 0 mismatch)。**不判勘误、也不声称已解释。🔴 不许任何一刀再去追 461。** |

⚠️ **上级设计 §4 给 P5e 的两条开工前置 P5e 已全部接住,但 T0 实测后两条的结论都被订正了** ——
🔴 **以 `.superpowers/sdd/p5e-coordinator-rulings-T0.md` 的 R5 / R6 为准,本节下面两条原文已过时**:

| 原文 | 🔴 T0 实测后的订正 |
|---|---|
| ① 首次调用「约 **16.7 s** / 内存涨到 **~2.8 GB**」 | **裁定 R5**:实测**热态 5.04 s**(`embed_ms 5027`)、Parser RSS 仅 **+19 MB**。16.7 s / 2.8 GB 只对应**冷进程**首次懒加载 BGE-M3。⇒ **验收清单必须写条件句**(「若 Parser 刚重启过可能要等十几秒;已热的进程约 5 秒内返回」),**不许写死「约 17 秒」,也不许因为实测 5 秒就删掉这条** |
| ② distill「真机可能恒 404」 | **裁定 R6 / 勘误 E-58**:**接口已通**(三条 GET 全 200,`notes/settings` 已下发三字段)⇒ 上级设计 §6.4 的 404 风险**正式解除**。🔴 **但按钮本机仍不可达** —— 7 个索引文件全是 `.log`/`.json`、都不在 `DISTILL_EXTS` 里,叠加结果半区整体不可达 ⇒ **不列真机验收项,理由必须写「元素不渲染」而非「接口不通」** |

**以下两条为历史原文,保留备查(「反转不删」):**
① `/v1/ai/search/text` 首次调用 **约 16.7 s / 内存涨到 ~2.8 GB**(paused 模式懒加载 BGE-M3)
→ **验收清单必须写这个时限,否则机主必然当卡死报 bug**;
② §6.4 设备上 Python agent 曾落后、`notes/distill` 四条路由全无 → **distill 按钮真机可能恒 404**,
**必须由 T0 实测坐实,不许采信「08-01 已重部署」的记忆**;不通则按 **D1 政策**处理。

---

## 4. 与本文件配套的期内文档(都在 `.superpowers/sdd/`,**gitignore,一律 `git add -f`**)

| 文件 | 作用 |
|---|---|
| `p5-master-plan.md` | 全期按蓝本逐类重算:**149 缺失类归属** · **24 个死代码类** · 文件级完成度 · i18n 全期账 · P5e/P5f 体量 |
| `p5e-common-constraints.md` | P5e 治理差异(K46–K51 / N33–N45 / 四项裁定 / 测试质量增补) |
| `p5e-plan.md` | P5e 九刀(T0–T8)与逐刀 DoD |
| `p5e-kickoff-prompt.md` | **干净上下文的入口** —— 必读顺序 + 已批准裁定 + 不许重犯的坑 |
| 🔴 **`p5e-coordinator-rulings-T0.md`** | **P5e 全部协调者裁定 R1–R28** —— **权威仅次于上级设计**;凡本文件与它冲突,**以它为准**(本文件 §0/§3 已按 R4/R5/R6 订正) |
| `p5e-appendix-{A-i18n,B-tokens,D-classes}.md` · `p5e-fixtures/` | T0 产出的三份附录 + 13 个 fixture + 10 个可跑脚本(`replay.md` 给完整复现路径) |
| `p5e-task-{0,0b,1,1b,2..8}-report.md` · `p5e-task-{0..8}-review.md` · `p5e-FINAL-review.md` | 九刀实现报告 + 八份独立评审 + 全支终审 |
| 🔴 **`p5e-handoff-to-p5f.md`** | **P5f 的唯一入口**(承 P5d 先例)—— 债务、交接项、常驻做法 |

---

## 5. 🔴 P5e 收官新开的两张后端票(2026-08-05,**A-1 要一并登记进 roadmap**)

两张都是 **P5e 实测挖出的既有后端缺陷**,与前端迁移无关,**不在 P5e/P5f 范围**。

### 票 C —— 搜索链路授权根缺失(**整机语义搜索恒零结果**)

| 事实(T0 实测 + T0 评审 + 全支终审**三次**独立重现) | 值 |
|---|---|
| Qdrant `text_chunks` 总点数 | **5592** |
| 其中 `root_ids` 含 `dfcd1840f5dab439cd9d7050aa5bafd0` | **5592**(全部) |
| 其中 `root_ids` 含 `photos` | **0** |
| 核心 `GET /v1/nimoos/search-roots?user_id=<任意>` | **`{"root_ids":["photos"]}`** |

链路:`NimoOS-Search/route/v1/text.go:34` 拿 `allowed=["photos"]` → `service.ApplyScope` 求交集
(用户未传 `root_ids` 时返回 `allowed` 全集 ⇒ **非空,不会短路**)→ Qdrant 按 `root_ids ANY ["photos"]` 过滤
→ 命中 0 → `total_candidates: 0`、**`warnings: []`(没有任何提示,看起来就是「没搜到」)**。

🔴 **根因 = 用户已拍板的 D1(Wiki 后端本期不动)在搜索链路上的连带后果** ——
授权表由 Wiki 侧对账写入(`NimoOS/route/v1/rootgrants.go` 的 `UpsertGrant` 把 `source` 写死成 `"wiki"`),
Wiki 打不通 ⇒ 除 `NimoOS/main.go:96` 播种的虚拟根 `"photos"`,**零真实 root 被登记**。

**⇒ 对 P5e 的影响(用户 2026-08-05 已拍板按 D1 政策处理 = 裁定 R2)**:`phase === 'results'` 整条分支真机不可达
⇒ 结果卡 / 五个类型色 / 相关度徽标 / 详情抽屉 / chunk 阅读器 / in-app 预览器 / distill 按钮 / 下载 —— **全部不列真机验收项**。
🔴 **建议与 Wiki 数据库运维票一起做**(修 Wiki 才是治根)。
⚠️ **有一条 loopback-only 的临时开法,用户已明确否掉**(会改设备授权状态、让系统日志对所有登录用户可搜,
且文件名索引 watcher 的写入不像 DELETE 那样干净可逆)⇒ **裁定 R2 已将其列为硬禁令,任何一刀不得执行。**

### 票 D —— Parser rerank 端点 500

`POST :8283/v1/parser/rerank` → **HTTP 500**(实测 0.07 s 返回)。
根因(`journalctl -u nimoos-parser.service`):`parser/model_reranker.py:50` → `FlagEmbedding/.../AbsReranker.compute_score`
→ **`AttributeError: XLMRobertaTokenizer has no attribute prepare_for_model`** = Parser venv 里 `transformers` 与 `FlagEmbedding` 版本不兼容。

**连带**:`NimoOS-Search/service/search.go:176` 是 `if req.Rerank && len(hits) > 0`,而本机 `len(hits)` 恒 0(票 C)
⇒ **rerank 分支根本不进,`warnings` 永远不会出现 `rerank_unavailable`** ⇒ `.k-rerank-warn` **双重不可达**。
⚠️ **验收时提一句**:点「精确」(rerank)开关在本机**毫无变化**,不是开关坏了。

### 并入既有票(不新开)

**K52 的「token 进服务端访问日志」** —— 方案 A 让 token 出现在那一次后台 XHR 的 query(**不进**地址栏/历史/Referer)。
并入记忆里那张 **「终端 WS token 进访问日志」** 后端票。
