### Task 5: 还 1c-1 三张挂账票

**Files:** Modify `src/ai/stores/agentStore.ts`、`src/ai/components/shell/AgentComposer.vue`;Test `src/ai/stores/agentStore.p1c.test.ts`(追加)、`src/ai/components/shell/AgentComposer.test.ts`(追加)

**Interfaces:** Produces `removeVisibleResourceByPath(path: string): Promise<void>`。

1. **无 id 的 chip 也能删**:`removeVisibleResourceByPath(path)` —— 先 `await loadVisibleResources()`(服务端列表带 id),按 path 找;找到 → 走 `removeVisibleResource(id)`;没找到 → 说明服务端已无该项 → `removeVisibleResourceFromList(path)` 保持本地一致。`AgentComposer.removeChip(c)` 改成:有 id 走原路径,无 id 走这条;失败仍走 `toastError`(现有 `aiAuthFailed`)。**注释注明** Vue2 `agentStream.js:539-542` 不带 id、Vue2 那边点 × 会打出 `/visible-resources/undefined` 然后弹错误 toast(即"注定失败"),此处按正确逻辑改。
2. **staged 分组加固**:`appendStagedChange` 新建组时,`stagedChanges.value.push(group)` 之后 **重新取回代理引用**(`group = stagedChanges.value[stagedChanges.value.length - 1]`)再 push item;注释说明 raw 引用上的 mutation 不触发通知(1c-1 终审用真 `@vue/reactivity` 探针验证过)。
3. **`popSegment` 非对称补断言**:测试证明 `pop-segment` 后 `document.activeElement` **不是** textarea,而 `drill-in`/`pick` 后是。

- [ ] **Step 1: 写失败测试**(三组,含"无 id chip 点 × 会先刷新列表再按 id 删"与"服务端已无该项时只清本地")。
- [ ] **Step 2: 跑测试确认失败。**
- [ ] **Step 3: 实现三处。**
- [ ] **Step 4: 跑 `pnpm test -- src/ai/stores/ src/ai/components/shell/AgentComposer.test.ts` + tsc 通过。**
- [ ] **Step 5: Commit** `SP8-P1c2: settle 1c-1 debts (chip w/o id, staged reactivity, popSegment assertion)`

---

