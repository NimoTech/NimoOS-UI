import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const h = vi.hoisted(() => ({ confirmAgentAction: vi.fn(async () => ({})) }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: h } }))

import { useAgentStore } from './agentStore'

describe('agentStore.resolveElicitation', () => {
  beforeEach(() => { setActivePinia(createPinia()); h.confirmAgentAction.mockClear() })

  it('accept with answer: confirmed=true, action/content goes to extra', async () => {
    const s = useAgentStore()
    s.activeSessionId = 'sess-1'
    await s.resolveElicitation('c1', 'accept', { name: 'Ada' })
    expect(h.confirmAgentAction).toHaveBeenCalledWith(
      'sess-1', 'c1', true, false, { action: 'accept', content: { name: 'Ada' } },
    )
  })

  it('decline without answer: confirmed=false, extra only has action', async () => {
    const s = useAgentStore()
    s.activeSessionId = 'sess-1'
    await s.resolveElicitation('c1', 'decline')
    expect(h.confirmAgentAction).toHaveBeenCalledWith(
      'sess-1', 'c1', false, false, { action: 'decline' },
    )
  })

  it('when no active session, throw error instead of silent return', async () => {
    const s = useAgentStore()
    s.activeSessionId = null
    await expect(s.resolveElicitation('c1', 'accept')).rejects.toThrow('no active session')
    expect(h.confirmAgentAction).not.toHaveBeenCalled()
  })

  it('missing confirmId throws error', async () => {
    const s = useAgentStore()
    s.activeSessionId = 'sess-1'
    await expect(s.resolveElicitation('', 'accept')).rejects.toThrow('confirm_id missing')
    expect(h.confirmAgentAction).not.toHaveBeenCalled()
  })
})
