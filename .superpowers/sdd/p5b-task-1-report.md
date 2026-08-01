# P5b Task 1 报告 —— i18n:100 条新键 + 守卫扩本批圈

## 0. 权威输入

按 brief 顺序读了:
1. `.superpowers/sdd/p5b-common-constraints.md`(全文,含 §12 计划书勘误 E-1~E-12)
2. `.superpowers/sdd/p5b-appendix-A-i18n.md`(键表,权威源)
3. `.superpowers/sdd/p5a-common-constraints.md`(全文,沿用条款)

工作区确认:`pwd` = `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,`git branch --show-current` = `sp8-ai`,
起点 HEAD = `317b8da`(与任务书要求一致),`git status` 起始干净。

## 1. 改了什么(逐文件)

### 1.1 `src/i18n/zh_cn.ts`
在既有 `// <<< SP8-P5a Task 8` 标记后插入新块 `// >>> SP8-P5b Task 1 … // <<< SP8-P5b Task 1`,
落地 100 个新键(逐字照附录 A,不做任何"顺手改对")。块内按来源分三段落地:
- 95 条(附录 A §A.1,有 Vue2 权威 zh 值)
- 4 条(附录 A §A.2,K16/K18/K19 新造)
- 1 条(附录 A §A.4,K20 `aiKbStatusIndexing`)

块头注释显式列出 9 行 `⚠️N` 标记(错译/同值撞车)所在的键名,提醒后续维护者别"顺手改对"。

### 1.2 `src/i18n/en_us.ts`
同一 100 个键,同一插入位置,en 值 = Vue2 `$t()` 的英文原 key,逐字相同。

### 1.3 `src/i18n/messageSyntax.test.ts`
在既有 `bare @ guard` describe 块之前插入新 describe `'P5b Task 1 aiKb* keys — punctuation and placeholder guards'`,含 6 条 `it`:
1. `covers exactly the 100 keys this task added` —— `p5bTask1Keys.length` 钉 100
2. `registers exactly the 15 full-width-punctuation exceptions` —— 例外表键数钉 15
3. `pins the exact zh_cn value … for each of the 15 registered exceptions` —— **每条例外用 `toBe` 钉死确切值**(按 brief 要求「强断言,不是跳过扫描的松形式」)
4. `should not contain full-width ，；：？！（） … (except the 15 registered exceptions)` —— 主扫描,例外表之外的 85 条一律不许命中
5. `covers exactly the 20 keys … interpolation placeholders` —— 占位符键表钉 20
6. `zh_cn and en_us use the same set of {…} placeholder names …` —— 两档占位符集合一致

**预期 +3~5,实测 +6**:多出的 1 条是 `registers exactly the 15 full-width-punctuation exceptions`(单独钉例外表本身的键数),
是在贯彻 brief「例外一律写成 toBe 钉死确切值的强断言」时把「例外表键数」与「例外表逐值」拆成了两条独立断言
(前者防"漏挂/多挂例外",后者防"挂了但值错"),不是重预测算错,是履行同一要求时多写了一条防漂移断言。

## 2. 逐码点比对脚本

`.superpowers/sdd/p5b-task-1-i18n-verify.mjs`(`git add -f`,含输出)。

- 读 `git show main:src/assets/lang/zh_CN.json`(在 `/home/nimo/NimoTech/NimoOS-UI` 只读跑 `git show`,未 `cat`/`Read` 工作树文件,未在那里做任何写操作)
- 读本仓新写的 `src/i18n/zh_cn.ts`(用 `Function` 对对象字面量求值,不是正经 TS 解析,但对纯字符串字面量对象足够)
- 对**附录 A §A.1 的 95 条**(唯一"有 Vue2 权威源"的子集,不含 A.0 复用 9 条、A.2 新造 4 条、A.4 的 K20 1 条)逐 `codePointAt` 比对

### 完整逐条结果(节选,完整 95 行见脚本运行输出;全部 MATCH,无删减)

```
MATCH     aiKbAll
MATCH     aiKbAllCaughtUp
MATCH     aiKbCancel
MATCH     aiKbCancelFailed
MATCH     aiKbCancelSelected
MATCH     aiKbCancelled
MATCH     aiKbCancelledNSelected
MATCH     aiKbCannotCancel
MATCH     aiKbClear
MATCH     aiKbClearFailedConfirmBody
MATCH     aiKbClearFailedConfirmTitle
MATCH     aiKbClearFailedErr
MATCH     aiKbClearFailedRecords
MATCH     aiKbClearFilters
MATCH     aiKbClearSelected
MATCH     aiKbClearedNFailed
MATCH     aiKbClose
MATCH     aiKbColAction
MATCH     aiKbColFile
MATCH     aiKbColPath
MATCH     aiKbColSize
MATCH     aiKbColTime
MATCH     aiKbColType
MATCH     aiKbColVectors
MATCH     aiKbConfirmClear
MATCH     aiKbConfirmRebuildN
MATCH     aiKbFailedOnly
MATCH     aiKbLegacy
MATCH     aiKbLegacyDoc
MATCH     aiKbLegacyDocTip
MATCH     aiKbLoadErrorLabel
MATCH     aiKbMonthsAgo
MATCH     aiKbNFailedRecords
MATCH     aiKbNIndexedFiles
MATCH     aiKbNPendingJobs
MATCH     aiKbNRetried
MATCH     aiKbNRunningJobs
MATCH     aiKbNSelected
MATCH     aiKbNoFailedDistill
MATCH     aiKbNoFailedJobs
MATCH     aiKbNoMatchSub
MATCH     aiKbNoMatchTitle
MATCH     aiKbNoRunningJobs
MATCH     aiKbOriginAuto
MATCH     aiKbOriginManual
MATCH     aiKbOverExplicitCap
MATCH     aiKbPagerNext
MATCH     aiKbPagerPrev
MATCH     aiKbPathPrefix
MATCH     aiKbPerPage
MATCH     aiKbPollTip
MATCH     aiKbPolling
MATCH     aiKbQueueEmpty
MATCH     aiKbQueuedNJobs
MATCH     aiKbRebuild
MATCH     aiKbRebuildAllBody1
MATCH     aiKbRebuildAllBody2
MATCH     aiKbRebuildAllInRoot
MATCH     aiKbRebuildAllOverCap
MATCH     aiKbRebuildAllTip
MATCH     aiKbRebuildAllTitle
MATCH     aiKbRebuildCapHint
MATCH     aiKbRebuildFailed
MATCH     aiKbRebuildRowTip
MATCH     aiKbRebuildSelectedN
MATCH     aiKbRebuilding
MATCH     aiKbRequeued
MATCH     aiKbRetry
MATCH     aiKbRetryAllFailed
MATCH     aiKbRetryFailedErr
MATCH     aiKbRetrySelected
MATCH     aiKbRoot
MATCH     aiKbScopeDistill
MATCH     aiKbScopeIndex
MATCH     aiKbSelectAllTip
MATCH     aiKbSelectFilesHint
MATCH     aiKbShowingFirst200
MATCH     aiKbShowingFirstN
MATCH     aiKbShowingRange
MATCH     aiKbSkipped
MATCH     aiKbSortAsc
MATCH     aiKbSortDesc
MATCH     aiKbSortIndexTime
MATCH     aiKbSortVectorCount
MATCH     aiKbStatusActive
MATCH     aiKbStatusError
MATCH     aiKbStatusIndexed
MATCH     aiKbStatusRemoved
MATCH     aiKbTombstonedNoSelect
MATCH     aiKbTombstonedTip
MATCH     aiKbTotalDone
MATCH     aiKbTotalDoneLabel
MATCH     aiKbTypePrefix
MATCH     aiKbZeroVec
MATCH     aiKbZeroVecTip

SUMMARY: 95/95 MATCH
```

**结论:95/95 MATCH。**

附带核实了 A.3 提到的半角/全角分号细节:
- `aiKbShowingFirstN`:`仅展示前 {n} 条;缩小筛选范围可查看其余记录。` —— 分号 codepoint `U+003B`(半角)
- `aiKbShowingFirst200`:`仅展示前 200 条；批量操作仍会处理全部。` —— 分号 codepoint `U+FF1B`(全角)

两者与附录 A §A.3 的记载完全一致(逐码点验证脚本之外,单独跑了一段 node 脚本核对,见下方 RED 探针前的准备工作)。

## 3. 三次 RED 探针(原始报红文本 + 已改回确认)

### 探针 1:全角逗号 → 半角逗号,断言精确报红

**改动**:`zh_cn.ts` 的 `aiKbNoFailedJobs` 从 `'全部正常，索引服务运行中。'` 改成 `'全部正常,索引服务运行中。'`(把唯一的全角 `，` 换成半角 `,`)。

**报红**:
```
 ❯ src/i18n/messageSyntax.test.ts (23 tests | 1 failed) 16ms
       × pins the exact zh_cn value (with its Vue2-authentic full-width punctuation) for each of the 15 registered exceptions 4ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/i18n/messageSyntax.test.ts > i18n message syntax > P5b Task 1 aiKb* keys — punctuation and placeholder guards > pins the exact zh_cn value (with its Vue2-authentic full-width punctuation) for each of the 15 registered exceptions
AssertionError: expected '全部正常,索引服务运行中。' to be '全部正常，索引服务运行中。' // Object.is equality

Expected: "全部正常，索引服务运行中。"
Received: "全部正常,索引服务运行中。"

 Test Files  1 failed (1)
      Tests  1 failed | 22 passed (23)
```

**判定**:精确报红 1 条(不是一片红),命中的正是「例外值 toBe 钉死」那条断言,不是主扫描那条(因为改后该值不再含任何全角标点,若只有主扫描会误判成"变干净了"而不报红——这正是 brief 要求"toBe 强断言"而非"跳过扫描"的原因所在)。

**已改回**:`git diff` 对 `zh_cn.ts` 为空(与改动前 backup 逐字节 diff 为空),`pnpm exec vitest run src/i18n/messageSyntax.test.ts` 恢复 23/23 全绿。

### 探针 2:`{n}` 占位符改名,占位符一致性断言精确报红

**改动**:`en_us.ts` 的 `aiKbClearedNFailed` 从 `'Cleared {n} failed records'` 改成 `'Cleared {count} failed records'`(只改英文档,中文档不变)。

**报红**:
```
 ❯ src/i18n/messageSyntax.test.ts (23 tests | 1 failed) 21ms
       × zh_cn and en_us use the same set of {…} placeholder names for each of these keys 4ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/i18n/messageSyntax.test.ts > i18n message syntax > P5b Task 1 aiKb* keys — punctuation and placeholder guards > zh_cn and en_us use the same set of {…} placeholder names for each of these keys
AssertionError: Found mismatched {…} placeholder names between locales:
aiKbClearedNFailed: zh=[n] en=[count]

      Tests  1 failed | 22 passed (23)
```

**判定**:精确报红 1 条,报出的键名 `aiKbClearedNFailed` 与实际改动的键完全对应,zh=[n] en=[count] 的诊断信息准确。

**已改回**:`pnpm exec vitest run src/i18n/messageSyntax.test.ts` 恢复 23/23 全绿。

### 探针 3:从键列表删一条,「exactly N keys」报红

**改动**:从 `messageSyntax.test.ts` 的 `p5bTask1Keys` 数组末尾删掉 `'aiKbStatusIndexing'`(数组变成 99 项)。

**报红**:
```
 ❯ src/i18n/messageSyntax.test.ts (23 tests | 1 failed) 23ms
       × covers exactly the 100 keys this task added (list itself does not drift) 6ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/i18n/messageSyntax.test.ts > i18n message syntax > P5b Task 1 aiKb* keys — punctuation and placeholder guards > covers exactly the 100 keys this task added (list itself does not drift)
AssertionError: expected 99 to be 100 // Object.is equality

- Expected
+ Received

- 100
+ 99

      Tests  1 failed | 22 passed (23)
```

**判定**:精确报红 1 条,`99 to be 100` 的诊断准确对应删除的那 1 项。

**已改回**:`git diff` 对 `messageSyntax.test.ts` 为空(逐字节核对),`pnpm exec vitest run src/i18n/messageSyntax.test.ts` 恢复 23/23 全绿。

三次探针后 `git status` 干净(无未提交改动残留),`pnpm test` 全量重跑仍 313/2878 全绿(见 §4)。

## 4. 三门实测数字

```
pnpm test                   → Test Files 313 passed (313) / Tests 2878 passed (2878), exit=0
pnpm exec vue-tsc --noEmit  → exit=0(无输出)
pnpm build                  → exit=0(仅既有第三方包警告 + >500KB chunk 警告,无错误)
```

**基线对照**:协调者给的基线是 313 文件 / 2872 例。实测 313 文件(+0,符合"不新增 `.vue`/测试文件"的预期)/
2878 例(+6)。

**+6 的构成**(全部来自 `messageSyntax.test.ts` 本次新增的 6 条 `it`,无其它文件贡献新用例):
1. `covers exactly the 100 keys this task added`
2. `registers exactly the 15 full-width-punctuation exceptions`
3. `pins the exact zh_cn value … for each of the 15 registered exceptions`
4. `should not contain full-width ，；：？！（） …`
5. `covers exactly the 20 keys … interpolation placeholders`
6. `zh_cn and en_us use the same set of {…} placeholder names …`

brief 预期 +3~5,实测 +6,差 1~3 条的原因:brief 给的 (a)/(b)/(c) 三条守卫描述里,(a) 全角标点那条
在本任务被拆成了三个独立断言(例外表键数 / 例外表逐值 toBe / 主扫描),而不是"一条断言"—— 这是为了
落实 brief 原文「例外一律写成 toBe 钉死确切值的强断言,不是跳过扫描的松形式」这句硬要求:如果只写一条
"扫描 + 例外跳过"的断言,例外值本身改错了也不会报红(探针 1 就是专门验证这一点)。所以多出来的 1~3 条
不是误算,是把"强断言"要求拆成了可独立报红、职责单一的多条用例。

已知噪声:本次跑没有出现 `persist.test.ts` 的 IndexedDB flaky 或 `AgentComposer.test.ts` 的 teardown 竞态,
两门都全绿,不需要复跑。

## 5. 键数账(逐附录 A 数)

```
A.0 复用       9   (aiKbJustNow/aiKbMinAgo/aiKbHrAgo/aiKbDaysAgo/aiKbPending/aiKbRunning/
                     aiKbFailed/aiKbStatus/aiKbMore —— 本任务未重写,先 grep 核实值未变,见 §6)
A.1 主表      95   (全部有 Vue2 权威 zh 值,逐码点比对 95/95 MATCH)
A.2 本期新造   4   (aiKbQueueAllPendingDone/aiKbQueueNoRunningNow — K16;
                     aiKbRetriedAllFailed — K18;aiKbLoadErrorBody — K19)
A.4 T0 追加    1   (aiKbStatusIndexing — K20)
----------------------------------------------------------------
新增合计     100
判定死键不落   2   (`Retrying {n} failed jobs` / `Retried {n} selected jobs`,见 §7)
```

## 6. 复用键复核(A.0 九条,未重写)

落笔前 `grep -n "aiKbJustNow\|aiKbMinAgo\|aiKbHrAgo\|aiKbDaysAgo\|aiKbPending\|aiKbRunning\|aiKbFailed\|aiKbStatus:\|aiKbMore" src/i18n/{zh_cn,en_us}.ts`,
确认这 9 条现有值与附录 A §A.0 给出的值逐字相同(行号也对得上:`zh_cn.ts:1419/1427/1441-1444/1499-1501`,
`en_us.ts:1409/1417/1431-1434/1489-1491`),未重复定义(重复属性会是 TS 编译错误,`vue-tsc` 0 错也间接印证)。

## 7. 死键判定(A.7 两条,未落)

`Retrying {n} failed jobs`(`QueueView.vue:324`)与 `Retried {n} selected jobs`(`QueueView.vue:345`)**未落入语言包**。

**理由**(K18 的连带效应):本批设计已授权 K18 —— `retryOne`/`bulkRetry`/`retryAllFailed` 三个重试入口
在 New-UI 里统一改成真发 `store.retryFailed(null)`,toast 统一显示 `aiKbRetriedAllFailed`(已在本任务落地,
即上表 A.2 的一条)。K18 生效后,原蓝本里那两条"报数量"的重试文案(`Retrying {n} failed jobs`/
`Retried {n} selected jobs`)在 New-UI 代码里**没有任何调用点会引用它们**——它们是纯粹的 Vue2 遗留死文案,
落进语言包只会制造两个永远用不到的 key。故按附录 A §A.7 的判定,本任务不落这两条。

(重试三入口的模板/组件实现属于后续 T5,本任务只是提前确认这两条键不需要预留。)

## 8. 全角标点例外(A.5,15 条)

已全部按 brief 要求写成 `toBe` 强断言(见 §1.3 的第 3 条),不是跳过扫描的松形式。15 条:

`aiKbClearFailedConfirmTitle` · `aiKbLoadErrorBody` · `aiKbLoadErrorLabel` · `aiKbNoFailedJobs` ·
`aiKbNoMatchSub` · `aiKbOverExplicitCap` · `aiKbPollTip` · `aiKbRebuildAllBody1` ·
`aiKbRebuildAllBody2` · `aiKbRebuildAllOverCap` · `aiKbRebuildAllTitle` · `aiKbRebuildCapHint` ·
`aiKbShowingFirst200` · `aiKbTombstonedTip` · `aiKbZeroVecTip`

与计划书原稿(11 条,含 1 条假阳性 `aiKbClearFailedConfirmBody`、漏 5 条)不同,已按附录 A §A.5 的实扫结果订正。

## 9. 占位符一致性(A.6,20 条)

已在 `messageSyntax.test.ts` 里断言两档占位符名称集合一致(见 §1.3 第 5/6 条),20 条键与附录 A §A.6 逐一对应,
未做任何调整。

## 10. 偏离申报(K1–K20 / N1–N14 命中项)

本任务只碰 i18n 三文件,不涉及组件/store/scss,**命中 K16/K18/K19/K20 四条**(仅体现在"落哪些键、
不落哪两条死键"上,行为逻辑本身在 T5/T9 才真正实现):
- **K16**:`aiKbQueueAllPendingDone`/`aiKbQueueNoRunningNow` 两键落地,两档同填英文原文
- **K18**:`aiKbRetriedAllFailed` 落地;连带判定两条死键不落(§7)
- **K19**:`aiKbLoadErrorBody` 落地,两档值见 §5 A.2
- **K20**:`aiKbStatusIndexing` 落地,两档同填 `Indexing`

未命中任何 N1-N14(本任务不涉及组件代码/CSS 类)。未做任何未授权偏离。

## 11. 使用的 fixture / mock 形状

本任务不涉及 API 调用或组件渲染,**未使用任何 fixture 文件**。

## 12. 提交

```
git add -f src/i18n/zh_cn.ts src/i18n/en_us.ts src/i18n/messageSyntax.test.ts \
           .superpowers/sdd/p5b-task-1-i18n-verify.mjs \
           .superpowers/sdd/p5b-task-1-report.md
git commit -m "..."
```

`git show --stat HEAD` 应只列这 5 个文件;`git status` 提交后应干净。

## 13. 遗留疑问

无。100 键落地、2 死键判定、15 例外、20 占位符、95 逐码点比对全部按附录 A 权威值完成,
三门全绿,三次 RED 探针均精确报红并已改回。
