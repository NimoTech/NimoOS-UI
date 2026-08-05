# P4 Task 8 review package — 7b4e46b..HEAD

## commits
9e5b481 feat(ai): SP8-P4 T8 McpServerModal 表单弹窗(快速粘贴单层取数)

## stat
 .../components/settings/mcp/McpServerModal.test.ts | 486 +++++++++++++++++++++
 src/ai/components/settings/mcp/McpServerModal.vue  | 374 ++++++++++++++++
 2 files changed, 860 insertions(+)

## diff -U10
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
