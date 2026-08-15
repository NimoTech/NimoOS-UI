import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import zh from '../../../../i18n/zh_cn'
import McpServerDetail from './McpServerDetail.vue'
import type { McpServer } from '../../../types/mcpServer'

// SP8-P4 Task 6 —— 对齐 Vue2 src/views/AI/MCP/McpServerDetail.vue(174 行)的
// :1-157。
// SP8-P4 Task 7 —— 补上「测试连接」整段:按钮 :50-53、结果面板 :87-100、
// runTest :158-171,含 D8(本地化错误 + 折叠技术详情)与 D11(在途请求竞态守卫)。
// 公共约束 §9:reka Teleport 组件挂载后先 await nextTick() 再查 document;
// 异步断言用 flushPromises() 不用单个 await nextTick()。

// vi.hoisted 避免 ESM 提升的 TDZ(公共约束 §9 先例 agentStore.test.ts:4-19)。
// Task 20 (mcp-progressive-disclosure plan) added `listMCPTools` alongside
// `testMCPServer` -- McpServerDetail.vue now loads the persisted tool list
// via `service.ai.listMCPTools` on mount / whenever `server.id` changes (see
// that file's `loadTools`/`toolsSeq` watch), so it must be mocked here too or
// every test in this file would hit an unmocked call.
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
  h.listMCPTools.mockResolvedValue({ tools: [] })
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

// T7 用例沿用 brief 里的 `srv(...)` 命名,等价于既有的 `makeServer`——避免两份
// 重复的 fixture 构造逻辑。
const srv = makeServer

// 删除确认弹窗 portal 到 `.set-app`(D6),测试须先在 body 里放同名宿主,
// 先例 SkillDetail.test.ts::withHost()。
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

  // ===== 覆盖点 1:server === null =====
  it('1. server=null 时渲染 .sk-detail-empty,含 orb/empty-title/empty-sub', () => {
    const w = mountDetail(null)
    expect(w.find('.sk-detail-empty').exists()).toBe(true)
    expect(w.find('.orb').exists()).toBe(true)
    expect(w.find('.empty-title').text()).toBe('在左侧选择一个 MCP 服务')
    expect(w.find('.empty-sub').text()).toBe('或新增一个,通过 Model Context Protocol 给 Nimo 接入新工具。')
    expect(w.find('.sk-detail-bar').exists()).toBe(false)
  })

  // ===== 覆盖点 2:顶栏 =====
  it('2. 有 server 时顶栏含 SkillTile、名称与 <code> 里的传输方式大写', () => {
    const w = mountDetail(makeServer({ name: 'brave-search', transport: 'http' }))
    expect(w.find('.sk-detail-bar').exists()).toBe(true)
    expect(w.findComponent({ name: 'SkillTile' }).exists()).toBe(true)
    expect(w.find('.sk-name span').text()).toBe('brave-search')
    expect(w.find('.sk-name code').text()).toBe('HTTP')
  })

  // ===== 覆盖点 3:开关两项对照 =====
  it('3a. enabled=true 时 .sw[data-on=true],点击 emit toggle(id,false)', async () => {
    const w = mountDetail(makeServer({ id: 7, enabled: true }))
    const sw = w.find('.sw')
    expect(sw.attributes('data-on')).toBe('true')
    await sw.trigger('click')
    expect(w.emitted('toggle')).toEqual([[7, false]])
  })

  it('3b. enabled=false 时 .sw[data-on=false],点击 emit toggle(id,true)', async () => {
    const w = mountDetail(makeServer({ id: 7, enabled: false }))
    const sw = w.find('.sw')
    expect(sw.attributes('data-on')).toBe('false')
    await sw.trigger('click')
    expect(w.emitted('toggle')).toEqual([[7, true]])
  })

  // ===== 覆盖点 4:元信息 4 格,请求头格仅 non-stdio 渲染 =====
  it('4a. transport=stdio 时元信息只有 3 格,不含请求头格', () => {
    const w = mountDetail(makeServer({ transport: 'stdio' }))
    const cells = w.findAll('.sk-meta-cell')
    expect(cells).toHaveLength(3)
    const labels = cells.map((c) => c.find('.lbl').text())
    expect(labels).toEqual(['状态', '传输', '环境变量'])
  })

  it('4b. transport!==stdio 时元信息 4 格,含请求头格', () => {
    const w = mountDetail(makeServer({ transport: 'http' }))
    const cells = w.findAll('.sk-meta-cell')
    expect(cells).toHaveLength(4)
    const labels = cells.map((c) => c.find('.lbl').text())
    expect(labels).toEqual(['状态', '传输', '请求头', '环境变量'])
  })

  // ===== 覆盖点 5:状态格两态 + dot 无 style =====
  it('5a. enabled=true:.val 无 data-disabled=true,文案「启用」,dot 无 style 属性', () => {
    const w = mountDetail(makeServer({ enabled: true }))
    const statusVal = w.findAll('.sk-meta-cell')[0].find('.val')
    expect(statusVal.attributes('data-disabled')).toBe('false')
    expect(statusVal.text()).toContain('启用')
    expect(statusVal.find('.dot').attributes('style')).toBeUndefined()
  })

  it('5b. enabled=false:.val[data-disabled=true],文案「未启用」,dot 无 style 属性', () => {
    const w = mountDetail(makeServer({ enabled: false }))
    const statusVal = w.findAll('.sk-meta-cell')[0].find('.val')
    expect(statusVal.attributes('data-disabled')).toBe('true')
    expect(statusVal.text()).toContain('未启用')
    expect(statusVal.find('.dot').attributes('style')).toBeUndefined()
  })

  // ===== 覆盖点 6:stdio 配置区 =====
  it('6a. stdio 配置区:命令/参数(空格 join)/环境变量三行', () => {
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

  it('6b. stdio 配置区:args 为空数组时参数格显示「无」', () => {
    const w = mountDetail(makeServer({ transport: 'stdio', command: 'npx', args: [] }))
    const rows = w.findAll('.mcp-config-row')
    expect(rows[1].find('.mcp-code').text()).toBe('无')
  })

  // ===== 覆盖点 7:非 stdio 配置区 =====
  it('7a. 非 stdio 配置区:端点 URL/请求头/环境变量三行,has_headers=true 显示「已配置(已隐藏)」', () => {
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

  it('7b. 非 stdio 配置区:has_headers=false 时请求头格显示「无」', () => {
    const w = mountDetail(makeServer({ transport: 'http', has_headers: false }))
    const rows = w.findAll('.mcp-config-row')
    expect(rows[1].find('.val').text()).toBe('无')
  })

  // ===== 覆盖点 8:更多菜单 =====
  it('8a. 更多菜单:初始不渲染 .sk-menu,点击 .sk-pill-more 后渲染', async () => {
    const w = mountDetail(makeServer())
    expect(w.find('.sk-menu').exists()).toBe(false)
    await w.find('.sk-pill-more').trigger('click')
    expect(w.find('.sk-menu').exists()).toBe(true)
  })

  it('8b. 点「编辑配置」emit edit(server) 且菜单关闭', async () => {
    const server = makeServer({ id: 3, name: 'foo' })
    const w = mountDetail(server)
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[0].trigger('click')
    expect(w.emitted('edit')).toEqual([[server]])
    expect(w.find('.sk-menu').exists()).toBe(false)
  })

  it('8c. 文档 mousedown 在菜单外关闭菜单', async () => {
    const w = mountDetail(makeServer())
    await w.find('.sk-pill-more').trigger('click')
    expect(w.find('.sk-menu').exists()).toBe(true)
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flush()
    expect(w.find('.sk-menu').exists()).toBe(false)
  })

  it('8d. 对照:菜单内 mousedown 不关闭菜单', async () => {
    const w = mountDetail(makeServer())
    await w.find('.sk-pill-more').trigger('click')
    expect(w.find('.sk-menu').exists()).toBe(true)
    w.find('.sk-menu button').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flush()
    expect(w.find('.sk-menu').exists()).toBe(true)
  })

  // ===== 覆盖点 9:删除确认 =====
  it('9a. 点「移除服务」:菜单关闭,确认弹窗打开(portal 进 .set-app)', async () => {
    const w = mountDetail(makeServer())
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[1].trigger('click')
    await flush()
    expect(w.find('.sk-menu').exists()).toBe(false)
    expect(host.querySelector('.sk-confirm')).not.toBeNull()
    expect(host.querySelector('.sk-confirm')!.closest('.set-app')).toBe(host)
  })

  it('9b. 点「移除」emit delete(id) 且弹窗关闭', async () => {
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

  it('9c. 点「取消」不 emit delete,弹窗关闭', async () => {
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

  // ===== 覆盖点 10:切换 server.id =====
  it('10a. 菜单打开时切换 server.id,菜单自动关闭', async () => {
    const w = mountDetail(makeServer({ id: 1 }))
    await w.find('.sk-pill-more').trigger('click')
    expect(w.find('.sk-menu').exists()).toBe(true)
    await w.setProps({ server: makeServer({ id: 2 }) })
    await flush()
    expect(w.find('.sk-menu').exists()).toBe(false)
  })

  it('10b. 确认弹窗打开时切换 server.id,弹窗自动关闭', async () => {
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

// SP8-P4 Task 7 —— 测试连接:三态(idle/testing/result)、D8(本地化错误 + 折叠
// 技术详情)、D11(在途请求竞态守卫)。任务书 Step 1 给的完整用例,逐字照抄。
describe('测试连接', () => {
  beforeEach(() => { h.testMCPServer.mockReset() })

  it('点按钮进入 testing 态:按钮禁用、文案变「测试中…」、出现 spinner', async () => {
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

  it('stdio 才显示 90 秒提示,http 不显示(两次挂载对照)', async () => {
    h.testMCPServer.mockReturnValue(new Promise(() => {}))
    const a = mountDetail(srv({ transport: 'stdio', command: 'npx' }))
    await a.find('.mcp-test-btn').trigger('click'); await nextTick()
    expect(a.find('.mcp-test-hint').exists()).toBe(true)
    const b = mountDetail(srv({ transport: 'http' }))
    await b.find('.mcp-test-btn').trigger('click'); await nextTick()
    expect(b.find('.mcp-test-hint').exists()).toBe(false)
  })

  // 单层取数的钉子:mock 是**裸对象**。若实现多剥一层 .data,这条会红。
  it('成功:单层取数,显示已连接 · N 个工具 + 工具 chip', async () => {
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

  it('失败:显示本地化文案,后端 error 英文串不出现在界面上', async () => {
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

  it('detail 非空才渲染折叠区,且默认折叠(无 open 属性)', async () => {
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

  it('detail 为空时不渲染折叠区(对照)', async () => {
    h.testMCPServer.mockResolvedValue({ ok: false, error_key: 'probe_timeout' })
    const w = mountDetail(srv())
    await w.find('.mcp-test-btn').trigger('click')
    await flushPromises()
    expect(w.find('.mcp-test-line').text()).toContain(zh.aiMcpSrvTestErrTimeout)
    expect(w.find('.mcp-test-detail').exists()).toBe(false)
  })

  it('502 agent unreachable(抛错路径)→ 专用文案,不显示后端 body', async () => {
    h.testMCPServer.mockRejectedValue(
      Object.assign(new Error('x'), { response: { status: 502, data: { ok: false, error: 'agent unreachable' } } }),
    )
    const w = mountDetail(srv())
    await w.find('.mcp-test-btn').trigger('click')
    await flushPromises()
    expect(w.find('.mcp-test-line').text()).toContain(zh.aiMcpSrvTestErrAgentDown)
    expect(w.text()).not.toContain('agent unreachable')
  })

  it('testing 期间重复点击不重复发请求(Vue2 :159 的 if (!this.server || this.testing) return)', async () => {
    h.testMCPServer.mockReturnValue(new Promise(() => {}))
    const w = mountDetail(srv())
    await w.find('.mcp-test-btn').trigger('click')
    await w.find('.mcp-test-btn').trigger('click')
    await w.find('.mcp-test-btn').trigger('click')
    expect(h.testMCPServer).toHaveBeenCalledTimes(1)
  })

  it('切换服务器时清空 testing 与结果', async () => {
    h.testMCPServer.mockResolvedValue({ ok: true, tool_count: 1, tools: ['a'] })
    const w = mountDetail(srv({ id: 1 }))
    await w.find('.mcp-test-btn').trigger('click')
    await flushPromises()
    expect(w.find('.mcp-test-result').exists()).toBe(true)
    await w.setProps({ server: srv({ id: 2, name: 'other' }) })
    await nextTick()
    expect(w.find('.mcp-test-result').exists()).toBe(false)
  })

  // ★ D11 竞态守卫 —— 本任务的核心钉子。
  // 弱断言(只查「结果面板不存在」)在切换后本来就成立,抓不出竞态;必须让
  // 旧请求在切换**之后**才落地,再断言面板仍为空。
  it('D11:在途请求落地时若已切到别的服务器,结果被丢弃(不串台)', async () => {
    let resolveOld!: (v: unknown) => void
    h.testMCPServer.mockReturnValueOnce(new Promise((r) => { resolveOld = r }))
    const w = mountDetail(srv({ id: 1, name: 'old' }))
    await w.find('.mcp-test-btn').trigger('click')
    await nextTick()
    // 切到另一台服务器
    await w.setProps({ server: srv({ id: 2, name: 'new' }) })
    await nextTick()
    // 旧请求现在才落地,且是「成功」——若无守卫,会在新服务器面板上显示成功
    resolveOld({ ok: true, tool_count: 9, tools: ['leaked'] })
    await flushPromises()
    expect(w.find('.mcp-test-result').exists()).toBe(false)
    expect(w.text()).not.toContain('leaked')
    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTest) // 不卡在「测试中…」
  })

  it('D11 对照:未切换时结果正常落地(守卫不能把正常路径也挡掉)', async () => {
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

  // ★ finally 守卫的判别性用例(评审 Important 补丁)。
  // 只有「旧请求落地时,新一轮测试正在进行中」这个场景才能区分「有 seq 守卫」与
  // 「无 seq 守卫」——因为只有这时 testing 的值才会被旧请求错误地打回 false。
  // 时序:server1 点测试(悬挂)→ 切到 server2 → server2 点测试(悬挂,testing=true)
  // → 此时才让 server1 的旧请求落地 → 断言界面仍是「测试中…」、按钮仍 disabled、
  // 结果面板仍不存在。若 finally 分支是无条件 `testing.value = false`(去掉
  // seq 比对),旧请求落地会把 testing 打回 false,这条会红。
  it('finally 守卫:旧请求成功落地时若新一轮测试进行中,不会把 testing 打回 false', async () => {
    let resolveOld!: (v: unknown) => void
    h.testMCPServer.mockReturnValueOnce(new Promise((r) => { resolveOld = r }))
    const w = mountDetail(srv({ id: 1, name: 'old' }))
    await w.find('.mcp-test-btn').trigger('click')
    await nextTick()
    await w.setProps({ server: srv({ id: 2, name: 'new' }) })
    await nextTick()
    h.testMCPServer.mockReturnValueOnce(new Promise(() => {})) // 新一轮悬挂,不落地
    await w.find('.mcp-test-btn').trigger('click')
    await nextTick()
    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTesting)
    // 旧请求(server1)现在才成功落地
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
    expect(proto.text()).toBe('协议 2025-06-18 · 另支持 2024-11-05')
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

  it('finally 守卫:旧请求抛错落地时若新一轮测试进行中,不会把 testing 打回 false', async () => {
    let rejectOld!: (e: unknown) => void
    h.testMCPServer.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectOld = reject }))
    const w = mountDetail(srv({ id: 1, name: 'old' }))
    await w.find('.mcp-test-btn').trigger('click')
    await nextTick()
    await w.setProps({ server: srv({ id: 2, name: 'new' }) })
    await nextTick()
    h.testMCPServer.mockReturnValueOnce(new Promise(() => {})) // 新一轮悬挂,不落地
    await w.find('.mcp-test-btn').trigger('click')
    await nextTick()
    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTesting)
    // 旧请求(server1)现在才抛错落地
    rejectOld(Object.assign(new Error('boom'), { response: { status: 500, data: {} } }))
    await flushPromises()
    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTesting)
    expect(w.find('.mcp-test-btn').attributes('disabled')).toBeDefined()
    expect(w.find('.mcp-test-result').exists()).toBe(false)
  })
})
