import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import McpServerDetail from './McpServerDetail.vue'
import type { McpServer } from '../../../types/mcpServer'

// SP8-P4 Task 6 —— 对齐 Vue2 src/views/AI/MCP/McpServerDetail.vue(174 行)的
// :1-157(跳过 T7 范围:测试连接按钮 :50-53、结果面板 :87-100、runTest :158-171)。
// 公共约束 §9:reka Teleport 组件挂载后先 await nextTick() 再查 document;
// 异步断言用 flushPromises() 不用单个 await nextTick()。

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
