import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import zh from '../../../../i18n/zh_cn'
import type { McpServer } from '../../../types/mcpServer'
import McpServerGroup from '../mcp/McpServerGroup.vue'
import McpServerDetail from '../mcp/McpServerDetail.vue'
import McpServerModal from '../mcp/McpServerModal.vue'

// SP8-P4 Task 9(收官)—— 对齐 Vue2 src/views/AI/MCP/McpSection.vue(136 行)。
// mock 骨架逐字照 brief §Step1「mock 骨架」段与公共约束 §9(vi.hoisted 避免 ESM
// 提升的 TDZ,先例 agentStore.test.ts:4-19)。
const h = vi.hoisted(() => ({
  listMCPServers: vi.fn(),
  createMCPServer: vi.fn(),
  updateMCPServer: vi.fn(),
  deleteMCPServer: vi.fn(),
  testMCPServer: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: h } }))

import McpSection from './McpSection.vue'
import { useToast } from '../../../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function withHost() {
  const host = document.createElement('div')
  host.className = 'set-app'
  document.body.appendChild(host)
  return host
}

function srv(id: number, overrides: Partial<McpServer> = {}): McpServer {
  return {
    id,
    name: `server-${id}`,
    transport: 'http',
    url: `https://example.com/mcp-${id}`,
    command: '',
    args: [],
    enabled: true,
    has_headers: false,
    has_env: false,
    ...overrides,
  }
}

const mountSection = () => mount(McpSection, { global: { plugins: [i18n] }, attachTo: document.body })
const flush = async () => { await nextTick(); await nextTick(); await nextTick() }
// McpServerModal 打开态聚焦用 setTimeout(fn, 0)(宏任务,见该组件头注释「reka 初始
// 焦点实测结论」),纯微任务级 flush() 追不上;先例 McpServerModal.test.ts::macroFlush。
const macroFlush = async () => { await flush(); await new Promise((r) => setTimeout(r, 0)); await flush() }

function modalNameInput() { return document.querySelector('.sk-modal [data-f="name"]') as HTMLInputElement }
function modalTitleEl() { return document.querySelector('.sk-modal .sk-modal-title') as HTMLElement }
function modalCloseBtn() { return document.querySelector('.sk-modal .sk-x') as HTMLButtonElement }
function modalSubmitBtn() { return document.querySelector('.sk-modal-foot .sk-btn.primary') as HTMLButtonElement }
function modalFieldErr() { return document.querySelector('.sk-modal .sk-field-err') as HTMLElement | null }
function setValue(el: HTMLInputElement, v: string) {
  el.value = v
  el.dispatchEvent(new Event('input'))
}

beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(h).forEach((fn) => fn.mockReset())
  h.listMCPServers.mockResolvedValue([])
  h.updateMCPServer.mockResolvedValue(undefined) // 204
  h.deleteMCPServer.mockResolvedValue(undefined) // 204
  h.createMCPServer.mockResolvedValue({ id: 7 })
  withHost()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('McpSection', () => {
  // ===== 覆盖点 1:reload 单层取数 + 首项自动选中 =====
  it('1. listMCPServers 返回裸数组 → 渲染两个分组条目,首项自动选中', async () => {
    h.listMCPServers.mockResolvedValue([srv(1), srv(2)])
    const w = mountSection()
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(2)
    // 首项(server-1)自动选中——详情面板展示它的名字。
    expect(w.find('.sk-name span').text()).toBe('server-1')
  })

  // ===== 覆盖点 2:reload 失败 =====
  it('2. listMCPServers 抛错 → toast.show(aiMcpSrvLoadFailed, 3000, danger)', async () => {
    h.listMCPServers.mockRejectedValue(new Error('boom'))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    expect(show).toHaveBeenCalledWith(zh.aiMcpSrvLoadFailed, 3000, 'danger')
  })

  // ===== 覆盖点 3:分组 =====
  it('3. enabled 进「已启用服务」,disabled 进「已停用服务」,两组都有时渲染两个 McpServerGroup', async () => {
    h.listMCPServers.mockResolvedValue([
      srv(1, { enabled: true }),
      srv(2, { enabled: false }),
    ])
    const w = mountSection()
    await flush()
    const groups = w.findAllComponents(McpServerGroup)
    expect(groups).toHaveLength(2)
    expect(groups[0].props('label')).toBe(zh.aiMcpSrvGroupEnabled)
    expect(groups[0].props('items').map((s: McpServer) => s.id)).toEqual([1])
    expect(groups[1].props('label')).toBe(zh.aiMcpSrvGroupDisabled)
    expect(groups[1].props('items').map((s: McpServer) => s.id)).toEqual([2])
  })

  // ===== 覆盖点 4:搜索(name/url 命中 + 两种空态) =====
  it('4a. 搜索按 name 命中', async () => {
    h.listMCPServers.mockResolvedValue([
      srv(1, { name: 'brave-search-token', url: 'https://a.example.com' }),
      srv(2, { name: 'notion', url: 'https://b.example.com' }),
    ])
    const w = mountSection()
    await flush()
    await w.find('.sk-col-search input').setValue('brave-search')
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(1)
    expect(w.find('.sk-item-name').text()).toBe('brave-search-token')
  })

  it('4b. 搜索按 url 命中', async () => {
    h.listMCPServers.mockResolvedValue([
      srv(1, { name: 'aaa', url: 'https://unique-url-token.example.com' }),
      srv(2, { name: 'bbb', url: 'https://other.example.com' }),
    ])
    const w = mountSection()
    await flush()
    await w.find('.sk-col-search input').setValue('unique-url-token')
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(1)
    expect(w.find('.sk-item-name').text()).toBe('aaa')
  })

  it('4c. 都不命中 → .sk-col-empty 显示 aiMcpSrvNoMatch + <code> 里是查询词', async () => {
    h.listMCPServers.mockResolvedValue([srv(1), srv(2)])
    const w = mountSection()
    await flush()
    await w.find('.sk-col-search input').setValue('nope-nothing-matches')
    await flush()
    expect(w.find('.sk-col-empty').text()).toContain(zh.aiMcpSrvNoMatch)
    expect(w.find('.sk-col-empty code').text()).toBe('nope-nothing-matches')
  })

  it('4d. 空列表且无查询词 → aiMcpSrvEmpty', async () => {
    h.listMCPServers.mockResolvedValue([])
    const w = mountSection()
    await flush()
    expect(w.find('.sk-col-empty').text()).toBe(zh.aiMcpSrvEmpty)
  })

  // ===== 覆盖点 5:搜索不清空右侧详情(N4 的钉子) =====
  it('5. 选中某项后输入匹配不到的查询词 → 列表空,但详情面板仍显示该服务器', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'alpha' }), srv(2, { name: 'beta' })])
    const w = mountSection()
    await flush()
    await w.findAll('.sk-item')[1].trigger('click')
    await flush()
    expect(w.find('.sk-name span').text()).toBe('beta')

    await w.find('.sk-col-search input').setValue('zzz-no-match')
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(0)
    expect(w.find('.sk-name span').text()).toBe('beta')
  })

  // ===== 覆盖点 6:onToggle(204 不读返回值 + 分组移动 + toast 对照 + 失败） =====
  it('6a. toggle 成功(enabled→disabled):204 不读返回值,列表项从已启用组移到已停用组,toast aiMcpSrvDisabledToast', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a', enabled: true })])
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('toggle', 1, false)
    await flush()

    expect(h.updateMCPServer).toHaveBeenCalledWith(1, { enabled: false })
    const groups = w.findAllComponents(McpServerGroup)
    expect(groups).toHaveLength(1)
    expect(groups[0].props('label')).toBe(zh.aiMcpSrvGroupDisabled)
    expect(show).toHaveBeenCalledWith(zh.aiMcpSrvDisabledToast)
  })

  it('6b. toggle 成功(disabled→enabled):toast aiMcpSrvEnabledToast(对照)', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a', enabled: false })])
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('toggle', 1, true)
    await flush()

    const groups = w.findAllComponents(McpServerGroup)
    expect(groups[0].props('label')).toBe(zh.aiMcpSrvGroupEnabled)
    expect(show).toHaveBeenCalledWith(zh.aiMcpSrvEnabledToast)
  })

  it('6c. toggle 失败 → toast aiMcpSrvUpdateFailed danger,列表不变', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a', enabled: true })])
    h.updateMCPServer.mockRejectedValue(new Error('boom'))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('toggle', 1, false)
    await flush()

    expect(show).toHaveBeenCalledWith(zh.aiMcpSrvUpdateFailed, 3000, 'danger')
    // 仍是 enabled,已启用组还在。
    const groups = w.findAllComponents(McpServerGroup)
    expect(groups[0].props('label')).toBe(zh.aiMcpSrvGroupEnabled)
  })

  // ===== 覆盖点 7:onDelete 成功/失败 =====
  it('7a. 删除成功 → 条目消失 + toast aiMcpSrvRemovedName(含名称)', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'to-remove' })])
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('delete', 1)
    await flush()

    expect(h.deleteMCPServer).toHaveBeenCalledWith(1)
    expect(w.findAll('.sk-item')).toHaveLength(0)
    expect(show).toHaveBeenCalledWith(zh.aiMcpSrvRemovedName.replace('{name}', 'to-remove'))
  })

  it('7b. 删除失败 → toast aiCfgDeleteFailed danger', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'stays' })])
    h.deleteMCPServer.mockRejectedValue(new Error('boom'))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('delete', 1)
    await flush()

    expect(show).toHaveBeenCalledWith(zh.aiCfgDeleteFailed, 3000, 'danger')
    expect(w.findAll('.sk-item')).toHaveLength(1)
  })

  // ===== 覆盖点 8:删除后选中项落位(两条对照)=====
  // 三项 fixture [a,b,c],先切到 c(不是删完后剩余列表[a,c]的第一项)——若条件被
  // 删/无条件回落 skills[0],activeId 会错误地跳成 a;条件生效则仍是 c。
  it('8a. 删的是当前选中项 → activeId 落到剩余第一项', async () => {
    h.listMCPServers.mockResolvedValue([
      srv(1, { name: 'svc-a' }), srv(2, { name: 'svc-b' }), srv(3, { name: 'svc-c' }),
    ])
    const w = mountSection()
    await flush()
    await w.findAll('.sk-item')[1].trigger('click') // 选中 b
    await flush()
    expect(w.find('.sk-name span').text()).toBe('svc-b')

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('delete', 2) // 删的正是当前选中的 b
    await flush()

    // 剩余 [a, c],第一项是 a。
    expect(w.find('.sk-name span').text()).toBe('svc-a')
  })

  it('8b. 删的不是当前选中项 → activeId 不动', async () => {
    h.listMCPServers.mockResolvedValue([
      srv(1, { name: 'svc-a' }), srv(2, { name: 'svc-b' }), srv(3, { name: 'svc-c' }),
    ])
    const w = mountSection()
    await flush()
    await w.findAll('.sk-item')[2].trigger('click') // 选中 c
    await flush()
    expect(w.find('.sk-name span').text()).toBe('svc-c')

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('delete', 2) // 删的是 b,不是当前选中的 c
    await flush()

    // 剩余 [a, c] 的第一项是 a——若无条件回落会错误跳成 a;正确实现应仍是 c。
    expect(w.findAll('.sk-item')).toHaveLength(2)
    expect(w.find('.sk-name span').text()).toBe('svc-c')
  })

  // ===== 覆盖点 9:onSave 新增单层取数 =====
  // 终审 Important I1(2026-07-31)—— 原 fixture 是「空列表 → 新建后单条」,即使
  // 实现写成 Vue2 式的双剥壳(`(created as any).data?.id` 恒 undefined),
  // `reload()` 里 `!activeId.value` 的兜底也会**恰好**选中那条唯一记录,53 条
  // 全绿,用例分辨不出对错(见终审 §5 RED 探针 A)。改成「新建前已有 2 条且已
  // 选中其中一条」——后端 `service/mcp.go:63` 是 `ORDER BY id` 升序,新建的
  // 服务器 id 最大,第二次 list 返回时排在**末尾**,不是 servers[0]。这样双剥壳
  // 缺陷下 `id` 恒 undefined、`activeId` 保持先前选中的 svc-b 不动(reload 的
  // `!activeId.value || !found` 兜底也不会触发,因为 svc-b 仍在新列表里)——
  // 断言精确报红;单层取数的正确实现下 `activeId` 在 onSave 里被直接设成 7,
  // 断言精确报绿。
  it('9. createMCPServer 返回裸 {id:7} → activeId 变 7(不是此前选中的项)+ toast aiMcpSrvAddedName + 弹窗关闭 + 重新加载一次', async () => {
    h.listMCPServers
      .mockResolvedValueOnce([srv(1, { name: 'svc-a' }), srv(2, { name: 'svc-b' })])
      .mockResolvedValueOnce([srv(1, { name: 'svc-a' }), srv(2, { name: 'svc-b' }), srv(7, { name: 'new-one' })])
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    expect(h.listMCPServers).toHaveBeenCalledTimes(1)

    // 真实场景的常态:新建前用户已经选中了某台服务器(不是空态)。
    await w.findAll('.sk-item')[1].trigger('click')
    await flush()
    expect(w.find('.sk-name span').text()).toBe('svc-b')

    await w.find('.sk-add-btn').trigger('click')
    await macroFlush()
    expect(modalTitleEl().textContent).toBe(zh.aiMcpSrvAdd)

    setValue(modalNameInput(), 'new-one')
    const urlInput = document.querySelector('.sk-modal [data-f="url"]') as HTMLInputElement
    setValue(urlInput, 'https://example.com/new')
    await flush()
    modalSubmitBtn().click()
    await flush()

    expect(h.createMCPServer).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.sk-modal')).toBeNull() // 弹窗已关
    expect(show).toHaveBeenCalledWith(zh.aiMcpSrvAddedName.replace('{name}', 'new-one'))
    expect(h.listMCPServers).toHaveBeenCalledTimes(2) // 触发一次重新加载
    // activeId 落在新建的 7 上,不是此前选中的 svc-b,也不是列表第一项 svc-a——
    // 双剥壳缺陷下这里会仍显示 svc-b(见上方用例头注释)。
    expect(w.find('.sk-name span').text()).toBe('new-one')
  })

  // ===== 覆盖点 10:onSave 编辑 =====
  it('10. 编辑保存 → 调 updateMCPServer(editingId, payload) + toast aiCfgSaved + 弹窗关', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a', url: 'https://a.example.com' })])
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('edit', srv(1, { name: 'svc-a', url: 'https://a.example.com' }))
    await macroFlush()
    expect(modalTitleEl().textContent).toBe(zh.aiMcpSrvEditTitle)

    modalSubmitBtn().click()
    await flush()

    expect(h.updateMCPServer).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'svc-a' }))
    expect(show).toHaveBeenCalledWith(zh.aiCfgSaved)
    expect(document.querySelector('.sk-modal')).toBeNull()
  })

  // ===== 覆盖点 11:保存失败弹窗不关 + 行内本地化错误 =====
  it('11. 保存失败 → 弹窗不关,行内错误走 saveServerErrorKey 本地化文案,不含后端英文串', async () => {
    h.listMCPServers.mockResolvedValue([])
    h.createMCPServer.mockRejectedValue({ response: { data: { message: 'url required for http/sse' } } })
    const w = mountSection()
    await flush()

    await w.find('.sk-add-btn').trigger('click')
    await macroFlush()
    setValue(modalNameInput(), 'no-url')
    const urlInput = document.querySelector('.sk-modal [data-f="url"]') as HTMLInputElement
    setValue(urlInput, 'https://example.com/x')
    await flush()
    modalSubmitBtn().click()
    await flush()

    expect(document.querySelector('.sk-modal')).not.toBeNull() // 弹窗仍开
    expect(modalFieldErr()?.textContent).toBe(zh.aiMcpSrvErrUrlRequired)
    expect(document.body.textContent).not.toContain('url required for http/sse')
  })

  // ===== 覆盖点 12:+ 打开新增(server=null);edit 事件打开编辑(server=该项) =====
  it('12a. 点 + 打开新增弹窗,server prop 为 null(名称输入框为空)', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'existing' })])
    const w = mountSection()
    await flush()
    await w.find('.sk-add-btn').trigger('click')
    await macroFlush()
    expect(modalTitleEl().textContent).toBe(zh.aiMcpSrvAdd)
    expect(modalNameInput().value).toBe('')
  })

  it('12b. 详情的 edit 事件打开编辑弹窗,server prop 为那一项(名称输入框回填)', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'existing-one' })])
    const w = mountSection()
    await flush()
    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('edit', srv(1, { name: 'existing-one' }))
    await macroFlush()
    expect(modalTitleEl().textContent).toBe(zh.aiMcpSrvEditTitle)
    expect(modalNameInput().value).toBe('existing-one')
  })

  // ===== 覆盖点 13(修复轮 M5,未申报偏离补正)=====
  // Vue2 `closeModal()`(`:85`)是 `{ this.modalOpen = false; this.editing = null }`
  // ——**任何**关闭路径都清 `editing`。本仓此前只在保存成功后调用的 `closeModal()`
  // 里清,取消/X/遮罩三条关闭路径走 `v-model:open` 直接把 `modalOpen` 置 false,
  // 不经过 `closeModal()`,`editing` 会残留旧值,传给 `McpServerModal` 的 `server`
  // prop 也跟着残留——本次挪到 `watch(modalOpen)` 里统一清,钉住这条行为。
  it('13. 编辑弹窗取消关闭(X 按钮,非保存路径)→ editing 清空,McpServerModal 的 server prop 变 null', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a' })])
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('edit', srv(1, { name: 'svc-a' }))
    await macroFlush()
    const modal = w.findComponent(McpServerModal)
    expect(modal.props('server')?.id).toBe(1)

    modalCloseBtn().click() // 取消路径(X 按钮),不是保存
    await flush()

    expect(modal.props('server')).toBeNull()
  })
})

// ============================================================================
// 协调者追加的两条集成用例(T8 评审发现:McpServerModal 的 `watch(open)` true
// 分支从 `props.server` 回填,依赖父组件同步设置 `server` + `open` 两个 prop 的
// 时序——单组件测不到,必须在容器这里补集成用例)。
// ============================================================================
describe('McpSection — 弹窗常驻实例的表单残留回归', () => {
  it('编辑 A → 关闭 → 编辑 B:弹窗里名称是 B 的,不是 A 的残留', async () => {
    h.listMCPServers.mockResolvedValue([
      srv(1, { name: 'server-A' }), srv(2, { name: 'server-B' }),
    ])
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('edit', srv(1, { name: 'server-A' }))
    await macroFlush()
    expect(modalNameInput().value).toBe('server-A')

    modalCloseBtn().click()
    await flush()
    expect(document.querySelector('.sk-modal')).toBeNull()

    detail.vm.$emit('edit', srv(2, { name: 'server-B' }))
    await macroFlush()
    expect(modalNameInput().value).toBe('server-B')
    expect(modalNameInput().value).not.toBe('server-A')
  })

  it('新增 → 关闭 → 编辑:弹窗里是该服务器的数据,没有上一次新增时的残留', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'existing-server' })])
    const w = mountSection()
    await flush()

    await w.find('.sk-add-btn').trigger('click')
    await macroFlush()
    expect(modalNameInput().value).toBe('')
    setValue(modalNameInput(), 'leftover-draft-name')
    await flush()
    expect(modalNameInput().value).toBe('leftover-draft-name')

    modalCloseBtn().click()
    await flush()
    expect(document.querySelector('.sk-modal')).toBeNull()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('edit', srv(1, { name: 'existing-server' }))
    await macroFlush()
    expect(modalNameInput().value).toBe('existing-server')
    expect(modalNameInput().value).not.toBe('leftover-draft-name')
  })
})

// ============================================================================
// Task 19 follow-up (review finding 1): the brief listed this file as a file
// to modify for the synchronous post-save probe (`probing` flag +
// `service.ai.testMCPServer` + `toTestView`/`toTestViewFromError` mapping),
// but the commit never added component-level coverage for it. These cases
// pin: the `probing` lifecycle around the in-flight request, the `finally`
// clearing it even when the probe throws, a `{ok:false}` resolution
// surfacing as a danger toast (never a success one), and `probeServer`
// receiving the right server id from both the create and the edit branch of
// `onSave`.
// ============================================================================
describe('McpSection — probe-on-save wiring (Task 19)', () => {
  function pendingTestMCPServer() {
    let resolve!: (v: unknown) => void
    const promise = new Promise((res) => { resolve = res })
    h.testMCPServer.mockReturnValue(promise)
    return { resolve }
  }

  function probingSpinner() {
    return document.querySelector('.sk-spinner[title]')
  }

  it('14. probing is true while testMCPServer is in flight, and false once it resolves', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a' })])
    const { resolve } = pendingTestMCPServer()
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('edit', srv(1, { name: 'svc-a' }))
    await macroFlush()
    modalSubmitBtn().click()
    await flush()
    await flush()

    // The save (updateMCPServer) and reload have both already resolved by
    // here -- the still-pending testMCPServer call is the only thing left
    // in flight, so the probing indicator must be up.
    expect(probingSpinner()).not.toBeNull()

    resolve({ ok: true, tool_count: 2, tools: [] })
    await flush()

    expect(probingSpinner()).toBeNull()
  })

  it('15. testMCPServer throwing still clears probing (finally path) -- no stuck "in progress" indicator', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a' })])
    h.testMCPServer.mockRejectedValue(new Error('network timeout'))
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('edit', srv(1, { name: 'svc-a' }))
    await macroFlush()
    modalSubmitBtn().click()
    await flush()
    await flush()

    expect(probingSpinner()).toBeNull()
  })

  it('16. a probe resolving with {ok:false} surfaces a danger toast, never a success one', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a' })])
    h.testMCPServer.mockResolvedValue({ ok: false, error_key: 'connect_failed', detail: 'x' })
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('edit', srv(1, { name: 'svc-a' }))
    await macroFlush()
    modalSubmitBtn().click()
    await flush()
    await flush()

    expect(show).toHaveBeenCalledWith(zh.aiMcpSrvTestErrConnect, 3000, 'danger')
    expect(show).not.toHaveBeenCalledWith(expect.stringContaining('已连接'))
  })

  it('17a. probeServer is invoked with the newly created server id (create branch)', async () => {
    h.listMCPServers
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([srv(9, { name: 'new-one' })])
    h.createMCPServer.mockResolvedValue({ id: 9 })
    h.testMCPServer.mockResolvedValue({ ok: true, tool_count: 1, tools: [] })
    const w = mountSection()
    await flush()

    await w.find('.sk-add-btn').trigger('click')
    await macroFlush()
    setValue(modalNameInput(), 'new-one')
    const urlInput = document.querySelector('.sk-modal [data-f="url"]') as HTMLInputElement
    setValue(urlInput, 'https://example.com/new')
    await flush()
    modalSubmitBtn().click()
    await flush()
    await flush()

    expect(h.testMCPServer).toHaveBeenCalledWith(9)
  })

  it('17b. probeServer is invoked with the edited server id (edit branch)', async () => {
    h.listMCPServers.mockResolvedValue([srv(4, { name: 'svc-d' })])
    h.testMCPServer.mockResolvedValue({ ok: true, tool_count: 1, tools: [] })
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('edit', srv(4, { name: 'svc-d' }))
    await macroFlush()
    modalSubmitBtn().click()
    await flush()
    await flush()

    expect(h.testMCPServer).toHaveBeenCalledWith(4)
  })
})
