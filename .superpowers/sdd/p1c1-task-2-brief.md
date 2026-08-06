### Task 2: store —— visible resources 域 + attachments 域 + selectSession 三 loader + send 尾巴

**Files:**
- Modify: `src/ai/stores/agentStore.ts`
- Test: `src/ai/stores/agentStore.p1c.test.ts`(追加 describe)

**Interfaces:**
- Consumes: Task 1 的 5 个 state 字段 + `appendVisibleResource`/`removeVisibleResourceFromList`;既有 `createSession()`。
- Produces:
  ```ts
  loadVisibleResources(): Promise<void>
  addVisibleResource(path: string, kind?: string, force?: boolean): Promise<void>   // 默认 kind='folder', force=false;**错误必须原样抛出**(composer 要读 e.response.status===409)
  removeVisibleResource(resId: string | number): Promise<void>
  loadAttachments(): Promise<void>     // 内部吞错并清空(与 Vue2 一致)
  removeAttachment(aid: string | number): Promise<void>   // 抛错
  ```

- [ ] **Step 1: 写失败测试**

追加到 `src/ai/stores/agentStore.p1c.test.ts`:

```ts
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
    svc.listStagedChanges.mockResolvedValue([])
    await expect(s.selectSession('sess-10')).resolves.toBeUndefined()
    expect(s.attachments).toEqual([{ id: 'a1' }])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- src/ai/stores/agentStore.p1c.test.ts`
Expected: FAIL —— `s.loadVisibleResources is not a function`。

- [ ] **Step 3: 实现**

在 Task 1 三个动作之后插入(逐字港 `agentStore.js:734-777`;注意共享包已返 body):

```ts
    // ── 1c:可见资源(agentStore.js:734-758)──

    /** 无会话直接清空、不发请求;有会话则整表覆盖。**不 try/catch** —— 由 selectSession 的 allSettled 兜。 */
    async function loadVisibleResources() {
      if (!activeSessionId.value) { visibleResources.value = []; return }
      const body = await service.ai.listVisibleResources(activeSessionId.value)
      visibleResources.value = (body as VisibleResource[]) || []
    }

    /**
     * agentStore.js:743-752 —— 无会话先懒建会话;服务端返回值优先、参数兜底。
     * **错误必须原样冒泡**:composer 靠 e.response.status===409 + detail 里的
     * "gitignore" 判定要不要 force 重试。
     */
    async function addVisibleResource(path: string, kind = 'folder', force = false) {
      if (!activeSessionId.value) await createSession()
      const body = await service.ai.addVisibleResource(activeSessionId.value as string | number, path, kind, force)
      const data = (body || {}) as { id?: string | number; path?: string; kind?: string }
      appendVisibleResource({ id: data.id, path: data.path || path, kind: data.kind || kind })
    }

    /** agentStore.js:754-758 —— 先抓本地条目拿 path,成功后按 path 移除(id 未知则不动本地)。 */
    async function removeVisibleResource(resId: string | number) {
      const target = visibleResources.value.find((r) => r.id === resId)
      await service.ai.removeVisibleResource(activeSessionId.value as string | number, resId)
      if (target) removeVisibleResourceFromList(target.path)
    }

    // ── 1c:附件(agentStore.js:760-777)──

    /** 与 Vue2 一致:**吞错并清空**(不同于 loadVisibleResources 会抛)。 */
    async function loadAttachments() {
      if (!activeSessionId.value) { attachments.value = []; return }
      try {
        const body = await service.ai.listAttachments(activeSessionId.value)
        attachments.value = (body as Record<string, unknown>[]) || []
      } catch { attachments.value = [] }
    }

    /** agentStore.js:773-777 —— 抛错时本地列表不动。 */
    async function removeAttachment(aid: string | number) {
      if (!activeSessionId.value) return
      await service.ai.deleteAttachment(activeSessionId.value, aid)
      attachments.value = attachments.value.filter((a) => a.id !== aid)
    }
```

`selectSession`(209-241):在 `messages.value = migrateLegacyMessages(...)` 之后、`const ctl = new AbortController()` 之前插入(**位置很重要:必须在 attach 之前,与 Vue2 259-265 同序**):

```ts
      // agentStore.js:259-265 —— 三个域并发装载,单个失败不阻断整条切换。
      await Promise.allSettled([loadVisibleResources(), loadAttachments(), loadStagedChanges()])
```

> `loadStagedChanges` 由 Task 3 实现。**本任务先按上式写全三个 loader** —— 若 Task 3 尚未落地会 tsc 报未定义,故本任务同时在文件里放一个最小 `loadStagedChanges` 占位是**不允许**的;正确做法:本任务的 `allSettled` 只写两个 loader(visible + attachments),Task 3 落地时把第三个补进同一行并更新本任务的第 9 例断言。**实现者请按此执行:本任务 allSettled 里只放 `loadVisibleResources(), loadAttachments()`,并把测试第 9 例里 `listStagedChanges` 的断言改为 Task 3 追加**(第 9 例其余两条断言保留)。

`send()` 尾巴:在 `await runAgentRun(...)` 之后、`} catch (e) {` 之前插入(逐字港 `agentStore.js:393-395`):

```ts
        // 刷新附件:刚上传的草稿此刻服务端已带上 message_id,应显示为"已发送"。
        loadAttachments().catch(() => {})
```

return 表补:`loadVisibleResources, addVisibleResource, removeVisibleResource, loadAttachments, removeAttachment`。

同时把 `agentStore.ts:200` 那句"资源/附件/staged 装载仍不搬(1c 的事)"的注释改成描述现状的一句(staged 由 Task 3 补齐后再收口)。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- src/ai/stores/agentStore.p1c.test.ts src/ai/stores/agentStore.test.ts`
Expected: 全绿(1b 的 3 个 selectSession 例仍绿 —— 新 loader 在无 mock 时返回 undefined,`|| []` 兜住)。
Run: `pnpm exec vue-tsc --noEmit` → 0 error。

- [ ] **Step 5: Commit**

```bash
git add src/ai/stores/agentStore.ts src/ai/stores/agentStore.p1c.test.ts
git commit -m "SP8-P1c1: store visible-resources + attachments domains, selectSession loaders, send tail"
```

---

