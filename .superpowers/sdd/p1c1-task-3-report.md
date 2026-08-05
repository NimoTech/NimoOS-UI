# P1c-1 Task 3 报告 —— store staged changes 域(5 动作)

## 变更文件

### `src/ai/stores/agentStore.ts`
- 新增 5 个动作,逐字港 `agentStore.js:779-847`(Vue2 `Vue.set/Vue.delete` → 直接赋值 / `delete`),插在 `removeAttachment` 之后:
  - `loadStagedChanges()` —— 无会话清空、不发请求;有会话整表覆盖(`body || []`)。
  - `commitStagedAll()` —— `committing` 置 true → 调 `service.ai.commitStagedChanges` → 成功清空 `stagedChanges`;`finally` 复位 `committing`;失败不 catch,错误原样冒泡,列表保留。
  - `revertStagedRun(runId)` —— `reverting[String(runId)] = true` → 调服务 → **不看响应状态**,成功即按 `run_id` 过滤掉整组;`finally` 里 `delete reverting[key]`。
  - `revertStagedBatch(batchId)` —— `reverting[String(batchId)] = true` → 调服务,`status = body?.status || 'ok'`;`ok/partial` → 按 `batch_id` 就地剪掉该 batch 的项、再丢掉变空的组;其余状态(`conflict`/`nothing_to_revert`/`snapshot_missing`)→ 整表重拉 `loadStagedChanges()`;`finally` 清键。
  - `revertStagedItem(stagedId)` —— 键为 `` `item:${stagedId}` ``,调**复数端点** `service.ai.revertStagedItems(sessionId, [stagedId])`(单元素数组);状态判定与剪裁逻辑同 batch,但按 `staged_id` 过滤。
- `selectSession` 的 `Promise.allSettled([...])` 补上第三个 loader:`loadVisibleResources(), loadAttachments(), loadStagedChanges()`,位置保持在 attach 尾巴之前(对齐 Vue2 `agentStore.js:259-265`)。
- 相邻注释收口:`selectSession` 上方注释从"资源/附件装载已接入(本任务);staged 装载留给 Task 3 补齐第三个 loader"改为"三域装载已在此完成(1c-1)";`allSettled` 那行注释去掉"本任务先接两个…由 Task 3 补入同一行"的过渡措辞。
- `return` 表补 5 个新动作:`loadStagedChanges, commitStagedAll, revertStagedRun, revertStagedBatch, revertStagedItem`(紧跟 `removeAttachment` 之后、`createStreamActions` 之前)。
- 未新增类型 —— 复用 Task 1 已导出的 `StagedGroup`/`StagedItem`,复用 Task 1 的 `stagedChanges`/`committing`/`reverting` refs(未重复声明)。

### `src/ai/stores/agentStore.p1c.test.ts`
- 恢复 Task 2 第 9 例(`selectSession` 并发 loader 用例):重命名回"装载消息后并发跑三个 loader(顺序在 attach 之前)",补回 `svc.listStagedChanges.mockResolvedValue([])` 和 `expect(svc.listStagedChanges).toHaveBeenCalledWith('sess-9')`。
- 追加 `describe('agentStore P1c Task3:staged changes', ...)`,7 个用例,与 brief 逐字一致:
  1. `loadStagedChanges`:无会话清空;有会话整表覆盖。
  2. `commitStagedAll`:成功清空,`committing` 复位。
  3. `commitStagedAll`:失败保留列表、`committing` 复位、错误冒泡(`rejects.toThrow('boom')`)。
  4. `revertStagedRun`:成功整组移除,`reverting` 清空。
  5. `revertStagedBatch`:`status: 'ok'` 时按 `batch_id` 剪项并丢空组。
  6. `revertStagedBatch`:`status: 'conflict'` 时改为整表重拉。
  7. `revertStagedItem`:验证走复数端点单元素数组、`reverting` 键在调用期间恰为 `['item:10']`(用 `mockImplementation` 内部快照断言,证明键在 finally 之前存在)、成功后按 `staged_id` 剪项、`reverting` 复位。
- 复用文件顶部已有的 hoisted `svc` mock(`listStagedChanges/commitStagedChanges/revertStagedRun/revertStagedBatch/revertStagedItems` 已在 Task 1/2 阶段就位),未新增第二个 mock。

## 测试命令与输出尾部

```
$ pnpm test -- src/ai/stores/agentStore.p1c.test.ts
```
第一次跑(RED,实现前):8 failed | 14 passed(22)—— 全部 8 个失败均为 `TypeError: s.xxx is not a function`(`loadStagedChanges`/`commitStagedAll`/`revertStagedRun`/`revertStagedBatch`/`revertStagedItem` 缺失),符合预期失败原因,无误报。

```
$ pnpm test -- src/ai/stores/agentStore.p1c.test.ts src/ai/stores/agentStore.test.ts
```
实现后:
```
 Test Files  2 passed (2)
      Tests  63 passed (63)
```

```
$ pnpm exec vue-tsc --noEmit
```
无输出 —— 0 error。

## 有意保留 / 未动的地方

- 未改动 `src/ai/services/dispatchEvent.ts`、`src/ai/types.ts`(按指示禁止触碰)。
- 未新增/改动 `StagedItem`/`StagedGroup`/`stagedChanges`/`committing`/`reverting` 的声明——全部复用 Task 1 已导出的定义。
- `commitStagedAll`/`revertStagedRun` 对服务端响应体不做状态判定(与 brief 一致:commit 只要 promise resolve 就清空;run 回滚不看 status,直接按 promise 是否 reject 判定成败)——这与 batch/item 回滚"看 status 决定剪裁 or 重拉"的路径是有意的不对称,源于 Vue2 对应代码本就如此分叉,未做"统一"式改写。
- 未涉及任何渲染/UI —— 按任务边界,ResourcesTab 属于下一阶段(1c-2)。

## Git

Commit: `6e9a8a2` —— "SP8-P1c1: store staged-changes domain (load/commit/revert run|batch|item)"(分支 `sp8-ai`,仅改 `src/ai/stores/agentStore.ts` + `src/ai/stores/agentStore.p1c.test.ts`,2 files changed, 176 insertions(+), 4 deletions(-))。
