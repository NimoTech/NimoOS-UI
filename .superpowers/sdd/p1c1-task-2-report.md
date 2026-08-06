# P1c1 Task 2 — 报告

## 改动文件

### `src/ai/stores/agentStore.ts`
- 新增 5 个 action(按 brief Step 3 逐字港 `agentStore.js:734-777`,共享包已解包故 `body || fallback` 不再多一层 `.data`):
  - `loadVisibleResources()` —— 无会话清空不发请求;有会话整表覆盖(`null → []`)。**不 try/catch**,交给 `selectSession` 的 `allSettled` 兜底。
  - `addVisibleResource(path, kind='folder', force=false)` —— 无会话先 `createSession()`;服务端返回值优先、参数兜底;**错误原样抛出**(composer 要读 `e.response.status===409`)。
  - `removeVisibleResource(resId)` —— 先按 `resId` 查本地条目拿 `path`,调用成功后按 `path` 移除(`id` 未命中则本地不动)。
  - `loadAttachments()` —— 无会话清空;**吞错并清空**(与 `loadVisibleResources` 的"不吞错"形成有意的不对称,逐字对齐 Vue2)。
  - `removeAttachment(aid)` —— 无会话直接返回;调用成功后按 `id` 过滤本地列表(抛错则本地不动)。
- `selectSession`:在 `messages.value = migrateLegacyMessages(...)` 之后、`AbortController` 创建之前插入
  `await Promise.allSettled([loadVisibleResources(), loadAttachments()])`(按 auto-mode 覆盖决定,本任务只接两个 loader;`loadStagedChanges` 留给 Task 3 补入同一行)。同时把该函数上方注释里"资源/附件/staged 装载仍不搬"改成"资源/附件装载已接入;staged 装载留给 Task 3"。
- `send()`:在 `await runAgentRun(...)` 之后、`catch (e) {` 之前插入 `loadAttachments().catch(() => {})`(逐字港 `agentStore.js:393-395`,注释同 Vue2)。
- `return` 表补五个新函数:`loadVisibleResources, addVisibleResource, removeVisibleResource, loadAttachments, removeAttachment`。

### `src/ai/stores/agentStore.p1c.test.ts`
- 追加 `describe('agentStore P1c Task2:visible resources + attachments', ...)`,共 10 个 case,与 brief 逐字一致,唯一按 auto-mode 覆盖调整的两处:
  - 第 9 例改名为"…并发跑两个 loader…",删除 `listStagedChanges` 相关的 mock 行与断言。
  - 第 10 例(`selectSession:单个 loader 失败不阻断`)同步删除 `listStagedChanges.mockResolvedValue([])` 这行(不影响原有两条断言)。
- 复用已有 `vi.hoisted()` 的 `svc` mock 对象(`listVisibleResources/addVisibleResource/removeVisibleResource/listAttachments/deleteAttachment` 均已在 Task 1 的 mock 里预置),未新建第二个 mock。

## 测试命令与结果

**RED(实现前)**
```
pnpm test -- src/ai/stores/agentStore.p1c.test.ts
```
10 个新 case 全部按预期失败(`s.loadVisibleResources is not a function` / `s.removeAttachment is not a function` / 断言未达成),Task1 遗留 5 例仍绿 —— `10 failed | 5 passed (15)`。

**GREEN(实现后)**
```
pnpm test -- src/ai/stores/agentStore.p1c.test.ts src/ai/stores/agentStore.test.ts
```
```
 Test Files  2 passed (2)
      Tests  56 passed (56)
```

**类型检查**
```
pnpm exec vue-tsc --noEmit
```
0 error(无输出)。

**回归面扩大验证(未在 brief 里要求,主动多跑一遍兜底)**
```
pnpm test -- src/ai
```
```
 Test Files  21 passed (21)
      Tests  274 passed (274)
```

## 有意留白 / 未动的地方
- `loadStagedChanges` 未实现、`stagedChanges` 域的 loader 未接入 `selectSession`——按 auto-mode 覆盖指示,这是 Task 3 的范围,`allSettled` 目前只放两项。
- 未触碰 `src/ai/services/dispatchEvent.ts`、`src/ai/types.ts`(brief 要求不动)。
- 未运行 `./scripts/deploy.sh`,未部署真机。

## Commit
`ce092bf` — "SP8-P1c1: store visible-resources + attachments domains, selectSession loaders, send tail"
(基于 `17f32f8`,分支 `sp8-ai`)

## Fix pass

**改动**: `src/ai/stores/agentStore.test.ts` 的 hoisted `svc` mock 对象中增加 `listVisibleResources: vi.fn()` 和 `listAttachments: vi.fn()`(参照 p1c.test.ts 既有 mock 风格)。

**命令**: `pnpm test -- src/ai/stores/agentStore.test.ts src/ai/stores/agentStore.p1c.test.ts`

**结果**: `Test Files  2 passed (2) / Tests  56 passed (56)` ✓

**commit**: `4ab2eec`
