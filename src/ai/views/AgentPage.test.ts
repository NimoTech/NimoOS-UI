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
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: svc } }))

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

  it('侧栏 open-settings(设置齿轮)→ 弹 aiSettingsComingSoon toast,不 router.push(P2 路由未落地,防空白死页)', async () => {
    const w = mountPage()
    await flushPromises()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    await w.find('.sidebar-foot .icon-btn').trigger('click')
    expect(showSpy).toHaveBeenCalledWith('设置页将在后续阶段开启')
    expect(push).not.toHaveBeenCalled()
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
})
