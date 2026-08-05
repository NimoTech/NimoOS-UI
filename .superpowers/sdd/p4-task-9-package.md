# P4 Task 9 review package — 9e5b481..HEAD

## commits
69af8ed feat(ai): SP8-P4 T9 McpSection 接线,DEFERRED_SECTIONS 清空

## stat
 src/ai/components/settings/sections.test.ts        |  13 +-
 src/ai/components/settings/sections.ts             |   8 +-
 .../settings/sections/McpSection.test.ts           | 444 +++++++++++++++++++++
 src/ai/components/settings/sections/McpSection.vue | 280 +++++++++++++
 src/ai/views/SettingsPage.test.ts                  |  46 ++-
 src/ai/views/SettingsPage.vue                      |  16 +-
 6 files changed, 782 insertions(+), 25 deletions(-)

## diff -U10
diff --git a/src/ai/components/settings/sections.test.ts b/src/ai/components/settings/sections.test.ts
index daeccfc..4e3d02b 100644
--- a/src/ai/components/settings/sections.test.ts
+++ b/src/ai/components/settings/sections.test.ts
@@ -47,21 +47,30 @@ describe('sections 导航配置', () => {
   })
 
   it('groupOf 对未知 id 回落到第一个组(Vue2 sections.js:62-64 同款兜底)', () => {
     expect(groupOf('nope').id).toBe('model')
   })
 
   it('SPLIT_SECTIONS 恰为 skills / mcp', () => {
     expect([...SPLIT_SECTIONS].sort()).toEqual(['mcp', 'skills'])
   })
 
-  it('DEFERRED_SECTIONS(P4 占位)恰为 mcp(skills 已于 P3a 接入真组件）', () => {
-    expect([...DEFERRED_SECTIONS].sort()).toEqual(['mcp'])
+  // SP8-P4 —— mcp 已接入真组件 McpSection,DEFERRED_SECTIONS 就此清空。
+  // 契约机制本身保留(用户明示「反转不删」),这条钉住「没有任何分区还在占位」。
+  it('DEFERRED_SECTIONS 为空(SP8-P4 起 13 个分区全部接入真组件)', () => {
+    expect(DEFERRED_SECTIONS).toEqual([])
+  })
+
+  // 机制没被删掉的钉子:常量仍然导出、仍是数组、且每个元素(若将来有)都必须是
+  // 合法 section id。
+  it('DEFERRED_SECTIONS 机制仍在(导出为数组,元素必须是合法 section id)', () => {
+    expect(Array.isArray(DEFERRED_SECTIONS)).toBe(true)
+    for (const id of DEFERRED_SECTIONS) expect(VALID_SECTIONS).toContain(id)
   })
 
   it('每个分区都有图标名与 i18n 键,且 labelKey 走 aiCfg 前缀', () => {
     for (const it of ALL_ITEMS) {
       expect(it.icon.length).toBeGreaterThan(0)
       expect(it.labelKey).toMatch(/^aiCfg/)
     }
   })
 })
diff --git a/src/ai/components/settings/sections.ts b/src/ai/components/settings/sections.ts
index 88b7209..849a5d0 100644
--- a/src/ai/components/settings/sections.ts
+++ b/src/ai/components/settings/sections.ts
@@ -81,19 +81,21 @@ export const ALL_ITEMS: SectionItem[] = GROUPS.reduce<SectionItem[]>(
   [],
 )
 
 export const VALID_SECTIONS: SectionId[] = ALL_ITEMS.map((i) => i.id)
 
 /** 双栏满高布局(左列表 + 右详情),不能竖排。Vue2 `Settings.vue:92`。 */
 export const SPLIT_SECTIONS: SectionId[] = ['skills', 'mcp']
 
 /**
  * 留给后续阶段、内容区仍渲染 `SectionPlaceholder` 并弹一条 info toast 的分区。
- * `skills` 已于 SP8-P3a 接入真组件（`SkillsSection`），从本列表移出；
- * `mcp` 仍待 P4。导航里照 Vue2 1:1 显示（用户 2026-07-28 决定）。
+ * SP8-P4 起**为空** —— 13 个分区全部接入真组件(`mcp` 是最后一个,P4 收口)。
+ * 机制本身保留(用户 2026-07-31 明示「反转不删」):将来新增未完成分区时,
+ * 把 id 加回本数组即可恢复占位行为,`SettingsPage.vue` 的分支与
+ * `SectionPlaceholder.vue` 都原样留着。
  */
-export const DEFERRED_SECTIONS: SectionId[] = ['mcp']
+export const DEFERRED_SECTIONS: SectionId[] = []
 
 /** 某个分区所属的组;未知 id 回落到第一个组(Vue2 `sections.js:62-64` 同款兜底)。 */
 export function groupOf(sectionId: string): SectionGroup {
   return GROUPS.find((g) => g.items.some((i) => i.id === sectionId)) || GROUPS[0]
 }
diff --git a/src/ai/components/settings/sections/McpSection.test.ts b/src/ai/components/settings/sections/McpSection.test.ts
new file mode 100644
index 0000000..02f390a
--- /dev/null
+++ b/src/ai/components/settings/sections/McpSection.test.ts
@@ -0,0 +1,444 @@
+import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
+import { mount } from '@vue/test-utils'
+import { nextTick } from 'vue'
+import { createI18n } from 'vue-i18n'
+import { setActivePinia, createPinia } from 'pinia'
+import zh from '../../../../i18n/zh_cn'
+import type { McpServer } from '../../../types/mcpServer'
+import McpServerGroup from '../mcp/McpServerGroup.vue'
+import McpServerDetail from '../mcp/McpServerDetail.vue'
+
+// SP8-P4 Task 9(收官)—— 对齐 Vue2 src/views/AI/MCP/McpSection.vue(136 行)。
+// mock 骨架逐字照 brief §Step1「mock 骨架」段与公共约束 §9(vi.hoisted 避免 ESM
+// 提升的 TDZ,先例 agentStore.test.ts:4-19)。
+const h = vi.hoisted(() => ({
+  listMCPServers: vi.fn(),
+  createMCPServer: vi.fn(),
+  updateMCPServer: vi.fn(),
+  deleteMCPServer: vi.fn(),
+  testMCPServer: vi.fn(),
+}))
+vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: h } }))
+
+import McpSection from './McpSection.vue'
+import { useToast } from '../../../../stores/toast'
+
+const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
+
+function withHost() {
+  const host = document.createElement('div')
+  host.className = 'set-app'
+  document.body.appendChild(host)
+  return host
+}
+
+function srv(id: number, overrides: Partial<McpServer> = {}): McpServer {
+  return {
+    id,
+    name: `server-${id}`,
+    transport: 'http',
+    url: `https://example.com/mcp-${id}`,
+    command: '',
+    args: [],
+    enabled: true,
+    has_headers: false,
+    has_env: false,
+    ...overrides,
+  }
+}
+
+const mountSection = () => mount(McpSection, { global: { plugins: [i18n] }, attachTo: document.body })
+const flush = async () => { await nextTick(); await nextTick(); await nextTick() }
+// McpServerModal 打开态聚焦用 setTimeout(fn, 0)(宏任务,见该组件头注释「reka 初始
+// 焦点实测结论」),纯微任务级 flush() 追不上;先例 McpServerModal.test.ts::macroFlush。
+const macroFlush = async () => { await flush(); await new Promise((r) => setTimeout(r, 0)); await flush() }
+
+function modalNameInput() { return document.querySelector('.sk-modal [data-f="name"]') as HTMLInputElement }
+function modalTitleEl() { return document.querySelector('.sk-modal .sk-modal-title') as HTMLElement }
+function modalCloseBtn() { return document.querySelector('.sk-modal .sk-x') as HTMLButtonElement }
+function modalSubmitBtn() { return document.querySelector('.sk-modal-foot .sk-btn.primary') as HTMLButtonElement }
+function modalFieldErr() { return document.querySelector('.sk-modal .sk-field-err') as HTMLElement | null }
+function setValue(el: HTMLInputElement, v: string) {
+  el.value = v
+  el.dispatchEvent(new Event('input'))
+}
+
+beforeEach(() => {
+  setActivePinia(createPinia())
+  Object.values(h).forEach((fn) => fn.mockReset())
+  h.listMCPServers.mockResolvedValue([])
+  h.updateMCPServer.mockResolvedValue(undefined) // 204
+  h.deleteMCPServer.mockResolvedValue(undefined) // 204
+  h.createMCPServer.mockResolvedValue({ id: 7 })
+  withHost()
+})
+
+afterEach(() => {
+  document.body.innerHTML = ''
+})
+
+describe('McpSection', () => {
+  // ===== 覆盖点 1:reload 单层取数 + 首项自动选中 =====
+  it('1. listMCPServers 返回裸数组 → 渲染两个分组条目,首项自动选中', async () => {
+    h.listMCPServers.mockResolvedValue([srv(1), srv(2)])
+    const w = mountSection()
+    await flush()
+    expect(w.findAll('.sk-item')).toHaveLength(2)
+    // 首项(server-1)自动选中——详情面板展示它的名字。
+    expect(w.find('.sk-name span').text()).toBe('server-1')
+  })
+
+  // ===== 覆盖点 2:reload 失败 =====
+  it('2. listMCPServers 抛错 → toast.show(aiMcpSrvLoadFailed, 3000, danger)', async () => {
+    h.listMCPServers.mockRejectedValue(new Error('boom'))
+    const toast = useToast()
+    const show = vi.spyOn(toast, 'show')
+    const w = mountSection()
+    await flush()
+    expect(show).toHaveBeenCalledWith(zh.aiMcpSrvLoadFailed, 3000, 'danger')
+  })
+
+  // ===== 覆盖点 3:分组 =====
+  it('3. enabled 进「已启用服务」,disabled 进「已停用服务」,两组都有时渲染两个 McpServerGroup', async () => {
+    h.listMCPServers.mockResolvedValue([
+      srv(1, { enabled: true }),
+      srv(2, { enabled: false }),
+    ])
+    const w = mountSection()
+    await flush()
+    const groups = w.findAllComponents(McpServerGroup)
+    expect(groups).toHaveLength(2)
+    expect(groups[0].props('label')).toBe(zh.aiMcpSrvGroupEnabled)
+    expect(groups[0].props('items').map((s: McpServer) => s.id)).toEqual([1])
+    expect(groups[1].props('label')).toBe(zh.aiMcpSrvGroupDisabled)
+    expect(groups[1].props('items').map((s: McpServer) => s.id)).toEqual([2])
+  })
+
+  // ===== 覆盖点 4:搜索(name/url 命中 + 两种空态) =====
+  it('4a. 搜索按 name 命中', async () => {
+    h.listMCPServers.mockResolvedValue([
+      srv(1, { name: 'brave-search-token', url: 'https://a.example.com' }),
+      srv(2, { name: 'notion', url: 'https://b.example.com' }),
+    ])
+    const w = mountSection()
+    await flush()
+    await w.find('.sk-col-search input').setValue('brave-search')
+    await flush()
+    expect(w.findAll('.sk-item')).toHaveLength(1)
+    expect(w.find('.sk-item-name').text()).toBe('brave-search-token')
+  })
+
+  it('4b. 搜索按 url 命中', async () => {
+    h.listMCPServers.mockResolvedValue([
+      srv(1, { name: 'aaa', url: 'https://unique-url-token.example.com' }),
+      srv(2, { name: 'bbb', url: 'https://other.example.com' }),
+    ])
+    const w = mountSection()
+    await flush()
+    await w.find('.sk-col-search input').setValue('unique-url-token')
+    await flush()
+    expect(w.findAll('.sk-item')).toHaveLength(1)
+    expect(w.find('.sk-item-name').text()).toBe('aaa')
+  })
+
+  it('4c. 都不命中 → .sk-col-empty 显示 aiMcpSrvNoMatch + <code> 里是查询词', async () => {
+    h.listMCPServers.mockResolvedValue([srv(1), srv(2)])
+    const w = mountSection()
+    await flush()
+    await w.find('.sk-col-search input').setValue('nope-nothing-matches')
+    await flush()
+    expect(w.find('.sk-col-empty').text()).toContain(zh.aiMcpSrvNoMatch)
+    expect(w.find('.sk-col-empty code').text()).toBe('nope-nothing-matches')
+  })
+
+  it('4d. 空列表且无查询词 → aiMcpSrvEmpty', async () => {
+    h.listMCPServers.mockResolvedValue([])
+    const w = mountSection()
+    await flush()
+    expect(w.find('.sk-col-empty').text()).toBe(zh.aiMcpSrvEmpty)
+  })
+
+  // ===== 覆盖点 5:搜索不清空右侧详情(N4 的钉子) =====
+  it('5. 选中某项后输入匹配不到的查询词 → 列表空,但详情面板仍显示该服务器', async () => {
+    h.listMCPServers.mockResolvedValue([srv(1, { name: 'alpha' }), srv(2, { name: 'beta' })])
+    const w = mountSection()
+    await flush()
+    await w.findAll('.sk-item')[1].trigger('click')
+    await flush()
+    expect(w.find('.sk-name span').text()).toBe('beta')
+
+    await w.find('.sk-col-search input').setValue('zzz-no-match')
+    await flush()
+    expect(w.findAll('.sk-item')).toHaveLength(0)
+    expect(w.find('.sk-name span').text()).toBe('beta')
+  })
+
+  // ===== 覆盖点 6:onToggle(204 不读返回值 + 分组移动 + toast 对照 + 失败） =====
+  it('6a. toggle 成功(enabled→disabled):204 不读返回值,列表项从已启用组移到已停用组,toast aiMcpSrvDisabledToast', async () => {
+    h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a', enabled: true })])
+    const toast = useToast()
+    const show = vi.spyOn(toast, 'show')
+    const w = mountSection()
+    await flush()
+
+    const detail = w.findComponent(McpServerDetail)
+    detail.vm.$emit('toggle', 1, false)
+    await flush()
+
+    expect(h.updateMCPServer).toHaveBeenCalledWith(1, { enabled: false })
+    const groups = w.findAllComponents(McpServerGroup)
+    expect(groups).toHaveLength(1)
+    expect(groups[0].props('label')).toBe(zh.aiMcpSrvGroupDisabled)
+    expect(show).toHaveBeenCalledWith(zh.aiMcpSrvDisabledToast)
+  })
+
+  it('6b. toggle 成功(disabled→enabled):toast aiMcpSrvEnabledToast(对照)', async () => {
+    h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a', enabled: false })])
+    const toast = useToast()
+    const show = vi.spyOn(toast, 'show')
+    const w = mountSection()
+    await flush()
+
+    const detail = w.findComponent(McpServerDetail)
+    detail.vm.$emit('toggle', 1, true)
+    await flush()
+
+    const groups = w.findAllComponents(McpServerGroup)
+    expect(groups[0].props('label')).toBe(zh.aiMcpSrvGroupEnabled)
+    expect(show).toHaveBeenCalledWith(zh.aiMcpSrvEnabledToast)
+  })
+
+  it('6c. toggle 失败 → toast aiMcpSrvUpdateFailed danger,列表不变', async () => {
+    h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a', enabled: true })])
+    h.updateMCPServer.mockRejectedValue(new Error('boom'))
+    const toast = useToast()
+    const show = vi.spyOn(toast, 'show')
+    const w = mountSection()
+    await flush()
+
+    const detail = w.findComponent(McpServerDetail)
+    detail.vm.$emit('toggle', 1, false)
+    await flush()
+
+    expect(show).toHaveBeenCalledWith(zh.aiMcpSrvUpdateFailed, 3000, 'danger')
+    // 仍是 enabled,已启用组还在。
+    const groups = w.findAllComponents(McpServerGroup)
+    expect(groups[0].props('label')).toBe(zh.aiMcpSrvGroupEnabled)
+  })
+
+  // ===== 覆盖点 7:onDelete 成功/失败 =====
+  it('7a. 删除成功 → 条目消失 + toast aiMcpSrvRemovedName(含名称)', async () => {
+    h.listMCPServers.mockResolvedValue([srv(1, { name: 'to-remove' })])
+    const toast = useToast()
+    const show = vi.spyOn(toast, 'show')
+    const w = mountSection()
+    await flush()
+
+    const detail = w.findComponent(McpServerDetail)
+    detail.vm.$emit('delete', 1)
+    await flush()
+
+    expect(h.deleteMCPServer).toHaveBeenCalledWith(1)
+    expect(w.findAll('.sk-item')).toHaveLength(0)
+    expect(show).toHaveBeenCalledWith(zh.aiMcpSrvRemovedName.replace('{name}', 'to-remove'))
+  })
+
+  it('7b. 删除失败 → toast aiCfgDeleteFailed danger', async () => {
+    h.listMCPServers.mockResolvedValue([srv(1, { name: 'stays' })])
+    h.deleteMCPServer.mockRejectedValue(new Error('boom'))
+    const toast = useToast()
+    const show = vi.spyOn(toast, 'show')
+    const w = mountSection()
+    await flush()
+
+    const detail = w.findComponent(McpServerDetail)
+    detail.vm.$emit('delete', 1)
+    await flush()
+
+    expect(show).toHaveBeenCalledWith(zh.aiCfgDeleteFailed, 3000, 'danger')
+    expect(w.findAll('.sk-item')).toHaveLength(1)
+  })
+
+  // ===== 覆盖点 8:删除后选中项落位(两条对照)=====
+  // 三项 fixture [a,b,c],先切到 c(不是删完后剩余列表[a,c]的第一项)——若条件被
+  // 删/无条件回落 skills[0],activeId 会错误地跳成 a;条件生效则仍是 c。
+  it('8a. 删的是当前选中项 → activeId 落到剩余第一项', async () => {
+    h.listMCPServers.mockResolvedValue([
+      srv(1, { name: 'svc-a' }), srv(2, { name: 'svc-b' }), srv(3, { name: 'svc-c' }),
+    ])
+    const w = mountSection()
+    await flush()
+    await w.findAll('.sk-item')[1].trigger('click') // 选中 b
+    await flush()
+    expect(w.find('.sk-name span').text()).toBe('svc-b')
+
+    const detail = w.findComponent(McpServerDetail)
+    detail.vm.$emit('delete', 2) // 删的正是当前选中的 b
+    await flush()
+
+    // 剩余 [a, c],第一项是 a。
+    expect(w.find('.sk-name span').text()).toBe('svc-a')
+  })
+
+  it('8b. 删的不是当前选中项 → activeId 不动', async () => {
+    h.listMCPServers.mockResolvedValue([
+      srv(1, { name: 'svc-a' }), srv(2, { name: 'svc-b' }), srv(3, { name: 'svc-c' }),
+    ])
+    const w = mountSection()
+    await flush()
+    await w.findAll('.sk-item')[2].trigger('click') // 选中 c
+    await flush()
+    expect(w.find('.sk-name span').text()).toBe('svc-c')
+
+    const detail = w.findComponent(McpServerDetail)
+    detail.vm.$emit('delete', 2) // 删的是 b,不是当前选中的 c
+    await flush()
+
+    // 剩余 [a, c] 的第一项是 a——若无条件回落会错误跳成 a;正确实现应仍是 c。
+    expect(w.findAll('.sk-item')).toHaveLength(2)
+    expect(w.find('.sk-name span').text()).toBe('svc-c')
+  })
+
+  // ===== 覆盖点 9:onSave 新增单层取数 =====
+  it('9. createMCPServer 返回裸 {id:7} → activeId 变 7 + toast aiMcpSrvAddedName + 弹窗关闭 + 重新加载一次', async () => {
+    h.listMCPServers.mockResolvedValueOnce([]).mockResolvedValueOnce([srv(7, { name: 'new-one' })])
+    const toast = useToast()
+    const show = vi.spyOn(toast, 'show')
+    const w = mountSection()
+    await flush()
+    expect(h.listMCPServers).toHaveBeenCalledTimes(1)
+
+    await w.find('.sk-add-btn').trigger('click')
+    await macroFlush()
+    expect(modalTitleEl().textContent).toBe(zh.aiMcpSrvAdd)
+
+    setValue(modalNameInput(), 'new-one')
+    const urlInput = document.querySelector('.sk-modal [data-f="url"]') as HTMLInputElement
+    setValue(urlInput, 'https://example.com/new')
+    await flush()
+    modalSubmitBtn().click()
+    await flush()
+
+    expect(h.createMCPServer).toHaveBeenCalledTimes(1)
+    expect(document.querySelector('.sk-modal')).toBeNull() // 弹窗已关
+    expect(show).toHaveBeenCalledWith(zh.aiMcpSrvAddedName.replace('{name}', 'new-one'))
+    expect(h.listMCPServers).toHaveBeenCalledTimes(2) // 触发一次重新加载
+    expect(w.find('.sk-name span').text()).toBe('new-one') // activeId 落在 7
+  })
+
+  // ===== 覆盖点 10:onSave 编辑 =====
+  it('10. 编辑保存 → 调 updateMCPServer(editingId, payload) + toast aiCfgSaved + 弹窗关', async () => {
+    h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a', url: 'https://a.example.com' })])
+    const toast = useToast()
+    const show = vi.spyOn(toast, 'show')
+    const w = mountSection()
+    await flush()
+
+    const detail = w.findComponent(McpServerDetail)
+    detail.vm.$emit('edit', srv(1, { name: 'svc-a', url: 'https://a.example.com' }))
+    await macroFlush()
+    expect(modalTitleEl().textContent).toBe(zh.aiMcpSrvEditTitle)
+
+    modalSubmitBtn().click()
+    await flush()
+
+    expect(h.updateMCPServer).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'svc-a' }))
+    expect(show).toHaveBeenCalledWith(zh.aiCfgSaved)
+    expect(document.querySelector('.sk-modal')).toBeNull()
+  })
+
+  // ===== 覆盖点 11:保存失败弹窗不关 + 行内本地化错误 =====
+  it('11. 保存失败 → 弹窗不关,行内错误走 saveServerErrorKey 本地化文案,不含后端英文串', async () => {
+    h.listMCPServers.mockResolvedValue([])
+    h.createMCPServer.mockRejectedValue({ response: { data: { message: 'url required for http/sse' } } })
+    const w = mountSection()
+    await flush()
+
+    await w.find('.sk-add-btn').trigger('click')
+    await macroFlush()
+    setValue(modalNameInput(), 'no-url')
+    const urlInput = document.querySelector('.sk-modal [data-f="url"]') as HTMLInputElement
+    setValue(urlInput, 'https://example.com/x')
+    await flush()
+    modalSubmitBtn().click()
+    await flush()
+
+    expect(document.querySelector('.sk-modal')).not.toBeNull() // 弹窗仍开
+    expect(modalFieldErr()?.textContent).toBe(zh.aiMcpSrvErrUrlRequired)
+    expect(document.body.textContent).not.toContain('url required for http/sse')
+  })
+
+  // ===== 覆盖点 12:+ 打开新增(server=null);edit 事件打开编辑(server=该项) =====
+  it('12a. 点 + 打开新增弹窗,server prop 为 null(名称输入框为空)', async () => {
+    h.listMCPServers.mockResolvedValue([srv(1, { name: 'existing' })])
+    const w = mountSection()
+    await flush()
+    await w.find('.sk-add-btn').trigger('click')
+    await macroFlush()
+    expect(modalTitleEl().textContent).toBe(zh.aiMcpSrvAdd)
+    expect(modalNameInput().value).toBe('')
+  })
+
+  it('12b. 详情的 edit 事件打开编辑弹窗,server prop 为那一项(名称输入框回填)', async () => {
+    h.listMCPServers.mockResolvedValue([srv(1, { name: 'existing-one' })])
+    const w = mountSection()
+    await flush()
+    const detail = w.findComponent(McpServerDetail)
+    detail.vm.$emit('edit', srv(1, { name: 'existing-one' }))
+    await macroFlush()
+    expect(modalTitleEl().textContent).toBe(zh.aiMcpSrvEditTitle)
+    expect(modalNameInput().value).toBe('existing-one')
+  })
+})
+
+// ============================================================================
+// 协调者追加的两条集成用例(T8 评审发现:McpServerModal 的 `watch(open)` true
+// 分支从 `props.server` 回填,依赖父组件同步设置 `server` + `open` 两个 prop 的
+// 时序——单组件测不到,必须在容器这里补集成用例)。
+// ============================================================================
+describe('McpSection — 弹窗常驻实例的表单残留回归', () => {
+  it('编辑 A → 关闭 → 编辑 B:弹窗里名称是 B 的,不是 A 的残留', async () => {
+    h.listMCPServers.mockResolvedValue([
+      srv(1, { name: 'server-A' }), srv(2, { name: 'server-B' }),
+    ])
+    const w = mountSection()
+    await flush()
+
+    const detail = w.findComponent(McpServerDetail)
+    detail.vm.$emit('edit', srv(1, { name: 'server-A' }))
+    await macroFlush()
+    expect(modalNameInput().value).toBe('server-A')
+
+    modalCloseBtn().click()
+    await flush()
+    expect(document.querySelector('.sk-modal')).toBeNull()
+
+    detail.vm.$emit('edit', srv(2, { name: 'server-B' }))
+    await macroFlush()
+    expect(modalNameInput().value).toBe('server-B')
+    expect(modalNameInput().value).not.toBe('server-A')
+  })
+
+  it('新增 → 关闭 → 编辑:弹窗里是该服务器的数据,没有上一次新增时的残留', async () => {
+    h.listMCPServers.mockResolvedValue([srv(1, { name: 'existing-server' })])
+    const w = mountSection()
+    await flush()
+
+    await w.find('.sk-add-btn').trigger('click')
+    await macroFlush()
+    expect(modalNameInput().value).toBe('')
+    setValue(modalNameInput(), 'leftover-draft-name')
+    await flush()
+    expect(modalNameInput().value).toBe('leftover-draft-name')
+
+    modalCloseBtn().click()
+    await flush()
+    expect(document.querySelector('.sk-modal')).toBeNull()
+
+    const detail = w.findComponent(McpServerDetail)
+    detail.vm.$emit('edit', srv(1, { name: 'existing-server' }))
+    await macroFlush()
+    expect(modalNameInput().value).toBe('existing-server')
+    expect(modalNameInput().value).not.toBe('leftover-draft-name')
+  })
+})
diff --git a/src/ai/components/settings/sections/McpSection.vue b/src/ai/components/settings/sections/McpSection.vue
new file mode 100644
index 0000000..a749595
--- /dev/null
+++ b/src/ai/components/settings/sections/McpSection.vue
@@ -0,0 +1,280 @@
+<!--
+  SP8-P4 Task 9(收官)—— 1:1 移植自 Vue2 `NimoOS-UI/src/views/AI/MCP/McpSection.vue`
+  (136 行)。孪生兄弟是 `./SkillsSection.vue`(SP8-P3a/P3b,已评审通过)——本文件的
+  `<script setup>` 写法、四个数据方法(reload/toggle/delete/save)的结构、`+` 按钮
+  接线方式全部照它抄,不引入第三种模式。做完本文件,`sections.ts` 的
+  `DEFERRED_SECTIONS` 清空——13 个设置分区全部接入真组件。
+
+  【偏离 D1(公共约束 §3 第 1 条,强制,命中两处)】
+
+  1. `reload()` —— Vue2 `:74` `this.servers = resp.data || []`。共享包
+     `service.ai.listMCPServers()` 已 `return res.data`(剥过一次 axios 层),后端
+     `mcp.go:96` 是 `c.JSON(200, out)` 裸数组,再剥一次在裸数组上恒 `undefined`,
+     `this.servers` 就恒为 `[]`(`|| []` 兜底把"取到 undefined"这件事盖住了)——
+     服务器列表永远空。本仓直接把返回值当数组用:`Array.isArray(list) ? list : []`
+     (与 `SkillsSection.vue` 的 `reload()` 同一模具,同一句写法)。
+  2. `onSave` 新建分支 —— Vue2 `:117` `const id = resp.data && resp.data.id`。
+     共享包 `service.ai.createMCPServer` 同样已剥过一层,后端 `mcp.go:121` 是
+     `201 {"id": <int64>}`——不是完整对象,再剥一次恒 `undefined`,新建成功后
+     不会选中新服务器。本仓直接读 `(created as { id?: number })?.id`。
+
+  【偏离 D2(公共约束 §3 第 2 条)】`.sk-toast`(Vue2 `:32-34`,`showToast()`)不
+  移植,改用全局 `useToast().show()`。Vue2 的 `.sk-toast` 模板**无条件**渲染绿色
+  check 图标(`:33`),连失败提示也顶着一个"成功"勾——这是 Vue2 自己的缺陷,不照抄
+  (承 P3a/P3b,与 `SkillsSection.vue` 同款申报)。失败态统一走
+  `toast.show(t(...), 3000, 'danger')`,`danger` tier 天然不带勾。
+
+  【偏离 D4(公共约束 §3 第 4 条)】不写 `console.error`(Vue2 `:79,93,105,124` 四处)
+  ——本仓三个兄弟分区(BlacklistSection/ExecutionSection/MemorySection)与
+  `SkillsSection.vue` 都没有这个惯例,静默吞错 + toast/行内错误呈现已经足够。
+
+  【偏离 D5(公共约束 §3 第 5 条)】`onSave` 失败不再读 Vue2 `:125` 的
+  `e.response.data.message`(后端英文原文,界面永不回显原文的硬约束),改用
+  `util/mcpErrorKey.ts`(T3)的 `saveServerErrorKey(e)` 映射成 i18n 键,`saveError`
+  传给 `McpServerModal` 的 `serverError` prop——**弹窗不关**(用户可改后重试),
+  行内展示而不是 toast(承 P3b `SkillsSection.vue` `onCreate` 同款写法)。
+  `watch(modalOpen)` 关闭时清 `saveError`(照 `SkillsSection.vue:126-128`)——
+  下次打开弹窗不会看到上一次的报错残留。
+
+  【偏离 D7(公共约束 §3 第 7 条)】`+` 按钮的 `AgentIcon` 不传具名色 `color="white"`
+  (Vue2 `:7`)——不传 `color`,走 `currentColor`,由 `.sk-add-btn` 的
+  `--text-on-accent`(`skills-styles.scss:183` 起)供色,与 `SkillsSection.vue` 同款。
+
+  【N4 照抄不改(公共约束 §3.5 第 4 条,已确认照抄)】`activeServer` 在**未过滤的
+  `servers`** 上查(Vue2 `:64`),不是在 `filtered` 上查——搜索时右侧详情面板
+  不跟着清空,与 `SkillsSection.vue` 的 `activeSkill` 同款,不是本文件的新决定。
+
+  【删除后选中项落位,对齐 Vue2 `:102`】只有删的是**当前选中项**才把 `activeId`
+  落到剩余第一项;删别的项时 `activeId` 不动——与 `SkillsSection.vue` `onDelete`
+  同一条件。
+
+  【接口偏离(裁定 3,沿用 T8 `McpServerModal` 的既定接口)】Vue2 是
+  `v-if="modalOpen"`(每次打开重建实例,`data()` 天然只跑一次)+ `@close`。本仓
+  `McpServerModal` 已经是 `v-model:open` 常挂 + `server`/`serverError` 两个 prop
+  的设计(见该文件头注释),`McpSection` 侧只需要在 `openCreate`/`openEdit` 里
+  同步设置 `editing` 与 `modalOpen`(同一函数体内先设 `editing.value` 再设
+  `modalOpen.value = true`,Vue 的响应式更新会在下一次渲染前把两者一起同步给
+  `McpServerModal` 的 `watch(() => props.open, ...)`,不会出现"弹窗先以旧
+  server 弹出、下一帧才刷新成新 server"的闪烁)——协调者追加的两条集成用例
+  (「编辑 A → 关闭 → 编辑 B」「新增 → 关闭 → 编辑」)钉的正是这条时序。
+
+  【`+` 按钮不传具名色,零 <style> 块】用到的每个类均已存在于既有 scss:
+  `set-split`/`sk-col*`/`sk-list`/`sk-col-empty`/`sk-spinner`/`icon-btn`/
+  `sk-col-actions`/`sk-add-btn`(`settings-styles.scss`/`skills-styles.scss`,
+  与 `SkillsSection.vue` 完全同一组类,已在该文件评审通过)。Vue2 `:13`/`:16`
+  的内联 `style="width: 18px; height: 18px"` / `style="display: grid; place-items:
+  center; padding: 28px 0"` 是尺寸/布局不是颜色,原样照抄(公共约束 §6 明确允许)。
+-->
+<script setup lang="ts">
+import { ref, computed, onMounted, watch } from 'vue'
+import { useI18n } from 'vue-i18n'
+import { service } from '@nimotech/nimoos-service'
+import type { McpServer, McpServerFormPayload } from '../../../types/mcpServer'
+import { saveServerErrorKey } from '../../../util/mcpErrorKey'
+import { useToast } from '../../../../stores/toast'
+import AgentIcon from '../../icons/AgentIcon.vue'
+import McpServerGroup from '../mcp/McpServerGroup.vue'
+import McpServerDetail from '../mcp/McpServerDetail.vue'
+import McpServerModal from '../mcp/McpServerModal.vue'
+
+const { t } = useI18n()
+const toast = useToast()
+
+const servers = ref<McpServer[]>([])
+const loading = ref(true)
+const activeId = ref<number | null>(null)
+const query = ref('')
+
+const modalOpen = ref(false)
+const editing = ref<McpServer | null>(null)
+const saving = ref(false)
+const saveError = ref('')
+
+// 弹窗关闭时清掉行内错误(见文件头注释「偏离 D5」末段,照 SkillsSection.vue:126-128)。
+watch(modalOpen, (v) => {
+  if (!v) saveError.value = ''
+})
+
+// 对齐 Vue2 `computed`(`:57-64`)。
+const filtered = computed(() => {
+  const q = query.value.trim().toLowerCase()
+  if (!q) return servers.value
+  // Vue2 `:60` 只搜 name/url 两个字段,不搜 command——照抄(设计 §5.1)。
+  return servers.value.filter(
+    (s) => (s.name || '').toLowerCase().includes(q) || (s.url || '').toLowerCase().includes(q),
+  )
+})
+const enabled = computed(() => filtered.value.filter((s) => s.enabled))
+const disabled = computed(() => filtered.value.filter((s) => !s.enabled))
+// N4 照抄不改(见文件头注释):activeServer 在未过滤的 servers 上查,搜索不清空
+// 详情面板。
+const activeServer = computed(() => servers.value.find((s) => s.id === activeId.value) || null)
+
+function setActive(id: number) {
+  activeId.value = id
+}
+
+// 对齐 Vue2 `reload()`(`:70-82`)。
+async function reload() {
+  loading.value = true
+  try {
+    // 偏离 D1 第 1 处(见文件头注释):单层取数,不再多剥一层 `.data`。
+    const list = await service.ai.listMCPServers()
+    servers.value = Array.isArray(list) ? list : []
+    // 选中态保持逻辑,对齐 Vue2 `:75-77`:当前选中项还在新列表里就不动,否则落到
+    // 第一项(空列表落 null)。
+    if (!activeId.value || !servers.value.find((s) => s.id === activeId.value)) {
+      activeId.value = servers.value[0]?.id ?? null
+    }
+  } catch {
+    // 偏离 D2/D4(见文件头注释):不写 console.error,失败走全局 danger toast。
+    toast.show(t('aiMcpSrvLoadFailed'), 3000, 'danger')
+  } finally {
+    loading.value = false
+  }
+}
+
+onMounted(() => reload())
+
+function openCreate() {
+  editing.value = null
+  modalOpen.value = true
+}
+function openEdit(server: McpServer) {
+  editing.value = server
+  modalOpen.value = true
+}
+function closeModal() {
+  modalOpen.value = false
+  editing.value = null
+}
+
+// 对齐 Vue2 `onToggle`(`:86-96`)。204 无内容,不读返回值。
+async function onToggle(id: number, enabledVal: boolean) {
+  try {
+    await service.ai.updateMCPServer(id, { enabled: enabledVal })
+    const idx = servers.value.findIndex((s) => s.id === id)
+    if (idx !== -1) servers.value.splice(idx, 1, { ...servers.value[idx], enabled: enabledVal })
+    toast.show(enabledVal ? t('aiMcpSrvEnabledToast') : t('aiMcpSrvDisabledToast'))
+  } catch {
+    toast.show(t('aiMcpSrvUpdateFailed'), 3000, 'danger')
+  }
+}
+
+// 对齐 Vue2 `onDelete`(`:97-108`)。204 无内容,不读返回值。删除后选中项落位见
+// 文件头注释——只有删的是当前选中项才把 activeId 落到剩余第一项。
+async function onDelete(id: number) {
+  const s = servers.value.find((x) => x.id === id)
+  try {
+    await service.ai.deleteMCPServer(id)
+    servers.value = servers.value.filter((x) => x.id !== id)
+    if (activeId.value === id) {
+      activeId.value = servers.value[0]?.id ?? null
+    }
+    toast.show(t('aiMcpSrvRemovedName', { name: s ? s.name : String(id) }))
+  } catch {
+    toast.show(t('aiCfgDeleteFailed'), 3000, 'danger')
+  }
+}
+
+// 对齐 Vue2 `onSave`(`:109-128`)。偏离 D1 第 2 处 / D5 见文件头注释。
+async function onSave(payload: McpServerFormPayload) {
+  saving.value = true
+  saveError.value = ''
+  try {
+    // 共享包形参类型是 `Record<string, unknown>`(NimoOS-Service/dist/ai.d.ts:85-86)
+    // ——`McpServerFormPayload` 是具名 interface,不带隐式索引签名,TS 判定不兼容
+    // (TS2345),故转型一次;字段值本身未做任何改动(与 SkillsSection.vue
+    // `onCreate` 同款说明)。
+    if (editing.value) {
+      await service.ai.updateMCPServer(editing.value.id, payload as unknown as Record<string, unknown>)
+      toast.show(t('aiCfgSaved'))
+    } else {
+      const created = await service.ai.createMCPServer(payload as unknown as Record<string, unknown>)
+      const id = (created as { id?: number } | undefined)?.id
+      if (id) activeId.value = id
+      toast.show(t('aiMcpSrvAddedName', { name: payload.name }))
+    }
+    closeModal()
+    await reload()
+  } catch (e) {
+    saveError.value = t(saveServerErrorKey(e))
+  } finally {
+    saving.value = false
+  }
+}
+</script>
+
+<template>
+  <div class="set-split">
+    <div class="sk-col">
+      <div class="sk-col-head">
+        <div class="sk-col-actions">
+          <button class="icon-btn" :title="t('aiCfgRefresh')" @click="reload">
+            <AgentIcon name="refresh" :size="15" />
+          </button>
+          <!-- 对齐 Vue2 :7。不传具名 color——见文件头注释「偏离 D7」。 -->
+          <button class="sk-add-btn" :title="t('aiMcpSrvAdd')" @click="openCreate">
+            <AgentIcon name="plus" :size="15" />
+          </button>
+        </div>
+      </div>
+      <div class="sk-col-search">
+        <AgentIcon name="search" :size="13" color="var(--text-tertiary)" />
+        <input v-model="query" :placeholder="t('aiMcpSrvSearchPlaceholder')">
+        <button
+          v-if="query"
+          class="icon-btn"
+          style="width: 18px; height: 18px"
+          @click="query = ''"
+        >
+          <AgentIcon name="x" :size="10" />
+        </button>
+      </div>
+      <div class="sk-list">
+        <div v-if="loading" style="display: grid; place-items: center; padding: 28px 0">
+          <div class="sk-spinner" />
+        </div>
+        <template v-else>
+          <McpServerGroup
+            v-if="enabled.length"
+            :label="t('aiMcpSrvGroupEnabled')"
+            :items="enabled"
+            :active-id="activeId"
+            @pick="setActive"
+          />
+          <McpServerGroup
+            v-if="disabled.length"
+            :label="t('aiMcpSrvGroupDisabled')"
+            :items="disabled"
+            :active-id="activeId"
+            @pick="setActive"
+          />
+          <div v-if="filtered.length === 0" class="sk-col-empty">
+            <template v-if="query">
+              {{ t('aiMcpSrvNoMatch') }} <code>{{ query }}</code>
+            </template>
+            <template v-else>
+              {{ t('aiMcpSrvEmpty') }}
+            </template>
+          </div>
+        </template>
+      </div>
+    </div>
+
+    <McpServerDetail
+      :server="activeServer"
+      @toggle="onToggle"
+      @edit="openEdit"
+      @delete="onDelete"
+    />
+
+    <McpServerModal
+      v-model:open="modalOpen"
+      :server="editing"
+      :saving="saving"
+      :server-error="saveError"
+      @save="onSave"
+    />
+  </div>
+</template>
diff --git a/src/ai/views/SettingsPage.test.ts b/src/ai/views/SettingsPage.test.ts
index 977bc94..0be9013 100644
--- a/src/ai/views/SettingsPage.test.ts
+++ b/src/ai/views/SettingsPage.test.ts
@@ -32,20 +32,29 @@ const ai = vi.hoisted(() => ({
   getPolicy: vi.fn(),
   getImportStatus: vi.fn(),
   cancelImport: vi.fn(),
   // SP8-P3a Task 7 —— skills 分区不再是占位,挂载真组件 SkillsSection 会在
   // onMounted 里调 service.ai.listSkills()。裸 vi.fn()(无 mockResolvedValue)
   // 调用返回 undefined,`await undefined` 合法且 SkillsSection 的
   // `Array.isArray(list)` 兜底把它当空列表处理,不抛错、不弹 toast —— 足够
   // 让本文件里与 skills 无关的用例（换到该分区只是路过）保持沉默；需要断言
   // 列表内容的用例会自己 `mockResolvedValue`。
   listSkills: vi.fn(),
+  // SP8-P4 Task 9(收官)—— mcp 分区不再是占位,挂载真组件 McpSection 同样会在
+  // onMounted 里调 service.ai.listMCPServers()。同上,裸 vi.fn() 让
+  // `Array.isArray(list)` 兜底把它当空列表处理,本文件里与 mcp 无关的用例不受
+  // 影响(⚠️ brief 明确点名:`stubNetworkActions` 只 mock 了 `useSettingsStore`
+  // 的四个网络动作,不覆盖这里的 `service.ai.*`——必须单独在这个 hoisted 对象里
+  // 补上,否则挂载 mcp 分区时 `listMCPServers` 会是 `undefined`,虽然
+  // `Array.isArray` 兜底不会抛错,但补齐这个键是让「mock 齐全」这件事显式,
+  // 不依赖兜底的隐性容错)。
+  listMCPServers: vi.fn(),
 }))
 vi.mock('@nimotech/nimoos-service', () => ({ service: { ai } }))
 
 import SettingsPage from './SettingsPage.vue'
 import { useSettingsStore } from '../stores/settingsStore'
 import type { ImportJob } from '../stores/settingsStore'
 import type { SectionId } from '../components/settings/sections'
 import { useAiTheme } from '../stores/aiTheme'
 import { useToast } from '../../stores/toast'
 
@@ -303,45 +312,44 @@ describe('SettingsPage — ③ 内容区两种渲染模式', () => {
   // 用的是自己的 `aiCfgXxxDesc` 文案键(逐一核对过 `sections/*.vue` 源码,没有
   // 一个真分区复用这个键),所以「页面渲染文本里是否出现这段占位文案」可以
   // 精确区分「真组件」与「SectionPlaceholder」,不需要拿到 `SECTION_COMPONENTS`
   // 本身。
   //
   // agent 组(blacklist/execution/search/memory/observability)是 stack 组,
   // 一次 setActiveSection 会把组内 5 个分区一起渲染出来,断言力度比逐个切更强
   // (5 个分区的真实现只要有 1 个不小心留了占位就会被抓到)。
   //
   // SP8-P3a Task 7 —— `skills` 已接入真组件 `SkillsSection`,从「仍含占位文案」
-  // 的 deferred 列表移到「已实现」列表;现在只剩 `mcp` 还在渲染
-  // `SectionPlaceholder`(留给 P4)。
-  it('SP8-P3a 收口 —— 12 个已实现分区渲染后页面不含占位文案，mcp 仍含占位文案', async () => {
+  // 的 deferred 列表移到「已实现」列表。
+  // SP8-P4 Task 9(收官)—— `mcp` 是最后一个占位分区,本任务把它也接入真组件
+  // `McpSection`,同样从 deferred 移到 implemented——**13 个分区全部实现**,
+  // `deferred` 列表就此清空(与 `sections.ts` 的 `DEFERRED_SECTIONS: SectionId[]
+  // = []` 同步)。原本的 deferred 循环(断言「仍含占位文案」)整段删掉:空数组的
+  // `for` 循环体永远不执行,留着就是空转断言,不如直接删除,机制层面的钉子已经
+  // 由 `sections.test.ts` 的两条新用例(`DEFERRED_SECTIONS` 为空 / 机制仍在)
+  // 覆盖,不需要在这里重复一份等价空转的写法。
+  it('SP8-P4 收口 —— 13 个已实现分区渲染后页面不含占位文案(无一分区仍是 SectionPlaceholder）', async () => {
     const store = useSettingsStore()
     stubNetworkActions(store)
     const { w } = await mountPage()
     await flushPromises()
 
     const implemented: SectionId[] = [
       'models', 'providers', 'privacy', 'thinking',
-      'blacklist', 'execution', 'search', 'memory', 'observability', 'skills', 'mcptokens', 'channels',
+      'blacklist', 'execution', 'search', 'memory', 'observability', 'skills', 'mcp', 'mcptokens', 'channels',
     ]
     for (const id of implemented) {
       store.setActiveSection(id)
       await flushPromises()
       expect(w.text()).not.toContain(zh.aiCfgPlaceholderBody)
     }
 
-    const deferred: SectionId[] = ['mcp']
-    for (const id of deferred) {
-      store.setActiveSection(id)
-      await flushPromises()
-      expect(w.text()).toContain(zh.aiCfgPlaceholderBody)
-    }
-
     w.unmount()
   })
 })
 
 describe('SettingsPage — ⑤+⑥ 深链契约与生命周期', () => {
   it('13. onMounted 先调 resetTransientUi 再读 ?section=(调用序:resetTransientUi < setActiveSection)', async () => {
     const store = useSettingsStore()
     stubNetworkActions(store)
     const resetSpy = vi.spyOn(store, 'resetTransientUi')
     const setSpy = vi.spyOn(store, 'setActiveSection')
@@ -409,48 +417,56 @@ describe('SettingsPage — ⑤+⑥ 深链契约与生命周期', () => {
     await flushPromises()
     expect(replaceSpy).not.toHaveBeenCalled()
     expect(store.activeSection).toBe('privacy')
     w.unmount()
   })
 
   // SP8-P3a Task 7 —— skills 已接入真组件 SkillsSection,不再属于
   // DEFERRED_SECTIONS,这条原本断言「弹一条占位 toast」的用例改为断言反面:
   // 渲染出 SkillsSection 真实内容(`.sk-list`,来自 SkillsSection.vue:135,
   // `SectionPlaceholder.vue` 没有这个 class)、页面不含占位文案、且不弹任何
-  // toast。下一条('19b')补上 mcp 仍走占位 toast 的对照,保证 DEFERRED_SECTIONS
-  // 的占位契约本身没有被整个删掉。
+  // toast。
   it('19. 选中 skills → 渲染 SkillsSection 真实内容,不弹 toast(不再是占位)', async () => {
     const store = useSettingsStore()
     stubNetworkActions(store)
     const { w } = await mountPage()
     await flushPromises()
     const toast = useToast()
     const showSpy = vi.spyOn(toast, 'show')
     const item = w.findAll('.set-nav-item').find((n) => n.text().includes('技能'))!
     await item.trigger('click')
     await flushPromises()
     expect(w.find('.sk-list').exists()).toBe(true)
     expect(w.text()).not.toContain(zh.aiCfgPlaceholderBody)
     expect(showSpy).not.toHaveBeenCalled()
     w.unmount()
   })
 
-  it('19b. 选中 mcp → 仍弹一条占位 toast(DEFERRED_SECTIONS 契约仍在,只是不再含 skills)', async () => {
+  // SP8-P4 Task 9(收官)—— mcp 是最后一个占位分区,本任务接入真组件 McpSection
+  // 后不再属于 DEFERRED_SECTIONS。这条原本('19b')断言「仍弹一条占位 toast,
+  // DEFERRED_SECTIONS 契约仍在」的用例反转成断言反面:渲染出 McpSection 真实内容
+  // (`.sk-col-search`,McpSection 左列的搜索框,来自 McpSection.vue,
+  // `SectionPlaceholder.vue` 没有这个 class)、页面不含占位文案、且不弹任何 toast
+  // ——与上面 19 条 skills 的写法完全同构。
+  it('19b. 选中 mcp → 渲染 McpSection 真实内容,不弹 toast(不再是占位)', async () => {
     const store = useSettingsStore()
     stubNetworkActions(store)
     const { w } = await mountPage()
     await flushPromises()
     const toast = useToast()
     const showSpy = vi.spyOn(toast, 'show')
     const item = w.findAll('.set-nav-item').find((n) => n.text().includes('MCP 连接'))!
     await item.trigger('click')
-    expect(showSpy).toHaveBeenCalledWith('该分区将在后续阶段开启', 3000)
+    await flushPromises()
+    expect(w.find('.sk-col-search').exists()).toBe(true) // McpSection 的左列搜索框
+    expect(w.text()).not.toContain(zh.aiCfgPlaceholderBody)
+    expect(showSpy).not.toHaveBeenCalled()
     w.unmount()
   })
 
   it('20. 选中 providers(非 deferred)→ 不弹 toast(对照组)', async () => {
     const store = useSettingsStore()
     stubNetworkActions(store)
     const { w } = await mountPage()
     await flushPromises()
     const toast = useToast()
     const showSpy = vi.spyOn(toast, 'show')
diff --git a/src/ai/views/SettingsPage.vue b/src/ai/views/SettingsPage.vue
index 28cc4ab..3dd352a 100644
--- a/src/ai/views/SettingsPage.vue
+++ b/src/ai/views/SettingsPage.vue
@@ -45,20 +45,21 @@ import SectionPlaceholder from '../components/settings/SectionPlaceholder.vue'
 import ModelsSection from '../components/settings/sections/ModelsSection.vue'
 import ProvidersSection from '../components/settings/sections/ProvidersSection.vue'
 import PrivacySection from '../components/settings/sections/PrivacySection.vue'
 import ThinkingDefaultsSection from '../components/settings/sections/ThinkingDefaultsSection.vue'
 import BlacklistSection from '../components/settings/sections/BlacklistSection.vue'
 import ExecutionSection from '../components/settings/sections/ExecutionSection.vue'
 import SearchSection from '../components/settings/sections/SearchSection.vue'
 import MemorySection from '../components/settings/sections/MemorySection.vue'
 import ObservabilitySection from '../components/settings/sections/ObservabilitySection.vue'
 import SkillsSection from '../components/settings/sections/SkillsSection.vue'
+import McpSection from '../components/settings/sections/McpSection.vue'
 import McpTokensSection from '../components/settings/sections/McpTokensSection.vue'
 import ChannelsSection from '../components/settings/sections/ChannelsSection.vue'
 import AgentIcon from '../components/icons/AgentIcon.vue'
 import {
   ALL_ITEMS,
   DEFERRED_SECTIONS,
   SPLIT_SECTIONS,
   VALID_SECTIONS,
   groupOf,
   type SectionId,
@@ -66,41 +67,46 @@ import {
 import '../styles/tokens.scss'
 import '../styles/sk-shared.scss'
 import '../styles/settings-styles.scss'
 import '../styles/skills-styles.scss'
 import '../styles/mcp-styles.scss'
 
 // SP8-P2a —— section id → 组件。必须与 sections.ts 的 id、以及 `?section=`
 // 深链契约三方同步(Vue2 Settings.vue:75-90 同款约定)。
 //
 // SP8-P2b 收官接线后曾只剩 skills / mcp 两个仍渲染 SectionPlaceholder;
-// SP8-P3a 把 skills 接上真组件 SkillsSection 后,现在只剩 mcp 一个仍渲染
-// SectionPlaceholder(留给 P4)。其余 12 个(models/providers/privacy/thinking
-// 为 P2a 已接;blacklist/execution/search/memory/observability/mcptokens/
-// channels 为 P2b 已接;skills 为本任务 P3a 已接)均已指向各自的真组件。
+// SP8-P3a 把 skills 接上真组件 SkillsSection 后只剩 mcp 一个;SP8-P4 Task 9
+// 把 mcp 也接上真组件 McpSection——13 个分区全部指向各自的真组件,
+// `SECTION_COMPONENTS` 里不再有任何一个映射到 `SectionPlaceholder`
+// (models/providers/privacy/thinking 为 P2a 已接;blacklist/execution/search/
+// memory/observability/mcptokens/channels 为 P2b 已接;skills 为 P3a 已接;
+// mcp 为本任务 P4 Task 9 已接)。`SectionPlaceholder` 组件本身与
+// `DEFERRED_SECTIONS` 机制原样保留(用户明示「反转不删」),将来新增未完成
+// 分区时把映射改回 `SectionPlaceholder`、把 id 加回 `DEFERRED_SECTIONS` 即可
+// 恢复占位行为。
 //
 // SP8-P2b Task 14 修复轮 1 —— 不 export 这个常量:`<script setup>` 不允许 ES
 // module 具名导出(试过,编译直接报错),而协调者裁定"可测试性"不值得为此拆
 // 出额外的 `<script>` 块(公开面收窄)。收口守卫测试改成断言渲染结果(是否
 // 渗出占位文案),不再需要拿到这个常量本身。
 const SECTION_COMPONENTS: Record<SectionId, Component> = {
   models: ModelsSection, // Task 9 —— 已替换
   providers: ProvidersSection, // Task 10 —— 已替换
   privacy: PrivacySection, // Task 11 —— 已替换
   thinking: ThinkingDefaultsSection, // Task 11 —— 已替换
   blacklist: BlacklistSection, // SP8-P2b Task 4 —— 已实现,收官接线
   execution: ExecutionSection, // SP8-P2b Task 5 —— 已实现,收官接线
   search: SearchSection, // SP8-P2b Task 7 —— 已实现,收官接线
   memory: MemorySection, // SP8-P2b Task 6 —— 已实现,收官接线
   observability: ObservabilitySection, // SP8-P2b Task 8 —— 已实现,收官接线
   skills: SkillsSection, // SP8-P3a Task 7 —— 已实现,收官接线
-  mcp: SectionPlaceholder, // SP8-P4 才实现,保持占位
+  mcp: McpSection, // SP8-P4 Task 9 —— 已实现,收官接线(DEFERRED_SECTIONS 就此清空)
   mcptokens: McpTokensSection, // SP8-P2b Task 10 —— 已实现,收官接线
   channels: ChannelsSection, // SP8-P2b Task 12 —— 已实现,收官接线
 }
 
 // 非 Vue2 蓝本 —— SectionPlaceholder 需要 { titleKey, bodyKey } 两个 prop,而
 // Vue2 的 SECTION_COMPONENTS 只是纯 id→组件映射、渲染处不传任何 prop
 // (Settings.vue:40/45)。给非占位组件传这两个多余 prop 无害(已换上真组件的
 // 12 个分区里,这两个 prop 会变成未声明的 fallthrough attrs,不影响功能),
 // 占位场景(现仅 mcp)下用来源分区自己的导航文案(sections.ts 的
 // labelKey)作标题,统一的 `aiCfgPlaceholderBody` 作说明文字。
