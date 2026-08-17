// Vue3 port of Vue2 NimoOS-UI src/views/Photos/services/photosAgentSession.js (logic only,
// read-only reference — nothing copied verbatim, this is a fresh TypeScript rewrite of the
// same session-lifetime contract).
//
// Lifetime model (verbatim intent from the Vue2 header comment):
//  - Page reload / close+reopen -> always a fresh session (module state resets with the JS
//    context; any session from before this page load is deleted as garbage).
//  - Closing just the popup or drawer and reopening within the TTL -> same session, history kept.
//  - No message activity for 1 hour -> context and chat history are dropped (idle sweep).
import type { useAgentStore } from '../../ai/stores/agentStore'

type AgentStore = ReturnType<typeof useAgentStore>

export const PHOTOS_SESSION_KEY = 'photos_agent_session_id'
export const PHOTOS_SESSION_TITLE = 'Photos · Ask Nimo'
export const PHOTOS_IDLE_TTL_MS = 60 * 60 * 1000 // 1 hour

// Module-level state resets on page load (not a store field) -- matches Vue2's own module scope.
let bootDone = false
let lastActiveAt = 0 // 0 = no activity recorded yet

export function touchPhotosSession(): void {
  lastActiveAt = Date.now()
}

export function isPhotosSessionExpired(): boolean {
  return lastActiveAt > 0 && Date.now() - lastActiveAt >= PHOTOS_IDLE_TTL_MS
}

async function createPhotosSession(agent: AgentStore): Promise<void> {
  await agent.createSession()
  if (!agent.activeSessionId) throw new Error('createPhotosSession: no session id returned')
  lastActiveAt = 0
  localStorage.setItem(PHOTOS_SESSION_KEY, String(agent.activeSessionId))
  try {
    await agent.setSessionTitle(agent.activeSessionId, PHOTOS_SESSION_TITLE)
  } catch {
    // Non-fatal: a fixed title merely suppresses agentStore's post-first-turn auto-rename.
  }
}

export async function resetPhotosSession(agent: AgentStore): Promise<void> {
  await agent.stop()
  if (agent.pendingCancel) {
    try { await agent.pendingCancel } catch { /* already swallowed in stop() */ }
  }
  const staleId = agent.activeSessionId || localStorage.getItem(PHOTOS_SESSION_KEY)
  if (staleId) {
    try { await agent.deleteSession(staleId) } catch { /* best-effort */ }
  }
  localStorage.removeItem(PHOTOS_SESSION_KEY)
  await createPhotosSession(agent)
}

export async function ensurePhotosSession(agent: AgentStore): Promise<void> {
  if (!bootDone) {
    bootDone = true
    const saved = localStorage.getItem(PHOTOS_SESSION_KEY)
    if (saved) {
      try { await agent.deleteSession(saved) } catch { /* best-effort orphan cleanup */ }
      localStorage.removeItem(PHOTOS_SESSION_KEY)
    }
    await createPhotosSession(agent)
    return
  }
  if (isPhotosSessionExpired()) {
    await resetPhotosSession(agent)
    return
  }
  if (!agent.activeSessionId) {
    await createPhotosSession(agent)
  }
}

export function __resetPhotosSessionForTests(): void {
  bootDone = false
  lastActiveAt = 0
}
