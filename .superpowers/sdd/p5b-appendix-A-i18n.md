# P5b 附录 A —— i18n 键表(新增 **100** 条 `aiKb*` + 复用 **9** 条既有键)

> **权威源**:zh 值一律 `git show main:src/assets/lang/zh_CN.json`(Vue2 `main`@`7a6ee6b7`)。
> 本表的 95 条 zh 值是 **T0 用脚本从该 JSON 逐 `codePointAt` 导出**的,不是手抄 —— 
> 承 P5a T8 教训(附录零差异,手抄进 TS 时引入 5 处全角标点错)。
> en 值 = Vue2 里那个 `$t()` 的英文原 key,逐字相同。

## 🔴 与计划书 §6 的四处不同(T0 回源核出,详见 `p5b-common-constraints.md` §12)

1. **总数是 100 不是 99** —— 计划书漏了 `aiKbStatusIndexing`(见 A.4)。
2. **计划书说「Vue2 无源」的那 6 条,Vue2 语言包里全都有**,且其中 **3 条的 zh 值与计划书自拟的不同**。
   本表一律用语言包实际值(见 A.3)。
3. **A.1 的分类改了**:95 条**全部**有 Vue2 权威 zh 值(不是计划书说的 89 + 6)。
4. **全角标点例外清单是 15 条不是 11 条**(见 A.5),计划书那份有 1 条假阳性 + 5 条漏。

## A.0 复用 P5a 既有键(9 条,**不重复定义**)

| 复用键 | Vue2 英文原串 | 现有 zh 值 | 现有 en 值 | 落地位置(T0 已核) | 用在 |
|---|---|---|---|---|---|
| `aiKbJustNow` | `just now` | 刚刚 | just now | zh_cn.ts:1441 / en_us.ts:1431 | `fmtRel`(T7) |
| `aiKbMinAgo` | `{m} min ago` | {m} 分钟前 | {m} min ago | zh_cn.ts:1442 / en_us.ts:1432 | `fmtRel`(T7) |
| `aiKbHrAgo` | `{h} hr ago` | {h} 小时前 | {h} hr ago | zh_cn.ts:1443 / en_us.ts:1433 | `fmtRel`(T7) |
| `aiKbDaysAgo` | `{d} days ago` | {d} 天前 | {d} days ago | zh_cn.ts:1444 / en_us.ts:1434 | `fmtRel`(T7) |
| `aiKbPending` | `Pending` | 待处理 | Pending | zh_cn.ts:1499 / en_us.ts:1489 | QueueView pill |
| `aiKbRunning` | `Running` | 运行中 | Running | zh_cn.ts:1500 / en_us.ts:1490 | QueueView pill |
| `aiKbFailed` | `Failed` | 已失败 | Failed | zh_cn.ts:1501 / en_us.ts:1491 | QueueView pill / distill 徽标 |
| `aiKbStatus` | `Status` | 状态 | Status | zh_cn.ts:1419 / en_us.ts:1409 | 两页表头 |
| `aiKbMore` | `More` | 浏览更多 | More | zh_cn.ts:1427 / en_us.ts:1417 | 展开按钮 title |

> 这 9 条的现有值 T0 已 `grep` 核过与 Vue2 语言包逐字相同,**T1 不要重写**(重复属性 = TS 错误)。

## A.1 新增主表(95 条,zh 值全部有 Vue2 权威源)

`⚠️N` = **Vue2 语言包自身的错译或同值撞车,照抄不改,改了就是回归**。

🔴 **口径:9 行 / 7 组。** 9 行带 `⚠️N` 标记(#18 #24 #47 #48 #55 #84 #85 #91 #92),
其中 **(#24, #84) 同为「向量数」**、**(#91, #92) 同为「累计完成」** 各算一组撞车,
所以是 **5 个单独的错译 + 2 组同值撞车 = 7 个独立问题**。
(计划书 §6 A.1 脚注写「共 8 处」,并列了 9 个编号 —— 8 这个数字两种口径下都对不上,已订正。)
**每一行都写了理由**,§11.2 要求评审「专查这一条」时按理由逐条判。
`全角 X` = 该 zh 值含 `[，；：？！（）]` 里的字符,是 A.5 全角守卫的登记例外。

| # | 键名 | Vue2 英文原串(= en 值) | zh 值(逐字) | 标记 |
|---|---|---|---|---|
| 1 | `aiKbAll` | `All` | 全部 |  |
| 2 | `aiKbAllCaughtUp` | `All caught up` | 全部处理完了 |  |
| 3 | `aiKbCancel` | `Cancel` | 取消 |  |
| 4 | `aiKbCancelFailed` | `Cancel failed` | 取消失败 |  |
| 5 | `aiKbCancelSelected` | `Cancel selected` | 取消选中 |  |
| 6 | `aiKbCancelled` | `Cancelled` | 已取消 |  |
| 7 | `aiKbCancelledNSelected` | `Cancelled {n} selected jobs` | 已取消选中的 {n} 个任务 |  |
| 8 | `aiKbCannotCancel` | `This job can no longer be cancelled.` | 该任务已无法取消。 |  |
| 9 | `aiKbClear` | `Clear` | 清除 |  |
| 10 | `aiKbClearFailedConfirmBody` | `This will permanently remove all {n} failed records.` | 这将永久删除 {n} 条失败记录。 |  |
| 11 | `aiKbClearFailedConfirmTitle` | `Clear failed records?` | 清空失败记录？ | 全角 `？` |
| 12 | `aiKbClearFailedErr` | `Clear failed` | 清空失败 |  |
| 13 | `aiKbClearFailedRecords` | `Clear failed records` | 清空失败记录 |  |
| 14 | `aiKbClearFilters` | `Clear filters` | 清空筛选 |  |
| 15 | `aiKbClearSelected` | `Clear selected` | 清空选中 |  |
| 16 | `aiKbClearedNFailed` | `Cleared {n} failed records` | 已清空 {n} 条失败记录 |  |
| 17 | `aiKbClose` | `Close` | 关闭 |  |
| 18 | `aiKbColAction` | `Action` | 类型 | ⚠️N 表头「操作」列却译成「类型」,与 `Type` 撞车 |
| 19 | `aiKbColFile` | `File` | 文件 |  |
| 20 | `aiKbColPath` | `Path` | 路径 |  |
| 21 | `aiKbColSize` | `Size` | 大小 |  |
| 22 | `aiKbColTime` | `Time` | 时间 |  |
| 23 | `aiKbColType` | `Type` | 类型 |  |
| 24 | `aiKbColVectors` | `Vectors` | 向量数 | ⚠️N 表头「向量数」列;与 #84(`aiKbSortVectorCount`,排序下拉的 `Vector count`)**zh 值撞车**,英文却是两个不同串 |
| 25 | `aiKbConfirmClear` | `Confirm clear` | 确认清空 |  |
| 26 | `aiKbConfirmRebuildN` | `Confirm rebuild ({n})` | 确认重建 {n} 个 |  |
| 27 | `aiKbFailedOnly` | `Failed only` | 仅看失败 |  |
| 28 | `aiKbLegacy` | `Legacy` | 旧版 |  |
| 29 | `aiKbLegacyDoc` | `Legacy .doc` | 旧 .doc |  |
| 30 | `aiKbLegacyDocTip` | `Quick-filter legacy .doc files` | 一键圈出待修复的旧 .doc |  |
| 31 | `aiKbLoadErrorLabel` | `Load error:` | 加载失败： | 全角 `：` |
| 32 | `aiKbMonthsAgo` | `{n} months ago` | {n} 个月前 |  |
| 33 | `aiKbNFailedRecords` | `{n} failed records` | 显示 {n} 条失败记录 |  |
| 34 | `aiKbNIndexedFiles` | `{n} indexed files` | 共 {n} 个文件 |  |
| 35 | `aiKbNPendingJobs` | `{n} pending jobs` | 显示 {n} 个待处理任务 |  |
| 36 | `aiKbNRetried` | `{n}× retried` | {n}× 重试 |  |
| 37 | `aiKbNRunningJobs` | `{n} running jobs` | 显示 {n} 个处理中任务 |  |
| 38 | `aiKbNSelected` | `{n} selected` | 已选 {n} 项 |  |
| 39 | `aiKbNoFailedDistill` | `No failed distillation jobs.` | 没有沉淀失败的任务。 |  |
| 40 | `aiKbNoFailedJobs` | `No failed jobs — the index service is running normally.` | 全部正常，索引服务运行中。 | 全角 `，` |
| 41 | `aiKbNoMatchSub` | `No files match these filters. Try widening the path / type prefix, or switch status to All.` | 没有匹配的文件。试着放宽路径 / 类型前缀，或把状态切到「全部」。 | 全角 `，` |
| 42 | `aiKbNoMatchTitle` | `No matching files` | 没有匹配的文件 |  |
| 43 | `aiKbNoRunningJobs` | `No running jobs` | 暂无处理中任务 |  |
| 44 | `aiKbOriginAuto` | `Auto` | 自动 |  |
| 45 | `aiKbOriginManual` | `Manual` | 手动 |  |
| 46 | `aiKbOverExplicitCap` | `Exceeds {cap} limit — use rebuild-all instead` | 超过 {cap} 上限，请改用整库重建 | 全角 `，` |
| 47 | `aiKbPagerNext` | `Next` | 下一步 | ⚠️N 分页按钮译成「下一步」 |
| 48 | `aiKbPagerPrev` | `Previous` | 上一张 | ⚠️N 分页按钮译成「上一张」 |
| 49 | `aiKbPathPrefix` | `Path prefix` | 路径前缀 |  |
| 50 | `aiKbPerPage` | `Per page` | 每页 |  |
| 51 | `aiKbPollTip` | `Auto-refreshes every 30 s while rows are indexing` | 只要还有索引中的行，每 30 秒自动刷新 | 全角 `，` |
| 52 | `aiKbPolling` | `Auto-refreshing · 30s` | 自动刷新中 · 30s |  |
| 53 | `aiKbQueueEmpty` | `Queue is empty` | 队列为空 |  |
| 54 | `aiKbQueuedNJobs` | `Queued {n} jobs` | 已入队 {n} 个任务 |  |
| 55 | `aiKbRebuild` | `Rebuild` | 恢复 | ⚠️N 重建按钮译成「恢复」 |
| 56 | `aiKbRebuildAllBody1` | `Force-rebuild all {n} matching files — this may take several minutes.` | 将强制全部重新索引当前筛选匹配的 {n} 个文件，可能耗时数分钟。 | 全角 `，` |
| 57 | `aiKbRebuildAllBody2` | `The backend will tombstone then re-queue each file; old search content will be replaced.` | 后端会先墓碑再重新入队，旧的搜索内容会被新内容覆盖。 | 全角 `，` |
| 58 | `aiKbRebuildAllInRoot` | `Rebuild all in Root` | 重建该 Root 全部 |  |
| 59 | `aiKbRebuildAllOverCap` | `{n} files — exceeds the single-batch {cap} limit; the server may reject this (400). Narrow the path prefix and rebuild in batches.` | 共 {n} 个文件，超过单次 {cap} 上限，服务器可能会拒绝（400）。请缩小路径前缀后分批重建。 | 全角 `（），` |
| 60 | `aiKbRebuildAllTip` | `Rebuild the {n} files matching current filters` | 重建当前筛选匹配的 {n} 个文件 |  |
| 61 | `aiKbRebuildAllTitle` | `Rebuild entire matching set?` | 重建整个匹配集合？ | 全角 `？` |
| 62 | `aiKbRebuildCapHint` | `Rebuild exceeds the {cap} limit — narrow the path prefix and retry.` | 重建匹配文件超过 {cap} 上限，请用更精确的路径前缀缩小范围后分批重建 | 全角 `，` |
| 63 | `aiKbRebuildFailed` | `Rebuild failed` | 重建失败 |  |
| 64 | `aiKbRebuildRowTip` | `Force rebuild this row` | 强制重建本行 |  |
| 65 | `aiKbRebuildSelectedN` | `Rebuild selected ({n})` | 重建选中 ({n}) |  |
| 66 | `aiKbRebuilding` | `Rebuilding…` | 重建中… |  |
| 67 | `aiKbRequeued` | `Requeued` | 已重新加入队列 |  |
| 68 | `aiKbRetry` | `Retry` | 重试 |  |
| 69 | `aiKbRetryAllFailed` | `Retry all failed` | 重试所有失败的 |  |
| 70 | `aiKbRetryFailedErr` | `Retry failed` | 重试失败 |  |
| 71 | `aiKbRetrySelected` | `Retry selected` | 重试选中 |  |
| 72 | `aiKbRoot` | `Root` | 存储根 |  |
| 73 | `aiKbScopeDistill` | `Document distillation` | 文档沉淀 |  |
| 74 | `aiKbScopeIndex` | `File indexing` | 文件索引 |  |
| 75 | `aiKbSelectAllTip` | `Select all selectable rows on this page` | 全选当前页可选行 |  |
| 76 | `aiKbSelectFilesHint` | `Select files to force-rebuild` | 勾选文件后可批量强制重建 |  |
| 77 | `aiKbShowingFirst200` | `Showing first 200 — bulk action still covers all.` | 仅展示前 200 条；批量操作仍会处理全部。 | 全角 `；` |
| 78 | `aiKbShowingFirstN` | `Showing first {n} — narrow the filter to see the rest.` | 仅展示前 {n} 条;缩小筛选范围可查看其余记录。 |  |
| 79 | `aiKbShowingRange` | `Showing {from}–{to} of {total}` | 显示 {from}–{to} / {total} |  |
| 80 | `aiKbSkipped` | `Skipped` | 已跳过 |  |
| 81 | `aiKbSortAsc` | `Ascending` | 升序 |  |
| 82 | `aiKbSortDesc` | `Descending` | 降序 |  |
| 83 | `aiKbSortIndexTime` | `Index time` | 索引时间 |  |
| 84 | `aiKbSortVectorCount` | `Vector count` | 向量数 | ⚠️N **与 #24(`aiKbColVectors`)zh 值同**(排序下拉项 vs 表头列名) |
| 85 | `aiKbStatusActive` | `Active` | 已启用 | ⚠️N 这里的 `Active` 是**状态筛选值「未删除/存活」**(N12:UI `active` ↔ API `alive`),与「启用/停用」毫无关系,译成「已启用」是语义错 |
| 86 | `aiKbStatusError` | `Error` | 错误 |  |
| 87 | `aiKbStatusIndexed` | `Indexed` | 已收录 |  |
| 88 | `aiKbStatusRemoved` | `Removed` | 已删除 |  |
| 89 | `aiKbTombstonedNoSelect` | `Tombstoned files cannot be selected` | 已删除文件不可选 |  |
| 90 | `aiKbTombstonedTip` | `Deleted — rescan to restore` | 已删除，需 rescan 复活 | 全角 `，` |
| 91 | `aiKbTotalDone` | `Total done:` | 累计完成 | ⚠️N 英文**带冒号**,中文却不带;且与 #92 zh 值同 |
| 92 | `aiKbTotalDoneLabel` | `Total done` | 累计完成 | ⚠️N **与 #91(`aiKbTotalDone`)zh 值同**,英文一个带冒号一个不带 |
| 93 | `aiKbTypePrefix` | `Type prefix` | 类型前缀 |  |
| 94 | `aiKbZeroVec` | `No searchable content` | 无可搜索内容 |  |
| 95 | `aiKbZeroVecTip` | `Indexed but has no searchable content (not an error)` | 已索引但没有可搜索内容（不是错误） | 全角 `（）` |

## A.2 本期新造 4 条(Vue2 语言包确认无此 key,T0 已核)

| 键名 | zh 值 | en 值 | 来源 |
|---|---|---|---|
| `aiKbQueueAllPendingDone` | `All pending jobs are done.` | `All pending jobs are done.` | **K16** —— 蓝本 `QueueView.vue:96` 硬编码英文;**两档同填英文原文**,渲染与 Vue2 逐字相同 |
| `aiKbQueueNoRunningNow` | `No jobs running right now.` | `No jobs running right now.` | **K16** —— 同上,同一行三元表达式的另一支 |
| `aiKbRetriedAllFailed` | 已重试全部失败任务 | Retried all failed jobs | **K18** —— 三个重试入口统一 toast |
| `aiKbLoadErrorBody` | 无法读取已收录文件列表，请稍后重试。 | Could not load the indexed file list. Please try again. | **K19** —— 不回显 `e.message` 的替代文案 |

## A.3 🔴 计划书判为「Vue2 无源」但实际有源的 6 条(T0 订正)

计划书 §6 A.1 给这 6 条标了 `**Vue2 无 →**` 并自拟了 zh 值。实测 `zh_CN.json` **全部命中**,
其中 3 条自拟值与语言包不同。**A.1 主表用的是语言包值**,下面是对照,评审按这张表核:

| 键名 | Vue2 英文原串 | 计划书自拟 zh | 语言包实际 zh(**本表采用**) | 是否不同 |
|---|---|---|---|---|
| `aiKbScopeDistill` | `Document distillation` | 文档沉淀 | 文档沉淀 | 同 |
| `aiKbScopeIndex` | `File indexing` | 文件索引 | 文件索引 | 同 |
| `aiKbNoFailedDistill` | `No failed distillation jobs.` | 没有失败的沉淀任务。 | **没有沉淀失败的任务。** | 🔴 不同 |
| `aiKbShowingFirstN` | `Showing first {n} — narrow the filter to see the rest.` | 仅展示前 {n} 条；缩小筛选范围可看到其余。 | **仅展示前 {n} 条;缩小筛选范围可查看其余记录。** | 🔴 不同(且分号是**半角** `;` U+003B) |
| `aiKbSkipped` | `Skipped` | 已跳过 | 已跳过 | 同 |
| `aiKbCannotCancel` | `This job can no longer be cancelled.` | 这个任务已经不能取消了。 | **该任务已无法取消。** | 🔴 不同 |

> ⚠️ `aiKbShowingFirstN` 用**半角分号** `;`(U+003B),而 `aiKbShowingFirst200` 用**全角分号** `；`(U+FF1B)。
> 两条文案高度相似但标点不同,是 Vue2 语言包的现状,**照抄**。这也是 A.5 里前者不在例外清单、后者在的原因。

## A.4 🔴 T0 追加的第 100 条(计划书整条漏掉)

| 键名 | zh 值 | en 值 | 依据 |
|---|---|---|---|
| `aiKbStatusIndexing` | `Indexing` | `Indexing` | **K20**,见下 |

**为什么必须加**:蓝本 `IndexedFilesView.vue:197` 是全批**唯一**一处 `$t()` 传非字面量参数 ——
`$t(statusBadgeMap[file.status].en)`。`statusBadgeMap`(蓝本 `:573-580`)四个状态的 `.en` 是
`Indexed` / `Indexing` / `Error` / `Removed`。前后三个在计划书附录 A 里都有
(`aiKbStatusIndexed` / `aiKbStatusError` / `aiKbStatusRemoved`),**只有 `Indexing` 没有** ——
因为它不是字面量 `$t('...')`,计划书的抽取脚本扫不到。

`Indexing` 在 Vue2 `zh_CN.json` 里**也不存在**(T0 已核)→ Vue2 里 vue-i18n 回落显示英文原串 `Indexing`。
**两档同填 `Indexing`**,渲染与 Vue2 逐字相同 —— 与 K16 完全同一个模具。

🔴 **这个状态在本机是最常见的一个**:8 个已收录文件里 **5 个是 `indexing`**(T0 实测,
见 `p5b-fixtures/files-all-8.json`)。漏了它页面上五行全是坏的。

🔴 **T9 落地时同时看治理文件 §3.5 的 N14** —— `statusBadgeMap` 的 `en` 是**一物两用**:
蓝本 `:191` 的 `:title` 用**未翻译的原始英文**、`:197` 的徽标文字用 `$t(同一个 en)` 的**中文**。
New-UI 键名是 `aiKb*`,Vue2 那个「英文原串即 i18n key」的巧合不成立 →
**map 每个状态必须同时留 `en`(只给 `title`)与 `key`(只给徽标文字)两个字段,不许合并**。
所以本键的落地形态是 `indexing: { en: 'Indexing', key: 'aiKbStatusIndexing', … }`:
`title` 渲染 `Indexing`(原始英文)、徽标文字渲染 `$t('aiKbStatusIndexing')` = 也是 `Indexing`(两档同填英文)
→ 与 Vue2 逐字相同。

## A.5 全角标点守卫的例外清单(T1 用,**15 条**)

T1 要在 `messageSyntax.test.ts` 里对**本批 100 键**加全角标点扫描 `/[，；：？！（）]/`。
下面 15 条是 zh 值真的含这些字符的,**一律写成 `toBe` 钉死确切值的强断言**,不是「跳过扫描」的松形式。
其余 85 条必须扫不出全角标点。

> 🔴 计划书 §2 T1 第 4(a) 条给的 11 条例外清单是**错的**:`aiKbClearFailedConfirmBody`
> 是假阳性(它只有 `。`,不在正则里),另外漏了 5 条真会命中的。照它写守卫会当场红 5 条。
> 注意 `。`(U+3002)、`「」`(U+300C/300D)、`·`(U+00B7)、`—`(U+2014)、`…`(U+2026)、`×`(U+00D7)
> **都不在** `/[，；：？！（）]/` 里,不要按「看着像全角」来判。

| 键名 | zh 值 | 命中的全角字符 |
|---|---|---|
| `aiKbClearFailedConfirmTitle` | 清空失败记录？ | `？` |
| `aiKbLoadErrorBody` | 无法读取已收录文件列表，请稍后重试。 | `，` |
| `aiKbLoadErrorLabel` | 加载失败： | `：` |
| `aiKbNoFailedJobs` | 全部正常，索引服务运行中。 | `，` |
| `aiKbNoMatchSub` | 没有匹配的文件。试着放宽路径 / 类型前缀，或把状态切到「全部」。 | `，` |
| `aiKbOverExplicitCap` | 超过 {cap} 上限，请改用整库重建 | `，` |
| `aiKbPollTip` | 只要还有索引中的行，每 30 秒自动刷新 | `，` |
| `aiKbRebuildAllBody1` | 将强制全部重新索引当前筛选匹配的 {n} 个文件，可能耗时数分钟。 | `，` |
| `aiKbRebuildAllBody2` | 后端会先墓碑再重新入队，旧的搜索内容会被新内容覆盖。 | `，` |
| `aiKbRebuildAllOverCap` | 共 {n} 个文件，超过单次 {cap} 上限，服务器可能会拒绝（400）。请缩小路径前缀后分批重建。 | `（），` |
| `aiKbRebuildAllTitle` | 重建整个匹配集合？ | `？` |
| `aiKbRebuildCapHint` | 重建匹配文件超过 {cap} 上限，请用更精确的路径前缀缩小范围后分批重建 | `，` |
| `aiKbShowingFirst200` | 仅展示前 200 条；批量操作仍会处理全部。 | `；` |
| `aiKbTombstonedTip` | 已删除，需 rescan 复活 | `，` |
| `aiKbZeroVecTip` | 已索引但没有可搜索内容（不是错误） | `（）` |

## A.6 占位符清单(T1 的两档占位符一致性守卫,20 条)

T0 已用脚本核过:这 20 条的 zh / en 占位符集合**逐一相同**,零差异。

| 键名 | 占位符 |
|---|---|
| `aiKbCancelledNSelected` | `{n}` |
| `aiKbClearFailedConfirmBody` | `{n}` |
| `aiKbClearedNFailed` | `{n}` |
| `aiKbConfirmRebuildN` | `{n}` |
| `aiKbMonthsAgo` | `{n}` |
| `aiKbNFailedRecords` | `{n}` |
| `aiKbNIndexedFiles` | `{n}` |
| `aiKbNPendingJobs` | `{n}` |
| `aiKbNRetried` | `{n}` |
| `aiKbNRunningJobs` | `{n}` |
| `aiKbNSelected` | `{n}` |
| `aiKbOverExplicitCap` | `{cap}` |
| `aiKbQueuedNJobs` | `{n}` |
| `aiKbRebuildAllBody1` | `{n}` |
| `aiKbRebuildAllOverCap` | `{cap}` `{n}` |
| `aiKbRebuildAllTip` | `{n}` |
| `aiKbRebuildCapHint` | `{cap}` |
| `aiKbRebuildSelectedN` | `{n}` |
| `aiKbShowingFirstN` | `{n}` |
| `aiKbShowingRange` | `{from}` `{to}` `{total}` |

> 其余 80 条零占位符。全表无字面 `@`,不需要 `{'@'}` 转义。
> 🔴 守卫**只圈本批 100 键**,不许全量(既有 `aiResTurn`/`aiResFilesInTurns` 的两档占位符
> 不一致是有意设计,`{s}` 是英文复数后缀)。

## A.7 判定为死键,**不入语言包**(2 条)

| Vue2 英文原串 | Vue2 zh 值(仅供核对,**不要落**) | 蓝本行 | 为什么不落 |
|---|---|---|---|
| `Retrying {n} failed jobs` | 已重试 {n} 个失败任务 | `QueueView.vue:324` | K18 后 `retryAllFailed` 改用 `aiKbRetriedAllFailed`,无引用 |
| `Retried {n} selected jobs` | 已重试选中的 {n} 个任务 | `QueueView.vue:345` | K18 后 `bulkRetry` 改用 `aiKbRetriedAllFailed`,无引用 |

> T1 报告要显式说明为什么不落(P5a 终审会查「死 i18n 键 0/N」)。

## A.8 计数自检(T1 提交前照跑)

```
A.0 复用       9   (不新增)
A.1 主表      95   (全部有 Vue2 权威 zh 值)
A.2 本期新造   4
A.4 T0 追加    1   (aiKbStatusIndexing)
----------------------
新增合计     100   ← messageSyntax.test.ts 的「exactly N keys」防漂移断言用这个数

去重 i18n 串来源核对(T0 实测):
  两个蓝本 .vue 里 $t('字面量')  distinct = 105
  + i18n.t('{n} months ago')(只在 script 里,不是 $t)  = 1
  + $t(非字面量) 展开出的 Indexing              = 1
  ----------------------------------------------
  distinct 合计 = 107 = 9 复用 + 95 主表 + 2 死键 + 1 (Indexing)
  再加 A.2 的 4 条本期新造 → 落地 100 条新键
```

