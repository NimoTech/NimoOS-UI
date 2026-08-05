### Task 8: `ThinkingBar.vue` + 顶栏第二行

**Files:** Create `src/ai/components/shell/ThinkingBar.vue` + `.test.ts`;Modify `src/ai/components/shell/AgentTopbar.vue` + `.test.ts`、`src/ai/views/AgentPage.vue`、`src/i18n/{zh_cn,en_us}.ts`

逐字港 Vue2 `shell/ThinkingBar.vue`(105 行):props `enabled`(默认 true)/`level`(默认 `'medium'`,取值 `low|medium|high|max`)/`supportsThinking`(默认 false)/`providerType`;emits `update:enabled`/`update:level`(**保持显式 emit,不要改成 `defineModel`** —— 父组件持有状态);`.disabled` 根 class + 不支持时禁用两个控件 + 提示句;`providerNote` 仅 `providerType === 'deepseek'` 时给 DeepSeek 说明。
唯一裸色 `#fff`(开关滑块,Vue2:90)→ `var(--text-on-accent)`。
`AgentTopbar` 在 `<!-- 1c: ThinkingBar -->` 处挂第二行,props 从新增的 `thinking` prop 拆开传,并把两个 `update:*` 重映射成 `thinking-enabled`/`thinking-level` 往上抛(Vue2 `AgentTopbar.vue:47-54`);`AgentPage` 接到 `store.setThinkingEnabled`/`setThinkingLevel`。
i18n:`aiThinkingLabel`/`aiThinkingIntensity`/`aiThinkingLow|Medium|High|Max`/`aiThinkingUnsupported`/`aiThinkingDeepseekNote`(zh 中文、en 用 Vue2 英文原串)。

- [ ] **Step 1: 写失败测试**:不支持时两个控件都 disabled 且出提示 / 支持但关闭时强度选择器 disabled / 勾选与改强度分别 emit 正确值 / DeepSeek 提示只在该 providerType 出现 / topbar 把两个事件重映射后往上抛 / AgentPage 接到 store 两个动作。
- [ ] **Step 2: 跑测试确认失败。**
- [ ] **Step 3: 实现。**
- [ ] **Step 4: 跑测试 + tsc + `grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*white' src/ai/components/shell/ThinkingBar.vue` 无输出 + parity 绿。**
- [ ] **Step 5: Commit** `SP8-P1c2: ThinkingBar + topbar second row`

---

