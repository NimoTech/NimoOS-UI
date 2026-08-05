# P1b Task 4 report — store streaming primitives + provide/inject seam

## Summary

Added the 9 streaming-primitive actions to the P1a Pinia agent-store factory
(verbatim port from Vue2 `NimoOS-UI/src/views/AI/Agent/store/agentStore.js:64-150`),
hooked `migrateLegacyMessages` into `selectSession`'s raw-message-assign point,
and created the provide/inject seam (`useProvidedAgentStore`) consumed by later
tasks (8, 11) for a future Photos-profile embed.

## What was added

**`src/ai/stores/agentStore.ts`**
- New refs: `abortController` (unknown, typed loose — concrete shape belongs to
  the Task 6 transport), `activitySteps: Record<string, unknown>[]`,
  `pendingCancel` (unknown).
- New actions, ported verbatim with Vue2-isms converted (`Vue.observable`→existing
  refs, direct assign instead of `Vue.set`, `splice(i,1,next)` kept as-is —
  still correct array-replacement in Vue3/Pinia reactivity):
  `pushUserMessage`, `startAssistant`, `appendBlock`, `patchBlock`,
  `setStreamingDone`, `setBusy`, `patchAssistantStats`, `pushActivityStep`,
  `markRunningStepDone`. Same id-gen scheme (`u<ts>-<rand>`, `a<ts>-<rand>`,
  `s<ts>-<rand>`) and same reverse-find-from-end semantics as the Vue2 source.
- `selectSession`: raw assign `messages.value = Array.isArray(body) ? body : []`
  replaced with `messages.value = migrateLegacyMessages(raw as any) as unknown as AgentMessage[]`
  — the double cast bridges the store's local loose `AgentMessage = Record<string, unknown>`
  type and `types.ts`'s stricter `AgentMessage` (the two are intentionally
  different: P1a's local type predates Task 3's shared contracts and isn't
  being widened in this task, per the brief's "do not restructure existing
  actions" constraint).
- All new refs/actions added to the factory's `return {}` block; nothing
  removed or renamed.

**`src/ai/composables/useProvidedAgentStore.ts`** (new file) — exactly per the
brief: `provideAgentStore(store)` + `useProvidedAgentStore()` using a
`Symbol('agentStore')` `InjectionKey`, falling back to `useAgentStore()`
('general' profile) when no ancestor provided one.

**`src/ai/views/AgentPage.vue`** — `provideAgentStore(store)` called
immediately after `const store = useAgentStore()`.

**`src/ai/stores/agentStore.test.ts`** — added the 4 primitive tests from the
brief verbatim, plus 2 more of my own: a `pushUserMessage` shape test and a
`selectSession` → `migrateLegacyMessages` integration test (mocks a persisted
`run_command` tool block, asserts it comes back as a `terminal` block with
`state:'success'`). Softened the P1a busy-invariant test's wording/comment
("busy is now toggleable via setBusy/setStreamingDone; this only asserts a
FRESH store starts false") — the assertion itself (`busy === false` on a new
store) is unchanged.

**`tsconfig.json`** — `lib` bumped `ES2020` → `ES2022`. Required because the
brief's test code uses `Array.prototype.at(-1)`, which isn't in the ES2020 lib
declarations and failed `vue-tsc --noEmit` with TS2550. `target` was left at
`ES2020` (no output/syntax change) — `.at()` is a runtime method present in
all evergreen browsers, so this only widens available type declarations, not
emitted syntax. No other file in the repo used `.at()` before this task, so
this constraint hadn't come up yet.

## TDD evidence

**RED** (`pnpm test -- agentStore`, after Step 2 tests added, before
implementing primitives):
```
FAIL … setStreamingDone flips busy false … TypeError: s.setBusy is not a function
FAIL … patchAssistantStats merges stats … TypeError: s.startAssistant is not a function
FAIL … pushActivityStep + markRunningStepDone … TypeError: s.pushActivityStep is not a function
FAIL … pushUserMessage:… TypeError: s.pushUserMessage is not a function
FAIL … selectSession: … migrateLegacyMessages … expected {type:'tool'} to match {type:'terminal',...}
Test Files  1 failed (1)
     Tests  6 failed | 19 passed (25)
```

**GREEN** (after implementation):
```
pnpm test -- agentStore
Test Files  1 passed (1)
     Tests  25 passed (25)
```

**Full suite + type-check** (after the above, before commit):
```
pnpm test
Test Files  228 passed (228)
     Tests  1318 passed (1318)

pnpm exec vue-tsc --noEmit
(no output — clean)
```

## Files changed

- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/stores/agentStore.ts`
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/stores/agentStore.test.ts`
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/composables/useProvidedAgentStore.ts` (new)
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/views/AgentPage.vue`
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/tsconfig.json`
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/types.ts` (staged/committed per brief's Step 9 file list, but unmodified — pre-existed from Task 3)

Commit: `b55113a` — "SP8-P1b: store streaming primitives + types + provide/inject seam + migrate hookup"

## Self-review

- **Factory preserved**: `useAgentStore(agentType?)` signature, the
  `` `ai-agent-${agentType ?? 'general'}` `` store-id, and the trailing `()`
  instantiation are all untouched. The pinned identity test
  (`agentStore.test.ts:22-28`, "工厂:按 agentType 生成独立 store 实例…")
  still passes unmodified. No existing action was renamed, restructured, or
  removed — only additions.
- **migrate hookup**: confirmed by a dedicated integration test (not just
  trusting the brief's snippet) — mocked `listAgentMessages` to return a
  persisted `run_command` tool block and asserted the store's `messages`
  comes back with the migrated `terminal` block shape. This exercises the
  actual `selectSession` → `migrateLegacyMessages` wiring, not just a unit
  test of the mapper in isolation.
- **Verbatim-port fidelity**: compared side-by-side against
  `NimoOS-UI/src/views/AI/Agent/store/agentStore.js:64-150` line by line —
  id-gen formats, reverse-find loops (`for i = length-1; i>=0; i--`),
  `splice(i,1,next)` replacement idiom, and the `console.debug` no-running-step
  fallback in `markRunningStepDone` are all preserved.
- **Provide/inject seam**: matches the brief's code exactly; `AgentPage.vue`
  calls it right after store creation, so it's live for the current shell
  today even though nothing yet reads it via `useProvidedAgentStore()` (that
  starts in Task 8/11).

## Concerns

- The `tsconfig.json` `lib` bump (ES2020→ES2022) is a repo-wide config change,
  not scoped to this task's files. It was necessary to make the brief's
  verbatim test code (`Array.prototype.at`) type-check under
  `vue-tsc --noEmit`. Flagging in case the team wants `.at()` avoided instead
  (e.g. rewriting as `arr[arr.length-1]`) to keep the lib target untouched —
  happy to revert if preferred, but full test suite (1318 tests) and
  type-check both stay green with the change as-is, and no syntax/output
  target changed (only available type declarations widened).
- `abortController` and `pendingCancel` are typed as bare `unknown` refs (per
  the brief, their concrete shapes belong to the Task 6 transport layer) —
  Task 6 will need to narrow these when wiring the actual `AbortController`
  and cancel-confirmation flow.

## Fix round 1 (review: Needs fixes — Important)

Reviewer finding: the `tsconfig.json` `lib` bump (ES2020→ES2022) was a
repo-wide config change made only to let the brief's illustrative
`Array.prototype.at(-1)` test syntax type-check; the binding requirement is
the assertions, not that specific syntax. Required fix: revert `tsconfig.json`
to base and rewrite the `.at(-1)` calls as index access.

**Changes:**
- `tsconfig.json`: `lib` reverted `ES2022` → `ES2020`. Verified
  `git diff 1755dba -- tsconfig.json` now produces **no output** — file is
  byte-identical to the base commit.
- `src/ai/stores/agentStore.test.ts`: all 8 occurrences of `.at(-1)` (not just
  2 — the brief's 4 mandated tests plus my 2 additional tests both used it)
  rewritten as `arr[arr.length - 1]` / `s.messages[s.messages.length - 1]` /
  `s.activitySteps[s.activitySteps.length - 1]`. Assertions themselves
  unchanged — only the last-element access expression.

**Verification commands + output:**

```
$ pnpm test -- agentStore
 Test Files  1 passed (1)
      Tests  25 passed (25)

$ pnpm exec vue-tsc --noEmit
(no output — clean)

$ pnpm test   # full suite, re-run for safety
 Test Files  228 passed (228)
      Tests  1318 passed (1318)

$ git diff 1755dba -- tsconfig.json
(no output — tsconfig.json now identical to base)
```

Commit: `8029c93` — "SP8-P1b: fix revert tsconfig lib bump, drop
Array.prototype.at from agentStore tests"
