// Ported from Vue2 agentStore.draftTask.spec.js — the M6 draft action's
// model-key parsing and provider-header contract.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const h = vi.hoisted(() => ({ draftTaskFromSession: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({
  service: { ai: new Proxy({ draftTaskFromSession: h.draftTaskFromSession }, {
    get(target, prop: string) {
      if (prop in target) return (target as Record<string, unknown>)[prop]
      return vi.fn().mockResolvedValue({})
    },
  }) },
}))

import { useAgentStore } from './agentStore'

describe('agentStore.draftTaskFromSession', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    h.draftTaskFromSession.mockReset()
    h.draftTaskFromSession.mockResolvedValue({ name: 'D', prompt: 'p' })
    localStorage.clear()
  })

  it('local model: strips the local: prefix and sends provider_type ollama', async () => {
    const store = useAgentStore()
    store.availableModels.push({
      key: 'local:qwen3', source: 'local', displayName: 'qwen3', provider_type: 'ollama',
    })
    store.selectedModel = 'local:qwen3'
    const d = await store.draftTaskFromSession('s1')
    expect(d).toEqual({ name: 'D', prompt: 'p' })
    expect(h.draftTaskFromSession).toHaveBeenCalledWith('s1', 'qwen3', 'ollama', {})
  })

  it('cloud model: sends the bare model name and the explicit provider id header', async () => {
    const store = useAgentStore()
    store.availableModels.push({
      key: 'cloud:7:deepseek-v4', source: 'cloud', displayName: 'deepseek-v4',
      provider_type: 'other', providerId: 7, providerName: 'DeepSeek',
    })
    store.selectedModel = 'cloud:7:deepseek-v4'
    await store.draftTaskFromSession('s1')
    expect(h.draftTaskFromSession).toHaveBeenCalledWith(
      's1', 'deepseek-v4', 'other', { 'X-Agent-Provider-Id': '7' },
    )
  })

  it('no model selected: still drafts (endpoint falls back to raw messages)', async () => {
    const store = useAgentStore()
    store.selectedModel = null
    const d = await store.draftTaskFromSession('s1')
    expect(d).toEqual({ name: 'D', prompt: 'p' })
    expect(h.draftTaskFromSession).toHaveBeenCalledWith('s1', '', 'other', {})
  })

  it('endpoint failure returns null instead of throwing', async () => {
    h.draftTaskFromSession.mockRejectedValue(new Error('boom'))
    const store = useAgentStore()
    const d = await store.draftTaskFromSession('s1')
    expect(d).toBeNull()
  })
})
