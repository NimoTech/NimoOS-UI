import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  listAgentSessions: vi.fn(),
  createAgentSession: vi.fn(),
  deleteAgentSession: vi.fn(),
  listAgentMessages: vi.fn(),
  updateAgentSessionTitle: vi.fn(),
  getContextUsage: vi.fn(),
  // SP8-P1c2 Task 3 —— thinking 域(会话 watcher 触发 loadSessionThinking)。
  getThinkingDefaults: vi.fn(),
  getSessionThinking: vi.fn(),
  patchSessionThinking: vi.fn(),
  // SP8-P1c2 Task 13 —— 右栏挂载后 ResourcesTab 的附件下载链接会调它。
  attachmentRawUrl: vi.fn(() => '/raw/1'),
}))
// SP8-P1c2 Task 11 —— disks.list() 一次性拉存储容量(Agent.vue:159-162)。
const disksList = vi.hoisted(() => vi.fn())
// SP8-P1c2 Task 13 —— 右栏 SystemTab 走 useUtilization()(Pinia utilization store
// → service.sys.getUtilization + MessageBus 订阅)。utilization store 还从共享包
// 具名导入 parseUtil,所以这里必须 importActual 铺底,不能只给一个裸 service 对象。
const getUtilization = vi.hoisted(() => vi.fn())
vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return { ...actual, service: { ai: svc, disks: { list: disksList }, sys: { getUtilization } } }
})
vi.mock('../../composables/useMessageBus', () => ({
  useMessageBus: () => ({ on: vi.fn(() => () => {}) }),
}))

const push = vi.fn()
const replace = vi.fn().mockResolvedValue(undefined)
const routeQuery: Record<string, string> = {}
vi.mock('vue-router', () => ({
  useRouter: () => ({ push, replace }),
  useRoute: () => ({ query: routeQuery }),
}))

import AgentPage from './AgentPage.vue'
import { useAgentStore } from '../stores/agentStore'
import { useToast } from '../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

let pinia: ReturnType<typeof createPinia>

function mountPage() {
  return mount(AgentPage, { global: { plugins: [i18n, pinia] }, attachTo: document.body })
}

describe('AgentPage', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    Object.values(svc).forEach((fn) => fn.mockReset())
    svc.listAgentSessions.mockResolvedValue([])
    svc.getThinkingDefaults.mockResolvedValue({ enabled: true, level: 'medium' })
    svc.getSessionThinking.mockResolvedValue(null)
    disksList.mockReset()
    disksList.mockResolvedValue([])
    getUtilization.mockReset()
    getUtilization.mockResolvedValue({ cpu: null, mem: null, disk: null, gpu: null, net: null, usb: null })
    localStorage.clear()
    for (const k of Object.keys(routeQuery)) delete routeQuery[k]
    push.mockClear()
    replace.mockClear()
  })

  it('挂载后调用 loadSessions', async () => {
    const w = mountPage()
    await flushPromises()
    expect(svc.listAgentSessions).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('SP8-P1c2:挂载时先调 loadThinkingDefaults,早于 loadSessions/loadAvailableModels(Vue2 Agent.vue:151)', async () => {
    const store = useAgentStore()
    const defaultsSpy = vi.spyOn(store, 'loadThinkingDefaults')
    const sessionsSpy = vi.spyOn(store, 'loadSessions')
    mountPage()
    await flushPromises()
    expect(defaultsSpy).toHaveBeenCalledTimes(1)
    expect(defaultsSpy.mock.invocationCallOrder[0]).toBeLessThan(sessionsSpy.mock.invocationCallOrder[0])
  })

  it('无消息时渲染 EmptyState,不渲染消息流', async () => {
    const w = mountPage()
    await flushPromises()
    expect(w.find('.empty-state').exists()).toBe(true)
    expect(w.find('.stream-wrap').exists()).toBe(false)
    w.unmount()
  })

  it('store.messages 非空时渲染消息流(MessageList),不渲染 EmptyState', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.messages.push({ id: 'm1', role: 'user', content: 'hi' })
    await flushPromises()
    expect(w.find('.stream-wrap').exists()).toBe(true)
    expect(w.find('.empty-state').exists()).toBe(false)
    w.unmount()
  })

  it('?search=cats → 总是新建会话(createSession)再发送 locale 包装后的搜索文案,且 router.replace 一次性剥掉 search 参数', async () => {
    routeQuery.search = 'cats'
    const store = useAgentStore()
    const createSpy = vi.spyOn(store, 'createSession').mockResolvedValue(undefined)
    const sendSpy = vi.spyOn(store, 'send').mockResolvedValue(undefined)
    mountPage()
    await flushPromises()
    expect(replace).toHaveBeenCalledWith({ path: '/ai/agent', query: {} })
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).toHaveBeenCalledWith('在我的 NAS 中搜索"cats"。')
    // createSession 必须先于 send 完成(fresh session),顺序不可颠倒
    expect(createSpy.mock.invocationCallOrder[0]).toBeLessThan(sendSpy.mock.invocationCallOrder[0])
  })

  it('?search=cats 即便已有 activeSessionId 仍新建会话(search 恒 fresh,不复用)', async () => {
    routeQuery.search = 'cats'
    const store = useAgentStore()
    store.activeSessionId = 'sess-old'
    const createSpy = vi.spyOn(store, 'createSession').mockResolvedValue(undefined)
    const sendSpy = vi.spyOn(store, 'send').mockResolvedValue(undefined)
    mountPage()
    await flushPromises()
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).toHaveBeenCalledWith(expect.stringContaining('cats'))
  })

  it('?message=hi(无 search)且无 activeSessionId → 先建会话再原文发送(不做 locale 包装)', async () => {
    routeQuery.message = 'hi'
    const store = useAgentStore()
    const createSpy = vi.spyOn(store, 'createSession').mockResolvedValue(undefined)
    const sendSpy = vi.spyOn(store, 'send').mockResolvedValue(undefined)
    mountPage()
    await flushPromises()
    expect(replace).toHaveBeenCalledWith({ path: '/ai/agent', query: {} })
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).toHaveBeenCalledWith('hi')
  })

  it('?message=hi 且已有 activeSessionId → 复用会话,不建新会话', async () => {
    routeQuery.message = 'hi'
    const store = useAgentStore()
    store.activeSessionId = 'sess-existing'
    const createSpy = vi.spyOn(store, 'createSession').mockResolvedValue(undefined)
    const sendSpy = vi.spyOn(store, 'send').mockResolvedValue(undefined)
    mountPage()
    await flushPromises()
    expect(createSpy).not.toHaveBeenCalled()
    expect(sendSpy).toHaveBeenCalledWith('hi')
  })

  it('search 与 message 同时存在 → 只有 search 生效(message 被完全跳过,只发一次)', async () => {
    routeQuery.search = 'foo'
    routeQuery.message = 'bar'
    const store = useAgentStore()
    const createSpy = vi.spyOn(store, 'createSession').mockResolvedValue(undefined)
    const sendSpy = vi.spyOn(store, 'send').mockResolvedValue(undefined)
    mountPage()
    await flushPromises()
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).toHaveBeenCalledWith(expect.stringContaining('foo'))
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith({ path: '/ai/agent', query: {} })
  })

  it('one-shot:router.replace 剥离 search/message 但保留其它 query 参数不变', async () => {
    routeQuery.search = 'cats'
    routeQuery.tab = 'x'
    const store = useAgentStore()
    vi.spyOn(store, 'createSession').mockResolvedValue(undefined)
    vi.spyOn(store, 'send').mockResolvedValue(undefined)
    mountPage()
    await flushPromises()
    expect(replace).toHaveBeenCalledWith({ path: '/ai/agent', query: { tab: 'x' } })
  })

  it('?skill=abc → 暂存 store.pendingSkillId,不触发发送', async () => {
    routeQuery.skill = 'abc'
    const store = useAgentStore()
    const sendSpy = vi.spyOn(store, 'send').mockResolvedValue(undefined)
    mountPage()
    await flushPromises()
    expect(store.pendingSkillId).toBe('abc')
    expect(sendSpy).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it('SP8-P2a Task 12:侧栏 open-settings(设置齿轮)→ router.push 到 /ai/settings,不再弹占位 toast(Vue2 Agent.vue:209,路由已存在)', async () => {
    const w = mountPage()
    await flushPromises()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    await w.find('.sidebar-foot .icon-btn').trigger('click')
    expect(push).toHaveBeenCalledWith('/ai/settings')
    expect(showSpy).not.toHaveBeenCalled()
    w.unmount()
  })

  it('挂载 composer,并把 send/stop/send-init 接到 store', async () => {
    const w = mountPage()
    await flushPromises()
    const composer = w.findComponent({ name: 'AgentComposer' })
    expect(composer.exists()).toBe(true)
    const store = useAgentStore()
    const sendSpy = vi.spyOn(store, 'send').mockResolvedValue(undefined)
    const stopSpy = vi.spyOn(store, 'stop').mockResolvedValue(undefined)
    const initSpy = vi.spyOn(store, 'sendInit').mockResolvedValue(undefined)
    composer.vm.$emit('send', { text: 'hi', attachmentIds: [], attachmentRefs: [] })
    composer.vm.$emit('stop')
    composer.vm.$emit('send-init', '/DATA/docs')
    expect(sendSpy).toHaveBeenCalledWith({ text: 'hi', attachmentIds: [], attachmentRefs: [] })
    expect(stopSpy).toHaveBeenCalled()
    expect(initSpy).toHaveBeenCalledWith('/DATA/docs')
  })

  it('ctxUsage:挂载后拉一次;切会话拉一次;busy 由 true→false 再拉一次', async () => {
    svc.getContextUsage.mockResolvedValue({ tokens: 10, window: 100, pct: 10 })
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    const base = svc.getContextUsage.mock.calls.length
    store.activeSessionId = 'sess-x'
    await flushPromises()
    expect(svc.getContextUsage.mock.calls.length).toBe(base + 1)
    store.busy = true
    await flushPromises()
    expect(svc.getContextUsage.mock.calls.length).toBe(base + 1) // 上升沿不拉
    store.busy = false
    await flushPromises()
    expect(svc.getContextUsage.mock.calls.length).toBe(base + 2) // 下降沿拉
    expect(w.findComponent({ name: 'AgentComposer' }).props('ctxUsage')).toEqual({ tokens: 10, window: 100, pct: 10 })
  })

  it('ctxUsage:无会话不拉;请求失败置 null', async () => {
    svc.getContextUsage.mockRejectedValue(new Error('x'))
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.activeSessionId = 'sess-y'
    await flushPromises()
    expect(w.findComponent({ name: 'AgentComposer' }).props('ctxUsage')).toBe(null)
  })

  it('SP8-P1c2 Task 11:挂载后一次性调用 service.disks.list()(Agent.vue:159-162,存储容量不需要实时)', async () => {
    disksList.mockResolvedValue([{ size: 4e12, used: 2e12 }])
    const w = mountPage()
    await flushPromises()
    expect(disksList).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('SP8-P1c2 Task 11:disks.list() 失败 → 吞错,不抛未处理异常,storage 落 null(与 Vue2 Agent.vue try/catch 同)', async () => {
    // 代码评审 F2:原断言 `expect(() => mountPage()).not.toThrow()` 恒为真——
    // onMounted 内的 rejection 是异步的,不会同步冒出来给这个同步包装捕获。
    // 改成断言真实落地的结果:reject 落定后页面内部的 storage 状态应为 null
    // (与 Files.upload.test.ts / PhotoTile.test.ts 同款,用 `w.vm as any` 读
    // script setup 未 defineExpose 的内部 ref——此仓库既有先例)。
    disksList.mockRejectedValue(new Error('boom'))
    const w = mountPage()
    await flushPromises()
    expect((w.vm as any).storage).toBe(null)
    w.unmount()
  })

  it('SP8-P1c2:切会话 → loadSessionThinking(newId) + updateThinkingForModel + refreshContextUsage 三者并列触发(Vue2 Agent.vue:120-123)', async () => {
    svc.getContextUsage.mockResolvedValue({ tokens: 1, window: 10, pct: 10 })
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    const thinkingSpy = vi.spyOn(store, 'loadSessionThinking').mockResolvedValue(undefined)
    const modelSpy = vi.spyOn(store, 'updateThinkingForModel')
    const baseCtx = svc.getContextUsage.mock.calls.length
    store.activeSessionId = 'sess-thinking'
    await flushPromises()
    expect(thinkingSpy).toHaveBeenCalledWith('sess-thinking')
    expect(modelSpy).toHaveBeenCalledTimes(1)
    expect(svc.getContextUsage.mock.calls.length).toBe(baseCtx + 1)
    w.unmount()
  })

  it('SP8-P1c2:切回无会话(newId 为空)时不调 loadSessionThinking/updateThinkingForModel', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.activeSessionId = 'sess-x'
    await flushPromises()
    const thinkingSpy = vi.spyOn(store, 'loadSessionThinking').mockResolvedValue(undefined)
    const modelSpy = vi.spyOn(store, 'updateThinkingForModel')
    store.activeSessionId = null
    await flushPromises()
    expect(thinkingSpy).not.toHaveBeenCalled()
    expect(modelSpy).not.toHaveBeenCalled()
    w.unmount()
  })

  it('SP8-P1c2 Task 8:AgentTopbar 的 thinking-enabled/thinking-level 接到 store.setThinkingEnabled/setThinkingLevel', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    const enabledSpy = vi.spyOn(store, 'setThinkingEnabled').mockResolvedValue(undefined)
    const levelSpy = vi.spyOn(store, 'setThinkingLevel').mockResolvedValue(undefined)
    const topbar = w.findComponent({ name: 'AgentTopbar' })
    topbar.vm.$emit('thinking-enabled', false)
    topbar.vm.$emit('thinking-level', 'high')
    expect(enabledSpy).toHaveBeenCalledWith(false)
    expect(levelSpy).toHaveBeenCalledWith('high')
    w.unmount()
  })

  it('SP8-P1c2 Task 8:AgentTopbar 的 thinking prop 绑定到 store.thinking', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.thinking.supportsThinking = true
    store.thinking.providerType = 'deepseek'
    await flushPromises()
    const topbar = w.findComponent({ name: 'AgentTopbar' })
    expect(topbar.props('thinking')).toMatchObject({ supportsThinking: true, providerType: 'deepseek' })
    w.unmount()
  })

  it('SP8-P1c2:根元素 data-rightcollapsed 默认为 false(展开,对齐 Vue2 agentStore.js:37)', async () => {
    const w = mountPage()
    await flushPromises()
    expect(w.find('.agent-app').attributes('data-rightcollapsed')).toBe('false')
    w.unmount()
  })

  it('SP8-P1c2:data-rightcollapsed 随 store.toggleRight 变化,顶栏按钮亦接线到同一 action', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.toggleRight()
    await flushPromises()
    expect(w.find('.agent-app').attributes('data-rightcollapsed')).toBe('true')
    store.toggleRight()
    await flushPromises()
    expect(w.find('.agent-app').attributes('data-rightcollapsed')).toBe('false')
    w.unmount()
  })

  it('SP8-P1c2 Task 9:AgentTopbar 的 select-model 接到 store.selectModel,available-models/selected-model 直传', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.availableModels = [{ key: 'local:a', source: 'local', displayName: 'A' }]
    store.selectedModel = 'local:a'
    await flushPromises()
    const topbar = w.findComponent({ name: 'AgentTopbar' })
    expect(topbar.props('availableModels')).toEqual(store.availableModels)
    expect(topbar.props('selectedModel')).toBe('local:a')
    const selectSpy = vi.spyOn(store, 'selectModel')
    topbar.vm.$emit('select-model', 'local:b')
    expect(selectSpy).toHaveBeenCalledWith('local:b')
    w.unmount()
  })

  it('SP8-P2a Task 12:AgentTopbar 的 open-settings 与侧栏共用同一真跳转(router.push 到 /ai/settings,不再弹占位 toast)', async () => {
    const w = mountPage()
    await flushPromises()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    const topbar = w.findComponent({ name: 'AgentTopbar' })
    topbar.vm.$emit('open-settings')
    expect(push).toHaveBeenCalledWith('/ai/settings')
    expect(showSpy).not.toHaveBeenCalled()
    w.unmount()
  })

  it('SP8-P1c2 Task 9:regenerate-title → store.regenerateTitle(activeSessionId);无活跃会话时不调用(Vue2 Agent.vue:216-220)', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    const regenSpy = vi.spyOn(store, 'regenerateTitle').mockResolvedValue(undefined)
    const topbar = w.findComponent({ name: 'AgentTopbar' })

    topbar.vm.$emit('regenerate-title')
    expect(regenSpy).not.toHaveBeenCalled()

    store.activeSessionId = 'sess-1'
    await flushPromises()
    topbar.vm.$emit('regenerate-title')
    expect(regenSpy).toHaveBeenCalledWith('sess-1')
    w.unmount()
  })

  it('SP8-P1c2 Task 9:regeneratingTitleFor 直传顶栏(禁用矩阵由 AgentTopbar 自己算,这里只验证透传)', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.regeneratingTitleFor = { id: 'sess-1', background: true }
    await flushPromises()
    const topbar = w.findComponent({ name: 'AgentTopbar' })
    expect(topbar.props('regeneratingTitleFor')).toEqual({ id: 'sess-1', background: true })
    w.unmount()
  })

  it('SP8-P1c2 Task 9:lastFallbackNotice 变化 → 4000ms warning toast,随后被置回 null(Vue2 Agent.vue:133-142)', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    store.lastFallbackNotice = { from: 'cloud:openai:gpt-4', to: 'local:llama3' }
    await flushPromises()
    expect(showSpy).toHaveBeenCalledWith(
      '原模型 cloud:openai:gpt-4 不可用，已切换到 local:llama3',
      4000,
      'warning',
    )
    // The store itself never clears this — the view must, so a later
    // identical fallback still re-fires the watcher instead of being
    // swallowed by an unchanged (still-truthy) value.
    expect(store.lastFallbackNotice).toBe(null)
    w.unmount()
  })

  it('SP8-P1c2 Task 9:lastFallbackNotice.to 为空 → 用 aiNoModelAvailable 兜底文案', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    store.lastFallbackNotice = { from: 'cloud:openai:gpt-4', to: null }
    await flushPromises()
    expect(showSpy).toHaveBeenCalledWith(
      '原模型 cloud:openai:gpt-4 不可用，已切换到 无可用模型',
      4000,
      'warning',
    )
    w.unmount()
  })

  // ── SP8-P1c2 Task 13:右栏接线(Vue2 Agent.vue:44-64)──
  it('Task 13:AgentRightPanel 已挂载,11 个 prop 逐条来自 store / 页面 storage ref', async () => {
    disksList.mockResolvedValue([{ size: 4e12, used: 2e12 }])
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.rightTab = 'resources'
    store.activeSessionId = 'sess-1'
    store.busy = true
    store.committing = true
    store.reverting = { run1: true }
    store.visibleResources = [{ id: 'r1', path: '/DATA/a', kind: 'file' }]
    store.attachments = [{ id: 'a1', filename: 'x.txt' }]
    store.stagedChanges = [{ run_id: 'run1', created_at: 0, items: [{ seq: 1, op: 'write', path: '/DATA/a' }] }]
    store.activitySteps = [{ id: 's1', name: 'read_file', state: 'success' }]
    await flushPromises()

    const panel = w.findComponent({ name: 'AgentRightPanel' })
    expect(panel.exists()).toBe(true)
    expect(panel.props('collapsed')).toBe(false)
    expect(panel.props('tab')).toBe('resources')
    expect(panel.props('activitySteps')).toEqual(store.activitySteps)
    expect(panel.props('storage')).not.toBe(null) // 由 onMounted 的 disks.list() 装载
    expect(panel.props('busy')).toBe(true)
    // Vue2 Agent.vue:51 直传 activeSessionId(可能是 number/null);这里归一化成 string。
    expect(panel.props('sessionId')).toBe('sess-1')
    expect(panel.props('visibleResources')).toEqual(store.visibleResources)
    expect(panel.props('attachments')).toEqual(store.attachments)
    expect(panel.props('stagedChanges')).toEqual(store.stagedChanges)
    expect(panel.props('committing')).toBe(true)
    expect(panel.props('reverting')).toEqual({ run1: true })
    // Vue2 Agent.vue:48 的 :system-metrics 有意不接(SystemTab 自取实时数据)。
    expect(Object.keys(panel.props())).not.toContain('systemMetrics')
    w.unmount()
  })

  it('Task 13:切 4 个 tab 各渲染对应内容(Activity/Context/System/Resources)', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()

    expect(w.findComponent({ name: 'ActivityTab' }).exists()).toBe(true)
    expect(w.findComponent({ name: 'ContextTab' }).exists()).toBe(false)

    store.setRightTab('context')
    await flushPromises()
    expect(w.findComponent({ name: 'ContextTab' }).exists()).toBe(true)
    expect(w.findComponent({ name: 'ActivityTab' }).exists()).toBe(false)

    store.setRightTab('system')
    await flushPromises()
    expect(w.findComponent({ name: 'SystemTab' }).exists()).toBe(true)
    expect(w.findComponent({ name: 'ContextTab' }).exists()).toBe(false)

    store.setRightTab('resources')
    await flushPromises()
    expect(w.findComponent({ name: 'ResourcesTab' }).exists()).toBe(true)
    expect(w.findComponent({ name: 'SystemTab' }).exists()).toBe(false)
    w.unmount()
  })

  it('Task 13:右栏 tab 条点击 → set-tab 打到 store.setRightTab,渲染跟着换', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    const setTabSpy = vi.spyOn(store, 'setRightTab')
    const tabs = w.findAll('.rightpanel .right-tab')
    expect(tabs.length).toBe(4)
    await tabs[2].trigger('click')
    expect(setTabSpy).toHaveBeenCalledWith('system')
    expect(store.rightTab).toBe('system')
    await flushPromises()
    expect(w.findComponent({ name: 'SystemTab' }).exists()).toBe(true)
    w.unmount()
  })

  it('Task 13:右栏开关联动 —— data-rightcollapsed=true 时 <aside class="rightpanel"> 不渲染', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    expect(w.find('aside.rightpanel').exists()).toBe(true)

    store.toggleRight()
    await flushPromises()
    expect(w.find('.agent-app').attributes('data-rightcollapsed')).toBe('true')
    expect(w.find('aside.rightpanel').exists()).toBe(false)

    store.toggleRight()
    await flushPromises()
    expect(w.find('.agent-app').attributes('data-rightcollapsed')).toBe('false')
    expect(w.find('aside.rightpanel').exists()).toBe(true)
    w.unmount()
  })

  it('Task 13:Resources 三级回滚 + 提交的真实点击各自打到 store 对应动作(带参数)', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.rightTab = 'resources'
    store.activeSessionId = 'sess-1'
    store.stagedChanges = [
      {
        run_id: 'run1',
        created_at: Math.floor(Date.now() / 1000),
        items: [
          { seq: 1, staged_id: 'st1', batch_id: 'batch1', op: 'write', path: '/DATA/a.txt', size_bytes: 10 },
        ],
      },
    ]
    await flushPromises()

    const runSpy = vi.spyOn(store, 'revertStagedRun').mockResolvedValue(undefined)
    const batchSpy = vi.spyOn(store, 'revertStagedBatch').mockResolvedValue(undefined)
    const itemSpy = vi.spyOn(store, 'revertStagedItem').mockResolvedValue(undefined)
    const commitSpy = vi.spyOn(store, 'commitStagedAll').mockResolvedValue(undefined)

    await w.find('.rt-turn-head .rt-revert').trigger('click')
    expect(runSpy).toHaveBeenCalledWith('run1')

    await w.find('.rt-batch-revert').trigger('click')
    expect(batchSpy).toHaveBeenCalledWith('batch1')

    // 单项按钮在 batch 折叠区里(v-show,DOM 常在),直接点即可。
    await w.find('.rt-item-revert').trigger('click')
    expect(itemSpy).toHaveBeenCalledWith('st1')

    await w.find('.rt-commit').trigger('click')
    expect(commitSpy).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('Task 13:授权资源 × / 附件 × 分别打到 store.removeVisibleResource / removeAttachment', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.rightTab = 'resources'
    store.activeSessionId = 'sess-1'
    store.visibleResources = [{ id: 'r1', path: '/DATA/a', kind: 'file' }]
    store.attachments = [{ id: 'a1', filename: 'x.txt' }] // 无 message_id → 草稿,有 × 按钮
    await flushPromises()

    const resSpy = vi.spyOn(store, 'removeVisibleResource').mockResolvedValue(undefined)
    const attSpy = vi.spyOn(store, 'removeAttachment').mockResolvedValue(undefined)

    const sections = w.findAll('.rt-section')
    await sections[0].find('.rt-x').trigger('click')
    expect(resSpy).toHaveBeenCalledWith('r1')

    // 附件段第一个 .rt-x 是下载 <a>(不 emit),× 按钮是 button。
    await sections[1].find('button.rt-x').trigger('click')
    expect(attSpy).toHaveBeenCalledWith('a1')
    w.unmount()
  })

  // F1(终审 opus 复查)—— 流式注入的授权资源没有 id(agentStore.ts:488
  // appendVisibleResource({path, kind})),右栏 × 必须打到
  // store.removeVisibleResourceByPath,而不是拿 undefined 打
  // store.removeVisibleResource。
  it('Task 13/F1:无 id 授权资源的 × 打到 store.removeVisibleResourceByPath(path),不打 removeVisibleResource', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.rightTab = 'resources'
    store.activeSessionId = 'sess-1'
    store.visibleResources = [{ path: '/DATA/streamed-dir', kind: 'folder' }]
    await flushPromises()

    const byPathSpy = vi.spyOn(store, 'removeVisibleResourceByPath').mockResolvedValue(undefined)
    const byIdSpy = vi.spyOn(store, 'removeVisibleResource').mockResolvedValue(undefined)

    const sections = w.findAll('.rt-section')
    await sections[0].find('.rt-x').trigger('click')
    expect(byPathSpy).toHaveBeenCalledWith('/DATA/streamed-dir')
    expect(byIdSpy).not.toHaveBeenCalled()
    w.unmount()
  })
})
