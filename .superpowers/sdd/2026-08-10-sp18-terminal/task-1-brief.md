### Task 1: `_noAuthRetry` opt-out in the shared 401 interceptor

**Files:**
- Modify: `packages/service/src/http.ts` (response interceptor, around line 72)
- Test: `packages/service/src/http.test.ts` (append to `describe('createHttp')`)

**Interfaces:**
- Consumes: nothing new.
- Produces: request-config flag `_noAuthRetry?: boolean` — when set, a 401 response is surfaced to the caller as-is (no token refresh, no replay). Task 2's `terminal.ts` sets it on password-carrying calls.

**Why:** the interceptor refresh-replays any 401. A wrong password on `POST /terminal/session` or `PUT /terminal/settings` would be replayed verbatim, burning two of the backend's 5-per-15-min freeze attempts per typo (spec §4-6).

- [ ] **Step 1: Write the failing test**

Append inside `describe('createHttp', …)` in `packages/service/src/http.test.ts`, mirroring the existing `makeConfig`/`makeAdapter` helpers already in that file:

```ts
  it('does not refresh-replay a 401 when the request opts out via _noAuthRetry', async () => {
    const cfg = makeConfig()
    let attempts = 0
    let refreshCalls = 0
    const adapter = makeAdapter((c) => {
      if (c.url === '/v1/users/refresh') { refreshCalls++; return { status: 200, data: { success: 200, data: { access_token: 'NEW', refresh_token: 'NEWR', expires_at: '999' } } } }
      attempts++
      return { status: 401, data: { password_required: true } }
    })
    const http = createHttp(cfg, adapter)
    await expect(http.post('/terminal/session', { password: 'x' }, { _noAuthRetry: true } as never)).rejects.toBeTruthy()
    expect(attempts).toBe(1) // never replayed
    expect(refreshCalls).toBe(0) // never refreshed
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/service/src/http.test.ts`
Expected: the new test FAILS (`attempts` is 2 and `refreshCalls` is 1 — interceptor replayed).

- [ ] **Step 3: Implement the opt-out**

In `packages/service/src/http.ts`, extend the response-interceptor guard. Current code:

```ts
      const original = error.config as (typeof error.config & { _retried?: boolean }) | undefined
      const status = error.response?.status
      if (status === 401 && original && !original._retried && original.url !== '/v1/users/refresh') {
```

Change to:

```ts
      // _noAuthRetry: per-request opt-out of the refresh-and-replay below. Password-
      // carrying terminal requests set it — replaying a wrong password would burn two
      // of the backend's 5-per-15min lockout attempts per typo (SP18, spec §4-6).
      const original = error.config as (typeof error.config & { _retried?: boolean; _noAuthRetry?: boolean }) | undefined
      const status = error.response?.status
      if (status === 401 && original && !original._retried && !original._noAuthRetry && original.url !== '/v1/users/refresh') {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/service/src/http.test.ts`
Expected: ALL tests in the file PASS (the pre-existing refresh-replay tests must stay green).

- [ ] **Step 5: Commit**

```bash
git add packages/service/src/http.ts packages/service/src/http.test.ts
git commit -m "feat(service): add _noAuthRetry opt-out to the 401 refresh-replay interceptor"
```

---

