# Agent page `?session=` deep link (closes ticket A-8)

Date: 2026-08-19
Branch: `feat/agent-session-deeplink`
Base: `master` @ `4fe81f86`

## Background

The Vue2 app has supported `/#/ai/agent?session=<id>` since `ae3d32c` (PR #87,
2026-07-18): the selected session is mirrored into the URL, a deep-linked
session is selected once the session list has loaded, a stale link raises a
toast and strips the parameter, and a query change while mounted switches
sessions (`NimoOS-UI/src/views/AI/Agent/Agent.vue:129/164-175/211-220`).

New-UI never received that port. `AgentPage.vue` reads exactly three query
parameters — `skill`, `search`, `message` — and `agentStore.ts` reads none, so
on `/app/#/ai/agent` switching sessions leaves the address bar unchanged and a
refresh lands on no session at all.

Because of that gap, `openInApp.ts:112-131` deliberately points the note
editor's "open source conversation" action at the **old** app
(`/#/ai/agent?session=…`, no `/app` prefix), and `openInApp.test.ts:210-225`
pins that with two reverse assertions so nobody "standardises the prefix" into a
silently broken link. Ticket A-8 (`.superpowers/sdd/p5d-common-constraints.md:687-700`,
handed off in `p5d-handoff-to-p5e-p5f.md:87`, still open in
`p5e-common-constraints.md:588`) is exactly this port.

Verified before designing (all on this worktree, base `4fe81f86`):

- `git log --all -S "session=" -- src` in NimoOS-New-UI hits only the
  `openInApp` addition plus SDD documents — the page never had this code, so
  nothing was removed by a squash merge.
- `loadSessions()` (`agentStore.ts:190-193`) only fills `sessions`; it does **not**
  auto-select. Without a deep link, `activeSessionId` stays `null` at mount, so
  the URL stays clean until the user picks or creates a session.
- The only consumer of `agentSessionUrl`/`openAgentSessionInNewTab` outside the
  service module is `src/ai/knowledge/components/NoteEditPane.vue:480`, and its
  test mocks the whole module — so flipping the landing point touches
  `openInApp.test.ts` only.

## Scope

In scope:

1. `AgentPage.vue` — mirror the selected session into `?session=`, read a deep
   link at mount, follow query changes while mounted.
2. `openInApp.ts` — flip `agentSessionUrl` to `/app/#/ai/agent?session=…` and
   invert the two reverse assertions in its test, closing A-8.
3. One new i18n key for the stale-link toast (`en_us.ai.ts` + `zh_cn.ai.ts`).
4. `AgentPage.test.ts` — make the `vue-router` mock's query reactive so the
   in-place watcher is testable.

Out of scope:

- The same latent one-shot-parameter resurrection in the Vue2 page
  (`Agent.vue:211-220` builds its replace from `$route.query`). Different repo,
  and the old page is being retired; recorded here, not fixed.
- Reacting to `?search=`/`?message=`/`?skill=` appearing **while** mounted.
  Neither app does that today; only `session` becomes live-reactive.
- Editing historical `.superpowers/sdd` ledgers. They are per-sprint records;
  A-8's closure is recorded by this spec, the plan, and the commit message.

## Design

### Unit 1 — page-level URL query, single source of truth

`AgentPage.vue` gains one page-scoped ref that mirrors what this page believes
the URL query is:

```ts
const urlQuery = ref<LocationQueryRaw>({})   // seeded from { ...route.query } atop onMounted
function writeQuery() {
  router.replace({ path: '/ai/agent', query: { ...urlQuery.value } }).catch(() => {})
}
```

`LocationQueryRaw` keeps the existing `{ ...route.query }` shape rather than
normalising values to strings, so array-valued parameters survive a round trip
untouched; only `session` is ever written, and always as a string. The import is
type-only, so it is erased at compile time and does not disturb
`AgentPage.test.ts`'s `vi.mock('vue-router', …)` factory.

Every URL write this page performs mutates `urlQuery` and then calls
`writeQuery()`. This generalises the local-copy discipline `4bfabfcd` introduced
for chaining the `skill` and `search`/`message` strips, and it is what makes the
new session mirror safe: `router.replace` resolves asynchronously, so any writer
that rebuilt its query from `route.query` could resurrect a key another writer
had just deleted. With one ref there is no stale read to make.

Concretely, the sequence `?session=s1&search=cats` must end at `?session=<new>`
with no `search`: the strip deletes `search` from the ref, then
`createSession()` flips `activeSessionId`, and the mirror writes the ref — which
no longer contains `search`. Reading `route.query` there would put it back and a
refresh would re-send the seed turn.

### Unit 2 — mirror the selected session

```ts
function syncSessionQuery(id: string | number | null) {
  const next = id == null ? '' : String(id)
  if ((urlQuery.value.session ?? '').toString() === next) return   // no-op guard: no replace churn
  if (next) urlQuery.value.session = next
  else delete urlQuery.value.session
  writeQuery()
}
```

Called from the existing `activeSessionId` watcher (`AgentPage.vue:218-228`),
alongside the current `loadSessionThinking`/`updateThinkingForModel`/
`refreshContextUsage` calls. `replace`, never `push`, so switching sessions does
not pile up history entries (same reason as Vue2). Deleting the last session
sets `activeSessionId` to `null` (`agentStore.ts:224-225`), which strips the
parameter through the same path.

The guard also closes the loop with Unit 4: a deep link selects a session, the
watcher fires, the value is already in the URL, no replace happens.

### Unit 3 — read the deep link at mount

Inserted in `onMounted` immediately after the existing `loadSessions()`
try/catch and before `loadAvailableModels()` — the list must exist to resolve
the id, and this mirrors Vue2's placement.

```
const wanted = (urlQuery.value.session ?? '').toString()
if (wanted) {
  const found = store.sessions.find((s) => String(s.id) === wanted)
  if (found) await store.selectSession(found.id)      // found.id, NOT wanted
  else { toast.show(t('aiSessionNotFound'), 4000, 'warning'); syncSessionQuery(store.activeSessionId) }
}
```

`found.id` rather than the URL string is load-bearing: session ids are
`string | number` (`agentStore.ts:139-140`) and `AgentSidebar.vue:158` compares
`s.id === activeId` strictly, so feeding a numeric session the string `"42"`
would select it while leaving the sidebar row unhighlighted. `String(s.id)`
on the lookup side keeps the comparison type-agnostic.

`selectSession` is awaited and wrapped in try/catch the same way the surrounding
mount steps are, so a failing message fetch cannot abort the rest of `onMounted`.

When the session is unknown, `syncSessionQuery(store.activeSessionId)` — `null`
at that point — strips the parameter, which is also what Vue2 does.

### Unit 4 — follow query changes while mounted

vue-router 4 does not re-run `onMounted` for a query-only navigation on the same
route (the lesson `47a6cc2f` recorded for Photos), so a watcher is required for
address-bar edits and for in-app links landing on an already-mounted page:

```ts
watch(() => route.query.session, (v) => {
  const id = (v ?? '').toString()
  if (id) urlQuery.value.session = id          // keep the ref honest about external navigation
  else delete urlQuery.value.session           // never leave a bare `session=` behind
  if (!id) return
  const found = store.sessions.find((s) => String(s.id) === id)
  if (found && String(store.activeSessionId ?? '') !== id) store.selectSession(found.id)
})
```

Unknown ids are ignored here rather than toasted: at mount a stale link is worth
explaining, but mid-session an unknown value usually means a half-typed address
bar, and Vue2 ignores it too. The empty branch deliberately does not clear the
active session — dropping the parameter should not close the conversation the
user is reading.

### Unit 5 — flip the openInApp landing point (closes A-8)

`agentSessionUrl` becomes `'/app/#/ai/agent?session=' + encodeURIComponent(...)`.
The block comment at `openInApp.ts:112-122` is rewritten: it currently explains
why the link points at the old app, and must now record that New-UI owns the
deep link as of this change, so the `/app` prefix is the correct landing point
and A-8 is closed.

`openInApp.test.ts` keeps its cross-verifying shape, with both directions
inverted: the forward assertions become `/app/#/ai/agent?session=…`, and the two
reverse assertions become `not.toBe('/#/ai/agent?session=…')` — i.e. they now
guard against a regression back to the root-mounted old app. Their comments are
updated for the same reason; leaving the old text would misdescribe what the
test defends.

### Unit 6 — i18n

One key, bare-identifier style (dotted keys need runtime handling — see the note
at `zh_cn.ai.ts:9`), added to both shards:

- `en_us.ai.ts`: `aiSessionNotFound: 'Session not found — it may have been deleted'`
- `zh_cn.ai.ts`: `aiSessionNotFound: '找不到该会话 — 可能已被删除'`

Wording is taken verbatim from the Vue2 catalogue (`zh_CN.json:2722`,
`en_US.json:2641`). `i18nKeys.test.ts` and `parity.test.ts` cover the key
automatically once it is referenced.

## Data flow

Mount, in order (existing steps unchanged unless noted):

| Step | Effect on URL |
| --- | --- |
| seed `urlQuery` from `route.query` | — |
| `loadThinkingDefaults`, `loadSessions` | — |
| **deep link (Unit 3)** | strips `session` if unknown; selecting fires Unit 2, guarded to a no-op |
| `loadAvailableModels`, `refreshContextUsage`, `disks.list` | — |
| `skill` strip (existing) | deletes `skill` from ref, writes |
| `search`/`message` strip + seed (existing) | deletes both from ref, writes; `createSession()` then fires Unit 2, which writes `session` onto the already-stripped ref |

While mounted: user action → `activeSessionId` → Unit 2 → URL. External
navigation → `route.query.session` → Unit 4 → `selectSession` → Unit 2 (no-op by
guard).

## Error handling

- Unknown session at mount: warning toast + parameter stripped; the page stays
  on whatever session (or none) is active.
- Unknown session mid-flight: ignored silently.
- `selectSession` rejection: swallowed like the neighbouring mount steps; the
  URL keeps the parameter, matching the store's own state (the session exists,
  its messages failed to load).
- `router.replace` rejection: `writeQuery()` swallows it (`.catch(() => {})`)
  — a redundant navigation must not surface as an unhandled rejection. The
  base (`4fe81f86`) did not swallow this; an unswallowed rejection there would
  have rejected `onMounted` itself and skipped model loading and the seed
  send, so this is an improvement introduced alongside `writeQuery()`, not a
  continuation of prior behaviour.

## Testing

TDD: each test below is written and observed failing before the corresponding
unit is implemented.

`AgentPage.test.ts` — infra change first: `routeQuery` becomes `reactive({})` so
Unit 4's watcher fires. Existing tests only read or assign keys, so they are
unaffected.

1. `?session=s2` in the list → `selectSession('s2')`, no toast, no `replace`.
2. numeric ids `[{id: 42}]` with `?session=42` → `selectSession` receives the
   number `42`, not `'42'`.
3. `?session=nope` → warning toast, `replace` without `session`, no
   `selectSession`.
4. session switch → `replace` with `session=<id>`; a second switch to the same
   id issues no further `replace`.
5. `activeSessionId` → `null` → `replace` without `session`.
6. `?session=s1&search=cats` → final `replace` carries `session=<new id>` and
   neither `search` nor `message` (the resurrection regression).
7. `?skill=abc&session=s1` → `skill` stripped, `session` preserved throughout.
8. address-bar change while mounted: assigning `routeQuery.session` selects the
   session; an unknown id and the already-active id are both no-ops.
9. unchanged: no query parameters at mount → no `replace` at all.

`openInApp.test.ts` — four assertions flipped (two forward, two reverse) plus
their comments.

Gates: `pnpm test` for the suites above, `pnpm exec vue-tsc --noEmit`, and the
i18n guards (`i18nKeys`, `parity`).

Baseline on `4fe81f86`, measured before any change: full run is
`5 failed | 760 passed` files / `4 failed | 12696 passed | 70 skipped` tests.
All five are pre-existing and unrelated to this surface — `oss/cli-args`,
`oss/export-rsync`, `oss/media-wave`, `oss/tree` (open-source export tooling)
and `src/home/util/timezone.test.ts` (expects `UTC+0`, gets `null` in this
environment). The suites this change touches — `AgentPage`, `openInApp`,
`src/i18n` — are green at baseline (278 tests).

One measurement caveat: `src/i18n/__tests__/photosSlice.test.ts` failed once
when run concurrently with the full suite and passes both in isolation and in
the full run. Do not run two suites at once when comparing against this
baseline. Success for this change means the touched suites stay green and the
five-file failure set does not grow.
