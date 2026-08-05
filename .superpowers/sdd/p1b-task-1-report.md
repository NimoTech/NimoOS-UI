# P1b Task 1 Report — Shared pkg: SseOutcome.errorBody + resend-still-401 test

## What was implemented

Followed the brief (`p1b-task-1-brief.md`) verbatim, TDD order (Steps 1-7):

1. Appended two tests to `src/sse.test.ts` (inside `describe('sseRequest', …)`), exactly as specified in the brief:
   - `'重发仍 401 → 刷新成功但重连仍 401,只重发一次不循环,surfaces as {ok:false,status:401}'` — regression lock for debt ①.
   - `'非2xx 带 JSON body → errorBody 携带解析后的 body'` — the genuine RED test for debt ②.
2. Confirmed RED: only the errorBody test failed (`out.errorBody` was `undefined`); the resend-still-401 test passed immediately (current fall-through-to-`{ok:false,status:401}` behavior was already correct).
3. Added `errorBody?: unknown` to `SseOutcome` in `src/sse.ts`.
4. Replaced the single-line `!resp.ok || !resp.body` early return with a body-read block that tries `resp.json()` then falls back to `resp.text()`, populating `errorBody` (mirrors Vue2 `agentStream.js:595-600`), exactly per the brief's Step 5 snippet.
5. Reran `pnpm test -- sse` → all 10 sse cases green. Reran full `pnpm test` → 192/192 passed (no regressions elsewhere).
6. `pnpm build` (`tsc -p tsconfig.json`) → clean, no output/errors.
7. Committed both files with the exact message from the brief.

No deviations from the brief were needed — `sse.ts` matched what the brief assumed line-for-line (interface at lines 13-18, branch at line 56).

## TDD evidence

### RED (before Steps 4-5)

Command: `cd /home/nimo/NimoTech/.sp8/NimoOS-Service && pnpm test -- sse`

```
 RUN  v4.1.10 /home/nimo/NimoTech/.sp8/NimoOS-Service

 ❯ src/sse.test.ts (10 tests | 1 failed) 15ms
     × 非2xx 带 JSON body → errorBody 携带解析后的 body 5ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/sse.test.ts > sseRequest > 非2xx 带 JSON body → errorBody 携带解析后的 body
AssertionError: expected undefined to match object { message: 'boom', code: 20001 }

- Expected:
{
  "code": 20001,
  "message": "boom",
}

+ Received:
undefined

 ❯ src/sse.test.ts:152:27
    150|     expect(out.ok).toBe(false)
    151|     expect(out.status).toBe(500)
    152|     expect(out.errorBody).toMatchObject({ message: 'boom', code: 20001…
       |                           ^
    153|   })
    154| })

 Test Files  1 failed (1)
      Tests  1 failed | 9 passed (10)
```

This confirms exactly the brief's prediction: the resend-still-401 test passed by accident (already-correct behavior), and the errorBody test was the genuine RED.

### GREEN (after Steps 4-5)

Command: `cd /home/nimo/NimoTech/.sp8/NimoOS-Service && pnpm test -- sse`

```
 RUN  v4.1.10 /home/nimo/NimoTech/.sp8/NimoOS-Service

 Test Files  1 passed (1)
      Tests  10 passed (10)
```

Full-suite sanity check, `pnpm test` (no filter): `Test Files 24 passed (24)`, `Tests 192 passed (192)` — no regressions.

Build: `pnpm build` → `tsc -p tsconfig.json` completed with no output (clean).

## Files changed

- `/home/nimo/NimoTech/.sp8/NimoOS-Service/src/sse.ts` — added `errorBody?: unknown` to `SseOutcome`; replaced the `!resp.ok || !resp.body` early return with a body-read block populating `errorBody` via `resp.json()` → `resp.text()` fallback.
- `/home/nimo/NimoTech/.sp8/NimoOS-Service/src/sse.test.ts` — added the two tests above.

Commit: `f9a0096` — "SP8-P1b: SseOutcome.errorBody + resend-still-401 test (P1 debts ①②)" on branch `sp8-ai` (parent `ca34772`).

## Self-review

- Existing test `'非2xx非401/204(如500,带body)→ {ok:false,status:500},不读流'` (sse.test.ts, the mock `Response` there has no `json`/`text` methods) still passes: calling `resp.json()` on that mock throws synchronously inside the `try`, falls to the `catch` which calls `resp.text()` (also absent, throws), caught by the inner `catch` and ignored — `errorBody` stays `undefined`. The assertion `toEqual({ ok: false, status: 500 })` still holds because `toEqual` treats an explicit `undefined` property as equivalent to absent. `getReaderSpy` is still never called — the errorBody branch never touches `resp.body`.
- The second-401 fall-through path now also carries `errorBody` (as the brief noted would happen) — the resend-still-401 test uses `toMatchObject` so it's unaffected.
- `Authorization` remains a bare token (no `Bearer` prefix) — untouched by this change, verified by the unchanged POST test.
- No other consumers of `SseOutcome` in this package needed updates (`errorBody` is optional, additive-only).

## Concerns

None. All steps matched the brief exactly; no ambiguity encountered. One pre-existing untracked file (`package-lock.json`) was present in the working tree before this task started and was deliberately left out of the commit (not part of this task's scope, and pnpm is the repo's package manager).
