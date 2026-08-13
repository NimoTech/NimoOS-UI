import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const svc = vi.hoisted(() => ({
  listAgentSessions: vi.fn(),
  createAgentSession: vi.fn(),
  deleteAgentSession: vi.fn(),
  listAgentMessages: vi.fn(),
  updateAgentSessionTitle: vi.fn(),
  regenerateAgentSessionTitle: vi.fn(),
  listModels: vi.fn(),
  listProviders: vi.fn(),
  cancelAgentRun: vi.fn(),
  confirmAgentAction: vi.fn(),
  listVisibleResources: vi.fn(),
  listAttachments: vi.fn(),
  listStagedChanges: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: svc } }))

// Task 6 transport is a separate module — mocked here so Task 7 (send/stop/
// continueRun/attach) can be tested without a real SSE/fetch stack.
const { runSpy, attachSpy } = vi.hoisted(() => ({
  runSpy: vi.fn(),
  attachSpy: vi.fn(),
}))
vi.mock('../services/agentTransport', () => ({
  runAgentRun: runSpy,
  attachAgentStream: attachSpy,
}))

import { useAgentStore, buildCloudModelList } from './agentStore'

const LOCAL_MODEL = {
  key: 'local:llama',
  source: 'local' as const,
  displayName: 'llama',
  supports_thinking: false,
  provider_type: 'ollama',
}

describe('agentStore (session slice)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((fn) => fn.mockReset())
    runSpy.mockReset().mockResolvedValue(undefined)
    attachSpy.mockReset().mockResolvedValue({ attached: false })
    svc.cancelAgentRun.mockResolvedValue(undefined)
    svc.confirmAgentAction.mockResolvedValue(undefined)
    svc.regenerateAgentSessionTitle.mockResolvedValue({})
    // Real response envelope is bare array (see comments on the two defect-regression test cases below),
    // not { data: [...] }
    svc.listModels.mockResolvedValue([])
    svc.listProviders.mockResolvedValue([])
    localStorage.clear()
  })

  it('factory: generates independent store instances by agentType, reuses same instance for same type (Pinia deduplicates by id)', () => {
    const a1 = useAgentStore('photos')
    const a2 = useAgentStore('photos')
    const g = useAgentStore()
    expect(a1).toBe(a2)
    expect(a1).not.toBe(g)
  })

  it('loadSessions: loads session list (body is array, no second-level envelope unpacking)', async () => {
    svc.listAgentSessions.mockResolvedValue([{ id: '1', title: 'hello' }])
    const s = useAgentStore()
    await s.loadSessions()
    expect(s.sessions).toEqual([{ id: '1', title: 'hello' }])
  })

  it('loadSessions: when body is not array, return empty array', async () => {
    svc.listAgentSessions.mockResolvedValue(null)
    const s = useAgentStore()
    await s.loadSessions()
    expect(s.sessions).toEqual([])
  })

  it('createSession: id normalization — when create returns session_id, use session_id', async () => {
    svc.createAgentSession.mockResolvedValue({ session_id: 'sid-1', title: null })
    const s = useAgentStore()
    s.sessions.push({ id: 'old', title: 'old session' })
    await s.createSession()
    expect(s.sessions[0].id).toBe('sid-1')
    expect(s.sessions.length).toBe(2)
    expect(s.activeSessionId).toBe('sid-1')
    expect(s.messages).toEqual([])
  })

  it('createSession: id normalization — when response has only id, fall back to id (list interface shape)', async () => {
    svc.createAgentSession.mockResolvedValue({ id: 'id-2', title: 'foo' })
    const s = useAgentStore()
    await s.createSession()
    expect(s.sessions[0].id).toBe('id-2')
    expect(s.activeSessionId).toBe('id-2')
  })

  it('createSession: unshift to list head and clear messages', async () => {
    svc.createAgentSession.mockResolvedValue({ session_id: 'sid-3' })
    const s = useAgentStore()
    s.messages.push({ role: 'user', content: 'leftover' })
    s.sessions.push({ id: 'existing' })
    await s.createSession()
    expect(s.sessions.map((x) => x.id)).toEqual(['sid-3', 'existing'])
    expect(s.messages).toEqual([])
  })

  it('deleteSession: deleting non-current session does not clear activeSessionId', async () => {
    svc.deleteAgentSession.mockResolvedValue(undefined)
    const s = useAgentStore()
    s.sessions.push({ id: 'a' }, { id: 'b' })
    s.activeSessionId = 'a'
    await s.deleteSession('b')
    expect(s.sessions.map((x) => x.id)).toEqual(['a'])
    expect(s.activeSessionId).toBe('a')
  })

  it('deleteSession: deleting current session clears activeSessionId and messages', async () => {
    svc.deleteAgentSession.mockResolvedValue(undefined)
    const s = useAgentStore()
    s.sessions.push({ id: 'a' }, { id: 'b' })
    s.activeSessionId = 'a'
    s.messages.push({ role: 'user', content: 'hi' })
    await s.deleteSession('a')
    expect(s.sessions.map((x) => x.id)).toEqual(['b'])
    expect(s.activeSessionId).toBeNull()
    expect(s.messages).toEqual([])
  })

  it('setSessionTitle: optimistic update — write local first, then wait for API', async () => {
    let resolveApi: () => void
    svc.updateAgentSessionTitle.mockReturnValue(new Promise<void>((r) => { resolveApi = r }))
    const s = useAgentStore()
    s.sessions.push({ id: 'a', title: 'old' })
    const p = s.setSessionTitle('a', 'new title')
    expect(s.sessions[0].title).toBe('new title')
    resolveApi!()
    await p
    expect(s.sessions[0].title).toBe('new title')
    expect(svc.updateAgentSessionTitle).toHaveBeenCalledWith('a', 'new title')
  })

  it('setSessionTitle: on API failure, rollback to old title', async () => {
    svc.updateAgentSessionTitle.mockRejectedValue(new Error('boom'))
    const s = useAgentStore()
    s.sessions.push({ id: 'a', title: 'old' })
    await s.setSessionTitle('a', 'new title')
    expect(s.sessions[0].title).toBe('old')
  })

  it('setSessionTitle: blank title is ignored directly, no API call', async () => {
    const s = useAgentStore()
    s.sessions.push({ id: 'a', title: 'old' })
    await s.setSessionTitle('a', '   ')
    expect(svc.updateAgentSessionTitle).not.toHaveBeenCalled()
    expect(s.sessions[0].title).toBe('old')
  })

  it('selectSession: load messages and await attach after loading (default mock miss → clear busy)', async () => {
    svc.listAgentMessages.mockResolvedValue([{ role: 'user', content: 'hi' }])
    const s = useAgentStore()
    await s.selectSession('sess-1')
    expect(s.activeSessionId).toBe('sess-1')
    expect(s.messages).toEqual([{ role: 'user', content: 'hi' }])
    expect(svc.listAgentMessages).toHaveBeenCalledWith('sess-1')
    expect(attachSpy).toHaveBeenCalledWith('sess-1', expect.anything(), expect.anything())
    expect(s.busy).toBe(false)
  })

  it('selectSession: when attach hits running stream (attached:true), keep busy (wait for done event to self-flip)', async () => {
    svc.listAgentMessages.mockResolvedValue([])
    attachSpy.mockResolvedValueOnce({ attached: true })
    const s = useAgentStore('t-attach-true')
    await s.selectSession('sess-attached')
    expect(s.busy).toBe(true)
  })

  it('selectSession: when body is not array, return empty array', async () => {
    svc.listAgentMessages.mockResolvedValue(null)
    const s = useAgentStore()
    await s.selectSession('sess-2')
    expect(s.messages).toEqual([])
  })

  it('initTheme: localStorage takes priority', () => {
    localStorage.setItem('nimoos.ai.agent.theme', 'dark')
    const s = useAgentStore()
    s.initTheme()
    expect(s.theme).toBe('dark')
  })

  it('initTheme: without localStorage, check matchMedia(prefers-color-scheme: dark)', () => {
    const matchMediaMock = vi.fn().mockReturnValue({ matches: true })
    vi.stubGlobal('matchMedia', matchMediaMock)
    const s = useAgentStore()
    s.initTheme()
    expect(s.theme).toBe('dark')
    expect(matchMediaMock).toHaveBeenCalledWith('(prefers-color-scheme: dark)')
    vi.unstubAllGlobals()
  })

  it('initTheme: default to light when both lack', () => {
    const matchMediaMock = vi.fn().mockReturnValue({ matches: false })
    vi.stubGlobal('matchMedia', matchMediaMock)
    const s = useAgentStore()
    s.initTheme()
    expect(s.theme).toBe('light')
    vi.unstubAllGlobals()
  })

  it('toggleTheme: flip and write back to same localStorage key', () => {
    const s = useAgentStore()
    // SP8-P2a Task 4: deleted line `s.theme = 'light'`. The setup of the original
    // assertion was actually redundant — each test before `beforeEach` does
    // `setActivePinia(createPinia())` rebuilding a fresh store, and aiTheme's
    // initial value is already 'light' (see aiTheme.ts), so this line never
    // truly changed the assertion premise. After Task 4 delegated `theme` to
    // `computed(() => aiTheme.theme)`, it changed from writable ref to read-only
    // computed, and direct assignment triggers both TS2540 (compile-time read-only
    // check) and Vue runtime warning (`Set operation on key "theme" failed: target
    // is readonly`). The assertion body (two toggleTheme flips light⇄dark and
    // persists) unchanged.
    s.toggleTheme()
    expect(s.theme).toBe('dark')
    expect(localStorage.getItem('nimoos.ai.agent.theme')).toBe('dark')
    s.toggleTheme()
    expect(s.theme).toBe('light')
    expect(localStorage.getItem('nimoos.ai.agent.theme')).toBe('light')
  })

  it('initial state (fresh store): busy===false, rightCollapsed defaults to open (false)', () => {
    // Note: busy can be flipped by setBusy/setStreamingDone starting this task (P1b);
    // this only asserts a fresh store's initial value, no longer assumes busy "never
    // written". pendingPrompt already removed in Task 11 (from 1b, send() sends
    // directly, no longer needs staging). rightCollapsed assertion changed from true
    // to false in SP8-P1c2 — in 1a phase right panel not yet implemented so hard-coded
    // closed (true); this period store state + top-bar toggle landed, reverted to Vue2
    // agentStore.js:37 default (open). See agentStore.p1c2.test.ts.
    const s = useAgentStore()
    expect(s.busy).toBe(false)
    expect(s.rightCollapsed).toBe(false)
  })

  it('toggleLeft: flip leftCollapsed', () => {
    const s = useAgentStore()
    const before = s.leftCollapsed
    s.toggleLeft()
    expect(s.leftCollapsed).toBe(!before)
  })

  it('startAssistant + appendBlock + patchBlock roundtrip', () => {
    const s = useAgentStore('t-prims')
    s.startAssistant()
    expect(s.messages[s.messages.length - 1]).toMatchObject({ role: 'assistant', blocks: [], streaming: true })
    s.appendBlock({ type: 'md', text: 'hi', streaming: true })
    const ok = s.patchBlock(b => b.type === 'md' && !!b.streaming, old => ({ text: (old.text as string) + '!' }))
    expect(ok).toBe(true)
    expect((s.messages[s.messages.length - 1] as any).blocks[0].text).toBe('hi!')
  })

  it('setStreamingDone flips busy false and clears streaming', () => {
    const s = useAgentStore('t-done'); s.setBusy(true); s.startAssistant(); s.setStreamingDone()
    expect(s.busy).toBe(false)
    expect((s.messages[s.messages.length - 1] as any).streaming).toBe(false)
  })

  it('patchAssistantStats merges stats on last assistant', () => {
    const s = useAgentStore('t-stats'); s.startAssistant()
    s.patchAssistantStats({ ttftMs: 12 }); s.patchAssistantStats({ outputTokens: 5 })
    expect((s.messages[s.messages.length - 1] as any).stats).toMatchObject({ ttftMs: 12, outputTokens: 5 })
  })

  it('pushActivityStep + markRunningStepDone', () => {
    const s = useAgentStore('t-steps'); s.pushActivityStep({ name: 'ls' })
    expect(s.activitySteps[s.activitySteps.length - 1]).toMatchObject({ name: 'ls', state: 'running' })
    s.markRunningStepDone()
    expect(s.activitySteps[s.activitySteps.length - 1]).toMatchObject({ state: 'success' })
  })

  it('pushUserMessage: push user message with id/role/content/attachments', () => {
    const s = useAgentStore('t-user')
    s.pushUserMessage('hello', [{ id: 'f1' }])
    const last = s.messages[s.messages.length - 1] as any
    expect(last.role).toBe('user')
    expect(last.content).toBe('hello')
    expect(last.attachments).toEqual([{ id: 'f1' }])
    expect(typeof last.id).toBe('string')
  })

  it('selectSession: migrate legacy messages via migrateLegacyMessages (run_command → terminal)', async () => {
    svc.listAgentMessages.mockResolvedValue([
      {
        id: 'm1',
        role: 'assistant',
        blocks: [
          {
            type: 'tool',
            name: 'run_command',
            sections: [
              { label: 'ARGUMENTS', code: '{"command":"ls"}' },
              { label: 'RESULT', code: '[exit 0]\nfile.txt' },
            ],
          },
        ],
      },
    ])
    const s = useAgentStore('t-migrate')
    await s.selectSession('sess-migrate')
    const last = s.messages[s.messages.length - 1] as any
    expect(last.blocks[0]).toMatchObject({ type: 'terminal', command: 'ls', state: 'success' })
  })
})

describe('agentStore (Task 7: send/stop/continueRun/confirm + model bootstrap)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((fn) => fn.mockReset())
    runSpy.mockReset().mockResolvedValue(undefined)
    attachSpy.mockReset().mockResolvedValue({ attached: false })
    svc.cancelAgentRun.mockResolvedValue(undefined)
    svc.confirmAgentAction.mockResolvedValue(undefined)
    svc.regenerateAgentSessionTitle.mockResolvedValue({})
    // Real response envelope is bare array (see comments on the two defect-regression test cases below),
    // not { data: [...] }
    svc.listModels.mockResolvedValue([])
    svc.listProviders.mockResolvedValue([])
    localStorage.clear()
  })

  it('buildCloudModelList: only include favorite models under enabled providers', () => {
    const list = buildCloudModelList([
      {
        id: 'p1',
        name: 'DeepSeek',
        enabled: true,
        provider_type: 'deepseek',
        models: [
          { name: 'chat', favorite: true, supports_thinking: true },
          { name: 'other', favorite: false },
        ],
      },
      { id: 'p2', name: 'Disabled', enabled: false, models: [{ name: 'x', favorite: true }] },
    ])
    expect(list).toEqual([{
      key: 'cloud:p1:chat',
      source: 'cloud',
      displayName: 'chat',
      providerName: 'DeepSeek',
      providerId: 'p1',
      supports_thinking: true,
      provider_type: 'deepseek',
    }])
  })

  // ── Defect regression: loadAvailableModels unpacks extra `.data` layer, causing
  // top-bar ModelPicker to always be empty ──
  // Real envelope: `GET /v1/ai/models` (route/v2/models.go:30) and `GET /v1/ai/providers`
  // (route/v2/providers.go:95) backend both `c.JSON(200, <slice>)` directly output
  // **bare array**; shared package `service.ai.*` internally does `return res.data`
  // to strip the axios layer, what it returns to caller is the HTTP body itself.
  // So consuming end can only do **single-level** data extraction — exactly what the
  // file header comment :120-127 locks down: "do not unpack extra `.data` layer",
  // while loadAvailableModels was the only violating place in the whole file.
  // Old test mocked with `{ data: [...] }` this non-existent shape, encoding the
  // defect into the assertion; 2296 cases all pass but couldn't catch it; same repo
  // settingsStore.test.ts:334 mocks same method as bare array (correct), contradiction
  // between the two is the clue.
  it('loadAvailableModels: when providers is bare array (real envelope), cloud models must enter list', async () => {
    svc.listModels.mockResolvedValue([])
    svc.listProviders.mockResolvedValue([
      {
        id: 1,
        name: '火山',
        enabled: true,
        provider_type: 'other',
        models: [{ name: 'doubao-seed-2-1-pro-260628', favorite: true, supports_thinking: false }],
      },
    ])
    const s = useAgentStore('t-bare-providers')
    await s.loadAvailableModels()
    expect(s.availableModels.map((m) => m.key)).toEqual(['cloud:1:doubao-seed-2-1-pro-260628'])
    expect(s.selectedModel).toBe('cloud:1:doubao-seed-2-1-pro-260628')
  })

  it('loadAvailableModels: when models is bare array (real envelope), local models must enter list', async () => {
    svc.listModels.mockResolvedValue([{ name: 'llama', size_bytes: 123, supports_thinking: false }])
    svc.listProviders.mockResolvedValue([])
    const s = useAgentStore('t-bare-models')
    await s.loadAvailableModels()
    expect(s.availableModels.map((m) => m.key)).toEqual(['local:llama'])
  })

  it('loadAvailableModels: local model is fallback priority for default selection', async () => {
    svc.listModels.mockResolvedValue([{ name: 'llama', size_bytes: 123, supports_thinking: false }])
    const s = useAgentStore('t-models')
    await s.loadAvailableModels()
    expect(s.selectedModel).toMatch(/^local:/)
  })

  it('loadAvailableModels: if stored key in localStorage still in new list, reuse it', async () => {
    localStorage.setItem('nimoos.ai.agent.selectedModel', 'local:mistral')
    svc.listModels.mockResolvedValue([{ name: 'llama' }, { name: 'mistral' }])
    const s = useAgentStore('t-models-stored')
    await s.loadAvailableModels()
    expect(s.selectedModel).toBe('local:mistral')
  })

  it('selectModel: ignore keys not in list, only legal keys persist + refresh thinking', () => {
    const s = useAgentStore('t-select-model')
    s.availableModels = [{ ...LOCAL_MODEL, supports_thinking: true }]
    s.selectModel('local:not-exist')
    expect(s.selectedModel).toBeNull()
    s.selectModel('local:llama')
    expect(s.selectedModel).toBe('local:llama')
    expect(localStorage.getItem('nimoos.ai.agent.selectedModel')).toBe('local:llama')
    expect(s.thinking.supportsThinking).toBe(true)
  })

  it('send guards on busy (no double-run)', async () => {
    const s = useAgentStore('t-send')
    s.setBusy(true)
    await s.send('hi')
    expect(runSpy).not.toHaveBeenCalled()
  })

  it('send with no model appends an error tool block', async () => {
    const s = useAgentStore('t-nomodel')
    s.availableModels = []
    s.selectedModel = null
    await s.send('hi')
    const last: any = s.messages[s.messages.length - 1]
    expect(last.blocks.some((b: any) => b.type === 'tool' && b.state === 'error')).toBe(true)
    expect(runSpy).not.toHaveBeenCalled()
  })

  it('send happy path: pushes user + assistant, calls runAgentRun with model+providerType', async () => {
    const s = useAgentStore('t-happy')
    s.availableModels = [LOCAL_MODEL]
    s.selectModel('local:llama')
    s.activeSessionId = 'sess1'
    await s.send('hello')
    expect(runSpy).toHaveBeenCalledWith(
      'sess1',
      expect.objectContaining({ message: 'hello', model: 'llama' }),
      'ollama',
      expect.anything(),
      expect.anything(),
      expect.any(Function),
      expect.anything(),
    )
    const userMsg = s.messages[s.messages.length - 2] as any
    const assistantMsg = s.messages[s.messages.length - 1] as any
    expect(userMsg).toMatchObject({ role: 'user', content: 'hello' })
    expect(assistantMsg.role).toBe('assistant')
    expect(s.busy).toBe(false) // runAgentRun resolved (mock), finally clears busy
  })

  it('send: onError (dual-shape {status,body}) appends error tool block and ends streaming', async () => {
    runSpy.mockImplementation(async (_sid: unknown, _body: unknown, _pt: unknown, _sig: unknown, _actions: unknown, onError: (e: unknown) => void) => {
      onError({ status: 500, body: { message: 'boom' } })
    })
    const s = useAgentStore('t-onerror')
    s.availableModels = [LOCAL_MODEL]
    s.selectModel('local:llama')
    s.activeSessionId = 'sess1'
    await s.send('hi')
    const last: any = s.messages[s.messages.length - 1]
    expect(last.blocks.some((b: any) => b.type === 'tool' && b.state === 'error' && b.name === 'request')).toBe(true)
    expect(s.busy).toBe(false)
  })

  it('send: when no activeSessionId, createSession first', async () => {
    svc.createAgentSession.mockResolvedValue({ session_id: 'new-sess' })
    const s = useAgentStore('t-autocreate')
    s.availableModels = [LOCAL_MODEL]
    s.selectModel('local:llama')
    await s.send('hi')
    expect(svc.createAgentSession).toHaveBeenCalled()
    expect(runSpy).toHaveBeenCalledWith('new-sess', expect.anything(), 'ollama', expect.anything(), expect.anything(), expect.any(Function), expect.anything())
  })

  it('confirmAgentAction delegates to service', async () => {
    const s = useAgentStore('t-confirm')
    s.activeSessionId = 'x'
    await s.confirmAgentAction('c1', true)
    expect(svc.confirmAgentAction).toHaveBeenCalledWith('x', 'c1', true, false)
  })

  it('confirmAgentAction: when no activeSessionId, return directly, no service call', async () => {
    const s = useAgentStore('t-confirm-noop')
    await s.confirmAgentAction('c1', true)
    expect(svc.confirmAgentAction).not.toHaveBeenCalled()
  })

  it('stop: abort current stream + call cancelAgentRun + end streaming', async () => {
    const s = useAgentStore('t-stop')
    s.activeSessionId = 'sess1'
    s.availableModels = [LOCAL_MODEL]
    s.selectModel('local:llama')
    // runSpy never settles, simulating an in-flight stream — send() itself never
    // resolves either, so deliberately don't await/don't take its return, only care
    // about stop()'s own effect.
    void s.send('hi')
    await Promise.resolve() // let send() run to the sync prefix before await runAgentRun(...) (busy=true etc.)
    await s.stop()
    expect(s.busy).toBe(false)
    expect(svc.cancelAgentRun).toHaveBeenCalledWith('sess1')
  })

  it('continueRun: when busy, do not trigger again', async () => {
    const s = useAgentStore('t-continue-busy')
    s.setBusy(true)
    await s.continueRun()
    expect(runSpy).not.toHaveBeenCalled()
  })

  it('continueRun: when no activeSessionId/selectedModel, return directly', async () => {
    const s = useAgentStore('t-continue-noop')
    await s.continueRun()
    expect(runSpy).not.toHaveBeenCalled()
  })

  it('continueRun: happy path calls runAgentRun(continue_run:true) and marks latest max_turns block as resumed', async () => {
    const s = useAgentStore('t-continue-happy')
    s.availableModels = [LOCAL_MODEL]
    s.selectModel('local:llama')
    s.activeSessionId = 'sess1'
    s.messages.push({
      id: 'a1', role: 'assistant', blocks: [{ type: 'max_turns', resumed: false }],
    })
    await s.continueRun()
    expect(runSpy).toHaveBeenCalledWith(
      'sess1',
      expect.objectContaining({ continue_run: true, model: 'llama' }),
      'ollama',
      expect.anything(),
      expect.anything(),
      expect.any(Function),
      expect.anything(),
    )
    const marked = s.messages[0] as any
    expect(marked.blocks[0].resumed).toBe(true)
    expect(s.busy).toBe(false)
  })
})
