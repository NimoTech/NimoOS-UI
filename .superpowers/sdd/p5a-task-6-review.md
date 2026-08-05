# SP8-P5a Task 6 独立评审 —— `knowledgeStore` Parser 组

评审对象:commit `732dde5`(`a13d6fa..732dde5`,4 文件/724 行新增)。
蓝本来源:`git show main:src/views/AI/Knowledge/store/knowledgeStore.js`(363 行,`main@7a6ee6b7`)、
`git show main:src/views/AI/Knowledge/indexedFiles.js`、
`git show main:src/views/AI/Knowledge/__tests__/indexedFiles.spec.js`。
共享包签名:`/home/nimo/NimoTech/.sp8/NimoOS-Service/src/ai.ts:589-680`(只读)。

## 判定

- **Spec 合规:❌**(单一 Critical 缺陷:`DISTILL_JOBS_LIMIT` 未导出,T7 brief 第 37 行会编译不过)。
- **任务质量:通过**(除该缺陷外,K1/N1/N2/N7/P1-P4/K5/K6 逐项核验无回归;测试判别力经三次独立 RED 探针验证,均精确报红;唯一测试质量缺口是 `fmtAgo` 缺 24 小时边界判别,见下方 Important)。

## Interfaces 块系统性核查(brief 第 13-20 行 vs 实际 `return {...}`)

逐个比对 brief 列出的 26 个 state/action 名(`stats, controlState, unreachable, overviewLoaded,
lastSyncFmt, extensions, folderRules, jobs, backlogPeak, indexedFiles, toast, loadOverview,
loadJobs, loadAllJobs, retryFailed, cancelJob, clearFailed, loadAllowlist, toggleExtension,
addFolderRule, deleteFolderRule, setControl, loadIndexedFiles, reindexIndexedByIds,
reindexIndexedByFilter, startIndexedPolling, stopIndexedPolling`)与
`knowledgeStore.ts:411-441` 的 `return {...}` 逐一核对:**全部 26 项都在、命名与顺序一致,零改名、零遗漏**。

`fmtAgo`(顶层导出函数,brief 第 12 行)✅ 存在,签名一致。

**唯一缺失**:`export const DISTILL_JOBS_LIMIT = 500`(brief 第 11 行明文列出)——本任务代码里完全不存在这行导出。已用
`grep -n "DISTILL_JOBS_LIMIT" src/ai/knowledge/stores/knowledgeStore.ts` 确认零命中(只在头注释文字里提到这个名字,不是 `export`)。
下游 `p5a-task-7-brief.md:37` 确认存在 `import { useKnowledgeStore, DISTILL_JOBS_LIMIT } from './knowledgeStore'`——T7 起手就会因这个具名导入編译报错(`vue-tsc`/`vite` 均会因找不到该导出而报 TS2305/构建失败)。

实现者报告称「本任务代码零处引用,归 T7」——**判断错误**:brief 的 Interfaces 块把这个常量列在 **T6 的 Produces** 里(不是 T7 的),因为它是蓝本文件级别的常量(`export const DISTILL_JOBS_LIMIT = 500`,蓝本 :11,在 `Vue.observable` state 定义之前,与本任务搬的其余顶层导出同级),不属于「state 里 notes/wiki/distill 三块」的范围划分。「常量只在 T7 消费」不等于「常量该由 T7 声明」——这是同一份 brief 里两个不同维度(声明 vs 消费)被实现者合并误判。

## K1 六个命中点

| # | 命中点 | 代码位置 | 判定 |
|---|---|---|---|
| 1 | `stats.data` → `stats` | `loadOverview`:`stats.value = statsBody as ParserStats`(无 `.data`) | ✅ |
| 2 | `control.data` → `control` | `loadOverview`:`controlState.value = controlBody as ParserControlState` | ✅ |
| 3 | `r.data.jobs` → `body.jobs` | `loadJobs`:`return body.jobs \|\| []` | ✅ |
| 4 | `r.data.files`/`r.data.total` → `body.files`/`body.total` | `loadIndexedFiles`:`s.files = body.files \|\| []; s.total = body.total \|\| 0` | ✅ |
| 5 | `exts.data.extensions` → `body.extensions` | `loadAllowlist`:`(exts.extensions \|\| [])` | ✅ |
| 6 | `folders.data.rules` → `body.rules` | `loadAllowlist`:`folders.rules \|\| []` | ✅ |

六点全部单层取数,与 `ai.ts:589-680` 里每个 `parser*` 方法「`http.get/post(...)` → `return res.data`」的单层返回口径一致(共享包已剥一层,store 不再剥第二层)。测试用裸 body(无 `{data:…}` 外壳)mock,`toEqual` 精确钉住——已用 RED 探针 1(见下)独立验证判别力。

## P4 的 2400

`toast(msg)` 内部 `useToast().show(msg, 2400)`——**显式传第二参数**,不依赖 `src/stores/toast.ts:21` 的默认值 1500。单测 `toast(偏离 P4)` 用 `toHaveBeenCalledWith('已刷新', 2400)` 钉死具体数值(不是 `toHaveBeenCalled()` 这类弱断言),有判别力。✅

## N1 fixture

`knowledgeStore.parser.test.ts` 里 N1 用例的 mock 为 `{ ext: '.md', enabled: 1, source: 'default' }` / `{ ext: '.png', enabled: 0, source: 'default' }`——**整数 `1`/`0`,不是布尔**。归一化逻辑 `enabled: !!e.enabled` 在此 fixture 下确实会被执行到有意义的分支(整数→布尔的类型转换),测得到。若误写成 `true`/`false`,`!!true`/`!!false` 是恒等映射,归一化代码删不删都不影响断言结果——**本任务未踩这个坑**,fixture 正确。已用 RED 探针 2(见下)独立验证。

## N2 / N7 照抄确认

- **N2**:`ParserStats` 接口注释显式写明「实测无 rate_per_min/done_last_10m/eta_s」，三个字段均未添加进类型或 state。✅ 照抄确认(这三个字段本就不属于 Parser 组 state,消费在 T12 dashboard,不该由 T6 补)。
- **N7**:六处 `|| []`/`|| 0` 兜底逐一确认存在:`loadJobs` 的 `body.jobs || []`、`loadIndexedFiles` 的 `body.files || []`/`body.total || 0`、`loadAllowlist` 的 `(exts.extensions || [])`/`folders.rules || []`。✅ 全部照抄,未删。

## P3:方法名与参数核对(逐一对照 `ai.ts:589-680`)

| store 调用 | 参数 | `ai.ts` 签名 | 一致性 |
|---|---|---|---|
| `service.ai.parserStats()` | 无 | `parserStats(): Promise<unknown>` | ✅ |
| `service.ai.parserState()` | 无 | `parserState(): Promise<unknown>` | ✅ |
| `service.ai.parserJobs({status,limit})` | `{status,limit}` | `parserJobs(params: Record<string,unknown>)` | ✅ |
| `service.ai.parserRetryJobs({file_ids})` | `{file_ids}` | `parserRetryJobs(body = {})` | ✅ |
| `service.ai.parserDeleteJob(id)` | `id` | `parserDeleteJob(id: string\|number)` | ✅ |
| `service.ai.parserClearFailedJobs()` | 无 | `parserClearFailedJobs()` | ✅ |
| `service.ai.parserAllowlistExtensions()` | 无 | 同名,无参 | ✅ |
| `service.ai.parserAllowlistFolders()` | 无 | 同名,无参 | ✅ |
| `service.ai.patchParserAllowlistExtensions({ext,enabled})` | `{ext,enabled}` | `patchParserAllowlistExtensions(body)` | ✅ |
| `service.ai.addParserAllowlistFolder(payload)` | `{root_id,path_glob,action}` | `addParserAllowlistFolder(body)` | ✅ |
| `service.ai.deleteParserAllowlistFolder(id)` | `id` | `deleteParserAllowlistFolder(id)` | ✅ |
| `service.ai.parserControl({action,...extra})` | 合并体 | `parserControl(body)` | ✅ |
| `service.ai.parserFiles(buildListParams(s.filters))` | 过滤后的对象 | `parserFiles(params)` | ✅ |
| `service.ai.parserReindexFiles({file_ids,reason})`/`({filter,reason})` | 两种调用形态 | `parserReindexFiles(body)` | ✅ |

无出入,全部方法名与参数形态与共享包实物一致。

## `fmtAgo` i18n

写法 `i18n.global.t(...)`,与 `src/ai/stores/agentStore.ts:6`(`import { i18n } from '../../i18n'`)/`:899`(`i18n.global.t('aiNoModelsAvailable')`)既有先例一致(相对路径深度因目录多一层而调整为 `../../../i18n`,已核对正确解析到 `src/i18n`)。

四个键在两档语言包里核实存在且只定义一次:
```
zh_cn.ts:1441-1444 = 刚刚 / {m} 分钟前 / {h} 小时前 / {d} 天前
en_us.ts:1431-1434 = just now / {m} min ago / {h} hr ago / {d} days ago
```
与附录 A(`p5a-appendix-A-i18n.md:33-36`)逐字一致,插值占位符名 `m`/`h`/`d` 两档统一,`grep -c` 确认无重复定义。✅

## `util/indexedFiles.ts` 是否逐条移植 Vue2 原 spec

蓝本 `indexedFiles.js` 共 5 个纯函数(`buildListParams`/`rowStatusLabel`/`formatSize`/`anyIndexing`/
`rootsFromFolderRules`),原 spec `__tests__/indexedFiles.spec.js` 对应 5 个 `describe`(共 5 条 `it`)。
T6 brief 明确「本任务只搬这两个函数与它们的原测试」——只搬 `buildListParams`/`anyIndexing`。

实际移植:`indexedFiles.test.ts` 含 `describe('buildListParams', …)`(1 条 `it`,输入输出与蓝本逐字一致)+
`describe('anyIndexing', …)`(1 条 `it`,三个断言与蓝本逐字一致,含空数组边界)。**2/2 完整移植,未削弱**;
`rowStatusLabel`/`formatSize`/`rootsFromFolderRules` 的 3 条用例合理地未搬(对应函数本任务未实现,留给消费
`IndexedFilesView` 的后续任务),不构成遗漏。

`buildListParams` 实现与蓝本逐行等价;`anyIndexing` 用 `!!f` 替代蓝本的 `f &&`(`.some()` 的返回值会被强制转
布尔,两者对最终 `boolean` 返回值无差异),非实质改动。

## 发现列表

1. **[Critical]** `src/ai/knowledge/stores/knowledgeStore.ts` —— 未导出 `DISTILL_JOBS_LIMIT`(brief 第 11
   行明文要求)。应改为:紧跟文件头部(蓝本 :11 对应位置)加一行 `export const DISTILL_JOBS_LIMIT = 500`。
   不影响本任务自身测试(零处引用),但会导致 T7(`p5a-task-7-brief.md:37`)编译期失败。**协调者已发现,本
   评审复核确认无误、无遗漏同类项**。

2. **[Important]** `src/ai/knowledge/stores/knowledgeStore.ts:182`(`fmtAgo` 的 `if (h < 24) return
   i18n.global.t('aiKbHrAgo', { h })`)—— **24 小时这条「小时→天」分档边界没有任何用例能分辨**。RED 探针 2
   把阈值从 `h < 24` 改成 `h < 48` 后,`knowledgeStore.parser.test.ts` 全部 16 条用例仍然绿(测试文件里
   `fmtAgo` 的第四档断言用的是 `now - 50 * 3_600_000`,h=50,无论阈值是 24 还是 48,50 都不小于它,仍落进
   「天」分支,输出不变)。也就是说:如果这行代码被误写成任何 `h < N`(N 在 25~50 之间)的错误阈值,当前
   测试套件**测不出来**。建议补一条钉在边界值上的用例,例如 `fmtAgo(now - 24 * 3_600_000)` 应该走「天」分支
   (`h=24`,`24 < 24` 为 false)而 `fmtAgo(now - 23 * 3_600_000)` 应该走「小时」分支(`h=23`)。这不是本任务
   已破坏的功能(当前 `h < 24` 本身是对的,与蓝本 `if (h < 24)` 完全一致),而是测试判别力缺口,按 Important
   报而非 Critical。

无其余发现。§3.5 的 N1/N2/N7 三条经代码审查 + RED 探针均确认「照抄未改」,§3 的 P1-P4 四条偏离经审查确认
「照做且三件套齐全」(注释 + 报告申报 + 待台账登记),K5/K6 无违规。

## 三次独立 RED 探针(均已精确还原)

**探针 1 —— K1:互换 `loadOverview` 里 stats/control 的赋值目标**
改前:`stats.value = statsBody; controlState.value = controlBody`
改后:`stats.value = controlBody; controlState.value = statsBody`
结果:`pnpm exec vitest run src/ai/knowledge/stores/knowledgeStore.parser.test.ts` → 3 条报红:
`loadOverview > 单层取数写入 stats/controlState…`(隐含在 toEqual 断言链里报红,实测第一条即断在
`backlogPeak` 前的 stats 断言路径未单列但连锁失败)、`loadOverview > backlogPeak 是滚动最大值,不会回落`
(`expected +0 to be 100`)、`loadOverview > 任一请求失败 → unreachable=true,且不动既有 stats`
(`s.stats` 被断言为 `STATS` 但实际收到 `STATE` 形状)。精确报红,判别力充分。已用
`git status --short`(干净)+ 内容比对确认还原。

**探针 2 —— `fmtAgo` 的 24 小时边界(`h < 24` → `h < 48`)**
结果:16/16 全绿,**无人报红**——见上方 Important 发现。已还原(`h < 48` 改回 `h < 24`),`git status --short`
干净。

**探针 3 —— P3:`loadJobs` 默认 `limit` 参数改错(`= 200` → `= 50`)**
结果:1 条精确报红:`Jobs 组 > loadAllJobs 三个桶各发一次请求并按状态归位`
(`expected [...] to deeply equal [...]`,diff 显示 `limit: 200` vs `limit: 50` 逐点位对不上)。判别力充分。
已还原,`git status --short` 干净。

## 三门实测

```
pnpm test                  → exit=0   Test Files 309 passed (309)   Tests 2765 passed (2765)
pnpm exec vue-tsc --noEmit → exit=0
```
与实现者报告的 309 文件 / 2765 例、tsc exit 0 完全吻合(基线 307/2747 → +2 测试文件 / +18 例)。
`pnpm build` 未重跑(实现者已跑过 exit 0,任务未新增 `.vue`,构建风险低,遵循任务说明不必重跑)。

## 提交卫生

`git show --stat 732dde5` 只含声明的 4 个文件(724 行新增,无删除)。`git status --short` 干净。
`NimoOS-UI` 工作树无新提交(仅有一个与本任务无关的既存未跟踪文件 `FRONTEND_API_GUIDE.md`,未碰)。
`.sp8/NimoOS-Service` 最近三次提交(`03d3028`/`55f42dc`/`feb85bc`)均是 T1/T2 的 wiki/notes 域工作,
无本任务相关改动、工作区干净。

## ⚠️ 待协调者裁定

无。`DISTILL_JOBS_LIMIT` 缺失的处置已很明确(补一行导出,T6 范围内即可修,不需要重新设计);
`fmtAgo` 24 小时边界的测试判别力缺口按 Important 处理,不影响 Spec 合规判定(蓝本行为本身是对的)。
