import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'

// Right sidebar collapse state + current tab's minimal state/action set.
// vi.hoisted() service mock + setActivePinia pattern copied from agentStore.p1c.test.ts.
const svc = vi.hoisted(() => ({
  listAgentSessions: vi.fn(), createAgentSession: vi.fn(), deleteAgentSession: vi.fn(),
  listAgentMessages: vi.fn(), updateAgentSessionTitle: vi.fn(), regenerateAgentSessionTitle: vi.fn(),
  listModels: vi.fn(), listProviders: vi.fn(), cancelAgentRun: vi.fn(), confirmAgentAction: vi.fn(),
  listVisibleResources: vi.fn(), addVisibleResource: vi.fn(), removeVisibleResource: vi.fn(),
  listAttachments: vi.fn(), deleteAttachment: vi.fn(),
  listStagedChanges: vi.fn(), commitStagedChanges: vi.fn(),
  revertStagedRun: vi.fn(), revertStagedBatch: vi.fn(), revertStagedItems: vi.fn(),
  // Thinking domain (agentStore.js:656-687).
  getThinkingDefaults: vi.fn(), getSessionThinking: vi.fn(), patchSessionThinking: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: svc } }))
// autoTitleFirstTurn (via send()) takes the same regenerateTitle path,
// the test needs to control runAgentRun, so we changed here to named hoisted references
// (copied from agentStore.test.ts's runSpy/attachSpy pattern), Task2/Task3 existing test cases
// don't read these two references, unaffected.
const { runSpy, attachSpy } = vi.hoisted(() => ({
  runSpy: vi.fn(),
  attachSpy: vi.fn(),
}))
vi.mock('../services/agentTransport', () => ({
  runAgentRun: runSpy,
  attachAgentStream: attachSpy,
}))

import { useAgentStore } from './agentStore'

describe('agentStore P1c2 Task2: right sidebar collapse state + tab', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((fn) => fn.mockReset())
    localStorage.clear()
  })

  it('default values: rightCollapsed=false (open), rightTab="activity" (agentStore.js:37-38)', () => {
    const s = useAgentStore('p1c2-a')
    expect(s.rightCollapsed).toBe(false)
    expect(s.rightTab).toBe('activity')
  })

  it('setRightTab: switch currently active tab (agentStore.js:158)', () => {
    const s = useAgentStore('p1c2-b')
    s.setRightTab('context')
    expect(s.rightTab).toBe('context')
    s.setRightTab('system')
    expect(s.rightTab).toBe('system')
    s.setRightTab('resources')
    expect(s.rightTab).toBe('resources')
  })

  it('toggleRight: toggle rightCollapsed (agentStore.js:157)', () => {
    const s = useAgentStore('p1c2-c')
    expect(s.rightCollapsed).toBe(false)
    s.toggleRight()
    expect(s.rightCollapsed).toBe(true)
    s.toggleRight()
    expect(s.rightCollapsed).toBe(false)
  })

  it('tab selection does not persist: don\'t write to localStorage after switching tabs (different from theme/selectedModel)', () => {
    const s = useAgentStore('p1c2-d')
    s.setRightTab('system')
    expect(localStorage.length).toBe(0)
  })
})

// Store thinking domain (agentStore.js:656-698).
describe('agentStore P1c2 Task3: thinking domain (loaders/setters)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((fn) => fn.mockReset())
    localStorage.clear()
  })

  it('loadThinkingDefaults: write to defaults on success (agentStore.js:656-660)', async () => {
    const s = useAgentStore('p1c2-e1')
    svc.getThinkingDefaults.mockResolvedValue({ enabled: false, level: 'high' })
    await s.loadThinkingDefaults()
    expect(s.thinking.defaults).toEqual({ enabled: false, level: 'high' })
  })

  it('loadThinkingDefaults: swallow error and keep hardcoded fallback (agentStore.js:656-660, **swallow error**)', async () => {
    const s = useAgentStore('p1c2-e2')
    const before = { ...s.thinking.defaults }
    svc.getThinkingDefaults.mockRejectedValue(new Error('boom'))
    await expect(s.loadThinkingDefaults()).resolves.toBeUndefined()
    expect(s.thinking.defaults).toEqual(before)
  })

  it('loadSessionThinking: return directly without id, don\'t send request (agentStore.js:664)', async () => {
    const s = useAgentStore('p1c2-e3')
    await s.loadSessionThinking(null as unknown as string)
    expect(svc.getSessionThinking).not.toHaveBeenCalled()
  })

  it('loadSessionThinking: getSessionThinking returns null (no override), fall back to defaults (agentStore.js:666)', async () => {
    const s = useAgentStore('p1c2-e4')
    s.thinking.defaults = { enabled: false, level: 'low' }
    svc.getSessionThinking.mockResolvedValue(null)
    await s.loadSessionThinking('sess-1')
    expect(s.thinking.enabled).toBe(false)
    expect(s.thinking.level).toBe('low')
  })

  it('loadSessionThinking: getSessionThinking has value, only write enabled/level (agentStore.js:667-668)', async () => {
    const s = useAgentStore('p1c2-e5')
    svc.getSessionThinking.mockResolvedValue({ enabled: true, level: 'high' })
    await s.loadSessionThinking('sess-2')
    expect(svc.getSessionThinking).toHaveBeenCalledWith('sess-2')
    expect(s.thinking.enabled).toBe(true)
    expect(s.thinking.level).toBe('high')
  })

  it('setThinkingEnabled: no session, only change local, don\'t send patch request (agentStore.js:671-677)', async () => {
    const s = useAgentStore('p1c2-e6')
    await s.setThinkingEnabled(false)
    expect(s.thinking.enabled).toBe(false)
    expect(svc.patchSessionThinking).not.toHaveBeenCalled()
  })

  it('setThinkingEnabled: has session, optimistically change local first then patch, on failure **don\'t rollback** (agentStore.js:671-677, intentionally kept)', async () => {
    const s = useAgentStore('p1c2-e7')
    s.activeSessionId = 'sess-3'
    s.thinking.level = 'medium'
    svc.patchSessionThinking.mockRejectedValue(new Error('network'))
    await expect(s.setThinkingEnabled(false)).rejects.toThrow('network')
    // local state has been changed, and it wasn't rolled back due to patch failure
    expect(s.thinking.enabled).toBe(false)
    expect(svc.patchSessionThinking).toHaveBeenCalledWith('sess-3', { enabled: false, level: 'medium' })
  })

  it('setThinkingLevel: no session, only change local, don\'t send patch request (agentStore.js:680-686)', async () => {
    const s = useAgentStore('p1c2-e8')
    await s.setThinkingLevel('high')
    expect(s.thinking.level).toBe('high')
    expect(svc.patchSessionThinking).not.toHaveBeenCalled()
  })

  it('setThinkingLevel: has session, optimistically change local first then patch, on failure **don\'t rollback** (agentStore.js:680-686, intentionally kept)', async () => {
    const s = useAgentStore('p1c2-e9')
    s.activeSessionId = 'sess-4'
    s.thinking.enabled = true
    svc.patchSessionThinking.mockRejectedValue(new Error('network'))
    await expect(s.setThinkingLevel('low')).rejects.toThrow('network')
    expect(s.thinking.level).toBe('low')
    expect(svc.patchSessionThinking).toHaveBeenCalledWith('sess-4', { enabled: true, level: 'low' })
  })

  it('setThinkingLevel: has session and patch succeeds, resolve normally', async () => {
    const s = useAgentStore('p1c2-e10')
    s.activeSessionId = 'sess-5'
    svc.patchSessionThinking.mockResolvedValue(undefined)
    await s.setThinkingLevel('high')
    expect(s.thinking.level).toBe('high')
    expect(svc.patchSessionThinking).toHaveBeenCalledWith('sess-5', { enabled: true, level: 'high' })
  })
})

// Store regenerateTitle (ported from agentStore.js:210-244) +
// regeneratingTitleFor, and autoTitleFirstTurn changed to take the same path.
describe('agentStore P1c2 Task4: regenerateTitle + regeneratingTitleFor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((fn) => fn.mockReset())
    runSpy.mockReset().mockResolvedValue(undefined)
    attachSpy.mockReset().mockResolvedValue({ attached: false })
    localStorage.clear()
  })

  it('return directly when no selectedModel, don\'t send request (agentStore.js:212-213)', async () => {
    const s = useAgentStore('p1c2-title-a')
    s.selectedModel = null
    await s.regenerateTitle('sess-1')
    expect(svc.regenerateAgentSessionTitle).not.toHaveBeenCalled()
    expect(s.regeneratingTitleFor).toBeNull()
  })

  it('selectedModel has no colon at all (malformed key), return directly — Vue2-exclusive guard (agentStore.js:214-215), parseModelKey itself is not equivalent to this', async () => {
    const s = useAgentStore('p1c2-title-b')
    s.selectedModel = 'not-a-valid-key'
    await s.regenerateTitle('sess-1')
    expect(svc.regenerateAgentSessionTitle).not.toHaveBeenCalled()
  })

  it('local key: parse out bare model name, fall back to ollama when provider_type has no match (agentStore.js:216-220, 228)', async () => {
    const s = useAgentStore('p1c2-title-c')
    s.availableModels = []
    s.selectedModel = 'local:llama'
    svc.regenerateAgentSessionTitle.mockResolvedValue({})
    await s.regenerateTitle('sess-1')
    expect(svc.regenerateAgentSessionTitle).toHaveBeenCalledWith('sess-1', 'llama', 'ollama')
  })

  it('cloud key: parse out bare model name, providerType takes the provider_type of the matched model (agentStore.js:221-224, 227-228)', async () => {
    const s = useAgentStore('p1c2-title-d')
    s.availableModels = [
      { key: 'cloud:p1:chat', source: 'cloud', displayName: 'chat', provider_type: 'deepseek' },
    ]
    s.selectedModel = 'cloud:p1:chat'
    svc.regenerateAgentSessionTitle.mockResolvedValue({})
    await s.regenerateTitle('sess-1')
    expect(svc.regenerateAgentSessionTitle).toHaveBeenCalledWith('sess-1', 'chat', 'deepseek')
  })

  it('when cloud key has no matched model, providerType falls back to other (agentStore.js:228)', async () => {
    const s = useAgentStore('p1c2-title-e')
    s.availableModels = []
    s.selectedModel = 'cloud:p1:chat'
    svc.regenerateAgentSessionTitle.mockResolvedValue({})
    await s.regenerateTitle('sess-1')
    expect(svc.regenerateAgentSessionTitle).toHaveBeenCalledWith('sess-1', 'chat', 'other')
  })

  it('on success and non-empty title, write back to sessions[idx].title (agentStore.js:232-237)', async () => {
    const s = useAgentStore('p1c2-title-f')
    s.availableModels = [{ key: 'local:llama', source: 'local', displayName: 'llama' }]
    s.selectedModel = 'local:llama'
    s.sessions = [{ id: 'sess-1', title: '' }]
    svc.regenerateAgentSessionTitle.mockResolvedValue({ title: 'Generated Title' })
    await s.regenerateTitle('sess-1')
    expect(s.sessions[0].title).toBe('Generated Title')
  })

  it('when title is empty (falsy), don\'t write back (agentStore.js:234)', async () => {
    const s = useAgentStore('p1c2-title-g')
    s.availableModels = [{ key: 'local:llama', source: 'local', displayName: 'llama' }]
    s.selectedModel = 'local:llama'
    s.sessions = [{ id: 'sess-1', title: 'keep-me' }]
    svc.regenerateAgentSessionTitle.mockResolvedValue({})
    await s.regenerateTitle('sess-1')
    expect(s.sessions[0].title).toBe('keep-me')
  })

  it('failure is swallowed (only console.warn), promise still resolves, regeneratingTitleFor is reset (agentStore.js:238-243, intentionally kept)', async () => {
    const s = useAgentStore('p1c2-title-h')
    s.availableModels = [{ key: 'local:llama', source: 'local', displayName: 'llama' }]
    s.selectedModel = 'local:llama'
    svc.regenerateAgentSessionTitle.mockRejectedValue(new Error('network'))
    await expect(s.regenerateTitle('sess-1')).resolves.toBeUndefined()
    expect(s.regeneratingTitleFor).toBeNull()
  })

  it('background flag is passed through + regeneratingTitleFor is an object ({id, background}) not a boolean (agentStore.js:230, top bar relies on it to distinguish auto/manual)', async () => {
    const s = useAgentStore('p1c2-title-i')
    s.availableModels = [{ key: 'local:llama', source: 'local', displayName: 'llama' }]
    s.selectedModel = 'local:llama'
    let resolveFn: (v: unknown) => void = () => {}
    svc.regenerateAgentSessionTitle.mockReturnValue(new Promise((resolve) => { resolveFn = resolve }))
    const p = s.regenerateTitle('sess-1', { background: true })
    // before resolve, regeneratingTitleFor has already synchronously landed on { id, background: true }.
    expect(s.regeneratingTitleFor).toEqual({ id: 'sess-1', background: true })
    resolveFn({ title: 'X' })
    await p
    expect(s.regeneratingTitleFor).toBeNull()
  })

  it('background defaults to false (when opts not passed, agentStore.js:210)', async () => {
    const s = useAgentStore('p1c2-title-j')
    s.availableModels = [{ key: 'local:llama', source: 'local', displayName: 'llama' }]
    s.selectedModel = 'local:llama'
    let resolveFn: (v: unknown) => void = () => {}
    svc.regenerateAgentSessionTitle.mockReturnValue(new Promise((resolve) => { resolveFn = resolve }))
    const p = s.regenerateTitle('sess-1')
    expect(s.regeneratingTitleFor).toEqual({ id: 'sess-1', background: false })
    resolveFn({})
    await p
  })

  it('autoTitleFirstTurn (send() first-turn title supplement) delegates to regenerateTitle (id, {background: true}) — two implementations don\'t coexist (agentStore.js:413-419)', async () => {
    svc.regenerateAgentSessionTitle.mockResolvedValue({ title: 'Auto Generated' })
    const s = useAgentStore('p1c2-title-k')
    s.availableModels = [{ key: 'local:llama', source: 'local', displayName: 'llama', provider_type: 'ollama' }]
    s.selectedModel = 'local:llama'
    s.activeSessionId = 'sess-1'
    s.sessions = [{ id: 'sess-1', title: '' }]
    await s.send('hello')
    // autoTitleFirstTurn is a fire-and-forget call in send()'s finally block, let its internal
    // microtasks (regenerateTitle's await + writing back title) run first before asserting.
    await flushPromises()
    expect(svc.regenerateAgentSessionTitle).toHaveBeenCalledWith('sess-1', 'llama', 'ollama')
    expect(s.sessions[0].title).toBe('Auto Generated')
  })

  it('when autoTitleFirstTurn fails, it doesn\'t affect send()\'s current result (fire-and-forget + swallow error, agentStore.js:416-417)', async () => {
    svc.regenerateAgentSessionTitle.mockRejectedValue(new Error('boom'))
    const s = useAgentStore('p1c2-title-l')
    s.availableModels = [{ key: 'local:llama', source: 'local', displayName: 'llama', provider_type: 'ollama' }]
    s.selectedModel = 'local:llama'
    s.activeSessionId = 'sess-1'
    s.sessions = [{ id: 'sess-1', title: '' }]
    await expect(s.send('hello')).resolves.toBeUndefined()
    expect(s.busy).toBe(false)
  })
})

// Vue2 legacy bug fix: activitySteps is never cleared.
// In Vue2 store/agentStore.js, activitySteps is declared at :39, pushed at :128, patched at :137-140,
// no clearing point in entire file; switching sessions (:246-293) / creating new (:166-183) / deleting
// current session (:185-192) don't reset — previous session's running steps will remain in right sidebar.
describe('agentStore P1c2 Task13: activitySteps cleared at session boundary (Vue2 bug fix)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((fn) => fn.mockReset())
    runSpy.mockReset()
    attachSpy.mockReset()
    localStorage.clear()
    svc.listAgentMessages.mockResolvedValue([])
    svc.listVisibleResources.mockResolvedValue([])
    svc.listAttachments.mockResolvedValue([])
    svc.listStagedChanges.mockResolvedValue([])
    attachSpy.mockResolvedValue({ attached: false, error: null })
  })

  it('session A runs out steps → switch to session B → activitySteps is empty', async () => {
    const s = useAgentStore('p1c2-act-a')
    s.activeSessionId = 'sess-A'
    s.pushActivityStep({ name: 'nimoos_search' })
    s.pushActivityStep({ name: 'read_file' })
    expect(s.activitySteps.map((x) => x.name)).toEqual(['nimoos_search', 'read_file'])

    // Forbidden: must not `await store.selectSession(...)` (it awaits attach stream, doesn't
    // resolve when run is active). Clearing point is before the first await in selectSession
    // (right after activeSessionId switch), so you can assert synchronously right after calling.
    void s.selectSession('sess-B')
    expect(s.activitySteps).toEqual([])

    // Let the internal await chain settle, confirm that no subsequent steps write the old data back
    // (attach miss → no replay event).
    await flushPromises()
    expect(s.activeSessionId).toBe('sess-B')
    expect(s.activitySteps).toEqual([])
  })

  it('create new session → activitySteps is empty (session boundary cleanup same as messages)', async () => {
    svc.createAgentSession.mockResolvedValue({ session_id: 'sess-new' })
    const s = useAgentStore('p1c2-act-b')
    s.activeSessionId = 'sess-A'
    s.pushActivityStep({ name: 'write_file' })
    expect(s.activitySteps.length).toBe(1)

    await s.createSession()
    expect(s.activeSessionId).toBe('sess-new')
    expect(s.messages).toEqual([])
    expect(s.activitySteps).toEqual([])
  })

  it('delete current session → activitySteps is empty', async () => {
    svc.deleteAgentSession.mockResolvedValue({})
    const s = useAgentStore('p1c2-act-c')
    s.activeSessionId = 'sess-A'
    s.sessions = [{ id: 'sess-A', title: 'A' }]
    s.pushActivityStep({ name: 'write_file' })

    await s.deleteSession('sess-A')
    expect(s.activeSessionId).toBe(null)
    expect(s.activitySteps).toEqual([])
  })

  it('deleted session is not current → activitySteps preserved (condition branch matches messages, agentStore.js:185-192)', async () => {
    svc.deleteAgentSession.mockResolvedValue({})
    const s = useAgentStore('p1c2-act-d')
    s.activeSessionId = 'sess-A'
    s.sessions = [{ id: 'sess-A', title: 'A' }, { id: 'sess-B', title: 'B' }]
    s.pushActivityStep({ name: 'write_file' })

    await s.deleteSession('sess-B')
    expect(s.activeSessionId).toBe('sess-A')
    expect(s.activitySteps.map((x) => x.name)).toEqual(['write_file'])
  })
})
