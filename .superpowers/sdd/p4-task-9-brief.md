# SP8-P4 Task 9 任务书

**先读**(顺序不可换,本文件与它们冲突时以它们为准):
1. `.sp8/NimoOS-New-UI/.superpowers/sdd/p4-common-constraints.md` —— 公共约束,**你的行为准则**
2. `NimoOS-UI/docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p4-mcp-design.md` —— 设计文档,**权威**
   (公共约束 > 本任务书;设计文档 > 本任务书。发现冲突立即在报告里申报,不要默默选一边。)

## Global Constraints(计划原文,逐字)

- **工作区**:只写 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`)。**本期 Service 仓与两个后端仓零改动。**
- **界面 / 视觉 / 交互严格 1:1 照 Vue2**(DOM 结构、class、文案、尺寸、动效、键位、**组件拆分**);**逻辑 / bug 不照抄**,偏离必须三件套齐全(代码注释注明 Vue2 `file:line` + 报告申报 + 台账登记)。**未申报的偏离本身就是缺陷。**
- **一切可见颜色必须 `var(--…)` token**,禁 `#hex` / `rgb()` / `rgba()` / 具名色(`white`/`black` 也算)。**内联 `:style` 里的颜色同样违规。** ⚠️ `color-guard.test.ts` **不扫 `.scss`**,Task 1 的配色无回归网。
- **单层取数**:共享包 `service.ai.*` 已 `return res.data`,消费端**不许再剥一层**。Vue2 的 `resp.data` 照抄即缺陷(设计 §3,本期命中 4 处)。
- **界面永不回显后端原文 / JSON**,一律走 i18n 键映射(先例 `util/channelsFormat.ts:65-76`)。
- **新 i18n 键双档同增**(`src/i18n/{zh_cn,en_us}.ts`),值逐字照本计划 Task 4 的表,**不许自行翻译、不许改标点**(含 `·` `…` `(` `)` 与中文逗号句号)。字面 `@` 写成 `{'@'}`。
- **import 一律相对路径**(本仓无 `@/` 别名先例)。
- **状态一律组件本地 `ref`**,不新建 store。
- **组件里零 `<style>` 块**;用到的每个 CSS 类先 `grep` 确认存在。
- **toast 真签名**:`show(text: string, duration = 1500, tier: 'info'|'warning'|'danger' = 'info')`(`src/stores/toast.ts:18-27`)。
- **每个任务跑全量三门**,输出完整落盘,**禁 `| tail`**。基线 **296 文件 / 2574 例绿 · tsc 0 · build 0**。
- 禁 `git add -A` / `git add .`,只显式列路径;禁 rebase / reset / stash / merge / **push**。一个任务 = 一个语义提交。

## File Structure(全期文件落点,供你定位自己的位置)

| 文件 | 责任 | 任务 |
|

---

## Task 9: `McpSection.vue` + 接线 + 反转占位契约

**Files:**
- Create: `src/ai/components/settings/sections/McpSection.vue`
- Test: `src/ai/components/settings/sections/McpSection.test.ts`
- Modify: `src/ai/components/settings/sections.ts:88-96`(`DEFERRED_SECTIONS`)
- Modify: `src/ai/components/settings/sections.test.ts:57-59`
- Modify: `src/ai/views/SettingsPage.vue:44-96`(import + `SECTION_COMPONENTS`)
- Modify: `src/ai/views/SettingsPage.test.ts`(收口守卫 + 19b)

**Interfaces:**
- Consumes: 前八个任务的全部产物 + `service.ai.{listMCPServers,createMCPServer,updateMCPServer,deleteMCPServer}` + `useToast`
- Produces: 无 props/emits(分区组件)

**蓝本:** Vue2 `McpSection.vue`(136 行)。**孪生兄弟 `sections/SkillsSection.vue` 先读一遍**,四个数据方法的写法照它。

- [ ] **Step 1: 写失败的测试 `McpSection.test.ts`**

覆盖点:

1. **`reload` 单层取数**:mock `listMCPServers` 返回**裸数组** `[srv(1), srv(2)]` → 渲染出两个分组条目;首项自动选中(`activeId` 落第一项)
2. `listMCPServers` 抛错 → `toast.show(zh.aiMcpSrvLoadFailed, 3000, 'danger')`(断言三个实参)
3. 分组:enabled 的进「已启用服务」,disabled 的进「已停用服务」;两组都有时渲染两个 `McpServerGroup`
4. 搜索:按 `name` 命中、按 `url` 命中、都不命中 → `.sk-col-empty` 显示 `aiMcpSrvNoMatch` + `<code>` 里是查询词;空列表且无查询词 → `aiMcpSrvEmpty`
5. **搜索不清空右侧详情**(N4 的钉子):选中某项后输入一个匹配不到的查询词 → 列表空,但详情面板仍显示该服务器
6. `onToggle`:`updateMCPServer` 是 204 → **不读返回值**;成功后本地条目 `enabled` 翻转(断言该项从「已启用」组移到「已停用」组)+ toast `aiMcpSrvEnabledToast` / `aiMcpSrvDisabledToast`(两条对照);失败 → toast `aiMcpSrvUpdateFailed` danger 且**列表不变**
7. `onDelete`:成功 → 条目消失 + toast `aiMcpSrvRemovedName`(含名称);失败 → toast `aiCfgDeleteFailed` danger
8. **删除后选中项落位**(两条对照):删的是当前选中项 → `activeId` 落到剩余第一项;**删的不是当前选中项 → `activeId` 不动**
9. **`onSave` 新增单层取数**:mock `createMCPServer` 返回**裸 `{ id: 7 }`**(不是完整对象!)→ `activeId` 变 7 + toast `aiMcpSrvAddedName` + 弹窗关闭 + 触发一次 `listMCPServers` 重新加载
10. `onSave` 编辑 → 调 `updateMCPServer(editingId, payload)` + toast `aiCfgSaved` + 弹窗关
11. **保存失败弹窗不关**、行内错误走 `saveServerErrorKey` 的本地化文案(断言界面不含后端英文串)
12. 点 `+` 打开新增弹窗(`server` prop 为 null);点详情的 `edit` 事件打开编辑弹窗(`server` prop 为那一项)

**mock 骨架**(裸形状,`vi.hoisted`):
```ts
const h = vi.hoisted(() => ({
  listMCPServers: vi.fn(), createMCPServer: vi.fn(),
  updateMCPServer: vi.fn(), deleteMCPServer: vi.fn(), testMCPServer: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: h } }))
```
默认:`h.listMCPServers.mockResolvedValue([])`、`h.updateMCPServer.mockResolvedValue(undefined)`(204)、`h.deleteMCPServer.mockResolvedValue(undefined)`(204)、`h.createMCPServer.mockResolvedValue({ id: 7 })`。

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 写 `McpSection.vue`**

结构逐字照 Vue2 `:1-36`(与 `SkillsSection.vue:259-331` 的模板几乎一致,只是分组标签与搜索字段不同)。

四个数据方法照 Vue2 `:70-128`,但:
- **D1 单层取数**:`reload` 直接把返回值当数组用(`Array.isArray(list) ? list : []`);`onSave` 新建读 `(created as {id?: number})?.id`
- **D2**:`.sk-toast` 不移植,一律 `useToast().show(...)`;失败 tier 传 `'danger'` + 3000ms
- **D4**:不写 `console.error`
- **D5**:`onSave` 失败走 `saveError.value = t(saveServerErrorKey(e))` 传给 `McpServerModal` 的 `serverError` prop,**弹窗不关**;`watch(modalOpen)` 关闭时清 `saveError`(照 `SkillsSection.vue:126-128`)
- **D7**:`+` 按钮的 `AgentIcon` 不传 `color`
- **N4 照抄**:`activeServer` 在未过滤的 `servers` 上查
- 删除后选中项落位:**只有删的是当前选中项**才落到剩余第一项(Vue2 `:102`)

- [ ] **Step 4: 接线三处**

1. `sections.ts` —— `DEFERRED_SECTIONS` 改成 `[]`,注释改写:

```ts
/**
 * 留给后续阶段、内容区仍渲染 `SectionPlaceholder` 并弹一条 info toast 的分区。
 * SP8-P4 起**为空** —— 13 个分区全部接入真组件(`mcp` 是最后一个,P4 收口)。
 * 机制本身保留(用户 2026-07-31 明示「反转不删」):将来新增未完成分区时,
 * 把 id 加回本数组即可恢复占位行为,`SettingsPage.vue` 的分支与
 * `SectionPlaceholder.vue` 都原样留着。
 */
export const DEFERRED_SECTIONS: SectionId[] = []
```

2. `SettingsPage.vue` —— 加 import 与映射:

```ts
import McpSection from '../components/settings/sections/McpSection.vue'
// …
  mcp: McpSection, // SP8-P4 Task 9 —— 已实现,收官接线(DEFERRED_SECTIONS 就此清空)
```
并更新文件头 `:74-77` 那段「现在只剩 mcp 一个仍渲染 SectionPlaceholder」的注释。

3. `SettingsPage.vue` 的 `placeholderProps()` 与 deferred toast 分支**保持不动**(机制保留)。

- [ ] **Step 5: 反转占位契约用例(不许删)**

`sections.test.ts:57-59` 现在是:
```ts
it('DEFERRED_SECTIONS(P4 占位)恰为 mcp(skills 已于 P3a 接入真组件）', () => {
  expect([...DEFERRED_SECTIONS].sort()).toEqual(['mcp'])
})
```
改成:
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

`SettingsPage.test.ts:437` 的 19b 改成反面(**贴改前/改后原文进报告**):
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
  expect(w.find('.sk-col-search').exists()).toBe(true)   // McpSection 的左列搜索框
  expect(w.text()).not.toContain(zh.aiCfgPlaceholderBody)
  expect(showSpy).not.toHaveBeenCalled()
  w.unmount()
})
```

`SettingsPage.test.ts:315` 的收口守卫改成 13 个分区全实现:把 `'mcp'` 加进 `implemented` 数组,标题与注释同步改。

⚠️ `SettingsPage.test.ts` 里的 `stubNetworkActions` 可能不覆盖 MCP 的 `listMCPServers` —— 先读该测试文件的 mock 设置,按既有惯例补上(**不要削弱既有断言**)。

- [ ] **Step 6: 跑测试确认通过 + RED 探针**

RED 探针:把 `onDelete` 里 `if (activeId.value === id)` 的条件删掉(改成无条件落位)→ 确认第 8 条「删的不是当前选中项 → activeId 不动」精确报红 → 还原、`git status` 干净。

- [ ] **Step 7: 跑全量三门**

日志名 `p4-t9-*`。**新增 1 个 `.vue` → color-guard +1。**
本任务后累计新增 4 个 `.vue`(Group / Detail / Modal / Section)→ color-guard 相对基线 **+4**。

- [ ] **Step 8: Commit**

```bash
git add src/ai/components/settings/sections/McpSection.vue \
        src/ai/components/settings/sections/McpSection.test.ts \
        src/ai/components/settings/sections.ts \
        src/ai/components/settings/sections.test.ts \
        src/ai/views/SettingsPage.vue \
        src/ai/views/SettingsPage.test.ts
git commit -m "feat(ai): SP8-P4 T9 McpSection 接线,DEFERRED_SECTIONS 清空"
```
