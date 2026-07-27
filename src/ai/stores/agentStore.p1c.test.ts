import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

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

describe('agentStore P1c Task1:stream-fed 三动作', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((fn) => fn.mockReset())
    localStorage.clear()
  })

  it('appendStagedChange:同 run 归组、(seq,path) 去重就地替换', () => {
    const s = useAgentStore('t1a')
    s.appendStagedChange({ run_id: 'r1', seq: 1, op: 'mkdir', path: '/a' })
    s.appendStagedChange({ run_id: 'r1', seq: 2, op: 'write', path: '/b' })
    s.appendStagedChange({ run_id: 'r1', seq: 1, op: 'mkdir', path: '/a', size_bytes: 9 })
    expect(s.stagedChanges).toHaveLength(1)
    expect(s.stagedChanges[0].items).toHaveLength(2)
    expect(s.stagedChanges[0].items[0]).toMatchObject({ seq: 1, size_bytes: 9 })
    expect(typeof s.stagedChanges[0].created_at).toBe('number')
  })

  it('appendStagedChange:不同 run 追加到末尾(newest-run-last)', () => {
    const s = useAgentStore('t1b')
    s.appendStagedChange({ run_id: 'r1', seq: 1, op: 'mkdir', path: '/a' })
    s.appendStagedChange({ run_id: 'r2', seq: 1, op: 'mkdir', path: '/c' })
    expect(s.stagedChanges.map((g) => g.run_id)).toEqual(['r1', 'r2'])
  })

  it('appendVisibleResource:按 path 去重、浅拷贝入列', () => {
    const s = useAgentStore('t1c')
    s.appendVisibleResource({ path: '/DATA/x', kind: 'folder' })
    s.appendVisibleResource({ path: '/DATA/x', kind: 'folder' })
    s.appendVisibleResource({ path: '/DATA/y', kind: 'file' })
    expect(s.visibleResources.map((r) => r.path)).toEqual(['/DATA/x', '/DATA/y'])
  })

  it('removeVisibleResourceFromList:按 path 整表过滤', () => {
    const s = useAgentStore('t1d')
    s.appendVisibleResource({ path: '/a', kind: 'folder' })
    s.appendVisibleResource({ path: '/b', kind: 'folder' })
    s.removeVisibleResourceFromList('/a')
    expect(s.visibleResources.map((r) => r.path)).toEqual(['/b'])
  })

  it('createStreamActions:暴露 1c 三动作(reducer 不再 no-op)', () => {
    const s = useAgentStore('t1e')
    const a = s.createStreamActions()
    expect(typeof a.appendStagedChange).toBe('function')
    expect(typeof a.appendVisibleResource).toBe('function')
    expect(typeof a.removeVisibleResourceFromList).toBe('function')
    a.appendVisibleResource!({ path: '/z', kind: 'folder' })
    expect(s.visibleResources.map((r) => r.path)).toEqual(['/z'])
  })
})
