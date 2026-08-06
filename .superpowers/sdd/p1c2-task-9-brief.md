### Task 9: `ModelPicker.vue` + 顶栏挂载 + 模型回退提示 + AI-rename 按钮

**Files:** Create `src/ai/util/modelPickerView.ts` + `.test.ts`、`src/ai/composables/useClickOutside.ts` + `.test.ts`、`src/ai/components/shell/ModelPicker.vue` + `.test.ts`;Modify `src/ai/components/shell/AgentTopbar.vue` + `.test.ts`、`src/ai/views/AgentPage.vue` + `.test.ts`、`src/i18n/{zh_cn,en_us}.ts`

**纯模块**(先做):`splitModels(list)` → `{ local, cloud }`;`cloudGroups(cloud, query)` → `[{ providerId, providerName, models }]`(**按首次出现顺序**分组;query 非空时**只按 `displayName` 过滤**,不搜 provider 名 —— Vue2 `:84-100` 如此);`formatModelSize(bytes)`(`>=1GB` → `x.x GB`,否则 `x MB`,`0/undefined` → `''`)。
**composable**:`useClickOutside(elRef, handler)` —— `document` 上 `mousedown`,挂载时加、卸载时摘(等价 Vue2 指令 `bind/unbind`,把 `beforeMount/unmounted` 的 Vue3 语义一次做对)。
**组件**逐字港 Vue2 `shell/ModelPicker.vue`:pill(`.model-pill` + `data-source` 图标 + `pillLabel`)、下拉 `v-if="open"`、本地组(`💻` + 名 + size meta)、云组(`☁️` + 按 provider 分子组 + `🧠` 支持思考角标)、**云模型 >6 才出搜索框**(`@click.stop`)、空态("暂无可用模型" + "去设置")。选中 → `emit('select', key)` 并关闭;外部点击 → 关闭并清 query。
**Vue3 必修的 Vue2-ism**:`<template v-for>` 的 `:key` 必须落在 `<template>` 上(Vue2 `:28-38` 放在了子元素上,Vue3 会告警/错乱);`directives: { 'click-outside' }` → 上面的 composable;补 `emits` 声明。
**「去设置」= 占位 toast**(用户 2026-07-27 决定,P2 才有设置区):复用现有 `aiSettingsComingSoon` 键(先确认文案通顺),经 `emit('open-settings')` 上抛给 `AgentPage`(那里已有 toast 占位处理,与顶栏设置按钮同一去处)。
**模型回退提示**(Vue2 `Agent.vue:133-142`):`AgentPage` 加 `lastFallbackNotice` watcher → `toast.show(t('aiModelFallback', {from, to}), 4000, 'warning')`(用 Task 6 的 warning 档);`to` 为空时用 `t('aiNoModelAvailable')` 兜底;**watcher 自己把 `store.lastFallbackNotice` 置回 null**(store 不负责清)。
**AI-rename 按钮**(顶栏 `<!-- 1c: AI-rename button -->`):`AgentIcon name="sparkle"`,`@click` → 上抛 `regenerate-title` → `AgentPage` 调 `store.regenerateTitle(store.activeSessionId)`;禁用条件照 Vue2 `AgentTopbar`:`isAnyRegenerating`(`r && r.id === sessionId`)或标题输入框正在编辑(`isFocused`);`isExplicitRegenerating`(`r && r.id === sessionId && !r.background`)时**禁用标题输入框**。

- [ ] **Step 1: 写失败测试** —— 纯模块 6 例(分组顺序 / 只按 displayName 过滤 / size 两档与空值);composable 2 例(外部 mousedown 触发 handler、卸载后不再触发);组件 8 例(pill 显示选中名 / 未选中与无模型两种 pill 文案 / 本地+云分组渲染 / 6 与 7 个云模型的搜索框有无 / 选中 emit 并关闭 / 外部点击关闭 / `🧠` 仅 supports_thinking 出现 / 空态点"去设置" emit);顶栏与页面 4 例(ModelPicker 挂载并转发 select → `store.selectModel`;open-settings → toast;AI-rename 点击 → `store.regenerateTitle` 且再生成中禁用;`lastFallbackNotice` 变化 → warning toast 且随后被置回 null)。
- [ ] **Step 2: 跑测试确认失败。**
- [ ] **Step 3: 实现。**
- [ ] **Step 4: 跑测试 + tsc + 零裸色 grep(组件与 composable)+ parity 绿。**
- [ ] **Step 5: Commit** `SP8-P1c2: ModelPicker + fallback notice + AI-rename button`

---

