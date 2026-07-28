import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// SP8-P1c2 Task 2 —— 右栏折叠态 + 当前 tab 的最小状态/动作集。
// vi.hoisted() 服务 mock + setActivePinia 模式抄自 agentStore.p1c.test.ts。
const svc = vi.hoisted(() => ({
  listAgentSessions: vi.fn(), createAgentSession: vi.fn(), deleteAgentSession: vi.fn(),
  listAgentMessages: vi.fn(), updateAgentSessionTitle: vi.fn(), regenerateAgentSessionTitle: vi.fn(),
  listModels: vi.fn(), listProviders: vi.fn(), cancelAgentRun: vi.fn(), confirmAgentAction: vi.fn(),
  listVisibleResources: vi.fn(), addVisibleResource: vi.fn(), removeVisibleResource: vi.fn(),
  listAttachments: vi.fn(), deleteAttachment: vi.fn(),
  listStagedChanges: vi.fn(), commitStagedChanges: vi.fn(),
  revertStagedRun: vi.fn(), revertStagedBatch: vi.fn(), revertStagedItems: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: svc } }))
vi.mock('../services/agentTransport', () => ({
  runAgentRun: vi.fn().mockResolvedValue(undefined),
  attachAgentStream: vi.fn().mockResolvedValue({ attached: false }),
}))

import { useAgentStore } from './agentStore'

describe('agentStore P1c2 Task2:右栏折叠态 + tab', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((fn) => fn.mockReset())
    localStorage.clear()
  })

  it('默认值:rightCollapsed=false(展开)、rightTab="activity"(agentStore.js:37-38)', () => {
    const s = useAgentStore('p1c2-a')
    expect(s.rightCollapsed).toBe(false)
    expect(s.rightTab).toBe('activity')
  })

  it('setRightTab:切换当前激活 tab(agentStore.js:158)', () => {
    const s = useAgentStore('p1c2-b')
    s.setRightTab('context')
    expect(s.rightTab).toBe('context')
    s.setRightTab('system')
    expect(s.rightTab).toBe('system')
    s.setRightTab('resources')
    expect(s.rightTab).toBe('resources')
  })

  it('toggleRight:翻转 rightCollapsed(agentStore.js:157)', () => {
    const s = useAgentStore('p1c2-c')
    expect(s.rightCollapsed).toBe(false)
    s.toggleRight()
    expect(s.rightCollapsed).toBe(true)
    s.toggleRight()
    expect(s.rightCollapsed).toBe(false)
  })

  it('tab 选择不持久化:切 tab 后不写 localStorage(与 theme/selectedModel 不同)', () => {
    const s = useAgentStore('p1c2-d')
    s.setRightTab('system')
    expect(localStorage.length).toBe(0)
  })
})
