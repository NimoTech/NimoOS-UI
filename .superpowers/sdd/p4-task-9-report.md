# SP8-P4 Task 9 报告 —— McpSection.vue + 接线 + 反转占位契约

提交:`69af8ed2b1f78d2518f3be08f5062cbe98cf4fbd`
分支:`sp8-ai`(工作区 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`)

## 1. 改了什么文件

| 文件 | 改动 |
|---|---|
| `src/ai/components/settings/sections/McpSection.vue`(新增) | 分区容器组件,1:1 移植 Vue2 136 行 |
| `src/ai/components/settings/sections/McpSection.test.ts`(新增) | 22 条用例(12 条 brief 覆盖点 + 2 条协调者追加集成用例,部分覆盖点拆成 a/b/c/d 独立用例) |
| `src/ai/components/settings/sections.ts` | `DEFERRED_SECTIONS: SectionId[] = []`,注释按任务书 Step 4 原文重写 |
| `src/ai/components/settings/sections.test.ts` | 反转 `DEFERRED_SECTIONS` 断言(1 条改 2 条) |
| `src/ai/views/SettingsPage.vue` | import `McpSection`,`SECTION_COMPONENTS.mcp` 从 `SectionPlaceholder` 换成 `McpSection`,文件头注释同步改写 |
| `src/ai/views/SettingsPage.test.ts` | `ai` hoisted mock 补 `listMCPServers`;19b 反转;收口守卫改 13 分区实现、删掉空转的 deferred 循环 |

## 2. Vue2 file:line → New-UI 对照(逐方法)

| Vue2 | New-UI | 承接的行为 |
|---|---|---|
| `McpSection.vue:1-36`(模板) | `McpSection.vue` `<template>` | DOM 结构/class 逐字:`set-split`/`sk-col*`/`sk-list`/`sk-col-empty`/`sk-spinner` 全部照抄,内联 `style="width:18px;height:18px"` 与 `style="display:grid;place-items:center;padding:28px 0"` 是尺寸不是颜色,照抄 |
| `:57-64`(computed) | `filtered`/`enabled`/`disabled`/`activeServer` | 搜索只匹配 `name`/`url`(不搜 `command`)照抄;`activeServer` 在未过滤 `servers` 上查(N4,见下) |
| `:70-82`(`reload`) | `reload()` | 选中态保持逻辑(`:75-77`)逐字对齐;**偏离 D1 第 1 处**(见 §4) |
| `:86-96`(`onToggle`) | `onToggle()` | 204 不读返回值,`splice` 原地替换,行为逐字对齐 |
| `:97-108`(`onDelete`) | `onDelete()` | 删除后选中项落位条件(`:102`)逐字对齐:只有删的是当前选中项才落到剩余第一项 |
| `:109-128`(`onSave`) | `onSave()` | **偏离 D1 第 2 处**(新建单层取数)+ **D5**(失败不回显后端原文,弹窗不关) |
| `:32-34`(`.sk-toast`) | 不移植 | **偏离 D2**(见下) |
| `:79,93,105,124`(`console.error`) | 不写 | **偏离 D4** |
| `:7`(`+` 按钮 `color="white"`) | 不传 `color` | **偏离 D7** |

## 3. 与孪生兄弟 `SkillsSection.vue` 的一致性

四个数据方法的结构(`try/catch/finally`、toast 调用点、`saveError`/`watch(modalOpen)` 清错误逻辑)与 `SkillsSection.vue` 的 `reload`/`onToggle`/`onDelete`/`onCreate` 逐一对照,未引入第三种模式。`+` 按钮不传色、图标全部走 `AgentIcon`,与 `SkillsSection.vue` 完全同构。

## 4. 偏离显式申报

### D1 单层取数(公共约束 §3 第 1 条,强制,本任务命中两处)

1. **`reload()`**:Vue2 `:74` `this.servers = resp.data || []`。共享包 `service.ai.listMCPServers()` 已 `return res.data`(剥过一次 axios 层),后端 `mcp.go:96` 是裸数组,再剥一次恒 `undefined`,`|| []` 兜底把这件事盖住,列表永远空。本仓:`const list = await service.ai.listMCPServers(); servers.value = Array.isArray(list) ? list : []`。测试覆盖点 1(裸数组渲染两条目)与设计文档验收点 1 对应。
2. **`onSave` 新建分支**:Vue2 `:117` `const id = resp.data && resp.data.id`。后端 `201 {"id": <int64>}`,再剥一次恒 `undefined`,新建后不选中新服务器。本仓:`const created = await service.ai.createMCPServer(...); const id = (created as { id?: number } | undefined)?.id`。测试覆盖点 9 用裸 `{id:7}` mock 精确验证。

### D2 `.sk-toast` 不移植(公共约束 §3 第 2 条)

Vue2 `:32-34` 的 `.sk-toast` 模板无条件渲染绿色 check 图标(`<SkillIcon name="check" ... color="white" />`),连失败提示也顶着"成功"勾。本仓全部改用 `useToast().show(text, duration, tier)`,失败态显式传 `'danger'` + `3000`,不会带勾。测试覆盖点 2/6c/7b 断言 `danger` tier。

### D4 `console.error` 不照抄(公共约束 §3 第 4 条)

Vue2 `:79,93,105,124` 四处 `console.error(...)` 全部未移植——三个兄弟分区(BlacklistSection/ExecutionSection/MemorySection)与 `SkillsSection.vue` 都没有这个惯例,静默吞错 + toast 已足够。

### D5 HTTP 层失败不回显后端 body(公共约束 §3 第 5 条)

`onSave` 失败不再读 Vue2 `:125` 的 `e.response.data.message`(后端英文原文),改用 `util/mcpErrorKey.ts`(T3)的 `saveServerErrorKey(e)` 映射成 i18n 键,赋给 `saveError`,传给 `McpServerModal` 的 `serverError` prop——**弹窗不关**。`watch(modalOpen)` 关闭时清 `saveError`(照 `SkillsSection.vue:126-128`)。测试覆盖点 11 用 `{ response: { data: { message: 'url required for http/sse' } } }` 验证:界面显示 `aiMcpSrvErrUrlRequired` 的中文文案,`document.body.textContent` 不包含后端英文原串 `'url required for http/sse'`,且弹窗仍开。

### D7 `+` 按钮不传具名色(公共约束 §3 第 7 条)

Vue2 `:7` `<SkillIcon name="plus" ... color="white" />`。本仓 `<AgentIcon name="plus" :size="15" />` 不传 `color`,走 `currentColor`,由 `.sk-add-btn` 的 `--text-on-accent`(`skills-styles.scss:183` 起)供色。

### N4 照抄不改,确认(公共约束 §3.5 第 4 条)

`activeServer` 在**未过滤**的 `servers` 上查(`servers.value.find(s => s.id === activeId.value)`),不是在 `filtered` 上查——搜索时右侧详情面板不清空。测试覆盖点 5 直接验证:选中 `beta` 后输入不匹配的查询词,列表为空但详情仍显示 `beta`。与 `SkillsSection.vue` 的 `activeSkill` 同款,本文件未改动这个决定。

## 5. i18n 复用(本任务无新增键——键在 T4 已全部加好)

用到但不属于本任务新增的键(逐一 grep 确认存在,值见 `src/i18n/zh_cn.ts`):
`aiCfgRefresh` `aiMcpSrvAdd` `aiMcpSrvSearchPlaceholder` `aiMcpSrvGroupEnabled` `aiMcpSrvGroupDisabled` `aiMcpSrvNoMatch` `aiMcpSrvEmpty` `aiMcpSrvLoadFailed` `aiMcpSrvEnabledToast` `aiMcpSrvDisabledToast` `aiMcpSrvUpdateFailed` `aiMcpSrvRemovedName` `aiMcpSrvAddedName` `aiCfgDeleteFailed` `aiCfgSaved`。

## 6. 反转的三处占位契约用例:改前/改后原文

### 6.1 `sections.test.ts:57-59`

**改前:**
```ts
it('DEFERRED_SECTIONS(P4 占位)恰为 mcp(skills 已于 P3a 接入真组件）', () => {
  expect([...DEFERRED_SECTIONS].sort()).toEqual(['mcp'])
})
```

**改后:**
```ts
// SP8-P4 —— mcp 已接入真组件 McpSection,DEFERRED_SECTIONS 就此清空。
// 契约机制本身保留(用户明示「反转不删」),这条钉住「没有任何分区还在占位」。
it('DEFERRED_SECTIONS 为空(SP8-P4 起 13 个分区全部接入真组件)', () => {
  expect(DEFERRED_SECTIONS).toEqual([])
})

// 机制没被删掉的钉子:常量仍然导出、仍是数组、且每个元素(若将来有)都必须是
// 合法 section id。
it('DEFERRED_SECTIONS 机制仍在(导出为数组,元素必须是合法 section id)', () => {
  expect(Array.isArray(DEFERRED_SECTIONS)).toBe(true)
  for (const id of DEFERRED_SECTIONS) expect(VALID_SECTIONS).toContain(id)
})
```

### 6.2 `SettingsPage.test.ts` 19b

**改前:**
```ts
it('19b. 选中 mcp → 仍弹一条占位 toast(DEFERRED_SECTIONS 契约仍在,只是不再含 skills)', async () => {
  const store = useSettingsStore()
  stubNetworkActions(store)
  const { w } = await mountPage()
  await flushPromises()
  const toast = useToast()
  const showSpy = vi.spyOn(toast, 'show')
  const item = w.findAll('.set-nav-item').find((n) => n.text().includes('MCP 连接'))!
  await item.trigger('click')
  expect(showSpy).toHaveBeenCalledWith('该分区将在后续阶段开启', 3000)
  w.unmount()
})
```

**改后:**
```ts
it('19b. 选中 mcp → 渲染 McpSection 真实内容,不弹 toast(不再是占位)', async () => {
  const store = useSettingsStore()
  stubNetworkActions(store)
  const { w } = await mountPage()
  await flushPromises()
  const toast = useToast()
  const showSpy = vi.spyOn(toast, 'show')
  const item = w.findAll('.set-nav-item').find((n) => n.text().includes('MCP 连接'))!
  await item.trigger('click')
  await flushPromises()
  expect(w.find('.sk-col-search').exists()).toBe(true) // McpSection 的左列搜索框
  expect(w.text()).not.toContain(zh.aiCfgPlaceholderBody)
  expect(showSpy).not.toHaveBeenCalled()
  w.unmount()
})
```

### 6.3 `SettingsPage.test.ts` 收口守卫(原 315 行起)

**改前:**
```ts
it('SP8-P3a 收口 —— 12 个已实现分区渲染后页面不含占位文案，mcp 仍含占位文案', async () => {
  const store = useSettingsStore()
  stubNetworkActions(store)
  const { w } = await mountPage()
  await flushPromises()

  const implemented: SectionId[] = [
    'models', 'providers', 'privacy', 'thinking',
    'blacklist', 'execution', 'search', 'memory', 'observability', 'skills', 'mcptokens', 'channels',
  ]
  for (const id of implemented) {
    store.setActiveSection(id)
    await flushPromises()
    expect(w.text()).not.toContain(zh.aiCfgPlaceholderBody)
  }

  const deferred: SectionId[] = ['mcp']
  for (const id of deferred) {
    store.setActiveSection(id)
    await flushPromises()
    expect(w.text()).toContain(zh.aiCfgPlaceholderBody)
  }

  w.unmount()
})
```

**改后:**
```ts
it('SP8-P4 收口 —— 13 个已实现分区渲染后页面不含占位文案(无一分区仍是 SectionPlaceholder）', async () => {
  const store = useSettingsStore()
  stubNetworkActions(store)
  const { w } = await mountPage()
  await flushPromises()

  const implemented: SectionId[] = [
    'models', 'providers', 'privacy', 'thinking',
    'blacklist', 'execution', 'search', 'memory', 'observability', 'skills', 'mcp', 'mcptokens', 'channels',
  ]
  for (const id of implemented) {
    store.setActiveSection(id)
    await flushPromises()
    expect(w.text()).not.toContain(zh.aiCfgPlaceholderBody)
  }

  w.unmount()
})
```

**申报:** 原 `deferred` 循环体在 `DEFERRED_SECTIONS` 清空后再无元素可迭代(空数组 `for` 循环体不执行),留着就是空转断言(公共约束 §9「禁空转用例」),故整段删除而不是改成空数组占位。机制层面「DEFERRED_SECTIONS 是否被整个删掉」的钉子已经由 `sections.test.ts` 新增的两条用例覆盖(空数组 + 类型/元素合法性),不是本处删除内容后就无人看管。

## 7. 协调者追加的两条集成用例

来源:T8 评审发现 `McpServerModal` 的 `watch(open)` true 分支从 `props.server` 回填表单,依赖父组件同步设置 `server`+`open` 两个 prop 的时序,单组件测不到。

- **「编辑 A → 关闭 → 编辑 B」**:`McpSection.test.ts` describe 块 `McpSection — 弹窗常驻实例的表单残留回归` 第一条。流程:`detail.vm.$emit('edit', srv(1,{name:'server-A'}))` → 断言 `modalNameInput().value === 'server-A'` → 点 `.sk-x` 关闭 → 断言 `.sk-modal` 消失 → `detail.vm.$emit('edit', srv(2,{name:'server-B'}))` → 断言 `modalNameInput().value === 'server-B'` 且不等于 `'server-A'`。**结果:通过。**
- **「新增 → 关闭 → 编辑」**:同 describe 块第二条。流程:点 `.sk-add-btn` → 断言名称输入框为空 → 手填 `'leftover-draft-name'` → 点 `.sk-x` 关闭 → `detail.vm.$emit('edit', srv(1,{name:'existing-server'}))` → 断言名称输入框是 `'existing-server'`,不是 `'leftover-draft-name'`。**结果:通过。**

两条用例能通过,依据是 `McpSection.vue` 的 `openCreate`/`openEdit` 在**同一函数体内**先设 `editing.value` 再设 `modalOpen.value = true`(与 `McpServerModal` 的 `watch(() => props.open, ...)` 时序吻合,`props.server` 在 `open` 变化前已经是新值),不需要额外的 `nextTick` 排序处理。

## 8. Step 6 RED 探针(两段完整输出)+ 还原确认

**破坏:** 把 `onDelete` 里 `if (activeId.value === id)` 改成 `if (true)`(无条件回落）。

**RED(1 例报红,21 例仍绿):**
```
stderr | src/ai/components/settings/sections/McpSection.test.ts > McpSection > 8b. 删的不是当前选中项 → activeId 不动
[Vue warn]: Component "i18n-t" has already been registered in target app.
...

 ❯ src/ai/components/settings/sections/McpSection.test.ts (22 tests | 1 failed) 502ms
     × 8b. 删的不是当前选中项 → activeId 不动 15ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/ai/components/settings/sections/McpSection.test.ts > McpSection > 8b. 删的不是当前选中项 → activeId 不动
AssertionError: expected 'svc-a' to be 'svc-c' // Object.is equality

Expected: "svc-c"
Received: "svc-a"

 ❯ src/ai/components/settings/sections/McpSection.test.ts:299:44
    297|     // 剩余 [a, c] 的第一项是 a——若无条件回落会错误跳成 a;正确实现应仍是 c。
    298|     expect(w.findAll('.sk-item')).toHaveLength(2)
    299|     expect(w.find('.sk-name span').text()).toBe('svc-c')
       |                                            ^
    300|   })
    301|

 Test Files  1 failed (1)
      Tests  1 failed | 21 passed (22)
```

**还原后 GREEN:**
```
 RUN  v4.1.9 /home/nimo/NimoTech/.sp8/NimoOS-New-UI

 Test Files  1 passed (1)
      Tests  22 passed (22)
   Start at  13:59:43
   Duration  1.70s
```

**`git status` 干净确认(RED 探针前后对比,只有 T9 六个既定文件被改动,无残留破坏):**
```
 M src/ai/components/settings/sections.test.ts
 M src/ai/components/settings/sections.ts
 M src/ai/views/SettingsPage.test.ts
 M src/ai/views/SettingsPage.vue
?? src/ai/components/settings/sections/McpSection.test.ts
?? src/ai/components/settings/sections/McpSection.vue
```

## 9. 三门完整终值

```
pnpm test                  exit=0    Test Files  302 passed (302) / Tests  2717 passed (2717)
pnpm exec vue-tsc --noEmit exit=0    (无输出)
pnpm build                 exit=0    ✓ built in 11.95s(仅既有 >500KB chunk 警告,无新增警告)
```

无红项。

**算术核对:** 本任务新增 1 个 `.vue` 文件(`McpSection.vue`)→ `color-guard.test.ts` 全量 +1。P4 全期(T1-T9)累计新增 4 个 `.vue`(T5 `McpServerGroup.vue` / T6-T7 `McpServerDetail.vue` / T8 `McpServerModal.vue` / T9 `McpSection.vue`),相对 P4 开工前基线(296 文件/2574 例)应为 +4 文件。本次终值 302 文件 / 2717 例 —— 相对基线 +6 文件符合预期(P4 全期还新增了 2 个非 `.vue` 的测试文件:`mcpServerVisual.test.ts`/`mcpErrorKey.test.ts`,T2/T3 产物,不参与 color-guard 计数但计入 Test Files 总数);测试例数增量(+143)由 T1-T9 累计的所有新用例(McpServerGroup/Detail/Modal/mcpServerVisual/mcpErrorKey 各自的 `.test.ts` + 本任务 22 例)共同构成,均已在各自任务的报告中核对过,本任务只新增 22 例(McpSection.test.ts)。

## 10. NEEDS_CONTEXT / 遗留

无。所有 12 条 brief 覆盖点 + 2 条协调者追加集成用例均已实现并通过,三门全绿,提交内容与预期文件列表完全一致。
