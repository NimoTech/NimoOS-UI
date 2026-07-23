import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const svc = vi.hoisted(() => ({
  listAgentSessions: vi.fn(),
  createAgentSession: vi.fn(),
  deleteAgentSession: vi.fn(),
  listAgentMessages: vi.fn(),
  updateAgentSessionTitle: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: svc } }))

import { useAgentStore } from './agentStore'

describe('agentStore (session slice)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((fn) => fn.mockReset())
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

  it('selectSession:装载消息,且不调用任何 attach/stream 相关方法', async () => {
    svc.listAgentMessages.mockResolvedValue([{ role: 'user', content: 'hi' }])
    const s = useAgentStore()
    await s.selectSession('sess-1')
    expect(s.activeSessionId).toBe('sess-1')
    expect(s.messages).toEqual([{ role: 'user', content: 'hi' }])
    expect(svc.listAgentMessages).toHaveBeenCalledWith('sess-1')
    expect(s.busy).toBe(false)
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
