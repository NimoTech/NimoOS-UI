# P1c Task 1 — store: 5 state 字段 + 3 个 stream-fed 动作接进 createStreamActions

## 结论

DONE。TDD 流程完整走过:先建测试文件、跑并确认红(`s.appendStagedChange is not a function` 等),
实现后跑绿,回归测试(dispatchEvent + 旧 agentStore 测试)与全量套件均无回归,`vue-tsc --noEmit` 无报错。
已提交一个 commit:`17f32f8`。

## 逐文件改动

### `src/ai/stores/agentStore.ts`

1. **类型导出**(紧接在 `AgentModel`/`ThinkingState` 之后、`SendPayload` 之前,与 brief 逐字一致):
   - `export interface VisibleResource { id?; path; kind; has_agent_md?; [k: string]: unknown }`
   - `export interface StagedItem { seq; staged_id?; batch_id?; op; path; dst_path?; size_bytes?; snapshot_missing?; [k: string]: unknown }`
   - `export interface StagedGroup { run_id; created_at; items: StagedItem[]; [k: string]: unknown }`

2. **state 区**(紧接 `pendingSkillId` 之后,原 141 行,现因新增类型区上移约 6 行):
   - `visibleResources = ref<VisibleResource[]>([])`
   - `attachments = ref<Record<string, unknown>[]>([])`
   - `stagedChanges = ref<StagedGroup[]>([])`
   - `committing = ref(false)`
   - `reverting = ref<Record<string, boolean>>({})`

3. **三个新动作**(放在 `markRunningStepDone` 之后、`createStreamActions` 之前,逐字港 agentStore.js:702-732):
   - `appendStagedChange(item)` —— 按 `run_id` 归组(`created_at = Date.now() / 1000`,秒浮点,对齐服务端 unix 秒);
     组内按 `(seq, path)` 去重,命中就地 `splice` 替换保位置,否则 `push` 到末尾;新组本身也追加到 `stagedChanges` 末尾
     (newest-run-last)。
   - `appendVisibleResource(vr)` —— 只按 `path` 判重,不比较 `id`;浅拷贝 `{ ...vr }` 入列。
   - `removeVisibleResourceFromList(path)` —— 按 `path` 整表 `filter`。

4. **`createStreamActions()`**:注释从"1b 阶段刻意不含…"改写为"1c 补上…reducer 里这三个可选链调用不再 no-op",
   返回对象末尾加上 `appendStagedChange, appendVisibleResource, removeVisibleResourceFromList`。

5. **return 表**(store 顶层导出):补 `visibleResources, attachments, stagedChanges, committing, reverting`(跟在
   `pendingSkillId` 后)和 `appendStagedChange, appendVisibleResource, removeVisibleResourceFromList`(跟在
   `markRunningStepDone` 后,`createStreamActions` 前)。

未改动:`src/ai/types.ts`(`StreamActions` 里三个 optional 签名保持原样)、`src/ai/services/dispatchEvent.ts`
(283/296/311/318 调用点未碰)。Pinia 工厂形态(`useAgentStore(agentType?) => defineStore(...)()`)保持不变。

### `src/ai/stores/agentStore.p1c.test.ts`(新建)

按 brief 提供的内容逐字落地,5 个用例:
1. `appendStagedChange`:同 run 归组、`(seq,path)` 去重就地替换。
2. `appendStagedChange`:不同 run 追加到末尾(newest-run-last)。
3. `appendVisibleResource`:按 path 去重、浅拷贝入列。
4. `removeVisibleResourceFromList`:按 path 整表过滤。
5. `createStreamActions`:暴露 1c 三动作,且通过 `createStreamActions()` 拿到的函数句柄仍能正确改变 store 状态
   (证明 reducer 走可选链拿到的确实是可用的动作,不再 no-op)。

mock 形态照抄 `agentStore.test.ts:4-16` 的 `vi.hoisted` + `vi.mock('@nimotech/nimoos-service', ...)`;
每个用例用独立 `agentType`(`t1a`..`t1e`)避免 Pinia 实例复用互相污染。

## 测试命令与输出尾部

```
$ pnpm test -- src/ai/stores/agentStore.p1c.test.ts   # Step 2:实现前
FAIL × 5 —— s.appendStagedChange is not a function / s.appendVisibleResource is not a function /
            typeof a.appendStagedChange 期望 'function' 收到 'undefined'
Test Files  1 failed (1)
     Tests  5 failed (5)
```

```
$ pnpm test -- src/ai/stores/agentStore.p1c.test.ts   # Step 4:实现后
Test Files  1 passed (1)
     Tests  5 passed (5)
```

```
$ pnpm test -- src/ai/services/dispatchEvent.test.ts src/ai/stores/agentStore.test.ts
Test Files  2 passed (2)
     Tests  91 passed (91)
```

```
$ pnpm exec vue-tsc --noEmit
(no output — clean)
```

```
$ pnpm test   # 全量回归
Test Files  235 passed (235)
     Tests  1498 passed (1498)
```

## 注意到但刻意未动的事

- `appendStagedChange` 的入参类型是 `Record<string, unknown>`,内部用 `item.run_id as string | number` /
  `item.seq` 断言取值——这是 brief 给的逐字实现,和 dispatchEvent.ts 调用点(283/296/311/318 一带)传入的
  松散事件 payload 形状对齐,不做进一步收窄。
- `committing` / `reverting` 这两个 state 字段本任务只负责声明 + 挂到 return 表,brief 未要求本任务给它们
  配套的读写动作(提交/回滚 UI 是后续任务的事)——没有为它们写任何逻辑或测试,保持字段裸态。
- `reverting` 的三种键命名空间(raw run_id / raw batch_id / `'item:'+staged_id`)只在注释里记录,没有在本任务
  写任何消费这张表的代码——留给后续读取/回滚动作的任务。
- 类型区插入位置导致原 brief 里提到的具体行号(如"141 行"、"378-399"、"723-764")在改动后有微小漂移(新增
  三个 interface 导致文件整体下移几行),但相对位置关系(紧跟在哪个 state/函数之后)完全符合 brief 描述。
