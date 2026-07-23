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

  it('?search=foo → pendingPrompt 落 "foo" 且 router.replace 剥掉 search 参数', async () => {
    routeQuery.search = 'foo'
    mountPage()
    await flushPromises()
    const store = useAgentStore()
    expect(store.pendingPrompt).toBe('foo')
    expect(replace).toHaveBeenCalledWith({ path: '/ai/agent', query: {} })
  })

  it('?message=bar(无 search)→ pendingPrompt 落 "bar" 且 router.replace 剥掉 message 参数', async () => {
    routeQuery.message = 'bar'
    mountPage()
    await flushPromises()
    const store = useAgentStore()
    expect(store.pendingPrompt).toBe('bar')
    expect(replace).toHaveBeenCalledWith({ path: '/ai/agent', query: {} })
  })

  it('search 与 message 同时存在 → search 生效,message 被跳过(不覆盖 pendingPrompt)', async () => {
    routeQuery.search = 'foo'
    routeQuery.message = 'bar'
    mountPage()
    await flushPromises()
    const store = useAgentStore()
    expect(store.pendingPrompt).toBe('foo')
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith({ path: '/ai/agent', query: { message: 'bar' } })
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
})
