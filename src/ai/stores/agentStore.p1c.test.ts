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

describe('agentStore P1c Task2:visible resources + attachments', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((fn) => fn.mockReset())
    localStorage.clear()
    svc.createAgentSession.mockResolvedValue({ session_id: 'new-sess' })
    svc.listAgentSessions.mockResolvedValue([])
  })

  it('loadVisibleResources:无会话时清空且不发请求', async () => {
    const s = useAgentStore('t2a')
    s.visibleResources.push({ path: '/stale', kind: 'folder' })
    await s.loadVisibleResources()
    expect(s.visibleResources).toEqual([])
    expect(svc.listVisibleResources).not.toHaveBeenCalled()
  })

  it('loadVisibleResources:有会话时用 body 覆盖(null → [])', async () => {
    const s = useAgentStore('t2b')
    s.activeSessionId = 'sess-1'
    svc.listVisibleResources.mockResolvedValue([{ id: 1, path: '/a', kind: 'folder' }])
    await s.loadVisibleResources()
    expect(svc.listVisibleResources).toHaveBeenCalledWith('sess-1')
    expect(s.visibleResources).toEqual([{ id: 1, path: '/a', kind: 'folder' }])
    svc.listVisibleResources.mockResolvedValue(null)
    await s.loadVisibleResources()
    expect(s.visibleResources).toEqual([])
  })

  it('addVisibleResource:无会话先建会话,服务端值优先、参数兜底', async () => {
    const s = useAgentStore('t2c')
    svc.addVisibleResource.mockResolvedValue({ id: 7, path: '/DATA/srv', kind: 'file' })
    await s.addVisibleResource('/DATA/arg', 'folder', false)
    expect(svc.createAgentSession).toHaveBeenCalled()
    expect(svc.addVisibleResource).toHaveBeenCalledWith('new-sess', '/DATA/arg', 'folder', false)
    expect(s.visibleResources).toEqual([{ id: 7, path: '/DATA/srv', kind: 'file' }])
  })

  it('addVisibleResource:服务端空 body 时回落到参数值', async () => {
    const s = useAgentStore('t2d')
    s.activeSessionId = 'sess-1'
    svc.addVisibleResource.mockResolvedValue(undefined)
    await s.addVisibleResource('/DATA/p', 'file', true)
    expect(svc.addVisibleResource).toHaveBeenCalledWith('sess-1', '/DATA/p', 'file', true)
    expect(s.visibleResources).toEqual([{ id: undefined, path: '/DATA/p', kind: 'file' }])
  })

  it('addVisibleResource:错误原样抛出(composer 需读 409 detail)', async () => {
    const s = useAgentStore('t2e')
    s.activeSessionId = 'sess-1'
    const err = Object.assign(new Error('boom'), { response: { status: 409, data: { detail: 'blocked by .gitignore' } } })
    svc.addVisibleResource.mockRejectedValue(err)
    await expect(s.addVisibleResource('/x')).rejects.toBe(err)
    expect(s.visibleResources).toEqual([])
  })

  it('removeVisibleResource:成功后按已知 path 本地移除', async () => {
    const s = useAgentStore('t2f')
    s.activeSessionId = 'sess-1'
    s.visibleResources.push({ id: 3, path: '/a', kind: 'folder' })
    svc.removeVisibleResource.mockResolvedValue({})
    await s.removeVisibleResource(3)
    expect(svc.removeVisibleResource).toHaveBeenCalledWith('sess-1', 3)
    expect(s.visibleResources).toEqual([])
  })

  it('loadAttachments:无会话清空;失败也清空并吞错', async () => {
    const s = useAgentStore('t2g')
    await s.loadAttachments()
    expect(s.attachments).toEqual([])
    s.activeSessionId = 'sess-1'
    svc.listAttachments.mockRejectedValue(new Error('nope'))
    await expect(s.loadAttachments()).resolves.toBeUndefined()
    expect(s.attachments).toEqual([])
    svc.listAttachments.mockResolvedValue([{ id: 'a1' }])
    await s.loadAttachments()
    expect(s.attachments).toEqual([{ id: 'a1' }])
  })

  it('removeAttachment:调删除并按 id 过滤;无会话直接返回', async () => {
    const s = useAgentStore('t2h')
    await s.removeAttachment('a1')
    expect(svc.deleteAttachment).not.toHaveBeenCalled()
    s.activeSessionId = 'sess-1'
    s.attachments.push({ id: 'a1' }, { id: 'a2' })
    svc.deleteAttachment.mockResolvedValue({})
    await s.removeAttachment('a1')
    expect(svc.deleteAttachment).toHaveBeenCalledWith('sess-1', 'a1')
    expect(s.attachments).toEqual([{ id: 'a2' }])
  })

  it('selectSession:装载消息后并发跑两个 loader(顺序在 attach 之前)', async () => {
    const s = useAgentStore('t2i')
    svc.listAgentMessages.mockResolvedValue([])
    svc.listVisibleResources.mockResolvedValue([])
    svc.listAttachments.mockResolvedValue([])
    await s.selectSession('sess-9')
    expect(svc.listVisibleResources).toHaveBeenCalledWith('sess-9')
    expect(svc.listAttachments).toHaveBeenCalledWith('sess-9')
  })

  it('selectSession:单个 loader 失败不阻断(allSettled)', async () => {
    const s = useAgentStore('t2j')
    svc.listAgentMessages.mockResolvedValue([])
    svc.listVisibleResources.mockRejectedValue(new Error('x'))
    svc.listAttachments.mockResolvedValue([{ id: 'a1' }])
    await expect(s.selectSession('sess-10')).resolves.toBeUndefined()
    expect(s.attachments).toEqual([{ id: 'a1' }])
  })
})
