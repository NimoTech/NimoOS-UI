### Task 3: store —— staged changes 域(5 个动作)

**Files:**
- Modify: `src/ai/stores/agentStore.ts`(动作区 + `selectSession` 的 `allSettled` 补第三个 loader + return 表)
- Test: `src/ai/stores/agentStore.p1c.test.ts`(追加 describe;并把 Task 2 第 9 例补回 `listStagedChanges` 断言)

**Interfaces:**
- Consumes: Task 1 的 `stagedChanges`/`committing`/`reverting`。
- Produces:
  ```ts
  loadStagedChanges(): Promise<void>
  commitStagedAll(): Promise<void>
  revertStagedRun(runId: string | number): Promise<void>
  revertStagedBatch(batchId: string | number): Promise<void>
  revertStagedItem(stagedId: string | number): Promise<void>
  ```
  **reverting 键约定(1c-2 的 ResourcesTab 依赖,不可改):** run → `String(runId)`;batch → `String(batchId)`;item → `` `item:${stagedId}` ``。

- [ ] **Step 1: 写失败测试**

```ts
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- src/ai/stores/agentStore.p1c.test.ts -t "Task3"`
Expected: FAIL —— `s.loadStagedChanges is not a function`。

- [ ] **Step 3: 实现**

逐字港 `agentStore.js:779-847`(`Vue.set/Vue.delete` → 直接赋值/`delete`):

```ts
    // ── 1c:暂存区(agentStore.js:779-847)──

    async function loadStagedChanges() {
      if (!activeSessionId.value) { stagedChanges.value = []; return }
      const body = await service.ai.listStagedChanges(activeSessionId.value)
      stagedChanges.value = (body as StagedGroup[]) || []
    }

    /** 成功即清空整表;失败保留列表、错误冒泡;committing 一定在 finally 复位。 */
    async function commitStagedAll() {
      if (!activeSessionId.value) return
      committing.value = true
      try {
        await service.ai.commitStagedChanges(activeSessionId.value)
        stagedChanges.value = []
      } finally { committing.value = false }
    }

    /** agentStore.js:799-810 —— 整轮回滚;**不看响应状态**,成功即丢整组。 */
    async function revertStagedRun(runId: string | number) {
      if (!activeSessionId.value) return
      const key = String(runId)
      reverting.value[key] = true
      try {
        await service.ai.revertStagedRun(activeSessionId.value, runId)
        stagedChanges.value = stagedChanges.value.filter((g) => g.run_id !== runId)
      } finally { delete reverting.value[key] }
    }

    /**
     * agentStore.js:812-828 —— 批量回滚。status ∈ ok|partial → 就地剪掉该 batch 的项
     * 并丢掉变空的组;其余(conflict/nothing_to_revert/snapshot_missing)→ 整表重拉。
     */
    async function revertStagedBatch(batchId: string | number) {
      if (!activeSessionId.value) return
      const key = String(batchId)
      reverting.value[key] = true
      try {
        const body = (await service.ai.revertStagedBatch(activeSessionId.value, batchId)) as { status?: string } | null
        const status = (body && body.status) || 'ok'
        if (status === 'ok' || status === 'partial') {
          stagedChanges.value.forEach((g) => { g.items = g.items.filter((it) => it.batch_id !== batchId) })
          stagedChanges.value = stagedChanges.value.filter((g) => g.items.length > 0)
        } else {
          await loadStagedChanges()
        }
      } finally { delete reverting.value[key] }
    }

    /** agentStore.js:830-847 —— 单项回滚:复数端点 + 单元素数组;reverting 键前缀 'item:'。 */
    async function revertStagedItem(stagedId: string | number) {
      if (!activeSessionId.value) return
      const revertKey = 'item:' + stagedId
      reverting.value[revertKey] = true
      try {
        const body = (await service.ai.revertStagedItems(activeSessionId.value, [stagedId])) as { status?: string } | null
        const status = (body && body.status) || 'ok'
        if (status === 'ok' || status === 'partial') {
          stagedChanges.value.forEach((g) => { g.items = g.items.filter((it) => it.staged_id !== stagedId) })
          stagedChanges.value = stagedChanges.value.filter((g) => g.items.length > 0)
        } else {
          await loadStagedChanges()
        }
      } finally { delete reverting.value[revertKey] }
    }
```

`selectSession` 的 allSettled 补第三个:`await Promise.allSettled([loadVisibleResources(), loadAttachments(), loadStagedChanges()])`,并把 Task 2 测试第 9 例的 `listStagedChanges` 断言补回来。
return 表补 5 个动作。把 `agentStore.ts:200` 的注释收口成"三域装载已在此完成(1c-1)"。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- src/ai/stores/agentStore.p1c.test.ts src/ai/stores/agentStore.test.ts`
Expected: 全绿。`pnpm exec vue-tsc --noEmit` → 0 error。

- [ ] **Step 5: Commit**

```bash
git add src/ai/stores/agentStore.ts src/ai/stores/agentStore.p1c.test.ts
git commit -m "SP8-P1c1: store staged-changes domain (load/commit/revert run|batch|item)"
```

---

