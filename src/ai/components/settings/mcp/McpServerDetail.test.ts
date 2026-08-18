import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import zh from '../../../../i18n/zh_cn'
import McpServerDetail from './McpServerDetail.vue'
import type { McpServer } from '../../../types/mcpServer'

// SP8-P4 Task 6 —— Align with Vue2 src/views/AI/MCP/McpServerDetail.vue (174 lines)
// lines 1-157.
// SP8-P4 Task 7 —— Add the entire "Test Connection" section: button :50-53, result panel :87-100,
// runTest :158-171, including D8 (localized errors + collapsible technical details) and D11 (in-flight request race guard).
// Shared constraint §9: After reka Teleport component mounts, await nextTick() before querying document;
// for async assertions use flushPromises() instead of single await nextTick().

// vi.hoisted avoids ESM hoisting's TDZ (shared constraint §9 precedent agentStore.test.ts:4-19).
// Task 20 (mcp-progressive-disclosure plan) added `listMCPTools` alongside
// `testMCPServer` -- McpServerDetail.vue now loads the persisted tool list
// via `service.ai.listMCPTools` on mount / whenever `server.id` changes (see
// that file's `loadTools`/`toolsSeq` watch), so it must be mocked here too or
// every test in this file would hit an unmocked call. Nothing else is mocked --
// the remaining cases touch no network, so the whole `service.ai` namespace
// neither needs to be nor should be stubbed.
const h = vi.hoisted(() => ({ testMCPServer: vi.fn(), listMCPTools: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: h } }))

// Default: no tools, resolved immediately -- keeps every pre-existing test in
// this file exercising exactly what it exercised before Task 20 (empty
// McpToolList renders no rows and, since `showServerLevel` is always passed,
// just the server-level hint block). Tests that care about actual tool rows
// override this per-test.
//
// setActivePinia is also new here: McpToolList.vue calls `useToast()` (a
// Pinia store) to surface a rejected setMCPApproval -- this file had no
// Pinia dependency before Task 20 nested that component in.
beforeEach(() => {
  setActivePinia(createPinia())
  h.listMCPTools.mockReset()
  h.listMCPTools.mockResolvedValue({ tools: [], server_level_approved: false })
})

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

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

// T7 test cases use the `srv(...)` naming from the brief, equivalent to the existing `makeServer`—
// avoids duplicate fixture construction logic.
const srv = makeServer

// Delete confirmation dialog portals to `.set-app` (D6), test must first place a host with the same name in body,
// precedent: SkillDetail.test.ts::withHost().
function withHost(): HTMLElement {
  const host = document.createElement('div')
  host.className = 'set-app'
  document.body.appendChild(host)
  return host
}

const mountDetail = (server: McpServer | null) =>
  mount(McpServerDetail, {
    props: { server },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })

const flush = async () => { await flushPromises(); await nextTick() }

describe('McpServerDetail', () => {
  let host: HTMLElement

  beforeEach(() => {
    host = withHost()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  // ===== Coverage point 1: server === null =====
  it('1. When server=null, renders .sk-detail-empty with orb/empty-title/empty-sub', () => {
    const w = mountDetail(null)
    expect(w.find('.sk-detail-empty').exists()).toBe(true)
    expect(w.find('.orb').exists()).toBe(true)
    expect(w.find('.empty-title').text()).toBe('在左侧选择一个 MCP 服务')
    expect(w.find('.empty-sub').text()).toBe('或新增一个,通过 Model Context Protocol 给 Nimo 接入新工具。')
    expect(w.find('.sk-detail-bar').exists()).toBe(false)
  })

  // ===== Coverage point 2: Header bar =====
  it('2. When server exists, header bar contains SkillTile, name, and transport method in uppercase within <code>', () => {
    const w = mountDetail(makeServer({ name: 'brave-search', transport: 'http' }))
    expect(w.find('.sk-detail-bar').exists()).toBe(true)
    expect(w.findComponent({ name: 'SkillTile' }).exists()).toBe(true)
    expect(w.find('.sk-name span').text()).toBe('brave-search')
    expect(w.find('.sk-name code').text()).toBe('HTTP')
  })

  // ===== Coverage point 3: Toggle switch comparison =====
  it('3a. When enabled=true, .sw[data-on=true], clicking emits toggle(id,false)', async () => {
    const w = mountDetail(makeServer({ id: 7, enabled: true }))
    const sw = w.find('.sw')
    expect(sw.attributes('data-on')).toBe('true')
    await sw.trigger('click')
    expect(w.emitted('toggle')).toEqual([[7, false]])
  })

  it('3b. When enabled=false, .sw[data-on=false], clicking emits toggle(id,true)', async () => {
    const w = mountDetail(makeServer({ id: 7, enabled: false }))
    const sw = w.find('.sw')
    expect(sw.attributes('data-on')).toBe('false')
    await sw.trigger('click')
    expect(w.emitted('toggle')).toEqual([[7, true]])
  })

  // ===== Coverage point 4: Metadata 4 cells, headers cell only renders for non-stdio =====
  it('4a. When transport=stdio, metadata has only 3 cells, no headers cell', () => {
    const w = mountDetail(makeServer({ transport: 'stdio' }))
    const cells = w.findAll('.sk-meta-cell')
    expect(cells).toHaveLength(3)
    const labels = cells.map((c) => c.find('.lbl').text())
    expect(labels).toEqual(['状态', '传输', '环境变量'])
  })

  it('4b. When transport!==stdio, metadata has 4 cells, including headers cell', () => {
    const w = mountDetail(makeServer({ transport: 'http' }))
    const cells = w.findAll('.sk-meta-cell')
    expect(cells).toHaveLength(4)
    const labels = cells.map((c) => c.find('.lbl').text())
    expect(labels).toEqual(['状态', '传输', '请求头', '环境变量'])
  })

  // ===== Coverage point 5: Status cell two states + dot has no style =====
  it('5a. When enabled=true: .val has no data-disabled=true, correct text content, dot has no style attribute', () => {
    const w = mountDetail(makeServer({ enabled: true }))
    const statusVal = w.findAll('.sk-meta-cell')[0].find('.val')
    expect(statusVal.attributes('data-disabled')).toBe('false')
    expect(statusVal.text()).toContain('启用')
    expect(statusVal.find('.dot').attributes('style')).toBeUndefined()
  })

  it('5b. When enabled=false: .val[data-disabled=true], correct text content, dot has no style attribute', () => {
    const w = mountDetail(makeServer({ enabled: false }))
    const statusVal = w.findAll('.sk-meta-cell')[0].find('.val')
    expect(statusVal.attributes('data-disabled')).toBe('true')
    expect(statusVal.text()).toContain('未启用')
    expect(statusVal.find('.dot').attributes('style')).toBeUndefined()
  })

  // ===== Coverage point 6: Stdio config section =====
  it('6a. Stdio config section: command/args (space-joined)/environment variables in three rows', () => {
    const w = mountDetail(makeServer({
      transport: 'stdio', command: 'npx', args: ['-y', '@upstash/context7-mcp'], has_env: true,
    }))
    const rows = w.findAll('.mcp-config-row')
    expect(rows).toHaveLength(3)
    expect(rows[0].find('.lbl').text()).toBe('命令')
    expect(rows[0].find('.mcp-code').text()).toBe('npx')
    expect(rows[1].find('.lbl').text()).toBe('参数')
    expect(rows[1].find('.mcp-code').text()).toBe('-y @upstash/context7-mcp')
    expect(rows[2].find('.lbl').text()).toBe('环境变量')
    expect(rows[2].find('.val').text()).toBe('已配置(已隐藏)')
  })

  it('6b. Stdio config section: when args is empty array, args cell displays empty status', () => {
    const w = mountDetail(makeServer({ transport: 'stdio', command: 'npx', args: [] }))
    const rows = w.findAll('.mcp-config-row')
    expect(rows[1].find('.mcp-code').text()).toBe('无')
  })

  // ===== Coverage point 7: Non-stdio config section =====
  it('7a. Non-stdio config section: endpoint URL/headers/environment variables in three rows, has_headers=true shows configured status', () => {
    const w = mountDetail(makeServer({
      transport: 'http', url: 'https://x.example.com', has_headers: true, has_env: false,
    }))
    const rows = w.findAll('.mcp-config-row')
    expect(rows).toHaveLength(3)
    expect(rows[0].find('.lbl').text()).toBe('端点 URL')
    expect(rows[0].find('.mcp-code').text()).toBe('https://x.example.com')
    expect(rows[1].find('.lbl').text()).toBe('请求头')
    expect(rows[1].find('.val').text()).toBe('已配置(已隐藏)')
    expect(rows[2].find('.val').text()).toBe('无')
  })

  it('7b. Non-stdio config section: when has_headers=false, headers cell displays empty status', () => {
    const w = mountDetail(makeServer({ transport: 'http', has_headers: false }))
    const rows = w.findAll('.mcp-config-row')
    expect(rows[1].find('.val').text()).toBe('无')
  })

  // ===== Coverage point 8: More menu =====
  it('8a. More menu: initially .sk-menu not rendered, renders after clicking .sk-pill-more', async () => {
    const w = mountDetail(makeServer())
    expect(w.find('.sk-menu').exists()).toBe(false)
    await w.find('.sk-pill-more').trigger('click')
    expect(w.find('.sk-menu').exists()).toBe(true)
  })

  it('8b. Clicking "edit config" emits edit(server) and menu closes', async () => {
    const server = makeServer({ id: 3, name: 'foo' })
    const w = mountDetail(server)
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[0].trigger('click')
    expect(w.emitted('edit')).toEqual([[server]])
    expect(w.find('.sk-menu').exists()).toBe(false)
  })

  it('8c. Document mousedown outside menu closes menu', async () => {
    const w = mountDetail(makeServer())
    await w.find('.sk-pill-more').trigger('click')
    expect(w.find('.sk-menu').exists()).toBe(true)
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flush()
    expect(w.find('.sk-menu').exists()).toBe(false)
  })

  it('8d. Comparison: mousedown inside menu does not close menu', async () => {
    const w = mountDetail(makeServer())
    await w.find('.sk-pill-more').trigger('click')
    expect(w.find('.sk-menu').exists()).toBe(true)
    w.find('.sk-menu button').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flush()
    expect(w.find('.sk-menu').exists()).toBe(true)
  })

  // ===== Coverage point 9: Delete confirmation =====
  it('9a. Clicking "remove service": menu closes, confirmation dialog opens (portals to .set-app)', async () => {
    const w = mountDetail(makeServer())
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[1].trigger('click')
    await flush()
    expect(w.find('.sk-menu').exists()).toBe(false)
    expect(host.querySelector('.sk-confirm')).not.toBeNull()
    expect(host.querySelector('.sk-confirm')!.closest('.set-app')).toBe(host)
  })

  it('9b. Clicking "remove" emits delete(id) and dialog closes', async () => {
    const w = mountDetail(makeServer({ id: 9 }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[1].trigger('click')
    await flush()
    const confirmBtn = host.querySelector('.sk-btn.danger') as HTMLButtonElement
    confirmBtn.click()
    await flush()
    expect(w.emitted('delete')).toEqual([[9]])
    expect(host.querySelector('.sk-confirm')).toBeNull()
  })

  it('9c. Clicking "cancel" does not emit delete, dialog closes', async () => {
    const w = mountDetail(makeServer())
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[1].trigger('click')
    await flush()
    const cancelBtn = host.querySelector('.sk-btn.ghost') as HTMLButtonElement
    cancelBtn.click()
    await flush()
    expect(w.emitted('delete')).toBeUndefined()
    expect(host.querySelector('.sk-confirm')).toBeNull()
  })

  // ===== Coverage point 10: Switch server.id =====
  it('10a. When menu is open and server.id switches, menu auto-closes', async () => {
    const w = mountDetail(makeServer({ id: 1 }))
    await w.find('.sk-pill-more').trigger('click')
    expect(w.find('.sk-menu').exists()).toBe(true)
    await w.setProps({ server: makeServer({ id: 2 }) })
    await flush()
    expect(w.find('.sk-menu').exists()).toBe(false)
  })

  it('10b. When confirmation dialog is open and server.id switches, dialog auto-closes', async () => {
    const w = mountDetail(makeServer({ id: 1 }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[1].trigger('click')
    await flush()
    expect(host.querySelector('.sk-confirm')).not.toBeNull()
    await w.setProps({ server: makeServer({ id: 2 }) })
    await flush()
    expect(host.querySelector('.sk-confirm')).toBeNull()
  })
})

// SP8-P4 Task 7 —— Test Connection: three states (idle/testing/result), D8 (localized errors + collapsible
// technical details), D11 (in-flight request race guard). Complete test cases from task spec Step 1, transcribed as-is.
describe('Test Connection', () => {
  beforeEach(() => { h.testMCPServer.mockReset() })

  it('Clicking button enters testing state: button disabled, text changes to testing status, spinner appears', async () => {
    let resolve!: (v: unknown) => void
    h.testMCPServer.mockReturnValue(new Promise((r) => { resolve = r }))
    const w = mountDetail(srv({ id: 5 }))
    await w.find('.mcp-test-btn').trigger('click')
    await nextTick()
    expect(w.find('.mcp-test-btn').attributes('disabled')).toBeDefined()
    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTesting)
    expect(w.find('.mcp-test-btn .sk-spinner').exists()).toBe(true)
    resolve({ ok: true, tool_count: 0, tools: [] })
    await flushPromises()
  })

  it('90-second hint shows for stdio only, not for http (two-mount comparison)', async () => {
    h.testMCPServer.mockReturnValue(new Promise(() => {}))
    const a = mountDetail(srv({ transport: 'stdio', command: 'npx' }))
    await a.find('.mcp-test-btn').trigger('click'); await nextTick()
    expect(a.find('.mcp-test-hint').exists()).toBe(true)
    const b = mountDetail(srv({ transport: 'http' }))
    await b.find('.mcp-test-btn').trigger('click'); await nextTick()
    expect(b.find('.mcp-test-hint').exists()).toBe(false)
  })

  // Single-layer response nail: mock is **bare object**. If implementation adds extra .data layer, this fails.
  it('Success: single-layer response, displays connected · N tools + tool chips', async () => {
    h.testMCPServer.mockResolvedValue({ ok: true, tool_count: 2, tools: ['search', 'fetch'] })
    const w = mountDetail(srv({ id: 5 }))
    await w.find('.mcp-test-btn').trigger('click')
    await flushPromises()
    expect(h.testMCPServer).toHaveBeenCalledWith(5)
    expect(w.find('.mcp-test-result').attributes('data-ok')).toBe('true')
    expect(w.find('.mcp-test-line').text()).toContain('已连接 · 2 个工具')
    expect(w.findAll('.mcp-tool-chip').map((c) => c.text())).toEqual(['search', 'fetch'])
    expect(w.find('.mcp-test-detail').exists()).toBe(false)
  })

  it('Failure: displays localized text, backend error strings do not appear on page', async () => {
    h.testMCPServer.mockResolvedValue({
      ok: false, error_key: 'connect_failed',
      error: 'Connection failed: All connection attempts failed',
      detail: 'All connection attempts failed',
    })
    const w = mountDetail(srv())
    await w.find('.mcp-test-btn').trigger('click')
    await flushPromises()
    expect(w.find('.mcp-test-result').attributes('data-ok')).toBe('false')
    expect(w.find('.mcp-test-line').text()).toContain(zh.aiMcpSrvTestErrConnect)
    expect(w.text()).not.toContain('Connection failed: All connection attempts failed')
  })

  it('Detail section renders only if non-empty, and defaults to collapsed (no open attribute)', async () => {
    h.testMCPServer.mockResolvedValue({ ok: false, error_key: 'connect_failed', detail: 'ENOENT npx' })
    const w = mountDetail(srv())
    await w.find('.mcp-test-btn').trigger('click')
    await flushPromises()
    const d = w.find('.mcp-test-detail')
    expect(d.exists()).toBe(true)
    expect(d.attributes('open')).toBeUndefined()
    expect(d.find('summary').text()).toBe(zh.aiMcpSrvTestDetail)
    expect(d.find('pre').text()).toBe('ENOENT npx')
  })

  it('Detail section does not render when empty (comparison case)', async () => {
    h.testMCPServer.mockResolvedValue({ ok: false, error_key: 'probe_timeout' })
    const w = mountDetail(srv())
    await w.find('.mcp-test-btn').trigger('click')
    await flushPromises()
    expect(w.find('.mcp-test-line').text()).toContain(zh.aiMcpSrvTestErrTimeout)
    expect(w.find('.mcp-test-detail').exists()).toBe(false)
  })

  it('502 agent unreachable (error path) → specialized text, backend body not shown', async () => {
    h.testMCPServer.mockRejectedValue(
      Object.assign(new Error('x'), { response: { status: 502, data: { ok: false, error: 'agent unreachable' } } }),
    )
    const w = mountDetail(srv())
    await w.find('.mcp-test-btn').trigger('click')
    await flushPromises()
    expect(w.find('.mcp-test-line').text()).toContain(zh.aiMcpSrvTestErrAgentDown)
    expect(w.text()).not.toContain('agent unreachable')
  })

  it('Repeated clicks during testing do not send multiple requests (Vue2 :159 guard if (!this.server || this.testing) return)', async () => {
    h.testMCPServer.mockReturnValue(new Promise(() => {}))
    const w = mountDetail(srv())
    await w.find('.mcp-test-btn').trigger('click')
    await w.find('.mcp-test-btn').trigger('click')
    await w.find('.mcp-test-btn').trigger('click')
    expect(h.testMCPServer).toHaveBeenCalledTimes(1)
  })

  it('When switching servers, clear testing state and results', async () => {
    h.testMCPServer.mockResolvedValue({ ok: true, tool_count: 1, tools: ['a'] })
    const w = mountDetail(srv({ id: 1 }))
    await w.find('.mcp-test-btn').trigger('click')
    await flushPromises()
    expect(w.find('.mcp-test-result').exists()).toBe(true)
    await w.setProps({ server: srv({ id: 2, name: 'other' }) })
    await nextTick()
    expect(w.find('.mcp-test-result').exists()).toBe(false)
  })

  // ★ D11 race condition guard —— core nail of this task.
  // Weak assertion (only checking "result panel absent") naturally holds after switch, cannot catch race;
  // must allow old request to land **after** switch, then assert panel is still empty.
  it('D11: In-flight request landing after switching to another server discards result (no crosstalk)', async () => {
    let resolveOld!: (v: unknown) => void
    h.testMCPServer.mockReturnValueOnce(new Promise((r) => { resolveOld = r }))
    const w = mountDetail(srv({ id: 1, name: 'old' }))
    await w.find('.mcp-test-btn').trigger('click')
    await nextTick()
    // Switch to another server
    await w.setProps({ server: srv({ id: 2, name: 'new' }) })
    await nextTick()
    // Old request now lands, and is "success"—without guard, would display success on new server panel
    resolveOld({ ok: true, tool_count: 9, tools: ['leaked'] })
    await flushPromises()
    expect(w.find('.mcp-test-result').exists()).toBe(false)
    expect(w.text()).not.toContain('leaked')
    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTest) // button text reset, not stuck in testing state
  })

  it('D11 comparison: results land normally without switch (guard does not block normal path)', async () => {
    let resolveIt!: (v: unknown) => void
    h.testMCPServer.mockReturnValueOnce(new Promise((r) => { resolveIt = r }))
    const w = mountDetail(srv({ id: 1 }))
    await w.find('.mcp-test-btn').trigger('click')
    await nextTick()
    resolveIt({ ok: true, tool_count: 1, tools: ['kept'] })
    await flushPromises()
    expect(w.find('.mcp-test-result').attributes('data-ok')).toBe('true')
    expect(w.text()).toContain('kept')
  })

  // ★ finally guard discriminant case (important review patch).
  // Only the scenario "old request lands while new test round in progress" can distinguish "seq guard present" vs
  // "seq guard absent"—because only then would testing be wrongly reset to false by old request.
  // Timeline: server1 click test (pending) → switch to server2 → server2 click test (pending, testing=true)
  // → then old request from server1 lands → assert UI still in testing state, button still disabled,
  // result panel still absent. If finally branch unconditionally `testing.value = false` (without
  // seq check), old request landing would reset testing to false, this would fail.
  it('finally guard: old request successful landing while new test round in progress does not reset testing to false', async () => {
    let resolveOld!: (v: unknown) => void
    h.testMCPServer.mockReturnValueOnce(new Promise((r) => { resolveOld = r }))
    const w = mountDetail(srv({ id: 1, name: 'old' }))
    await w.find('.mcp-test-btn').trigger('click')
    await nextTick()
    await w.setProps({ server: srv({ id: 2, name: 'new' }) })
    await nextTick()
    h.testMCPServer.mockReturnValueOnce(new Promise(() => {})) // new round pending, doesn't land
    await w.find('.mcp-test-btn').trigger('click')
    await nextTick()
    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTesting)
    // Old request (server1) now successfully lands
    resolveOld({ ok: true, tool_count: 3, tools: ['leaked-ok'] })
    await flushPromises()
    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTesting)
    expect(w.find('.mcp-test-btn').attributes('disabled')).toBeDefined()
    expect(w.find('.mcp-test-result').exists()).toBe(false)
  })

  // #141: which MCP protocol version the server negotiated.
  it('modern era with two versions declared → "protocol 2025-06-18 · also supports 2024-11-05", tagged .mcp-test-proto without .is-legacy', async () => {
    h.testMCPServer.mockResolvedValue({
      ok: true, tool_count: 1, tools: ['a'],
      protocol_era: 'modern', protocol_version: '2025-06-18',
      supported_versions: ['2025-06-18', '2024-11-05'],
    })
    const w = mountDetail(srv())
    await w.find('.mcp-test-btn').trigger('click')
    await flushPromises()
    const proto = w.find('.mcp-test-proto')
    expect(proto.exists()).toBe(true)
    expect(proto.text()).toBe('协议 2025-06-18 · 另支持 2024-11-05') // keep Chinese UI text
    expect(proto.classes()).not.toContain('is-legacy')
  })

  it('legacy era → element carries .is-legacy', async () => {
    h.testMCPServer.mockResolvedValue({
      ok: true, tool_count: 1, tools: ['a'],
      protocol_era: 'legacy', protocol_version: '2024-11-05',
      supported_versions: ['2024-11-05'],
    })
    const w = mountDetail(srv())
    await w.find('.mcp-test-btn').trigger('click')
    await flushPromises()
    expect(w.find('.mcp-test-proto').classes()).toContain('is-legacy')
  })

  it('unknown era → .mcp-test-proto absent, and "undefined" never appears anywhere on the page', async () => {
    h.testMCPServer.mockResolvedValue({
      ok: true, tool_count: 1, tools: ['a'],
      protocol_era: 'unknown', protocol_version: '2025-06-18',
      supported_versions: ['2025-06-18'],
    })
    const w = mountDetail(srv())
    await w.find('.mcp-test-btn').trigger('click')
    await flushPromises()
    expect(w.find('.mcp-test-proto').exists()).toBe(false)
    expect(w.text()).not.toContain('undefined')
  })

  // #141: the backend that ships today (NimoOS-AI main, confirmed by grep over
  // agent/mcp_client/client.py::test_server) never sends protocol_era /
  // protocol_version / supported_versions at all -- this is the DEFAULT shape,
  // not a hypothetical edge case, so it needs its own case rather than being
  // inferred from the "modern"/"legacy"/"unknown" cases above (which all pass
  // an explicit protocol_era).
  it('success response entirely omitting the protocol fields (today\'s real backend shape) → .mcp-test-proto absent, no "undefined" anywhere', async () => {
    h.testMCPServer.mockResolvedValue({ ok: true, tool_count: 2, tools: ['search', 'fetch'] })
    const w = mountDetail(srv())
    await w.find('.mcp-test-btn').trigger('click')
    await flushPromises()
    expect(w.find('.mcp-test-result').attributes('data-ok')).toBe('true')
    expect(w.find('.mcp-test-proto').exists()).toBe(false)
    expect(w.text()).not.toContain('undefined')
  })

  it('finally guard: old request error landing while new test round in progress does not reset testing to false', async () => {
    let rejectOld!: (e: unknown) => void
    h.testMCPServer.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectOld = reject }))
    const w = mountDetail(srv({ id: 1, name: 'old' }))
    await w.find('.mcp-test-btn').trigger('click')
    await nextTick()
    await w.setProps({ server: srv({ id: 2, name: 'new' }) })
    await nextTick()
    h.testMCPServer.mockReturnValueOnce(new Promise(() => {})) // new round pending, doesn't land
    await w.find('.mcp-test-btn').trigger('click')
    await nextTick()
    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTesting)
    // Old request (server1) now throws error and lands
    rejectOld(Object.assign(new Error('boom'), { response: { status: 500, data: {} } }))
    await flushPromises()
    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTesting)
    expect(w.find('.mcp-test-btn').attributes('disabled')).toBeDefined()
    expect(w.find('.mcp-test-result').exists()).toBe(false)
  })
})

// Task 20 fix round (review point F): dedicated coverage for the tool-list
// loading logic added to this component -- until now only the harness
// (mocking listMCPTools so pre-existing tests keep passing) was touched,
// with no test exercising loadTools/toolsSeq itself.
function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}

describe('tool list loading (Task 20)', () => {
  it('calls listMCPTools with the selected server id on mount', async () => {
    mountDetail(srv({ id: 42 }))
    await flushPromises()
    expect(h.listMCPTools).toHaveBeenCalledWith(42)
  })

  it('calls listMCPTools again with the new id when the selected server changes', async () => {
    const w = mountDetail(srv({ id: 1 }))
    await flushPromises()
    h.listMCPTools.mockClear()
    await w.setProps({ server: srv({ id: 7, name: 'other' }) })
    await flushPromises()
    expect(h.listMCPTools).toHaveBeenCalledWith(7)
  })

  it('shows a loading spinner while listMCPTools is in flight, then renders the tool list once it resolves', async () => {
    let resolve!: (v: unknown) => void
    h.listMCPTools.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    const w = mountDetail(srv({ id: 1 }))
    await nextTick()
    expect(w.find('[data-test=tools-loading]').exists()).toBe(true)
    expect(w.findComponent({ name: 'McpToolList' }).exists()).toBe(false)
    resolve({ tools: [], server_level_approved: false })
    await flushPromises()
    expect(w.find('[data-test=tools-loading]').exists()).toBe(false)
    expect(w.findComponent({ name: 'McpToolList' }).exists()).toBe(true)
  })

  it('renders the tools listMCPTools resolves with', async () => {
    h.listMCPTools.mockResolvedValueOnce({
      tools: [{ name: 'create_issue', approved: true, last_seen_at: nowSec(), desc_changed: false }],
      server_level_approved: false,
    })
    const w = mountDetail(srv({ id: 1 }))
    await flushPromises()
    expect(w.find('[data-test=tool-row-create_issue]').exists()).toBe(true)
  })

  // ★ The safety-critical guard named in this component's own comments:
  // switching servers while a listMCPTools call is still in flight must not
  // let the old server's tools land in the new server's panel. A weak
  // assertion (only checking the panel is non-empty) would pass even without
  // the guard; this one lets the stale request land AFTER the switch, which
  // only a real seq-based guard survives.
  it('discards a stale listMCPTools response after switching to a different server', async () => {
    let resolveOld!: (v: unknown) => void
    h.listMCPTools.mockReturnValueOnce(new Promise((r) => { resolveOld = r }))
    const w = mountDetail(srv({ id: 1, name: 'old' }))
    await nextTick()

    h.listMCPTools.mockResolvedValueOnce({
      tools: [{ name: 'fresh-tool', approved: false, last_seen_at: nowSec(), desc_changed: false }],
      server_level_approved: false,
    })
    await w.setProps({ server: srv({ id: 2, name: 'new' }) })
    await flushPromises()
    expect(w.find('[data-test=tool-row-fresh-tool]').exists()).toBe(true)

    // The old server's request now lands late, with a tool that must never
    // appear in the (now server-2) panel.
    resolveOld({
      tools: [{ name: 'leaked-tool', approved: true, last_seen_at: nowSec(), desc_changed: false }],
      server_level_approved: false,
    })
    await flushPromises()
    expect(w.find('[data-test=tool-row-leaked-tool]').exists()).toBe(false)
    expect(w.find('[data-test=tool-row-fresh-tool]').exists()).toBe(true)
  })

  // D11-style control: without the guard, this would also pass by accident
  // (nothing switched), so it doesn't by itself prove the guard works -- but
  // it does prove the guard doesn't wrongly discard a normal, unswitched load.
  it('control: a normal (unswitched) listMCPTools response is not discarded', async () => {
    h.listMCPTools.mockResolvedValueOnce({
      tools: [{ name: 'kept-tool', approved: true, last_seen_at: nowSec(), desc_changed: false }],
      server_level_approved: false,
    })
    const w = mountDetail(srv({ id: 1 }))
    await flushPromises()
    expect(w.find('[data-test=tool-row-kept-tool]').exists()).toBe(true)
  })
})
