### Task 2: Read the deep link at mount

**Files:**
- Modify: `src/ai/views/AgentPage.vue` (insert after the `loadSessions()` try/catch in `onMounted`, ~`:255-259`)
- Modify: `src/i18n/en_us.ai.ts:186`, `src/i18n/zh_cn.ai.ts:203`
- Test: `src/ai/views/AgentPage.test.ts`

**Interfaces:**
- Consumes: `urlQuery`, `syncSessionQuery` (Task 1); `store.sessions` (`AgentSession[]`), `store.selectSession(id: string | number)`, `toast.show(text, duration, tier)`, `t()`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing tests**

Append to `src/ai/views/AgentPage.test.ts`:

```ts
  it('A-8: ?session= selects that session once the list has loaded', async () => {
    routeQuery.session = 's2'
    svc.listAgentSessions.mockResolvedValue([{ id: 's1' }, { id: 's2' }])
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'selectSession').mockResolvedValue(undefined)
    mountPage()
    await flushPromises()
    expect(spy).toHaveBeenCalledWith('s2')
  })

  // The sidebar compares s.id === activeId strictly, so a numeric session fed the URL's
  // string would be "selected" with an unhighlighted row. Select the session's own id.
  it('A-8: a numeric session id is selected as a number, not as the URL string', async () => {
    routeQuery.session = '42'
    svc.listAgentSessions.mockResolvedValue([{ id: 42 }])
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'selectSession').mockResolvedValue(undefined)
    mountPage()
    await flushPromises()
    expect(spy).toHaveBeenCalledWith(42)
  })

  it('A-8: an unknown ?session= warns and strips the parameter', async () => {
    routeQuery.session = 'gone'
    svc.listAgentSessions.mockResolvedValue([{ id: 's1' }])
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'selectSession').mockResolvedValue(undefined)
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    mountPage()
    await flushPromises()
    expect(spy).not.toHaveBeenCalled()
    expect(showSpy).toHaveBeenCalledWith('找不到该会话 — 可能已被删除', 4000, 'warning')
    expect(replace).toHaveBeenLastCalledWith({ path: '/ai/agent', query: {} })
  })

  it('A-8: a known ?session= needs no replace at all (already in the URL)', async () => {
    routeQuery.session = 's2'
    svc.listAgentSessions.mockResolvedValue([{ id: 's2' }])
    const store = useAgentStore()
    vi.spyOn(store, 'selectSession').mockImplementation(async (id) => {
      store.activeSessionId = id
    })
    mountPage()
    await flushPromises()
    expect(replace).not.toHaveBeenCalled()
  })

  // The hazard the single query ref exists for: the seed strip must not be undone by the
  // mirror writing the freshly created session.
  it('A-8: ?session= + ?search= — search is stripped for good, final URL is the new session', async () => {
    routeQuery.session = 's1'
    routeQuery.search = 'cats'
    svc.listAgentSessions.mockResolvedValue([{ id: 's1' }])
    const store = useAgentStore()
    vi.spyOn(store, 'selectSession').mockResolvedValue(undefined)
    const createSpy = vi.spyOn(store, 'createSession').mockImplementation(async () => {
      store.activeSessionId = 'new-1'
    })
    const sendSpy = vi.spyOn(store, 'send').mockResolvedValue(undefined)
    mountPage()
    await flushPromises()
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenNthCalledWith(1, { path: '/ai/agent', query: { session: 's1' } })
    expect(replace).toHaveBeenLastCalledWith({ path: '/ai/agent', query: { session: 'new-1' } })
    for (const [arg] of replace.mock.calls) expect(arg.query).not.toHaveProperty('search')
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/ai/views/AgentPage.test.ts -t 'A-8'`
Expected: the 5 new tests fail — `selectSession` is never called, no toast, `?session=` is left in the URL.

- [ ] **Step 3: Add the i18n key to both shards**

`src/i18n/en_us.ai.ts`, after `aiNoModelAvailable` (line 186):

```ts
  aiSessionNotFound: 'Session not found — it may have been deleted',
```

`src/i18n/zh_cn.ai.ts`, after `aiNoModelAvailable` (line 203):

```ts
  aiSessionNotFound: '找不到该会话 — 可能已被删除',
```

Wording is verbatim from the Vue2 catalogue so the two apps read identically.

- [ ] **Step 4: Read the deep link in onMounted**

In `src/ai/views/AgentPage.vue`, immediately after the `loadSessions()` try/catch and **before** the `loadAvailableModels()` try/catch, insert:

```ts
  // A-8 — Vue2 Agent.vue:164-175: resolve ?session= now that the list exists. selectSession
  // gets the session's OWN id (ids are string | number and AgentSidebar compares with ===,
  // so handing it the URL string would select a numeric session without highlighting its row).
  const wantedSession = (urlQuery.value.session ?? '').toString()
  if (wantedSession) {
    const found = store.sessions.find((s) => String(s.id) === wantedSession)
    if (found) {
      try {
        await store.selectSession(found.id)
      } catch {
        /* ignore — mirrors the swallow-per-call mounted sequence; the URL keeps the id
           because the session does exist, only its messages failed to load */
      }
    } else {
      toast.show(t('aiSessionNotFound'), 4000, 'warning')
      syncSessionQuery(store.activeSessionId)
    }
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/ai/views/AgentPage.test.ts src/i18n`
Expected: PASS for `AgentPage.test.ts` and the i18n guards (`i18nKeys`, `parity`) that now see the new key. `src/i18n/__tests__/photosSlice.test.ts` stays red — pre-existing baseline failure, unrelated to this key.

- [ ] **Step 6: Commit**

```bash
git add src/ai/views/AgentPage.vue src/ai/views/AgentPage.test.ts src/i18n/en_us.ai.ts src/i18n/zh_cn.ai.ts
git commit -s -m "feat(ai): select the session named by ?session= at mount

Resolves the id against the loaded list and selects the session's own id, so
numeric ids still match the sidebar's strict comparison. An unknown id warns
once and drops the parameter.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

