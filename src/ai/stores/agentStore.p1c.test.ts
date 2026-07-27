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

  it('selectSession:装载消息后并发跑三个 loader(顺序在 attach 之前)', async () => {
    const s = useAgentStore('t2i')
    svc.listAgentMessages.mockResolvedValue([])
    svc.listVisibleResources.mockResolvedValue([])
    svc.listAttachments.mockResolvedValue([])
    svc.listStagedChanges.mockResolvedValue([])
    await s.selectSession('sess-9')
    expect(svc.listVisibleResources).toHaveBeenCalledWith('sess-9')
    expect(svc.listAttachments).toHaveBeenCalledWith('sess-9')
    expect(svc.listStagedChanges).toHaveBeenCalledWith('sess-9')
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

describe('agentStore P1c Task3:staged changes', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((fn) => fn.mockReset())
    localStorage.clear()
  })

  const seed = (s: any) => {
    s.stagedChanges.push({
      run_id: 'r1', created_at: 1,
      items: [
        { seq: 1, staged_id: 10, batch_id: 'bx', op: 'mkdir', path: '/a' },
        { seq: 2, staged_id: 11, batch_id: 'bx', op: 'rename', path: '/b', dst_path: '/c' },
        { seq: 3, op: 'write', path: '/loose' },
      ],
    })
  }

  it('loadStagedChanges:无会话清空;有会话整表覆盖', async () => {
    const s = useAgentStore('t3a')
    await s.loadStagedChanges()
    expect(s.stagedChanges).toEqual([])
    s.activeSessionId = 'sess-1'
    svc.listStagedChanges.mockResolvedValue([{ run_id: 'r9', created_at: 2, items: [] }])
    await s.loadStagedChanges()
    expect(svc.listStagedChanges).toHaveBeenCalledWith('sess-1')
    expect(s.stagedChanges).toHaveLength(1)
  })

  it('commitStagedAll:成功清空,committing 一定复位', async () => {
    const s = useAgentStore('t3b')
    s.activeSessionId = 'sess-1'
    seed(s)
    svc.commitStagedChanges.mockResolvedValue({})
    await s.commitStagedAll()
    expect(svc.commitStagedChanges).toHaveBeenCalledWith('sess-1')
    expect(s.stagedChanges).toEqual([])
    expect(s.committing).toBe(false)
  })

  it('commitStagedAll:失败时保留列表、committing 复位、错误冒泡', async () => {
    const s = useAgentStore('t3c')
    s.activeSessionId = 'sess-1'
    seed(s)
    svc.commitStagedChanges.mockRejectedValue(new Error('boom'))
    await expect(s.commitStagedAll()).rejects.toThrow('boom')
    expect(s.stagedChanges).toHaveLength(1)
    expect(s.committing).toBe(false)
  })

  it('revertStagedRun:成功后整组移除,reverting 键清掉', async () => {
    const s = useAgentStore('t3d')
    s.activeSessionId = 'sess-1'
    seed(s)
    svc.revertStagedRun.mockResolvedValue({})
    await s.revertStagedRun('r1')
    expect(svc.revertStagedRun).toHaveBeenCalledWith('sess-1', 'r1')
    expect(s.stagedChanges).toEqual([])
    expect(s.reverting).toEqual({})
  })

  it('revertStagedBatch:ok 时按 batch_id 剪项并丢空组', async () => {
    const s = useAgentStore('t3e')
    s.activeSessionId = 'sess-1'
    seed(s)
    svc.revertStagedBatch.mockResolvedValue({ status: 'ok' })
    await s.revertStagedBatch('bx')
    expect(svc.revertStagedBatch).toHaveBeenCalledWith('sess-1', 'bx')
    expect(s.stagedChanges[0].items.map((i: any) => i.seq)).toEqual([3])
  })

  it('revertStagedBatch:非 ok/partial 状态改为整表重拉', async () => {
    const s = useAgentStore('t3f')
    s.activeSessionId = 'sess-1'
    seed(s)
    svc.revertStagedBatch.mockResolvedValue({ status: 'conflict' })
    svc.listStagedChanges.mockResolvedValue([])
    await s.revertStagedBatch('bx')
    expect(svc.listStagedChanges).toHaveBeenCalledWith('sess-1')
    expect(s.stagedChanges).toEqual([])
  })

  it('revertStagedItem:走复数端点单元素数组,reverting 键带 item: 前缀', async () => {
    const s = useAgentStore('t3g')
    s.activeSessionId = 'sess-1'
    seed(s)
    let keyDuringCall: string[] = []
    svc.revertStagedItems.mockImplementation(async () => {
      keyDuringCall = Object.keys(s.reverting)
      return { status: 'ok' }
    })
    await s.revertStagedItem(10)
    expect(svc.revertStagedItems).toHaveBeenCalledWith('sess-1', [10])
    expect(keyDuringCall).toEqual(['item:10'])
    expect(s.stagedChanges[0].items.map((i: any) => i.seq)).toEqual([2, 3])
    expect(s.reverting).toEqual({})
  })
})

describe('agentStore P1c Task4:sendInit', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((fn) => fn.mockReset())
    localStorage.clear()
    svc.createAgentSession.mockResolvedValue({ session_id: 'sess-init' })
    svc.listAgentSessions.mockResolvedValue([])
  })

  it('sendInit:先 push [/init] user + assistant 占位,再按 kind=init 发 run', async () => {
    const { runAgentRun } = await import('../services/agentTransport')
    const s = useAgentStore('t4a')
    s.availableModels = [{ key: 'local:llama3', source: 'local', displayName: 'llama3', provider_type: 'ollama' } as any]
    s.selectedModel = 'local:llama3'
    await s.sendInit('/DATA/docs')
    expect(s.messages[0]).toMatchObject({ role: 'user', content: '[/init] /DATA/docs' })
    expect(s.messages[1]).toMatchObject({ role: 'assistant' })
    expect(runAgentRun).toHaveBeenCalledWith(
      'sess-init',
      { message: 'Please generate agent.md for /DATA/docs.', model: 'llama3', kind: 'init', init_target: '/DATA/docs' },
      'ollama',
      expect.anything(), expect.anything(), expect.any(Function), {},
    )
    expect(s.busy).toBe(false)
  })

  it('sendInit:无选中模型时落一个 error tool block 并收尾', async () => {
    const s = useAgentStore('t4b')
    s.selectedModel = null
    await s.sendInit('/DATA/docs')
    const last: any = s.messages[s.messages.length - 1]
    expect(last.blocks[0]).toMatchObject({ type: 'tool', state: 'error', name: 'request' })
    expect(s.busy).toBe(false)
  })

  it('sendInit:云模型带 X-Agent-Provider-Id 头', async () => {
    const { runAgentRun } = await import('../services/agentTransport')
    const s = useAgentStore('t4c')
    s.activeSessionId = 'sess-1'
    s.availableModels = [{ key: 'cloud:6:deepseek-chat', source: 'cloud', displayName: 'deepseek-chat', providerId: 6, provider_type: 'deepseek' } as any]
    s.selectedModel = 'cloud:6:deepseek-chat'
    await s.sendInit('/DATA/x')
    expect(runAgentRun).toHaveBeenCalledWith(
      'sess-1', expect.objectContaining({ model: 'deepseek-chat', kind: 'init' }), 'deepseek',
      expect.anything(), expect.anything(), expect.any(Function), { 'X-Agent-Provider-Id': '6' },
    )
  })

  it('sendInit:createSession 失败时补齐 assistant 占位(安全网)', async () => {
    const s = useAgentStore('t4d')
    s.availableModels = [{ key: 'local:llama3', source: 'local', displayName: 'llama3', provider_type: 'ollama' } as any]
    s.selectedModel = 'local:llama3'
    svc.createAgentSession.mockRejectedValue(new Error('session creation failed'))
    await s.sendInit('/DATA/x')
    const last: any = s.messages[s.messages.length - 1]
    expect(last.role).toBe('assistant')
    expect(last.blocks[0]).toMatchObject({ type: 'tool', state: 'error', name: 'request' })
    expect(s.busy).toBe(false)
  })
})
