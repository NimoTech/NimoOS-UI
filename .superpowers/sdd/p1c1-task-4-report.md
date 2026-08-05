# P1c1 Task 4 report — store `sendInit(target)`

## Files changed

- `src/ai/stores/agentStore.ts` — added `sendInit(target: string): Promise<void>`, placed
  right after `send()` (before `stop()`), and added `sendInit` to the store's return object.
- `src/ai/stores/agentStore.p1c.test.ts` — appended `describe('agentStore P1c Task4:sendInit', …)`
  with the three cases from the brief, verbatim.

## `runAgentRun` signature check

Read `src/ai/services/agentTransport.ts`:

```ts
export async function runAgentRun(
  sessionId: string | number,
  body: Record<string, unknown>,
  providerType: string,
  signal: AbortSignal,
  actions: StreamActions,
  onError: (e: unknown) => void,
  extraHeaders: Record<string, string> = {},
): Promise<void>
```

The brief's own test snippet already calls `runAgentRun` with args in exactly this order
(`sessionId, body, providerType, signal, actions, onError, extraHeaders`), matching `send()`'s
existing call site. No reordering was needed — copied the brief's assertions unchanged.

## Bug found in Vue2 source, and the one deliberate deviation from literal line order

Vue2 `agentStore.js:423-441`: `sendInit` does `state.messages.push(user)`, `state.messages.push(assistant)`,
`state.busy = true`, `state.abortController = new AbortController()`, *then* inside `try`:
`if (!state.activeSessionId) await actions.createSession()`.

But `createSession()` (agentStore.js:166-183, and its port at `agentStore.ts:170-183`) does
`state.messages = []` / `messages.value = []` unconditionally. So if `sendInit` is called with no
active session yet (exactly the brief's own Task4 test t4a/t4b, which set no `activeSessionId`),
literally porting Vue2's order means `createSession()` wipes the two messages that were just
pushed — the test's `expect(s.messages[0]).toMatchObject({ role: 'user', … })` would then see
`undefined`. I confirmed this by implementing the literal Vue2 order first and watching it fail
with exactly that symptom (`s.messages[0]` undefined) even though `sendInit` existed and ran to
completion without throwing.

This is a genuine latent bug in Vue2's `sendInit` that `send()` (in the same file) does not have,
because `send()` calls `createSession()` *before* `pushUserMessage()`/`startAssistant()`
(agentStore.js:329-334). I resolved the conflict by matching `send()`'s ordering instead of
Vue2 `sendInit`'s literal order: ensure the session exists first, then push the two messages,
then validate the model, build headers, and call `runAgentRun`. Everything else — the payload
shape (`kind: 'init', init_target: target`, no `thinking` field), the English literal prompt
string, the dual-shape `onError` handling, the catch block, and the `finally` (no first-turn
auto-title, unlike `send()`) — is verbatim to Vue2's `sendInit`.

One consequence of this reordering, not covered by the brief's tests: if `createSession()`
itself throws, the catch block's `appendBlock` becomes a no-op (it only appends when the last
message is an assistant message, and none was pushed yet). Vue2's literal order doesn't have
this edge case since it pushes unconditionally first. I left this alone — it's an unlikely path
(session creation failing) and isn't asserted anywhere; flagging it here rather than guessing at
unspecified behavior.

## Test commands run

```
pnpm test -- src/ai/stores/agentStore.p1c.test.ts -t "Task4"
```
First run (TDD red): 3 failed — `TypeError: s.sendInit is not a function`.

After literal-order implementation, reran the same command: 2 of 3 failed with
`expected undefined to match object {...}` / `Cannot read properties of undefined (reading 'blocks')`
— this is what surfaced the createSession-wipe bug above.

After the reorder fix:

```
pnpm test -- src/ai/stores/agentStore.test.ts src/ai/stores/agentStore.p1c.test.ts
```
```
 Test Files  2 passed (2)
      Tests  66 passed (66)
```

```
pnpm exec vue-tsc --noEmit
```
No output — 0 errors.

## Commit

`990ef4c` — "SP8-P1c1: store sendInit (slash /init)"

## Left alone / noticed but out of scope

- `createSession()`'s messages-clearing behavior itself was not touched — it's relied on by
  `send()` and other already-passing tests, and changing it was out of scope for this task.
- No slash-command menu / composer UI wiring — per the task framing, that's a later task.

---

## Fix pass — error-block safety net (07-27 fix for silently swallowed errors)

### Change summary

Commit `f290910`: Added guard in `sendInit`'s catch block (lines 859-870) matching `send()`'s
safety net at lines 764-769. Before appending the error block, check whether the last message is
an assistant message; if not, call `startAssistant()` to create one. This ensures that when
`createSession()` throws, the error block has a valid host message and is visible to the user
instead of being silently swallowed.

**Test first (RED):**

```
pnpm test -- src/ai/stores/agentStore.p1c.test.ts
…
❯ src/ai/stores/agentStore.p1c.test.ts (26 tests | 1 failed) 39ms
    × sendInit:createSession 失败时补齐 assistant 占位(安全网) 4ms

…
TypeError: Cannot read properties of undefined (reading 'role')
  ❯ src/ai/stores/agentStore.p1c.test.ts:340:17
```

**After fix (GREEN):**

```
 Test Files  2 passed (2)
      Tests  67 passed (67)
```

`pnpm exec vue-tsc --noEmit` — 0 errors. Commit: `f290910`.

### What changed

- `src/ai/stores/agentStore.ts` (lines 859-870): Added const + if guard before `appendBlock()`,
  matching the pattern from `send()`'s catch at lines 764-769. Includes explanatory comment
  noting this is an improvement over Vue2 original (which lacks this guard, resulting in
  silently swallowed errors).
- `src/ai/stores/agentStore.p1c.test.ts` (lines 333-342): Added test case
  `sendInit:createSession 失败时补齐 assistant 占位(安全网)` verifying the fix works.
