import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { watch } from 'vue'

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

describe('agentStore P1c Task1: stream-fed three actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((fn) => fn.mockReset())
    localStorage.clear()
  })

  it('appendStagedChange: group by same run, dedup by (seq, path) with in-place replacement', () => {
    const s = useAgentStore('t1a')
    s.appendStagedChange({ run_id: 'r1', seq: 1, op: 'mkdir', path: '/a' })
    s.appendStagedChange({ run_id: 'r1', seq: 2, op: 'write', path: '/b' })
    s.appendStagedChange({ run_id: 'r1', seq: 1, op: 'mkdir', path: '/a', size_bytes: 9 })
    expect(s.stagedChanges).toHaveLength(1)
    expect(s.stagedChanges[0].items).toHaveLength(2)
    expect(s.stagedChanges[0].items[0]).toMatchObject({ seq: 1, size_bytes: 9 })
    expect(typeof s.stagedChanges[0].created_at).toBe('number')
  })

  it('appendStagedChange: different run appended to end (newest-run-last)', () => {
    const s = useAgentStore('t1b')
    s.appendStagedChange({ run_id: 'r1', seq: 1, op: 'mkdir', path: '/a' })
    s.appendStagedChange({ run_id: 'r2', seq: 1, op: 'mkdir', path: '/c' })
    expect(s.stagedChanges.map((g) => g.run_id)).toEqual(['r1', 'r2'])
  })

  // P1c2 debt 2 — leftover from 1c-1 final review: appendStagedChange continues to mutate on
  // the *raw* local reference of `group` (`group.items.push(...)`) instead of fetching the
  // proxied element anew from `stagedChanges.value`. This probe reproduces a phenomenon verified
  // during final review using real @vue/reactivity (here borrowing Vue's own `watch(...,
  // {flush:'sync'})`, equivalent effect with no extra dependency declaration): a sync listener
  // already tracking `items.length`, when the bug exists, only sees 0 at group creation moment
  // (push(group) itself went through the proxy, triggered one notification), never observes the
  // first item enqueued right after — because `group.items.push(item)` operates on a raw
  // reference not intercepted by the proxy, won't trigger trigger(). This is not "the final data
  // read is wrong" (raw reference and proxy share the same underlying array, afterwards reading
  // `.items.length` anytime is correct), but rather "this mutation never notified any reactive
  // subscribers" — only listeners with flush:'sync' can expose it.
  it('appendStagedChange: the enqueuing of the first item in a new group must go through reactive proxy notification (flush:sync listener needs to synchronously see length=1, not stuck at 0)', () => {
    const s = useAgentStore('t1f')
    const seen: number[] = []
    watch(
      () => (s.stagedChanges[0] ? s.stagedChanges[0].items.length : -1),
      (len) => { seen.push(len) },
      { flush: 'sync' },
    )
    s.appendStagedChange({ run_id: 'rX', seq: 1, op: 'mkdir', path: '/a' })
    expect(seen).toContain(1)
  })

  it('appendVisibleResource: dedup by path, shallow copy enqueue', () => {
    const s = useAgentStore('t1c')
    s.appendVisibleResource({ path: '/DATA/x', kind: 'folder' })
    s.appendVisibleResource({ path: '/DATA/x', kind: 'folder' })
    s.appendVisibleResource({ path: '/DATA/y', kind: 'file' })
    expect(s.visibleResources.map((r) => r.path)).toEqual(['/DATA/x', '/DATA/y'])
  })

  it('removeVisibleResourceFromList: filter entire table by path', () => {
    const s = useAgentStore('t1d')
    s.appendVisibleResource({ path: '/a', kind: 'folder' })
    s.appendVisibleResource({ path: '/b', kind: 'folder' })
    s.removeVisibleResourceFromList('/a')
    expect(s.visibleResources.map((r) => r.path)).toEqual(['/b'])
  })

  it('createStreamActions: expose 1c three actions (reducer no longer no-op)', () => {
    const s = useAgentStore('t1e')
    const a = s.createStreamActions()
    expect(typeof a.appendStagedChange).toBe('function')
    expect(typeof a.appendVisibleResource).toBe('function')
    expect(typeof a.removeVisibleResourceFromList).toBe('function')
    a.appendVisibleResource!({ path: '/z', kind: 'folder' })
    expect(s.visibleResources.map((r) => r.path)).toEqual(['/z'])
  })
})

describe('agentStore P1c Task2: visible resources + attachments', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((fn) => fn.mockReset())
    localStorage.clear()
    svc.createAgentSession.mockResolvedValue({ session_id: 'new-sess' })
    svc.listAgentSessions.mockResolvedValue([])
  })

  it('loadVisibleResources: clear and don\'t send request when no session', async () => {
    const s = useAgentStore('t2a')
    s.visibleResources.push({ path: '/stale', kind: 'folder' })
    await s.loadVisibleResources()
    expect(s.visibleResources).toEqual([])
    expect(svc.listVisibleResources).not.toHaveBeenCalled()
  })

  it('loadVisibleResources: use body to override when session exists (null → [])', async () => {
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

  it('addVisibleResource: create session first if no session, server value takes priority, parameter fallback', async () => {
    const s = useAgentStore('t2c')
    svc.addVisibleResource.mockResolvedValue({ id: 7, path: '/DATA/srv', kind: 'file' })
    await s.addVisibleResource('/DATA/arg', 'folder', false)
    expect(svc.createAgentSession).toHaveBeenCalled()
    expect(svc.addVisibleResource).toHaveBeenCalledWith('new-sess', '/DATA/arg', 'folder', false)
    expect(s.visibleResources).toEqual([{ id: 7, path: '/DATA/srv', kind: 'file' }])
  })

  it('addVisibleResource: fall back to parameter value when server body is empty', async () => {
    const s = useAgentStore('t2d')
    s.activeSessionId = 'sess-1'
    svc.addVisibleResource.mockResolvedValue(undefined)
    await s.addVisibleResource('/DATA/p', 'file', true)
    expect(svc.addVisibleResource).toHaveBeenCalledWith('sess-1', '/DATA/p', 'file', true)
    expect(s.visibleResources).toEqual([{ id: undefined, path: '/DATA/p', kind: 'file' }])
  })

  it('addVisibleResource: throw error as-is (composer needs to read 409 detail)', async () => {
    const s = useAgentStore('t2e')
    s.activeSessionId = 'sess-1'
    const err = Object.assign(new Error('boom'), { response: { status: 409, data: { detail: 'blocked by .gitignore' } } })
    svc.addVisibleResource.mockRejectedValue(err)
    await expect(s.addVisibleResource('/x')).rejects.toBe(err)
    expect(s.visibleResources).toEqual([])
  })

  it('removeVisibleResource: on success, remove locally by known path', async () => {
    const s = useAgentStore('t2f')
    s.activeSessionId = 'sess-1'
    s.visibleResources.push({ id: 3, path: '/a', kind: 'folder' })
    svc.removeVisibleResource.mockResolvedValue({})
    await s.removeVisibleResource(3)
    expect(svc.removeVisibleResource).toHaveBeenCalledWith('sess-1', 3)
    expect(s.visibleResources).toEqual([])
  })

  // P1c2 debt 1 — chips without id (agent self-authorizes access during run,
  // dispatchEvent.ts:311's 'visible_resource_added' only carries {path, kind}, no id,
  // verbatim consistent with Vue2 agentStream.js:539-542) also need to be deletable.
  // removeVisibleResourceByPath first refreshes server list (with id) then finds by path.
  it('removeVisibleResourceByPath: first refresh to get server id, then delete by id', async () => {
    const s = useAgentStore('t2k')
    s.activeSessionId = 'sess-1'
    svc.listVisibleResources.mockResolvedValue([{ id: 42, path: '/DATA/x', kind: 'folder' }])
    svc.removeVisibleResource.mockResolvedValue({})
    await s.removeVisibleResourceByPath('/DATA/x')
    expect(svc.listVisibleResources).toHaveBeenCalledWith('sess-1')
    expect(svc.removeVisibleResource).toHaveBeenCalledWith('sess-1', 42)
    expect(s.visibleResources).toEqual([])
  })

  it('removeVisibleResourceByPath: after refresh, server no longer has that item, only clear locally (don\'t call delete API)', async () => {
    const s = useAgentStore('t2l')
    s.activeSessionId = 'sess-1'
    // Server list after refresh doesn't have /DATA/stale (may have already been deleted by
    // other path/other client), but keeps one unrelated item to prove local cleanup is 'filter
    // by path', not entire table clear.
    svc.listVisibleResources.mockResolvedValue([{ id: 9, path: '/DATA/other', kind: 'folder' }])
    await s.removeVisibleResourceByPath('/DATA/stale')
    expect(svc.listVisibleResources).toHaveBeenCalledWith('sess-1')
    expect(svc.removeVisibleResource).not.toHaveBeenCalled()
    expect(s.visibleResources).toEqual([{ id: 9, path: '/DATA/other', kind: 'folder' }])
  })

  it('loadAttachments: clear when no session; on failure also clear and swallow error', async () => {
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

  it('removeAttachment: call delete and filter by id; return directly if no session', async () => {
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

  it('selectSession: after loading messages, concurrently run three loaders (order before attach)', async () => {
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

  it('selectSession: single loader failure doesn\'t block (allSettled)', async () => {
    const s = useAgentStore('t2j')
    svc.listAgentMessages.mockResolvedValue([])
    svc.listVisibleResources.mockRejectedValue(new Error('x'))
    svc.listAttachments.mockResolvedValue([{ id: 'a1' }])
    await expect(s.selectSession('sess-10')).resolves.toBeUndefined()
    expect(s.attachments).toEqual([{ id: 'a1' }])
  })
})

describe('agentStore P1c Task3: staged changes', () => {
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

  it('loadStagedChanges: clear when no session; replace entire table when session exists', async () => {
    const s = useAgentStore('t3a')
    await s.loadStagedChanges()
    expect(s.stagedChanges).toEqual([])
    s.activeSessionId = 'sess-1'
    svc.listStagedChanges.mockResolvedValue([{ run_id: 'r9', created_at: 2, items: [] }])
    await s.loadStagedChanges()
    expect(svc.listStagedChanges).toHaveBeenCalledWith('sess-1')
    expect(s.stagedChanges).toHaveLength(1)
  })

  it('commitStagedAll: on success clear, committing must reset', async () => {
    const s = useAgentStore('t3b')
    s.activeSessionId = 'sess-1'
    seed(s)
    svc.commitStagedChanges.mockResolvedValue({})
    await s.commitStagedAll()
    expect(svc.commitStagedChanges).toHaveBeenCalledWith('sess-1')
    expect(s.stagedChanges).toEqual([])
    expect(s.committing).toBe(false)
  })

  it('commitStagedAll: on failure keep list, committing reset, error bubbles', async () => {
    const s = useAgentStore('t3c')
    s.activeSessionId = 'sess-1'
    seed(s)
    svc.commitStagedChanges.mockRejectedValue(new Error('boom'))
    await expect(s.commitStagedAll()).rejects.toThrow('boom')
    expect(s.stagedChanges).toHaveLength(1)
    expect(s.committing).toBe(false)
  })

  it('revertStagedRun: after success remove entire group, reverting key cleared', async () => {
    const s = useAgentStore('t3d')
    s.activeSessionId = 'sess-1'
    seed(s)
    svc.revertStagedRun.mockResolvedValue({})
    await s.revertStagedRun('r1')
    expect(svc.revertStagedRun).toHaveBeenCalledWith('sess-1', 'r1')
    expect(s.stagedChanges).toEqual([])
    expect(s.reverting).toEqual({})
  })

  it('revertStagedBatch: on ok trim items by batch_id and drop empty groups', async () => {
    const s = useAgentStore('t3e')
    s.activeSessionId = 'sess-1'
    seed(s)
    svc.revertStagedBatch.mockResolvedValue({ status: 'ok' })
    await s.revertStagedBatch('bx')
    expect(svc.revertStagedBatch).toHaveBeenCalledWith('sess-1', 'bx')
    expect(s.stagedChanges[0].items.map((i: any) => i.seq)).toEqual([3])
  })

  it('revertStagedBatch: non-ok/partial status changed to entire table refresh', async () => {
    const s = useAgentStore('t3f')
    s.activeSessionId = 'sess-1'
    seed(s)
    svc.revertStagedBatch.mockResolvedValue({ status: 'conflict' })
    svc.listStagedChanges.mockResolvedValue([])
    await s.revertStagedBatch('bx')
    expect(svc.listStagedChanges).toHaveBeenCalledWith('sess-1')
    expect(s.stagedChanges).toEqual([])
  })

  it('revertStagedItem: take plural endpoint single-element array, reverting key carries item: prefix', async () => {
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

describe('agentStore P1c Task4: sendInit', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((fn) => fn.mockReset())
    localStorage.clear()
    svc.createAgentSession.mockResolvedValue({ session_id: 'sess-init' })
    svc.listAgentSessions.mockResolvedValue([])
  })

  it('sendInit: first push [/init] user + assistant placeholder, then send run by kind=init', async () => {
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

  it('sendInit: when no model selected, land one error tool block and finish', async () => {
    const s = useAgentStore('t4b')
    s.selectedModel = null
    await s.sendInit('/DATA/docs')
    const last: any = s.messages[s.messages.length - 1]
    expect(last.blocks[0]).toMatchObject({ type: 'tool', state: 'error', name: 'request' })
    expect(s.busy).toBe(false)
  })

  it('sendInit: cloud model carries X-Agent-Provider-Id header', async () => {
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

  it('sendInit: when createSession fails, supplement assistant placeholder (safety net)', async () => {
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
