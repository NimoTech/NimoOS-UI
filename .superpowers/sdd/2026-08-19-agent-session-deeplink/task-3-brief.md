### Task 3: Follow `?session=` changes while mounted

vue-router 4 does not re-run `onMounted` for a query-only navigation on the same route — the lesson `47a6cc2f` recorded for Photos deep links. Without this task, an in-app link or an address-bar edit reaching an already-open Agent page does nothing.

**Files:**
- Modify: `src/ai/views/AgentPage.vue` (new watcher next to the session watcher)
- Modify: `src/ai/views/AgentPage.test.ts:1` (import `reactive`), `:37` (make the route mock's query reactive)
- Test: `src/ai/views/AgentPage.test.ts`

**Interfaces:**
- Consumes: `route.query.session`, `urlQuery` (Task 1), `store.sessions`, `store.selectSession`, `store.activeSessionId`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Make the route mock's query reactive**

In `src/ai/views/AgentPage.test.ts`, line 1 area, add the Vue import:

```ts
import { reactive } from 'vue'
```

and change line 37 from `const routeQuery: Record<string, string> = {}` to:

```ts
// reactive so a watcher on route.query.session sees address-bar-style changes; existing
// tests only read or assign keys, so this is transparent to them.
const routeQuery: Record<string, string> = reactive({})
```

- [ ] **Step 2: Write the failing tests**

Append to `src/ai/views/AgentPage.test.ts`:

```ts
  it('A-8: changing ?session= while mounted switches sessions (query-only nav does not re-mount)', async () => {
    svc.listAgentSessions.mockResolvedValue([{ id: 's1' }, { id: 's2' }])
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'selectSession').mockResolvedValue(undefined)
    mountPage()
    await flushPromises()
    routeQuery.session = 's2'
    await flushPromises()
    expect(spy).toHaveBeenCalledWith('s2')
  })

  it('A-8: an unknown or already-active ?session= change is a no-op', async () => {
    svc.listAgentSessions.mockResolvedValue([{ id: 's1' }])
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'selectSession').mockResolvedValue(undefined)
    mountPage()
    await flushPromises()
    store.activeSessionId = 's1'
    await flushPromises()
    spy.mockClear()
    routeQuery.session = 'nope'
    await flushPromises()
    expect(spy).not.toHaveBeenCalled()
    routeQuery.session = 's1'
    await flushPromises()
    expect(spy).not.toHaveBeenCalled()
  })

  it('A-8: dropping ?session= from the URL does not close the open conversation', async () => {
    routeQuery.session = 's1'
    svc.listAgentSessions.mockResolvedValue([{ id: 's1' }])
    const store = useAgentStore()
    vi.spyOn(store, 'selectSession').mockImplementation(async (id) => {
      store.activeSessionId = id
    })
    mountPage()
    await flushPromises()
    delete routeQuery.session
    await flushPromises()
    expect(store.activeSessionId).toBe('s1')
  })
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/ai/views/AgentPage.test.ts -t 'A-8'`
Expected: the first new test fails (`selectSession` not called on a query change); the other two pass trivially and become regression guards.

- [ ] **Step 4: Add the watcher**

In `src/ai/views/AgentPage.vue`, directly after the `activeSessionId` watcher, insert:

```ts
// A-8 — Vue2 Agent.vue:129-135: a query-only navigation on the same route does not re-run
// onMounted in vue-router 4 (the lesson 47a6cc2f recorded for Photos deep links), so follow
// ?session= here. Unknown ids are ignored rather than toasted: at mount a stale link deserves
// an explanation, mid-session it usually means a half-typed address bar. An empty value only
// forgets the parameter — it must not close the conversation the user is reading.
watch(
  () => route.query.session,
  (v) => {
    const id = (v ?? '').toString()
    if (id) urlQuery.value.session = id
    else delete urlQuery.value.session
    if (!id) return
    const found = store.sessions.find((s) => String(s.id) === id)
    if (found && String(store.activeSessionId ?? '') !== id) store.selectSession(found.id)
  },
)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/ai/views/AgentPage.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 6: Commit**

```bash
git add src/ai/views/AgentPage.vue src/ai/views/AgentPage.test.ts
git commit -s -m "feat(ai): follow ?session= changes on an already-mounted Agent page

vue-router 4 does not re-mount for a query-only navigation, so a watcher is
what makes in-app links and address-bar edits work. Unknown ids are ignored
and an empty value never closes the open conversation.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

