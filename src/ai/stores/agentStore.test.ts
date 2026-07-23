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
    svc.listModels.mockResolvedValue({ data: [] })
    svc.listProviders.mockResolvedValue({ data: [] })
    localStorage.clear()
  })

  it('工厂:按 agentType 生成独立 store 实例,同类型复用同一实例(Pinia 按 id 去重)', () => {
    const a1 = useAgentStore('photos')
    const a2 = useAgentStore('photos')
    const g = useAgentStore()
    expect(a1).toBe(a2)
    expect(a1).not.toBe(g)
  })

  it('loadSessions:装载会话列表(body 即数组,无信封二次拆包)', async () => {
    svc.listAgentSessions.mockResolvedValue([{ id: '1', title: 'hello' }])
    const s = useAgentStore()
    await s.loadSessions()
    expect(s.sessions).toEqual([{ id: '1', title: 'hello' }])
  })

  it('loadSessions:body 非数组时退空数组', async () => {
    svc.listAgentSessions.mockResolvedValue(null)
    const s = useAgentStore()
    await s.loadSessions()
    expect(s.sessions).toEqual([])
  })

  it('createSession:id 归一化——create 返回 session_id 时取 session_id', async () => {
    svc.createAgentSession.mockResolvedValue({ session_id: 'sid-1', title: null })
    const s = useAgentStore()
    s.sessions.push({ id: 'old', title: 'old session' })
    await s.createSession()
    expect(s.sessions[0].id).toBe('sid-1')
    expect(s.sessions.length).toBe(2)
    expect(s.activeSessionId).toBe('sid-1')
    expect(s.messages).toEqual([])
  })

  it('createSession:id 归一化——响应只带 id 时退回 id(列表接口形态)', async () => {
    svc.createAgentSession.mockResolvedValue({ id: 'id-2', title: 'foo' })
    const s = useAgentStore()
    await s.createSession()
    expect(s.sessions[0].id).toBe('id-2')
    expect(s.activeSessionId).toBe('id-2')
  })

  it('createSession:unshift 到列表头部并清空 messages', async () => {
    svc.createAgentSession.mockResolvedValue({ session_id: 'sid-3' })
    const s = useAgentStore()
    s.messages.push({ role: 'user', content: 'leftover' })
    s.sessions.push({ id: 'existing' })
    await s.createSession()
    expect(s.sessions.map((x) => x.id)).toEqual(['sid-3', 'existing'])
    expect(s.messages).toEqual([])
  })

  it('deleteSession:删除非当前会话时不清 activeSessionId', async () => {
    svc.deleteAgentSession.mockResolvedValue(undefined)
    const s = useAgentStore()
    s.sessions.push({ id: 'a' }, { id: 'b' })
    s.activeSessionId = 'a'
    await s.deleteSession('b')
    expect(s.sessions.map((x) => x.id)).toEqual(['a'])
    expect(s.activeSessionId).toBe('a')
  })

  it('deleteSession:删除当前会话时清 activeSessionId 与 messages', async () => {
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

  it('setSessionTitle:乐观更新——先本地写,再等 API', async () => {
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

  it('setSessionTitle:API 失败时回滚到旧标题', async () => {
    svc.updateAgentSessionTitle.mockRejectedValue(new Error('boom'))
    const s = useAgentStore()
    s.sessions.push({ id: 'a', title: 'old' })
    await s.setSessionTitle('a', 'new title')
    expect(s.sessions[0].title).toBe('old')
  })

  it('setSessionTitle:空白标题直接忽略,不调用 API', async () => {
    const s = useAgentStore()
    s.sessions.push({ id: 'a', title: 'old' })
    await s.setSessionTitle('a', '   ')
    expect(svc.updateAgentSessionTitle).not.toHaveBeenCalled()
    expect(s.sessions[0].title).toBe('old')
  })

  it('selectSession:装载消息,并在装载后 await attach(默认 mock 未命中→清 busy)', async () => {
    svc.listAgentMessages.mockResolvedValue([{ role: 'user', content: 'hi' }])
    const s = useAgentStore()
    await s.selectSession('sess-1')
    expect(s.activeSessionId).toBe('sess-1')
    expect(s.messages).toEqual([{ role: 'user', content: 'hi' }])
    expect(svc.listAgentMessages).toHaveBeenCalledWith('sess-1')
    expect(attachSpy).toHaveBeenCalledWith('sess-1', expect.anything(), expect.anything())
    expect(s.busy).toBe(false)
  })

  it('selectSession:attach 命中运行中的流(attached:true)时保持 busy(等 done 事件自己翻)', async () => {
    svc.listAgentMessages.mockResolvedValue([])
    attachSpy.mockResolvedValueOnce({ attached: true })
    const s = useAgentStore('t-attach-true')
    await s.selectSession('sess-attached')
    expect(s.busy).toBe(true)
  })

  it('selectSession:body 非数组时退空数组', async () => {
    svc.listAgentMessages.mockResolvedValue(null)
    const s = useAgentStore()
    await s.selectSession('sess-2')
    expect(s.messages).toEqual([])
  })

  it('initTheme:localStorage 优先', () => {
    localStorage.setItem('nimoos.ai.agent.theme', 'dark')
    const s = useAgentStore()
    s.initTheme()
    expect(s.theme).toBe('dark')
  })

  it('initTheme:无 localStorage 时看 matchMedia(prefers-color-scheme: dark)', () => {
    const matchMediaMock = vi.fn().mockReturnValue({ matches: true })
    vi.stubGlobal('matchMedia', matchMediaMock)
    const s = useAgentStore()
    s.initTheme()
    expect(s.theme).toBe('dark')
    expect(matchMediaMock).toHaveBeenCalledWith('(prefers-color-scheme: dark)')
    vi.unstubAllGlobals()
  })

  it('initTheme:两者都无时默认 light', () => {
    const matchMediaMock = vi.fn().mockReturnValue({ matches: false })
    vi.stubGlobal('matchMedia', matchMediaMock)
    const s = useAgentStore()
    s.initTheme()
    expect(s.theme).toBe('light')
    vi.unstubAllGlobals()
  })

  it('toggleTheme:翻转并写回 localStorage 同一 key', () => {
    const s = useAgentStore()
    s.theme = 'light'
    s.toggleTheme()
    expect(s.theme).toBe('dark')
    expect(localStorage.getItem('nimoos.ai.agent.theme')).toBe('dark')
    s.toggleTheme()
    expect(s.theme).toBe('light')
    expect(localStorage.getItem('nimoos.ai.agent.theme')).toBe('light')
  })

  it('初始态(新鲜 store):busy===false、rightCollapsed 恒 true、pendingPrompt 为 null', () => {
    // 注:busy 从本任务(P1b)起可被 setBusy/setStreamingDone 翻转,这里只断言
    // 一个全新 store 的初始值,不再假设 busy "永不写入"。
    const s = useAgentStore()
    expect(s.busy).toBe(false)
    expect(s.rightCollapsed).toBe(true)
    expect(s.pendingPrompt).toBeNull()
  })

  it('toggleLeft:翻转 leftCollapsed', () => {
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

  it('pushUserMessage:压入 user 消息带 id/role/content/attachments', () => {
    const s = useAgentStore('t-user')
    s.pushUserMessage('hello', [{ id: 'f1' }])
    const last = s.messages[s.messages.length - 1] as any
    expect(last.role).toBe('user')
    expect(last.content).toBe('hello')
    expect(last.attachments).toEqual([{ id: 'f1' }])
    expect(typeof last.id).toBe('string')
  })

  it('selectSession:通过 migrateLegacyMessages 迁移历史消息(run_command → terminal)', async () => {
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
    svc.listModels.mockResolvedValue({ data: [] })
    svc.listProviders.mockResolvedValue({ data: [] })
    localStorage.clear()
  })

  it('buildCloudModelList:仅收录 enabled provider 下 favorite 的模型', () => {
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

  it('loadAvailableModels:本地模型优先兜底默认选中', async () => {
    svc.listModels.mockResolvedValue({ data: [{ name: 'llama', size_bytes: 123, supports_thinking: false }] })
    const s = useAgentStore('t-models')
    await s.loadAvailableModels()
    expect(s.selectedModel).toMatch(/^local:/)
  })

  it('loadAvailableModels:localStorage 里存的 key 若仍在新列表中就沿用', async () => {
    localStorage.setItem('nimoos.ai.agent.selectedModel', 'local:mistral')
    svc.listModels.mockResolvedValue({ data: [{ name: 'llama' }, { name: 'mistral' }] })
    const s = useAgentStore('t-models-stored')
    await s.loadAvailableModels()
    expect(s.selectedModel).toBe('local:mistral')
  })

  it('selectModel:忽略不在列表里的 key,合法 key 才持久化 + 刷新 thinking', () => {
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

  it('send:onError(dual-shape {status,body})落一个 error tool block 并结束 streaming', async () => {
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

  it('send:无 activeSessionId 时先 createSession', async () => {
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

  it('confirmAgentAction:无 activeSessionId 时直接返回,不调用 service', async () => {
    const s = useAgentStore('t-confirm-noop')
    await s.confirmAgentAction('c1', true)
    expect(svc.confirmAgentAction).not.toHaveBeenCalled()
  })

  it('stop:abort 当前流 + 调 cancelAgentRun + 结束 streaming', async () => {
    const s = useAgentStore('t-stop')
    s.activeSessionId = 'sess1'
    s.availableModels = [LOCAL_MODEL]
    s.selectModel('local:llama')
    // runSpy 永不 settle,模拟一次在途流 —— send() 本身也就永不 resolve,
    // 所以这里刻意不 await/不接它的返回值,只关心 stop() 自身的效果。
    void s.send('hi')
    await Promise.resolve() // 让 send() 跑到 await runAgentRun(...) 之前的同步前缀(busy=true 等)
    await s.stop()
    expect(s.busy).toBe(false)
    expect(svc.cancelAgentRun).toHaveBeenCalledWith('sess1')
  })

  it('continueRun:busy 时不重复触发', async () => {
    const s = useAgentStore('t-continue-busy')
    s.setBusy(true)
    await s.continueRun()
    expect(runSpy).not.toHaveBeenCalled()
  })

  it('continueRun:无 activeSessionId/selectedModel 时直接返回', async () => {
    const s = useAgentStore('t-continue-noop')
    await s.continueRun()
    expect(runSpy).not.toHaveBeenCalled()
  })

  it('continueRun:happy path 调 runAgentRun(continue_run:true) 并标记最近的 max_turns 卡为 resumed', async () => {
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
