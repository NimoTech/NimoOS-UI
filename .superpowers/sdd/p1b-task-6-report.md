# Task 6 Report — agentTransport (`runAgentRun` + `attachAgentStream`)

## What was built

`src/ai/services/agentTransport.ts` — a thin transport layer on top of the shared
`sseRequest` (`@nimotech/nimoos-service`, Task 1):

- `langHeader()` — reads `localStorage.lang`, falls back to `navigator.language`, else
  `'en'`, lowercases and replaces `-` with `_`.
- `runAgentRun(sessionId, body, providerType, signal, actions, onError, extraHeaders={})`
  — `POST /v1/ai/agent/sessions/{id}/run` via `sseRequest` with headers
  `{ Language, 'X-Agent-Provider-Type': providerType, ...extraHeaders }`, `onEvent` wired
  to `dispatchEvent(evt, actions)` (Task 5 reducer). On rejection: `AbortError` is
  swallowed (`.catch` returns `null`, function returns early); any other rejection is
  reported via `onError(e)` and the function returns (never throws). On resolved
  `SseOutcome` with `!ok`, calls `onError({ status, body: outcome.errorBody })`.
- `attachAgentStream(sessionId, signal, actions)` — `GET
  /v1/ai/agent/sessions/{id}/run-stream` via `sseRequest`, same `onEvent` wiring.
  `noContent` or `!ok` → `{ attached: false, error }` (error omitted when the outcome was
  actually `ok` but `noContent`, i.e. the 204 case); `ok && !noContent` →
  `{ attached: true }`. Thrown `AbortError` → `{ attached: false }` (no error field);
  any other thrown error → `{ attached: false, error: e }`.

Matches the brief's skeleton verbatim (only added the guard on the run's `catch` per the
brief's own snippet, plus a couple of comments).

No re-implementation of `Authorization`, 401/refresh, `[DONE]`/204 parsing, or a
`consumeSSE` loop — all of that stays inside `sseRequest`.

## TDD evidence

**RED** — before `agentTransport.ts` existed:
```
FAIL  src/ai/services/agentTransport.test.ts [ src/ai/services/agentTransport.test.ts ]
Error: Failed to resolve import "./agentTransport" from "src/ai/services/agentTransport.test.ts". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

**GREEN** — after implementing `agentTransport.ts`:
```
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

13 cases (brief asked for 5 minimum; expanded slightly for full branch coverage):
1. `runAgentRun` builds `Language`/`X-Agent-Provider-Type` headers, spreads
   `extraHeaders`, POSTs the body object by reference, passes `signal`.
2. `Language` falls back to `navigator.language` when no `localStorage.lang`.
3. `onEvent` routes events to `dispatchEvent(evt, actions)`.
4. `!ok` outcome → `onError({status, body: errorBody})`.
5. `AbortError` from `sseRequest` → swallowed, promise resolves, `onError` not called.
6. Non-abort rejection from `sseRequest` → reported via `onError(e)`, promise still
   resolves (doesn't throw).
7. `attachAgentStream` GETs the run-stream endpoint, routes events to `dispatchEvent`,
   `ok` → `{attached:true}`.
8. `noContent`/204 → `{attached:false}` (no `error` key).
9. `ok:true, status:200` → `{attached:true}`.
10. Non-ok outcome with `error` field → `{attached:false, error}`.
11. Non-ok outcome without `error` field → falls back to `{attached:false, error:{status}}`.
12. Thrown `AbortError` → `{attached:false}` (no error field).
13. Non-abort thrown error → `{attached:false, error: e}`.

## Full verification

- `pnpm test -- agentTransport` → 1 file, 13 tests passed.
- `pnpm test` (full suite) → 230 files, 1381 tests passed, no regressions.
- `pnpm exec vue-tsc --noEmit` → clean, no output/errors.

## Files changed

- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/services/agentTransport.ts` (new)
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/services/agentTransport.test.ts` (new)

Commit: `44192cd` — `SP8-P1b: agentTransport run/attach on shared sseRequest (errorBody-aware)`

## Self-review

- Confirmed `sseRequest`'s actual shipped `.d.ts`
  (`node_modules/@nimotech/nimoos-service/dist/sse.d.ts`) matches the brief's assumed
  signature exactly (`SseOptions`/`SseOutcome`, including `errorBody?: unknown`) before
  writing anything — no import-path or signature guessing needed.
- Confirmed `dispatchEvent(event: Record<string,unknown>, actions: StreamActions)` and
  `StreamActions` (Task 5/Task 3) match what the transport calls into.
- `runAgentRun`'s body is passed to `sseRequest` by reference (test asserts
  `opts.body).toBe(body)`) — `sseRequest` itself owns JSON-encoding; this file doesn't
  double-encode.
- Verified vitest's `toEqual` treats an explicit `error: undefined` key as equal to the
  key being absent, so `{attached:false, error: outcome.ok ? undefined : ...}` correctly
  satisfies the brief's literal `{attached:false}` expectation for the 204 case without
  needing a branch to omit the key.
- No colors/theme touched — pure logic/fetch-orchestration file, consistent with the
  "no colors" instruction for this task.
- Followed existing repo conventions: no semicolons, `vi.mock('@nimotech/nimoos-service',
  ...)` module-level factory (mirrors `src/composables/useAuth.test.ts`'s pattern), mock
  reset in `beforeEach`.

## Concerns

- None blocking. One minor judgment call: the brief's skeleton has
  `.catch(e => { if ((e as Error)?.name !== 'AbortError') onError(e); return null })` for
  `runAgentRun`, which means a *non*-abort rejection reports the raw thrown error object
  to `onError` (not wrapped in `{status, body}` like the `!ok` outcome path) — this is a
  different shape than the `!ok` branch's `{status, body}`. Task 7 (`send`/`continueRun`)
  will need to handle both shapes in its `onError` callback (raw error vs.
  `{status, body}`). This matches the brief's skeleton exactly, so implemented as
  specified; flagging for whoever writes Task 7's `onError` handler.
- `runAgentRun` never throws (by design, matching the brief) — callers relying on a
  rejected promise to detect failure must use the `onError` callback instead.
