import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import McpServerModal from './McpServerModal.vue'
import type { McpServer } from '../../../types/mcpServer'

// SP8-P4 Task 8 —— 对齐 Vue2 src/views/AI/MCP/McpServerModal.vue(216 行)。
// 挂载手法与 ../skills/AddSkillModal.test.ts 一致(同款 SkModal 外壳):
// SkModal 的 DialogPortal 默认 portal 到 '.set-app',目标元素必须在组件挂载前
// 就存在于 DOM;打开态聚焦用 setTimeout(fn, 0)(宏任务),纯微任务级 flush()
// 追不上,需要 macroFlush() 真的跑完一个宏任务。

// vi.hoisted 避免 ESM 提升的 TDZ(公共约束 §9 先例 agentStore.test.ts:4-19)。
const h = vi.hoisted(() => ({ parseMCPCommand: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: h } }))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function withHost() {
  const host = document.createElement('div')
  host.className = 'set-app'
  document.body.appendChild(host)
  return host
}

function makeServer(overrides: Partial<McpServer> = {}): McpServer {
  return {
    id: 1,
    name: 'brave-search',
    transport: 'http',
    url: 'https://mcp.example.com/brave',
    command: '',
    args: [],
    enabled: true,
    has_headers: false,
    has_env: false,
    ...overrides,
  }
}

function mountModal(
  props: Partial<{ open: boolean; server: McpServer | null; saving: boolean; serverError: string }> = {},
) {
  return mount(McpServerModal, {
    props: { open: true, server: null, saving: false, serverError: '', ...props },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}

const flush = async () => { await nextTick(); await nextTick(); await nextTick() }
// 组件的打开态聚焦用 setTimeout(fn, 0)(宏任务)覆盖 reka 的默认 mount-auto-focus
// (先例 AddSkillModal.vue 头注释「reka 初始焦点实测结论」),纯微任务级 flush()
// 追不上,需要真的让一个宏任务跑完。
const macroFlush = async () => { await flush(); await new Promise((r) => setTimeout(r, 0)); await flush() }

function modalTitleEl() { return document.querySelector('.sk-modal .sk-modal-title') as HTMLElement }
function nameInput() { return document.querySelector('.sk-modal [data-f="name"]') as HTMLInputElement }
function urlInput() { return document.querySelector('.sk-modal [data-f="url"]') as HTMLInputElement }
function commandInput() { return document.querySelector('.sk-modal [data-f="command"]') as HTMLInputElement }
function pasteInput() { return document.querySelector('.sk-modal [data-f="paste"]') as HTMLInputElement }
function fillBtn() { return document.querySelector('.sk-modal [data-f="fill"]') as HTMLButtonElement }
function submitBtn() { return document.querySelector('.sk-modal-foot .sk-btn.primary') as HTMLButtonElement }
function cancelBtn() { return document.querySelector('.sk-modal-foot .sk-btn.ghost') as HTMLButtonElement }
function trigOptions() { return Array.from(document.querySelectorAll('.sk-modal .sk-trig-option')) as HTMLElement[] }

function setValue(el: HTMLInputElement | HTMLTextAreaElement, v: string) {
  el.value = v
  el.dispatchEvent(new Event('input'))
}

beforeEach(() => { withHost(); h.parseMCPCommand.mockReset() })
afterEach(() => { document.body.innerHTML = '' })

describe('McpServerModal', () => {
  // ===== 覆盖点 1:标题两态对照 =====
  it('1a. 新增态(server=null)标题为 aiMcpSrvAdd', async () => {
    mountModal({ server: null })
    await macroFlush()
    expect(modalTitleEl().textContent).toBe(zh.aiMcpSrvAdd)
  })

  it('1b. 编辑态(server 非空)标题为 aiMcpSrvEditTitle', async () => {
    mountModal({ server: makeServer() })
    await macroFlush()
    expect(modalTitleEl().textContent).toBe(zh.aiMcpSrvEditTitle)
  })

  // ===== 覆盖点 2:快速添加区只在新增态渲染 =====
  it('2a. 新增态渲染 .mcp-quickadd-row', async () => {
    mountModal({ server: null })
    await macroFlush()
    expect(document.querySelector('.sk-modal .mcp-quickadd-row')).not.toBeNull()
  })

  it('2b. 编辑态不渲染 .mcp-quickadd-row(Vue2 :9 的 v-if="!isEdit")', async () => {
    mountModal({ server: makeServer() })
    await macroFlush()
    expect(document.querySelector('.sk-modal .mcp-quickadd-row')).toBeNull()
  })

  // ===== 覆盖点 3:传输三选一 =====
  it('3. 三个 .sk-trig-option 文案正确;点 STDIO 后 data-active 移到它身上', async () => {
    mountModal({ server: null })
    await macroFlush()
    const opts = trigOptions()
    expect(opts).toHaveLength(3)
    expect(opts[0].textContent).toContain(zh.aiMcpSrvTransportHttp)
    expect(opts[1].textContent).toContain(zh.aiMcpSrvTransportSse)
    expect(opts[2].textContent).toContain(zh.aiMcpSrvTransportStdio)
    expect(opts[0].dataset.active).toBe('true') // 默认 transport: 'http'

    opts[2].click()
    await nextTick()
    expect(opts[2].dataset.active).toBe('true')
    expect(opts[0].dataset.active).toBe('false')
    expect(opts[1].dataset.active).toBe('false')
  })

  // ===== 覆盖点 4:字段按 transport 切换,两次对照 =====
  it('4a. stdio 态:有 command/args/env-kv,无 url/headers-kv', async () => {
    mountModal({ server: makeServer({ transport: 'stdio', command: 'npx' }) })
    await macroFlush()
    expect(document.querySelector('.sk-modal [data-f="command"]')).not.toBeNull()
    expect(document.querySelector('.sk-modal [data-f="args"]')).not.toBeNull()
    expect(document.querySelector('.sk-modal [data-kv="env"]')).not.toBeNull()
    expect(document.querySelector('.sk-modal [data-f="url"]')).toBeNull()
    expect(document.querySelector('.sk-modal [data-kv="headers"]')).toBeNull()
  })

  it('4b. http 态:有 url/headers-kv,无 command/args/env-kv', async () => {
    mountModal({ server: makeServer({ transport: 'http' }) })
    await macroFlush()
    expect(document.querySelector('.sk-modal [data-f="url"]')).not.toBeNull()
    expect(document.querySelector('.sk-modal [data-kv="headers"]')).not.toBeNull()
    expect(document.querySelector('.sk-modal [data-f="command"]')).toBeNull()
    expect(document.querySelector('.sk-modal [data-f="args"]')).toBeNull()
    expect(document.querySelector('.sk-modal [data-kv="env"]')).toBeNull()
  })

  // ===== 覆盖点 5:valid 四条独立断言 =====
  it('5a. 名称空 → 提交按钮 disabled', async () => {
    mountModal({ server: null })
    await macroFlush()
    expect(submitBtn().disabled).toBe(true)
  })

  it('5b. 名称有值但(http)URL 空 → disabled', async () => {
    mountModal({ server: null })
    await macroFlush()
    setValue(nameInput(), 'my-server')
    await flush()
    expect(submitBtn().disabled).toBe(true)
  })

  it('5c. 名称、URL 都有值(http)→ enabled', async () => {
    mountModal({ server: null })
    await macroFlush()
    setValue(nameInput(), 'my-server')
    setValue(urlInput(), 'https://x.example.com')
    await flush()
    expect(submitBtn().disabled).toBe(false)
  })

  it('5d. stdio 下 URL 空但 command 有值 → enabled', async () => {
    mountModal({ server: null })
    await macroFlush()
    trigOptions()[2].click() // 切到 STDIO
    await nextTick()
    setValue(nameInput(), 'my-server')
    setValue(commandInput(), 'npx')
    await flush()
    expect(submitBtn().disabled).toBe(false)
  })

  // ===== 覆盖点 6:KV 编辑器 =====
  it('6a. 点「添加请求头」加一行;填 key/value;点删除移除该行', async () => {
    mountModal({ server: null })
    await macroFlush()
    const addBtn = document.querySelector('.sk-modal [data-add="headers"]') as HTMLButtonElement
    addBtn.click()
    await nextTick()
    let rows = document.querySelectorAll('.sk-modal [data-kv="headers"] .mcp-kv-row')
    expect(rows).toHaveLength(1)
    const kInput = rows[0].querySelector('[data-kvk]') as HTMLInputElement
    const vInput = rows[0].querySelector('[data-kvv]') as HTMLInputElement
    setValue(kInput, 'X-Test')
    setValue(vInput, '123')
    await nextTick()
    expect(kInput.value).toBe('X-Test')
    expect(vInput.value).toBe('123')

    const delBtn = document.querySelector('.sk-modal [data-kv="headers"] .mcp-kv-del') as HTMLButtonElement
    delBtn.click()
    await nextTick()
    rows = document.querySelectorAll('.sk-modal [data-kv="headers"] .mcp-kv-row')
    expect(rows).toHaveLength(0)
  })

  it('6b. 空 key 的行在提交时被 collect() 丢弃', async () => {
    const w = mountModal({ server: null })
    await macroFlush()
    setValue(nameInput(), 'svc')
    setValue(urlInput(), 'https://x.example.com')
    const addBtn = document.querySelector('.sk-modal [data-add="headers"]') as HTMLButtonElement
    addBtn.click(); addBtn.click()
    await nextTick()
    const rows = document.querySelectorAll('.sk-modal [data-kv="headers"] .mcp-kv-row')
    expect(rows).toHaveLength(2)
    // 第一行 key/value 都填,第二行 key 留空只填 value
    setValue(rows[0].querySelector('[data-kvk]') as HTMLInputElement, 'Authorization')
    setValue(rows[0].querySelector('[data-kvv]') as HTMLInputElement, 'Bearer xyz')
    setValue(rows[1].querySelector('[data-kvv]') as HTMLInputElement, 'orphan-value')
    await flush()

    submitBtn().click()
    await flush()
    const payload = w.emitted('save')![0][0] as Record<string, unknown>
    expect(payload.headers).toEqual({ Authorization: 'Bearer xyz' })
  })

  // ===== 覆盖点 7:提交 payload 形状 =====
  it('7a. stdio 提交 payload 形状:args 按行 split+trim+去空行', async () => {
    const w = mountModal({ server: null })
    await macroFlush()
    trigOptions()[2].click()
    await nextTick()
    setValue(nameInput(), 'my-stdio')
    setValue(commandInput(), 'npx')
    const argsTextarea = document.querySelector('.sk-modal [data-f="args"]') as HTMLTextAreaElement
    setValue(argsTextarea, '  -y  \n\n@upstash/context7-mcp\n  ')
    await flush()

    submitBtn().click()
    await flush()
    expect(w.emitted('save')![0][0]).toEqual({
      name: 'my-stdio',
      transport: 'stdio',
      enabled: true,
      command: 'npx',
      args: ['-y', '@upstash/context7-mcp'],
      env: {},
    })
  })

  it('7b. http 提交 payload 形状:{name, transport:"http", enabled, url, headers:{…}}', async () => {
    const w = mountModal({ server: null })
    await macroFlush()
    setValue(nameInput(), 'my-http')
    setValue(urlInput(), 'https://x.example.com')
    const addBtn = document.querySelector('.sk-modal [data-add="headers"]') as HTMLButtonElement
    addBtn.click()
    await nextTick()
    const row = document.querySelector('.sk-modal [data-kv="headers"] .mcp-kv-row') as HTMLElement
    setValue(row.querySelector('[data-kvk]') as HTMLInputElement, 'X-Api-Key')
    setValue(row.querySelector('[data-kvv]') as HTMLInputElement, 'secret')
    await flush()

    submitBtn().click()
    await flush()
    expect(w.emitted('save')![0][0]).toEqual({
      name: 'my-http',
      transport: 'http',
      enabled: true,
      url: 'https://x.example.com',
      headers: { 'X-Api-Key': 'secret' },
    })
  })

  // ===== 覆盖点 8:编辑态且无 KV 行时不带该字段,两条对照 =====
  it('8a. 新增态即使 KV 空也带 env:{}(stdio)', async () => {
    const w = mountModal({ server: null })
    await macroFlush()
    trigOptions()[2].click()
    await nextTick()
    setValue(nameInput(), 'svc')
    setValue(commandInput(), 'npx')
    await flush()
    submitBtn().click()
    await flush()
    const payload = w.emitted('save')![0][0] as Record<string, unknown>
    expect(payload).toHaveProperty('env')
    expect(payload.env).toEqual({})
  })

  it('8b. 编辑态且 env 空则不带 env 键(Vue2 :206 的条件)', async () => {
    const server = makeServer({ id: 3, transport: 'stdio', command: 'npx', args: [], has_env: false })
    const w = mountModal({ server })
    await macroFlush()
    // 名称/命令已由 server 回填,直接提交
    submitBtn().click()
    await flush()
    const payload = w.emitted('save')![0][0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('env')
  })

  // ===== 覆盖点 9:编辑态且 has_headers 为真 → 显示 .mcp-kv-hint =====
  it('9a. 编辑态 + has_headers=true → 显示 .mcp-kv-hint', async () => {
    mountModal({ server: makeServer({ transport: 'http', has_headers: true }) })
    await macroFlush()
    const hint = document.querySelector('.sk-modal .mcp-kv-hint')
    expect(hint).not.toBeNull()
    expect(hint!.textContent).toBe(zh.aiMcpSrvKvHint)
  })

  it('9b. 新增态不显示 .mcp-kv-hint(即使 http)', async () => {
    mountModal({ server: null })
    await macroFlush()
    expect(document.querySelector('.sk-modal .mcp-kv-hint')).toBeNull()
  })

  // ===== 覆盖点 10:快速粘贴单层取数钉子 =====
  it('10. 快速粘贴(单层取数):裸 Parsed 返回,填充后传输切 stdio、command/args/env/名称都填上', async () => {
    h.parseMCPCommand.mockResolvedValue({
      transport: 'stdio', command: 'npx', args: ['-y', '@upstash/context7-mcp'], env: { FOO: 'bar' },
      url: '', suggested_name: 'context7',
    })
    const w = mountModal({ server: null })
    await macroFlush()
    setValue(pasteInput(), 'npx -y @upstash/context7-mcp')
    await nextTick()
    fillBtn().click()
    await flush()
    await flush()

    expect(h.parseMCPCommand).toHaveBeenCalledWith('npx -y @upstash/context7-mcp')
    expect(trigOptions()[2].dataset.active).toBe('true') // stdio 选中
    expect(commandInput().value).toBe('npx')
    const argsTextarea = document.querySelector('.sk-modal [data-f="args"]') as HTMLTextAreaElement
    expect(argsTextarea.value).toBe('-y\n@upstash/context7-mcp')
    expect(nameInput().value).toBe('context7')
    const envRow = document.querySelector('.sk-modal [data-kv="env"] .mcp-kv-row') as HTMLElement
    expect((envRow.querySelector('[data-kvk]') as HTMLInputElement).value).toBe('FOO')
    expect((envRow.querySelector('[data-kvv]') as HTMLInputElement).value).toBe('bar')
    void w
  })

  // ===== 覆盖点 11:快速粘贴解析成 http =====
  it('11. 快速粘贴解析成 http:url 填上,command/args/env 清空', async () => {
    h.parseMCPCommand.mockResolvedValue({
      transport: 'http', command: '', args: [], env: {}, url: 'https://mcp.example.com', suggested_name: '',
    })
    mountModal({ server: null })
    await macroFlush()
    // 先切到 stdio 并填一些字段,验证粘贴解析成 http 后被清空
    trigOptions()[2].click()
    await nextTick()
    setValue(commandInput(), 'old-command')
    await flush()

    setValue(pasteInput(), 'curl https://mcp.example.com')
    await nextTick()
    fillBtn().click()
    await flush()
    await flush()

    expect(trigOptions()[0].dataset.active).toBe('true') // http 选中
    expect(urlInput().value).toBe('https://mcp.example.com')
    // command/args 字段已随 transport 切回 http 而不再渲染;env 应为空
    expect(document.querySelector('.sk-modal [data-f="command"]')).toBeNull()
    expect(document.querySelector('.sk-modal [data-kv="env"]')).toBeNull()
  })

  // ===== 覆盖点 12:suggested_name 只在名称为空时填入 =====
  it('12a. 名称为空时,快速粘贴的 suggested_name 会填入', async () => {
    h.parseMCPCommand.mockResolvedValue({
      transport: 'stdio', command: 'npx', args: [], env: {}, url: '', suggested_name: 'context7',
    })
    mountModal({ server: null })
    await macroFlush()
    setValue(pasteInput(), 'npx foo')
    await nextTick()
    fillBtn().click()
    await flush()
    await flush()
    expect(nameInput().value).toBe('context7')
  })

  it('12b. 名称已填时,suggested_name 不覆盖', async () => {
    h.parseMCPCommand.mockResolvedValue({
      transport: 'stdio', command: 'npx', args: [], env: {}, url: '', suggested_name: 'context7',
    })
    mountModal({ server: null })
    await macroFlush()
    setValue(nameInput(), 'my-own-name')
    setValue(pasteInput(), 'npx foo')
    await nextTick()
    fillBtn().click()
    await flush()
    await flush()
    expect(nameInput().value).toBe('my-own-name')
  })

  // ===== 覆盖点 13:解析失败 → 本地化文案,不含后端英文串 =====
  it('13. 解析失败 → .mcp-quickadd-err 显示本地化文案,不含后端英文串', async () => {
    h.parseMCPCommand.mockRejectedValue(
      Object.assign(new Error('x'), { response: { data: { message: 'empty command' } } }),
    )
    mountModal({ server: null })
    await macroFlush()
    setValue(pasteInput(), '""')
    await nextTick()
    fillBtn().click()
    await flush()
    await flush()
    const err = document.querySelector('.sk-modal .mcp-quickadd-err') as HTMLElement
    expect(err).not.toBeNull()
    expect(err.textContent).toBe(zh.aiMcpSrvParseErrEmpty)
    expect(document.querySelector('.sk-modal')!.textContent).not.toContain('empty command')
  })

  // ===== 覆盖点 14:解析中态 + pasteCmd 空态 =====
  it('14a. 解析中:按钮文案 aiMcpSrvParsing 且 disabled', async () => {
    let resolve!: (v: unknown) => void
    h.parseMCPCommand.mockReturnValue(new Promise((r) => { resolve = r }))
    mountModal({ server: null })
    await macroFlush()
    setValue(pasteInput(), 'npx foo')
    await nextTick()
    fillBtn().click()
    await nextTick()
    expect(fillBtn().disabled).toBe(true)
    expect(fillBtn().textContent).toContain(zh.aiMcpSrvParsing)
    resolve({ transport: 'stdio', command: 'npx', args: [], env: {}, url: '', suggested_name: '' })
    await flush()
  })

  it('14b. pasteCmd 为空时按钮 disabled', async () => {
    mountModal({ server: null })
    await macroFlush()
    expect(pasteInput().value).toBe('')
    expect(fillBtn().disabled).toBe(true)
  })

  // ===== 覆盖点 15:serverError 行内报错 =====
  it('15. serverError 非空 → 渲染 .sk-field-err 行内错误(先例 AddSkillModal)', async () => {
    mountModal({ server: null, serverError: zh.aiMcpSrvErrUrlRequired })
    await macroFlush()
    const err = document.querySelector('.sk-modal .sk-field-err') as HTMLElement
    expect(err).not.toBeNull()
    expect(err.getAttribute('role')).toBe('alert')
    expect(err.textContent).toBe(zh.aiMcpSrvErrUrlRequired)
  })

  // ===== 覆盖点 16:open 真→假→真,表单复位 =====
  it('16. open 由真变假再变真 → 表单复位(组件常驻,不像 Vue2 每次都是新实例)', async () => {
    const w = mountModal({ server: null })
    await macroFlush()
    setValue(nameInput(), 'typed-name')
    setValue(urlInput(), 'https://typed.example.com')
    await flush()
    expect(nameInput().value).toBe('typed-name')

    await w.setProps({ open: false })
    await flush()
    await w.setProps({ open: true })
    await macroFlush()

    expect(nameInput().value).toBe('')
    expect(urlInput().value).toBe('')
  })

  // 附加:取消按钮 emit update:open(false),不 emit save —— 与 15 条覆盖点互补,
  // 验证「照 AddSkillModal 先例」的常驻外壳行为完整。
  it('附加:取消按钮 emit update:open(false),不 emit save', async () => {
    const w = mountModal({ server: null })
    await macroFlush()
    cancelBtn().click()
    await flush()
    expect(w.emitted('update:open')).toEqual([[false]])
    expect(w.emitted('save')).toBeUndefined()
  })

  // 附加:saving=true 时按钮文案变化且禁用(与 5c 的「enabled」态对照,确认 saving 优先)。
  it('附加:saving=true 时提交按钮文案变 aiCfgSaving 且禁用', async () => {
    mountModal({ server: null, saving: true })
    await macroFlush()
    setValue(nameInput(), 'foo')
    setValue(urlInput(), 'https://x.example.com')
    await flush()
    expect(submitBtn().disabled).toBe(true)
    expect(submitBtn().textContent).toContain(zh.aiCfgSaving)
  })
})
