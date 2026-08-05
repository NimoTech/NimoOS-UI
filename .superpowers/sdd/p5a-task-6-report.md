# SP8-P5a Task 6 报告 —— `knowledgeStore` Parser 组

分支 `sp8-ai`,commit 见文末。

## 文件

- 新建 `src/ai/knowledge/stores/knowledgeStore.ts`
- 新建 `src/ai/knowledge/stores/knowledgeStore.parser.test.ts`
- 新建 `src/ai/knowledge/util/indexedFiles.ts`
- 新建 `src/ai/knowledge/util/indexedFiles.test.ts`

## 蓝本对照(`NimoOS-UI` main@7a6ee6b7,`git show main:src/views/AI/Knowledge/store/knowledgeStore.js`)

| 蓝本 | 行号 | New-UI |
|---|---|---|
| `DISTILL_JOBS_LIMIT` | :11 | **未搬**——只被 T7 的 distill 组消费,本任务代码零处引用;留给 T7 落地时加,避免在自己不使用的地方声明常量。 |
| `Vue.observable({state:{...}})` | :16-56 | 拆成一组 `ref`(见文件内「state」注释块) |
| `fmtAgo` | :60-69 | `fmtAgo`(逐字口径,i18n 改 `i18n.global.t`) |
| `toast` | :72-76 | `toast`(P4 偏离,见下) |
| `loadOverview` | :78-96 | `loadOverview` |
| `loadJobs` | :142-145 | `loadJobs` |
| `loadAllJobs` | :146-153 | `loadAllJobs` |
| `retryFailed` | :154-157 | `retryFailed` |
| `cancelJob` | :158-161 | `cancelJob` |
| `clearFailed` | :162-166 | `clearFailed` |
| `loadAllowlist` | :217-228 | `loadAllowlist`(N1 照抄) |
| `toggleExtension` | :229-232 | `toggleExtension` |
| `addFolderRule` | :233-237 | `addFolderRule` |
| `deleteFolderRule` | :238-241 | `deleteFolderRule` |
| `setControl` | :311-314 | `setControl` |
| `loadIndexedFiles` | :317-330 | `loadIndexedFiles` |
| `reindexIndexedByIds` | :332-336 | `reindexIndexedByIds` |
| `reindexIndexedByFilter` | :338-342 | `reindexIndexedByFilter` |
| `startIndexedPolling` | :344-353 | `startIndexedPolling`(P2 偏离) |
| `stopIndexedPolling` | :356-362 | `stopIndexedPolling`(P2 偏离) |

`indexedFiles.js`(`git show main:src/views/AI/Knowledge/indexedFiles.js`):`buildListParams`(:5-14)、`anyIndexing`(:32-34)→ 逐字搬到 `util/indexedFiles.ts`。`rowStatusLabel`/`formatSize`/`rootsFromFolderRules` 不属于本任务(展示层帮助函数,归消费视图的任务),未搬。

notes/wiki/distill 组(`setNotesDraftCount`/`refreshNotesDraftCount`/`loadNotesSummary`/`runSearch`/`loadChunkContext`/`loadDistillJobs`/`retryDistill`/`cancelDistill`/`loadRoots`/`loadCandidates`/`createRoot`/`deleteRoot`/`rescanRoot`/`loadWikiTree`/`loadWikiNode`/`loadWikiRaw`/`setRootEnabled`)**未搬**,留给 T7。

## K1 六个命中点逐个确认

1. `stats.data` → `stats`(`loadOverview`:`stats.value = statsBody as ParserStats`)✅ 测试 `expect(s.stats).toEqual(STATS)` 用裸 body mock 钉住。
2. `control.data` → `control`(`loadOverview`:`controlState.value = controlBody as ParserControlState`)✅ 同上。
3. `r.data.jobs` → `body.jobs`(`loadJobs`)✅ RED 探针 1 验证(见下)。
4. `r.data.files`/`r.data.total` → `body.files`/`body.total`(`loadIndexedFiles`)✅ 测试用裸 `{total,files}` mock 钉住。
5. `exts.data.extensions` → `body.extensions`(`loadAllowlist`)✅ 用裸 `{extensions:[...]}` mock 钉住。
6. `folders.data.rules` → `body.rules`(`loadAllowlist`)✅ 用裸 `{rules:[...]}` mock 钉住。

## N1/N2/N7 照抄确认

- **N1**:`loadAllowlist` 里 `enabled: !!e.enabled`,连蓝本注释一起搬(见代码 `loadAllowlist` 上方注释)。RED 探针 2 验证。
- **N2**:`ParserStats` 类型上方注释明写「实测无 rate_per_min/done_last_10m/eta_s」,未添加这三个字段(它们本就不属于本任务 state,dashboard 消费在 T12)。
- **N7**:`loadJobs` 对缺 `jobs` 键兜底 `[]`(蓝本 :144);`loadAllowlist`/`loadIndexedFiles` 同样对缺键响应兜底 `[]`/`0`。测试「缺键响应兜底成空数组」覆盖。

## 偏离申报

- **P1**(Vue.observable→Pinia setup store 机械替换):整份 state 拆成 `ref`,`actions.foo()` 互调(如蓝本 `loadAllJobs` 调 `this.loadJobs`)改成直接调本地函数 `loadJobs(...)`。等价物,非行为改动。
- **P2**(定时器句柄移出 state):`indexedFiles` state 不含 `pollTimer` 字段;模块级 `let indexedPollTimer` 替代。`startIndexedPolling` 里「已在轮询就不重复起」的守卫(`if (indexedPollTimer) return`)原样保留 —— RED 探针 3 验证。
- **P3**(两处直调 axios 改走包):本任务涉及的全部 `/ai/parser/*` 调用改为 `service.ai.parser*`(`parserStats`/`parserState`/`parserJobs`/`parserRetryJobs`/`parserDeleteJob`/`parserClearFailedJobs`/`parserAllowlistExtensions`/`parserAllowlistFolders`/`patchParserAllowlistExtensions`/`addParserAllowlistFolder`/`deleteParserAllowlistFolder`/`parserControl`/`parserFiles`/`parserReindexFiles`),签名逐一核对 `.sp8/NimoOS-Service/src/ai.ts:589-680`。（`notes` 的那处 P3 偏离属于 T7 范围,本任务未涉及。）
- **P4**(`.k-toast` 退役):`toast()` 保留为 action,内部 `useToast().show(msg, 2400)`,显式传 2400(不依赖默认值 1500);`state.toast` 字段未建。
- **K5**(HTTP 失败不回显后端 body):`loadIndexedFiles` 失败时 `s.error = (e as Error)?.message || String(e)` —— 与蓝本一致,本任务没有需要改 i18n 键的「后端 body 直接回显」路径(那类路径在 wiki 组,属 T7)。
- **K6**(console.error 不照抄):本任务代码零处使用 `console.*`。

## i18n

- `fmtAgo` 走 `i18n.global.t(...)`,与 `agentStore.ts:6,899` 先例一致。
- 四个键 grep 确认存在(T8 已落地):
  - `src/i18n/zh_cn.ts:1441-1444` = `刚刚` / `{m} 分钟前` / `{h} 小时前` / `{d} 天前`
  - `src/i18n/en_us.ts:1431-1434` = `just now` / `{m} min ago` / `{h} hr ago` / `{d} days ago`
- 未新增任何 i18n 键(本任务不涉及)。

## toast 2400 确认

`useKnowledgeStore().toast(msg)` → `useToast().show(msg, 2400)`,显式第二参数。单测 `toast(偏离 P4)` 用例断言 `toastShow` 被 `('已刷新', 2400)` 调用,通过。

## 三次 RED 探针(均已还原,`diff` 与 `git status --short` 确认)

**探针 1 —— K1 命中点 `loadJobs`**(改回错误的两层取数)
改前:
```ts
const body = (await service.ai.parserJobs({ status, limit })) as { jobs?: ParserJob[] }
return body.jobs || []
```
改后(错误版本):
```ts
const body = (await service.ai.parserJobs({ status, limit })) as { data?: { jobs?: ParserJob[] } }
return body.data?.jobs || []
```
报红用例:`Jobs 组 > loadAllJobs 三个桶各发一次请求并按状态归位`
```
TypeError: Cannot read properties of undefined (reading 'path')
 ❯ knowledgeStore.parser.test.ts:73:30
    73|     expect(s.jobs.pending[0].path).toBe('/pending')
```
还原后 `pnpm exec vitest run` 18/18 绿,`git status --short` 干净(revert 后与备份 diff 为空)。

**探针 2 —— N1 归一化**(去掉 `!!`)
改前:`enabled: !!e.enabled`;改后:`enabled: e.enabled`。
报红用例:`Allowlist 组 > N1:enabled 的 0/1 被归一化成布尔`
```
AssertionError: expected [ …(2) ] to deeply equal [ { ext: '.md', …(2) }, …(1) ]
- "enabled": true,
+ "enabled": 1,
```
还原后 18/18 绿。

**探针 3 —— P2「已在轮询就不重复起」守卫**(删掉 `if (indexedPollTimer) return`)
报红用例:`IndexedFiles 组 > startIndexedPolling 重复调用不叠定时器`
```
AssertionError: expected "vi.fn()" to be called 2 times, but got 4 times
```
还原后 18/18 绿,`diff` 确认文件与探针前的备份逐字节相同。

## 三门终值

```
pnpm test                  → exit=0   Test Files  309 passed (309)   Tests  2765 passed (2765)
pnpm exec vue-tsc --noEmit → exit=0
pnpm build                 → exit=0(仅既有的 >500KB chunk 警告,无新增)
```
算术核对:基线 307 文件/2747 例(sp8-ai@a13d6fa)→ 本任务不新增 `.vue`(color-guard 数不变)+ 新增 2 个测试文件(`knowledgeStore.parser.test.ts` 16 例 + `indexedFiles.test.ts` 2 例 = 18 例)→ **309 文件 / 2765 例**,与实测完全吻合。已知噪声(`persist.test.ts`/`AgentComposer.test.ts`)本次运行未触发,不需要复跑说明。

## NEEDS_CONTEXT / 疑虑(初版)

无。`DISTILL_JOBS_LIMIT` 未搬的判断已在上表说明理由,认为是正确的范围划分(brief Step1 明确「notes/wiki/distill 留给 T7」,该常量只服务 distill 组)。

---

# 评审 R1/R2 修正(2026-08-01)

评审结论:**任务质量 通过,Spec ❌**——两条 Critical/Important 收尾,其余(K1 六点、P3 14 个方法签名、P4 的 2400、N1 fixture 用整数、N2/N7、`fmtAgo` i18n 写法、`util/indexedFiles` 完整移植、Interfaces 块 26 个 state/action 名)评审已逐项独立核过,通过,本轮**只补这两条,未动其余任何代码**。

## 开放发现 1(Critical)—— 补 `DISTILL_JOBS_LIMIT`

**初版判断错在哪**:我依据的是「本任务代码有没有引用它」,但正确判据是 **brief 的 Interfaces 契约 + 下游消费者**——brief 第 11 行明文把 `export const DISTILL_JOBS_LIMIT = 500` 列进 T6 的 Produces,T7 brief 起手就 `import { useKnowledgeStore, DISTILL_JOBS_LIMIT } from './knowledgeStore'` 并在断言里用它。缺了它,T7 从第一行就编译不过。

**落点**:`knowledgeStore.ts`,紧邻 `fmtAgo` 定义之前(对应蓝本 `:9-11` 的位置)：
```ts
export const DISTILL_JOBS_LIMIT = 500
```
值回蓝本 `knowledgeStore.js:11` 核对一致(`export const DISTILL_JOBS_LIMIT = 500`)。注释写明:本批(T6)不消费,归 T7 的 distill 组使用;头部注释同步替换了原先「不搬」的错误说明,记录这次修正与教训（评审 R1 标注）。

**新增断言**(`knowledgeStore.parser.test.ts`,新 describe `DISTILL_JOBS_LIMIT(评审 R1)`):
```ts
it('与蓝本 knowledgeStore.js:11 同源,值为 500', () => {
  expect(DISTILL_JOBS_LIMIT).toBe(500)
})
```

**通用教训**(治理文件层面,写给后续任务参考):判断一个导出该不该在本任务落地,依据是**跨任务 Interfaces 契约里是否点了名 + 下游任务是否消费**,不是「本任务自己的实现代码里有没有用到」。契约里承诺的产出即使本任务不用,也必须交付——否则下游任务从编译第一步就卡死,而且这类缺口在只跑本任务测试时完全不可见(本任务自己的三门全绿,问题只在下一个任务的 import 语句才炸)。

## 开放发现 2(Important)—— `fmtAgo` 边界判别力

**探针复现**:评审把 `h < 24` 改成 `h < 48`,原 16 条用例 16/16 全绿——阈值本身没有任何用例守着。

**修法**:补 3 组边界用例,每组钉住一个切换点的两侧(治理文件 §9「A/B 二选一分支两侧都要有对照用例」):

| 切换点 | 左侧(改前档) | 右侧(改后档) |
|---|---|---|
| 刚刚 / 分钟 | `59_999ms`(m=0)→ `刚刚` | `60_000ms`(m=1)→ `1 分钟前` |
| 分钟 / 小时 | `59 分钟`(m=59)→ `59 分钟前` | `60 分钟`(m=60)→ `1 小时前` |
| 小时 / 天 | `23 小时`(h=23)→ `23 小时前` | `24 小时`(h=24)→ `1 天前` |

新增 `describe('fmtAgo 边界(评审 R2 —— 每个切换点两侧各一条)', ...)`,3 条 `it`,共 3 条断言组(6 个 `expect`)。

## 两次 RED 探针(R2,均已还原)

**探针 A —— `h < 24` → `h < 48`**
报红用例:`fmtAgo 边界(评审 R2 —— 每个切换点两侧各一条) > 小时/天 边界:23 小时(h=23)→ 23 小时前;24 小时(h=24,=1 天)→ 1 天前`
```
AssertionError: expected '24 小时前' to be '1 天前'
Expected: "1 天前"
Received: "24 小时前"
```
还原后 `pnpm exec vitest run` 该文件 20/20 绿(此时尚未加 DISTILL_JOBS_LIMIT 用例,故为 20 非 22)。

**探针 B —— `m < 60` → `m < 120`**
报红用例:`fmtAgo 边界(评审 R2 —— 每个切换点两侧各一条) > 分钟/小时 边界:59 分钟(m=59)→ 59 分钟前;60 分钟(m=60,=1 小时)→ 1 小时前`
```
AssertionError: expected '60 分钟前' to be '1 小时前'
Expected: "1 小时前"
Received: "60 分钟前"
```
还原后与探针 A 前保存的备份文件 `diff` 逐字节相同(`IDENTICAL to post-fix baseline (pre-probe)`),`git status --short` 干净。

## 重跑后三门终值

```
pnpm test                  → exit=0   Test Files  309 passed (309)   Tests  2769 passed (2769)
pnpm exec vue-tsc --noEmit → exit=0
pnpm build                 → exit=0(仅既有的 >500KB chunk 警告,无新增)
```
算术:R1 版本(2765 例)+ 本轮新增 4 条(DISTILL_JOBS_LIMIT 1 条 + fmtAgo 边界 3 条)= **2769 例**,与实测吻合。`.vue` 文件数不变,`309 文件` 不变。已知噪声(`persist.test.ts`/`AgentComposer.test.ts`)本次未触发。

## NEEDS_CONTEXT / 疑虑(R2 后)

无。

## `git show --stat HEAD` / `git status`(提交后填)

见下方 commit 输出。
