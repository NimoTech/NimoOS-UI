# SP8-P5a Task 7 报告 —— `knowledgeStore` notes + wiki + distill 组

commit: `aacdf763eb1e10fc62d0827429b7af662cf7b126`

## 逐 action 对照(蓝本 `knowledgeStore.js` main@7a6ee6b7 → 本仓 `knowledgeStore.ts`)

| # | action | 蓝本行 | 本仓行 |
|---|---|---|---|
| 1 | `setNotesDraftCount` | :99-101 | :473 |
| 2 | `refreshNotesDraftCount` | :102-107 | :480 |
| 3 | `loadNotesSummary` | :108-117 | :490 |
| 4 | `runSearch` | :120-131 | :512 |
| 5 | `loadChunkContext` | :134-138 | :533 |
| 6 | `loadDistillJobs` | :180-197 | :552 |
| 7 | `retryDistill` | :202-205 | :572 |
| 8 | `cancelDistill` | :211-214 | :580 |
| 9 | `loadRoots` | :244-253 | :590 |
| 10 | `loadCandidates` | :254-260 | :602 |
| 11 | `createRoot` | :262-266 | :612 |
| 12 | `deleteRoot` | :267-270 | :619 |
| 13 | `rescanRoot` | :271-273 | :625 |
| 14 | `loadWikiTree` | :276-278 | :632 |
| 15 | `loadWikiNode` | :280-287 | :647 |
| 16 | `loadWikiRaw` | :289-296 | :657 |
| 17 | `setRootEnabled` | :297-309 | :668 |

新增 state:`distillJobs`(`DistillJobsState` :215)· `wikiRoots` · `wikiCandidates` · `wikiRootsLoading` · `notesDraftCount` · `notesSummary`(`NotesSummary` :226)。所有 17 个 action + 6 个 state 都已加入 `return {}` 导出对象,消费方(T10 壳、T12 仪表盘)可直接解构使用。

新增一个内部辅助 `isNotFound(e: unknown): boolean`(蓝本无对应具名函数,是 `e.response.status===404` 判断的抽取,供 `loadWikiNode`/`loadWikiRaw` 共用,纯提取无行为改动)。

## K1(单层取数)命中点逐个确认

- `r.data.notes` → 改走 `service.notes.list({...})`,包内已 `.map(normalizeNote)` 返回 `Note[]`,`refreshNotesDraftCount`/`loadNotesSummary` 直接用 `list.length`/`summarizeNotes(list)`,零 `.data`。
- `notesApi.list({limit:500})` 的 body 直接喂给 `summarizeNotes`,无额外剥壳。
- `api.post('/ai/search/text')` → `service.ai.searchText(body)`;`api.get('/ai/search/chunk')` → `service.ai.searchChunk(params)`。两者在共享包 `ai.ts:579-586` 内部已 `return res.data`,store 层直接 `return service.ai.xxx(...)`,不再多剥。
- `listDistillJobs(filter, DISTILL_JOBS_LIMIT)` 返回已归一化的 `DistillJobsView{jobs,counts}`,直接用 `jobsResult.jobs`/`jobsResult.counts`,不写 `.data`。
- `wiki.getRoots()`/`getCandidates()`/`getTree()`/`getNode()`/`getRaw()` 均包内已剥壳(见 `wiki.ts`),`loadRoots`/`loadCandidates`/`loadWikiTree`/`loadWikiNode`/`loadWikiRaw` 直接赋值/返回。
- `createRoot` 的 `r.data` → 包内 `wiki.createRoot()` 已 `return res.data`(T2 的结构性偏离,已在 `wiki.ts:176-186` 申报),store 层 `const result = await service.wiki.createRoot(body)` 直接 `return result`,零 `.data`。

**全部命中点核对无误,零处残留 `.data` 剥壳。**

## N4/N5/N6/N7(照抄不改)确认

- **N4**(`loadDistillJobs` 无过滤刷三桶/有过滤只刷该桶,不对称):代码 `:559-563`,`if (!filter || filter==='pending') ...` / `running` / `failed` 三条件保留,注释逐字解释「繁忙队列防截断」的设计意图。
  用例:`distill 队列(N4/N5) > 无过滤时刷新三个桶,skipped 归进 failed 桶`(无 filter 侧)+ `distill 队列(N4/N5) > 有过滤时只刷该桶,另两桶保留上次结果(N4 的不对称,照抄)`(有 filter 侧,断言 `pending` 未被清空)。两侧都有对照。
- **N5**(`d.total = rows.length` 而非比 `counts`):代码 `:566`,注释解释免竞态选择。
  用例:同一条 `无过滤时刷新三个桶…` 断言 `s.distillJobs.total).toBe(4)`(rows.length=4,若改成 counts 之和会得 6)。
- **N6**(`loadWikiNode`/`loadWikiRaw` 只把 404 转 `null`、其余上抛):代码 `:647-664`。
  用例:`wiki 导航(N6…) > loadWikiNode / loadWikiRaw 把 404 转成 null`(404 侧)+ `wiki 导航(N6…) > 非 404 错误原样上抛`(500 侧,两个函数都测)。两侧都有对照。
- **N7**(Go nil slice → `null` → `(x||[])` 兜底):本任务命中点在 `loadDistillJobs` 的 `const rows = jobsResult.jobs || []`(虽然包内 `normalizeDistillJobs` 已经兜过一次,这里是双保险,照抄蓝本 `:185` 同款写法,未删除)。

## P1/P3/K5/K6 申报

- **P1**(`Vue.observable`→Pinia setup store 机械替换):本任务新增的 6 个 state 全部走 `ref()` + `.value`,与 T6 同构,无额外行为改动。
- **P3**(`knowledgeStore` 里直调 axios 改走包):`refreshNotesDraftCount` 的 `api.get('/ai/agent/notes', {...})` → `service.notes.list({status:'draft', limit:200})`;`loadNotesSummary` 的 `notesApi.list({limit:500})`(蓝本本就是走 `notesApi`,不算此偏离命中,仅前一条命中 P3)。
- **K5**(HTTP 失败不回显后端 body,改 i18n 键):`loadRoots` 的 catch 分支从蓝本 `i18n.t('Operation failed') + ': ' + (e.message||e)` 改成 `toast(i18n.global.t('aiKbOpFailed'))`,不拼接后端错误串。用例 `loadRoots 失败时 toast 报错并把 loading 归位` 显式断言 `not.toContain('timeout')`。
- **K6**(`console.error` 不照抄):`grep -n "console\." src/ai/knowledge/stores/knowledgeStore.ts` 零命中(本任务新增代码零处 console)。

## i18n

复用 T8 已落地的 `aiKbOpFailed`(`src/i18n/zh_cn.ts:1445`=`操作失败`,`en_us.ts:1435`=`Operation failed`),未新增任何键。

## 与 `knowledgeStore.parser.test.ts` 的 mock 形状一致性核对

两个测试文件都 `vi.mock('@nimotech/nimoos-service', () => ({ service: {...} }))`,`parser.test.ts` 只 mock `service.ai`,本文件 mock `service.notes`/`service.wiki`/`service.ai`(`searchText`/`searchChunk`),互不重叠、无同名方法被两处 mock 成不同形状的情况。`STATS`/`STATE` 裸 body 风格与本文件 `ROOT`/`JOBS(...)` 裸 body 风格一致,都不套 `{data:…}` 外壳。两文件一并跑(`vitest run knowledgeStore.notesWiki.test.ts knowledgeStore.parser.test.ts`)42 例全绿,互不干扰。

## 设备现状登记(不可用接口)

- **distill 四条端点**(`listDistillJobs`/`getDistillStatus`/`distillFile`/`cancelDistillJob`)在设备上实测 404(容器内 Python agent 版本落后)。本任务的 fixture(`JOBS(...)` 构造器给出的 `{filePath,status}` 行)形状来源是共享包 `notes.ts` 的 `DistillJob`/`normalizeDistillJobs` 归一化类型定义,**不是真机抓取**。本期只做 store 层 + 单测,不列真机验收项。
- **Wiki `/roots`/`/tree`/`/node`** 在设备上因 `wiki.db` 38GB + `SetMaxOpenConns(1)` 超时,`/candidates` 实测返回 `[]`。本任务的 `ROOT` fixture 形状来源是共享包 `wiki.ts` 的 `WikiRoot` 接口定义(及其 `normalizeRoot` 归一化逻辑),`WikiCandidate`/`WikiTreeNode`/`WikiNode` 同理均来自包内类型声明,非真机抓取。同样只做 store 层 + 单测。

## 四次 RED 探针

**探针 1(N4)**:把 `:559-563` 的三条 `if` 判据全部删掉,变成无论有无 `filter` 都无条件刷新三桶。
```
- if (!filter || filter === 'pending') d.pending = rows.filter((j) => j.status === 'pending')
- if (!filter || filter === 'running') d.running = rows.filter((j) => j.status === 'running')
- if (!filter || filter === 'failed') { d.failed = rows.filter(...) }
+ d.pending = rows.filter((j) => j.status === 'pending')
+ d.running = rows.filter((j) => j.status === 'running')
+ d.failed = rows.filter((j) => j.status === 'failed' || j.status === 'skipped')
```
报红用例:`distill 队列(N4/N5) > 有过滤时只刷该桶,另两桶保留上次结果(N4 的不对称,照抄)`
```
AssertionError: expected [] to have a length of 1 but got +0
❯ knowledgeStore.notesWiki.test.ts:129:35
```
还原后 `git status --short` 干净(见下方三门终值前已确认)。

**探针 2(N5)**:把 `:566` 的 `d.total = rows.length` 改成比 `counts`。
```
- d.total = rows.length
+ d.total = d.counts.pending + d.counts.running + d.counts.failed
```
报红用例:`distill 队列(N4/N5) > 无过滤时刷新三个桶,skipped 归进 failed 桶`
```
AssertionError: expected 6 to be 4
❯ knowledgeStore.notesWiki.test.ts:112:33
```
还原确认。

**探针 3(N6)**:把 `loadWikiNode` 的「非 404 上抛」改成一律 `catch { return null }`。
```
- } catch (e) {
-   if (isNotFound(e)) return null
-   throw e
- }
+ } catch {
+   return null
+ }
```
报红用例:`wiki 导航(N6:404 → null,其余上抛) > 非 404 错误原样上抛`
```
AssertionError: promise resolved "null" instead of rejecting
❯ knowledgeStore.notesWiki.test.ts:277:38
```
还原确认。

**探针 4(K5)**:把 `loadRoots` 的 catch 分支改成把后端错误串拼进 toast。
```
- } catch {
-   toast(i18n.global.t('aiKbOpFailed'))
- }
+ } catch (e) {
+   toast(i18n.global.t('aiKbOpFailed') + ': ' + (e as Error).message)
+ }
```
报红用例:`wiki 索引根(移植 Vue2 knowledgeStoreRoots.spec.js) > loadRoots 失败时 toast 报错并把 loading 归位`
```
AssertionError: expected '操作失败: timeout' not to contain 'timeout'
❯ knowledgeStore.notesWiki.test.ts:198:52
```
还原确认。

每次探针后单独重跑 `knowledgeStore.notesWiki.test.ts` 确认恢复到 22/22 全绿(4 次都已复核),四次探针全部命中精确报红,无一次全绿(即无「反而更好」发现需要补断言)。

## 三门完整终值(RED 探针复原之后)

```
pnpm test:
 Test Files  311 passed (311)
      Tests  2805 passed (2805)

pnpm exec vue-tsc --noEmit:
 (空输出,exit=0)

pnpm build:
 ✓ built in 12.06s(exit=0,仅既有 >500KB chunk 警告)
```
算术核对:基线 310 文件/2783 例(brief 给出)→ 本任务新增 1 个测试文件(不新增 `.vue`)→ 311 文件;新增 22 条用例但基线号称 2783,311 文件对应 2805(2783+22=2805 ✓)。

## 已知噪声

本次全量跑无红项,`persist.test.ts`/`AgentComposer.test.ts` 两个已知噪声本轮均未触发。

## `git show --stat HEAD` / `git status`

```
commit aacdf763eb1e10fc62d0827429b7af662cf7b126
 .../stores/knowledgeStore.notesWiki.test.ts        | 287 +++++++++++++++++++++
 src/ai/knowledge/stores/knowledgeStore.ts          | 280 ++++++++++++++++++++
 2 files changed, 567 insertions(+)
```
`git status --short` → 空(工作区干净,提交只含这两个文件,`knowledgeStore.ts` 的 diff 全为追加,未删改 T6 已落地的任何一行)。

## 偏离清单(本任务命中的 §3 12 条)

- P1、P3、K5、K6(逐条已在上文申报)。
- 未命中:K2/K3/K4/K7/K8/P2/P4(均属 T6/组件层任务,本任务不涉及)。

## NEEDS_CONTEXT

无。所有数据契约与蓝本行为均已核对一致,无需协调者拍板的疑点。
