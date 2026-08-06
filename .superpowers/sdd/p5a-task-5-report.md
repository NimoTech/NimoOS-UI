# SP8-P5a Task 5 报告 —— 知识库 11 条路由 + 占位页机制

## 蓝本核对(`git show main:src/router/route.js` 155-200,NimoOS-UI 仓)

逐条对照(path / name / component 全部指向 `KnowledgeDeferred`,与蓝本 `component` 语义无关,仅暂代):

| # | 蓝本 path | 蓝本 name | 本仓 path | 本仓 name | 一致? |
|---|---|---|---|---|---|
| 布局 | `/ai/knowledge` | (无 name) | `/ai/knowledge` | (无 name) | ✅ |
| 子1 | `''` | `KnowledgeDashboard` | `''` | `KnowledgeDashboard` | ✅ |
| 子2 | `search` | `KnowledgeSearch` | `search` | `KnowledgeSearch` | ✅ |
| 子3 | `wiki` | `KnowledgeWiki` | `wiki` | `KnowledgeWiki` | ✅(蓝本数组里 wiki 在 search 之后,已核实并照排) |
| 子4 | `indexed-files` | `KnowledgeIndexedFiles` | `indexed-files` | `KnowledgeIndexedFiles` | ✅ |
| 子5 | `queue` | `KnowledgeQueue` | `queue` | `KnowledgeQueue` | ✅ |
| 子6 | `roots` | `KnowledgeRoots` | `roots` | `KnowledgeRoots` | ✅ |
| 子7 | `allowlist` | `KnowledgeAllowlist` | `allowlist` | `KnowledgeAllowlist` | ✅ |
| 子8 | `notes` | `KnowledgeNotes` | `notes` | `KnowledgeNotes` | ✅(蓝本数组里 notes 在 allowlist 之后,已核实并照排) |
| 子9 | `settings` | `KnowledgeSettings` | `settings` | `KnowledgeSettings` | ✅ |
| 顶层 | `/ai/parser` | `AIParser` | `/ai/parser` | `AIParser` | ✅ |
| 顶层 | `/ai/parser/test` | `AIParserTest` | `/ai/parser/test` | `AIParserTest` | ✅ |

蓝本实际读到的原文(节选,确认无误):
```
{ path: '',              name: 'KnowledgeDashboard', component: () => import('@/views/AI/Knowledge/DashboardView.vue') },
{ path: 'search',        name: 'KnowledgeSearch',       component: ... },
{ path: 'wiki',          name: 'KnowledgeWiki',         component: ... },
{ path: 'indexed-files', name: 'KnowledgeIndexedFiles', component: ... },
{ path: 'queue',         name: 'KnowledgeQueue',        component: ... },
{ path: 'roots',     name: 'KnowledgeRoots',     component: ... },
{ path: 'allowlist', name: 'KnowledgeAllowlist', component: ... },
{ path: 'notes',     name: 'KnowledgeNotes',     component: ... },
{ path: 'settings',  name: 'KnowledgeSettings',  component: ... },
```
`/ai/parser`、`/ai/parser/test` 在蓝本数组里排在 `/ai/settings` 之后、`/ai/knowledge` 布局之前(与本仓 `knowledgeRoutes` 数组的排列顺序——布局在前、parser 两条在后——不同),但两个仓库都是**独立的、互不重叠 path 的扁平数组**,路由匹配不依赖数组内彼此的相对顺序(vue-router 按最长/精确匹配,不是靠先后遮蔽),故此顺序差异不影响功能,brief 的 `knowledgeRoutes` 数组顺序(布局, parser, parser-test)已在需求书里明确给出,照办。

## 主动加的判别性断言

`knowledgeRoutes.test.ts` 第三条(brief 未给,协调者要求补):
```ts
it('本期(P5a)全部 11 条路由的 component 都还是占位页 KnowledgeDeferred', () => {
  const components = [
    ...knowledgeRoutes[0].children!.map((c) => c.component),
    knowledgeRoutes[1].component,
    knowledgeRoutes[2].component,
  ]
  expect(components).toHaveLength(11)
  for (const c of components) expect(c).toBe(KnowledgeDeferred)
})
```
钉住「本批 11 条路由的 component 全部 === KnowledgeDeferred」。T12 把 `''` 子路由换成 `DashboardView` 时,这条断言会精确报红(数组里出现一个非 `KnowledgeDeferred` 的值),提醒改的人同步更新它,而不是被无声继承——这是它的设计意图(反转,不是删除)。

## 两次 RED 探针

### 探针 1:互换 `wiki`/`notes` 两个子路由的 path

改前(`knowledgeRoutes.ts`):
```ts
{ path: 'wiki', name: 'KnowledgeWiki', component: KnowledgeDeferred },
...
{ path: 'notes', name: 'KnowledgeNotes', component: KnowledgeDeferred },
```
改后:
```ts
{ path: 'notes', name: 'KnowledgeWiki', component: KnowledgeDeferred },
...
{ path: 'wiki', name: 'KnowledgeNotes', component: KnowledgeDeferred },
```
运行 `pnpm test src/ai/knowledge/knowledgeRoutes.test.ts`,报红用例:
`src/ai/knowledge/knowledgeRoutes.test.ts > knowledgeRoutes > 一条布局路由带 9 个子路由 + 两条 Parser 路由`
```
AssertionError: expected [ '', 'search', 'notes', …(6) ] to deeply equal [ '', 'search', 'wiki', …(6) ]
- Expected
+ Received
  [
    "",
    "search",
-   "wiki",
+   "notes",
    ...
-   "notes",
+   "wiki",
    "settings",
  ]
```
精确报红后原样还原(改回 `wiki`/`notes` 各自 path),`git diff src/ai/knowledge/knowledgeRoutes.ts` 复跑确认无残留改动、测试转绿。

### 探针 2:注释掉 `src/router/index.ts` 里 `...knowledgeRoutes,`

改前:`  ...knowledgeRoutes,`
改后:`  // ...knowledgeRoutes, // RED probe: temporarily disabled`

运行 `pnpm test src/router/index.test.ts`,报红用例:
`src/router/index.test.ts > router > 主路由表已展开 knowledge 路由`
```
AssertionError: expected [ '/apps/store/:id', …(16) ] to include '/ai/knowledge'
```
精确报红后还原该行,复跑转绿。

**探针后 `git status --short` 干净**(提交前最终态见下方)。

## i18n 两键(R6,由本任务提前落地)

`src/i18n/zh_cn.ts`、`src/i18n/en_us.ts` 各新增(写前 `grep -n "aiKb" src/i18n/zh_cn.ts src/i18n/en_us.ts` 确认零命中,当时确认无冲突):

| 键 | en_us | zh_cn |
|---|---|---|
| `aiKbDeferredTitle` | `Coming soon` | `即将上线` |
| `aiKbDeferredHint` | `This page is still being migrated to the new UI.` | `这个页面还在迁移到新界面。`(句末为中文句号「。」,未改动) |

两档均加在 `// <<< SP8-P4 Task 4` 之后、闭合 `}` 之前,并各自包一层 `>>> SP8-P5a Task 5 … <<< SP8-P5a Task 5` 注释标记本任务新增区间。`parity.test.ts`、`messageSyntax.test.ts` 全绿(见三门结果)。

## `.k-empty*` / `.k-scroll` grep 结果(用前核实)

```
$ grep -n '\.k-empty\|\.k-scroll\|\.k-skel' src/ai/styles/knowledge.scss
420:  .k-scroll {
426:  .k-scroll-inner {
434:  .k-empty {
440:  .k-empty-illust {
456:  .k-empty-title { ... }
457:  .k-empty-sub {
461:  .k-empty-tips {
466:  .k-empty-tip {
475:  .k-skel {
```
`KnowledgeDeferred.vue` 只用了 `.k-scroll` / `.k-scroll-inner` / `.k-empty` / `.k-empty-illust` / `.k-empty-title` / `.k-empty-sub`,全部真实存在。**零 `<style>` 块**。未 import `knowledge.scss`(T10 的活,见下方偏离申报 K7 附注),故本任务里这些类目前渲染无样式,这是预期的。

## 每条偏离显式申报

1. **路由 `name` 用蓝本 PascalCase**(`KnowledgeDashboard` 等),与本仓既有路由 kebab-case(`ai-agent`/`ai-settings`)风格不同。按 brief 与协调者预授权,1:1 照 Vue2 优先,已在 `knowledgeRoutes.ts` 顶部注释里写明。
2. **component 用 eager import(顶部 `import`)**,不用蓝本的 `() => import(...)` 懒加载。照本仓 `src/router/index.ts` 既有风格,已在 `knowledgeRoutes.ts` 注释里写明。
3. **不照抄蓝本 meta(`requireAuth`/`showBackground`)与 `hidden` 字段**。本仓 `guard.ts` 只认 `meta.public`,照本仓既有 `ai-agent`/`ai-settings` 路由(均不写 meta)处理,已在 `knowledgeRoutes.ts` 注释里写明。
4. **R6:i18n 两键提前由本任务(T5)落地**,而非原计划的 T8,因为 T8 排在 T5 之后。已在两个语言包文件里各自的注释块标注 `SP8-P5a Task 5`。
5. **K7 占位页机制**:9 个子路由 + 2 条 parser 路由的 `component` 全部先指向 `KnowledgeDeferred`(含布局路由自身的 `component`,brief/治理文件未提及布局自身 component 的取值——采用同一占位组件,因目前没有 `KnowledgeLayout.vue`,该占位是临时的、无测试断言约束,T10 落地后会替换),rail 保持蓝本 9 项 1:1。
6. **测试代码 TS2345 修正**(非 Vue2 逻辑冲突,是 brief 测试代码的类型严格性问题):`deferred.test.ts` 第三个用例里 `DEFERRED_TABS.includes(notListed)` 编译报错——`DEFERRED_TABS` 的元组类型是 8 个字面量(不含 `'dashboard'`),`Array<T>.includes` 要求实参属于 `T`。改为 `(DEFERRED_TABS as readonly string[]).includes(notListed)`(与 `isDeferred` 内部同款 widen 写法),断言力不变(仍是真实的成员检查),已在测试文件内联注释说明并按治理文件 §2「brief 测试错不是实现让步」处理。

## §3.5「照抄不改」8 条命中情况

本任务不涉及 N1-N8(均是数据契约/后端字段相关,T5 只做路由与占位页,无数据读取逻辑),无命中项。

## 三门完整终值

```
pnpm test                  exit=0   Test Files 307 passed (307)   Tests 2742 passed (2742)
pnpm exec vue-tsc --noEmit exit=0   (无输出,无错误)
pnpm build                 exit=0   ✓ built in 12.17s(仅既有 >500KB chunk 警告,无新警告)
```
算术核对:基线 305 文件 / 2734 例(76367d2)→ 新增 1 个 `.vue`(`KnowledgeDeferred.vue`,color-guard +1 例)+ 2 个新测试文件(`deferred.test.ts` 3 例、`knowledgeRoutes.test.ts` 3 例)+ `router/index.test.ts` 新增 1 例 = 307 文件 / 2734+1+3+3+1 = 2742 例。**与实测完全吻合,无已知噪声用例出现(本次全绿,未触发 persist.test.ts / AgentComposer.test.ts 噪声)。**

## `git show --stat HEAD` 与 `git status`

提交 sha:`5644ed8b570315d34d7eae458e69567ed1a3aebe`
```
 src/ai/knowledge/deferred.test.ts            | 29 ++++++++++++++++++++++
 src/ai/knowledge/deferred.ts                 | 29 ++++++++++++++++++++++
 src/ai/knowledge/knowledgeRoutes.test.ts     | 36 +++++++++++++++++++++++++++
 src/ai/knowledge/knowledgeRoutes.ts          | 37 ++++++++++++++++++++++++++++
 src/ai/knowledge/views/KnowledgeDeferred.vue | 31 +++++++++++++++++++++++
 src/i18n/en_us.ts                            |  4 +++
 src/i18n/zh_cn.ts                            |  4 +++
 src/router/index.test.ts                     |  8 ++++++
 src/router/index.ts                          |  2 ++
 9 files changed, 180 insertions(+)
```
`git status --short` 干净(0 未跟踪/未暂存改动;报告本身位于 `.superpowers/`,该目录整体被 `.gitignore` 排除,不计入本次提交,符合本仓台账惯例)。
