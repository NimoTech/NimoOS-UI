# P5b · T5 报告 —— `QueueView.vue` + 路由反转

分支 `sp8-ai`,起点 `9a98106`(315 文件 / 2905 例全绿)。

## 1. 改了哪四个文件

- **新建** `src/ai/knowledge/views/QueueView.vue`(417 行蓝本 → 约 620 行 New-UI,含大量对照注释)
- **新建** `src/ai/knowledge/views/QueueView.test.ts`(53 个用例)
- **改** `src/ai/knowledge/knowledgeRoutes.ts`(`queue` 子路由 `component` 反转)
- **改** `src/ai/knowledge/deferred.ts`(`DEFERRED_TABS` 摘掉 `'queue'`)

**额外触碰的两个既有测试文件**(不在 brief 的「四个文件」字面清单里,但治理 §5 明文要求
「`knowledgeRoutes.test.ts` 里那条断言反转,不删」,且摘掉 `deferred.ts` 一项后
`deferred.test.ts` 的固定数组断言必然报红,两者都是编辑 `knowledgeRoutes.ts`/`deferred.ts`
的直接、不可避免的连带更新,承 P5a T12 先例——那次提交同样带上了 `knowledgeRoutes.test.ts`):
- `src/ai/knowledge/knowledgeRoutes.test.ts`(断言反转,旧文本留成注释)
- `src/ai/knowledge/deferred.test.ts`(断言反转,旧文本留成注释)

## 2. 八个区块落在哪(蓝本行区间 → New-UI)

| 区块 | 蓝本行 | New-UI 落点 |
|---|---|---|
| scope 切换 | `:6-13` | `<script>` 的 `scope` computed + `setScope()`;模板两个 `.k-filter-pill`(index/distill) |
| 三桶 pill + 完成统计 | `:16-39` | `counts`/`doneCount` computed;模板三个 filter pill + `.k-done-stat` |
| 工具条(index) | `:44-75` | 模板 `v-if="scope==='index'"` 分支,`selected.size` 二选一 |
| 工具条(distill) | `:76-82` | 模板 `v-else` 分支,单行 label |
| 空态 | `:85-98` | 模板 `v-if="rowsEmpty"`,内联渐变见 §5 |
| index 表格 | `:100-140` | `indexRows` computed + 对应模板块 |
| distill 表格 | `:145-185` | `distillRows` computed + 对应模板块 |
| 清空确认弹窗 | `:190-208` | `<script>` 无对应(纯模板),模板末尾 `DialogRoot` 一族 |

## 3. 承接了 Vue2 哪些行为(逐函数对照)

| Vue2 方法 | New-UI 函数 | 行为 |
|---|---|---|
| `loadForScope()` | `loadForScope()` | 原样:按 scope 分发 loadAllJobs/loadDistillJobs |
| `setScope(s)` | `setScope(s)` | 原样:相同 scope 提前 return,否则清选择 + `router.replace` + 重载 |
| `setFilter(f)` | `setFilter(f)` | 原样:仅 distill scope 重载 |
| `toggleSel(id)`/`toggleAll()` | 同名 | K13:`ref(new Set())` 整体替换,无 tick 计数器 |
| `retryOne`/`bulkRetry`/`retryAllFailed` | 同名 | K18:三处改真发 `retryFailed(null)`,见 §6 |
| `cancelOne`/`bulkCancel`/`doClearFailed` | 同名 | K5:catch 分支不回显 e.message,改固定 i18n |
| `retryDistillRow`/`cancelDistillRow` | 同名 | K5(409 分支保留专属友好文案) |
| `distillIconState`/`basename`/`dirname` | 从 `util/queueView.ts` 导入(K12,T4 已迁) | 零改动,直接复用 |
| `fmtAgo` | 从 `stores/knowledgeStore.ts` 导入(K11) | 零改动,直接复用 store 版本 |

## 4. 六条点名要求逐条回执

1. **K7(弹窗 reka 原语)**:`DialogRoot > DialogPortal(to=".knowledge-app", defer) > DialogOverlay(class="k-modal-bg") > DialogContent(class="k-modal")`,`VisuallyHidden as-child` 包 `DialogTitle` 满足 a11y(照 `src/ai/components/settings/skills/SkillDetail.vue:488-511` 确认弹窗先例逐字复用结构)。**未用**裸 `<div class="k-modal-bg">`,未用 `Teleport to="body"`。测试用 `withHost()` 在 `document.body` 放一个 `.knowledge-app` 宿主(先例 `SkillDetail.test.ts::withHost()`),`flushPromises()+nextTick()` 后查 `host.querySelector('.k-modal')`。3 条弹窗测试(打开/取消/确认)全绿。
2. **K18(三个重试入口统一 retryFailed(null))**:`retryOne`/`bulkRetry`/`retryAllFailed` 三个函数体内各自 `await store.retryFailed(null)`,toast 统一 `t('aiKbRetriedAllFailed')`。三处函数上方各自留了引用蓝本行号(`:312-318`/`:337-349`/`:320-328`)+ `repo_jobs.py:107-121` 死形参的完整注释。DoD 要求的“按钮/禁用条件/图标/排版零变动”——三个按钮的 `class`/`:disabled`/`<KIcon>`/文案与蓝本逐字相同,只有函数体内部实际发的请求变了。`QueueView.test.ts` 的「K18」describe 块三条用例分别验证三个入口都精确调用 `ai.parserRetryJobs({ file_ids: null })` 且 toast 文本一致。
3. **K16(空态 i18n)**:`:96` 两句改用 `aiKbQueueAllPendingDone`/`aiKbQueueNoRunningNow`,两档同填英文原文(已在 T1 落地,T5 只是消费)。测试断言渲染文本精确等于 `'All pending jobs are done.'`/`'No jobs running right now.'`。
4. **K11(fmtAgo 从 store import)**:`import { useKnowledgeStore, fmtAgo, DISTILL_JOBS_LIMIT } from '../stores/knowledgeStore'`,不从 `util/queueView` 拿(T4 特意没抽)。表格 `k-row-time` 渲染用固定历史时间戳(`created_at: 1784776422853`,对当前系统时钟已是「N 天前」档)验证 `fmtAgo` 真的接上了。
5. **内联渐变 + 守卫缺口③**:`:87` 的 `.k-empty-illust` 内联 `style=` 保留在模板里(未挪进 scss),三处色字面量按附录 B §B.0 换成 `color-mix(in srgb, var(--text-on-accent) 50%, transparent)` / `color-mix(in srgb, var(--success) 20%, transparent)` / `color-mix(in srgb, var(--accent) 20%, transparent)`,渐变结构(`radial-gradient(circle at 30% 30%, …, transparent 60%), linear-gradient(135deg, …, …)`)逐字不变。补的定向断言用 `node:fs`(非 `?raw`)读 `.vue` 源文件,正则切出 `<template>` 块,剥掉 `var(...)`/`color-mix(...)` 调用后断言零 `#hex`/`rgba?`/`hsla?`。附录 B §B.0.4 给的骨架里 `__dirname`(ESM 下不可用)与 `stripFns`(不存在)两个坑已按 `knowledgeStyles.test.ts` 头注释①②的既定写法改正(`dirname(fileURLToPath(import.meta.url))` + 自实现的 `stripCalls`)。
6. **路由反转**:`knowledgeRoutes.ts` 的 `queue` 子路由 `component` 从 `KnowledgeDeferred` 改成 `QueueView`;`deferred.ts` 的 `DEFERRED_TABS` 摘掉 `'queue'`(承 P5a T12 对 `''` 子路由的先例)。`knowledgeRoutes.test.ts` 的「11 条路由全是 KnowledgeDeferred」断言(已在 P5a T12 反转成「除 `''` 外 10 条」)再次反转成「除 `''` 与 `queue` 外 9 条」,旧文本留成注释;`deferred.test.ts` 的固定数组同步摘掉 `'queue'`,旧文本留成注释。

## 5. 属性态覆盖表(对照附录 D §D.3)

| 宿主 | 属性 | 蓝本位置 | 真侧断言 | 假侧断言 | 用例位置 |
|---|---|---|---|---|---|
| `.k-filter-pill`(scope×2) | `data-on` | `:7,10` | `'true'` | `'false'` | 「scope 切换」describe,两条用例互为对照 |
| `.k-filter-pill`(filter×3) | `data-on` | `:18,24,30` | `'true'` | `'false'` | 「切 filter pill:data-on 三选一互斥」,五个 pill 逐一断言 |
| `.k-filter-pill`(failed) | `data-tone` | `:29` | `'danger'` | 其余两个 pill `toBeUndefined()`(静态字面量,无「假值」侧,两侧含义见下方脚注) | 「三桶 pill…」describe |
| `.k-toolbar` | `data-selecting` | `:44` | `'true'` | `'false'` | 「未选中态」/「选中 >0 行」两条用例 |
| `.k-row`(index) | `data-selected` | `:110` | `'true'`(选中行) | `'false'`(未选中行,同一渲染内两行对照) | 「data-selected 两侧都覆盖」 |
| `.k-row`(distill) | `data-scope` | `:146,155` | `'distill'`(distill 行/表头) | `undefined`(index 行,同一断言块内两侧对照) | 「专属栅格 data-scope…」 |
| `.k-row-status` | `data-state` | `:112,156` | `'pending'/'running'/'failed'`(index 三态各一条) | `distillIconState` 折叠 failed/skipped → `'failed'`(distill,两行对照) | 「data-state 三态…」+「data-state 用 distillIconState…」 |
| `.k-row-action` | `data-tone` | `:128,173` | `'danger'`(cancel 按钮) | `undefined`(retry 按钮,两侧对照) | 「行操作:pending→取消…」 |
| `.kn-badge` | `data-s` | `:164,167,168` | `'curated'`/`'archived'`(manual/auto 两侧对照)+`'draft'`/`'failed'`(skipped/failed 两侧对照) | — | 「kn-badge 徽标…」+「failed 桶两行…」 |

脚注(`data-tone` on `.k-filter-pill`):这是蓝本里**唯一一处静态字面量属性**(不随任何响应式条件切换),不存在「同一元素两种取值」的两侧场景;按附录 D.3 的口径,「两侧」落实为「有此属性的元素值精确等于 `danger`」与「结构上不该有此属性的兄弟元素确实没有」两个独立断言,已覆盖。`.k-row-action` 的 `data-tone` 同理(retry 按钮天生没有这个绑定)。

## 6. 6 种 scope × filter 组合的用例位置

`QueueView.test.ts` 的 `describe('QueueView — 6 种 scope × filter 组合(DoD 明确要求)')`(约第 610-630 行)用 `for (const c of combos)` 循环生成 6 个 `it`,分别覆盖 `{filter: pending|running|failed} × {scope: index(缺省)|distill}`,每条断言 scope pill 与 filter pill 的 `data-on` 状态一致,且 `.k-table`/`.k-empty` 二选一恰好渲染一个。此外前面各 describe 块也对 6 种组合的具体渲染内容(表格行、徽标、空态文案)分别有更细的用例覆盖(见 §2 的分区块列表)。

## 7. mock 形状逐个说明取自哪个 fixture

| mock | 取自 | 形状口径 |
|---|---|---|
| `ai.parserJobs({status:'pending'})` → `PENDING_JOBS` | `p5b-fixtures/jobs-pending.json` | 原样 snake_case,逐字段复制(3 行) |
| `ai.parserJobs({status:'running'})` → `RUNNING_JOBS` | `p5b-fixtures/jobs-running.json` | 原样 snake_case(1 行) |
| `ai.parserJobs({status:'failed'})` → `FAILED_JOBS` | 真机 `jobs-failed.json` 是 `{"jobs":[]}`,人工构造 2 行 | 字段名与 pending/running 两个真 fixture 同一套 schema(`id/root_id/path/op/sub_modality/priority/attempts/last_error/locked_until/created_at/picked_at/done_at`),仅数值不同,专门覆盖 `{n}× retried`/`last_error`/重试按钮几条真机验不了的分支(README §4.5 已登记) |
| `ai.parserRetryJobs` | `jobs-retry-empty.http` | `{"retried":0}` |
| `ai.parserDeleteJob` | §4.1 axios 204 空体推定 | `mockResolvedValue('')`(不是 `{}`/`undefined`) |
| `ai.parserClearFailedJobs` | README「未实测 · 源码推定」段 | `{cleared:0}` |
| `notes.listDistillJobs`/`getDistillStatus` | `distill-jobs*.json`/`distill-status.json` 真机为空,camelCase 归一化后人工构造 `DISTILL_PENDING`/`RUNNING`/`FAILED` | 字段名严格取自 README「distill job 行的字段(队列非空时)」段(`filePath/status/origin/attempts/lastError/enqueuedAt/updatedAt`),标注「源码推定,真机验不了」 |

## 8. 路由反转前后的断言文本

见 `src/ai/knowledge/knowledgeRoutes.test.ts`(改前原文以注释保留,紧邻新断言上方)与
`src/ai/knowledge/deferred.test.ts`(同上)。新断言:
- `knowledgeRoutes.test.ts`:`"queue" 是 QueueView`,其余 7 个子路由 + 2 条 parser 路由(共 9 条)仍是 `KnowledgeDeferred`。
- `deferred.test.ts`:`DEFERRED_TABS` 排序后等于 `['allowlist','indexed-files','notes','roots','search','settings','wiki']`(7 项),`isDeferred('queue')` 断言为 `false`。

## 9. `dist/assets/*.css` grep 证据

```
$ grep -o '\.k-filter-pill\b' dist/assets/index-BzyIlTIZ.css | wc -l   → 11
$ grep -o '\.k-done-stat\b'   dist/assets/index-BzyIlTIZ.css | wc -l   → 4
$ grep -o '\.k-toolbar\b'     dist/assets/index-BzyIlTIZ.css | wc -l   → 4
$ grep -o '\.k-empty-illust\b' dist/assets/index-BzyIlTIZ.css | wc -l  → 1
$ grep -o '\.k-modal-bg\b'    dist/assets/index-BzyIlTIZ.css | wc -l   → 1
$ grep -o '\.k-confirm-body\b' dist/assets/index-BzyIlTIZ.css | wc -l  → 1
$ grep -o '\.kn-badge\b'      dist/assets/index-BzyIlTIZ.css | wc -l   → 5
$ grep -o '\.k-row-status\b'  dist/assets/index-BzyIlTIZ.css | wc -l   → 4
$ grep -o '\.k-frow-status\b' dist/assets/index-BzyIlTIZ.css | wc -l   → 0  (对照:这是 T6/T8 的类,不该出现在本次构建产物核对里,仅用来确认 grep 方法本身有判别力)
```

## 10. RED 探针(4 次,均已还原,`git status --short` 干净)

**探针①(brief 指定):摘掉 `data-on` 的 `String()`**
```diff
- <button class="k-filter-pill" :data-on="String(scope === 'index')" @click="setScope('index')">
+ <button class="k-filter-pill" :data-on="scope === 'index'" @click="setScope('index')">
  (两处,scope 切换的两个 pill)
```
运行 `pnpm test -- --run src/ai/knowledge/views/QueueView.test.ts`:**53/53 全绿,零报红**。
这不是探针失败,而是精确复现了附录 D §D.3.1 的结论:Vue 3 的 `patchAttr` 对 `data-*` 这类
非特殊布尔属性,`setAttribute(key, true/false)` 会被 DOM API 自动字符串化成 `"true"`/`"false"`,
与显式 `String(...)` 渲染结果逐字相同——**套不套都不影响渲染**,所以没有可复现的错误行为可
「修正」,属于「与需求无关的顺手改动」范畴。已还原(`String()` 照抄）。

**补充确认探针(证明测试套件对这块区域仍有判别力):把布尔条件本身取反**
```diff
- <button class="k-filter-pill" :data-on="String(scope === 'index')" @click="setScope('index')">
+ <button class="k-filter-pill" :data-on="String(scope !== 'index')" @click="setScope('index')">
```
运行同上命令:**6 个用例精确报红**,报红文本节选:
```
AssertionError: expected 'false' to be 'true'
  at src/ai/knowledge/views/QueueView.test.ts:191
❯ ... 切 filter pill:data-on 三选一互斥 ...
  - Expected ["true", "false", "false", "true", "false"]
  + Received ["false", "false", "false", "true", "false"]
❯ ... 6 种 scope × filter 组合 ... scope=index filter=pending/running/failed(3 条)
  AssertionError: expected 'false' to be 'true'
```
已还原,`String(scope === 'index')` 恢复。

**探针②(brief 指定):`distillTruncated` 的 `>=` 改成 `>`**
```diff
- return (store.distillJobs.total || 0) >= DISTILL_JOBS_LIMIT
+ return (store.distillJobs.total || 0) > DISTILL_JOBS_LIMIT
```
报红文本:
```
FAIL  ... 截断提示 distillTruncated 边界:total=499 不出,total=500(DISTILL_JOBS_LIMIT)才出 —— RED 探针②的钉子
AssertionError: expected false to be true // Object.is equality
- true
+ false
  at src/ai/knowledge/views/QueueView.test.ts:600
```
已还原,`>=` 恢复。

**探针③(brief 指定):`bulkRetry` 改回蓝本原文(fileIds 恒空数组、不走 K18)**
```diff
  async function bulkRetry(): Promise<void> {
+   const ids = Array.from(selected.value)
+   const n = ids.length
+   const fileIds = (indexRows.value as ...).filter(r => selected.value.has(r.id)).map(r => r.file_id).filter(Boolean)
    try {
-     await store.retryFailed(null)
+     if (fileIds.length) await store.retryFailed(fileIds)
      selected.value = new Set()
-     store.toast(t('aiKbRetriedAllFailed'))
+     store.toast(`Retried ${n} selected jobs`)
    } catch { ... }
  }
```
报红文本:
```
FAIL  ... bulkRetry(批量重试按钮)—— 与蓝本原文「fileIds 恒空数组、一个请求都不发」的假成功不同,真发请求
AssertionError: expected "vi.fn()" to be called with arguments: [ { file_ids: null } ]
Number of calls: 0
  at src/ai/knowledge/views/QueueView.test.ts:656
```
精确复现蓝本 bug 的症状(0 次调用),证明本任务的 K18 修正确实是必要的、且测试真的钉住了它。
已还原,`retryFailed(null)` 版本恢复。

**探针④(brief 建议追加):守卫缺口③的定向断言 —— 把 `color-mix(...)` 改回裸 `rgba(...)`**
```diff
- color-mix(in srgb, var(--success) 20%, transparent),
+ rgba(52,199,89,0.2),
```
报红文本:
```
FAIL  ... <template> 块内(剥离 var()/color-mix() 之后)不含任何裸 hex / rgb / hsl 字面量
AssertionError: expected ... not to match /\b(rgba?|hsla?)\s*\(/
  at src/ai/knowledge/views/QueueView.test.ts:815
```
另追加一次同族探针(在**不被** `var()`/`color-mix()` 包裹的位置塞一个 `#ff0000`,验证盲区确实
被堵死,不只是对 `color-mix` 内部敏感):在 `DialogContent` 的 `style="width: min(420px, 100%)"`
后追加 `; border-color: #ff0000`,同一条断言精确报红(`not.toMatch(/#[0-9a-fA-F]{3,8}\b/)` 失败)。
两次均已还原。

**还原后确认**:`git status --short` 只剩本任务应有的 6 个文件变更,无遗留探针代码。

## 11. 三门实测数字

```
pnpm test                    → Test Files 316 passed (316) · Tests 2959 passed (2959) · exit 0
pnpm exec vue-tsc --noEmit   → exit 0(零错误)
pnpm build                   → exit 0(仅既有第三方包警告 + >500KB chunk 警告)
```

基线 `9a98106` = 315 文件 / 2905 例。**实测增量:+1 文件(仅 `QueueView.test.ts`;`.vue` 不计入
test files)/ +54 例**(不是 brief 预估的「+2 例(color-guard)+45 例左右」= 47 左右;差异说明:
①color-guard 本任务只新增 1 个 `.vue`(`QueueView.vue`,T8 的 `IndexedFilesView.vue` 不在本任务
范围内)→ +1 例不是 brief 假设两个文件都到位时的 +2;②`QueueView.test.ts` 本身含 53 条用例
(不是预估的「45 例左右」),按 DoD「6 种组合」「5 组属性态两侧」「K7/K18/K16/K11 各自独立钉子」
「distillTruncated 边界」等要求逐条实作后自然超出预估;53(新文件)+1(color-guard 新增)=54,
与实测总数增量精确吻合)。

## 12. 遗留疑问

无。K18 三处证据链、K5 系列 catch 分支、K7 弹窗结构、K11/K12 复用点、K16 i18n、路由反转全部
按治理文件与附录逐条核实落地;`distillIconState`/`basename`/`dirname`/`fmtAgo` 均直接 import
自 T4/T3(P5a)既有产出,未发现"上游漏了"的缺口。唯一值得协调者知晓的一点(非疑问,仅记录):
brief 附录 D §D.3 里"`.k-filter-pill` 的 `data-tone`"与"`.k-row-action` 的 `data-tone`"是纯静态
字面量绑定,不存在真正意义上的"假侧"渲染(它就是「有/无这个属性」的结构性差异,不是同一元素
在不同状态下切换出的两个字符串值)——已在 §5 表格脚注里显式说明处理口径,供评审核对时参考。
