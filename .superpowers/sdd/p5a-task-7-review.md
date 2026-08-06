# SP8-P5a Task 7 独立评审 —— knowledgeStore notes + wiki + distill 组

评审对象:commit `aacdf76`(`.sp8/NimoOS-New-UI` 分支 `sp8-ai`)。
蓝本权威源:`git show main:src/views/AI/Knowledge/store/knowledgeStore.js`(main@7a6ee6b7,363 行,已存 `/tmp/p5a-t7-bp.js`)。
共享包权威源:`/home/nimo/NimoTech/.sp8/NimoOS-Service/src/{notes,wiki,ai}.ts`(只读逐字读过)。

## 判定

- **Spec 合规:✅**
- **任务质量:通过**

## 17 个 action 逐个对照

| # | action | 蓝本行 | 本仓行 | 等价 | 差异说明 |
|---|---|---|---|---|---|
| 1 | `setNotesDraftCount` | :99-101 | :435-437 | ✅ | `state.x=n` → `x.value=n`,机械替换(P1) |
| 2 | `refreshNotesDraftCount` | :102-107 | :442-449 | ✅ | K1:`r.data.notes.length` → `service.notes.list(...).length`(包已 map(normalizeNote),零 `.data`);catch 静默不 toast,与蓝本一致 |
| 3 | `loadNotesSummary` | :108-117 | :452-461 | ✅ | K1:`notesApi.list({limit:500})` 本就走包(非新偏离),直接喂 `summarizeNotes`;失败静默保留旧值 |
| 4 | `runSearch` | :120-131 | :474-485 | ✅ | `api.post(...).then(r=>r.data)` → `service.ai.searchText(body)` 直接 return(包内 `ai.ts:579-582` 已剥一层,零二次剥壳);字段拼装(`filters\|\|{}`/`topK\|\|10`/`!!rerank`/固定 `group_by_file`/`max_chunks_per_file`)逐字照搬 |
| 5 | `loadChunkContext` | :134-138 | :495-497 | ✅ | 同上模式;`window=2` 默认值、`kind\|\|'body'` 逐字照搬 |
| 6 | `loadDistillJobs` | :180-197 | :552-567 | ✅ | N4/N5 见下节;`service.notes.listDistillJobs`/`getDistillStatus` 已归一化(camelCase),零二次剥壳 |
| 7 | `retryDistill` | :202-205 | :572-577 | ✅ | 逐字照搬,含 filter 透传重载 |
| 8 | `cancelDistill` | :211-214 | :580-585 | ✅ | 逐字照搬 |
| 9 | `loadRoots` | :244-253 | :590-599 | ✅(含 K5 授权偏离) | 蓝本 `toast(i18n.t('Operation failed')+': '+(e.message\|\|e))` → `toast(i18n.global.t('aiKbOpFailed'))`,不回显后端串 |
| 10 | `loadCandidates` | :254-260 | :602-608 | ✅ | 失败静默清空,逐字照搬 |
| 11 | `createRoot` | :262-266 | :612-616 | ✅ | K1:蓝本 `r.data` → 包内 `wiki.createRoot()` 已 `return res.data`(T2 结构性偏离),store 层 `const result=...; return result`,零二次剥壳;错误原样上抛 |
| 12 | `deleteRoot` | :267-270 | :619-622 | ✅ | 逐字照搬(透传 purge + 重载) |
| 13 | `rescanRoot` | :271-273 | :625-627 | ✅ | 刻意不重载,与蓝本一致 |
| 14 | `loadWikiTree` | :276-278 | :632-634 | ✅ | 直接转发,零剥壳 |
| 15 | `loadWikiNode` | :280-287 | :647-654 | ✅(N6) | 404→null、其余上抛,`isNotFound` 是纯提取(蓝本内联判断抽成具名函数,行为零改动) |
| 16 | `loadWikiRaw` | :289-296 | :657-664 | ✅(N6) | 同上 |
| 17 | `setRootEnabled` | :297-309 | :668-679 | ✅ | 乐观更新/失败回滚上抛/未知 id 直接返回,逐字照搬 |

**17/17 等价,零处偏离蓝本行为(除已授权的 K1/K5)。**

## 🔴 二次 map(K1 独有变体)—— 逐个结论

逐一核对每个 action 内部有没有对已归一化字段再转换一遍(camelCase 当 snake_case/PascalCase 又读一次):

- `refreshNotesDraftCount`/`loadNotesSummary`:直接用 `list.length` / `summarizeNotes(list)`,零重复 map。
- `loadDistillJobs`:`jobsResult.jobs`/`jobsResult.counts` 直接取用,零重复 map。
- `loadRoots`/`loadCandidates`/`loadWikiTree`/`loadWikiNode`/`loadWikiRaw`:全部直接赋值/return 包返回值,零重复 map。
- `createRoot`:`const result = await service.wiki.createRoot(body); return result`,零剥壳。
- `runSearch`/`loadChunkContext`:`return service.ai.searchText(...)`/`return service.ai.searchChunk(...)`,包内已剥好,零二次剥壳。

**结论:17 个 action 全部零二次 map,K1 命中点清单(共同约束 §4)逐条核对一致。** RED 探针 1(见下)证实测试确实能抓到这类回归。

## N4 / N5 / N6 / N7 照抄不改核实

- **N4**(`:559-563`,无过滤刷三桶/有过滤只刷该桶):三条 `if` 判据逐字保留,函数头注释完整保留蓝本「防止繁忙队列挤出较早 failed/skipped 行」的设计意图说明。用例:`distill 队列(N4/N5) > 无过滤时刷新三个桶,skipped 归进 failed 桶`(无 filter 侧)+ `distill 队列(N4/N5) > 有过滤时只刷该桶,另两桶保留上次结果`(有 filter 侧,断言 `pending` 未被清空)。两侧均断言了参数(`toHaveBeenCalledWith('', DISTILL_JOBS_LIMIT)`),非只断言"被调用"。
- **N5**(`:566` `d.total = rows.length`):注释保留「免竞态」的设计说明。用例断言 `s.distillJobs.total).toBe(4)`(4 行输入,若误改成 `counts` 之和会得 6,已用 RED 探针验证,见下)。
- **N6**(`loadWikiNode`/`loadWikiRaw` 只 404→null、其余上抛):两个函数都有 404 测试(`把 404 转成 null`,两函数一起断言)与 500 测试(`非 404 错误原样上抛`,两函数一起断言),两侧齐全。
- **N7**(nil slice 兜底不许删):`loadDistillJobs` 里 `const rows = jobsResult.jobs || []` 保留(虽然包内 `normalizeDistillJobs` 已经保证 `jobs` 恒为数组,这层是蓝本同款双保险,未被自作主张删除,符合"照抄不改"精神)。

**四条均确认照抄,注释均一并搬迁。**

## 跨文件 mock 一致性(与 T6 `knowledgeStore.parser.test.ts` 对比)

`parser.test.ts` 的 `service.ai` mock 只含 parser 前缀方法(`parserStats`/`parserState`/`parserJobs`/`parserRetryJobs`/`parserDeleteJob`/`parserClearFailedJobs`/`parserAllowlistExtensions`/`parserAllowlistFolders`/`patchParserAllowlistExtensions`/`addParserAllowlistFolder`/`deleteParserAllowlistFolder`/`parserControl`/`parserFiles`/`parserReindexFiles`);本文件 `service.ai` mock 只含 `searchText`/`searchChunk`,`service.notes`/`service.wiki` 是 T6 完全没有的新增域。**两个文件的 `service.ai` mock 方法名集合零重叠**,不存在"同一方法两处 mock 成不同形状"的情况。`ROOT`/`JOBS(...)` fixture 与 `STATS`/`STATE`(T6)风格一致(均为裸 body,不套 `{data:…}` 壳),归一化字段命名(camelCase)与共享包 `notes.ts`/`wiki.ts` 的接口定义逐字对应。

**结论:一致,无 red flag。**

## T6 那 442 行有没有被动过

**否。** `git diff 9ec4b06..aacdf76 -- src/ai/knowledge/stores/knowledgeStore.ts | grep '^-'` 零命中(排除 diff header),整份 diff 全为追加(`+`),`knowledgeStore.parser.test.ts` 的 diff 为空(零改动)。T7 只在 `return {}` 导出对象里追加了新 state/action,符合「必要的合并点」。

## K5 catch 分支结论

命中点唯一:`loadRoots` 的 catch。已从蓝本 `i18n.t('Operation failed')+': '+(e.message||e)` 改为 `toast(i18n.global.t('aiKbOpFailed'))`,不含任何后端错误串插值。其余 catch 分支(`refreshNotesDraftCount`/`loadNotesSummary`/`loadCandidates`/`setRootEnabled`)蓝本本就是静默或原样上抛,不涉及 toast 回显,不属于 K5 命中范围,行为与蓝本一致。

## K6 grep 结论

`grep -n "console\." src/ai/knowledge/stores/knowledgeStore.ts` 只命中两行注释文本(引用"console.error"作为说明文字),生产代码零处 `console.*` 调用。确认零命中。

## i18n

复用 T8 已落地的 `aiKbOpFailed`(`src/i18n/zh_cn.ts:1445`=`操作失败`,`src/i18n/en_us.ts:1435`=`Operation failed`),本任务未新增任何键,核对无误。

## 测试质量核查(六项判别力检查)

1. **N4 两侧**:两侧均 `toHaveBeenCalledWith(filter值, DISTILL_JOBS_LIMIT)` 断言参数,非弱断言;有过滤侧另断言 `pending` 长度未变(未被清空)。✅ 有判别力(已用 RED 探针 3 验证)。
2. **N5**:`total).toBe(4)`(rows.length),若误比 `counts` 之和(1+2+3=6)会报红。✅(已用 RED 探针验证,见实现者报告探针 2,评审未重复但认可其判别力)。
3. **N6 两侧**:404 测试与 500 测试都覆盖 `loadWikiNode`**和** `loadWikiRaw` 两个函数,非只测一支。✅ 有判别力(已用 RED 探针 4 验证 `loadWikiRaw` 一侧)。
4. **`loadRoots` K5**:`not.toContain('timeout')` 是强断言,直接验证"后端原文没有出现在 toast 里",非"toast 被调用了"这种弱断言。✅ 有判别力(实现者探针 4 已验证)。
5. **`refreshNotesDraftCount`**:`toHaveBeenCalledWith({status:'draft',limit:200})` 断言完整参数对象,非只断言 called。✅ 有判别力(评审 RED 探针 2 已验证)。
6. **`loadNotesSummary`→`summarizeNotes` 接线**:mock 直接 resolve 一个裸 `{status}[]` 数组(非 `{notes:[...]}` 信封),断言 `notesSummary` 精确值;若实现传错东西(如仍按蓝本形状剥一层 `.notes`)测试必红。✅ 有判别力。

未发现空转用例;`vi.hoisted()` 全程使用(与 brief 骨架一致);异步全部 `await` 直接调用(本任务无定时器/nextTick 场景,不需要 `flushPromises()`);未发现既有断言被削弱或删除。

## 四次独立 RED 探针(评审自做,不复用实现者的四次)

| # | 破坏内容 | 报红用例 | 还原 |
|---|---|---|---|
| 1 | `loadRoots` 里对 `service.wiki.getRoots()` 结果**再套一层 PascalCase→camelCase 归一化**(模拟 K1"二次转换"变体——把已是 camelCase 的输入当成原始 PascalCase 处理) | `loadRoots 写入列表并收尾 loading`(字段全变 `undefined`)+ 级联报红 `setRootEnabled 乐观更新,成功保留` + `setRootEnabled 失败时回滚并上抛`,共 3 例 | ✅ `git checkout --` 后 `git status --short` 干净、`git diff --stat HEAD` 为空 |
| 2 | `refreshNotesDraftCount` 的 `limit` 从 200 改成 100 | `refreshNotesDraftCount 用 status=draft&limit=200,写 draft 计数`(参数比对失败,精确指出 `200`→`100` 差异) | ✅ 已还原 |
| 3 | `loadDistillJobs` 带 `filter==='failed'` 时**多刷一桶**(把 `pending` 也纳入该分支条件,只改次数方向不改整体结构) | `有过滤时只刷该桶,另两桶保留上次结果(N4 的不对称,照抄)`(`pending` 被意外清空,`expected [] to have a length of 1`) | ✅ 已还原 |
| 4 | `loadWikiRaw` 的 404 判据从 `status===404` 改成 `status>=400`(与 `loadWikiNode` 共用的 `isNotFound` 隔离改,只影响 `loadWikiRaw`) | `非 404 错误原样上抛`(500 被误吞成 `null`,`promise resolved "null" instead of rejecting`) | ✅ 已还原 |

四次探针**全部精确命中**,无一次全绿(即没有发现需要补断言的盲区)。每次探针后单独重跑确认 22/22 恢复;全部还原后 `git status --short` 干净、`git diff --stat HEAD -- src/ai/knowledge/stores/knowledgeStore.ts` 为空,且已重跑 `src/ai/knowledge/stores/` 子集确认恢复到 42/42。

## 三门实测

```
pnpm test:                    Test Files 311 passed (311) / Tests 2805 passed (2805)  exit=0
pnpm exec vue-tsc --noEmit:    (空输出)                                                exit=0
```
与实现者报告数字一致(311/2805,tsc 干净)。未触发任何已知噪声(`persist.test.ts`/`AgentComposer.test.ts`)。`pnpm build` 依约未重跑(实现者已跑过 exit 0,本次评审未改动生产逻辑,不需要重跑)。

## 提交卫生

- `git show --stat aacdf76` 只含 `knowledgeStore.ts` + `knowledgeStore.notesWiki.test.ts` 两个文件。
- `git status --short`(评审过程含 4 次 RED 探针后)最终干净。
- `NimoOS-UI`(只读蓝本仓)近期提交均为上游/其他会话所留,与本任务无关,未被本任务或本评审触碰。
- `.sp8/NimoOS-Service` 无本任务(T7)新增提交(最近提交是 T2 wiki 域的 fixup,属既有工作)。

## ⚠️ 待协调者裁定

无。所有数据契约、N4-N7 照抄纪律、K1/K5/K6 授权偏离、T6 隔离性均核实一致,无需协调者拍板的疑点。
