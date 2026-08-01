# P5b · T3 报告 —— store 三处 epoch 过期守卫(K15)

## 0. 结论

DONE。三门全绿:**314 文件 / 2888 例**(基线 313/2882 + 本任务 6 例)、`vue-tsc` exit 0、
`pnpm build` exit 0。三个 action 各加了 store 实例局部 epoch 守卫,语义与 `loadRoots`
(`3d8c9bc`)一致;三次 RED 探针逐一验证「删 A 的守卫只报红 A 组,B/C 两组仍绿」。

## 1. 改了哪两个文件

- **改**:`src/ai/knowledge/stores/knowledgeStore.ts`(只加 K15 守卫,零无关改动)
- **新建**:`src/ai/knowledge/stores/knowledgeStore.staleGuard.test.ts`(6 例)

## 2. 三个守卫各自落在哪几行、与 `3d8c9bc` 先例的异同

统一模具(与 `loadRoots` 完全一致):进函数 `const epoch = ++xxxEpoch`;`await` 之后先判
`if (epoch !== xxxEpoch) return`;计数器 `let xxxEpoch = 0` 声明在 `defineStore` 的 setup
闭包内(store 实例局部,不是模块级单例),紧邻对应 state 的 `ref` 声明处。

| action | 计数器声明行 | 函数行(改后) | 蓝本对照 | 与 `loadRoots` 的差异 |
|---|---|---|---|---|
| `loadAllJobs` | `knowledgeStore.ts:261`(`let allJobsEpoch = 0`,紧邻 `jobs` ref) | `knowledgeStore.ts:352-361` | 蓝本 `knowledgeStore.js:146-153` | **无 loading/error/toast 状态**,只有一个写入点(`jobs.value = {...}`),守卫只需一处 `if (epoch !== allJobsEpoch) return`,比 `loadRoots` 简单(没有 finally 分支) |
| `loadIndexedFiles` | `knowledgeStore.ts:282-284`(`let indexedFilesEpoch = 0`,紧邻 `indexedFiles` ref) | `knowledgeStore.ts:444-461` | 蓝本 `knowledgeStore.js:317-330` | **有 try/catch/finally 三分支**,三处都要判 —— 与 `loadRoots` 结构完全同构(成功分支 return、失败分支 return、finally 判等式决定要不要归位 loading),只是失败分支这里没有 toast(蓝本 `loadIndexedFiles` 本来就不 toast,只写 `s.error`,K15 不新增 toast 行为) |
| `loadDistillJobs` | `knowledgeStore.ts:299-302`(`let distillJobsEpoch = 0`,紧邻 `distillJobs` ref) | `knowledgeStore.ts:600-617` | 蓝本 `knowledgeStore.js:168-197` | **无 try/catch**(蓝本本身失败就整发上抛,不吞错),守卫只需一处 `if (epoch !== distillJobsEpoch) return`;但**下游写入面更宽**(N4 按 filter 分桶 + `counts`/`done`/`total` 四个字段),守卫在写入任何字段之前就整体拦截,不是逐字段判断 |

三处代码注释里都写了完整竞态实证(见下节),并逐一标注「写法承 `loadRoots`(`3d8c9bc`)」。

## 3. 竞态实证(逐 action)

- **`loadAllJobs`**:QueueView 10 秒轮询 + `setScope('index')` 手动触发,两路并存。若轮询那一
  发响应更晚落地,先发后至会用旧数据覆盖 `setScope` 刚写入的新数据,页面短暂"往回跳"。
- **`loadIndexedFiles`**:`onPathPrefixInput`/`onMimePrefixInput`(蓝本 `IndexedFilesView.vue:
  633-636`/`643-646`)每敲一键整发重载,蓝本无 debounce(**N9,治理 §3.5 登记的照抄条,本任务
  触发频率照抄不改,只修「先发后至覆盖」的正确性**)。打 `abc` 三发并存时,先发(`ab`)后至会把
  `abc` 的结果盖上去,而过滤条显示的是 `abc`。**`finally` 里的 `s.loading = false` 也受守卫约束**
  —— 否则过期的一发会在最新一发还没落地时就提前把骨架撤掉,造成一帧"假完成"的空表格。
- **`loadDistillJobs`**:10 秒轮询 + `setFilter(f)` + `setScope('distill')` +
  `retryDistill`/`cancelDistill` 内部的重载,四路并存;按 filter 只刷对应桶(**N4,照抄不改**)。
  串号不只是「盖成旧数据」——若用户先点 `pending` pill 又立刻切到 `failed` pill,`pending` 那一发
  若晚于 `failed` 落地,会把 `d.pending` 覆盖成陈旧数据,且它携带的 `counts`/`done`/`total` 是
  另一次全量快照,会把 `failed` 桶刚刷新的计数一并冲掉。

三处证据均已写进 `knowledgeStore.ts` 对应函数的代码注释(非仅「防竞态」四字)。

## 4. 三组交错用例怎么造的先发后至 + 反向对照

统一手法:**两个可控 deferred promise**(`deferred<T>()` 手写 executor,存下 `resolve`),
先并发发起两次调用(`first`/`second`,均不 await),让"后发"（`second`,语义上更新的调用)的
deferred 先 `resolve` 并 `await second`,断言 state 已是"后发"的结果;再让"先发"
（`first`,语义上更早触发)的 deferred 才 `resolve` 并 `await first`,断言 state **仍是**
"后发"的结果(没被覆盖 / loading 没被提前归位 / 相关字段没被污染)。反向对照用非重叠的两次
**顺序** `await` 调用,证明守卫不误伤正常的先后两次操作。

| 组 | 交错测试 | 反向对照测试 |
|---|---|---|
| `loadAllJobs` | `交错:先发(轮询)后至,不覆盖后发(手动 setScope)已写入的三桶` | `反向对照:非重叠调用(先发先落地再发下一次),两发都真实生效` |
| `loadIndexedFiles` | `交错:先发(输入较短前缀)后至,不覆盖后发(输入更长前缀)的结果,loading 不提前归位` | `反向对照:非重叠调用(先发先落地再发下一次),两发都真实生效且各自归位 loading` |
| `loadDistillJobs` | `交错:先发(pending pill)后至,不覆盖后发(failed pill)已写入的桶与全量 counts` | `反向对照:非重叠调用(pill 依次点两次),两次都真实生效` |

`loadAllJobs` 的交错用例额外拆到「三桶各自的 6 个 deferred」(`Promise.all` 数组字面量里
`loadJobs('pending')`/`('running')`/`('failed')` 是同步依次调用的,故 `mockImplementationOnce`
可以按调用顺序精确对应到第一发 3 个 + 第二发 3 个)。`loadDistillJobs` 类似,拆到「jobs +
status 两个 deferred × 2 发」。

## 5. mock 形状取自哪个 fixture 文件(逐个说明)

| mock 目标 | 取自 | 层次 |
|---|---|---|
| `ai.parserJobs`(pending/running 行) | `.superpowers/sdd/p5b-fixtures/jobs-pending.json`(`jobs[0]` id=348 当"新鲜"、`jobs[1]` id=347 当"过期",字段逐字照抄未改一处)、`jobs-running.json`(唯一一行 id=10,两次调用共用) | 原样 snake_case(`service.ai.parser*` 零转换,§4.1) |
| `ai.parserJobs`(failed 桶空) | `jobs-failed.json`(`{"jobs":[]}`) | 同上 |
| `ai.parserFiles`(stale) | `files-default.json`(`total:8`,截取 3 行判别所需字段:`file_id`/`status`) | 原样 snake_case |
| `ai.parserFiles`(fresh,交错组) | `files-mime-prefix-legacy.json`(`{"total":0,...,"files":[]}`,真实命中 0 个文件的空态) | 原样 snake_case |
| `ai.parserFiles`(第二发,反向对照组) | `files-sort-size-asc.json`(另一个 3 行切片,`file_id`+`status`) | 原样 snake_case |
| `notes.listDistillJobs` / `notes.getDistillStatus` | 本机队列实测为空(`distill-jobs.json`=`{"jobs":[],"counts":{...0}}`、`distill-status.json`=`{"pending":0,"distilled":0,...}`),**行内容按治理 §4.2 表格右列的包归一化 camelCase 形状**(`filePath`/`status`),与既有 `knowledgeStore.notesWiki.test.ts` 的 `JOBS()` 辅助函数同一模具(README「未实测·源码推定」表登记过的字段名,不是手编) | camelCase(包内已归一化,§4.2) |

未违反「同一方法在两个测试文件里被 mock 成不同形状」的红线 —— `ai.parserJobs`/`ai.parserFiles`
两处都延续既有 `knowledgeStore.parser.test.ts` 的 snake_case 层次,`notes.*` 延续
`knowledgeStore.notesWiki.test.ts` 的 camelCase 层次。

## 6. 三次 RED 探针(原始报红文本 + 还原确认)

### 探针 1:删 `loadAllJobs` 的守卫

改动:去掉 `const epoch = ++allJobsEpoch` 与 `if (epoch !== allJobsEpoch) return`,函数体
退回蓝本原样(三桶并行拉取后无条件写 `jobs.value`)。

```
❯ src/ai/knowledge/stores/knowledgeStore.staleGuard.test.ts (6 tests | 1 failed) 21ms
     × 交错:先发(轮询)后至,不覆盖后发(手动 setScope)已写入的三桶 13ms

 FAIL  … loadAllJobs 过期守卫(K15) > 交错:先发(轮询)后至,不覆盖后发(手动 setScope)已写入的三桶
AssertionError: expected [ 347 ] to deeply equal [ 348 ]
- Expected
+ Received
  [
-   348,
+   347,
  ]
 ❯ knowledgeStore.staleGuard.test.ts:142:45
    142|     expect(s.jobs.pending.map((j) => j.id)).toEqual([348]) // 没被 347 覆盖

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
```

**其余两组仍绿**:`loadIndexedFiles`/`loadDistillJobs` 各自的交错 + 反向对照,共 4 例,原样通过
(汇总行 `1 failed | 5 passed (6)` 即证据 —— 6 例总数里只有 1 例红,其余 5 例含另外两组全部 4 例
+ 本组的反向对照 1 例)。

还原后确认:`git status --short` → `M src/ai/knowledge/stores/knowledgeStore.ts`(与探针前
同一处改动,内容已经改回,diff 干净;探针跑完后本文件回到探针前状态)。

### 探针 2:删 `loadIndexedFiles` 的守卫

改动:去掉 `const epoch = ++indexedFilesEpoch`,以及成功分支、失败分支、`finally` 里的三处
`epoch` 判断,函数体退回蓝本原样。

```
❯ src/ai/knowledge/stores/knowledgeStore.staleGuard.test.ts (6 tests | 1 failed) 22ms
     × 交错:先发(输入较短前缀)后至,不覆盖后发(输入更长前缀)的结果,loading 不提前归位 6ms

 FAIL  … loadIndexedFiles 过期守卫(K15) > 交错:先发(输入较短前缀)后至,不覆盖后发(输入更长前缀)的结果,loading 不提前归位
AssertionError: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ knowledgeStore.staleGuard.test.ts:204:36
    204|     expect(s.indexedFiles.loading).toBe(true) // 没被提前归位

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
```

报红命中的正是 brief 点名的「`finally` 归位受守卫约束」那一条断言。**其余两组仍绿**
(`loadAllJobs`/`loadDistillJobs` 共 4 例 + 本组反向对照 1 例 = 5 例通过)。

还原后确认:`git status --short` 干净(改回原样)。

### 探针 3:删 `loadDistillJobs` 的守卫

改动:去掉 `const epoch = ++distillJobsEpoch` 与 `if (epoch !== distillJobsEpoch) return`,
函数体退回蓝本原样。

```
❯ src/ai/knowledge/stores/knowledgeStore.staleGuard.test.ts (6 tests | 1 failed) 20ms
     × 交错:先发(pending pill)后至,不覆盖后发(failed pill)已写入的桶与全量 counts 8ms

 FAIL  … loadDistillJobs 过期守卫(K15) > 交错:先发(pending pill)后至,不覆盖后发(failed pill)已写入的桶与全量 counts
AssertionError: expected [ { filePath: '/p1', …(1) } ] to deeply equal []
- Expected
+ Received
- []
+ [
+   {
+     "filePath": "/p1",
+     "status": "pending",
+   },
+ ]
 ❯ knowledgeStore.staleGuard.test.ts:288:35
    288|     expect(s.distillJobs.pending).toEqual([]) // stale 的 pending 桶没被写入

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
```

**其余两组仍绿**(`loadAllJobs`/`loadIndexedFiles` 共 4 例 + 本组反向对照 1 例 = 5 例通过)。

还原后确认:`git status --short` 干净(改回原样)。

**三次探针共同证明「各咬各的」**:每次只删一个 action 的守卫,只有对应那一组的交错用例精确
报红(1 red),其余两组的交错 + 反向对照(合计 5 例)全部保持绿,互不误伤。

## 7. 三门完整终值

```
pnpm test                   exit=0   Test Files  314 passed (314) · Tests  2888 passed (2888)
pnpm exec vue-tsc --noEmit  exit=0   (无输出)
pnpm build                  exit=0   (仅既有第三方包警告 + >500KB chunk 警告,无错误)
```

无红项。

**增量口径**:brief「起点」标注本任务的实测基线是 **313 文件 / 2882 例**(4c18508,晚于
`p5b-common-constraints.md` §8 记录的 d8efb0e 基线 313/2872 —— T0/T1/T2 已经把 2872 推进到
2882,brief 末尾那句才是 T3 应该对照的数)。本任务净增 **+1 文件 / +6 例**(2888 − 2882 = 6,
314 − 313 = 1),低于 brief 预测的「+1 文件,+8~10 例」。原因:三个 action 各只落
**1 组交错 + 1 组反向对照 = 2 例**,3 × 2 = 6;brief 的 8~10 是估算区间,未强制要求每组拆更多
细粒度用例,且治理 §9 的判别力要求(deferred promise 交错 + 反向对照双向验证)在每组 2 例内
已经满足 —— 3 次 RED 探针也证明了这 6 例对三个守卫各自都有精确判别力,不需要额外例数来"凑"
覆盖率。

## 8. i18n

本任务未涉及 i18n(不新增 / 不复用任何键,K15 是纯逻辑守卫,不改文案)。

## 9. §3(K1-K20)命中项

- **K15**(本任务的核心授权):`loadIndexedFiles`/`loadAllJobs`/`loadDistillJobs` 各加 store
  实例局部 epoch 过期守卫,inline 写、不抽公共 guard。三处已逐一在第 2 节说明落地行号与语义。

## 10. §3.5(N1-N14)命中项(照抄确认)

- **N9**:`onPathPrefixInput`/`onMimePrefixInput` 每敲一键整发重载,**触发频率原样保留,未加
  debounce**——本任务只在 `loadIndexedFiles` 内部加了过期守卫,组件层的调用方式(`views/*.vue`
  由 T8/T9 落地)完全没有涉及,不存在"顺手加 debounce"的机会,这里仅在代码注释与竞态实证里引用
  N9 作为触发场景说明。
- **N4**:`loadDistillJobs` 按 filter 只刷对应桶的既有逻辑**一行未动**,守卫只是在写入前多加了
  一层"我是否还是最新一发"的整体拦截,不改变 N4 本身的分桶规则,反向对照用例
  (`s.distillJobs.pending 保留上次结果`)沿用了 `knowledgeStore.notesWiki.test.ts` 里已经验证
  过的 N4 断言写法。
- **N5**:`d.done`/`d.total` 的取值来源(`status.distilled`/`rows.length`)**一行未动**,守卫
  在它们赋值前整体拦截,不改变取值口径。

其余 N1-N3、N6-N8、N10-N14 与本任务无关(不涉及模板/scss/组件层),不适用。

## 11. 遗留疑问

无。三门全绿、RED 探针三次全部精确命中且互不误伤、`git status` 干净、mock 全部回 fixture 或
既有已获批的「源码推定」形状。测试例数比 brief 预测的区间少 2~4 例,已在第 7 节说明原因,认为
不构成缺陷(判别力已由 RED 探针实证)。
