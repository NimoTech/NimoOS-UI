# Agent page `?session=` deep link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/app/#/ai/agent?session=<id>` a real deep link in New-UI — the URL mirrors the selected session, a link selects it at mount, address-bar changes switch sessions — and repoint `openInApp` at New-UI, closing ticket A-8.

**Architecture:** `AgentPage.vue` keeps one page-scoped ref that mirrors the URL query; every URL write this page performs (the existing `skill` and `search`/`message` strips, plus the new session mirror) mutates that ref and replaces from it, so no writer can resurrect a key another writer just deleted. A mount-time read resolves `?session=` against the loaded session list, and a watcher on `route.query.session` handles query-only navigation, which vue-router 4 does not re-mount for.

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), Pinia, vue-router 4, vue-i18n (flat keys), Vitest + `@vue/test-utils`, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-19-agent-session-deeplink-design.md` — read it before Task 1; it carries the evidence and the two hazards this plan is shaped around.

## Global Constraints

- Branch `feat/agent-session-deeplink`, based on `master` @ `4fe81f86`. Worktree: `.claude/worktrees/agent-session-deeplink`.
- Commits: `git commit -s -m "..."` (DCO is enforced org-wide). Author must be `Tiansanchuan <1312528051@qq.com>` — already the global config here, and this repo has no local override. Never author as "Claude Agent".
- Commit messages and all code comments in English. No Chinese Markdown files.
- Test command: `pnpm exec vitest run <path>`. Typecheck: `pnpm exec vue-tsc --noEmit`. `npx` is not on PATH in this environment — use `pnpm exec`.
- i18n keys are bare identifiers (dotted keys need runtime handling, see `src/i18n/zh_cn.ai.ts:9`) and must be added to **both** `src/i18n/en_us.ai.ts` and `src/i18n/zh_cn.ai.ts`.
- Session ids are `string | number` (`src/ai/stores/agentStore.ts:139-140`) and `AgentSidebar.vue:158` compares them with `===`. Never feed a URL string where a numeric id is expected.
- Do not edit `.superpowers/sdd/*` — those are per-sprint historical ledgers. A-8's closure is recorded by the spec, this plan, and Task 4's commit.
- Pre-existing baseline failures on `4fe81f86` (NOT caused by this work, must not grow): full suite `5 failed | 760 passed` files / `4 failed | 12696 passed | 70 skipped` tests — `oss/cli-args.test.mjs`, `oss/export-rsync.test.mjs`, `oss/media-wave.test.mjs`, `oss/tree.test.mjs`, `src/home/util/timezone.test.ts`. The suites this plan touches (`AgentPage`, `openInApp`, `src/i18n` = 278 tests) are green at baseline.
- Never run two vitest processes at once while comparing against that baseline: `src/i18n/__tests__/photosSlice.test.ts` failed once under concurrent load and passes both in isolation and in the full run.

---

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
Expected: PASS for `AgentPage.test.ts` and the i18n guards (`i18nKeys`, `parity`) that now see the new key — the whole `src/i18n` directory included. (An earlier measurement recorded `photosSlice.test.ts` as red here; that was a concurrency artifact, corrected in Global Constraints. It passes.)

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

### Task 4: Point `openInApp` at New-UI (closes A-8)

**Files:**
- Modify: `src/ai/services/openInApp.ts:112-131`
- Test: `src/ai/services/openInApp.test.ts:195-238`

**Interfaces:**
- Consumes: nothing from earlier tasks at runtime — but it is only correct **after** Tasks 1-3, because it depends on New-UI's `/ai/agent` actually honouring `?session=`.
- Produces: `agentSessionUrl(sessionId) -> '/app/#/ai/agent?session=<encoded>'`, consumed by `openAgentSessionInNewTab` and, through the module, by `src/ai/knowledge/components/NoteEditPane.vue:480` (whose test mocks this module, so it needs no change).

- [ ] **Step 1: Flip the test's four assertions**

In `src/ai/services/openInApp.test.ts`, rewrite the block comment above `describe('agentSessionUrl / openAgentSessionInNewTab')` and the four URL assertions so both directions point the other way:

```ts
// SP8-P5d Task 5 / A-8 closed 2026-08-19: New-UI's /ai/agent now honours ?session=
// (see docs/superpowers/specs/2026-08-19-agent-session-deeplink-design.md), so these two
// functions land inside New-UI at /app.
// 🔴 Forward assertion: URL verbatim + reverse assertion "does not equal the root-mounted
// old Vue2 URL" — the reverse assertion is what discriminates: if someone reverts the landing
// point to /#/ai/agent, users leave New-UI on every "open source conversation" click, which
// the forward assertion alone could miss by string coincidence.
describe('agentSessionUrl / openAgentSessionInNewTab', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('builds a URL pointing at New-UI (mounted at /app)', () => {
    expect(agentSessionUrl('sess 1')).toBe('/app/#/ai/agent?session=sess%201')
  })
  it('does NOT point at the root-mounted old Vue2 app (reverse assertion, guards against a silent regression)', () => {
    expect(agentSessionUrl('sess 1')).not.toBe('/#/ai/agent?session=sess%201')
  })
  it('encodes special characters in the session id', () => {
    expect(agentSessionUrl('a&b c')).toBe('/app/#/ai/agent?session=a%26b%20c')
  })

  it('opens the agent session url in a new tab', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openAgentSessionInNewTab('sess-1')
    expect(spy).toHaveBeenCalledWith('/app/#/ai/agent?session=sess-1', '_blank')
  })
  it('the opened url is NOT the root-mounted old Vue2 route (reverse assertion)', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openAgentSessionInNewTab('sess-1')
    expect(spy.mock.calls[0][0]).not.toBe('/#/ai/agent?session=sess-1')
  })
```

Leave the two "does nothing when the session id is empty / null" tests exactly as they are.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/ai/services/openInApp.test.ts`
Expected: 5 failures — the two forward assertions, the `window.open` argument, **and both reverse assertions**. This plan first predicted 3, reasoning that the reverse assertions would "pass for the wrong reason"; that was wrong, and the Task 4 implementer measured it. Once flipped, a reverse assertion reads `not.toBe('/#/ai/agent?session=…')` while the unflipped implementation still returns exactly that string, so it necessarily fails. All five go green together in Step 3.

- [ ] **Step 3: Flip the implementation and rewrite its comment**

In `src/ai/services/openInApp.ts`, replace the comment block at `:112-122` and the function:

```ts
// 1:1 port from Vue2 openInApp.js:117-124 (`agentSessionUrl` / `openAgentSessionInNewTab`).
// Originally these deliberately landed on the root-mounted old Vue2 app because New-UI's
// /ai/agent read no `?session=` at all, so an /app-prefixed link would have opened the Agent
// page without selecting the session (a silent failure). Ticket A-8 closed that gap on
// 2026-08-19 — AgentPage now mirrors, reads and follows `?session=`
// (docs/superpowers/specs/2026-08-19-agent-session-deeplink-design.md) — so the landing point
// is New-UI's own route, and openInApp.test.ts's reverse assertions now guard against a
// regression back to the old app.
export function agentSessionUrl(sessionId: string | number): string {
  return '/app/#/ai/agent?session=' + encodeURIComponent(String(sessionId))
}
```

Leave `openAgentSessionInNewTab` unchanged — it delegates.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/ai/services/openInApp.test.ts src/ai/knowledge/components/NoteEditPane.test.ts`
Expected: PASS both — `NoteEditPane.test.ts` mocks the module, so it is only checked for collateral damage.

- [ ] **Step 5: Commit**

```bash
git add src/ai/services/openInApp.ts src/ai/services/openInApp.test.ts
git commit -s -m "feat(ai): land \"open source conversation\" inside New-UI, closing A-8

New-UI's /ai/agent now honours ?session=, so the note editor's session refs no
longer have to borrow the old Vue2 app's route. Both reverse assertions are
inverted to guard the new direction.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Gates and baseline comparison

**Files:**
- No source changes expected. Any fix this task uncovers is committed here.

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: the verification record quoted back to the user.

- [ ] **Step 1: Typecheck**

Run: `pnpm exec vue-tsc --noEmit`
Expected: no errors. Most likely failure mode is `urlQuery.value.session` being `LocationQueryValueRaw` where a `string` is wanted — fix by keeping the `.toString()` conversions shown in Tasks 1-3 rather than widening any type.

- [ ] **Step 2: Run the full suite**

Run: `pnpm test > /tmp/after.txt 2>&1; tail -20 /tmp/after.txt`
Expected: the failure set is unchanged from the baseline in Global Constraints — still 5 failed files / 4 failed tests, all of them the pre-existing `timezone` / `photosSlice` family, and the counts of passing tests grew by the tests added here.

- [ ] **Step 3: Report honestly**

State the before/after failure counts and name the pre-existing failures explicitly. If any new failure appeared, fix it and re-run rather than reporting "green".

- [ ] **Step 4: Commit anything Step 1-3 required**

```bash
git commit -s -am "fix(ai): <what the gate caught>

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Skip this step if the gates were clean.
