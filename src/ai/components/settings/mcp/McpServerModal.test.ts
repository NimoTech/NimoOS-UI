import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import McpServerModal from './McpServerModal.vue'
import type { McpServer } from '../../../types/mcpServer'

// SP8-P4 Task 8 —— Align with Vue2 src/views/AI/MCP/McpServerModal.vue (216 lines).
// Mount technique consistent with ../skills/AddSkillModal.test.ts (same SkModal shell):
// SkModal's DialogPortal defaults to portal to '.set-app', target element must exist in DOM
// before component mount; open state focus uses setTimeout(fn, 0) (macrotask), pure microtask-level flush()
// cannot catch up, need macroFlush() to actually run a complete macrotask.

// vi.hoisted avoids ESM hoisting's TDZ (shared constraint §9 precedent agentStore.test.ts:4-19).
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
// Component's open state focus uses setTimeout(fn, 0) (macrotask) to override reka's default mount-auto-focus
// (precedent: AddSkillModal.vue header comment "reka initial focus empirical conclusion"), pure microtask-level flush()
// cannot catch up, need to actually run a complete macrotask.
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
  // ===== Coverage point 1: Title two-state comparison =====
  it('1a. Create mode (server=null) title is aiMcpSrvAdd', async () => {
    mountModal({ server: null })
    await macroFlush()
    expect(modalTitleEl().textContent).toBe(zh.aiMcpSrvAdd)
  })

  it('1b. Edit mode (server non-empty) title is aiMcpSrvEditTitle', async () => {
    mountModal({ server: makeServer() })
    await macroFlush()
    expect(modalTitleEl().textContent).toBe(zh.aiMcpSrvEditTitle)
  })

  // ===== Coverage point 2: Quick-add section renders only in create mode =====
  it('2a. Create mode renders .mcp-quickadd-row', async () => {
    mountModal({ server: null })
    await macroFlush()
    expect(document.querySelector('.sk-modal .mcp-quickadd-row')).not.toBeNull()
  })

  it('2b. Edit mode does not render .mcp-quickadd-row (Vue2 :9 v-if="!isEdit")', async () => {
    mountModal({ server: makeServer() })
    await macroFlush()
    expect(document.querySelector('.sk-modal .mcp-quickadd-row')).toBeNull()
  })

  // ===== Coverage point 3: Three transport options =====
  it('3. Three .sk-trig-option labels correct; after clicking STDIO, data-active moves to it', async () => {
    mountModal({ server: null })
    await macroFlush()
    const opts = trigOptions()
    expect(opts).toHaveLength(3)
    expect(opts[0].textContent).toContain(zh.aiMcpSrvTransportHttp)
    expect(opts[1].textContent).toContain(zh.aiMcpSrvTransportSse)
    expect(opts[2].textContent).toContain(zh.aiMcpSrvTransportStdio)
    expect(opts[0].dataset.active).toBe('true') // default transport: 'http'

    opts[2].click()
    await nextTick()
    expect(opts[2].dataset.active).toBe('true')
    expect(opts[0].dataset.active).toBe('false')
    expect(opts[1].dataset.active).toBe('false')
  })

  // ===== Coverage point 4: Fields switch by transport, two-case comparison =====
  it('4a. Stdio mode: has command/args/env-kv, no url/headers-kv', async () => {
    mountModal({ server: makeServer({ transport: 'stdio', command: 'npx' }) })
    await macroFlush()
    expect(document.querySelector('.sk-modal [data-f="command"]')).not.toBeNull()
    expect(document.querySelector('.sk-modal [data-f="args"]')).not.toBeNull()
    expect(document.querySelector('.sk-modal [data-kv="env"]')).not.toBeNull()
    expect(document.querySelector('.sk-modal [data-f="url"]')).toBeNull()
    expect(document.querySelector('.sk-modal [data-kv="headers"]')).toBeNull()
  })

  it('4b. HTTP mode: has url/headers-kv, no command/args/env-kv', async () => {
    mountModal({ server: makeServer({ transport: 'http' }) })
    await macroFlush()
    expect(document.querySelector('.sk-modal [data-f="url"]')).not.toBeNull()
    expect(document.querySelector('.sk-modal [data-kv="headers"]')).not.toBeNull()
    expect(document.querySelector('.sk-modal [data-f="command"]')).toBeNull()
    expect(document.querySelector('.sk-modal [data-f="args"]')).toBeNull()
    expect(document.querySelector('.sk-modal [data-kv="env"]')).toBeNull()
  })

  // ===== Coverage point 5: valid four independent assertions =====
  it('5a. Name empty → submit button disabled', async () => {
    mountModal({ server: null })
    await macroFlush()
    expect(submitBtn().disabled).toBe(true)
  })

  it('5b. Name filled but (http) URL empty → disabled', async () => {
    mountModal({ server: null })
    await macroFlush()
    setValue(nameInput(), 'my-server')
    await flush()
    expect(submitBtn().disabled).toBe(true)
  })

  it('5c. Name and URL both filled (http) → enabled', async () => {
    mountModal({ server: null })
    await macroFlush()
    setValue(nameInput(), 'my-server')
    setValue(urlInput(), 'https://x.example.com')
    await flush()
    expect(submitBtn().disabled).toBe(false)
  })

  it('5d. Stdio mode: URL empty but command filled → enabled', async () => {
    mountModal({ server: null })
    await macroFlush()
    trigOptions()[2].click() // switch to STDIO
    await nextTick()
    setValue(nameInput(), 'my-server')
    setValue(commandInput(), 'npx')
    await flush()
    expect(submitBtn().disabled).toBe(false)
  })

  // ===== Coverage point 6: KV editor =====
  it('6a. Clicking "add header" adds row; fill key/value; click delete removes row', async () => {
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

  it('6b. Rows with empty key are discarded by collect() on submit', async () => {
    const w = mountModal({ server: null })
    await macroFlush()
    setValue(nameInput(), 'svc')
    setValue(urlInput(), 'https://x.example.com')
    const addBtn = document.querySelector('.sk-modal [data-add="headers"]') as HTMLButtonElement
    addBtn.click(); addBtn.click()
    await nextTick()
    const rows = document.querySelectorAll('.sk-modal [data-kv="headers"] .mcp-kv-row')
    expect(rows).toHaveLength(2)
    // First row: both key/value filled; second row: key empty, only value filled
    setValue(rows[0].querySelector('[data-kvk]') as HTMLInputElement, 'Authorization')
    setValue(rows[0].querySelector('[data-kvv]') as HTMLInputElement, 'Bearer xyz')
    setValue(rows[1].querySelector('[data-kvv]') as HTMLInputElement, 'orphan-value')
    await flush()

    submitBtn().click()
    await flush()
    const payload = w.emitted('save')![0][0] as Record<string, unknown>
    expect(payload.headers).toEqual({ Authorization: 'Bearer xyz' })
  })

  // ===== Coverage point 7: Submit payload shape =====
  it('7a. Stdio submit payload shape: args split by line + trim + remove empty lines', async () => {
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

  it('7b. HTTP submit payload shape: {name, transport:"http", enabled, url, headers:{…}}', async () => {
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

  // ===== Coverage point 8: Edit mode without KV rows omits field, two cases =====
  it('8a. Create mode includes env:{} even if KV empty (stdio)', async () => {
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

  it('8b. Edit mode with empty env omits env key (Vue2 :206 condition)', async () => {
    const server = makeServer({ id: 3, transport: 'stdio', command: 'npx', args: [], has_env: false })
    const w = mountModal({ server })
    await macroFlush()
    // Name/command already filled from server, submit directly
    submitBtn().click()
    await flush()
    const payload = w.emitted('save')![0][0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('env')
  })

  // ===== Coverage point 9: Edit mode with has_headers=true → shows .mcp-kv-hint =====
  it('9a. Edit mode + has_headers=true → shows .mcp-kv-hint', async () => {
    mountModal({ server: makeServer({ transport: 'http', has_headers: true }) })
    await macroFlush()
    const hint = document.querySelector('.sk-modal .mcp-kv-hint')
    expect(hint).not.toBeNull()
    expect(hint!.textContent).toBe(zh.aiMcpSrvKvHint)
  })

  it('9b. Create mode does not show .mcp-kv-hint (even with http)', async () => {
    mountModal({ server: null })
    await macroFlush()
    expect(document.querySelector('.sk-modal .mcp-kv-hint')).toBeNull()
  })

  // ===== Coverage point 10: Quick-paste single-layer response nail =====
  it('10. Quick-paste (single-layer response): bare Parsed return, after fill transport switches to stdio, command/args/env/name all filled', async () => {
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

  // ===== Coverage point 11: Quick-paste parsed as http =====
  it('11. Quick-paste parsed as http: url filled, command/args/env cleared', async () => {
    h.parseMCPCommand.mockResolvedValue({
      transport: 'http', command: '', args: [], env: {}, url: 'https://mcp.example.com', suggested_name: '',
    })
    mountModal({ server: null })
    await macroFlush()
    // Switch to stdio first and fill some fields, verify they clear after paste parsed as http
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

  // ===== Coverage point 12: suggested_name only fills when name is empty =====
  it('12a. When name is empty, quick-paste suggested_name fills in', async () => {
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

  it('12b. When name already filled, suggested_name does not override', async () => {
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

  // ===== Coverage point 13: Parse failure → localized text, no backend English strings =====
  it('13. Parse failure → .mcp-quickadd-err shows localized text, no backend English strings', async () => {
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
