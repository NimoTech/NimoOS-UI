import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAgentStore } from '../../ai/stores/agentStore'
import {
  ensurePhotosSession, resetPhotosSession, touchPhotosSession, isPhotosSessionExpired,
  __resetPhotosSessionForTests, PHOTOS_SESSION_KEY, PHOTOS_SESSION_TITLE, PHOTOS_IDLE_TTL_MS,
} from './useAskNimoSession'

// The store's own field types are plain functions (no Mock methods); widen them here so
// `agent.createSession.mockClear()` etc. below type-check without touching agentStore.ts.
type StubbedAgent = ReturnType<typeof useAgentStore> & {
  createSession: Mock
  deleteSession: Mock
  setSessionTitle: Mock
  stop: Mock
}

function stubAgent(): StubbedAgent {
  const agent = useAgentStore('photos') as StubbedAgent
  agent.createSession = vi.fn(async () => { agent.activeSessionId = 'sess-1' })
  agent.deleteSession = vi.fn(async () => {})
  agent.setSessionTitle = vi.fn(async () => {})
  agent.stop = vi.fn(async () => {})
  return agent
}

describe('useAskNimoSession', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    __resetPhotosSessionForTests()
    vi.useFakeTimers()
  })

  it('first ensure() this page load always discards any saved session id and creates fresh', async () => {
    localStorage.setItem(PHOTOS_SESSION_KEY, 'stale-sess')
    const agent = stubAgent()
    await ensurePhotosSession(agent)
    expect(agent.deleteSession).toHaveBeenCalledWith('stale-sess')
    expect(agent.createSession).toHaveBeenCalledTimes(1)
    expect(agent.setSessionTitle).toHaveBeenCalledWith('sess-1', PHOTOS_SESSION_TITLE)
    expect(localStorage.getItem(PHOTOS_SESSION_KEY)).toBe('sess-1')
  })

  it('second ensure() same page load reuses the live session id, no recreate', async () => {
    const agent = stubAgent()
    await ensurePhotosSession(agent)
    agent.createSession.mockClear()
    await ensurePhotosSession(agent)
    expect(agent.createSession).not.toHaveBeenCalled()
  })

  it('idle-expired session gets dropped and recreated on next ensure()', async () => {
    const agent = stubAgent()
    await ensurePhotosSession(agent)
    touchPhotosSession()
    vi.advanceTimersByTime(PHOTOS_IDLE_TTL_MS + 1000)
    expect(isPhotosSessionExpired()).toBe(true)
    agent.createSession.mockClear()
    await ensurePhotosSession(agent)
    expect(agent.deleteSession).toHaveBeenCalledWith('sess-1')
    expect(agent.createSession).toHaveBeenCalledTimes(1)
  })

  it('resetPhotosSession stops any in-flight run before deleting and recreating', async () => {
    const agent = stubAgent()
    await ensurePhotosSession(agent)
    await resetPhotosSession(agent)
    expect(agent.stop).toHaveBeenCalledTimes(1)
    expect(agent.deleteSession).toHaveBeenCalledWith('sess-1')
    expect(agent.createSession).toHaveBeenCalledTimes(2)
  })

  it('a session with zero activity never expires', () => {
    expect(isPhotosSessionExpired()).toBe(false)
  })
})
