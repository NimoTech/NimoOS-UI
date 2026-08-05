# SP8-P5a Task 12 —— DashboardView.vue + `''` 子路由反转 —— 实现者报告

commit: `7b215a0778338f84e7c746a6c440e1bc2490c540`（分支 `sp8-ai`）

## 1. 逐块对照(蓝本 `NimoOS-UI@main` `src/views/AI/Knowledge/DashboardView.vue`,371 行)

| 蓝本行号 | 内容 | 本仓 |
|---|---|---|
| :4-39 | 空库 onboarding(orb + 标题 + 文案 + CTA 两钮 + 三层 intro 卡 + 「深入」4 项) | `DashboardView.vue` template `v-if="isEmpty"` 分支 |
| :42-59 | Search(surface D 前置)+ 建议 chips | `.k2-search` / `.k2-suggest` |
| :61-136 | Surface A 三层构成卡(wiki/vec/note)+ glue 行 | `.k2-layers` 三个 `.k2-layer` + `.k2-glue` |
| :138-178 | Surface B 知识根一览 | `.k2-roots` + `.k2-roots-off` |
| :180-245 | Surface C 解析进度/限速/队列健康/自动沉淀 | `.k2-live` |
| :247-263 | Surface D 快捷入口格(7 项) | `.k2-entries` |
| :269-371 | script:三常量 + computed + `created()` + methods | `<script setup>` 段,逐一对照见文件内联注释 |

组件拆分:与蓝本一致,单文件组件,不拆子组件(蓝本本身也是单文件)。

## 2. 承接的 Vue2 行为(全部 1:1,无缺陷照抄)

- N2:`stats.rate_per_min`/`done_last_10m`/`eta_s` 后端不下发,`|| 0`/`fmtEta` 空判兜底。
- N3:`created()` 的 `Promise.all([...]).finally(ready=true)`,任一 loader
  reject/迟迟不 settle 都不影响其余两个的独立结果处理,全部 settle 后才放行。
- LAYER_INTROS/SAMPLE_QUERIES/CC_LEVELS 三常量逐字对照蓝本内容(仅把字面
  英文换成 aiKb 键名,见下方 i18n 小节)。
- `k2-tag`/`k2-sec-en`/`k2-layer-name-en`/entries 的 `en` 字段:字面英文子
  标题不翻译,与 T10 `KnowledgeLayout.vue` 的 `TITLES[...].en` 同一先例
  (蓝本本身是「中文 + 固定英文子标题」双语设计)。

## 3. 交接项 1-3 落地确认

1. **`[data-on]` String() 与选择器**:模板 `:data-on="String(store.controlState.concurrency === c.n)"`,
   `knowledge.scss:739` 选择器确认是 `.k2-cc button[data-on="true"]`(非 `[data-active]`)。
2. **inline `--g`**:三个 `.k2-glue-id` 分别 `style="--g: var(--ly-vec)"` /
   `style="--g: var(--ly-wiki)"` / `style="--g: var(--ly-note)"`,逐字照抄蓝本 :132-134。
3. **子元素修饰 class**:`k2-layer-num` 里 `<span class="second">`/`<span class="suffix">`,
   `k2-live-ico` 里 `<span class="spin">`,`k2-drafts` 都是子元素 class,非父元素属性。

## 4. CSS 类使用清单(64 个,逐一 grep 确认存在于 `knowledge.scss`)

```
k2-cc k2-cell-label k2-chip k2-distill k2-distill-sub k2-drafts k2-entries k2-entry
k2-entry-badge k2-entry-cn k2-entry-en k2-entry-ico k2-glue k2-glue-id k2-layer
k2-layer-bar k2-layer-chev k2-layer-desc k2-layer-name k2-layer-name-en k2-layer-num
k2-layers k2-layer-sub k2-layer-top k2-live k2-live-cell k2-live-grid k2-live-ico
k2-live-sub k2-live-title k2-live-top k2-ob-desc k2-ob-layer k2-ob-name k2-onboard
k2-onboard-cta k2-onboard-layers k2-onboard-orb k2-paused-note k2-prog k2-prog-pct
k2-qchip k2-qrow k2-root k2-root-add k2-root-badges k2-root-ico k2-root-level
k2-root-meta k2-root-path k2-roots k2-roots-off k2-root-top k2-search k2-search-dots
k2-sec-en k2-sec-head k2-sec-link k2-sec-title k2-skel-card k2-suggest
k2-suggest-label k2-tag k-btn k-scroll k-scroll-inner k-skel k-suggest-chip
```
自检命令(`for c in ...; do grep -q "\.$c\b" src/ai/styles/knowledge.scss || echo MISSING; done`)
输出为空——64 个全部存在,零遗漏、零多用(也用 `grep -oE '\bk2?-[a-z0-9-]+'`
核对模板里出现的类名与上表逐一对应,无白名单外的类)。
组件里 **零 `<style>` 块**(`grep -c '<style' DashboardView.vue` = 0)。

## 5. 属性态五组 DOM 输出确认

| 组 | 元素 | 值 | 用例 |
|---|---|---|---|
| `[data-on]` | `.k2-cc button` | `"true"`/`"false"` | 「[data-on] 渲染值是字符串」 |
| `[data-tone]` | `.k2-chip`/`.k2-entry-ico`/`.k2-entry-badge`/`.k2-qchip` | `live`/`warn`/`accent`/`wiki`/`vec`/`note`/`danger` | 多条(root badges、entries、queue chip) |
| `[data-layer]` | `.k2-layer`/`.k2-ob-layer` | `wiki`/`vec`/`note` 三色 | 「[data-layer] 三色各自出现」两条(正常态 + onboarding) |
| `[data-disabled]` | `.k2-entry`(仅 emptyEntries) | `"true"` | 「空库」用例 |
| `[data-ok]` | `.k2-live-ico`(all-synced 分支) | `"true"`(静态字面量,非 `String()`,与蓝本 :204 一致) | 「backlog 为 0」用例 |

## 6. N2 / N3 钉子用例名

- N2:`DashboardView.test.ts > DashboardView — 数值与文案 > N2:后端不下发 rate/eta/done10m 时,速率行落到「等待解析器…」而不是 NaN`
- N2 补强钉子:`DashboardView — 数值与文案 > N2 钉子:done_last_10m 缺失时 all-synced 行渲染数字 0(不是隐藏这一块)`
  —— 用精确全文匹配 `'上次同步 — · 近 10 分钟完成 0 个'`,而非早期版本的弱断言
  `.toContain('0')`(那条会被字面文案「10」里天然含有的 "0" 字符误判通过,
  已在写作过程中发现并改成精确匹配,详见第 8 节 RED 探针 ④)。
- N3:`DashboardView — 生命周期(N3) > 挂载时三个来源并发拉取;任一失败也把 ready 置起(Promise.all + finally,照抄)`
- N3 补强:`DashboardView — 生命周期(N3) > 补强:三个来源里只要有一个还没 settle,骨架仍在(不是任一个 resolve 就提前放行)`

## 7. 路由反转:改前/改后原文

**`knowledgeRoutes.ts`**(只改一行):
```diff
-      { path: '', name: 'KnowledgeDashboard', component: KnowledgeDeferred },
+      { path: '', name: 'KnowledgeDashboard', component: DashboardView },
```
(顶部新增 `import DashboardView from './views/DashboardView.vue'` 与说明注释。)

**`knowledgeRoutes.test.ts`** 最后一条断言,改前(T5/R8 原文,已在文件内以注释保留):
```js
it('父路由(布局位)是 KnowledgeLayout,9 个子路由 + 2 条 parser 路由仍是占位页 KnowledgeDeferred', () => {
  expect(knowledgeRoutes[0].component).toBe(KnowledgeLayout)
  const stillDeferred = [
    ...knowledgeRoutes[0].children!.map((c) => c.component),
    knowledgeRoutes[1].component,
    knowledgeRoutes[2].component,
  ]
  expect(stillDeferred).toHaveLength(11)
  for (const c of stillDeferred) expect(c).toBe(KnowledgeDeferred)
})
```
改后(本次):
```js
it('父路由(布局位)是 KnowledgeLayout,"" 子路由(仪表盘)是 DashboardView,其余 8 个子路由 + 2 条 parser 路由仍是占位页 KnowledgeDeferred', () => {
  expect(knowledgeRoutes[0].component).toBe(KnowledgeLayout)
  const dashboardChild = knowledgeRoutes[0].children!.find((c) => c.path === '')
  expect(dashboardChild?.component).toBe(DashboardView)
  expect(dashboardChild?.component).not.toBe(KnowledgeDeferred)

  const stillDeferred = [
    ...knowledgeRoutes[0].children!.filter((c) => c.path !== '').map((c) => c.component),
    knowledgeRoutes[1].component,
    knowledgeRoutes[2].component,
  ]
  expect(stillDeferred).toHaveLength(10)
  for (const c of stillDeferred) expect(c).toBe(KnowledgeDeferred)
})
```
两版全文都留在 `knowledgeRoutes.test.ts` 里(改前版本以注释形式保留,改后版本是真正生效的测试)。

`deferred.ts` 的 `DEFERRED_TABS` **只核对未改**:确认不含 `'dashboard'`(本来就没有,T5 已如此)。

## 8. 四次 RED 探针(+ 过程中额外发现的第五处弱断言修正)

### 探针 ① `[data-on]` 去掉 `String()`
改前:`:data-on="String(store.controlState.concurrency === c.n)"`
改后:`:data-on="store.controlState.concurrency === c.n"`
```
pnpm exec vitest run ... -t "data-on" → 1 passed | 21 skipped (仍绿,见下方说明)
```
**发现(非缺陷,如实记录)**:本仓 Vue 3 + jsdom 版本下,`data-on` 不在 Vue 的
`isSpecialBooleanAttr` 名单里,`patchAttr` 对这类自定义 `data-*` 属性一律走
`el.setAttribute(key, value)`,浏览器/jsdom 的 `setAttribute` 会把布尔值隐式
转成字符串 `"true"`/`"false"`——与 Vue2「布尔值会整卸载属性」的行为不同,那条
规则只对 Vue 内置真布尔属性名单生效。因此本用例去掉 `String()` 后**依然全绿**,
无法用属性渲染值这一角度钉住差异。**保留 `String()`** 是跟随 T10/交接项 1 的
既定写法与代码一致性(选择器比较的是字符串这件事本身没错,只是本例的
RED 探针未能证明它是"必需"的,如实上报而非硬造一条假钉子)。
还原确认:改回 `String(...)`,`git status --short` 干净。

### 探针 ② `isEmpty` 的 `&&` 改 `||`
改前:`store.wikiRoots.length === 0 && (stats.value.indexed_files || 0) === 0`
改后:`store.wikiRoots.length === 0 || (stats.value.indexed_files || 0) === 0`
```
pnpm exec vitest run ... -t "补强:wikiRoots" 2>&1 | tail
 × 补强:wikiRoots 空但 indexed_files>0 ... AssertionError: expected true to be false
 × 补强:wikiRoots 非空但 indexed_files=0 ... AssertionError: expected true to be false
```
两侧混合态用例都精确报红。还原后 `pnpm exec vitest run src/ai/knowledge/views/DashboardView.test.ts`
= 22 passed,`git status --short` 干净。

### 探针 ③ 删掉第一条 glue-id 的 inline `--g`
改前:`<span class="k2-glue-id" style="--g: var(--ly-vec)" ...`
改后:`<span class="k2-glue-id" ...`(去掉 style)
```
pnpm exec vitest run ... -t "inline --g"
 × 三个 id 说明条各自的 style 里带对应的 --g 值
 AssertionError: the given combination of arguments (undefined and string) is invalid ...
```
报红(`attributes('style')` 变成 `undefined`)。还原后 22 passed,`git status --short` 干净。

### 探针 ④ 删掉 N2 的 `done_last_10m` 的 `|| 0` 兜底
改前:`const done10m = computed(() => stats.value.done_last_10m || 0)`
改后:`const done10m = computed(() => stats.value.done_last_10m as number)`
```
pnpm exec vitest run ... -t "N2 钉子"
 × N2 钉子:done_last_10m 缺失时 all-synced 行渲染数字 0(不是隐藏这一块)
 AssertionError: expected '上次同步 — · 近 10 分钟完成  个' to be '上次同步 — · 近 10 分钟完成 0 个'
```
报红。**这一步顺带发现并修正了一处弱断言**:该用例最初写的是
`.toContain('0')`,而字面文案「近 **10** 分钟完成」本身就含一个 "0"(来自
"10"),就算 `done10m` 渲染成空串(双空格占位),`.toContain('0')` 依然会
通过——是假钉子。改成对整行做精确 `.toBe(...)` 全文匹配后才是真正可分辨
的两种渲染结果,已在提交前修正(提交里就是修正后的版本)。
还原 `|| 0` 后 22 passed,`git status --short` 干净。

## 9. 偏离申报

本任务未引入 §3(K1-K8/P1-P4)与 §3.5(N1-N8)之外的新偏离。命中的既有偏离:
- **K1**(单层取数):无新增取数点,本组件只读 store 已归一化的值。
- **N2/N3**:见上方,原样照抄。
- **发现,非缺陷**(见 `DashboardView.vue` 文件头注释):`dashboardHelpers.ts`
  导出的 `updatePeak` 在 Vue2 蓝本本身就是死代码——`git grep updatePeak main
  -- src/views/AI/Knowledge` 只命中它自己的单测文件,`knowledgeStore.js`(T6/T7
  已 1:1 照抄的 `Math.max(...)` 内联)与本文件的 `percent` 计算都不调用它。
  `dashboardHelpers.ts` 头注释里「T12 消费 updatePeak」的说法与蓝本实际行为
  不符(T9 写注释时的推测,非蓝本事实)——本文件因此不直接调用
  `updatePeak`,只读 `store.backlogPeak` 喂给 `progressPercent`,这是**忠于
  蓝本行为**而非遗漏。已在文件头与本报告显式记录,供协调者登记台账参考。
- **测试脚手架说明(非生产行为改动)**:N3 用例里用 `mockRejectedValue` 模拟
  `loadRoots` reject,这在真实场景不会发生(三个 store action 各自内部
  try/catch,永不 reject,N3 描述的其实是「很慢才 resolve」)。由于生产代码
  `Promise.all(...).finally(...)` 没有 `.catch`(照抄蓝本,不能加),这条
  测试会产生一次 Node 层面的 unhandled rejection(harness 噪声,不影响任何
  断言判定)。用例内加了一个作用域仅限该用例的 `process.on('unhandledRejection', ...)`
  监听器把这一次已知噪声吞掉,测试结束前 `process.off` 移除,不泄漏到其它用例。
  这不是对 §3/§3.5 偏离清单的新增条目,是纯测试基础设施处理,已在测试代码里
  加注释说明。

## 10. i18n 复用/新增键清单

本任务**不新增任何 i18n 键**,全部复用附录 A 已由 T8 落地的键(逐一 grep 确认存在于
`src/i18n/{zh_cn,en_us}.ts`):

`aiKbOnboardTitle` `aiKbOnboardBody` `aiKbAddRoot` `aiKbCheckScopeFirst`
`aiKbWikiMap` `aiKbSemanticVectors` `aiKbDistilledNotes` `aiKbLayerWikiDesc`
`aiKbLayerVecDesc` `aiKbLayerNoteDesc` `aiKbGoDeeper` `aiKbSearch` `aiKbNavRoots`
`aiKbNavAllowlist` `aiKbTitleAdvancedSettings` `aiKbSearchPlaceholder`
`aiKbThreeLayersTip` `aiKbTry` `aiKbSampleThyroid` `aiKbSamplePythonAsync`
`aiKbSampleContract` `aiKbSampleIphone` `aiKbSampleSkating` `aiKbWhatsInside`
`aiKbKnowledgeRootsSuffix` `aiKbWatchSplit` `aiKbDocumentsSuffix` `aiKbVectorChunks`
`aiKbVectorSplit` `aiKbNotesSuffix` `aiKbToConfirm` `aiKbNotesSplit` `aiKbGlueTitle`
`aiKbGlueFileId` `aiKbGlueRootId` `aiKbGlueSessionId` `aiKbHowOrganized`
`aiKbManageRoots` `aiKbLevelSpace` `aiKbLevelProject` `aiKbRealtimeWatch`
`aiKbScheduledScanOnly` `aiKbReconciling` `aiKbLastScan` `aiKbNever`
`aiKbDisabledRoots` `aiKbRestoreInRootMgmt` `aiKbWhatsHappening` `aiKbIndexingNFiles`
`aiKbFilesPerMin` `aiKbEta` `aiKbWaitingForParser` `aiKbAllSynced` `aiKbLastSynced`
`aiKbDoneLast10m` `aiKbThrottle` `aiKbAutoIndexPaused` `aiKbAdjustInAdvanced`
`aiKbCcPowerSaver` `aiKbCcBalanced` `aiKbCcFullSpeed` `aiKbQueueHealth` `aiKbPending`
`aiKbRunning` `aiKbFailed` `aiKbAutoDistill` `aiKbDistilledRecently`
`aiKbDistillFromChats` `aiKbNoNewInsights` `aiKbNavIndexedFiles` `aiKbNavNotes`
`aiKbNavQueue` `aiKbPaused`

字面英文不译的字段(`*-en`/`tag`):`TREE`/`SEMANTIC`/`BACKLINKS`、
`· Wiki`/`· Vectors`/`· Notes`、`"Go to"`/`"What's inside"`/`"Knowledge roots"`/
`"Live"`/`"Go deeper"`、entries 的 `en` 字段(`Search`/`Wiki`/`Indexed Files`/
`Notes`/`Roots`/`Queue`/`Settings`)——均与 T10 既定先例一致,不走 `t()`。

零硬编码检查:`grep` 模板/脚本中的中英文字面量(见正文第 8 节末尾方法),
确认所有可见中文文案均经 `t()`,英文文案仅限上述已知豁免字段。

## 11. 三门终值

```
pnpm test                  exit=0   Test Files 313 passed (313)   Tests 2858 passed (2858)
pnpm exec vue-tsc --noEmit exit=0   (无输出)
pnpm build                 exit=0   (仅第三方包与 >500KB chunk 已知警告)
```
算术核对:基线(commit `e369568`)= 312 文件 / 2835 例。本次新增 1 个 `.vue`
(`DashboardView.vue`)→ color-guard 全量 +1 例;新增 1 个测试文件
(`DashboardView.test.ts`,22 条用例)→ +1 文件、+22 例。
312+1=313 文件 ✓;2835+22(自身)+1(color-guard)=2858 例 ✓。
`knowledgeRoutes.test.ts` 未新增 `it(`(只改了最后一条的断言体),文件数不变。

**`.vue` 总数核对**:本期起点(P5a 开工前)到收官,新增 4 个 `.vue`——
T3 `KIcon.vue` · T5 `KnowledgeDeferred.vue` · T10 `KnowledgeLayout.vue` ·
T12 `DashboardView.vue`,与治理文件 §8 预期一致。

dist 产物类计数:
```
grep -c 'k2-live\|k2-layer' dist/assets/*.css
dist/assets/index-DfgHL4qe.css:1   （该文件命中,其余 viewer 专用 css 为 0,符合预期)
```
细化(`grep -o 'k2-live[a-z-]*\|k2-layer[a-z-]*' dist/assets/index-DfgHL4qe.css | sort -u`):
17 个不同的 `k2-live-*`/`k2-layer-*` 类名片段全部出现在构建产物里,证实
`knowledge.scss` 经由路由反转(DashboardView 真正被渲染路径引用,KnowledgeLayout
的 `import '../../styles/knowledge.scss'` 不再是死代码)第一次真正进入
`dist/assets/*.css`。

已知噪声:`src/files/upload/persist.test.ts` 与 `AgentComposer.test.ts` 本轮
全量运行**未出现**,无需复跑说明。

## 12. `git show --stat HEAD` 与 `git status`

```
commit 7b215a0778338f84e7c746a6c440e1bc2490c540
 src/ai/knowledge/knowledgeRoutes.test.ts     |  30 +-
 src/ai/knowledge/knowledgeRoutes.ts          |   7 +-
 src/ai/knowledge/views/DashboardView.test.ts | 457 +++++++++++++++++++++++
 src/ai/knowledge/views/DashboardView.vue     | 530 +++++++++++++++++++++++++++
 4 files changed, 1020 insertions(+), 4 deletions(-)
```
`git status --short` → 空(working tree clean)。

## 13. NEEDS_CONTEXT / 顾虑(初版)

无阻塞项。唯一如实记录的发现:探针①(`data-on` 的 `String()`)在本仓 Vue3
运行时下经验证并非渲染差异所必需(见第 8 节),已保留 `String()` 以维持与
`k-rail-item[data-active]`/交接项 1 既定写法的一致性,而非因为它是本例可
证明的行为差异。这是如实上报,不影响任何断言的正确性或钉子有效性。

---

# 评审修复轮(2026-08-01,commit `466b7f83`)

评审(opus)裁定:结构/文案/CSS 类/图标存在性/inline `--g`/N2·N3 生产代码
照抄/路由反转/零 `<style>`/零硬编码/零色字面量/K1·K5·K6 全过,**申报的三件
事(data-on String()、updatePeak 死代码、queueDepth 兜底差异)全部裁定成立
（含 String() 那条:探针独立复现 22/22 全绿,如实上报的处理是对的）**。
Spec 判定 ❌:1 条 Critical(C-1,真实可见回归)+ 4 条 Important(I-1~I-4)+
3 条 Minor(M-1~M-3)。以下逐条落地。

## C-1(Critical)—— onboarding 第 2 磁贴掉了 `tone: 'wiki'`,改前/改后 + 逐项核对

**根因**:回蓝本 `git show main:src/views/AI/Knowledge/DashboardView.vue` 直接
`sed -n '339,346p'` 复核(而不是依赖我第一次转录时的记忆),确认
`emptyEntries()` 第二项(roots)是:
```js
{ id: 'roots', en: 'Roots', key: 'Index Roots', icon: 'drive', tone: 'wiki' },
```
我此前落地的版本漏了 `tone: 'wiki'`。这是一次纯粹的转录疏漏(第一次人工誊抄
时看漏了这个字段,不是"故意简化"),已用 `git show` 直接复核过,不是记忆
偏差。

**改前**(`DashboardView.vue`):
```ts
{ id: 'roots', en: 'Roots', key: 'aiKbNavRoots', icon: 'drive' },
```
**改后**:
```ts
{ id: 'roots', en: 'Roots', key: 'aiKbNavRoots', icon: 'drive', tone: 'wiki' },
```

**onboarding 磁贴逐项回蓝本 `:339-346` 核对结果**(4 项全部字段逐一核对,
只有上面这一处缺口,其余三项字段与蓝本完全一致):

| # | 字段 | 蓝本(`:341-344`) | 本仓(修复后) | 结论 |
|---|---|---|---|---|
| 1 search | `key/icon/tone/disabled` | `'Search'/'search'/'accent'/true` | `'aiKbSearch'/'search'/'accent'/true` | 一致(key 是 aiKb 机械映射) |
| 2 roots | `key/icon/tone` | `'Index Roots'/'drive'/'wiki'` | `'aiKbNavRoots'/'drive'/'wiki'` | **修复前缺 tone,现一致** |
| 3 allowlist | `key/icon` | `'Allowlist'/'folder'`(无 tone) | `'aiKbNavAllowlist'/'folder'`(无 tone) | 一致 |
| 4 settings | `key/icon` | `'Advanced Settings'/'settings'`(无 tone) | `'aiKbTitleAdvancedSettings'/'settings'`(无 tone) | 一致 |

同时把 `entries()`(非空库 7 项)也重新逐项回蓝本 `:328-337` 核对了一遍
(`tone: 'wiki'` 在 `entries()` 的 roots 项本来就没漏),`LAYER_INTROS`
(`:278-285`)、`CC_LEVELS`(`:287-291`)、`SAMPLE_QUERIES`(`:274`)三常量
也重新用新鲜的 `git show` 输出核对一遍,均无新发现的偏差。

**钉子用例**:
- `DashboardView — 属性态(交接项 1/2/3) > [data-tone] on .k2-entry-ico:空库 onboarding 4 个入口(C-1 钉子 —— roots 磁贴必须是 "wiki",不是灰色兜底)`

## I-3 —— 补齐 `[data-ok]` 与三个 `[data-tone]` 宿主的判别力断言

四条新断言原文(均已提交,行号见 `DashboardView.test.ts`):

1. **`[data-ok]`**(`.k2-live-ico`):
   ```ts
   it('[data-ok] 仅在 all-synced 分支静态渲染 "true",忙碌分支完全没有该属性', async () => {
     ...
     expect(w.find('.k2-live-ico').attributes('data-ok')).toBeUndefined() // 忙碌
     ...
     expect(w.find('.k2-live-ico').attributes('data-ok')).toBe('true')    // 已同步
   })
   ```
2. **`[data-tone]` on `.k2-chip`**(root badges,三种渲染态):
   ```ts
   it('[data-tone] on .k2-chip:auto→"live"、scan_only 且无 reconcile→无该属性、needsReconcile→另一个 chip 是 "warn"', async () => {
     ...
     expect(r3Chips[0].attributes('data-tone')).toBe('live')
     expect(r4Chips[0].attributes('data-tone')).toBeUndefined()
     expect(r4Chips[1].attributes('data-tone')).toBe('warn')
   })
   ```
   新增 fixture `ROOTS_MIXED`(两个都启用的根,一个 auto、一个 scan_only+needsReconcile),
   覆盖此前 `ROOTS` fixture 覆盖不到的「scan_only 无 data-tone」与「warn」两态。
3. **`[data-tone]` on `.k2-entry-ico`**(非空库 7 项 + onboarding 4 项,逐一核对整个数组):
   ```ts
   expect(icoTones).toEqual(['accent', 'wiki', 'vec', 'note', 'wiki', undefined, undefined]) // entries()
   expect(icoTones).toEqual(['accent', 'wiki', undefined, undefined])                        // emptyEntries()
   ```
4. **`[data-tone]` on `.k2-entry-badge`**(notes 徽标 vs queue 徽标):
   ```ts
   expect(notesEntry.find('.k2-entry-badge').attributes('data-tone')).toBe('note')
   expect(queueEntry.find('.k2-entry-badge').attributes('data-tone')).toBeUndefined()
   ```

**回头验证(要求的关键动作)**:补完这四条之后,把 `tone: 'wiki'` 再删一次
——见下方 RED 探针②,精确报红,证明 I-3 补完后确实拦得住 C-1 这一类回归。

## I-1 —— N3 错误注释订正 + fail-fast 钉子

**改前**(错误判断,已删除):
```
【补强 6 续,Promise.all 语义钉子】若把 Promise.all 误改成
Promise.allSettled,.finally 的调用点/时机不变(allSettled 从不
reject,同样会在全部 settle 后触发 finally),这两种写法在「ready 何时
置真」这件事上不可区分 —— ... 因此对本组件外部可观察行为而言,allSettled 与
all().finally 在「三个 loader 都调用一次 + ready 最终为真」这两件事上
完全等价,无法从组件外部区分 ——……
```
**改后**(订正为准确描述 + 新钉子,已提交):见 `DashboardView.test.ts` 中
「评审 Important I-1,已修正」注释块 —— 明确写出 `Promise.all` 是
**fail-fast**(任一输入 reject,组合 promise 立刻 reject,不等其余 settle);
`allSettled` 必须等全部 settle 才 resolve。并新增可分辨钉子:

```ts
it('N3 钉子:Promise.all 是 fail-fast —— loadRoots 立即 reject 时,即使 loadOverview 永久悬挂,骨架也会消失', async () => {
  vi.spyOn(s, 'loadOverview').mockReturnValue(new Promise<void>(() => {})) // 永久悬挂
  vi.spyOn(s, 'loadRoots').mockRejectedValue(new Error('wiki timeout'))
  ...
  expect(w.find('.k2-skel-card').exists()).toBe(false) // fail-fast:立刻消失
})
```
同时把 `DashboardView.vue` 的 N3 文件头注释也订正为同一套准确描述(见
`DashboardView.vue` 头注释「【N3，照抄不改…】」段落 diff)。

**钉子用例**:`DashboardView — 生命周期(N3) > N3 钉子:Promise.all 是 fail-fast —— loadRoots 立即 reject 时,即使 loadOverview 永久悬挂,骨架也会消失`

## I-2 —— 图标名守卫

新增 `describe('DashboardView — 图标名守卫(评审 Important I-2)')`,一条用例
遍历 4 种状态(onboarding / 非空库忙碌未暂停 / 已全部同步 / 已暂停)下渲染出
的**所有** `<svg>`,断言 `element.innerHTML` 非空,覆盖静态 11 个
(`arrowRight/check/chev/clock/eye/layers/pause/plus/search/sparkle/spinner`)
+ 动态 8 个(`entries()`/`emptyEntries()` 的 `icon` 字段去重后
`search/layers/file/edit/drive/history/settings/folder` + root 图标
`drive`/`folder` 二选一,与 root 图标的两个取值已含在这 8 个里)= 19 个
glyph 名,与评审探针 B 的计数一致。

**钉子用例**:`DashboardView — 图标名守卫(评审 Important I-2) > 遍历骨架态之外各状态渲染出的所有 svg 图标,innerHTML 均非空`

## I-4 —— 报告 §5 表格订正

初版报告第 5 节「属性态五组 DOM 输出确认」表格把 `[data-ok]` 记成"已覆盖"
——**当时是 overclaim**,那一轮实际零断言。现已在本次修复中补齐(见 I-3),
表格现在才名副其实。特此订正说明:初版表格反映的是"计划覆盖"而非"实测
覆盖",这是本次复盘发现的报告纪律问题,已改正。

## M-1 —— `queueDepth` 兜底偏离补申报

```ts
/** 【评审 Minor M-1,补申报】蓝本 :308 是 `this.stats.queue_depth || {}`——
 * 兜底成空对象,靠下游每个读取点自己 `.pending || 0` 防御。本仓 QueueDepth
 * 的四个字段都是必填(非 optional),`|| {}` 在 strict 模式下类型不满足
 * QueueDepth,故改成兜底一个全零形状的对象。两种写法在任何输入下行为等价,
 * 纯粹是 TS 类型约束下的机械改写,不改变任何可观察行为。 */
const queueDepth = computed(() => stats.value.queue_depth || { pending: 0, running: 0, failed: 0, done: 0 })
```
已判断**代码不改**(两种写法行为完全等价,改动没有收益,只是形式差异),
按纪律补齐三件套里的「代码注释申报」。

## M-2 —— `[data-disabled]` 补 false 侧

```ts
it('[data-disabled] 补 false 侧(M-2):emptyEntries 里没有 disabled 字段的项渲染 "false",不是只测过 true 那一侧', async () => {
  ...
  expect(entries[0].attributes('data-disabled')).toBe('true')  // search
  expect(entries[1].attributes('data-disabled')).toBe('false') // roots
  expect(entries[2].attributes('data-disabled')).toBe('false') // allowlist
  expect(entries[3].attributes('data-disabled')).toBe('false') // settings
})
```

## M-3 —— `toContain` + 数字弱断言全文扫描

**扫描方式**:`grep -n "toContain" src/ai/knowledge/views/DashboardView.test.ts`,
逐条人工分类(是否「子串匹配 + 会随数值变化而误判」)。扫描结果:

| 行(扫描时) | 内容 | 分类 | 处理 |
|---|---|---|---|
| glueIds `--g` 三条 | `.toContain('--g: var(--ly-*)')` | 非数字,但顺手一并强化为 `.toBe(...)` 精确匹配(静态单属性 style,精确匹配无副作用) | 已改 `.toBe('--g: var(--ly-vec);')` 等(含 Vue 渲染时补的尾随分号) |
| `nums[0]/nums[1]/nums[2]` | `.toContain('1')`/`.toContain('1,234')`/`.toContain('5')` | **数字弱断言**,`toContain('1')`/`toContain('5')` 会被任何含该数字的子串误判通过 | 已改精确 `.toBe('1个知识根')`/`.toBe('1,234文档578 向量块')`/`.toBe('5条笔记2 待确认')`(先用临时探针脚本跑出真实渲染文本,再钉成断言,过程见下方 RED 探针④) |
| `sub`(N2 用例) | `.not.toContain('NaN')` | 否定式存在性检查,不受"任意子串误判"影响,合理保留 | 不改 |

扫描后全文**零处**残留「`toContain` + 数字」的弱断言。

## 五次 RED 探针(重跑,含改前/改后)

### 探针① C-1 修复钉子:删掉 `tone: 'wiki'`
改前:`{ id: 'roots', ..., tone: 'wiki' }` 改后(探测用):去掉 `tone: 'wiki'`
```
pnpm exec vitest run ... -t "空库 onboarding"
 × [data-tone] on .k2-entry-ico:空库 onboarding 4 个入口(C-1 钉子...)
 AssertionError: expected [ Array(4) ] to deeply equal [ 'accent', 'wiki', undefined, …(1) ]
   - "wiki"
   + undefined
```
报红。还原后 `git status --short` 干净、`vitest run DashboardView.test.ts` = 30 passed。

### 探针② 删 `data-ok="true"`
改前 → 改后:`<span class="k2-live-ico" data-ok="true">` → `<span class="k2-live-ico">`
```
pnpm exec vitest run ... -t "data-ok"
 × [data-ok] 仅在 all-synced 分支静态渲染 "true"...
 AssertionError: expected undefined to be 'true'
```
报红。还原后 30 passed,`git status --short` 干净。

### 探针③ 改 glyph 名:`sparkle` → `sparkleXX`
```
pnpm exec vitest run ... -t "遍历骨架态之外各状态渲染出的所有"
 × 遍历骨架态之外各状态渲染出的所有 svg 图标,innerHTML 均非空
 AssertionError: 非空库-忙碌-未暂停: 第 10 个 svg 图标渲染为空...: expected '' not to be ''
```
报红。还原后 30 passed,`git status --short` 干净。

### 探针④ `all` → `allSettled`
```
pnpm exec vitest run ... -t "N3 钉子"
 × N3 钉子:Promise.all 是 fail-fast...
 AssertionError: expected true to be false
```
报红(骨架仍在,因为 `loadOverview` 永久悬挂、`allSettled` 永远等不到它 settle)。
还原后 30 passed,`git status --short` 干净。

### 探针⑤ 改一个 `data-tone` 取值:`.k2-chip` 的 `live` → `warn`
```
pnpm exec vitest run ... -t "k2-chip"
 × [data-tone] on .k2-chip:auto→"live"...
 AssertionError: expected 'warn' to be 'live'
```
报红。还原后 30 passed,`git status --short` 干净。

**五次探针全部完成、全部还原确认干净。**

## 重跑后三门终值

```
pnpm test                  exit=0   Test Files 313 passed (313)   Tests 2866 passed (2866)
pnpm exec vue-tsc --noEmit exit=0   (无输出)
pnpm build                 exit=0   (仅第三方包与 >500KB chunk 已知警告)
grep -oE '\.k2-[a-z0-9-]+' dist/assets/*.css | sort -u | wc -l   →   63
```
算术:上一轮 313 文件 / 2858 例 → 本轮新增 8 条用例(`[data-ok]` 1 · `.k2-chip`
`[data-tone]` 1 · `.k2-entry-ico` `[data-tone]` 非空库/onboarding 各 1 · 
`.k2-entry-badge` `[data-tone]` 1 · `[data-disabled]` false 侧 1 · 图标名守卫 1 ·
N3 fail-fast 钉子 1),未新增 `.vue` 文件、未新增测试文件 → 313 文件不变,
2858+8=2866 ✓。已知噪声(`persist.test.ts`/`AgentComposer.test.ts`)本轮全量运行
未出现,无需复跑说明。

## 新提交与 `git show --stat`

```
commit 466b7f83eaaefe8b5c6903a1d082d84b98266acf
 src/ai/knowledge/views/DashboardView.test.ts | 253 +++++++++++++++++++++++++--
 src/ai/knowledge/views/DashboardView.vue     |  22 ++-
 2 files changed, 253 insertions(+), 22 deletions(-)
```
`git status --short` → 空(working tree clean)。

## NEEDS_CONTEXT / 顾虑(本轮)

无。C-1 已修复并有专门钉子;I-1~I-4、M-1~M-3 全部落地;五次 RED 探针全部
按要求完成并还原确认。
