# Task 7 report — store send/stop/continueRun/confirmAgentAction + model bootstrap + attach

## Commit
`d63f7e2` — `SP8-P1b: store send/stop/continueRun/confirm + minimal model bootstrap + attach`

## Files changed
- `src/ai/stores/agentStore.ts` — main implementation
- `src/ai/stores/agentStore.test.ts` — tests (new Task 7 describe block + updated `selectSession` tests)
- `src/ai/views/AgentPage.vue` — `store.loadAvailableModels()` added to `onMounted`, before the auto-send handoff block
- `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts` — added `aiNoModelsAvailable` key (both, parity-test-safe)

## What was added

**State** (all exposed on the returned store object): `availableModels`, `selectedModel`, `lastFallbackNotice`, `thinking` (`{enabled,level,supportsThinking,providerType,defaults}`), `pendingSkillId`. `abortController` narrowed `unknown → AbortController|null`; `pendingCancel` narrowed `unknown → Promise<unknown>|null`.

**Pure/local helpers**: `buildCloudModelList(providers)` (exported, verbatim port of agentStore.js:8-26), `parseModelKey(key)` (private, factors out the `local:`/`cloud:<id>:<name>` parsing shared by send/continueRun/autoTitleFirstTurn).

**Actions**: `createStreamActions()`, `loadAvailableModels()`, `selectModel(key)`, `updateThinkingForModel()`, `send(payload)`, `stop()`, `continueRun()`, `confirmAgentAction(confirmId, confirmed, remember?)`. Also a private (not exported on the store) `autoTitleFirstTurn(id)` — extracted from Vue2's `regenerateTitle` action, called only from `send()`'s `finally` for the first-turn auto-title trigger; not exposed as its own store action since the brief's produced-actions list didn't include `regenerateTitle`/`regeneratingTitleFor` (that's UI/1c scope).

**`selectSession`** now: aborts any prior in-flight stream at the top (unchanged position from Vue2), loads+migrates messages, then creates a new `AbortController`, sets `busy=true` optimistically, and **awaits** `attachAgentStream(id, ctl.signal, createStreamActions())`. Clears busy only if `!attached`; keeps the identity-based race-guard (`abortController.value === ctl`).

**Deliberate deviation from Vue2** (called out per brief's Step 7 wording, which itself specifies `await`): Vue2's `attachAgentStream(...).then(...).catch(...)` in `selectSession` is fire-and-forget — the async function resolves before attach settles. This port `await`s it instead, so `selectSession()` only resolves once attach has settled. Behavior/semantics (busy handling, race-guard) are unchanged; only when the caller's `await selectSession()` returns changes. This makes the store synchronously testable and was requested explicitly by the brief's snippet.

## TDD evidence

**RED**: stashed `agentStore.ts`/`AgentPage.vue`/i18n changes (kept the new test file), ran `pnpm test -- agentStore` →
```
Test Files  1 failed (1)
     Tests  17 failed | 24 passed (41)
```
All 17 failures were `TypeError: s.selectModel/send/stop/continueRun/confirmAgentAction is not a function` — i.e., failing for the expected reason (missing implementation), not a typo/setup bug.

**GREEN**: popped the stash (implementation restored), ran `pnpm test -- agentStore` →
```
Test Files  1 passed (1)
     Tests  41 passed (41)
```
One iteration needed: the first `stop()` test awaited `sendP` at the end after making `runAgentRun` hang forever via `mockImplementation(() => new Promise(() => {}))` — since the mock ignores the abort signal, `send()`'s awaited `runAgentRun` call never settles, so awaiting `sendP` timed out. Fixed by not awaiting `send()`'s return value (test only asserts `stop()`'s own effects: `busy` cleared, `cancelAgentRun` called).

**Full suite**: `pnpm test` → `Test Files 230 passed (230)`, `Tests 1397 passed (1397)`.

**Type-check**: `pnpm exec vue-tsc --noEmit` → clean, no output.

**i18n parity**: `pnpm test -- i18n` → 2 files / 4 tests passed (confirms `aiNoModelsAvailable` added to both locales without breaking the parity assertion).

## Self-review

- **Factory preserved**: `useAgentStore(agentType?)` signature and `defineStore(storeId, ...)()` structure untouched; all new state/actions live inside the same setup-store closure, so `useAgentStore('photos')` still gets its own instance with its own `send`/`stop`/etc.
- **`createStreamActions()` omits 1c actions**: only the 9 Task-4 primitives + `_lastNimoosSearchQuery` — no `appendStagedChange`/`appendVisibleResource`/`removeVisibleResourceFromList`, matching the brief's Step 3 snippet exactly.
- **`onError` dual-shape handled**: `send()`'s onError callback takes `unknown` and does `typeof err === 'string' ? err : JSON.stringify(err, null, 2)` — same as Vue2 lines 381-390, so it renders correctly whether `runAgentRun` calls it with a raw rejection or `{status, body}` (Task 6's two `onError(...)` call sites both hit this same code path; verified in the new `send:onError(dual-shape {status,body})...` test).
- **Attach wired**: `selectSession` creates a fresh `AbortController`, sets `busy=true` optimistically, awaits `attachAgentStream`, clears busy only when not attached, and keeps the identity race-guard. Covered by two new tests: default mock (`attached:false` → busy clears) and an `attached:true` case (busy stays true).
- **`stop()`/`continueRun()` typed against the narrowed `AbortController|null`/`Promise<unknown>|null` refs** — no more `unknown` casts needed at those call sites beyond the couple of `as AbortController` narrows inside `send`/`continueRun` where TS can't narrow a `ref.value` read across an intervening statement.
- **`regenerateAgentSessionTitle` / auto-title**: kept as a small private helper (`autoTitleFirstTurn`) rather than a full `regenerateTitle` action with `regeneratingTitleFor` UI state — that state isn't in the brief's produced-state list and belongs to 1c's title-regenerate UI. If a later task wants a user-triggered "regenerate title" button, this helper will need to be promoted/generalized then (currently swallows all errors internally and isn't cancellable).
- **`i18n.global.t(...)`** used directly (not `useI18n()`) since the store is a Pinia setup-store, not a component — matches how `legacy:false` global-scope i18n is meant to be called outside `<script setup>`.

## Concerns

- `autoTitleFirstTurn` is intentionally not store-exposed and has no test of its own (the two `send()` tests that could trigger it — happy-path and auto-create — never populate `sessions.value` with a matching id, so the guard `sessions.value.find(...)` short-circuits and the call never fires). If a later 1c task wires a manual "regenerate title" button, this logic will likely need to be pulled out into a proper action with its own tests at that point.
- `stop()`/`continueRun()`/`confirmAgentAction()` are declared `async` per the brief's stated interface signatures (`Promise<void>`) even though `stop()` has no internal `await` (mirroring Vue2's fire-and-forget `pendingCancel` design, where the cancel promise is intentionally not awaited by `stop()` itself). Behaviorally identical to a non-async `void` function; kept `async` only to match the documented signature.
