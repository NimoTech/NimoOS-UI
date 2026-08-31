import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
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
  // Thinking scope (session watcher triggers loadSessionThinking).
  getThinkingDefaults: vi.fn(),
  getSessionThinking: vi.fn(),
  patchSessionThinking: vi.fn(),
  // Called by attachment download link in ResourcesTab after right panel mounts.
  attachmentRawUrl: vi.fn(() => '/raw/1'),
}))
// disks.list() one-shot fetches storage capacity (Agent.vue:159-162).
const disksList = vi.hoisted(() => vi.fn())
// Right panel SystemTab uses useUtilization() (Pinia utilization store
// → service.sys.getUtilization + MessageBus subscription). utilization store also named-imports
// parseUtil from shared package, so must importActual as base here, cannot just bare service object.
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
// reactive so a watcher on route.query.session sees address-bar-style changes; existing
// tests only read or assign keys, so this is transparent to them.
const routeQuery: Record<string, string> = reactive({})
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

  it('calls loadSessions after mount', async () => {
    const w = mountPage()
    await flushPromises()
    expect(svc.listAgentSessions).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('Calls loadThinkingDefaults on mount first, before loadSessions/loadAvailableModels (Vue2 Agent.vue:151)', async () => {
    const store = useAgentStore()
    const defaultsSpy = vi.spyOn(store, 'loadThinkingDefaults')
    const sessionsSpy = vi.spyOn(store, 'loadSessions')
    mountPage()
    await flushPromises()
    expect(defaultsSpy).toHaveBeenCalledTimes(1)
    expect(defaultsSpy.mock.invocationCallOrder[0]).toBeLessThan(sessionsSpy.mock.invocationCallOrder[0])
  })

  it('renders EmptyState when no messages, does not render message stream', async () => {
    const w = mountPage()
    await flushPromises()
    expect(w.find('.empty-state').exists()).toBe(true)
    expect(w.find('.stream-wrap').exists()).toBe(false)
    w.unmount()
  })

  it('renders message stream (MessageList) when store.messages non-empty, does not render EmptyState', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.messages.push({ id: 'm1', role: 'user', content: 'hi' })
    await flushPromises()
    expect(w.find('.stream-wrap').exists()).toBe(true)
    expect(w.find('.empty-state').exists()).toBe(false)
    w.unmount()
  })

  it('?search=cats → always creates new session (createSession) then sends locale-wrapped search text, and router.replace strips search param in one go', async () => {
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
    // createSession must complete before send (fresh session), order cannot reverse
    expect(createSpy.mock.invocationCallOrder[0]).toBeLessThan(sendSpy.mock.invocationCallOrder[0])
  })

  it('?search=cats still creates new session even with existing activeSessionId (search always fresh, no reuse)', async () => {
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

  it('?message=hi (no search) and no activeSessionId → creates session first, then sends text as-is (no locale wrapping)', async () => {
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

  it('?message=hi and existing activeSessionId → reuses session, does not create new one', async () => {
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

  it('search and message both present → only search takes effect (message skipped entirely, sends once only)', async () => {
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

  it('one-shot: router.replace strips search/message but preserves other query params unchanged', async () => {
    routeQuery.search = 'cats'
    routeQuery.tab = 'x'
    const store = useAgentStore()
    vi.spyOn(store, 'createSession').mockResolvedValue(undefined)
    vi.spyOn(store, 'send').mockResolvedValue(undefined)
    mountPage()
    await flushPromises()
    expect(replace).toHaveBeenCalledWith({ path: '/ai/agent', query: { tab: 'x' } })
  })

  // Added after an acceptance review: ?skill= must be erased from URL immediately after reading
  // (Vue2 Agent.vue:145-148 has same defect unfixed; here we correct per "logic matches right"
  // aligning with precedent of adjacent ?search=/?message=).
  it('?skill=abc → stashes store.pendingSkillId, and immediately erases skill from URL (F5 after unmount/send will not revive)', async () => {
    routeQuery.skill = 'abc'
    const store = useAgentStore()
    const sendSpy = vi.spyOn(store, 'send').mockResolvedValue(undefined)
    mountPage()
    await flushPromises()
    expect(store.pendingSkillId).toBe('abc')
    expect(sendSpy).not.toHaveBeenCalled()
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith({ path: '/ai/agent', query: {} })
  })

  it('?skill=abc&search=cats → skill registers and is erased from URL, search seed behavior happens as usual, two router.replaces chain up so final state has neither skill nor search', async () => {
    routeQuery.skill = 'abc'
    routeQuery.search = 'cats'
    const store = useAgentStore()
    const createSpy = vi.spyOn(store, 'createSession').mockResolvedValue(undefined)
    const sendSpy = vi.spyOn(store, 'send').mockResolvedValue(undefined)
    mountPage()
    await flushPromises()
    expect(store.pendingSkillId).toBe('abc')
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).toHaveBeenCalledWith(expect.stringContaining('cats'))
    expect(replace).toHaveBeenCalledTimes(2)
    // First erase only skill, leave search for seed logic below to read; second erase search/message.
    expect(replace).toHaveBeenNthCalledWith(1, { path: '/ai/agent', query: { search: 'cats' } })
    expect(replace).toHaveBeenNthCalledWith(2, { path: '/ai/agent', query: {} })
  })

  // skill is a one-shot handoff and gets stripped; session is a standing deep link and survives.
  it('spec Testing #7: ?skill=abc&session=s1 → skill stripped, session preserved throughout', async () => {
    routeQuery.skill = 'abc'
    routeQuery.session = 's1'
    svc.listAgentSessions.mockResolvedValue([{ id: 's1' }])
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'selectSession').mockResolvedValue(undefined)
    const w = mountPage()
    await flushPromises()
    expect(store.pendingSkillId).toBe('abc')
    expect(spy).toHaveBeenCalledWith('s1')
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith({ path: '/ai/agent', query: { session: 's1' } })
    w.unmount()
  })

  it('does not call router.replace when no one-shot query params (cannot blindly replace every time)', async () => {
    mountPage()
    await flushPromises()
    const store = useAgentStore()
    expect(replace).not.toHaveBeenCalled()
    expect(store.pendingSkillId).toBeNull()
  })

  // A-8 (spec 2026-08-19-agent-session-deeplink): the selected session is mirrored into
  // ?session= so the address bar is always a shareable deep link.
  it('A-8: switching session mirrors it into ?session= (replace, so no history churn)', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.activeSessionId = 'sess-a'
    await flushPromises()
    expect(replace).toHaveBeenLastCalledWith({ path: '/ai/agent', query: { session: 'sess-a' } })
    w.unmount()
  })

  it('A-8: a numeric session id is stringified for the URL', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.activeSessionId = 42
    await flushPromises()
    expect(replace).toHaveBeenLastCalledWith({ path: '/ai/agent', query: { session: '42' } })
    w.unmount()
  })

  // Assigning the same id twice would not test this: Vue dedups identical primitive
  // writes before the watcher ever re-fires, so the guard's early return would be unreached.
  it('A-8: watcher firing with a session already named in the URL issues no replace (equality guard)', async () => {
    routeQuery.session = 'sess-a'
    // A-8 Task 2 landed a mount-time ?session= read that looks 'sess-a' up in the loaded
    // list; give it a match (and stub selectSession, same as the Task 2 tests) so mount
    // takes the found branch and leaves activeSessionId at null — the single assignment
    // below is then a genuine change that fires the watcher with the URL already naming
    // this session.
    svc.listAgentSessions.mockResolvedValue([{ id: 'sess-a' }])
    const store = useAgentStore()
    vi.spyOn(store, 'selectSession').mockResolvedValue(undefined)
    const w = mountPage()
    await flushPromises()
    store.activeSessionId = 'sess-a' // genuine change from the initial null — watcher fires
    await flushPromises()
    expect(replace).not.toHaveBeenCalled()
    w.unmount()
  })

  it('A-8: clearing the active session strips ?session= from the URL', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.activeSessionId = 'sess-a'
    await flushPromises()
    store.activeSessionId = null
    await flushPromises()
    expect(replace).toHaveBeenLastCalledWith({ path: '/ai/agent', query: {} })
    w.unmount()
  })

  it('Sidebar open-settings (settings gear) → router.push to /ai/settings, no placeholder toast (Vue2 Agent.vue:209, route exists)', async () => {
    const w = mountPage()
    await flushPromises()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    await w.find('.sidebar-foot .icon-btn').trigger('click')
    expect(push).toHaveBeenCalledWith('/ai/settings')
    expect(showSpy).not.toHaveBeenCalled()
    w.unmount()
  })

  it('mounts composer and wires send/stop/send-init to store', async () => {
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

  it('ctxUsage: fetches once on mount; once on session switch; once more when busy goes true→false', async () => {
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
    expect(svc.getContextUsage.mock.calls.length).toBe(base + 1) // rising edge does not fetch
    store.busy = false
    await flushPromises()
    expect(svc.getContextUsage.mock.calls.length).toBe(base + 2) // falling edge fetches
    expect(w.findComponent({ name: 'AgentComposer' }).props('ctxUsage')).toEqual({ tokens: 10, window: 100, pct: 10 })
  })

  it('ctxUsage: does not fetch without session; request failure sets null', async () => {
    svc.getContextUsage.mockRejectedValue(new Error('x'))
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.activeSessionId = 'sess-y'
    await flushPromises()
    expect(w.findComponent({ name: 'AgentComposer' }).props('ctxUsage')).toBe(null)
  })

  it('Calls service.disks.list() once-shot on mount (Agent.vue:159-162, storage capacity not real-time)', async () => {
    disksList.mockResolvedValue([{ size: 4e12, used: 2e12 }])
    const w = mountPage()
    await flushPromises()
    expect(disksList).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('disks.list() failure → swallows error, no unhandled exception, storage becomes null (same as Vue2 Agent.vue try/catch)', async () => {
    // Code review F2: original assertion `expect(() => mountPage()).not.toThrow()` always true —
    // rejection inside onMounted is async, will not sync throw out to sync wrapper catch.
    // Changed to assert actual outcome: after reject settles, storage state inside page should be null
    // (same as Files.upload.test.ts / PhotoTile.test.ts, read internal ref with `w.vm as any`
    // on script setup that didn't defineExpose — existing precedent in this repo).
    disksList.mockRejectedValue(new Error('boom'))
    const w = mountPage()
    await flushPromises()
    expect((w.vm as any).storage).toBe(null)
    w.unmount()
  })

  it('Switch session → loadSessionThinking(newId) + updateThinkingForModel + refreshContextUsage fire in parallel (Vue2 Agent.vue:120-123)', async () => {
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

  it('Switching back to no session (newId empty) does not call loadSessionThinking/updateThinkingForModel', async () => {
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

  it('AgentTopbar thinking-enabled/thinking-level wired to store.setThinkingEnabled/setThinkingLevel', async () => {
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

  it('AgentTopbar thinking prop bound to store.thinking', async () => {
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

  it('Root element data-rightcollapsed defaults to false (expanded, align Vue2 agentStore.js:37)', async () => {
    const w = mountPage()
    await flushPromises()
    expect(w.find('.agent-app').attributes('data-rightcollapsed')).toBe('false')
    w.unmount()
  })

  it('data-rightcollapsed changes with store.toggleRight, top bar button also wired to same action', async () => {
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

  it('AgentTopbar select-model wired to store.selectModel, available-models/selected-model passed through', async () => {
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

  it('AgentTopbar open-settings shares same real navigation with sidebar (router.push to /ai/settings, no placeholder toast)', async () => {
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

  it('regenerate-title → store.regenerateTitle(activeSessionId); does not call without active session (Vue2 Agent.vue:216-220)', async () => {
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

  it('regeneratingTitleFor passed through to topbar (disable matrix calculated by AgentTopbar itself, only verify pass-through here)', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.regeneratingTitleFor = { id: 'sess-1', background: true }
    await flushPromises()
    const topbar = w.findComponent({ name: 'AgentTopbar' })
    expect(topbar.props('regeneratingTitleFor')).toEqual({ id: 'sess-1', background: true })
    w.unmount()
  })

  it('lastFallbackNotice changes → 4000ms warning toast, then reset to null (Vue2 Agent.vue:133-142)', async () => {
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

  it('lastFallbackNotice.to empty → uses aiNoModelAvailable fallback text', async () => {
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

  // ── Right panel wiring (Vue2 Agent.vue:44-64) ──
  it('Task 13: AgentRightPanel mounted, 11 props each from store / page storage ref', async () => {
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
    expect(panel.props('storage')).not.toBe(null) // loaded by disks.list() in onMounted
    expect(panel.props('busy')).toBe(true)
    // Vue2 Agent.vue:51 passes activeSessionId directly (may be number/null); normalized to string here.
    expect(panel.props('sessionId')).toBe('sess-1')
    expect(panel.props('visibleResources')).toEqual(store.visibleResources)
    expect(panel.props('attachments')).toEqual(store.attachments)
    expect(panel.props('stagedChanges')).toEqual(store.stagedChanges)
    expect(panel.props('committing')).toBe(true)
    expect(panel.props('reverting')).toEqual({ run1: true })
    // Vue2 Agent.vue:48's :system-metrics intentionally not wired (SystemTab fetches real-time itself).
    expect(Object.keys(panel.props())).not.toContain('systemMetrics')
    w.unmount()
  })

  it('Task 13: switching 4 tabs each renders corresponding content (Activity/Context/System/Resources)', async () => {
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

  it('Task 13: clicking right panel tab bar → set-tab fires to store.setRightTab, render follows', async () => {
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

  it('Task 13: right panel toggle linked — when data-rightcollapsed=true, <aside class="rightpanel"> not rendered', async () => {
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

  it('Task 13: Resources three-level revert + commit real clicks each fire to store actions (with params)', async () => {
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

    // Single-item button is inside batch fold area (v-show, DOM always present), can click directly.
    await w.find('.rt-item-revert').trigger('click')
    expect(itemSpy).toHaveBeenCalledWith('st1')

    await w.find('.rt-commit').trigger('click')
    expect(commitSpy).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('Task 13: authorized resource × / attachment × each fire to store.removeVisibleResource / removeAttachment', async () => {
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.rightTab = 'resources'
    store.activeSessionId = 'sess-1'
    store.visibleResources = [{ id: 'r1', path: '/DATA/a', kind: 'file' }]
    store.attachments = [{ id: 'a1', filename: 'x.txt' }] // no message_id → draft, has × button
    await flushPromises()

    const resSpy = vi.spyOn(store, 'removeVisibleResource').mockResolvedValue(undefined)
    const attSpy = vi.spyOn(store, 'removeAttachment').mockResolvedValue(undefined)

    const sections = w.findAll('.rt-section')
    await sections[0].find('.rt-x').trigger('click')
    expect(resSpy).toHaveBeenCalledWith('r1')

    // First .rt-x in attachment section is download <a> (no emit), × button is button element.
    await sections[1].find('button.rt-x').trigger('click')
    expect(attSpy).toHaveBeenCalledWith('a1')
    w.unmount()
  })

  // F1 (final review opus check) — streamed-injected authorized resources have no id (agentStore.ts:488
  // appendVisibleResource({path, kind})), right panel × must fire to
  // store.removeVisibleResourceByPath, not pass undefined to
  // store.removeVisibleResource.
  it('Task 13/F1: authorized resource with no id, × fires to store.removeVisibleResourceByPath(path), not removeVisibleResource', async () => {
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

  it('A-8: ?session= selects that session once the list has loaded', async () => {
    routeQuery.session = 's2'
    svc.listAgentSessions.mockResolvedValue([{ id: 's1' }, { id: 's2' }])
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'selectSession').mockResolvedValue(undefined)
    const w = mountPage()
    await flushPromises()
    expect(spy).toHaveBeenCalledWith('s2')
    w.unmount()
  })

  // The sidebar compares s.id === activeId strictly, so a numeric session fed the URL's
  // string would be "selected" with an unhighlighted row. Select the session's own id.
  it('A-8: a numeric session id is selected as a number, not as the URL string', async () => {
    routeQuery.session = '42'
    svc.listAgentSessions.mockResolvedValue([{ id: 42 }])
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'selectSession').mockResolvedValue(undefined)
    const w = mountPage()
    await flushPromises()
    expect(spy).toHaveBeenCalledWith(42)
    w.unmount()
  })

  it('A-8: an unknown ?session= warns and strips the parameter', async () => {
    routeQuery.session = 'gone'
    svc.listAgentSessions.mockResolvedValue([{ id: 's1' }])
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'selectSession').mockResolvedValue(undefined)
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    const w = mountPage()
    await flushPromises()
    expect(spy).not.toHaveBeenCalled()
    expect(showSpy).toHaveBeenCalledWith('找不到该会话 — 可能已被删除', 4000, 'warning')
    expect(replace).toHaveBeenLastCalledWith({ path: '/ai/agent', query: {} })
    w.unmount()
  })

  it('A-8: a known ?session= needs no replace at all (already in the URL)', async () => {
    routeQuery.session = 's2'
    svc.listAgentSessions.mockResolvedValue([{ id: 's2' }])
    const store = useAgentStore()
    vi.spyOn(store, 'selectSession').mockImplementation(async (id) => {
      store.activeSessionId = id
    })
    const w = mountPage()
    await flushPromises()
    // Makes the found branch's participation observable: without the mount-time read
    // driving selectSession, activeSessionId would stay null instead of becoming 's2'.
    expect(store.activeSessionId).toBe('s2')
    expect(replace).not.toHaveBeenCalled()
    w.unmount()
  })

  // This guards Task 1's shared-ref discipline, not Task 2's read: if syncSessionQuery
  // built its replace query from route.query instead of the urlQuery ref, the mocked
  // replace() never writes back to routeQuery, so route.query would still hold
  // search:'cats' when the mirror fires after createSession() — replace #2 would then
  // resurrect search alongside the new session id, and the loop below would catch it.
  // Note: this cannot distinguish Task 2's own read using route.query vs. the ref —
  // route.query and the mock's routeQuery never diverge in this harness, so that
  // narrower substitution is invisible here (verified by mutation).
  it('A-8: ?session= + ?search= — search is stripped for good, final URL is the new session', async () => {
    routeQuery.session = 's1'
    routeQuery.search = 'cats'
    svc.listAgentSessions.mockResolvedValue([{ id: 's1' }])
    const store = useAgentStore()
    vi.spyOn(store, 'selectSession').mockResolvedValue(undefined)
    const createSpy = vi.spyOn(store, 'createSession').mockImplementation(async () => {
      store.activeSessionId = 'new-1'
    })
    const sendSpy = vi.spyOn(store, 'send').mockResolvedValue(undefined)
    const w = mountPage()
    await flushPromises()
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenNthCalledWith(1, { path: '/ai/agent', query: { session: 's1' } })
    expect(replace).toHaveBeenLastCalledWith({ path: '/ai/agent', query: { session: 'new-1' } })
    for (const [arg] of replace.mock.calls) expect(arg.query).not.toHaveProperty('search')
    w.unmount()
  })

  it('A-8: changing ?session= while mounted switches sessions (query-only nav does not re-mount)', async () => {
    svc.listAgentSessions.mockResolvedValue([{ id: 's1' }, { id: 's2' }])
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'selectSession').mockResolvedValue(undefined)
    const w = mountPage()
    await flushPromises()
    routeQuery.session = 's2'
    await flushPromises()
    expect(spy).toHaveBeenCalledWith('s2')
    w.unmount()
  })

  // Pins two guard clauses in the watcher: dropping `found &&` would throw on the unknown
  // id below instead of ignoring it, and dropping the `!== id` active-id comparison would
  // re-enter selectSession when re-navigating to the session that's already open.
  it('A-8: an unknown or already-active ?session= change is a no-op', async () => {
    svc.listAgentSessions.mockResolvedValue([{ id: 's1' }])
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'selectSession').mockResolvedValue(undefined)
    const w = mountPage()
    await flushPromises()
    store.activeSessionId = 's1'
    await flushPromises()
    spy.mockClear()
    routeQuery.session = 'nope'
    await flushPromises()
    expect(spy).not.toHaveBeenCalled()
    routeQuery.session = 's1'
    await flushPromises()
    expect(spy).not.toHaveBeenCalled()
    w.unmount()
  })

  // Pins the behavioral property, not a specific line: dropping ?session= from the URL
  // must not close the conversation the user is reading (a defect where the empty branch
  // also cleared activeSessionId would fail this). It does not isolate the watcher's
  // `if (!id) return` — that early return is redundant with the `found &&` check below it
  // for any realistic session list (no real session's id stringifies to ''), so this test
  // would still pass with that one line deleted; it is kept for readability, not correctness.
  it('A-8: dropping ?session= from the URL does not close the open conversation', async () => {
    routeQuery.session = 's1'
    svc.listAgentSessions.mockResolvedValue([{ id: 's1' }])
    const store = useAgentStore()
    vi.spyOn(store, 'selectSession').mockImplementation(async (id) => {
      store.activeSessionId = id
    })
    const w = mountPage()
    await flushPromises()
    delete routeQuery.session
    await flushPromises()
    expect(store.activeSessionId).toBe('s1')
    w.unmount()
  })

  // Final review Important 1: re-entering the page (settings gear, skill strip, homepage)
  // never clears agentStore's activeSessionId — this is a plain Pinia store, no KeepAlive
  // resets it. Without an else branch mirroring what the store already holds, the deep-link
  // block above (only entered when the URL itself names a session) is a no-op, and the
  // address bar names no session even though one is open.
  it('A-8: re-entering the page with a session already open writes it into ?session= (Important 1)', async () => {
    const store = useAgentStore()
    store.activeSessionId = 'sess-reentry'
    const w = mountPage()
    await flushPromises()
    expect(replace).toHaveBeenCalledWith({ path: '/ai/agent', query: { session: 'sess-reentry' } })
    w.unmount()
  })

  // Final review Important 2: loadSessions() rejection must not be conflated with "the
  // session list loaded and does not contain this id" — that would toast a false "deleted"
  // warning and strip a perfectly valid id a refresh could otherwise retry.
  it('A-8: a failed loadSessions() leaves a valid ?session= alone — no toast, no strip (Important 2)', async () => {
    routeQuery.session = 's1'
    svc.listAgentSessions.mockRejectedValue(new Error('offline'))
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'selectSession').mockResolvedValue(undefined)
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    const w = mountPage()
    await flushPromises()
    expect(spy).not.toHaveBeenCalled()
    expect(showSpy).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(routeQuery.session).toBe('s1')
    w.unmount()
  })
})
