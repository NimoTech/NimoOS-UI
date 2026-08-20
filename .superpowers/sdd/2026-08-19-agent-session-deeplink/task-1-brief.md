### Task 1: URL mirror of the selected session

Introduces the single-source-of-truth query ref and mirrors `activeSessionId` into `?session=`. The two existing one-shot strips are refactored onto the same ref in this task, because that refactor is what makes the mirror safe.

**Files:**
- Modify: `src/ai/views/AgentPage.vue:58` (imports), `:211-227` (session watcher and the comment above it), `:244` (mount seed goes right after `store.initTheme()`), `:302-311` (skill strip, starts at `const query = { ...route.query }`), `:315-323` (search/message strip, starts at `const seedSearch`)
- Test: `src/ai/views/AgentPage.test.ts` (append after the existing `does not call router.replace when no one-shot query params` test, ~`:219-226`)

**Interfaces:**
- Consumes: `store.activeSessionId` (`string | number | null`), `route.query`, `router.replace`.
- Produces, for Tasks 2 and 3:
  - `urlQuery: Ref<LocationQueryRaw>` — this page's mirror of the URL query.
  - `writeQuery(): Promise<void>` — replaces the URL from `urlQuery`; swallows navigation rejections.
  - `syncSessionQuery(id: string | number | null): void` — writes or strips `session`; no-ops when the value is already there.

- [ ] **Step 1: Write the failing tests**

Append to `src/ai/views/AgentPage.test.ts`, inside the `describe('AgentPage')` block:

```ts
  // A-8 (spec 2026-08-19-agent-session-deeplink): the selected session is mirrored into
  // ?session= so the address bar is always a shareable deep link.
  it('A-8: switching session mirrors it into ?session= (replace, so no history churn)', async () => {
    mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.activeSessionId = 'sess-a'
    await flushPromises()
    expect(replace).toHaveBeenLastCalledWith({ path: '/ai/agent', query: { session: 'sess-a' } })
  })

  it('A-8: a numeric session id is stringified for the URL', async () => {
    mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.activeSessionId = 42
    await flushPromises()
    expect(replace).toHaveBeenLastCalledWith({ path: '/ai/agent', query: { session: '42' } })
  })

  it('A-8: re-selecting the same session issues no further replace (equality guard)', async () => {
    mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.activeSessionId = 'sess-a'
    await flushPromises()
    const before = replace.mock.calls.length
    store.activeSessionId = 'sess-a'
    await flushPromises()
    expect(replace.mock.calls.length).toBe(before)
  })

  it('A-8: clearing the active session strips ?session= from the URL', async () => {
    mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.activeSessionId = 'sess-a'
    await flushPromises()
    store.activeSessionId = null
    await flushPromises()
    expect(replace).toHaveBeenLastCalledWith({ path: '/ai/agent', query: {} })
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/ai/views/AgentPage.test.ts -t 'A-8'`
Expected: 4 failed — `replace` was never called (the page does not write `session` yet).

- [ ] **Step 3: Add the type-only import**

In `src/ai/views/AgentPage.vue`, after line 58 (`import { useRoute, useRouter } from 'vue-router'`), add:

```ts
import type { LocationQueryRaw } from 'vue-router'
```

Type-only, so it is erased at compile time and does not disturb `AgentPage.test.ts`'s `vi.mock('vue-router', …)` factory.

- [ ] **Step 4: Add the query ref, the writer and the mirror**

In `src/ai/views/AgentPage.vue`, immediately **above** the comment block that starts `// Agent.vue:120-126 session watcher` (line ~210), insert:

```ts
// A-8 — `?session=` deep link (spec docs/superpowers/specs/2026-08-19-agent-session-deeplink-design.md).
// This page keeps its own mirror of the URL query and every write goes through writeQuery().
// Reason: router.replace resolves asynchronously, so a writer that rebuilt its query from
// route.query could resurrect a key another writer had just deleted — concretely, the session
// mirror firing after the ?search= strip would put search back, and the next refresh would
// re-send the seed turn. One ref, no stale reads. This generalises the local-copy discipline
// SP8-P3a introduced for chaining the skill and search/message strips.
const urlQuery = ref<LocationQueryRaw>({})
function writeQuery() {
  return router.replace({ path: '/ai/agent', query: { ...urlQuery.value } }).catch(() => {})
}
// Vue2 Agent.vue:211-220 — mirror the selected session into the URL. replace, not push:
// switching sessions must not pile up history entries. The equality guard keeps a deep link
// (and the route watcher that follows it) from bouncing a redundant navigation back.
function syncSessionQuery(id: string | number | null) {
  const next = id == null ? '' : String(id)
  if ((urlQuery.value.session ?? '').toString() === next) return
  if (next) urlQuery.value.session = next
  else delete urlQuery.value.session
  writeQuery()
}
```

- [ ] **Step 5: Call the mirror from the session watcher**

In the same file, in the `activeSessionId` watcher (line ~218-227), add the mirror call after `refreshContextUsage()`:

```ts
watch(
  () => store.activeSessionId,
  (newId) => {
    if (newId) {
      store.loadSessionThinking(newId)
      store.updateThinkingForModel()
    }
    refreshContextUsage()
    syncSessionQuery(newId)
  },
)
```

- [ ] **Step 6: Seed the mirror at the top of onMounted**

In `onMounted`, directly after `store.initTheme()`, add:

```ts
  // Seed the URL mirror before anything reads or rewrites the query (see urlQuery above).
  urlQuery.value = { ...route.query }
```

- [ ] **Step 7: Move the existing strips onto the mirror**

Replace the skill block (currently `const query = { ...route.query }` … `await router.replace({ path: '/ai/agent', query: { ...query } })`) with:

```ts
  const skill = urlQuery.value.skill
  if (skill) {
    store.pendingSkillId = String(skill)
    delete urlQuery.value.skill
    await writeQuery()
  }
```

Then replace the head of the search/message block:

```ts
  const seedSearch = (urlQuery.value.search ?? '').toString().trim()
  const seedMessage = (urlQuery.value.message ?? '').toString().trim()
  if (seedSearch || seedMessage) {
    delete urlQuery.value.search
    delete urlQuery.value.message
    await writeQuery()
```

Leave the rest of that block (the `try { … } catch { … }` with `createSession`/`send`) untouched. The long comment above the skill block still describes the mechanism correctly, but its parenthetical about using "a local `query` copy" now refers to `urlQuery` — update that sentence to name `urlQuery` and to say the ref is page-scoped and shared with the session mirror.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/ai/views/AgentPage.test.ts`
Expected: PASS — the 4 new `A-8` tests plus all pre-existing ones, in particular `one-shot: router.replace strips search/message but preserves other query params unchanged`, `?skill=abc&search=cats …` (still exactly 2 replaces, `{search:'cats'}` then `{}`), and `does not call router.replace when no one-shot query params` (still zero calls).

- [ ] **Step 9: Commit**

```bash
git add src/ai/views/AgentPage.vue src/ai/views/AgentPage.test.ts
git commit -s -m "feat(ai): mirror the selected agent session into ?session=

The Agent page now keeps one page-scoped mirror of the URL query; the skill
and search/message strips write through it too, so a replace that has not
landed yet can no longer resurrect a key another writer deleted.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

