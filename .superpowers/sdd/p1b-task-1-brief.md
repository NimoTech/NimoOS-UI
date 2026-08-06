### Task 1: Shared pkg — `SseOutcome.errorBody` + "resend still 401" test (debts ①②)

**Files:**
- Modify: `../NimoOS-Service/src/sse.ts:13-18` (interface) and `sse.ts:56` (`!resp.ok` branch)
- Modify: `../NimoOS-Service/src/sse.test.ts` (add one case)

**Interfaces:**
- Produces: `SseOutcome.errorBody?: unknown` — the parsed JSON (or raw text fallback) of a non-2xx response body. Consumed by Task 6 transport `onError`.

- [ ] **Step 1: Write the failing test — "resend still 401"** (append inside `describe('sseRequest', …)`, model on the existing case at `sse.test.ts:45-55`):

```ts
it('重发仍 401 → 刷新成功但重连仍 401,只重发一次不循环,surfaces as {ok:false,status:401}', async () => {
  const auths: (string | null)[] = []
  refreshMock.mockImplementation(async () => { token = 'NEW' })
  let calls = 0
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    calls++
    auths.push((init.headers as Record<string, string>).Authorization ?? null)
    return sseResp([], 401)          // BOTH attempts return 401
  }) as unknown as typeof fetch
  const out = await sseRequest('/x', { onEvent: () => {}, fetchImpl })
  expect(refreshMock).toHaveBeenCalledTimes(1)
  expect(calls).toBe(2)                       // retried exactly once — did NOT loop
  expect(auths).toEqual(['OLD', 'NEW'])
  expect(out).toMatchObject({ ok: false, status: 401 })
})
```

- [ ] **Step 2: Write the failing test — errorBody populated on non-2xx** (append; `sseResp` currently serves body lines only via reader — add a 500-with-JSON-body case):

```ts
it('非2xx 带 JSON body → errorBody 携带解析后的 body', async () => {
  const resp = {
    status: 500, ok: false,
    body: { getReader: () => ({ read: async () => ({ done: true }) }) },
    json: async () => ({ message: 'boom', code: 20001 }),
    text: async () => '{"message":"boom","code":20001}',
  } as unknown as Response
  const fetchImpl = (async () => resp) as unknown as typeof fetch
  const out = await sseRequest('/x', { onEvent: () => {}, fetchImpl })
  expect(out.ok).toBe(false)
  expect(out.status).toBe(500)
  expect(out.errorBody).toMatchObject({ message: 'boom', code: 20001 })
})
```

- [ ] **Step 3: Run both, verify they fail**

Run: `cd /home/nimo/NimoTech/.sp8/NimoOS-Service && pnpm test -- sse`
Expected: the "resend still 401" passes-by-accident on status but the errorBody test FAILS (`out.errorBody` is `undefined`); confirm the errorBody assertion is RED. (The 401 test documents/locks current behavior — confirm it passes.)

- [ ] **Step 4: Add `errorBody` to the interface** (`sse.ts:13-18`):

```ts
export interface SseOutcome {
  ok: boolean
  status: number
  noContent?: boolean
  error?: unknown
  errorBody?: unknown   // parsed JSON (or raw text) of a non-2xx response body
}
```

- [ ] **Step 5: Populate `errorBody` at the `!resp.ok` branch** (`sse.ts:56`). Replace the single-line early return with a body read (mirrors Vue2 `agentStream.js:595-600`):

```ts
if (resp.status === 204) return { ok: true, status: 204, noContent: true }
if (!resp.ok || !resp.body) {
  let errorBody: unknown
  try { errorBody = await resp.json() } catch { try { errorBody = await resp.text() } catch { /* ignore */ } }
  return { ok: false, status: resp.status, errorBody }
}
```

Note: the second-401 path (`sse.ts:52` → falls through to this branch) now also carries `errorBody` — that's fine; the "resend still 401" test only asserts `{ok:false,status:401}` via `toMatchObject`, so it still passes.

- [ ] **Step 6: Run tests, verify green + rebuild package**

Run: `pnpm test -- sse` → Expected: all sse cases PASS (10 total).
Run: `pnpm build` → Expected: tsc clean.

- [ ] **Step 7: Commit**

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-Service
git add src/sse.ts src/sse.test.ts
git commit -m "SP8-P1b: SseOutcome.errorBody + resend-still-401 test (P1 debts ①②)"
```

---

