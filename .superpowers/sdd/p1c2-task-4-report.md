# P1c2 Task 4 report — store `regenerateTitle` + `regeneratingTitleFor`

## Ported action mapped to Vue2 lines

`src/ai/stores/agentStore.ts` — new `regenerateTitle(id, opts?: { background?: boolean })`
ports `agentStore.js:210-244` verbatim:

| Vue2 line(s) | Behaviour | Port location |
|---|---|---|
| 212-213 | `if (!key) return` (no selectedModel) | same guard, first line |
| 214-215 | `firstColon < 0 → return` | `if (key.indexOf(':') < 0) return` (added — see equivalence verdict below) |
| 216-224 | split `local:<name>` / `cloud:<id>:<name>` | delegated to existing module-private `parseModelKey` |
| 225 | `if (!model) return` | `if (!modelName) return` |
| 227-228 | `providerType = sel?.provider_type \|\| (source==='local' ? 'ollama' : 'other')` | identical expression |
| 230 | `state.regeneratingTitleFor = { id, background }` | `regeneratingTitleFor.value = { id, background }` (new ref, object not boolean) |
| 232-237 | POST regenerate, write back `sessions[idx].title` only if `data.title` truthy | identical (`body` = HTTP body directly, no extra `.data` peel per repo convention) |
| 238-240 | `catch { console.warn(...) }` — swallowed, promise still resolves | identical, kept verbatim as **deliberate** (see below) |
| 241-243 | `finally { state.regeneratingTitleFor = null }` | identical |

`autoTitleFirstTurn` (1b) now delegates: `return regenerateTitle(id, { background: true })` —
no re-parsing of the model key remains in that function. Call site in `send()`'s `finally`
(agentStore.js:416-417) still fires-and-forgets, now with an explicit `.catch(() => {})` added
to literally mirror Vue2's `actions.regenerateTitle(...).catch(() => {})` (functionally a no-op
today since `regenerateTitle` never rejects, but keeps the call site's intent visible and
future-proof if that invariant ever changes).

## `parseModelKey` equivalence verdict (case by case)

Existing module-private `parseModelKey(key)` (near top of `agentStore.ts`):
```
const idx = key.indexOf(':')
const source = key.slice(0, idx)
const rest = key.slice(idx + 1)
if (source === 'local') return { source, modelName: rest }
const idx2 = rest.indexOf(':')
return { source, modelName: idx2 >= 0 ? rest.slice(idx2 + 1) : rest }
```

- **`local:<name>`**: `idx` = first colon, `rest` = name. Equivalent to Vue2's local branch. ✅
- **`cloud:<id>:<name>`**: `idx2` finds the second colon, `modelName = rest.slice(idx2+1)`.
  Equivalent to Vue2's `secondColon >= 0 ? rest.slice(secondColon+1) : rest`. ✅ (the
  "missing second colon" tolerance is already built into `parseModelKey` itself — nothing to add).
- **`key` with no colon at all** (Vue2's `firstColon < 0` guard, line 214-215): **NOT
  equivalent**. `parseModelKey` with `idx = -1` computes `source = key.slice(0, -1)` (drops
  the last character instead of erroring) and `rest = key.slice(0)` = the full key. For a
  non-`'local'` source this falls into the cloud branch, finds no second colon either, and
  returns `modelName = rest` = the **entire original malformed key** — non-empty, so it would
  *not* be caught by the `!modelName` fallback and would proceed to call the regenerate API
  with garbage input. Vue2 refuses outright in this case.
  **Fix applied**: added `if (key.indexOf(':') < 0) return` immediately before calling
  `parseModelKey`, preserving Vue2's guard exactly, then delegating the actual split to
  `parseModelKey`. Documented inline in the new JSDoc comment above `regenerateTitle`.
  (In current practice `selectedModel` is always constructed with a colon by
  `buildCloudModelList`/local-model bootstrap, so this only matters for a corrupted/legacy
  `localStorage` value — but the brief asked to keep the guard rather than silently drop it.)

## Deliberate-keep list

1. **Catch only `console.warn`s, promise still resolves** (agentStore.js:238-240). Kept
   verbatim, not "fixed" — this is the behaviour the brief explicitly flagged as intentional:
   both the sparkle button (later task) and `send()`'s fire-and-forget first-turn call rely on
   `regenerateTitle` never rejecting so they can call it without wrapping in their own
   try/catch. Comment added in the new JSDoc explaining why.
2. **`send()`'s fire-and-forget call site not awaited** — kept; only cosmetic addition of an
   explicit `.catch(() => {})` to literally match Vue2's call-site shape (harmless no-op given
   point 1, but documents the contract at the call site itself, not just inside the callee).

No other Vue2 defects encountered in this slice (unlike some other agentStore.js actions with
"no rollback on failure" defects noted elsewhere in the file, this action's Vue2 source has no
such issue — it doesn't rollback anything, and the finally-reset of `regeneratingTitleFor`
happens unconditionally in both Vue2 and the port).

## Tests

Appended `describe('agentStore P1c2 Task4:regenerateTitle + regeneratingTitleFor', ...)` to
`src/ai/stores/agentStore.p1c2.test.ts`, reusing the file's existing hoisted `svc` mock
(`regenerateAgentSessionTitle` was already declared in it). Also promoted the file's inline
`agentTransport` mock to named hoisted `runSpy`/`attachSpy` (mirroring `agentStore.test.ts`)
so the two `send()`-driven delegation tests could control `runAgentRun`; this doesn't affect
the existing Task2/Task3 describes, which never touch those two mocks.

13 new cases: no-selectedModel guard, no-colon malformed-key guard, local-key model/providerType
extraction (fallback `ollama`), cloud-key model/providerType extraction (both with a matching
`availableModels` entry and with none → fallback `other`), success write-back, empty-title
no-write-back, failure-swallowed + `regeneratingTitleFor` reset, `background: true` passthrough
+ object shape verified mid-flight (via a manually-resolved promise), `background` defaults to
`false`, and two `send()`-driven tests proving `autoTitleFirstTurn` delegates through the exact
same `regenerateTitle` path (using `flushPromises()` from `@vue/test-utils` to let the
fire-and-forget microtask settle before asserting).

### Commands run

```
pnpm test -- src/ai/stores/
```
```
 Test Files  3 passed (3)
      Tests  93 passed (93)
   Start at  10:40:59
   Duration  680ms (transform 365ms, setup 490ms, import 249ms, tests 112ms, environment 831ms)
```

```
pnpm exec vue-tsc --noEmit
```
→ no output, exit 0 (0 errors).

Tests were written first per TDD (Step 1/2 of the brief): before implementing, the new
`describe` block referenced `s.regenerateTitle`/`s.regeneratingTitleFor`, which didn't exist
yet on the store, so the suite failed to even construct the expected calls (all new
assertions red) until the implementation + return-object exports landed. Confirmed green only
after Step 3.

## Noticed but left alone

- The brief's phase-scope note says no UI in this task — the sparkle button and top-bar title
  input lock (which will read `regeneratingTitleFor.background`) are out of scope here; only
  the state shape was built to spec (`{ id, background }`, not boolean) so that task can
  consume it directly.
- No new i18n keys were needed (no user-facing strings introduced).
- No color literals introduced.
