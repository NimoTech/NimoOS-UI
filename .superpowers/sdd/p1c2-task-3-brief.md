### Task 3: store thinking 域 + 会话 watcher 接线

**Files:** Modify `src/ai/stores/agentStore.ts`、`src/ai/views/AgentPage.vue`;Test `src/ai/stores/agentStore.p1c2.test.ts`、`src/ai/views/AgentPage.test.ts`

**Interfaces:** Produces `loadThinkingDefaults()` / `loadSessionThinking(sessionId)` / `setThinkingEnabled(enabled)` / `setThinkingLevel(level)`(`updateThinkingForModel` 已存在)。

逐字港 Vue2 `agentStore.js:656-698`,注意四处细节:
- `loadThinkingDefaults`:`try { thinking.defaults = await ai.getThinkingDefaults() } catch { /* 保留硬编码兜底 */ }`(**吞错**);`AgentPage.onMounted` 里在 `loadSessions`/`loadAvailableModels` **之前**调一次(Vue2 `Agent.vue:151`)。
- `loadSessionThinking(id)`:无 id 直接返回;`cfg = await ai.getSessionThinking(id)`,**包内已把"无覆盖"归一成 `null`**,`null` 时回落 `{...thinking.defaults}`;只写 `enabled`/`level`。
- `setThinkingEnabled/Level`:**先乐观改本地再 patch**,失败**不回滚**(Vue2 如此);无会话则只改本地不发请求。
- 会话 watcher(Vue2 `Agent.vue:120-123`):`activeSessionId` 变化 → `loadSessionThinking(newId)` + `updateThinkingForModel()`(与已有的 `refreshContextUsage()` 并列,顺序照 Vue2)。

- [ ] **Step 1: 写失败测试**:defaults 吞错保留兜底 / `getSessionThinking` 返 `null` 时用 defaults / 乐观更新且失败不回滚 / 无会话不发 patch / AgentPage 切会话时三个调用都发生。
- [ ] **Step 2: 跑测试确认失败。**
- [ ] **Step 3: 实现。**
- [ ] **Step 4: 跑测试 + tsc 通过。**
- [ ] **Step 5: Commit** `SP8-P1c2: store thinking domain + session watcher wiring`

---

