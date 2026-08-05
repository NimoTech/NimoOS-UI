# P1c2 Task 3 — store thinking domain + session watcher wiring

Commit: `eb0c978` — `SP8-P1c2: store thinking domain + session watcher wiring`

## Actions mapped to Vue2

| New-UI symbol | Vue2 source | Notes |
|---|---|---|
| `loadThinkingDefaults()` (`src/ai/stores/agentStore.ts`, above `updateThinkingForModel`) | `agentStore.js:656-660` | `try { thinking.defaults = await service.ai.getThinkingDefaults() } catch {}`. Verbatim swallow. |
| `loadSessionThinking(sessionId)` | `agentStore.js:663-669` | No id → return, no request. `cfg = await service.ai.getSessionThinking(id)`; only writes `enabled`/`level`, never touches `supportsThinking`/`providerType`. |
| `setThinkingEnabled(enabled)` | `agentStore.js:671-677` | Optimistic local write first; patches only `if (activeSessionId.value)`; **no try/catch** — rejection propagates. |
| `setThinkingLevel(level)` | `agentStore.js:680-686` | Same shape as above, mutates `level`. |
| `AgentPage.vue` `onMounted` — `await store.loadThinkingDefaults()` before `loadSessions()`/`loadAvailableModels()` | `Agent.vue:151` | Wrapped in its own try/catch for stylistic consistency with the surrounding calls (the store function already swallows internally, so this never actually throws). |
| `AgentPage.vue` `activeSessionId` watcher — extended (not duplicated) with `loadSessionThinking(newId)` + `updateThinkingForModel()` before `refreshContextUsage()` | `Agent.vue:120-123` | Both new calls guarded by `if (newId)`; neither is awaited (fire-and-forget, matches Vue2); `refreshContextUsage()` still runs unconditionally, unchanged from Task 12. |

`updateThinkingForModel` and the `thinking` ref itself were untouched — both pre-existed from phase 1b, per the brief.

## Deliberate-keep list (not bugs, not fixed)

1. **`loadThinkingDefaults` swallows all errors, keeping the hard-coded fallback.** `thinking.defaults` starts at `{ enabled: true, level: 'medium' }` (already the product's chosen fallback), so a failed fetch degrades to "ThinkingBar renders with sane defaults" rather than blocking the page. Vue2 does the exact same thing (`catch { /* keep hard-coded fallback */ }`).
2. **`setThinkingEnabled`/`setThinkingLevel` optimistically mutate local state before the network call and never roll back on failure.** This is Vue2's real behavior (`agentStore.js:671-686` has no try/catch around the `await ai.patchSessionThinking(...)` call at all — a rejection propagates to the caller with local state already changed). Preserved verbatim: the UI reflects the user's toggle instantly and a failed patch is not visually undone mid-interaction; the next successful patch or `loadSessionThinking()` call is what would reconcile state. Both are covered by tests asserting the rejection is not swallowed and the local field remains at its new value.
3. **No session → setters only touch local state, no request is sent.** Matches Vue2's `if (state.activeSessionId) { ... }` guard exactly.

None of these were logic bugs to fix — they're documented, intentional Vue2 semantics per the brief, and are called out with `agentStore.js:NNN` line-number comments in the new code.

## Watcher wiring / call order

`AgentPage.vue` onMounted, in order:
1. `store.initTheme()`
2. `await store.loadThinkingDefaults()` (own try/catch, new)
3. `await store.loadSessions()` (existing try/catch)
4. `await store.loadAvailableModels()` (existing try/catch)
5. `refreshContextUsage()` (existing, mounted-trigger #1)
6. `?skill=` / `?search=`/`?message=` handoff (existing, unchanged)

`activeSessionId` watcher (single watcher, extended — not a second one):
```ts
watch(
  () => store.activeSessionId,
  (newId) => {
    if (newId) {
      store.loadSessionThinking(newId)
      store.updateThinkingForModel()
    }
    refreshContextUsage()
  },
)
```
`busy` true→false watcher (mounted-trigger #3) is unchanged from Task 12.

## Test commands and output

```
pnpm test -- src/ai/stores/ src/ai/views/AgentPage.test.ts
```
Before implementation (Step 2, confirming red): 13 failed / 20 passed (33) — all failures were `TypeError: s.setThinkingEnabled/setThinkingLevel is not a function` and `The property "loadThinkingDefaults"/"loadSessionThinking" is not defined on the object` (Pinia setup-store spy guard), exactly the four missing symbols.

After implementation:
```
Test Files  4 passed (4)
     Tests  100 passed (100)
```

```
pnpm exec vue-tsc --noEmit
```
No output — 0 errors.

Both commands run from `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`. Did not run the full suite per instructions (other agents concurrently active).

## Test files touched

- `src/ai/stores/agentStore.p1c2.test.ts` — extended the existing hoisted `svc` mock with `getThinkingDefaults`/`getSessionThinking`/`patchSessionThinking`; appended a new `describe('agentStore P1c2 Task3:thinking 域(loaders/setters)')` block (10 cases) rather than creating a second mock/file.
- `src/ai/views/AgentPage.test.ts` — same three methods added to its hoisted `svc` mock (defaulted `getThinkingDefaults` → `{enabled:true, level:'medium'}`, `getSessionThinking` → `null` in `beforeEach` so unrelated existing tests aren't perturbed); added 3 new cases: mounted-order (`loadThinkingDefaults` before `loadSessions`), session-switch triggers all three calls, and no-session-id switch triggers none.

## Noticed but left alone

- `service.ai.getSessionThinking` (shared package, `NimoOS-Service/src/ai.ts:187-198`) already both normalises "no override" → `null` and swallows its own request errors — confirmed by reading it before writing `loadSessionThinking`, so no additional try/catch was needed there (matches brief's pointer).
- `getThinkingDefaults`'s response body shape (`{enabled, level}`) was cross-checked against the Vue2 Settings page (`ThinkingDefaultsSection.vue:56-58`) to confirm `state.thinking.defaults = d` needs no field renaming (unlike the per-session endpoint's `thinking_enabled`/`thinking_level` naming, which the shared package already normalizes).
- `lastFallbackNotice` toast watcher and ThinkingBar/ModelPicker UI remain out of scope for this task (explicitly deferred to later 1c-2 tasks per the phase-scope note and the file's own header comment).
