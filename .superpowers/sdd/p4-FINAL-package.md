# P4 whole-branch review package — 7ecd1d3..69af8ed (11 commits)

## commits
69af8ed feat(ai): SP8-P4 T9 McpSection 接线,DEFERRED_SECTIONS 清空
9e5b481 feat(ai): SP8-P4 T8 McpServerModal 表单弹窗(快速粘贴单层取数)
7b4e46b test(ai): SP8-P4 T7 补 finally 守卫判别性用例(评审 Important 修复)
39fed70 feat(ai): SP8-P4 T7 测试连接(本地化错误+技术详情折叠+在途竞态守卫)
b9ac9e1 feat(ai): SP8-P4 T6 McpServerDetail 详情面板(状态点内联 style 改 CSS)
bd3dee2 feat(ai): SP8-P4 T5 McpServerGroup 可折叠分组
2232857 feat(ai): SP8-P4 T4 MCP 分区 i18n 双档(76 新键,8 键复用)
ae161ca fix(ai): SP8-P4 T3 评审修复——补 4 类边界形状用例(裸串/数组/error_key:null/502 非常规 body)
39f7e44 feat(ai): SP8-P4 T3 MCP 错误映射(后端串→i18n 键,界面零原文)
c154a1a feat(ai): SP8-P4 T2 MCP 类型 + 视觉工具(色板复用 SkillTile 七色)
4dc7e7e feat(ai): SP8-P4 T1 MCP 分区样式底座(18 类,6 处 rgba 换 token)

## stat
 .../settings/mcp/McpServerDetail.test.ts           | 460 +++++++++++++++++++
 src/ai/components/settings/mcp/McpServerDetail.vue | 375 ++++++++++++++++
 .../components/settings/mcp/McpServerGroup.test.ts |  77 ++++
 src/ai/components/settings/mcp/McpServerGroup.vue  |  88 ++++
 .../components/settings/mcp/McpServerModal.test.ts | 486 +++++++++++++++++++++
 src/ai/components/settings/mcp/McpServerModal.vue  | 374 ++++++++++++++++
 src/ai/components/settings/sections.test.ts        |  13 +-
 src/ai/components/settings/sections.ts             |   8 +-
 .../settings/sections/McpSection.test.ts           | 444 +++++++++++++++++++
 src/ai/components/settings/sections/McpSection.vue | 280 ++++++++++++
 src/ai/styles/mcp-styles.scss                      | 139 ++++++
 src/ai/types/mcpServer.ts                          |  96 ++++
 src/ai/util/mcpErrorKey.test.ts                    | 202 +++++++++
 src/ai/util/mcpErrorKey.ts                         | 112 +++++
 src/ai/util/mcpServerVisual.test.ts                |  63 +++
 src/ai/util/mcpServerVisual.ts                     |  25 ++
 src/ai/views/SettingsPage.test.ts                  |  46 +-
 src/ai/views/SettingsPage.vue                      |  17 +-
 src/i18n/en_us.ts                                  |  83 ++++
 src/i18n/zh_cn.ts                                  |  82 ++++
 20 files changed, 3445 insertions(+), 25 deletions(-)

## diff -U10
diff --git a/src/ai/components/settings/mcp/McpServerDetail.test.ts b/src/ai/components/settings/mcp/McpServerDetail.test.ts
new file mode 100644
index 0000000..d20497d
--- /dev/null
+++ b/src/ai/components/settings/mcp/McpServerDetail.test.ts
@@ -0,0 +1,460 @@
+import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
+import { mount, flushPromises } from '@vue/test-utils'
+import { nextTick } from 'vue'
+import { createI18n } from 'vue-i18n'
+import zh from '../../../../i18n/zh_cn'
+import McpServerDetail from './McpServerDetail.vue'
+import type { McpServer } from '../../../types/mcpServer'
+
+// SP8-P4 Task 6 —— 对齐 Vue2 src/views/AI/MCP/McpServerDetail.vue(174 行)的
+// :1-157。
+// SP8-P4 Task 7 —— 补上「测试连接」整段:按钮 :50-53、结果面板 :87-100、
+// runTest :158-171,含 D8(本地化错误 + 折叠技术详情)与 D11(在途请求竞态守卫)。
+// 公共约束 §9:reka Teleport 组件挂载后先 await nextTick() 再查 document;
+// 异步断言用 flushPromises() 不用单个 await nextTick()。
+
+// vi.hoisted 避免 ESM 提升的 TDZ(公共约束 §9 先例 agentStore.test.ts:4-19)。
+// 只 mock service.ai.testMCPServer 这一个方法——本文件其余用例不碰网络请求,
+// 不需要也不应该 mock 掉整个 service.ai 命名空间。
+const h = vi.hoisted(() => ({ testMCPServer: vi.fn() }))
+vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: h } }))
+
+const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
+
+function makeServer(overrides: Partial<McpServer> = {}): McpServer {
+  return {
+    id: 1,
+    name: 'brave-search',
+    transport: 'http',
+    url: 'https://mcp.example.com/brave',
+    command: '',
+    args: [],
+    enabled: true,
+    has_headers: false,
+    has_env: false,
+    ...overrides,
+  }
+}
+
+// T7 用例沿用 brief 里的 `srv(...)` 命名,等价于既有的 `makeServer`——避免两份
+// 重复的 fixture 构造逻辑。
+const srv = makeServer
+
+// 删除确认弹窗 portal 到 `.set-app`(D6),测试须先在 body 里放同名宿主,
+// 先例 SkillDetail.test.ts::withHost()。
+function withHost(): HTMLElement {
+  const host = document.createElement('div')
+  host.className = 'set-app'
+  document.body.appendChild(host)
+  return host
+}
+
+const mountDetail = (server: McpServer | null) =>
+  mount(McpServerDetail, {
+    props: { server },
+    global: { plugins: [i18n] },
+    attachTo: document.body,
+  })
+
+const flush = async () => { await flushPromises(); await nextTick() }
+
+describe('McpServerDetail', () => {
+  let host: HTMLElement
+
+  beforeEach(() => {
+    host = withHost()
+  })
+
+  afterEach(() => {
+    document.body.innerHTML = ''
+  })
+
+  // ===== 覆盖点 1:server === null =====
+  it('1. server=null 时渲染 .sk-detail-empty,含 orb/empty-title/empty-sub', () => {
+    const w = mountDetail(null)
+    expect(w.find('.sk-detail-empty').exists()).toBe(true)
+    expect(w.find('.orb').exists()).toBe(true)
+    expect(w.find('.empty-title').text()).toBe('在左侧选择一个 MCP 服务')
+    expect(w.find('.empty-sub').text()).toBe('或新增一个,通过 Model Context Protocol 给 Nimo 接入新工具。')
+    expect(w.find('.sk-detail-bar').exists()).toBe(false)
+  })
+
+  // ===== 覆盖点 2:顶栏 =====
+  it('2. 有 server 时顶栏含 SkillTile、名称与 <code> 里的传输方式大写', () => {
+    const w = mountDetail(makeServer({ name: 'brave-search', transport: 'http' }))
+    expect(w.find('.sk-detail-bar').exists()).toBe(true)
+    expect(w.findComponent({ name: 'SkillTile' }).exists()).toBe(true)
+    expect(w.find('.sk-name span').text()).toBe('brave-search')
+    expect(w.find('.sk-name code').text()).toBe('HTTP')
+  })
+
+  // ===== 覆盖点 3:开关两项对照 =====
+  it('3a. enabled=true 时 .sw[data-on=true],点击 emit toggle(id,false)', async () => {
+    const w = mountDetail(makeServer({ id: 7, enabled: true }))
+    const sw = w.find('.sw')
+    expect(sw.attributes('data-on')).toBe('true')
+    await sw.trigger('click')
+    expect(w.emitted('toggle')).toEqual([[7, false]])
+  })
+
+  it('3b. enabled=false 时 .sw[data-on=false],点击 emit toggle(id,true)', async () => {
+    const w = mountDetail(makeServer({ id: 7, enabled: false }))
+    const sw = w.find('.sw')
+    expect(sw.attributes('data-on')).toBe('false')
+    await sw.trigger('click')
+    expect(w.emitted('toggle')).toEqual([[7, true]])
+  })
+
+  // ===== 覆盖点 4:元信息 4 格,请求头格仅 non-stdio 渲染 =====
+  it('4a. transport=stdio 时元信息只有 3 格,不含请求头格', () => {
+    const w = mountDetail(makeServer({ transport: 'stdio' }))
+    const cells = w.findAll('.sk-meta-cell')
+    expect(cells).toHaveLength(3)
+    const labels = cells.map((c) => c.find('.lbl').text())
+    expect(labels).toEqual(['状态', '传输', '环境变量'])
+  })
+
+  it('4b. transport!==stdio 时元信息 4 格,含请求头格', () => {
+    const w = mountDetail(makeServer({ transport: 'http' }))
+    const cells = w.findAll('.sk-meta-cell')
+    expect(cells).toHaveLength(4)
+    const labels = cells.map((c) => c.find('.lbl').text())
+    expect(labels).toEqual(['状态', '传输', '请求头', '环境变量'])
+  })
+
+  // ===== 覆盖点 5:状态格两态 + dot 无 style =====
+  it('5a. enabled=true:.val 无 data-disabled=true,文案「启用」,dot 无 style 属性', () => {
+    const w = mountDetail(makeServer({ enabled: true }))
+    const statusVal = w.findAll('.sk-meta-cell')[0].find('.val')
+    expect(statusVal.attributes('data-disabled')).toBe('false')
+    expect(statusVal.text()).toContain('启用')
+    expect(statusVal.find('.dot').attributes('style')).toBeUndefined()
+  })
+
+  it('5b. enabled=false:.val[data-disabled=true],文案「未启用」,dot 无 style 属性', () => {
+    const w = mountDetail(makeServer({ enabled: false }))
+    const statusVal = w.findAll('.sk-meta-cell')[0].find('.val')
+    expect(statusVal.attributes('data-disabled')).toBe('true')
+    expect(statusVal.text()).toContain('未启用')
+    expect(statusVal.find('.dot').attributes('style')).toBeUndefined()
+  })
+
+  // ===== 覆盖点 6:stdio 配置区 =====
+  it('6a. stdio 配置区:命令/参数(空格 join)/环境变量三行', () => {
+    const w = mountDetail(makeServer({
+      transport: 'stdio', command: 'npx', args: ['-y', '@upstash/context7-mcp'], has_env: true,
+    }))
+    const rows = w.findAll('.mcp-config-row')
+    expect(rows).toHaveLength(3)
+    expect(rows[0].find('.lbl').text()).toBe('命令')
+    expect(rows[0].find('.mcp-code').text()).toBe('npx')
+    expect(rows[1].find('.lbl').text()).toBe('参数')
+    expect(rows[1].find('.mcp-code').text()).toBe('-y @upstash/context7-mcp')
+    expect(rows[2].find('.lbl').text()).toBe('环境变量')
+    expect(rows[2].find('.val').text()).toBe('已配置(已隐藏)')
+  })
+
+  it('6b. stdio 配置区:args 为空数组时参数格显示「无」', () => {
+    const w = mountDetail(makeServer({ transport: 'stdio', command: 'npx', args: [] }))
+    const rows = w.findAll('.mcp-config-row')
+    expect(rows[1].find('.mcp-code').text()).toBe('无')
+  })
+
+  // ===== 覆盖点 7:非 stdio 配置区 =====
+  it('7a. 非 stdio 配置区:端点 URL/请求头/环境变量三行,has_headers=true 显示「已配置(已隐藏)」', () => {
+    const w = mountDetail(makeServer({
+      transport: 'http', url: 'https://x.example.com', has_headers: true, has_env: false,
+    }))
+    const rows = w.findAll('.mcp-config-row')
+    expect(rows).toHaveLength(3)
+    expect(rows[0].find('.lbl').text()).toBe('端点 URL')
+    expect(rows[0].find('.mcp-code').text()).toBe('https://x.example.com')
+    expect(rows[1].find('.lbl').text()).toBe('请求头')
+    expect(rows[1].find('.val').text()).toBe('已配置(已隐藏)')
+    expect(rows[2].find('.val').text()).toBe('无')
+  })
+
+  it('7b. 非 stdio 配置区:has_headers=false 时请求头格显示「无」', () => {
+    const w = mountDetail(makeServer({ transport: 'http', has_headers: false }))
+    const rows = w.findAll('.mcp-config-row')
+    expect(rows[1].find('.val').text()).toBe('无')
+  })
+
+  // ===== 覆盖点 8:更多菜单 =====
+  it('8a. 更多菜单:初始不渲染 .sk-menu,点击 .sk-pill-more 后渲染', async () => {
+    const w = mountDetail(makeServer())
+    expect(w.find('.sk-menu').exists()).toBe(false)
+    await w.find('.sk-pill-more').trigger('click')
+    expect(w.find('.sk-menu').exists()).toBe(true)
+  })
+
+  it('8b. 点「编辑配置」emit edit(server) 且菜单关闭', async () => {
+    const server = makeServer({ id: 3, name: 'foo' })
+    const w = mountDetail(server)
+    await w.find('.sk-pill-more').trigger('click')
+    await w.findAll('.sk-menu button')[0].trigger('click')
+    expect(w.emitted('edit')).toEqual([[server]])
+    expect(w.find('.sk-menu').exists()).toBe(false)
+  })
+
+  it('8c. 文档 mousedown 在菜单外关闭菜单', async () => {
+    const w = mountDetail(makeServer())
+    await w.find('.sk-pill-more').trigger('click')
+    expect(w.find('.sk-menu').exists()).toBe(true)
+    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
+    await flush()
+    expect(w.find('.sk-menu').exists()).toBe(false)
+  })
+
+  it('8d. 对照:菜单内 mousedown 不关闭菜单', async () => {
+    const w = mountDetail(makeServer())
+    await w.find('.sk-pill-more').trigger('click')
+    expect(w.find('.sk-menu').exists()).toBe(true)
+    w.find('.sk-menu button').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
+    await flush()
+    expect(w.find('.sk-menu').exists()).toBe(true)
+  })
+
+  // ===== 覆盖点 9:删除确认 =====
+  it('9a. 点「移除服务」:菜单关闭,确认弹窗打开(portal 进 .set-app)', async () => {
+    const w = mountDetail(makeServer())
+    await w.find('.sk-pill-more').trigger('click')
+    await w.findAll('.sk-menu button')[1].trigger('click')
+    await flush()
+    expect(w.find('.sk-menu').exists()).toBe(false)
+    expect(host.querySelector('.sk-confirm')).not.toBeNull()
+    expect(host.querySelector('.sk-confirm')!.closest('.set-app')).toBe(host)
+  })
+
+  it('9b. 点「移除」emit delete(id) 且弹窗关闭', async () => {
+    const w = mountDetail(makeServer({ id: 9 }))
+    await w.find('.sk-pill-more').trigger('click')
+    await w.findAll('.sk-menu button')[1].trigger('click')
+    await flush()
+    const confirmBtn = host.querySelector('.sk-btn.danger') as HTMLButtonElement
+    confirmBtn.click()
+    await flush()
+    expect(w.emitted('delete')).toEqual([[9]])
+    expect(host.querySelector('.sk-confirm')).toBeNull()
+  })
+
+  it('9c. 点「取消」不 emit delete,弹窗关闭', async () => {
+    const w = mountDetail(makeServer())
+    await w.find('.sk-pill-more').trigger('click')
+    await w.findAll('.sk-menu button')[1].trigger('click')
+    await flush()
+    const cancelBtn = host.querySelector('.sk-btn.ghost') as HTMLButtonElement
+    cancelBtn.click()
+    await flush()
+    expect(w.emitted('delete')).toBeUndefined()
+    expect(host.querySelector('.sk-confirm')).toBeNull()
+  })
+
+  // ===== 覆盖点 10:切换 server.id =====
+  it('10a. 菜单打开时切换 server.id,菜单自动关闭', async () => {
+    const w = mountDetail(makeServer({ id: 1 }))
+    await w.find('.sk-pill-more').trigger('click')
+    expect(w.find('.sk-menu').exists()).toBe(true)
+    await w.setProps({ server: makeServer({ id: 2 }) })
+    await flush()
+    expect(w.find('.sk-menu').exists()).toBe(false)
+  })
+
+  it('10b. 确认弹窗打开时切换 server.id,弹窗自动关闭', async () => {
+    const w = mountDetail(makeServer({ id: 1 }))
+    await w.find('.sk-pill-more').trigger('click')
+    await w.findAll('.sk-menu button')[1].trigger('click')
+    await flush()
+    expect(host.querySelector('.sk-confirm')).not.toBeNull()
+    await w.setProps({ server: makeServer({ id: 2 }) })
+    await flush()
+    expect(host.querySelector('.sk-confirm')).toBeNull()
+  })
+})
+
+// SP8-P4 Task 7 —— 测试连接:三态(idle/testing/result)、D8(本地化错误 + 折叠
+// 技术详情)、D11(在途请求竞态守卫)。任务书 Step 1 给的完整用例,逐字照抄。
+describe('测试连接', () => {
+  beforeEach(() => { h.testMCPServer.mockReset() })
+
+  it('点按钮进入 testing 态:按钮禁用、文案变「测试中…」、出现 spinner', async () => {
+    let resolve!: (v: unknown) => void
+    h.testMCPServer.mockReturnValue(new Promise((r) => { resolve = r }))
+    const w = mountDetail(srv({ id: 5 }))
+    await w.find('.mcp-test-btn').trigger('click')
+    await nextTick()
+    expect(w.find('.mcp-test-btn').attributes('disabled')).toBeDefined()
+    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTesting)
+    expect(w.find('.mcp-test-btn .sk-spinner').exists()).toBe(true)
+    resolve({ ok: true, tool_count: 0, tools: [] })
+    await flushPromises()
+  })
+
+  it('stdio 才显示 90 秒提示,http 不显示(两次挂载对照)', async () => {
+    h.testMCPServer.mockReturnValue(new Promise(() => {}))
+    const a = mountDetail(srv({ transport: 'stdio', command: 'npx' }))
+    await a.find('.mcp-test-btn').trigger('click'); await nextTick()
+    expect(a.find('.mcp-test-hint').exists()).toBe(true)
+    const b = mountDetail(srv({ transport: 'http' }))
+    await b.find('.mcp-test-btn').trigger('click'); await nextTick()
+    expect(b.find('.mcp-test-hint').exists()).toBe(false)
+  })
+
+  // 单层取数的钉子:mock 是**裸对象**。若实现多剥一层 .data,这条会红。
+  it('成功:单层取数,显示已连接 · N 个工具 + 工具 chip', async () => {
+    h.testMCPServer.mockResolvedValue({ ok: true, tool_count: 2, tools: ['search', 'fetch'] })
+    const w = mountDetail(srv({ id: 5 }))
+    await w.find('.mcp-test-btn').trigger('click')
+    await flushPromises()
+    expect(h.testMCPServer).toHaveBeenCalledWith(5)
+    expect(w.find('.mcp-test-result').attributes('data-ok')).toBe('true')
+    expect(w.find('.mcp-test-line').text()).toContain('已连接 · 2 个工具')
+    expect(w.findAll('.mcp-tool-chip').map((c) => c.text())).toEqual(['search', 'fetch'])
+    expect(w.find('.mcp-test-detail').exists()).toBe(false)
+  })
+
+  it('失败:显示本地化文案,后端 error 英文串不出现在界面上', async () => {
+    h.testMCPServer.mockResolvedValue({
+      ok: false, error_key: 'connect_failed',
+      error: 'Connection failed: All connection attempts failed',
+      detail: 'All connection attempts failed',
+    })
+    const w = mountDetail(srv())
+    await w.find('.mcp-test-btn').trigger('click')
+    await flushPromises()
+    expect(w.find('.mcp-test-result').attributes('data-ok')).toBe('false')
+    expect(w.find('.mcp-test-line').text()).toContain(zh.aiMcpSrvTestErrConnect)
+    expect(w.text()).not.toContain('Connection failed: All connection attempts failed')
+  })
+
+  it('detail 非空才渲染折叠区,且默认折叠(无 open 属性)', async () => {
+    h.testMCPServer.mockResolvedValue({ ok: false, error_key: 'connect_failed', detail: 'ENOENT npx' })
+    const w = mountDetail(srv())
+    await w.find('.mcp-test-btn').trigger('click')
+    await flushPromises()
+    const d = w.find('.mcp-test-detail')
+    expect(d.exists()).toBe(true)
+    expect(d.attributes('open')).toBeUndefined()
+    expect(d.find('summary').text()).toBe(zh.aiMcpSrvTestDetail)
+    expect(d.find('pre').text()).toBe('ENOENT npx')
+  })
+
+  it('detail 为空时不渲染折叠区(对照)', async () => {
+    h.testMCPServer.mockResolvedValue({ ok: false, error_key: 'probe_timeout' })
+    const w = mountDetail(srv())
+    await w.find('.mcp-test-btn').trigger('click')
+    await flushPromises()
+    expect(w.find('.mcp-test-line').text()).toContain(zh.aiMcpSrvTestErrTimeout)
+    expect(w.find('.mcp-test-detail').exists()).toBe(false)
+  })
+
+  it('502 agent unreachable(抛错路径)→ 专用文案,不显示后端 body', async () => {
+    h.testMCPServer.mockRejectedValue(
+      Object.assign(new Error('x'), { response: { status: 502, data: { ok: false, error: 'agent unreachable' } } }),
+    )
+    const w = mountDetail(srv())
+    await w.find('.mcp-test-btn').trigger('click')
+    await flushPromises()
+    expect(w.find('.mcp-test-line').text()).toContain(zh.aiMcpSrvTestErrAgentDown)
+    expect(w.text()).not.toContain('agent unreachable')
+  })
+
+  it('testing 期间重复点击不重复发请求(Vue2 :159 的 if (!this.server || this.testing) return)', async () => {
+    h.testMCPServer.mockReturnValue(new Promise(() => {}))
+    const w = mountDetail(srv())
+    await w.find('.mcp-test-btn').trigger('click')
+    await w.find('.mcp-test-btn').trigger('click')
+    await w.find('.mcp-test-btn').trigger('click')
+    expect(h.testMCPServer).toHaveBeenCalledTimes(1)
+  })
+
+  it('切换服务器时清空 testing 与结果', async () => {
+    h.testMCPServer.mockResolvedValue({ ok: true, tool_count: 1, tools: ['a'] })
+    const w = mountDetail(srv({ id: 1 }))
+    await w.find('.mcp-test-btn').trigger('click')
+    await flushPromises()
+    expect(w.find('.mcp-test-result').exists()).toBe(true)
+    await w.setProps({ server: srv({ id: 2, name: 'other' }) })
+    await nextTick()
+    expect(w.find('.mcp-test-result').exists()).toBe(false)
+  })
+
+  // ★ D11 竞态守卫 —— 本任务的核心钉子。
+  // 弱断言(只查「结果面板不存在」)在切换后本来就成立,抓不出竞态;必须让
+  // 旧请求在切换**之后**才落地,再断言面板仍为空。
+  it('D11:在途请求落地时若已切到别的服务器,结果被丢弃(不串台)', async () => {
+    let resolveOld!: (v: unknown) => void
+    h.testMCPServer.mockReturnValueOnce(new Promise((r) => { resolveOld = r }))
+    const w = mountDetail(srv({ id: 1, name: 'old' }))
+    await w.find('.mcp-test-btn').trigger('click')
+    await nextTick()
+    // 切到另一台服务器
+    await w.setProps({ server: srv({ id: 2, name: 'new' }) })
+    await nextTick()
+    // 旧请求现在才落地,且是「成功」——若无守卫,会在新服务器面板上显示成功
+    resolveOld({ ok: true, tool_count: 9, tools: ['leaked'] })
+    await flushPromises()
+    expect(w.find('.mcp-test-result').exists()).toBe(false)
+    expect(w.text()).not.toContain('leaked')
+    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTest) // 不卡在「测试中…」
+  })
+
+  it('D11 对照:未切换时结果正常落地(守卫不能把正常路径也挡掉)', async () => {
+    let resolveIt!: (v: unknown) => void
+    h.testMCPServer.mockReturnValueOnce(new Promise((r) => { resolveIt = r }))
+    const w = mountDetail(srv({ id: 1 }))
+    await w.find('.mcp-test-btn').trigger('click')
+    await nextTick()
+    resolveIt({ ok: true, tool_count: 1, tools: ['kept'] })
+    await flushPromises()
+    expect(w.find('.mcp-test-result').attributes('data-ok')).toBe('true')
+    expect(w.text()).toContain('kept')
+  })
+
+  // ★ finally 守卫的判别性用例(评审 Important 补丁)。
+  // 只有「旧请求落地时,新一轮测试正在进行中」这个场景才能区分「有 seq 守卫」与
+  // 「无 seq 守卫」——因为只有这时 testing 的值才会被旧请求错误地打回 false。
+  // 时序:server1 点测试(悬挂)→ 切到 server2 → server2 点测试(悬挂,testing=true)
+  // → 此时才让 server1 的旧请求落地 → 断言界面仍是「测试中…」、按钮仍 disabled、
+  // 结果面板仍不存在。若 finally 分支是无条件 `testing.value = false`(去掉
+  // seq 比对),旧请求落地会把 testing 打回 false,这条会红。
+  it('finally 守卫:旧请求成功落地时若新一轮测试进行中,不会把 testing 打回 false', async () => {
+    let resolveOld!: (v: unknown) => void
+    h.testMCPServer.mockReturnValueOnce(new Promise((r) => { resolveOld = r }))
+    const w = mountDetail(srv({ id: 1, name: 'old' }))
+    await w.find('.mcp-test-btn').trigger('click')
+    await nextTick()
+    await w.setProps({ server: srv({ id: 2, name: 'new' }) })
+    await nextTick()
+    h.testMCPServer.mockReturnValueOnce(new Promise(() => {})) // 新一轮悬挂,不落地
+    await w.find('.mcp-test-btn').trigger('click')
+    await nextTick()
+    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTesting)
+    // 旧请求(server1)现在才成功落地
+    resolveOld({ ok: true, tool_count: 3, tools: ['leaked-ok'] })
+    await flushPromises()
+    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTesting)
+    expect(w.find('.mcp-test-btn').attributes('disabled')).toBeDefined()
+    expect(w.find('.mcp-test-result').exists()).toBe(false)
+  })
+
+  it('finally 守卫:旧请求抛错落地时若新一轮测试进行中,不会把 testing 打回 false', async () => {
+    let rejectOld!: (e: unknown) => void
+    h.testMCPServer.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectOld = reject }))
+    const w = mountDetail(srv({ id: 1, name: 'old' }))
+    await w.find('.mcp-test-btn').trigger('click')
+    await nextTick()
+    await w.setProps({ server: srv({ id: 2, name: 'new' }) })
+    await nextTick()
+    h.testMCPServer.mockReturnValueOnce(new Promise(() => {})) // 新一轮悬挂,不落地
+    await w.find('.mcp-test-btn').trigger('click')
+    await nextTick()
+    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTesting)
+    // 旧请求(server1)现在才抛错落地
+    rejectOld(Object.assign(new Error('boom'), { response: { status: 500, data: {} } }))
+    await flushPromises()
+    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTesting)
+    expect(w.find('.mcp-test-btn').attributes('disabled')).toBeDefined()
+    expect(w.find('.mcp-test-result').exists()).toBe(false)
+  })
+})
diff --git a/src/ai/components/settings/mcp/McpServerDetail.vue b/src/ai/components/settings/mcp/McpServerDetail.vue
new file mode 100644
index 0000000..6ef924b
--- /dev/null
+++ b/src/ai/components/settings/mcp/McpServerDetail.vue
@@ -0,0 +1,375 @@
+<!--
+  SP8-P4 Task 6 —— 1:1 移植自 Vue2 `NimoOS-UI/src/views/AI/MCP/McpServerDetail.vue`
+  (174 行)的 `:1-157`。Task 7(测试连接)补全了 T6 留白的三段:
+    - `:50-53` 「测试连接」按钮
+    - `:87-100` 测试提示 `.mcp-test-hint` / 结果面板 `.mcp-test-result`
+    - `:158-171` `runTest()` 方法与 `testing`/`testResult`(本仓 `testView`)状态,
+      外加 `watch(() => props.server?.id)` 里对应的重置
+  T7 的两条偏离(**D8** 错误呈现本地化 + 可折叠技术详情、**D11** 在途请求竞态守卫)
+  见 `<script>` 里 `runTest`/`reqSeq` 头注释与模板 `mcp-test-result` 分支内的注释。
+
+  【偏离 D3,公共约束 §3 第 3 条】`SkillIcon.vue` 不移植,统一用
+  `../../icons/AgentIcon.vue`(承 P3a/T5 先例)。
+  Vue2 `:121` 给删除按钮的 `SkillIcon` 传了具名色 `color="white"`——本仓不传。
+  已 grep 确认 `.sk-btn.danger`(sk-shared.scss:50-54)自带 `color: white` 声明:
+    &.danger { background: var(--danger); color: white; &:hover { ... } }
+  `AgentIcon` 的 `color` prop 默认值本就是 `currentColor`(AgentIcon.vue:79),
+  SVG `stroke` 走 `currentColor`(AgentIcon.vue:88)会继承按钮的 `color: white`,
+  不需要在本组件重复书写颜色——与 `SkillDetail.vue:507-510` 删除按钮的既有写法
+  (同样不传 color)完全一致,不是新模式。
+
+  【偏离 D9,公共约束 §3 第 9 条】Vue2 `:36-37` 的状态圆点用内联 `:style` 现场拼
+  `background` 与 `boxShadow`(两个色字面量,按配色约定不许出现在本文件里,已改写
+  成中文描述:「启用」态取语义色 `--success` 的实心点 + 同色半透明发光圈,「停用」态
+  取语义色 `--text-quaternary` 的实心点 + 同色半透明发光圈)。本仓整段内联 style 删掉,
+  只保留 `.val` 上的 `:data-disabled`,颜色改由 `skills-styles.scss` 已有的两条静态
+  规则供:`.sk-meta-cell .val .dot`(基础态,:351-369)与
+  `.val[data-disabled="true"] .dot`(停用态覆写,:370-376)。DOM 结构逐字相同——
+  `<div class="val" :data-disabled="...">` 包一个零属性的 `<span class="dot" />`,
+  两条选择器天然按 CSS 级联命中,零新 token。
+
+  【偏离 D6,公共约束 §3 第 6 条】移除确认弹窗不套 `SkModal`,直接用 reka Dialog
+  原语(`DialogRoot`/`DialogPortal`/`DialogOverlay`/`DialogContent`/`DialogTitle`)
+  手拼,写法照抄 `../skills/SkillDetail.vue:486-517`。同一分区两种弹窗外壳并存的
+  理由(与该文件头注释「偏离申报 2」同构):Vue2 的确认弹窗(`:112-125`)没有标题栏
+  (标题就是 `.sk-confirm-body` 里的 `<h3>`),`SkModal` 强制渲染标题栏 + 关闭按钮、
+  默认插槽套 `.sk-modal-body` 会与 `.sk-confirm-body` 自带的 padding 叠加、
+  `.sk-modal` 类也写死加不上 `.sk-confirm`——三条都套不上 `SkModal` 的形状,必须
+  手拼才能逐像素还原 Vue2。`DialogPortal to=".set-app"` 不可省——AI 区 token 定义在
+  `.agent-app`/`.set-app` 作用域(tokens.scss:31),portal 到 body 会让 `var(--…)`
+  全部解析失败,弹窗变透明底(这条已在本期文档里记录爆过三次)。无障碍标题用
+  `<VisuallyHidden as-child><DialogTitle>`,与 `SkillDetail.vue:492` 同款先例。
+
+  【外部点击关菜单,协调者裁定 5】Vue2 `:143-153` 是 `watch(menuOpen)` 里条件式
+  加/删 `document` 的 `mousedown` 监听 + `beforeDestroy` 兜底移除。本文件按裁定
+  用 `watch` + `onBeforeUnmount` 逐字等价实现(不用 `useClickOutside` composable
+  ——那是 P3b `SkillDetail.vue` 的实现选择,本任务书明确要求这里手写以对齐 Vue2
+  的条件式挂载时序)。只监听 `mousedown`,不额外监听 `click`,也不加 Esc——那些是
+  未申报的偏离。
+
+  【偏离 D4,公共约束 §3 第 4 条】不写 `console.error`(本文件里也没有会产生错误
+  需要打日志的路径,纯展示 + 转发 emit)。
+
+  【实现选择,非行为偏离】Vue2 data 字段名是 `confirm`(布尔),本仓改名
+  `confirmOpen`——原因与 `SkillDetail.vue:156-158` 完全相同:避免与 JS 全局
+  `window.confirm` 同名产生阅读歧义,纯标识符改名,DOM/行为不变。
+  Vue2 `color()`/`label2()` 两个 computed/方法只是对 `serverColor`/`transportLabel`
+  的直接转发,本仓比照 `McpServerGroup.vue`(T5)的先例直接在模板里调用工具函数,
+  不新增等价的包装 computed。
+  Vue2 `:119` 的 `<div class="right" style="margin-left: auto">` 与
+  `sk-shared.scss:149` 已有的 `.sk-modal-foot .right { margin-left: auto; ... }`
+  规则重复(同 `SkillDetail.vue:505` 的既有写法),故不重复书写这条内联样式——
+  视觉结果不变,不是遗漏。
+
+  零 `<style>` 块:用到的每个类均已存在于 `skills-styles.scss`
+  (`sk-detail*`/`sk-name`/`sk-meta-*`/`sk-section*`/`sk-menu`/`sk-pill-more`/
+  `sk-confirm*`)、`sk-shared.scss`(`sw`/`sk-modal*`/`sk-btn`)或 T1 的
+  `mcp-styles.scss`(`mcp-config*`/`mcp-code`)。
+-->
+<script setup lang="ts">
+import { ref, watch, onBeforeUnmount } from 'vue'
+import { useI18n } from 'vue-i18n'
+import { service } from '@nimotech/nimoos-service'
+import {
+  DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, VisuallyHidden,
+} from 'reka-ui'
+import type { McpServer, McpTestView } from '../../../types/mcpServer'
+import { toTestView, toTestViewFromError } from '../../../util/mcpErrorKey'
+import { serverColor, transportLabel, SERVER_GLYPH } from '../../../util/mcpServerVisual'
+import AgentIcon from '../../icons/AgentIcon.vue'
+import SkillTile from '../skills/SkillTile.vue'
+
+// 对齐 Vue2 `props: { server: { type: Object, default: null } }`(:139)。
+const props = defineProps<{ server: McpServer | null }>()
+
+// 对齐 Vue2 `$emit('toggle', …)`(:18)/`$emit('edit', …)`(:22)/`$emit('delete', …)`(:157)。
+const emit = defineEmits<{
+  (e: 'toggle', id: number, enabled: boolean): void
+  (e: 'edit', server: McpServer): void
+  (e: 'delete', id: number): void
+}>()
+
+const { t } = useI18n()
+
+// 后端没有图标字段,全部 MCP 服务统一用这个字形(Vue2 `data(){ glyph: SERVER_GLYPH }`,:140)。
+const glyph = SERVER_GLYPH
+
+// 更多菜单开合,对齐 Vue2 `data(){ menuOpen: false }`(:140)。
+const menuOpen = ref(false)
+// 删除确认弹窗,对齐 Vue2 `data(){ confirm: false }`(:140)——改名 confirmOpen,
+// 见文件头注释「实现选择,非行为偏离」。
+const confirmOpen = ref(false)
+// `.sk-pill-more` 按钮 + `.sk-menu` 下拉的包裹元素,对齐 Vue2 `ref="menuWrap"`(:19)。
+const menuWrap = ref<HTMLElement | null>(null)
+
+// 测试连接,对齐 Vue2 `data(){ testing: false, testResult: null }`(:140)——本仓
+// `testResult` 改名 `testView`,因为存的是 T3 `toTestView`/`toTestViewFromError`
+// 映射后的 `McpTestView`(i18n 键 + detail),不是后端裸响应,改名避免与
+// `McpTestResult`(后端原始形状,types/mcpServer.ts)混淆。
+const testing = ref(false)
+const testView = ref<McpTestView | null>(null)
+// 【偏离 D11,公共约束 §3 第 11 条】Vue2 `runTest`(`:158-171`)没有请求令牌:
+// stdio 探测最长 100 秒(`NimoOS-AI/route/v2/mcp.go:346`),这期间用户切到别的
+// 服务器时,上面的 `watch(() => props.server?.id)` 已经把 `testView` 清空,
+// 但在途 promise 落地后仍会执行 `testView.value = ...`,把**旧服务器的结果**
+// 写进**新服务器的面板**——可复现的错配,不是无害的时序巧合。这里用单调递增的
+// `reqSeq` 守卫:进入时取号,`watch` 里切换服务器会让号作废,成功/失败/finally
+// 三处落地前都比对号是否还是自己发出时的那个,不是就整体丢弃(包括不复位
+// `testing`,因为那已经是新一轮的状态,由新一轮自己的 finally 负责)。
+const reqSeq = ref(0)
+
+// 对齐 Vue2 `runTest()`(:158-171)。
+async function runTest() {
+  if (!props.server || testing.value) return // Vue2 :159 逐字对应
+  const seq = ++reqSeq.value
+  const id = props.server.id
+  testing.value = true
+  testView.value = null
+  try {
+    // 【偏离 D1,公共约束 §3 第 1 条】单层取数:共享包 `service.ai.testMCPServer`
+    // 已 `return res.data`(`NimoOS-Service/src/ai.ts:388-391`),后端
+    // `mcp.go:355` 是 `c.JSONBlob` 裸对象。Vue2 `:164` 的 `resp.data` 在本仓
+    // 恒为 `undefined`,会让「测试连接」**永远显示连接失败**,哪怕后端返回
+    // `ok:true`——照抄即缺陷,这里直接用 `body` 本身。
+    const body = await service.ai.testMCPServer(id)
+    if (seq !== reqSeq.value) return
+    testView.value = toTestView(body)
+  } catch (e) {
+    if (seq !== reqSeq.value) return
+    testView.value = toTestViewFromError(e)
+  } finally {
+    if (seq === reqSeq.value) testing.value = false
+  }
+}
+
+// 外部点击关闭菜单,逐字等价 Vue2 `watch: { menuOpen(v) {...} }`(:143-150)+
+// `beforeDestroy`(:153)。见文件头注释「外部点击关菜单」。
+let docListener: ((e: MouseEvent) => void) | null = null
+watch(menuOpen, (v) => {
+  if (v) {
+    docListener = (e: MouseEvent) => {
+      const w = menuWrap.value
+      if (w && !w.contains(e.target as Node)) menuOpen.value = false
+    }
+    document.addEventListener('mousedown', docListener)
+  } else if (docListener) {
+    document.removeEventListener('mousedown', docListener)
+    docListener = null
+  }
+})
+onBeforeUnmount(() => {
+  if (docListener) document.removeEventListener('mousedown', docListener)
+})
+
+// 对齐 Vue2 `watch: { 'server.id'() {...} }`(:151),同一行还清了
+// `this.testing = false; this.testResult = null`。本仓额外 `reqSeq.value++`
+// ——【偏离 D11】见下方 `runTest` 头注释:让切走时仍在途的旧请求失效,落地时
+// 序号比对不通过就整体丢弃,不会把旧服务器的测试结果写进新服务器的面板。
+watch(() => props.server?.id, () => {
+  menuOpen.value = false
+  confirmOpen.value = false
+  reqSeq.value += 1
+  testing.value = false
+  testView.value = null
+})
+
+// 对齐 Vue2 `closeAnd(fn)`(:155)。
+function closeAnd(fn?: () => void) {
+  menuOpen.value = false
+  fn?.()
+}
+
+// 对齐 Vue2 菜单第一项内联箭头 `() => $emit('edit', server)`(:22)。拆成具名函数
+// (而不是模板内联箭头函数体)是因为 vue-tsc 对 v-else 分支里 `server` 的非空窄化
+// 不会穿透进模板内联箭头函数体(TS18047),具名函数在 <script> 里用 `props.server`
+// 重新判空即可规避——与 `SkillDetail.vue` `toggleFromMenu` 头注释同款说明,行为与
+// 内联写法完全等价。
+function emitEdit() {
+  const s = props.server
+  if (!s) return
+  emit('edit', s)
+}
+
+// 对齐 Vue2 菜单第二项内联箭头 `() => confirm = true`(:24),理由同上。
+function openConfirmDialog() {
+  confirmOpen.value = true
+}
+
+// 对齐 Vue2 `doDelete()`(:157)。
+function doDelete() {
+  const s = props.server
+  if (!s) return
+  confirmOpen.value = false
+  emit('delete', s.id)
+}
+</script>
+
+<template>
+  <div class="sk-detail">
+    <template v-if="!server">
+      <div class="sk-detail-empty">
+        <div class="sk-detail-empty-inner">
+          <div class="orb" />
+          <div class="empty-title">{{ t('aiMcpSrvPickHint') }}</div>
+          <div class="empty-sub">{{ t('aiMcpSrvPickSub') }}</div>
+        </div>
+      </div>
+    </template>
+    <template v-else>
+      <div class="sk-detail-bar">
+        <SkillTile :color="serverColor(server.name)" :icon="glyph" :size="28" :radius="8" />
+        <div class="sk-name"><span>{{ server.name }}</span><code>{{ transportLabel(server.transport) }}</code></div>
+        <div
+          class="sw"
+          :data-on="server.enabled ? 'true' : 'false'"
+          role="switch"
+          :aria-checked="server.enabled ? 'true' : 'false'"
+          @click="emit('toggle', server.id, !server.enabled)"
+        />
+        <div ref="menuWrap" style="position: relative">
+          <button class="sk-pill-more" @click="menuOpen = !menuOpen">
+            <AgentIcon name="settings" :size="16" />
+          </button>
+          <div v-if="menuOpen" class="sk-menu">
+            <button @click="closeAnd(emitEdit)">
+              <AgentIcon name="edit" :size="13" /> {{ t('aiMcpSrvEditConfig') }}
+            </button>
+            <hr>
+            <button data-danger="true" @click="closeAnd(openConfirmDialog)">
+              <AgentIcon name="trash" :size="13" /> {{ t('aiMcpSrvRemove') }}
+            </button>
+          </div>
+        </div>
+      </div>
+
+      <div class="sk-detail-body">
+        <div class="sk-detail-inner">
+          <div class="sk-meta-grid">
+            <div class="sk-meta-cell">
+              <div class="lbl">{{ t('aiMcpSrvStatus') }}</div>
+              <div class="val" :data-disabled="!server.enabled ? 'true' : 'false'">
+                <span class="dot" />
+                {{ server.enabled ? t('aiCfgEnabled') : t('aiMcpSrvDisabled') }}
+              </div>
+            </div>
+            <div class="sk-meta-cell">
+              <div class="lbl">{{ t('aiMcpSrvTransport') }}</div>
+              <div class="val">{{ transportLabel(server.transport) }}</div>
+            </div>
+            <div v-if="server.transport !== 'stdio'" class="sk-meta-cell">
+              <div class="lbl">{{ t('aiMcpSrvHeaders') }}</div>
+              <div class="val">{{ server.has_headers ? t('aiMcpSrvConfigured') : t('aiMcpSrvNone') }}</div>
+            </div>
+            <div class="sk-meta-cell">
+              <div class="lbl">{{ t('aiMcpSrvEnv') }}</div>
+              <div class="val">{{ server.has_env ? t('aiMcpSrvConfigured') : t('aiMcpSrvNone') }}</div>
+            </div>
+          </div>
+
+          <div class="sk-section">
+            <div class="sk-section-head">
+              <div class="sk-section-title">{{ t('aiMcpSrvConfiguration') }}</div>
+              <div class="sk-section-hint">{{ t('aiMcpSrvConfigHint') }}</div>
+              <!-- 对齐 Vue2 :50-53。 -->
+              <button class="sk-btn ghost mcp-test-btn" :disabled="testing" @click="runTest">
+                <span v-if="testing" class="sk-spinner" />
+                {{ testing ? t('aiMcpSrvTesting') : t('aiMcpSrvTest') }}
+              </button>
+            </div>
+            <div class="sk-section-body">
+              <div class="mcp-config">
+                <template v-if="server.transport === 'stdio'">
+                  <div class="mcp-config-row">
+                    <div class="lbl">{{ t('aiMcpSrvCommand') }}</div>
+                    <div class="val"><code class="mcp-code">{{ server.command }}</code></div>
+                  </div>
+                  <div class="mcp-config-row">
+                    <div class="lbl">{{ t('aiMcpSrvArgs') }}</div>
+                    <div class="val"><code class="mcp-code">{{ (server.args || []).join(' ') || t('aiMcpSrvNone') }}</code></div>
+                  </div>
+                  <div class="mcp-config-row">
+                    <div class="lbl">{{ t('aiMcpSrvEnvVars') }}</div>
+                    <div class="val">{{ server.has_env ? t('aiMcpSrvConfiguredHidden') : t('aiMcpSrvNone') }}</div>
+                  </div>
+                </template>
+                <template v-else>
+                  <div class="mcp-config-row">
+                    <div class="lbl">{{ t('aiMcpSrvUrl') }}</div>
+                    <div class="val"><code class="mcp-code">{{ server.url }}</code></div>
+                  </div>
+                  <div class="mcp-config-row">
+                    <div class="lbl">{{ t('aiMcpSrvReqHeaders') }}</div>
+                    <div class="val">{{ server.has_headers ? t('aiMcpSrvConfiguredHidden') : t('aiMcpSrvNone') }}</div>
+                  </div>
+                  <div class="mcp-config-row">
+                    <div class="lbl">{{ t('aiMcpSrvEnvVars') }}</div>
+                    <div class="val">{{ server.has_env ? t('aiMcpSrvConfiguredHidden') : t('aiMcpSrvNone') }}</div>
+                  </div>
+                </template>
+              </div>
+
+              <!-- 对齐 Vue2 :87-100,stdio 90 秒提示照抄。 -->
+              <div v-if="testing && server.transport === 'stdio'" class="mcp-test-hint">
+                {{ t('aiMcpSrvTestStdioHint') }}
+              </div>
+              <div v-if="testView" class="mcp-test-result" :data-ok="testView.ok ? 'true' : 'false'">
+                <template v-if="testView.ok">
+                  <div class="mcp-test-line">✓ {{ t('aiMcpSrvTestOk', { n: testView.toolCount }) }}</div>
+                  <div class="mcp-test-tools">
+                    <span v-for="tool in testView.tools" :key="tool" class="mcp-tool-chip">{{ tool }}</span>
+                  </div>
+                </template>
+                <template v-else>
+                  <div class="mcp-test-line">✗ {{ t(testView.msgKey) }}</div>
+                  <!-- 【偏离 D8,公共约束 §3 第 8 条】Vue2 `:98` 直接显示后端拼好的
+                       英文 error 串(`testResult.error`)。这里改成 `error_key`
+                       映射出的本地化一句话(`testView.msgKey`)+ 默认折叠的技术
+                       详情(`testView.detail`,用户 2026-07-31 拍板);后端英文
+                       原文一律不上界面。`detail` 为空时整个折叠区不渲染
+                       (`v-if="testView.detail"`)——本控件 Vue2 没有,是本期新增
+                       的、已授权的界面偏离,不是"照抄之外顺手加的东西"。 -->
+                  <details v-if="testView.detail" class="mcp-test-detail">
+                    <summary>{{ t('aiMcpSrvTestDetail') }}</summary>
+                    <pre>{{ testView.detail }}</pre>
+                  </details>
+                </template>
+              </div>
+            </div>
+          </div>
+
+          <div class="sk-section">
+            <div class="sk-section-body">
+              <div class="sk-description">{{ t('aiMcpSrvToolsNote') }}</div>
+            </div>
+          </div>
+        </div>
+      </div>
+
+      <!-- 移除确认弹窗,对齐 Vue2 :112-125。偏离 D6(见文件头注释):不套 SkModal,
+           reka 原语手拼,写法照抄 SkillDetail.vue:486-517。 -->
+      <DialogRoot :open="confirmOpen" @update:open="confirmOpen = $event">
+        <DialogPortal to=".set-app" defer>
+          <DialogOverlay class="sk-modal-bg">
+            <DialogContent class="sk-modal sk-confirm" :aria-describedby="undefined">
+              <VisuallyHidden as-child><DialogTitle>{{ t('aiMcpSrvRemoveTitle') }}</DialogTitle></VisuallyHidden>
+              <div class="sk-confirm-body">
+                <h3>{{ t('aiMcpSrvRemoveTitle') }}</h3>
+                <p>{{ t('aiMcpSrvRemoveBody', { name: server.name }) }}</p>
+              </div>
+              <div class="sk-modal-foot">
+                <div class="right">
+                  <button class="sk-btn ghost" @click="confirmOpen = false">{{ t('aiCancel') }}</button>
+                  <!-- 偏离 D3(见文件头注释):不传 color="white",由 .sk-btn.danger
+                       自带的 color: white 供色,AgentIcon 默认 currentColor 继承。 -->
+                  <button class="sk-btn danger" @click="doDelete">
+                    <AgentIcon name="trash" :size="13" /> {{ t('aiMcpSrvRemoveConfirm') }}
+                  </button>
+                </div>
+              </div>
+            </DialogContent>
+          </DialogOverlay>
+        </DialogPortal>
+      </DialogRoot>
+    </template>
+  </div>
+</template>
diff --git a/src/ai/components/settings/mcp/McpServerGroup.test.ts b/src/ai/components/settings/mcp/McpServerGroup.test.ts
new file mode 100644
index 0000000..d24497c
--- /dev/null
+++ b/src/ai/components/settings/mcp/McpServerGroup.test.ts
@@ -0,0 +1,77 @@
+import { describe, it, expect } from 'vitest'
+import { mount } from '@vue/test-utils'
+import { createI18n } from 'vue-i18n'
+import McpServerGroup from './McpServerGroup.vue'
+import zh from '../../../../i18n/zh_cn'
+import type { McpServer } from '../../../types/mcpServer'
+
+// SP8-P4 Task 5 —— 对齐 Vue2 src/views/AI/MCP/McpServerGroup.vue(47 行)。
+// brief Step 1 给的测试逐字照抄(公共约束 §2:brief 测试与 1:1 照 Vue2 冲突才是测试错,
+// 本任务书里的测试与蓝本行为核对无冲突,故不改)。
+
+const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
+
+function srv(p: Partial<McpServer> = {}): McpServer {
+  return {
+    id: 1, name: 'brave', transport: 'http', url: 'https://example.com/mcp',
+    command: '', args: [], enabled: true, has_headers: false, has_env: false, ...p,
+  }
+}
+const mountG = (items: McpServer[], activeId: number | null = null) =>
+  mount(McpServerGroup, { props: { label: '已启用服务', items, activeId }, global: { plugins: [i18n] } })
+
+describe('McpServerGroup', () => {
+  it('渲染分组标题与计数', () => {
+    const w = mountG([srv(), srv({ id: 2, name: 'notion' })])
+    expect(w.find('.sk-group-label').text()).toContain('已启用服务')
+    expect(w.find('.sk-group-count').text()).toBe('2')
+  })
+
+  it('每项渲染名称、transport 标签、url', () => {
+    const w = mountG([srv({ name: 'brave', transport: 'sse', url: 'https://x/sse' })])
+    expect(w.find('.sk-item-name').text()).toBe('brave')
+    expect(w.find('.mcp-transport').text()).toBe('SSE')
+    expect(w.find('.mcp-transport').attributes('data-t')).toBe('sse')
+    expect(w.find('.sk-item-desc').text()).toBe('https://x/sse')
+  })
+
+  it('点击条目 emit pick(id)', async () => {
+    const w = mountG([srv({ id: 7 })])
+    await w.find('.sk-item').trigger('click')
+    expect(w.emitted('pick')).toEqual([[7]])
+  })
+
+  // 判别力:两项且只有第二项是 active —— 单元素数组测不出 activeId 是否真的比对了 id。
+  it('只有 id 命中 activeId 的那一项带 data-active=true', () => {
+    const w = mountG([srv({ id: 1 }), srv({ id: 2, name: 'b' })], 2)
+    const items = w.findAll('.sk-item')
+    expect(items[0].attributes('data-active')).toBe('false')
+    expect(items[1].attributes('data-active')).toBe('true')
+  })
+
+  // 判别力:两项一开一关。
+  it('停用项带 data-disabled=true 并显示 Off 角标,启用项不显示', () => {
+    const w = mountG([srv({ id: 1, enabled: true }), srv({ id: 2, name: 'b', enabled: false })])
+    const items = w.findAll('.sk-item')
+    expect(items[0].attributes('data-disabled')).toBe('false')
+    expect(items[1].attributes('data-disabled')).toBe('true')
+    expect(items[0].find('.sk-item-off').exists()).toBe(false)
+    expect(items[1].find('.sk-item-off').text()).toBe(zh.aiSkOff)
+  })
+
+  it('点标题折叠/展开(Vue2 :3 的 collapsed 开关)', async () => {
+    const w = mountG([srv(), srv({ id: 2, name: 'b' })])
+    expect(w.findAll('.sk-item')).toHaveLength(2)
+    await w.find('.sk-group-label').trigger('click')
+    expect(w.findAll('.sk-item')).toHaveLength(0)
+    expect(w.find('.sk-group-label').attributes('data-collapsed')).toBe('true')
+    await w.find('.sk-group-label').trigger('click')
+    expect(w.findAll('.sk-item')).toHaveLength(2)
+  })
+
+  it('同名服务器拿到同一个色板 id(色块走 SkillTile)', () => {
+    const w = mountG([srv({ id: 1, name: 'same' }), srv({ id: 2, name: 'same' })])
+    const tiles = w.findAll('.sk-tile')
+    expect(tiles[0].attributes('style')).toBe(tiles[1].attributes('style'))
+  })
+})
diff --git a/src/ai/components/settings/mcp/McpServerGroup.vue b/src/ai/components/settings/mcp/McpServerGroup.vue
new file mode 100644
index 0000000..730feda
--- /dev/null
+++ b/src/ai/components/settings/mcp/McpServerGroup.vue
@@ -0,0 +1,88 @@
+<!--
+  SP8-P4 Task 5 —— 1:1 移植自 Vue2 `NimoOS-UI/src/views/AI/MCP/McpServerGroup.vue`(47 行)。
+  结构上的孪生兄弟是 `../skills/SkillGroup.vue`(109 行,SP8-P3a Task 4,已评审通过)——
+  本文件的 `<script setup>` 写法、`.sk-group-*`/`.sk-item*` 外壳用法照它抄,不引入第三种模式。
+
+  【偏离 D3(公共约束 §3 第 3 条)】Vue2 `:29`/`:4` 的 `SkillIcon` 不移植,统一用
+  `../../icons/AgentIcon.vue`(chevDown 图标 AgentIcon.vue:19 已有)——承 P3a 先例,
+  与 SkillGroup.vue 头部注释同一条偏离。
+
+  【i18n 复用,非新增】Vue2 `:20` `$t('Off')` → 本仓 `aiSkOff`(值「已关闭」,
+  已在 T4 核实与 Vue2 zh 值逐字相同)。这是**跨域复用既有键**(该键定义在 skills 域),
+  不是本任务新增——分组标题 `label` 由父组件 T9 `McpSection.vue` 以 prop 传入
+  (对应 `aiMcpSrvGroupEnabled`/`aiMcpSrvGroupDisabled`),本组件不 `t()` 它。
+
+  【data-active / data-disabled】照 Vue2 :10-11 写成字符串 'true'/'false'(不用布尔)——
+  供 CSS 属性选择器命中(skills-styles.scss:95 起的 `.sk-item[data-active="true"]` 等)。
+
+  【色板与字形】Vue2 `:43` `color(n)`/`label2(t)` 方法体分别转发给
+  `serverColor`/`transportLabel`(`../../../util/mcpServerVisual.ts`,T2);`glyph` 是
+  Vue2 `:41` `data(){ glyph: SERVER_GLYPH }` 的等价物——本仓用常量直接引用,不放进
+  `data()`(无响应式需求,`<script setup>` 里没有等价的 `data()` 概念)。
+
+  零 <style> 块:用到的类均已在既有 scss 里 ——
+  `.sk-group-label`/`-chev`/`-count`、`.sk-item`/`-body`/`-head`/`-name`/`-desc`/`-meta`/`-off`
+  在 skills-styles.scss(:61,70,77,95,112,127-170);`.mcp-transport`(含三个 data-t 变体)
+  在 mcp-styles.scss(T1,:23-30)。
+-->
+<script setup lang="ts">
+import { ref } from 'vue'
+import { useI18n } from 'vue-i18n'
+import type { McpServer } from '../../../types/mcpServer'
+import { serverColor, transportLabel, SERVER_GLYPH } from '../../../util/mcpServerVisual'
+import AgentIcon from '../../icons/AgentIcon.vue'
+import SkillTile from '../skills/SkillTile.vue'
+
+const props = defineProps<{
+  label: string
+  items: McpServer[]
+  activeId: number | null
+}>()
+
+const emit = defineEmits<{ pick: [id: number] }>()
+
+const { t } = useI18n()
+
+// 本地折叠状态,默认展开——对齐 Vue2 :41 `data() { return { collapsed: false, ... } }`。
+const collapsed = ref(false)
+
+// Vue2 :41 `glyph: SERVER_GLYPH`——后端没有图标字段,全部 MCP 服务统一用这个字形,
+// 无响应式需求,不放进 ref。
+const glyph = SERVER_GLYPH
+</script>
+
+<template>
+  <div>
+    <div
+      class="sk-group-label"
+      :data-collapsed="collapsed"
+      @click="collapsed = !collapsed"
+    >
+      <span class="sk-group-chev"><AgentIcon name="chevDown" :size="11" /></span>
+      <span>{{ props.label }}</span>
+      <span class="sk-group-count">{{ props.items.length }}</span>
+    </div>
+    <template v-if="!collapsed">
+      <div
+        v-for="s in props.items"
+        :key="s.id"
+        class="sk-item"
+        :data-active="s.id === props.activeId ? 'true' : 'false'"
+        :data-disabled="!s.enabled ? 'true' : 'false'"
+        @click="emit('pick', s.id)"
+      >
+        <SkillTile :color="serverColor(s.name)" :icon="glyph" />
+        <div class="sk-item-body">
+          <div class="sk-item-head">
+            <div class="sk-item-name">{{ s.name }}</div>
+            <div class="mcp-transport" :data-t="s.transport">{{ transportLabel(s.transport) }}</div>
+          </div>
+          <div class="sk-item-desc">{{ s.url }}</div>
+          <div class="sk-item-meta">
+            <span v-if="!s.enabled" class="sk-item-off">{{ t('aiSkOff') }}</span>
+          </div>
+        </div>
+      </div>
+    </template>
+  </div>
+</template>
diff --git a/src/ai/components/settings/mcp/McpServerModal.test.ts b/src/ai/components/settings/mcp/McpServerModal.test.ts
new file mode 100644
index 0000000..3de0348
--- /dev/null
+++ b/src/ai/components/settings/mcp/McpServerModal.test.ts
@@ -0,0 +1,486 @@
+import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
+import { mount } from '@vue/test-utils'
+import { nextTick } from 'vue'
+import { createI18n } from 'vue-i18n'
+import zh from '../../../../i18n/zh_cn'
+import McpServerModal from './McpServerModal.vue'
+import type { McpServer } from '../../../types/mcpServer'
+
+// SP8-P4 Task 8 —— 对齐 Vue2 src/views/AI/MCP/McpServerModal.vue(216 行)。
+// 挂载手法与 ../skills/AddSkillModal.test.ts 一致(同款 SkModal 外壳):
+// SkModal 的 DialogPortal 默认 portal 到 '.set-app',目标元素必须在组件挂载前
+// 就存在于 DOM;打开态聚焦用 setTimeout(fn, 0)(宏任务),纯微任务级 flush()
+// 追不上,需要 macroFlush() 真的跑完一个宏任务。
+
+// vi.hoisted 避免 ESM 提升的 TDZ(公共约束 §9 先例 agentStore.test.ts:4-19)。
+const h = vi.hoisted(() => ({ parseMCPCommand: vi.fn() }))
+vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: h } }))
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
+function makeServer(overrides: Partial<McpServer> = {}): McpServer {
+  return {
+    id: 1,
+    name: 'brave-search',
+    transport: 'http',
+    url: 'https://mcp.example.com/brave',
+    command: '',
+    args: [],
+    enabled: true,
+    has_headers: false,
+    has_env: false,
+    ...overrides,
+  }
+}
+
+function mountModal(
+  props: Partial<{ open: boolean; server: McpServer | null; saving: boolean; serverError: string }> = {},
+) {
+  return mount(McpServerModal, {
+    props: { open: true, server: null, saving: false, serverError: '', ...props },
+    global: { plugins: [i18n] },
+    attachTo: document.body,
+  })
+}
+
+const flush = async () => { await nextTick(); await nextTick(); await nextTick() }
+// 组件的打开态聚焦用 setTimeout(fn, 0)(宏任务)覆盖 reka 的默认 mount-auto-focus
+// (先例 AddSkillModal.vue 头注释「reka 初始焦点实测结论」),纯微任务级 flush()
+// 追不上,需要真的让一个宏任务跑完。
+const macroFlush = async () => { await flush(); await new Promise((r) => setTimeout(r, 0)); await flush() }
+
+function modalTitleEl() { return document.querySelector('.sk-modal .sk-modal-title') as HTMLElement }
+function nameInput() { return document.querySelector('.sk-modal [data-f="name"]') as HTMLInputElement }
+function urlInput() { return document.querySelector('.sk-modal [data-f="url"]') as HTMLInputElement }
+function commandInput() { return document.querySelector('.sk-modal [data-f="command"]') as HTMLInputElement }
+function pasteInput() { return document.querySelector('.sk-modal [data-f="paste"]') as HTMLInputElement }
+function fillBtn() { return document.querySelector('.sk-modal [data-f="fill"]') as HTMLButtonElement }
+function submitBtn() { return document.querySelector('.sk-modal-foot .sk-btn.primary') as HTMLButtonElement }
+function cancelBtn() { return document.querySelector('.sk-modal-foot .sk-btn.ghost') as HTMLButtonElement }
+function trigOptions() { return Array.from(document.querySelectorAll('.sk-modal .sk-trig-option')) as HTMLElement[] }
+
+function setValue(el: HTMLInputElement | HTMLTextAreaElement, v: string) {
+  el.value = v
+  el.dispatchEvent(new Event('input'))
+}
+
+beforeEach(() => { withHost(); h.parseMCPCommand.mockReset() })
+afterEach(() => { document.body.innerHTML = '' })
+
+describe('McpServerModal', () => {
+  // ===== 覆盖点 1:标题两态对照 =====
+  it('1a. 新增态(server=null)标题为 aiMcpSrvAdd', async () => {
+    mountModal({ server: null })
+    await macroFlush()
+    expect(modalTitleEl().textContent).toBe(zh.aiMcpSrvAdd)
+  })
+
+  it('1b. 编辑态(server 非空)标题为 aiMcpSrvEditTitle', async () => {
+    mountModal({ server: makeServer() })
+    await macroFlush()
+    expect(modalTitleEl().textContent).toBe(zh.aiMcpSrvEditTitle)
+  })
+
+  // ===== 覆盖点 2:快速添加区只在新增态渲染 =====
+  it('2a. 新增态渲染 .mcp-quickadd-row', async () => {
+    mountModal({ server: null })
+    await macroFlush()
+    expect(document.querySelector('.sk-modal .mcp-quickadd-row')).not.toBeNull()
+  })
+
+  it('2b. 编辑态不渲染 .mcp-quickadd-row(Vue2 :9 的 v-if="!isEdit")', async () => {
+    mountModal({ server: makeServer() })
+    await macroFlush()
+    expect(document.querySelector('.sk-modal .mcp-quickadd-row')).toBeNull()
+  })
+
+  // ===== 覆盖点 3:传输三选一 =====
+  it('3. 三个 .sk-trig-option 文案正确;点 STDIO 后 data-active 移到它身上', async () => {
+    mountModal({ server: null })
+    await macroFlush()
+    const opts = trigOptions()
+    expect(opts).toHaveLength(3)
+    expect(opts[0].textContent).toContain(zh.aiMcpSrvTransportHttp)
+    expect(opts[1].textContent).toContain(zh.aiMcpSrvTransportSse)
+    expect(opts[2].textContent).toContain(zh.aiMcpSrvTransportStdio)
+    expect(opts[0].dataset.active).toBe('true') // 默认 transport: 'http'
+
+    opts[2].click()
+    await nextTick()
+    expect(opts[2].dataset.active).toBe('true')
+    expect(opts[0].dataset.active).toBe('false')
+    expect(opts[1].dataset.active).toBe('false')
+  })
+
+  // ===== 覆盖点 4:字段按 transport 切换,两次对照 =====
+  it('4a. stdio 态:有 command/args/env-kv,无 url/headers-kv', async () => {
+    mountModal({ server: makeServer({ transport: 'stdio', command: 'npx' }) })
+    await macroFlush()
+    expect(document.querySelector('.sk-modal [data-f="command"]')).not.toBeNull()
+    expect(document.querySelector('.sk-modal [data-f="args"]')).not.toBeNull()
+    expect(document.querySelector('.sk-modal [data-kv="env"]')).not.toBeNull()
+    expect(document.querySelector('.sk-modal [data-f="url"]')).toBeNull()
+    expect(document.querySelector('.sk-modal [data-kv="headers"]')).toBeNull()
+  })
+
+  it('4b. http 态:有 url/headers-kv,无 command/args/env-kv', async () => {
+    mountModal({ server: makeServer({ transport: 'http' }) })
+    await macroFlush()
+    expect(document.querySelector('.sk-modal [data-f="url"]')).not.toBeNull()
+    expect(document.querySelector('.sk-modal [data-kv="headers"]')).not.toBeNull()
+    expect(document.querySelector('.sk-modal [data-f="command"]')).toBeNull()
+    expect(document.querySelector('.sk-modal [data-f="args"]')).toBeNull()
+    expect(document.querySelector('.sk-modal [data-kv="env"]')).toBeNull()
+  })
+
+  // ===== 覆盖点 5:valid 四条独立断言 =====
+  it('5a. 名称空 → 提交按钮 disabled', async () => {
+    mountModal({ server: null })
+    await macroFlush()
+    expect(submitBtn().disabled).toBe(true)
+  })
+
+  it('5b. 名称有值但(http)URL 空 → disabled', async () => {
+    mountModal({ server: null })
+    await macroFlush()
+    setValue(nameInput(), 'my-server')
+    await flush()
+    expect(submitBtn().disabled).toBe(true)
+  })
+
+  it('5c. 名称、URL 都有值(http)→ enabled', async () => {
+    mountModal({ server: null })
+    await macroFlush()
+    setValue(nameInput(), 'my-server')
+    setValue(urlInput(), 'https://x.example.com')
+    await flush()
+    expect(submitBtn().disabled).toBe(false)
+  })
+
+  it('5d. stdio 下 URL 空但 command 有值 → enabled', async () => {
+    mountModal({ server: null })
+    await macroFlush()
+    trigOptions()[2].click() // 切到 STDIO
+    await nextTick()
+    setValue(nameInput(), 'my-server')
+    setValue(commandInput(), 'npx')
+    await flush()
+    expect(submitBtn().disabled).toBe(false)
+  })
+
+  // ===== 覆盖点 6:KV 编辑器 =====
+  it('6a. 点「添加请求头」加一行;填 key/value;点删除移除该行', async () => {
+    mountModal({ server: null })
+    await macroFlush()
+    const addBtn = document.querySelector('.sk-modal [data-add="headers"]') as HTMLButtonElement
+    addBtn.click()
+    await nextTick()
+    let rows = document.querySelectorAll('.sk-modal [data-kv="headers"] .mcp-kv-row')
+    expect(rows).toHaveLength(1)
+    const kInput = rows[0].querySelector('[data-kvk]') as HTMLInputElement
+    const vInput = rows[0].querySelector('[data-kvv]') as HTMLInputElement
+    setValue(kInput, 'X-Test')
+    setValue(vInput, '123')
+    await nextTick()
+    expect(kInput.value).toBe('X-Test')
+    expect(vInput.value).toBe('123')
+
+    const delBtn = document.querySelector('.sk-modal [data-kv="headers"] .mcp-kv-del') as HTMLButtonElement
+    delBtn.click()
+    await nextTick()
+    rows = document.querySelectorAll('.sk-modal [data-kv="headers"] .mcp-kv-row')
+    expect(rows).toHaveLength(0)
+  })
+
+  it('6b. 空 key 的行在提交时被 collect() 丢弃', async () => {
+    const w = mountModal({ server: null })
+    await macroFlush()
+    setValue(nameInput(), 'svc')
+    setValue(urlInput(), 'https://x.example.com')
+    const addBtn = document.querySelector('.sk-modal [data-add="headers"]') as HTMLButtonElement
+    addBtn.click(); addBtn.click()
+    await nextTick()
+    const rows = document.querySelectorAll('.sk-modal [data-kv="headers"] .mcp-kv-row')
+    expect(rows).toHaveLength(2)
+    // 第一行 key/value 都填,第二行 key 留空只填 value
+    setValue(rows[0].querySelector('[data-kvk]') as HTMLInputElement, 'Authorization')
+    setValue(rows[0].querySelector('[data-kvv]') as HTMLInputElement, 'Bearer xyz')
+    setValue(rows[1].querySelector('[data-kvv]') as HTMLInputElement, 'orphan-value')
+    await flush()
+
+    submitBtn().click()
+    await flush()
+    const payload = w.emitted('save')![0][0] as Record<string, unknown>
+    expect(payload.headers).toEqual({ Authorization: 'Bearer xyz' })
+  })
+
+  // ===== 覆盖点 7:提交 payload 形状 =====
+  it('7a. stdio 提交 payload 形状:args 按行 split+trim+去空行', async () => {
+    const w = mountModal({ server: null })
+    await macroFlush()
+    trigOptions()[2].click()
+    await nextTick()
+    setValue(nameInput(), 'my-stdio')
+    setValue(commandInput(), 'npx')
+    const argsTextarea = document.querySelector('.sk-modal [data-f="args"]') as HTMLTextAreaElement
+    setValue(argsTextarea, '  -y  \n\n@upstash/context7-mcp\n  ')
+    await flush()
+
+    submitBtn().click()
+    await flush()
+    expect(w.emitted('save')![0][0]).toEqual({
+      name: 'my-stdio',
+      transport: 'stdio',
+      enabled: true,
+      command: 'npx',
+      args: ['-y', '@upstash/context7-mcp'],
+      env: {},
+    })
+  })
+
+  it('7b. http 提交 payload 形状:{name, transport:"http", enabled, url, headers:{…}}', async () => {
+    const w = mountModal({ server: null })
+    await macroFlush()
+    setValue(nameInput(), 'my-http')
+    setValue(urlInput(), 'https://x.example.com')
+    const addBtn = document.querySelector('.sk-modal [data-add="headers"]') as HTMLButtonElement
+    addBtn.click()
+    await nextTick()
+    const row = document.querySelector('.sk-modal [data-kv="headers"] .mcp-kv-row') as HTMLElement
+    setValue(row.querySelector('[data-kvk]') as HTMLInputElement, 'X-Api-Key')
+    setValue(row.querySelector('[data-kvv]') as HTMLInputElement, 'secret')
+    await flush()
+
+    submitBtn().click()
+    await flush()
+    expect(w.emitted('save')![0][0]).toEqual({
+      name: 'my-http',
+      transport: 'http',
+      enabled: true,
+      url: 'https://x.example.com',
+      headers: { 'X-Api-Key': 'secret' },
+    })
+  })
+
+  // ===== 覆盖点 8:编辑态且无 KV 行时不带该字段,两条对照 =====
+  it('8a. 新增态即使 KV 空也带 env:{}(stdio)', async () => {
+    const w = mountModal({ server: null })
+    await macroFlush()
+    trigOptions()[2].click()
+    await nextTick()
+    setValue(nameInput(), 'svc')
+    setValue(commandInput(), 'npx')
+    await flush()
+    submitBtn().click()
+    await flush()
+    const payload = w.emitted('save')![0][0] as Record<string, unknown>
+    expect(payload).toHaveProperty('env')
+    expect(payload.env).toEqual({})
+  })
+
+  it('8b. 编辑态且 env 空则不带 env 键(Vue2 :206 的条件)', async () => {
+    const server = makeServer({ id: 3, transport: 'stdio', command: 'npx', args: [], has_env: false })
+    const w = mountModal({ server })
+    await macroFlush()
+    // 名称/命令已由 server 回填,直接提交
+    submitBtn().click()
+    await flush()
+    const payload = w.emitted('save')![0][0] as Record<string, unknown>
+    expect(payload).not.toHaveProperty('env')
+  })
+
+  // ===== 覆盖点 9:编辑态且 has_headers 为真 → 显示 .mcp-kv-hint =====
+  it('9a. 编辑态 + has_headers=true → 显示 .mcp-kv-hint', async () => {
+    mountModal({ server: makeServer({ transport: 'http', has_headers: true }) })
+    await macroFlush()
+    const hint = document.querySelector('.sk-modal .mcp-kv-hint')
+    expect(hint).not.toBeNull()
+    expect(hint!.textContent).toBe(zh.aiMcpSrvKvHint)
+  })
+
+  it('9b. 新增态不显示 .mcp-kv-hint(即使 http)', async () => {
+    mountModal({ server: null })
+    await macroFlush()
+    expect(document.querySelector('.sk-modal .mcp-kv-hint')).toBeNull()
+  })
+
+  // ===== 覆盖点 10:快速粘贴单层取数钉子 =====
+  it('10. 快速粘贴(单层取数):裸 Parsed 返回,填充后传输切 stdio、command/args/env/名称都填上', async () => {
+    h.parseMCPCommand.mockResolvedValue({
+      transport: 'stdio', command: 'npx', args: ['-y', '@upstash/context7-mcp'], env: { FOO: 'bar' },
+      url: '', suggested_name: 'context7',
+    })
+    const w = mountModal({ server: null })
+    await macroFlush()
+    setValue(pasteInput(), 'npx -y @upstash/context7-mcp')
+    await nextTick()
+    fillBtn().click()
+    await flush()
+    await flush()
+
+    expect(h.parseMCPCommand).toHaveBeenCalledWith('npx -y @upstash/context7-mcp')
+    expect(trigOptions()[2].dataset.active).toBe('true') // stdio 选中
+    expect(commandInput().value).toBe('npx')
+    const argsTextarea = document.querySelector('.sk-modal [data-f="args"]') as HTMLTextAreaElement
+    expect(argsTextarea.value).toBe('-y\n@upstash/context7-mcp')
+    expect(nameInput().value).toBe('context7')
+    const envRow = document.querySelector('.sk-modal [data-kv="env"] .mcp-kv-row') as HTMLElement
+    expect((envRow.querySelector('[data-kvk]') as HTMLInputElement).value).toBe('FOO')
+    expect((envRow.querySelector('[data-kvv]') as HTMLInputElement).value).toBe('bar')
+    void w
+  })
+
+  // ===== 覆盖点 11:快速粘贴解析成 http =====
+  it('11. 快速粘贴解析成 http:url 填上,command/args/env 清空', async () => {
+    h.parseMCPCommand.mockResolvedValue({
+      transport: 'http', command: '', args: [], env: {}, url: 'https://mcp.example.com', suggested_name: '',
+    })
+    mountModal({ server: null })
+    await macroFlush()
+    // 先切到 stdio 并填一些字段,验证粘贴解析成 http 后被清空
+    trigOptions()[2].click()
+    await nextTick()
+    setValue(commandInput(), 'old-command')
+    await flush()
+
+    setValue(pasteInput(), 'curl https://mcp.example.com')
+    await nextTick()
+    fillBtn().click()
+    await flush()
+    await flush()
+
+    expect(trigOptions()[0].dataset.active).toBe('true') // http 选中
+    expect(urlInput().value).toBe('https://mcp.example.com')
+    // command/args 字段已随 transport 切回 http 而不再渲染;env 应为空
+    expect(document.querySelector('.sk-modal [data-f="command"]')).toBeNull()
+    expect(document.querySelector('.sk-modal [data-kv="env"]')).toBeNull()
+  })
+
+  // ===== 覆盖点 12:suggested_name 只在名称为空时填入 =====
+  it('12a. 名称为空时,快速粘贴的 suggested_name 会填入', async () => {
+    h.parseMCPCommand.mockResolvedValue({
+      transport: 'stdio', command: 'npx', args: [], env: {}, url: '', suggested_name: 'context7',
+    })
+    mountModal({ server: null })
+    await macroFlush()
+    setValue(pasteInput(), 'npx foo')
+    await nextTick()
+    fillBtn().click()
+    await flush()
+    await flush()
+    expect(nameInput().value).toBe('context7')
+  })
+
+  it('12b. 名称已填时,suggested_name 不覆盖', async () => {
+    h.parseMCPCommand.mockResolvedValue({
+      transport: 'stdio', command: 'npx', args: [], env: {}, url: '', suggested_name: 'context7',
+    })
+    mountModal({ server: null })
+    await macroFlush()
+    setValue(nameInput(), 'my-own-name')
+    setValue(pasteInput(), 'npx foo')
+    await nextTick()
+    fillBtn().click()
+    await flush()
+    await flush()
+    expect(nameInput().value).toBe('my-own-name')
+  })
+
+  // ===== 覆盖点 13:解析失败 → 本地化文案,不含后端英文串 =====
+  it('13. 解析失败 → .mcp-quickadd-err 显示本地化文案,不含后端英文串', async () => {
+    h.parseMCPCommand.mockRejectedValue(
+      Object.assign(new Error('x'), { response: { data: { message: 'empty command' } } }),
+    )
+    mountModal({ server: null })
+    await macroFlush()
+    setValue(pasteInput(), '""')
+    await nextTick()
+    fillBtn().click()
+    await flush()
+    await flush()
+    const err = document.querySelector('.sk-modal .mcp-quickadd-err') as HTMLElement
+    expect(err).not.toBeNull()
+    expect(err.textContent).toBe(zh.aiMcpSrvParseErrEmpty)
+    expect(document.querySelector('.sk-modal')!.textContent).not.toContain('empty command')
+  })
+
+  // ===== 覆盖点 14:解析中态 + pasteCmd 空态 =====
+  it('14a. 解析中:按钮文案 aiMcpSrvParsing 且 disabled', async () => {
+    let resolve!: (v: unknown) => void
+    h.parseMCPCommand.mockReturnValue(new Promise((r) => { resolve = r }))
+    mountModal({ server: null })
+    await macroFlush()
+    setValue(pasteInput(), 'npx foo')
+    await nextTick()
+    fillBtn().click()
+    await nextTick()
+    expect(fillBtn().disabled).toBe(true)
+    expect(fillBtn().textContent).toContain(zh.aiMcpSrvParsing)
+    resolve({ transport: 'stdio', command: 'npx', args: [], env: {}, url: '', suggested_name: '' })
+    await flush()
+  })
+
+  it('14b. pasteCmd 为空时按钮 disabled', async () => {
+    mountModal({ server: null })
+    await macroFlush()
+    expect(pasteInput().value).toBe('')
+    expect(fillBtn().disabled).toBe(true)
+  })
+
+  // ===== 覆盖点 15:serverError 行内报错 =====
+  it('15. serverError 非空 → 渲染 .sk-field-err 行内错误(先例 AddSkillModal)', async () => {
+    mountModal({ server: null, serverError: zh.aiMcpSrvErrUrlRequired })
+    await macroFlush()
+    const err = document.querySelector('.sk-modal .sk-field-err') as HTMLElement
+    expect(err).not.toBeNull()
+    expect(err.getAttribute('role')).toBe('alert')
+    expect(err.textContent).toBe(zh.aiMcpSrvErrUrlRequired)
+  })
+
+  // ===== 覆盖点 16:open 真→假→真,表单复位 =====
+  it('16. open 由真变假再变真 → 表单复位(组件常驻,不像 Vue2 每次都是新实例)', async () => {
+    const w = mountModal({ server: null })
+    await macroFlush()
+    setValue(nameInput(), 'typed-name')
+    setValue(urlInput(), 'https://typed.example.com')
+    await flush()
+    expect(nameInput().value).toBe('typed-name')
+
+    await w.setProps({ open: false })
+    await flush()
+    await w.setProps({ open: true })
+    await macroFlush()
+
+    expect(nameInput().value).toBe('')
+    expect(urlInput().value).toBe('')
+  })
+
+  // 附加:取消按钮 emit update:open(false),不 emit save —— 与 15 条覆盖点互补,
+  // 验证「照 AddSkillModal 先例」的常驻外壳行为完整。
+  it('附加:取消按钮 emit update:open(false),不 emit save', async () => {
+    const w = mountModal({ server: null })
+    await macroFlush()
+    cancelBtn().click()
+    await flush()
+    expect(w.emitted('update:open')).toEqual([[false]])
+    expect(w.emitted('save')).toBeUndefined()
+  })
+
+  // 附加:saving=true 时按钮文案变化且禁用(与 5c 的「enabled」态对照,确认 saving 优先)。
+  it('附加:saving=true 时提交按钮文案变 aiCfgSaving 且禁用', async () => {
+    mountModal({ server: null, saving: true })
+    await macroFlush()
+    setValue(nameInput(), 'foo')
+    setValue(urlInput(), 'https://x.example.com')
+    await flush()
+    expect(submitBtn().disabled).toBe(true)
+    expect(submitBtn().textContent).toContain(zh.aiCfgSaving)
+  })
+})
diff --git a/src/ai/components/settings/mcp/McpServerModal.vue b/src/ai/components/settings/mcp/McpServerModal.vue
new file mode 100644
index 0000000..e0364d7
--- /dev/null
+++ b/src/ai/components/settings/mcp/McpServerModal.vue
@@ -0,0 +1,374 @@
+<!--
+  SP8-P4 Task 8 —— 1:1 移植自 Vue2 `NimoOS-UI/src/views/AI/MCP/McpServerModal.vue`
+  (216 行)。新增/编辑表单弹窗,含快速粘贴解析与 headers/env 的 KV 编辑器。
+
+  ===== 接口偏离(协调者裁定 3,已授权)=====
+  Vue2 是 `v-if="modalOpen"`(每次打开重新创建实例,`data()` 天然只跑一次)+ `@close`
+  事件。本仓照 `../skills/AddSkillModal.vue` 先例改成 `v-model:open` 常挂(组件实例
+  在整个设置页生命周期里只创建一次),并新增 `serverError` prop 承载保存失败的行内
+  报错(Vue2 把保存失败塞进 toast,偏离 D5 要求改行内,先例 `.sk-field-err` /
+  `.chan-field-err`,见下方 grep 证据)。
+  组件实例常驻带来的后果:Vue2 靠“重新创建实例”天然获得“每次打开都是干净表单”,本仓
+  必须显式在 `watch(open)` 里从当前 `props.server` 重新派生所有字段——这不只是“复位
+  成空表单”(AddSkillModal 的做法,因为它没有“编辑已有数据”这个场景),而是“新增态
+  复位成空、编辑态复位成该服务器的当前值”,因为持久实例可能被父组件先后用于编辑不同
+  的服务器。watch(open) 的 true 分支统一处理这两种情况。
+
+  ===== 偏离 D1(公共约束 §3 第 1 条,强制)=====
+  `parsePaste()`:共享包 `service.ai.parseMCPCommand` 已 `return res.data`
+  (`NimoOS-Service/src/ai.ts`),后端 `mcp.go:137` 是裸对象 `200`。Vue2 `:166` 的
+  `const p = (resp && resp.data) || {}` 在本仓恒解出 `{}`——快速粘贴会永远静默填不进
+  任何字段,且不报错(`{}` 落进各字段的 `|| ''`/`|| []` 兜底,界面看起来“什么都没
+  发生”)。本仓直接把 `await service.ai.parseMCPCommand(cmd)` 的返回值当 `McpParsed`
+  用,不再多剥一层 `.data`。
+
+  ===== 偏离 D5(公共约束 §3 第 5 条)=====
+  `pasteErr` 不再读 Vue2 `:182` 的 `e.response.data.message`(后端英文原文,界面永不
+  回显原文的硬约束),改用 `util/mcpErrorKey.ts`(T3)的 `parseCommandErrorKey(e)` 映射
+  成 i18n 键,`t()` 出当前语言的本地化文案再赋给 `pasteErr`。
+
+  ===== N1(公共约束 §3.5 第 1 条,照抄不改,已确认照抄)=====
+  Vue2 `valid`(`:141-146`)要求名称非空,后端 `validateAndClean`(`mcp.go:273-289`)
+  对 `name` 零校验。本仓 `valid` 逐字照抄这条(见下方 computed),**不新增任何前置
+  校验,也不删除这条**——判据见设计文档 §6 决策 N1:这不是“前端比后端严格”那类需要
+  改的东西,是纯 UI 级要求(无名服务器在列表里就是一条无法辨识的空白条目),不涉及
+  任何数据转换。
+
+  ===== N2(公共约束 §3.5 第 2 条,照抄不改,已确认照抄)=====
+  `parsePaste()` 的 non-stdio 分支(`p.transport !== 'stdio'`)**不清空 `headers`**——
+  对齐 Vue2 `:174-179` 的 else 分支只清 `command`/`argsText`/`env`,不动 `headers`。
+  stdio 分支(`:168-173`)才清 `headers`(因为 headers 只属于 http/sse)。这不是遗漏的
+  不对称,是有意设计:解析成 http/sse 时保留用户已经手填的请求头是正确行为。
+
+  ===== N3(公共约束 §3.5 第 3 条,照抄不改,已确认照抄)=====
+  编辑态无法清空已有的 headers/env——`headers`/`env` 两个 ref 无论新增态还是编辑态
+  都从空数组起步(Vue2 `data(){ headers: [], env: [] }`,`:132-133`,不读
+  `server.has_headers`/`has_env` 的值填回表单,因为后端从不下发明文,见
+  `types/mcpServer.ts` 对 `has_headers`/`has_env` 的注释)。`.mcp-kv-hint`
+  (`aiMcpSrvKvHint`,值「留空保持不变;填写则覆盖全部。」)在编辑态且原有
+  `has_headers`/`has_env` 为真时显示,明示这个语义——对应后端 `applyReq`
+  (`mcp.go:230-269`)只覆盖请求体里出现的字段。
+
+  ===== 内联 style / 占位符,尺寸不是颜色,照抄(公共约束 §6)=====
+  - `style="font-family: var(--font-mono); font-size: 12.5px"`(快速粘贴输入框
+    `:14`、URL 输入框 `:42`、命令输入框 `:65`)
+  - `style="grid-template-columns: repeat(3, 1fr)"`(传输三选一 `:31`)
+  - `argsText` 的 placeholder 用 `&#10;` 换行(`:73`),逐字照抄
+
+  ===== 零 <style> 块,用到的每个类均已存在(grep 证据见任务报告)=====
+  `.sk-field*`/`.sk-trig-options`/`.sk-trig-option`/`.sk-btn`/`.sw`/`.save-note`/
+  `.sk-field-err`(`sk-shared.scss`)· `.mcp-quickadd-row`/`.mcp-quickadd-err`/
+  `.mcp-kv*`/`.mcp-args`(T1 `mcp-styles.scss`)。⚠️ `.mcp-quickadd`(Vue2 `:9`,本组件
+  也照抄这个类名挂在快速添加的 `.sk-field` 上)在 `mcp-styles.scss` 里本来就没有
+  对应规则——Vue2 原文如此,不为它补 CSS。
+-->
+<script setup lang="ts">
+import { ref, computed, watch } from 'vue'
+import { useI18n } from 'vue-i18n'
+import { service } from '@nimotech/nimoos-service'
+import SkModal from '../SkModal.vue'
+import AgentIcon from '../../icons/AgentIcon.vue'
+import { parseCommandErrorKey } from '../../../util/mcpErrorKey'
+import type { McpServer, McpParsed, McpServerFormPayload } from '../../../types/mcpServer'
+
+interface KvRow { k: string; v: string }
+
+// 接口偏离(裁定 3):新增 `server`(编辑态数据来源)与 `serverError`(行内报错)。
+const props = defineProps<{
+  open: boolean
+  server: McpServer | null
+  saving: boolean
+  serverError: string
+}>()
+
+const emit = defineEmits<{
+  (e: 'update:open', v: boolean): void
+  (e: 'save', payload: McpServerFormPayload): void
+}>()
+
+const { t } = useI18n()
+
+// 对齐 Vue2 `computed: { isEdit() { return !!this.server } }`(:140)。
+const isEdit = computed(() => !!props.server)
+
+const modalTitle = computed(() => (isEdit.value ? t('aiMcpSrvEditTitle') : t('aiMcpSrvAdd')))
+
+// 对齐 Vue2 `data()`(:123-137)。表单字段一律组件本地 ref(公共约束 §5)。
+const name = ref('')
+const transport = ref('http')
+const url = ref('')
+const command = ref('')
+const argsText = ref('')
+const enabled = ref(true)
+const headers = ref<KvRow[]>([])
+const env = ref<KvRow[]>([])
+const pasteCmd = ref('')
+const pasteErr = ref('')
+const parsing = ref(false)
+
+const nameInputEl = ref<HTMLInputElement | null>(null)
+
+// 对齐 Vue2 `computed: { valid() {...} } `(:141-146)。
+// N1(照抄不改):名称非空是后端没有的 UI 级要求,不许因此新增其它前置校验。
+const valid = computed(() => {
+  if (name.value.trim().length === 0) return false
+  return transport.value === 'stdio'
+    ? command.value.trim().length > 0
+    : url.value.trim().length > 0
+})
+
+// 对齐 Vue2 `computed: { transports() {...} }`(:147-153)。name 字段(HTTP/SSE/STDIO)
+// 是字面量不是 i18n 键,与 Vue2 一致;desc 走 t()。
+const transports = computed(() => [
+  { id: 'http', name: 'HTTP', descKey: 'aiMcpSrvTransportHttp' },
+  { id: 'sse', name: 'SSE', descKey: 'aiMcpSrvTransportSse' },
+  { id: 'stdio', name: 'STDIO', descKey: 'aiMcpSrvTransportStdio' },
+])
+
+// 从当前 props.server 派生表单初值——新增态(server=null)全部清空,编辑态回填
+// 除 headers/env 外的字段(N3:headers/env 一律从空数组起步,不回填明文,因为
+// 后端从不下发)。见文件头「接口偏离」段:持久实例每次打开都要重新派生,不能只
+// 在组件创建时读一次 props.server(那是 Vue2 v-if 重建实例才能吃到的免费红利)。
+function resetForm() {
+  const s = props.server
+  name.value = s ? s.name : ''
+  transport.value = s ? s.transport : 'http'
+  url.value = s ? s.url : ''
+  command.value = s ? (s.command || '') : ''
+  argsText.value = s ? (s.args || []).join('\n') : ''
+  enabled.value = s ? s.enabled : true
+  headers.value = []
+  env.value = []
+  pasteCmd.value = ''
+  pasteErr.value = ''
+  parsing.value = false
+}
+
+// 对齐 Vue2 `mounted(){ this.$nextTick(() => focus) }`(:155-157)。
+// 用 setTimeout(0) 而不是 nextTick——照 AddSkillModal.vue 头注释「reka 初始焦点
+// 实测结论」的先例:reka Dialog 的 FocusScope 自己的 mount-auto-focus 与本组件的
+// nextTick 是同一微任务级时序赛跑,宏任务级延迟才能稳定压过默认聚焦落到 SkModal
+// 的关闭按钮上,不是新引入的偏离,是沿用已验证过的既有写法。
+watch(
+  () => props.open,
+  (v) => {
+    if (v) {
+      resetForm()
+      setTimeout(() => { nameInputEl.value?.focus() }, 0)
+    }
+  },
+  { immediate: true },
+)
+
+// 对齐 Vue2 `methods: { parsePaste() {...} }`(:159-187)。
+async function parsePaste() {
+  const cmd = pasteCmd.value.trim()
+  if (!cmd) return
+  parsing.value = true
+  pasteErr.value = ''
+  try {
+    // 偏离 D1(见文件头):单层取数,不再多剥 `.data`。
+    const p = await service.ai.parseMCPCommand(cmd) as McpParsed
+    transport.value = p.transport || 'http'
+    if (p.transport === 'stdio') {
+      command.value = p.command || ''
+      argsText.value = (p.args || []).join('\n')
+      env.value = Object.keys(p.env || {}).map((k) => ({ k, v: p.env[k] }))
+      url.value = ''
+      headers.value = []
+    } else {
+      // N2(照抄不改,见文件头):non-stdio 分支不清 headers。
+      url.value = p.url || ''
+      command.value = ''
+      argsText.value = ''
+      env.value = []
+    }
+    if (!name.value.trim() && p.suggested_name) name.value = p.suggested_name
+  } catch (e) {
+    // 偏离 D5(见文件头):不回显后端原文,走 error_key 映射 + t()。
+    pasteErr.value = t(parseCommandErrorKey(e))
+  } finally {
+    parsing.value = false
+  }
+}
+
+// 对齐 Vue2 `methods: { collect(rows) {...} }`(:188-195)。
+function collect(rows: KvRow[]): Record<string, string> {
+  const out: Record<string, string> = {}
+  for (const r of rows) {
+    const k = (r.k || '').trim()
+    if (k) out[k] = r.v || ''
+  }
+  return out
+}
+
+// 对齐 Vue2 `methods: { parseArgs(text) {...} }`(:196-198)。
+function parseArgs(text: string): string[] {
+  return String(text || '').split('\n').map((s) => s.trim()).filter((s) => s.length > 0)
+}
+
+// 对齐 Vue2 `methods: { submit() {...} }`(:199-213)。
+// N3(照抄不改,见文件头):`if (!isEdit || Object.keys(x).length)` 逐字照抄——
+// 编辑态且 KV 为空时不带该字段,对应后端「只覆盖请求里出现的字段」。
+function submit() {
+  if (!valid.value) return
+  const payload: McpServerFormPayload = {
+    name: name.value.trim(),
+    transport: transport.value,
+    enabled: enabled.value,
+  }
+  if (transport.value === 'stdio') {
+    payload.command = command.value.trim()
+    payload.args = parseArgs(argsText.value)
+    const e = collect(env.value)
+    if (!isEdit.value || Object.keys(e).length) payload.env = e
+  } else {
+    payload.url = url.value.trim()
+    const h = collect(headers.value)
+    if (!isEdit.value || Object.keys(h).length) payload.headers = h
+  }
+  emit('save', payload)
+}
+
+function onCancel() {
+  emit('update:open', false)
+}
+</script>
+
+<template>
+  <SkModal :open="props.open" :title="modalTitle" @update:open="(v) => emit('update:open', v)">
+    <!-- 行内报错(接口偏离,裁定 3):Vue2 把保存失败塞进 toast,本仓改行内,
+         先例 `.sk-field-err`(AddSkillModal.vue:183)/`.chan-field-err`
+         (ChannelsSection.vue:449),同款「落在 body 顶部,先于所有字段」。 -->
+    <p v-if="props.serverError" class="sk-field-err" role="alert">{{ props.serverError }}</p>
+
+    <div v-if="!isEdit" class="sk-field mcp-quickadd">
+      <label class="sk-field-label">
+        {{ t('aiMcpSrvQuickAdd') }}
+        <span class="sk-field-optional">({{ t('aiMcpSrvQuickAddHint') }})</span>
+      </label>
+      <div class="mcp-quickadd-row">
+        <input
+          type="text" data-f="paste" v-model="pasteCmd"
+          style="font-family: var(--font-mono); font-size: 12.5px"
+          placeholder="npx -y @upstash/context7-mcp"
+          @keydown.enter.prevent="parsePaste"
+        >
+        <button
+          type="button" class="sk-btn ghost" data-f="fill"
+          :disabled="parsing || !pasteCmd.trim()" @click="parsePaste"
+        >
+          {{ parsing ? t('aiMcpSrvParsing') : t('aiMcpSrvFillForm') }}
+        </button>
+      </div>
+      <div v-if="pasteErr" class="mcp-quickadd-err">{{ pasteErr }}</div>
+    </div>
+
+    <div class="sk-field">
+      <label class="sk-field-label">{{ t('aiMcpSrvName') }}</label>
+      <input
+        ref="nameInputEl" type="text" data-f="name" v-model="name"
+        :placeholder="t('aiMcpSrvNamePlaceholder')" @keydown.enter.prevent
+      >
+    </div>
+
+    <div class="sk-field">
+      <label class="sk-field-label">{{ t('aiMcpSrvTransportType') }}</label>
+      <div class="sk-trig-options" style="grid-template-columns: repeat(3, 1fr)">
+        <button
+          v-for="o in transports" :key="o.id" type="button" class="sk-trig-option"
+          :data-active="transport === o.id ? 'true' : 'false'" @click="transport = o.id"
+        >
+          <span class="name">{{ o.name }}</span><span class="desc">{{ t(o.descKey) }}</span>
+        </button>
+      </div>
+    </div>
+
+    <div v-if="transport !== 'stdio'" class="sk-field">
+      <label class="sk-field-label">{{ t('aiMcpSrvUrl') }}</label>
+      <input
+        type="text" data-f="url" v-model="url"
+        style="font-family: var(--font-mono); font-size: 12.5px"
+        :placeholder="transport === 'sse' ? 'https://example.com/sse' : 'https://example.com/mcp'"
+      >
+    </div>
+
+    <div v-if="transport !== 'stdio'" class="sk-field">
+      <label class="sk-field-label">
+        {{ t('aiMcpSrvReqHeaders') }}
+        <span class="sk-field-optional">({{ t('aiMcpSrvOptional') }})</span>
+      </label>
+      <div class="mcp-kv" data-kv="headers">
+        <div v-for="(row, i) in headers" :key="'h' + i" class="mcp-kv-row">
+          <input data-kvk type="text" :placeholder="t('aiMcpSrvKvKey')" v-model="row.k">
+          <input data-kvv type="text" :placeholder="t('aiMcpSrvKvValue')" v-model="row.v">
+          <button class="mcp-kv-del" @click="headers.splice(i, 1)"><AgentIcon name="x" :size="12" /></button>
+        </div>
+      </div>
+      <button class="mcp-kv-add" data-add="headers" @click="headers.push({ k: '', v: '' })">
+        + {{ t('aiMcpSrvAddHeader') }}
+      </button>
+      <div v-if="isEdit && props.server?.has_headers" class="mcp-kv-hint">{{ t('aiMcpSrvKvHint') }}</div>
+    </div>
+
+    <div v-if="transport === 'stdio'" class="sk-field">
+      <label class="sk-field-label">{{ t('aiMcpSrvCommand') }}</label>
+      <input
+        type="text" data-f="command" v-model="command"
+        style="font-family: var(--font-mono); font-size: 12.5px"
+        :placeholder="t('aiMcpSrvCommandPlaceholder')"
+      >
+    </div>
+
+    <div v-if="transport === 'stdio'" class="sk-field">
+      <label class="sk-field-label">
+        {{ t('aiMcpSrvArgs') }}
+        <span class="sk-field-optional">({{ t('aiMcpSrvOnePerLine') }})</span>
+      </label>
+      <textarea
+        data-f="args" v-model="argsText" class="mcp-args" rows="4"
+        placeholder="-y&#10;@modelcontextprotocol/server-everything"
+      />
+    </div>
+
+    <div v-if="transport === 'stdio'" class="sk-field">
+      <label class="sk-field-label">
+        {{ t('aiMcpSrvEnvVars') }}
+        <span class="sk-field-optional">({{ t('aiMcpSrvOptional') }})</span>
+      </label>
+      <div class="mcp-kv" data-kv="env">
+        <div v-for="(row, i) in env" :key="'e' + i" class="mcp-kv-row">
+          <input data-kvk type="text" :placeholder="t('aiMcpSrvKvKey')" v-model="row.k">
+          <input data-kvv type="text" :placeholder="t('aiMcpSrvKvValue')" v-model="row.v">
+          <button class="mcp-kv-del" @click="env.splice(i, 1)"><AgentIcon name="x" :size="12" /></button>
+        </div>
+      </div>
+      <button class="mcp-kv-add" data-add="env" @click="env.push({ k: '', v: '' })">
+        + {{ t('aiMcpSrvAddVariable') }}
+      </button>
+      <div v-if="isEdit && props.server?.has_env" class="mcp-kv-hint">{{ t('aiMcpSrvKvHint') }}</div>
+    </div>
+
+    <div class="sk-field">
+      <label class="sk-field-label">{{ t('aiCfgEnabled') }}</label>
+      <div
+        class="sw" :data-on="enabled ? 'true' : 'false'" role="switch"
+        :aria-checked="enabled ? 'true' : 'false'" @click="enabled = !enabled"
+      />
+    </div>
+
+    <template #footerLeft>
+      <span class="save-note">
+        <AgentIcon name="check" :size="11" />
+        {{ t('aiMcpSrvSavedLocally') }}
+      </span>
+    </template>
+    <template #footer>
+      <button type="button" class="sk-btn ghost" @click="onCancel">{{ t('aiCancel') }}</button>
+      <button type="button" class="sk-btn primary" :disabled="!valid || props.saving" @click="submit">
+        <AgentIcon :name="isEdit ? 'check' : 'plus'" :size="13" />
+        {{ props.saving ? t('aiCfgSaving') : (isEdit ? t('aiCfgSave') : t('aiMcpSrvAddServer')) }}
+      </button>
+    </template>
+  </SkModal>
+</template>
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
diff --git a/src/ai/styles/mcp-styles.scss b/src/ai/styles/mcp-styles.scss
new file mode 100644
index 0000000..9b7232f
--- /dev/null
+++ b/src/ai/styles/mcp-styles.scss
@@ -0,0 +1,139 @@
+// SP8-P4 Task 1 —— 逐行移植自 Vue2 `NimoOS-UI/src/views/AI/MCP/mcp-styles.scss`
+// (91 行)。Vue2 原文件头就写着「layered on top of skills-styles.scss shell
+// classes」—— 本档同样只叠加 18 个 `.mcp-*` 类,分区容器/列表/详情的外壳类
+// (`.sk-col*` / `.sk-detail*` / `.sk-meta-*` / `.sk-section*` / `.sk-modal*` 等)
+// 由 `skills-styles.scss` / `sk-shared.scss` / `settings-styles.scss` 供给,
+// 本档不重复定义,详见设计文档 §4.2。
+//
+// 组织调整(非行为改变):Vue2 `.mcp-transport[data-t="stdio"]` 单独写在 `:43`
+// (原作者后补),本档把三个 transport 变体(http/sse/stdio)合并写进
+// `.mcp-transport` 的嵌套选择器里 —— 渲染结果与 Vue2 `:7-8` + `:43` 两处分开写
+// 完全等价,只是本档合并到一处以便阅读。
+//
+// 偏离 D10(6 处 rgba 字面量 → 已有 token,tokens.scss 浅/暗两档均已核实有值):
+//   - Vue2 `:7`  `.mcp-transport[data-t="http"]`       原为青色约 14% 透明度   → var(--teal-soft)
+//   - Vue2 `:8`  `.mcp-transport[data-t="sse"]`         原为紫色约 12% 透明度   → var(--purple-soft)
+//   - Vue2 `:43` `.mcp-transport[data-t="stdio"]`       原为绿色约 14% 透明度   → var(--success-soft)
+//   - Vue2 `:74` `.mcp-test-result[data-ok="true"]`  背景 原为绿色约 10% 透明度 → var(--success-soft)
+//                                                    边框 原为绿色约 30% 透明度 → var(--success-soft-border)
+//   - Vue2 `:75` `.mcp-test-result[data-ok="false"]` 背景 原为红色约 10% 透明度 → var(--danger-soft)
+//                                                    边框 原为红色约 30% 透明度 → var(--danger-soft-border)
+// 本任务预期新增 token 数 = 0(6 个 token 全部已存在于 tokens.scss)。
+
+.mcp-transport {
+  font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 999px;
+  background: var(--bg-chip); color: var(--text-tertiary);
+  letter-spacing: 0.02em; text-transform: uppercase; font-family: var(--font-mono);
+  &[data-t="http"]  { background: var(--teal-soft);    color: var(--teal); }
+  &[data-t="sse"]   { background: var(--purple-soft);  color: var(--purple); }
+  &[data-t="stdio"] { background: var(--success-soft); color: var(--success); }
+}
+
+.mcp-config { padding: 4px 0; }
+.mcp-config-row {
+  display: flex; align-items: center; gap: 14px; padding: 12px 16px;
+  border-top: 1px solid var(--line-faint);
+  &:first-child { border-top: 0; }
+  .lbl { width: 150px; flex-shrink: 0; font-size: 13px; font-weight: 500; color: var(--text-primary); }
+  .lbl .sub { display: block; font-size: 11px; font-weight: 400; color: var(--text-tertiary); margin-top: 1px; }
+  .val { flex: 1; min-width: 0; font-size: 13px; color: var(--text-secondary); display: flex; align-items: center; gap: 8px; }
+}
+.mcp-code {
+  font-family: var(--font-mono); font-size: 12.5px; background: var(--bg-sunken);
+  border: 1px solid var(--line-faint); border-radius: var(--r-sm); padding: 6px 10px;
+  color: var(--text-primary); white-space: nowrap; overflow-x: auto; flex: 1; min-width: 0;
+}
+
+// key/value editor rows in the add/edit modal
+.mcp-kv { display: flex; flex-direction: column; gap: 6px; }
+.mcp-kv-row { display: flex; gap: 6px; align-items: center; }
+.mcp-kv-row input { flex: 1; min-width: 0; }
+.mcp-kv-del {
+  width: 30px; height: 30px; flex-shrink: 0; border-radius: var(--r-sm);
+  display: grid; place-items: center; color: var(--text-tertiary);
+  background: var(--bg-chip); border: 0; cursor: pointer;
+  &:hover { color: var(--danger); }
+}
+.mcp-kv-add {
+  align-self: flex-start; font-size: 12px; font-weight: 500; color: var(--accent);
+  background: var(--accent-softer); border: 0; padding: 5px 10px; border-radius: var(--r-sm); cursor: pointer;
+}
+.mcp-kv-hint { font-size: 11px; color: var(--text-tertiary); }
+
+// Arguments textarea (stdio) — monospace, matches .sk-field inputs
+.mcp-args {
+  width: 100%;
+  min-height: 84px;
+  resize: vertical;
+  font-family: var(--font-mono);
+  font-size: 12.5px;
+  line-height: 1.5;
+  padding: 8px 10px;
+  border: 1px solid var(--line);
+  border-radius: 8px;
+  background: var(--bg-elevated);
+  color: var(--text-primary);
+  box-sizing: border-box;
+}
+.mcp-args:focus { outline: none; border-color: var(--accent); }
+
+// Test connection button sits at the right of the Configuration section head
+.sk-section-head .mcp-test-btn { margin-left: auto; flex: none; }
+
+// Test result panel
+.mcp-test-hint { margin-top: 10px; font-size: 12px; color: var(--text-tertiary); }
+.mcp-test-result {
+  margin-top: 10px;
+  padding: 10px 12px;
+  border-radius: 8px;
+  font-size: 13px;
+  border: 1px solid var(--line);
+}
+.mcp-test-result[data-ok="true"]  { background: var(--success-soft); color: var(--success); border-color: var(--success-soft-border); }
+.mcp-test-result[data-ok="false"] { background: var(--danger-soft);  color: var(--danger);  border-color: var(--danger-soft-border); }
+.mcp-test-line { font-weight: 600; }
+.mcp-test-tools { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px; }
+.mcp-tool-chip {
+  font-family: var(--font-mono);
+  font-size: 11.5px;
+  padding: 2px 7px;
+  border-radius: 6px;
+  background: var(--bg-chip);
+  color: var(--text-secondary);
+}
+
+// 【本期新增,Vue2 无对应物 —— 偏离 D8】测试失败时的「技术详情」折叠区。
+// 用原生 <details>/<summary>,无新依赖、天然可访问、无组件状态。
+.mcp-test-detail {
+  margin-top: 6px;
+  summary {
+    cursor: pointer;
+    font-size: 12px;
+    color: var(--text-tertiary);
+    list-style: none;
+    &::-webkit-details-marker { display: none; }
+    &::before { content: '▸ '; }
+  }
+  &[open] > summary::before { content: '▾ '; }
+  pre {
+    margin: 6px 0 0;
+    padding: 8px 10px;
+    border-radius: var(--r-sm);
+    background: var(--bg-sunken);
+    border: 1px solid var(--line-faint);
+    font-family: var(--font-mono);
+    font-size: 11.5px;
+    line-height: 1.5;
+    color: var(--text-secondary);
+    white-space: pre-wrap;
+    word-break: break-word;
+    max-height: 160px;
+    overflow-y: auto;
+  }
+}
+
+// Quick-add paste row (Add form only)
+.mcp-quickadd-row { display: flex; gap: 8px; align-items: center; }
+.mcp-quickadd-row input { flex: 1; }
+.mcp-quickadd-row .sk-btn { flex: none; white-space: nowrap; }
+.mcp-quickadd-err { margin-top: 6px; font-size: 12px; color: var(--danger); }
diff --git a/src/ai/types/mcpServer.ts b/src/ai/types/mcpServer.ts
new file mode 100644
index 0000000..6d87963
--- /dev/null
+++ b/src/ai/types/mcpServer.ts
@@ -0,0 +1,96 @@
+// SP8-P4 Task 2 —— 逐字照后端 DTO/契约的 json tag。字段顺序与命名与后端一一对应,
+// 不新增/不省略字段。端点前缀是 `/v1/ai`("v2" 只是 handler 代码世代/包名,不是
+// URL 版本号——P3b 终审 M4 踩过这个坑,详见 types/skill.ts 文件头)。
+// 全部端点**无信封裸返回**,共享包 `@nimotech/nimoos-service` 已 `return res.data`
+// 剥过 axios 层,消费端**不许再剥一层**(公共约束 §4 单层取数;设计 §3 命中 4 处)。
+//
+// ⚠️ 评审注记:`mcpparse.go` 的 http/stdio 分支实际行号是 `:39` / `:86`(本文件
+// 逐处引用时按实际行号写,不沿用设计文档 §2.1 抄的 `:38,80`——回源核实后二者相差
+// 1/6 行,已在 T2 报告里申报)。
+
+/** 对齐后端 `mcp.go` `validateAndClean`(`:274-287`)接受的三个传输方式。
+ *  注意 `McpServer.transport` / `McpParsed.transport` 本身在后端是裸 `string`
+ *  (未做枚举收紧),这里只用 `McpTransport` 给前端下拉框一个受限的字面量集合。 */
+export type McpTransport = 'http' | 'sse' | 'stdio'
+
+/** 对齐后端 `mcpDTO`(`mcp.go:41-51`)。`GET /mcp/servers` 200 裸数组返回这个
+ *  形状(`mcp.go:96`);`POST .../parse` 不返回这个形状(见 `McpParsed`)。 */
+export interface McpServer {
+  /** Go `int64`(`mcp.go:42`),JSON 序列化成 number,不是 string。 */
+  id: number
+  name: string
+  /** 裸 string,不是 `McpTransport`——后端不做枚举校验,`validateAndClean`
+   *  (`mcp.go:273-289`)才在保存时把非法值挡在 400。 */
+  transport: string
+  url: string
+  command: string
+  /** 后端 `toMcpDTO`(`mcp.go:53-64`,nil 兜底在 `:54-58`)保证非 nil,但消费端
+   *  仍应写 `(s.args || [])` 兜底——Go 的 nil slice 会序列化成 JSON `null`,这类
+   *  防御在调用处必须保留,不许因为「后端保证过」就删掉。 */
+  args: string[]
+  enabled: boolean
+  /** 只是布尔位,不是密文本身——密文(headers/env 明文)永不下发(`mcp.go:62`)。 */
+  has_headers: boolean
+  has_env: boolean
+}
+
+/** 对齐后端 `mcpparse.Parsed`(`mcpparse.go:13-20`),`POST /mcp/servers/parse`
+ *  200 裸对象返回(`mcp.go:137`)。**不落库**,只用于「快速粘贴」预填表单。 */
+export interface McpParsed {
+  /** 后端**只会产出 `"http"` 或 `"stdio"`,永不产出 `"sse"`**
+   *  (`mcpparse.go:39` 的 http 分支、`:86` 的 stdio 分支)——不是缺陷,SSE 由用户
+   *  在表单里手选(N5,承设计 §6)。 */
+  transport: string
+  command: string
+  /** 非 nil(`mcpparse.go:79-82` 显式兜底成 `[]string{}`)。 */
+  args: string[]
+  /** 非 nil map(`mcpparse.go:69` 初始化为 `map[string]string{}`)。 */
+  env: Record<string, string>
+  url: string
+  suggested_name: string
+}
+
+/** 对齐 Python agent `test_server` 返回(`agent/mcp_client/client.py:432-461`),
+ *  Go 侧 `mc.go:355` 用 `c.JSONBlob` 原样透传,`POST .../:id/test` 200 裸对象。
+ *  成功态只用 `ok/tool_count/tools`;失败态字段视 `error_key` 而定。 */
+export interface McpTestResult {
+  ok: boolean
+  tool_count?: number
+  tools?: string[]
+  /** 后端拼好的英文串(如 `"Connection failed: ..."`)——**本仓不上界面**,
+   *  一律走 `error_key` 映射成 i18n 键(设计 §5.3 / D8)。 */
+  error?: string
+  /** 只有 4 个值:`probe_timeout`(`client.py:437`)· `connect_failed`
+   *  (`:448`)· `list_timeout`(`:453`)· `list_failed`(`:456`)。 */
+  error_key?: string
+  /** 原始异常 `str(e)`,仅 `connect_failed` / `list_failed` 带
+   *  (`client.py:448,456`)。 */
+  detail?: string
+}
+
+/** 本仓表单提交的 payload 形状,对齐后端 `mcpRequest`(`mcp.go:29-39`)里
+ *  会被 `applyReq`(`:230-269`)消费的字段——不含 `command_line`(那是快速粘贴
+ *  专用字段,解析走 `McpParsed`,不进保存 payload)。
+ *  `POST /mcp/servers` 成功返回 **201 `{"id": <int64>}`**(`mcp.go:121`)——
+ *  不是完整 `McpServer` 对象,消费端不能指望拿回全量字段。
+ *  `PUT /mcp/servers/:id` 成功返回 **204 无内容**(`mcp.go:172`)——不许读返回值。 */
+export interface McpServerFormPayload {
+  name: string
+  transport: string
+  enabled: boolean
+  url?: string
+  command?: string
+  args?: string[]
+  /** 编辑态省略该字段表示「保持不变」,后端 `applyReq` 只覆盖请求里出现的字段
+   *  (`mcp.go:247-253`)——对应 N3(编辑态无法清空已有 headers/env,照抄)。 */
+  headers?: Record<string, string>
+  env?: Record<string, string>
+}
+
+/** 本期新造的视图类型(Vue2 无对应物)。`util/mcpErrorKey.ts`(T3)把
+ *  `McpTestResult` / HTTP 错误映射成这个形状,详情组件(T6/T7)只消费这个类型,
+ *  不直接碰 `McpTestResult`——保证界面永远拿到的是 i18n 键而不是后端原文
+ *  (公共约束「界面永不回显后端原文」)。 */
+export type McpTestView =
+  | { ok: true; toolCount: number; tools: string[] }
+  | { ok: false; msgKey: string; detail: string }
diff --git a/src/ai/util/mcpErrorKey.test.ts b/src/ai/util/mcpErrorKey.test.ts
new file mode 100644
index 0000000..ce29168
--- /dev/null
+++ b/src/ai/util/mcpErrorKey.test.ts
@@ -0,0 +1,202 @@
+import { describe, it, expect } from 'vitest'
+import {
+  saveServerErrorKey, parseCommandErrorKey, toTestView, toTestViewFromError,
+} from './mcpErrorKey'
+
+/** 造一个 axios 风格的错误(共享包不吞 error,原样抛)。 */
+function httpErr(status: number, data: unknown) {
+  return Object.assign(new Error('Request failed'), { response: { status, data } })
+}
+
+describe('saveServerErrorKey —— 后端 validateAndClean 的三条 400', () => {
+  it('url required for http/sse', () => {
+    expect(saveServerErrorKey(httpErr(400, { message: 'url required for http/sse' })))
+      .toBe('aiMcpSrvErrUrlRequired')
+  })
+  it('command required for stdio', () => {
+    expect(saveServerErrorKey(httpErr(400, { message: 'command required for stdio' })))
+      .toBe('aiMcpSrvErrCommandRequired')
+  })
+  it("transport must be 'http', 'sse' or 'stdio'", () => {
+    expect(saveServerErrorKey(httpErr(400, { message: "transport must be 'http', 'sse' or 'stdio'" })))
+      .toBe('aiMcpSrvErrBadTransport')
+  })
+  it('404 mcp server not found', () => {
+    expect(saveServerErrorKey(httpErr(404, { message: 'mcp server not found' })))
+      .toBe('aiMcpSrvErrNotFound')
+  })
+  it('大小写与首尾空白不敏感', () => {
+    expect(saveServerErrorKey(httpErr(400, { message: '  URL Required For HTTP/SSE  ' })))
+      .toBe('aiMcpSrvErrUrlRequired')
+  })
+  it('认不出的一律落通用兜底键,绝不回显后端原文', () => {
+    const k = saveServerErrorKey(httpErr(500, { message: 'sql: database is locked' }))
+    expect(k).toBe('aiCfgSaveFailed')
+    expect(k).not.toContain('sql')
+  })
+  it('无 response / 网络错 → 通用兜底', () => {
+    expect(saveServerErrorKey(new Error('Network Error'))).toBe('aiCfgSaveFailed')
+    expect(saveServerErrorKey(null)).toBe('aiCfgSaveFailed')
+    expect(saveServerErrorKey(undefined)).toBe('aiCfgSaveFailed')
+  })
+  it('也读 FastAPI 的 detail 形状(同 channelsFormat 的双读惯例)', () => {
+    expect(saveServerErrorKey(httpErr(400, { detail: 'command required for stdio' })))
+      .toBe('aiMcpSrvErrCommandRequired')
+  })
+  // 评审 Important:body 裸字符串——rawMessage 只认 `{message}`/`{detail}` 对象形状,
+  // 裸字符串不满足 `typeof data === 'object'`,必须落通用兜底,且该字符串不能原样漏出。
+  it('body 是裸字符串 → 通用兜底,不回显该字符串', () => {
+    const k = saveServerErrorKey(httpErr(400, 'plain text error'))
+    expect(k).toBe('aiCfgSaveFailed')
+    expect(JSON.stringify(k)).not.toContain('plain text error')
+  })
+  // body 数组:`typeof [] === 'object'` 为真,但数组没有 `.message`/`.detail` 属性,
+  // 取值链必须安全地拿到 undefined 而不是抛异常或意外拼出数组内容。
+  it('body 是数组 → 通用兜底,不泄漏数组内容', () => {
+    const k = saveServerErrorKey(httpErr(400, ['a', 'b']))
+    expect(k).toBe('aiCfgSaveFailed')
+    expect(JSON.stringify(k)).not.toContain('"a"')
+    expect(JSON.stringify(k)).not.toContain('"b"')
+  })
+})
+
+describe('parseCommandErrorKey —— mcpparse 的五条 400', () => {
+  it('empty command', () => {
+    expect(parseCommandErrorKey(httpErr(400, { message: 'empty command' })))
+      .toBe('aiMcpSrvParseErrEmpty')
+  })
+  // 「没解析出可执行的命令」是同一个用户可见原因的两种后端措辞,合并到一个键。
+  // (合并前已按 P3b 教训 2 检查过:两条对用户而言就是同一件事——粘贴的内容里
+  //  找不到可执行命令,措辞差异只反映后端在哪一步发现的。)
+  it('no command after parsing → 同一个「没有可执行命令」键', () => {
+    expect(parseCommandErrorKey(httpErr(400, { message: 'no command after parsing' })))
+      .toBe('aiMcpSrvParseErrNoCommand')
+  })
+  it("no command after '--' → 同一个「没有可执行命令」键", () => {
+    expect(parseCommandErrorKey(httpErr(400, { message: "no command after '--'" })))
+      .toBe('aiMcpSrvParseErrNoCommand')
+  })
+  it('no command (only environment variables) → 独立的键(原因不同:只有环境变量)', () => {
+    expect(parseCommandErrorKey(httpErr(400, { message: 'no command (only environment variables)' })))
+      .toBe('aiMcpSrvParseErrOnlyEnv')
+  })
+  it('unbalanced quotes in command', () => {
+    expect(parseCommandErrorKey(httpErr(400, { message: 'unbalanced quotes in command' })))
+      .toBe('aiMcpSrvParseErrQuotes')
+  })
+  // 判别力:「只有环境变量」的串以 "no command" 开头,若实现用 startsWith 匹配
+  // 会被 NoCommand 抢走。这条钉住优先级。
+  it('「只有环境变量」不能被「没有可执行命令」抢走', () => {
+    expect(parseCommandErrorKey(httpErr(400, { message: 'no command (only environment variables)' })))
+      .not.toBe('aiMcpSrvParseErrNoCommand')
+  })
+  it('认不出的落通用兜底,不回显原文', () => {
+    const k = parseCommandErrorKey(httpErr(400, { message: 'some brand new parser error' }))
+    expect(k).toBe('aiMcpSrvParseFailed')
+    expect(k).not.toContain('brand new')
+  })
+  // 评审 Important:同一份 rawMessage 取值链被 parseCommandErrorKey 复用,
+  // 裸字符串/数组两种边界形状也要在这个函数上钉一遍(不只钉 saveServerErrorKey)。
+  it('body 是裸字符串 → 通用兜底,不回显该字符串', () => {
+    const k = parseCommandErrorKey(httpErr(400, 'plain text error'))
+    expect(k).toBe('aiMcpSrvParseFailed')
+    expect(JSON.stringify(k)).not.toContain('plain text error')
+  })
+  it('body 是数组 → 通用兜底,不泄漏数组内容', () => {
+    const k = parseCommandErrorKey(httpErr(400, ['a', 'b']))
+    expect(k).toBe('aiMcpSrvParseFailed')
+    expect(JSON.stringify(k)).not.toContain('"a"')
+    expect(JSON.stringify(k)).not.toContain('"b"')
+  })
+})
+
+describe('toTestView —— 200 响应体 → 视图', () => {
+  it('成功', () => {
+    expect(toTestView({ ok: true, tool_count: 3, tools: ['a', 'b', 'c'] }))
+      .toEqual({ ok: true, toolCount: 3, tools: ['a', 'b', 'c'] })
+  })
+  it('成功但 tools 缺失 → 空数组,tool_count 缺失 → 0', () => {
+    expect(toTestView({ ok: true })).toEqual({ ok: true, toolCount: 0, tools: [] })
+  })
+  it('probe_timeout', () => {
+    expect(toTestView({ ok: false, error_key: 'probe_timeout', error: 'Probe timed out' }))
+      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrTimeout', detail: '' })
+  })
+  it('connect_failed 带 detail', () => {
+    expect(toTestView({
+      ok: false, error_key: 'connect_failed',
+      error: 'Connection failed: All connection attempts failed',
+      detail: 'All connection attempts failed',
+    })).toEqual({
+      ok: false, msgKey: 'aiMcpSrvTestErrConnect', detail: 'All connection attempts failed',
+    })
+  })
+  it('list_timeout', () => {
+    expect(toTestView({ ok: false, error_key: 'list_timeout' }))
+      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrListTimeout', detail: '' })
+  })
+  it('list_failed', () => {
+    expect(toTestView({ ok: false, error_key: 'list_failed', detail: 'boom' }))
+      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrListFailed', detail: 'boom' })
+  })
+  // 判别力:后端拼好的英文 error 串绝不能漏进视图。四个 error_key 各钉一次。
+  it('后端的 error 英文串永不进入视图', () => {
+    for (const key of ['probe_timeout', 'connect_failed', 'list_timeout', 'list_failed']) {
+      const v = toTestView({ ok: false, error_key: key, error: 'LEAKED-ENGLISH-STRING' })
+      expect(JSON.stringify(v)).not.toContain('LEAKED-ENGLISH-STRING')
+    }
+  })
+  it('未知 error_key → 通用兜底键,detail 仍保留', () => {
+    expect(toTestView({ ok: false, error_key: 'brand_new_key', detail: 'd' }))
+      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: 'd' })
+  })
+  it('完全不是对象 / null / undefined → 失败 + 通用兜底', () => {
+    expect(toTestView(null)).toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
+    expect(toTestView(undefined)).toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
+    expect(toTestView('nope')).toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
+  })
+  it('detail 非字符串时归一成空串', () => {
+    expect(toTestView({ ok: false, error_key: 'list_failed', detail: { a: 1 } }))
+      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrListFailed', detail: '' })
+  })
+  // 评审 Important:`error_key: null` 不在四值查表里,switch 落 default 分支;
+  // 强断言整个视图形状,确保 null 本身与 detail 都没有被错误地拼进结果。
+  it('error_key 为 null → 落通用兜底,detail 仍原样保留、null 不泄漏进结果', () => {
+    const v = toTestView({ ok: false, error_key: null, detail: 'x' })
+    expect(v).toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: 'x' })
+    expect(JSON.stringify(v)).not.toContain('null')
+  })
+})
+
+describe('toTestViewFromError —— 抛出的错误 → 视图', () => {
+  it('502 agent unreachable(mcp.go:351)', () => {
+    expect(toTestViewFromError(httpErr(502, { ok: false, error: 'agent unreachable' })))
+      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrAgentDown', detail: '' })
+  })
+  it('404 mcp server not found', () => {
+    expect(toTestViewFromError(httpErr(404, { message: 'mcp server not found' })))
+      .toEqual({ ok: false, msgKey: 'aiMcpSrvErrNotFound', detail: '' })
+  })
+  it('网络错 / 无 response → 通用兜底', () => {
+    expect(toTestViewFromError(new Error('Network Error')))
+      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
+  })
+  it('任意后端原文都不进入视图', () => {
+    const v = toTestViewFromError(httpErr(500, { message: 'LEAKED-ENGLISH-STRING' }))
+    expect(JSON.stringify(v)).not.toContain('LEAKED-ENGLISH-STRING')
+  })
+  // 评审 Important:502 判定只看 status===502(见 mcpErrorKey.ts 的
+  // `status === 502 || bodyError === 'agent unreachable'`),不依赖 body 形状——
+  // body 不是预期的 `{ok:false,error:'agent unreachable'}` 时也必须落 agentDown,
+  // 且 body 里塞的任何内容都不能泄漏进视图。
+  it('502 但 body 形状不是预期的那个(非常规对象)→ 仍判 agentDown,不泄漏 body 内容', () => {
+    const v = toTestViewFromError(httpErr(502, { unexpected: 'LEAKED-UNEXPECTED-SHAPE' }))
+    expect(v).toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrAgentDown', detail: '' })
+    expect(JSON.stringify(v)).not.toContain('LEAKED-UNEXPECTED-SHAPE')
+  })
+  it('502 且 body 是裸字符串 → 仍判 agentDown,不泄漏该字符串', () => {
+    const v = toTestViewFromError(httpErr(502, 'LEAKED-STRING-BODY'))
+    expect(v).toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrAgentDown', detail: '' })
+    expect(JSON.stringify(v)).not.toContain('LEAKED-STRING-BODY')
+  })
+})
diff --git a/src/ai/util/mcpErrorKey.ts b/src/ai/util/mcpErrorKey.ts
new file mode 100644
index 0000000..dc83e85
--- /dev/null
+++ b/src/ai/util/mcpErrorKey.ts
@@ -0,0 +1,112 @@
+// SP8-P4 Task 3 —— MCP 分区的「后端串 → i18n 键」映射。
+//
+// 为什么不用 `apiError.apiErrorMessage`:它的文件头自己写了警告
+// (`apiError.ts:18-20`)——返回值仍可能是后端英文原文(FastAPI 的 `detail`
+// 直接透传),只适合“暂时兜个底”的场合,不满足“界面永不回显后端原文”这条
+// 硬约束。本文件与 `channelsFormat.addBotErrorKey`(`:65-76`)同一分工:纯函数
+// 只把后端错误归一成 i18n **键**,不碰 vue-i18n,调用方 `t()` 出当前语言的文案。
+//
+// 取值链与 channelsFormat/skillsErrorKey 同一惯例:同时读 Go 服务的
+// `response.data.message` 与 FastAPI 的 `response.data.detail`(该接口今天全部
+// 走 Go,但沿用双读不增加成本,防将来改道);匹配前 trim + toLowerCase。
+//
+// 后端串权威源(已回源逐条核实,见任务报告——brief/设计文档抄的行号与此处实测有
+// 一两行出入,已在报告里申报,不影响串本身):
+//   - `NimoOS-AI/route/v2/mcp.go:277,282,286`(validateAndClean 的三条 400)
+//   - `mcp.go:152,168,186,332,441`(五处 404 "mcp server not found";brief 只列了
+//     152/187/332 三处,实测还有 168、441 两处未被抄到——同一条串,不影响映射)
+//   - `mcp.go:351`(502 agent unreachable,`c.JSON` 直出,不经 echo.HTTPError)
+//   - `pkg/mcpparse/mcpparse.go:36,47,62,76,138`(parse 的五条 400)
+//   - `agent/mcp_client/client.py:437,448,453,456`(test_server 的 4 个 error_key)
+
+import type { McpTestView } from '../types/mcpServer'
+
+/** 对齐 channelsFormat.ts:66-70 / skillsErrorKey.ts:33-40 的取错误串形状:
+ *  同时读 Go 的 `message` 与 FastAPI 的 `detail`,取到就 trim + toLowerCase。 */
+function rawMessage(e: unknown): string {
+  const data = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data
+  const raw = data && typeof data === 'object'
+    ? (data as { message?: unknown }).message ?? (data as { detail?: unknown }).detail
+    : undefined
+  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
+}
+
+function statusOf(e: unknown): number | undefined {
+  return (e as { response?: { status?: unknown } } | null | undefined)?.response?.status as number | undefined
+}
+
+/** 后端 `validateAndClean`(`mcp.go:273-289`)三条 400 + 404 "mcp server not found"
+ *  → i18n 键;其余(未知 400/500/网络错/无 response)一律落既有通用兜底键
+ *  `aiCfgSaveFailed`,绝不回显后端原文。 */
+export function saveServerErrorKey(e: unknown): string {
+  const s = rawMessage(e)
+  if (s === 'url required for http/sse') return 'aiMcpSrvErrUrlRequired'
+  if (s === 'command required for stdio') return 'aiMcpSrvErrCommandRequired'
+  if (s === "transport must be 'http', 'sse' or 'stdio'") return 'aiMcpSrvErrBadTransport'
+  if (s === 'mcp server not found') return 'aiMcpSrvErrNotFound'
+  return 'aiCfgSaveFailed'
+}
+
+/** `mcpparse.Parse`(`mcpparse.go:36,47,62,76,138`)五条 400 → 四个键(两条措辞
+ *  合并成 `aiMcpSrvParseErrNoCommand`,见测试注释);其余落 `aiMcpSrvParseFailed`。
+ *  ⚠️ 必须用相等匹配,不能用 `startsWith`/`includes` 判 "no command" 前缀——
+ *  否则 "no command (only environment variables)" 会被误判成
+ *  "no command after parsing" 类,测试已钉死这条优先级。 */
+export function parseCommandErrorKey(e: unknown): string {
+  const s = rawMessage(e)
+  if (s === 'empty command') return 'aiMcpSrvParseErrEmpty'
+  if (s === 'no command after parsing') return 'aiMcpSrvParseErrNoCommand'
+  if (s === "no command after '--'") return 'aiMcpSrvParseErrNoCommand'
+  if (s === 'no command (only environment variables)') return 'aiMcpSrvParseErrOnlyEnv'
+  if (s === 'unbalanced quotes in command') return 'aiMcpSrvParseErrQuotes'
+  return 'aiMcpSrvParseFailed'
+}
+
+/** `detail` 只在是字符串时保留,否则归一成 `''`——后端英文原文一律不上界面
+ *  (那些走 `error`/`error_key` 之外的自由文本字段,见 D8)。 */
+function detailOf(body: unknown): string {
+  const d = (body as { detail?: unknown } | null | undefined)?.detail
+  return typeof d === 'string' ? d : ''
+}
+
+/** `POST .../test` 200 裸响应体(`agent/mcp_client/client.py:432-461`)→ 视图。
+ *  成功态 `tool_count ?? 0` / `tools` 非数组归一成 `[]`;失败态按 `error_key`
+ *  四值查表,`error`(后端拼好的英文串)永不进入视图,只有 `msgKey` + `detail`。 */
+export function toTestView(body: unknown): McpTestView {
+  if (!body || typeof body !== 'object') {
+    return { ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' }
+  }
+  const b = body as { ok?: unknown; tool_count?: unknown; tools?: unknown; error_key?: unknown }
+  if (b.ok === true) {
+    return {
+      ok: true,
+      toolCount: typeof b.tool_count === 'number' ? b.tool_count : 0,
+      tools: Array.isArray(b.tools) ? b.tools : [],
+    }
+  }
+  const detail = detailOf(body)
+  switch (b.error_key) {
+    case 'probe_timeout': return { ok: false, msgKey: 'aiMcpSrvTestErrTimeout', detail }
+    case 'connect_failed': return { ok: false, msgKey: 'aiMcpSrvTestErrConnect', detail }
+    case 'list_timeout': return { ok: false, msgKey: 'aiMcpSrvTestErrListTimeout', detail }
+    case 'list_failed': return { ok: false, msgKey: 'aiMcpSrvTestErrListFailed', detail }
+    default: return { ok: false, msgKey: 'aiMcpSrvTestFailed', detail }
+  }
+}
+
+/** 抛出的错误(HTTP 层失败,不是 200 里的 `{ok:false,...}`)→ 视图。
+ *  `mcp.go:351` 的 502 `{ok:false,error:"agent unreachable"}` 与 404
+ *  `mcp server not found` 各给专用键,其余一律通用兜底,body 的字符串
+ *  永不放进 `detail`(那是后端英文原文)。 */
+export function toTestViewFromError(e: unknown): McpTestView {
+  const status = statusOf(e)
+  const data = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data
+  const bodyError = data && typeof data === 'object' ? (data as { error?: unknown }).error : undefined
+  if (status === 502 || bodyError === 'agent unreachable') {
+    return { ok: false, msgKey: 'aiMcpSrvTestErrAgentDown', detail: '' }
+  }
+  if (rawMessage(e) === 'mcp server not found') {
+    return { ok: false, msgKey: 'aiMcpSrvErrNotFound', detail: '' }
+  }
+  return { ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' }
+}
diff --git a/src/ai/util/mcpServerVisual.test.ts b/src/ai/util/mcpServerVisual.test.ts
new file mode 100644
index 0000000..0a96394
--- /dev/null
+++ b/src/ai/util/mcpServerVisual.test.ts
@@ -0,0 +1,63 @@
+import { describe, it, expect } from 'vitest'
+import { serverColor, transportLabel, SERVER_GLYPH } from './mcpServerVisual'
+import { SKILL_COLOR_IDS } from '../components/settings/skills/SkillTile.vue'
+
+const PALETTE = ['blue', 'purple', 'pink', 'orange', 'green', 'teal', 'slate']
+
+describe('serverColor', () => {
+  it('与 SkillTile 的色板逐字相同(复用同一套 --grad-sk-* token)', () => {
+    expect([...SKILL_COLOR_IDS]).toEqual(PALETTE)
+  })
+
+  it('同名同色(确定性哈希)', () => {
+    expect(serverColor('context7')).toBe(serverColor('context7'))
+  })
+
+  it('返回值永远落在色板内', () => {
+    for (const n of ['a', 'brave', 'notion', '中文名', 'x'.repeat(200), '@scope/pkg']) {
+      expect(PALETTE).toContain(serverColor(n))
+    }
+  })
+
+  // 判别力:如果实现写死返回 'blue',这条会红。
+  it('不同名字能落到至少 3 种不同颜色', () => {
+    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']
+    expect(new Set(names.map(serverColor)).size).toBeGreaterThanOrEqual(3)
+  })
+
+  it('空名 / null / undefined 回落 blue(Vue2 String(name || "") 的行为)', () => {
+    expect(serverColor('')).toBe('blue')
+    expect(serverColor(null)).toBe('blue')
+    expect(serverColor(undefined)).toBe('blue')
+  })
+
+  // 钉住 Vue2 的确切哈希(h = h*31 + charCode,>>> 0),换算法会红。
+  it('逐字复刻 Vue2 的哈希取值', () => {
+    expect(serverColor('brave')).toBe(PALETTE[hash('brave') % 7])
+    expect(serverColor('notion')).toBe(PALETTE[hash('notion') % 7])
+    function hash(s: string) {
+      let h = 0
+      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
+      return h
+    }
+  })
+})
+
+describe('transportLabel', () => {
+  it('大写化', () => {
+    expect(transportLabel('http')).toBe('HTTP')
+    expect(transportLabel('sse')).toBe('SSE')
+    expect(transportLabel('stdio')).toBe('STDIO')
+  })
+  it('空 / null / undefined → 空串(Vue2 String(t || "") 的行为)', () => {
+    expect(transportLabel('')).toBe('')
+    expect(transportLabel(null)).toBe('')
+    expect(transportLabel(undefined)).toBe('')
+  })
+})
+
+describe('SERVER_GLYPH', () => {
+  it('是 drive —— AgentIcon 里必须存在这个图标名', () => {
+    expect(SERVER_GLYPH).toBe('drive')
+  })
+})
diff --git a/src/ai/util/mcpServerVisual.ts b/src/ai/util/mcpServerVisual.ts
new file mode 100644
index 0000000..9c060d8
--- /dev/null
+++ b/src/ai/util/mcpServerVisual.ts
@@ -0,0 +1,25 @@
+// SP8-P4 Task 2 —— 1:1 移植自 Vue2 src/views/AI/MCP/mcpServerVisual.js(15 行)。
+// 哈希算法、色板顺序、取模逐字保留;色板与 SkillTile.vue 的 SKILL_COLOR_IDS
+// 完全相同(两边都映射到 tokens.scss:235-241 的 --grad-sk-* 七个渐变 token),
+// 故不新建色板、不新增 token。
+//
+// 类型放宽到 unknown:Vue2 :7 是 `String(name || '')`,对 null/undefined/数字
+// 都做了兜底,这里保持同样的宽容度(列表数据来自后端,name 理论上必为 string,
+// 但兜底是 Vue2 既有行为,不收紧)。
+const PALETTE = ['blue', 'purple', 'pink', 'orange', 'green', 'teal', 'slate']
+
+/** Vue2 mcpServerVisual.js:4 —— 后端没有图标字段,全部 MCP 服务统一用这个字形。 */
+export const SERVER_GLYPH = 'drive'
+
+/** Vue2 mcpServerVisual.js:6-11 逐字移植。 */
+export function serverColor(name: unknown): string {
+  const s = String(name || '')
+  let h = 0
+  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
+  return PALETTE[h % PALETTE.length]
+}
+
+/** Vue2 mcpServerVisual.js:13-15 逐字移植。 */
+export function transportLabel(t: unknown): string {
+  return String(t || '').toUpperCase()
+}
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
index 6549448..3dd352a 100644
--- a/src/ai/views/SettingsPage.vue
+++ b/src/ai/views/SettingsPage.vue
@@ -45,61 +45,68 @@ import SectionPlaceholder from '../components/settings/SectionPlaceholder.vue'
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
 } from '../components/settings/sections'
 import '../styles/tokens.scss'
 import '../styles/sk-shared.scss'
 import '../styles/settings-styles.scss'
 import '../styles/skills-styles.scss'
+import '../styles/mcp-styles.scss'
 
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
diff --git a/src/i18n/en_us.ts b/src/i18n/en_us.ts
index 697d4fb..1711e00 100644
--- a/src/i18n/en_us.ts
+++ b/src/i18n/en_us.ts
@@ -1308,11 +1308,94 @@ export default {
   aiSkTestClosed: 'Sandbox closed. No files were modified.',
   aiSkTestFailed: 'Run failed',
   aiSkTestPlaceholderEx: 'Try: "{ex}"',
   aiSkTestPlaceholder: 'Run the skill on a sample folder',
   aiSkTestHttpFailed: 'Sandbox run failed (HTTP {status})',
   aiSkTryDisabledTitle: 'This skill is paused',
   aiSkTryDisabledBody:
     'A paused skill is not loaded, so trying it in chat will have no effect. Enable it first?',
   aiSkTryEnableAndTry: 'Enable and try',
   // <<< SP8-P3b Task 2
+  // >>> SP8-P4 Task 4 —— MCP section (McpSection/Group/Detail/Modal). §4.2 values
+  // are Vue2's key literal (production en_US.json string, or the key itself where
+  // en_US.json has no matching entry — 4 such cases per brief); §4.3 (14 keys) is
+  // this period's new copy (D5/D8), no Vue2 counterpart.
+  aiMcpSrvAdd: 'Add MCP server',
+  aiMcpSrvSearchPlaceholder: 'Search servers…',
+  aiMcpSrvGroupEnabled: 'Enabled servers',
+  aiMcpSrvGroupDisabled: 'Disabled servers',
+  aiMcpSrvNoMatch: 'No servers match',
+  aiMcpSrvEmpty: 'No MCP servers yet. Click the + to add one.',
+  aiMcpSrvLoadFailed: 'Could not load MCP servers',
+  aiMcpSrvEnabledToast: 'Server enabled',
+  aiMcpSrvDisabledToast: 'Server disabled',
+  aiMcpSrvUpdateFailed: 'Update failed',
+  aiMcpSrvRemovedName: 'Removed {name}',
+  aiMcpSrvAddedName: 'Added {name}',
+  aiMcpSrvPickHint: 'Pick an MCP server on the left',
+  aiMcpSrvPickSub: 'Or add one to give Nimo new tools over the Model Context Protocol.',
+  aiMcpSrvEditConfig: 'Edit configuration',
+  aiMcpSrvRemove: 'Remove server',
+  aiMcpSrvStatus: 'Status',
+  aiMcpSrvDisabled: 'Disabled',
+  aiMcpSrvTransport: 'Transport',
+  aiMcpSrvHeaders: 'Headers',
+  aiMcpSrvConfigured: 'Configured',
+  aiMcpSrvNone: 'None',
+  aiMcpSrvEnv: 'Env',
+  aiMcpSrvConfiguration: 'Configuration',
+  aiMcpSrvConfigHint: 'How Nimo connects to this server',
+  aiMcpSrvTest: 'Test connection',
+  aiMcpSrvTesting: 'Testing…',
+  aiMcpSrvCommand: 'Command',
+  aiMcpSrvArgs: 'Arguments',
+  aiMcpSrvEnvVars: 'Environment variables',
+  aiMcpSrvConfiguredHidden: 'Configured (hidden)',
+  aiMcpSrvUrl: 'Endpoint URL',
+  aiMcpSrvReqHeaders: 'Request headers',
+  aiMcpSrvTestStdioHint: 'This can take up to 90s for stdio (first run downloads the server).',
+  aiMcpSrvTestOk: 'Connected · {n} tools',
+  aiMcpSrvTestFailed: 'Connection failed',
+  aiMcpSrvToolsNote: 'Tools are declared by this server during handshake. The first call in a conversation will ask for your permission.',
+  aiMcpSrvRemoveTitle: 'Remove this MCP server?',
+  aiMcpSrvRemoveBody: 'Nimo will disconnect from {name}; its tools will no longer be available to the agent. You can add it again later.',
+  aiMcpSrvRemoveConfirm: 'Remove',
+  aiMcpSrvEditTitle: 'Edit MCP server',
+  aiMcpSrvQuickAdd: 'Quick add',
+  aiMcpSrvQuickAddHint: 'paste a command or URL',
+  aiMcpSrvParsing: 'Parsing…',
+  aiMcpSrvFillForm: 'Fill form',
+  aiMcpSrvName: 'Name',
+  aiMcpSrvNamePlaceholder: 'e.g. brave / notion / my-tools',
+  aiMcpSrvTransportType: 'Transport type',
+  aiMcpSrvTransportHttp: 'Remote · streamable HTTP',
+  aiMcpSrvTransportSse: 'Remote · server-sent events',
+  aiMcpSrvTransportStdio: 'Local · runs a command',
+  aiMcpSrvOptional: 'optional',
+  aiMcpSrvKvKey: 'Key',
+  aiMcpSrvKvValue: 'Value',
+  aiMcpSrvAddHeader: 'Add header',
+  aiMcpSrvKvHint: 'Leave blank to keep current; filling in replaces all.',
+  aiMcpSrvCommandPlaceholder: 'e.g. npx / uvx / python',
+  aiMcpSrvOnePerLine: 'One per line',
+  aiMcpSrvAddVariable: 'Add variable',
+  aiMcpSrvSavedLocally: 'Saved locally on this NAS',
+  aiMcpSrvAddServer: 'Add server',
+  aiMcpSrvParseFailed: "Couldn't parse that command",
+  // This period's new copy (no Vue2 counterpart, D5/D8 product, checked against the
+  // design doc, not the zh_CN.json codepoint script).
+  aiMcpSrvTestErrTimeout: 'Probe timed out',
+  aiMcpSrvTestErrConnect: 'Could not connect to this server',
+  aiMcpSrvTestErrListTimeout: 'Timed out listing tools',
+  aiMcpSrvTestErrListFailed: 'Connected, but could not list tools',
+  aiMcpSrvTestErrAgentDown: 'The AI agent service is not running, so the probe could not start',
+  aiMcpSrvTestDetail: 'Technical details',
+  aiMcpSrvErrUrlRequired: 'Endpoint URL is required for HTTP / SSE',
+  aiMcpSrvErrCommandRequired: 'Command is required for STDIO',
+  aiMcpSrvErrBadTransport: 'Transport must be HTTP, SSE or STDIO',
+  aiMcpSrvErrNotFound: 'This server no longer exists — refresh the list',
+  aiMcpSrvParseErrEmpty: 'Paste a command or URL first',
+  aiMcpSrvParseErrNoCommand: 'No runnable command found',
+  aiMcpSrvParseErrOnlyEnv: 'Only environment variables — a command is missing',
+  aiMcpSrvParseErrQuotes: 'Unbalanced quotes',
+  // <<< SP8-P4 Task 4
 }
diff --git a/src/i18n/zh_cn.ts b/src/i18n/zh_cn.ts
index d319e70..11fe095 100644
--- a/src/i18n/zh_cn.ts
+++ b/src/i18n/zh_cn.ts
@@ -1319,11 +1319,93 @@ export default {
   aiSkTestPlaceholder: '在示例文件夹上运行该技能',
   // 新文案:沙箱运行失败的 HTTP 状态码提示(设计要求本地化文案 + 状态码,不回显后端 body)。
   aiSkTestHttpFailed: '沙箱运行失败(HTTP {status})',
   // 新文案(D4 拍板,收 P3a 挂账③):停用技能点「在对话中试用」先提示,而不是
   // X-Skill-Id 照发但 agent 找不到 SKILL.md 造成的零反馈(skills_runtime.go:57)。
   aiSkTryDisabledTitle: '该技能已停用',
   aiSkTryDisabledBody:
     '停用的技能不会被加载,现在去对话里试用不会有任何效果。要先启用它吗?',
   aiSkTryEnableAndTry: '启用并试用',
   // <<< SP8-P3b Task 2
+  // >>> SP8-P4 Task 4 —— MCP 分区(McpSection/Group/Detail/Modal)。
+  // §4.2(62 条,不是任务书正文写的「63」——已在报告里申报此计数偏差)中文值逐字取自
+  // Vue2 生产语言包 zh_CN.json(程序化比对见任务报告 Step 4);§4.3(14 条)是本期
+  // 新文案(D5/D8 产物),Vue2 无对应物,按设计文档核对。
+  aiMcpSrvAdd: '新增 MCP 服务',
+  aiMcpSrvSearchPlaceholder: '搜索服务…',
+  aiMcpSrvGroupEnabled: '已启用服务',
+  aiMcpSrvGroupDisabled: '已停用服务',
+  aiMcpSrvNoMatch: '没有匹配的服务',
+  aiMcpSrvEmpty: '还没有 MCP 服务,点击 + 添加一个。',
+  aiMcpSrvLoadFailed: '无法加载 MCP 服务',
+  aiMcpSrvEnabledToast: '服务已启用',
+  aiMcpSrvDisabledToast: '服务已停用',
+  aiMcpSrvUpdateFailed: '更新失败',
+  aiMcpSrvRemovedName: '已移除 {name}',
+  aiMcpSrvAddedName: '已添加 {name}',
+  aiMcpSrvPickHint: '在左侧选择一个 MCP 服务',
+  aiMcpSrvPickSub: '或新增一个,通过 Model Context Protocol 给 Nimo 接入新工具。',
+  aiMcpSrvEditConfig: '编辑配置',
+  aiMcpSrvRemove: '移除服务',
+  aiMcpSrvStatus: '状态',
+  aiMcpSrvDisabled: '未启用',
+  aiMcpSrvTransport: '传输',
+  aiMcpSrvHeaders: '请求头',
+  aiMcpSrvConfigured: '已配置',
+  aiMcpSrvNone: '无',
+  aiMcpSrvEnv: '环境变量',
+  aiMcpSrvConfiguration: '配置',
+  aiMcpSrvConfigHint: 'Nimo 如何连接该服务',
+  aiMcpSrvTest: '测试连接',
+  aiMcpSrvTesting: '测试中…',
+  aiMcpSrvCommand: '命令',
+  aiMcpSrvArgs: '参数',
+  aiMcpSrvEnvVars: '环境变量',
+  aiMcpSrvConfiguredHidden: '已配置(已隐藏)',
+  aiMcpSrvUrl: '端点 URL',
+  aiMcpSrvReqHeaders: '请求头',
+  aiMcpSrvTestStdioHint: 'stdio 首次可能需要约 90 秒(会现场下载 server)。',
+  aiMcpSrvTestOk: '已连接 · {n} 个工具',
+  aiMcpSrvTestFailed: '连接失败',
+  aiMcpSrvToolsNote: '工具由该服务在握手时声明。对话中首次调用会请求你的许可。',
+  aiMcpSrvRemoveTitle: '移除该 MCP 服务?',
+  aiMcpSrvRemoveBody: 'Nimo 将断开与 {name} 的连接,其工具不再对 Agent 可用。你可以稍后重新添加。',
+  aiMcpSrvRemoveConfirm: '移除',
+  aiMcpSrvEditTitle: '编辑 MCP 服务',
+  aiMcpSrvQuickAdd: '快速添加',
+  aiMcpSrvQuickAddHint: '粘贴一行命令或 URL',
+  aiMcpSrvParsing: '解析中…',
+  aiMcpSrvFillForm: '填充表单',
+  aiMcpSrvName: '名称',
+  aiMcpSrvNamePlaceholder: '例如:brave / notion / my-tools',
+  aiMcpSrvTransportType: '传输方式',
+  aiMcpSrvTransportHttp: '远程 · 可流式 HTTP',
+  aiMcpSrvTransportSse: '远程 · 服务器推送事件',
+  aiMcpSrvTransportStdio: '本地 · 运行一个命令',
+  aiMcpSrvOptional: '可选',
+  aiMcpSrvKvKey: '键',
+  aiMcpSrvKvValue: '值',
+  aiMcpSrvAddHeader: '添加请求头',
+  aiMcpSrvKvHint: '留空保持不变;填写则覆盖全部。',
+  aiMcpSrvCommandPlaceholder: '例如 npx / uvx / python',
+  aiMcpSrvOnePerLine: '每行一个',
+  aiMcpSrvAddVariable: '添加变量',
+  aiMcpSrvSavedLocally: '保存在这台 NAS 本地',
+  aiMcpSrvAddServer: '添加服务',
+  aiMcpSrvParseFailed: '无法解析该命令',
+  // 本期新文案(Vue2 无对应物,D5/D8 产物,按设计文档核对,不进 zh_CN.json 逐码点比对脚本)
+  aiMcpSrvTestErrTimeout: '探测超时',
+  aiMcpSrvTestErrConnect: '连不上这个服务器',
+  aiMcpSrvTestErrListTimeout: '读取工具列表超时',
+  aiMcpSrvTestErrListFailed: '连上了,但读不到工具列表',
+  aiMcpSrvTestErrAgentDown: 'AI 助手服务没在运行,无法发起探测',
+  aiMcpSrvTestDetail: '技术详情',
+  aiMcpSrvErrUrlRequired: 'HTTP / SSE 传输必须填端点 URL',
+  aiMcpSrvErrCommandRequired: 'STDIO 传输必须填命令',
+  aiMcpSrvErrBadTransport: '传输方式只能是 HTTP、SSE 或 STDIO',
+  aiMcpSrvErrNotFound: '这个服务已经不存在了,请刷新列表',
+  aiMcpSrvParseErrEmpty: '请先粘贴一行命令或 URL',
+  aiMcpSrvParseErrNoCommand: '没解析出可执行的命令',
+  aiMcpSrvParseErrOnlyEnv: '只有环境变量,后面缺一条命令',
+  aiMcpSrvParseErrQuotes: '引号没有配对',
+  // <<< SP8-P4 Task 4
 }
