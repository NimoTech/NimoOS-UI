### Task 4: store `regenerateTitle` + `regeneratingTitleFor`

**Files:** Modify `src/ai/stores/agentStore.ts`;Test `src/ai/stores/agentStore.p1c2.test.ts`

**Interfaces:** Produces `regenerateTitle(id, opts?: { background?: boolean }): Promise<void>`、`regeneratingTitleFor: Ref<{ id: string|number; background: boolean } | null>`。

逐字港 Vue2 `agentStore.js:210-244`:模型 key 解析用现成的模块私有 `parseModelKey`(**但要保留 Vue2 这一处独有的防御:`firstColon < 0` 直接返回、cloud 分支 `secondColon < 0` 时容错**——若 `parseModelKey` 已具备等价行为,直接用并在注释里说明已核对);`providerType = sel?.provider_type || (source==='local' ? 'ollama' : 'other')`;`regeneratingTitleFor = { id, background }`(**对象而非布尔**,顶栏要用 `background` 区分自动/手动);成功且 `data.title` 非空才写回 `sessions[idx].title`;`catch` 只 `console.warn`(**吞掉,promise 仍 resolve**);`finally` 清空状态。
**1b 的 `autoTitleFirstTurn` 改为委托** `regenerateTitle(id, { background: true })`(Vue2 `send()` 413-419 就是这么调的,且 fire-and-forget `.catch(()=>{})`)——两份实现不要并存。

- [ ] **Step 1: 写失败测试**:无 selectedModel 直接返回不发请求 / local 与 cloud 两种 key 解析出的 model 名与 providerType / 成功写回标题 / 空 title 不写回 / 失败被吞且 `regeneratingTitleFor` 复位 / `background` 标记透传 / `autoTitleFirstTurn` 走同一条路径。
- [ ] **Step 2: 跑测试确认失败。**
- [ ] **Step 3: 实现。**
- [ ] **Step 4: 跑测试 + tsc,并跑 `pnpm test -- src/ai/stores/` 确认 1b/1c-1 既有 store 测试零回归。**
- [ ] **Step 5: Commit** `SP8-P1c2: store regenerateTitle (+ autoTitleFirstTurn delegates)`

---

