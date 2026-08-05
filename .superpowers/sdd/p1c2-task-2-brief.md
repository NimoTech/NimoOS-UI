### Task 2: store 右栏状态 + 顶栏开关 + AgentPage 解开硬编码

**Files:** Modify `src/ai/stores/agentStore.ts`、`src/ai/components/shell/AgentTopbar.vue`、`src/ai/views/AgentPage.vue`;Test `src/ai/stores/agentStore.p1c2.test.ts`(新建)、`src/ai/components/shell/AgentTopbar.test.ts`、`src/ai/views/AgentPage.test.ts`

**Interfaces:** Produces `rightTab: Ref<'activity'|'context'|'system'|'resources'>`(初值 `'activity'`)、`setRightTab(tab)`、`toggleRight()`;`AgentTopbar` 新增 emit `toggle-right`。

要点:Vue2 `rightCollapsed` 初值 **false**(默认展开),New-UI 现为 `true`(1a 硬编码收起)——本期改回 `false` 以对齐 Vue2。**tab 选择不持久化**(Vue2 没有 localStorage,别自作多情;主题与选中模型才持久化)。右栏开关按钮 = `.icon-btn` + `AgentIcon name="panel"` + `:data-active="!store.rightCollapsed"`(Vue2 `AgentTopbar.vue:43-45`)。

- [ ] **Step 1: 写失败测试**:store 三例(默认值 / `setRightTab` 改值 / `toggleRight` 翻转);topbar 一例(点开关 emit `toggle-right`);AgentPage 两例(根元素 `data-rightcollapsed` 随 store 变化 / 默认为 `false`)。
- [ ] **Step 2: 跑测试确认失败。**
- [ ] **Step 3: 实现** —— store 加 state/两动作并进 return 表;topbar 在 `<!-- 1c: right-panel toggle -->` 处挂按钮并 emit;AgentPage 把 `:data-rightcollapsed="true"` 改成 `store.rightCollapsed`、接 `@toggle-right="store.toggleRight"`。
- [ ] **Step 4: 跑测试通过 + `pnpm exec vue-tsc --noEmit`。**
- [ ] **Step 5: Commit** `SP8-P1c2: right-panel collapse state + topbar toggle`

---

