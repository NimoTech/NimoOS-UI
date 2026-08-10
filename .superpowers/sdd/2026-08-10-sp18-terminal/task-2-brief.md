### Task 2: terminal service client

**Files:**
- Create: `packages/service/src/terminal.ts`
- Modify: `packages/service/src/index.ts` (import + `terminal` getter + type re-exports, next to the `kvm` entries)
- Test: `packages/service/src/terminal.test.ts`

**Interfaces:**
- Consumes: Task 1's `_noAuthRetry` flag.
- Produces (used by Tasks 4, 5, 8, 9):
  - `service.terminal.createSession(password?: string): Promise<TerminalSessionInfo>`
  - `service.terminal.deleteSession(): Promise<void>`
  - `service.terminal.keepalive(): Promise<void>`
  - `service.terminal.getSettings(): Promise<TerminalSettings>`
  - `service.terminal.putSettings(body: { mode: TerminalMode; idle_minutes: number; password: string }): Promise<void>`
  - `service.terminal.listWindows(): Promise<TerminalWindow[]>`
  - `service.terminal.newWindow(): Promise<void>` / `selectWindow(i: number)` / `closeWindow(i: number)` / `renameWindow(i: number, name: string)`
  - Types: `TerminalMode = 'off' | 'on_open' | 'idle'`, `TerminalSessionInfo { mode: TerminalMode; idle_minutes: number }`, `TerminalSettings { mode: TerminalMode; idle_minutes: number }`, `TerminalWindow { index: number; name: string; active: boolean }`

- [ ] **Step 1: Write the failing test**

Create `packages/service/src/terminal.test.ts` (stub style mirrors `kvm.test.ts` in the same directory, extended to capture the per-request config so the `_noAuthRetry` contract is pinned):

```ts
import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createTerminal } from './terminal'

// Recording http stub. The terminal service speaks bare JSON (no Result
// envelope), so the stub returns payloads directly under `data`.
function stub(map: Record<string, unknown> = {}) {
  const calls: { m: string; url: string; body?: unknown; cfg?: unknown }[] = []
  const get = async (url: string, cfg?: unknown) => { calls.push({ m: 'get', url, cfg }); return { data: map[url] } }
  const del = async (url: string, cfg?: unknown) => { calls.push({ m: 'delete', url, cfg }); return { data: map[url] } }
  const post = async (url: string, body?: unknown, cfg?: unknown) => { calls.push({ m: 'post', url, body, cfg }); return { data: map[url] } }
  const put = async (url: string, body?: unknown, cfg?: unknown) => { calls.push({ m: 'put', url, body, cfg }); return { data: map[url] } }
  const http = { get, post, put, delete: del } as unknown as AxiosInstance
  return { http, calls }
}

describe('createTerminal — bare JSON, no envelope unwrap', () => {
  it('createSession without password posts an empty body and allows the default 401 refresh-replay', async () => {
    const { http, calls } = stub({ '/terminal/session': { mode: 'idle', idle_minutes: 15 } })
    const t = createTerminal(http)
    const info = await t.createSession()
    expect(info).toEqual({ mode: 'idle', idle_minutes: 15 })
    expect(calls[0].body).toBeUndefined()
    expect((calls[0].cfg as { _noAuthRetry?: boolean } | undefined)?._noAuthRetry).toBeUndefined()
  })

  it('createSession with password opts out of the 401 refresh-replay', async () => {
    const { http, calls } = stub({ '/terminal/session': { mode: 'on_open', idle_minutes: 15 } })
    await createTerminal(http).createSession('s3cret')
    expect(calls[0].body).toEqual({ password: 's3cret' })
    expect((calls[0].cfg as { _noAuthRetry?: boolean })._noAuthRetry).toBe(true)
  })

  it('putSettings carries the password and opts out of the 401 refresh-replay', async () => {
    const { http, calls } = stub()
    await createTerminal(http).putSettings({ mode: 'idle', idle_minutes: 30, password: 'pw' })
    expect(calls[0]).toMatchObject({ m: 'put', url: '/terminal/settings', body: { mode: 'idle', idle_minutes: 30, password: 'pw' } })
    expect((calls[0].cfg as { _noAuthRetry?: boolean })._noAuthRetry).toBe(true)
  })

  it('getSettings and listWindows return the bare payload untouched', async () => {
    const { http } = stub({
      '/terminal/settings': { mode: 'off', idle_minutes: 15 },
      '/terminal/windows': [{ index: 0, name: 'zsh', active: true }],
    })
    const t = createTerminal(http)
    expect(await t.getSettings()).toEqual({ mode: 'off', idle_minutes: 15 })
    expect(await t.listWindows()).toEqual([{ index: 0, name: 'zsh', active: true }])
  })

  it('window mutations hit the documented routes', async () => {
    const { http, calls } = stub()
    const t = createTerminal(http)
    await t.newWindow(); await t.selectWindow(2); await t.closeWindow(2); await t.renameWindow(1, 'build')
    await t.keepalive(); await t.deleteSession()
    expect(calls.map((c) => [c.m, c.url])).toEqual([
      ['post', '/terminal/windows'],
      ['post', '/terminal/windows/2/select'],
      ['delete', '/terminal/windows/2'],
      ['put', '/terminal/windows/1'],
      ['post', '/terminal/keepalive'],
      ['delete', '/terminal/session'],
    ])
    expect(calls[3].body).toEqual({ name: 'build' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/service/src/terminal.test.ts`
Expected: FAIL — `./terminal` module not found.

- [ ] **Step 3: Implement the client**

Create `packages/service/src/terminal.ts`:

```ts
import type { AxiosInstance, AxiosRequestConfig } from 'axios'

// terminal domain = NimoOS-Terminal (ttyd + tmux + thin Go integration).
//
// ⚠️ Envelope: NONE. This service returns bare JSON on every route (Vue2 reads
//    r.data.mode / e.response.data.password_required directly) — never unwrap().
// ⚠️ Error bodies carry semantics the page needs:
//    POST /session  → 401 {password_required, mode, idle_minutes} = step-up needed;
//                     401 without password_required = wrong password; 403 = not admin;
//                     429 {retry_after_seconds} = frozen (5 failures / 15 min / username).
// The auth ticket is an HttpOnly cookie scoped to /v1/terminal — the page embeds
// ttyd via iframe; the frontend never talks to the WebSocket itself.

export type TerminalMode = 'off' | 'on_open' | 'idle'
export interface TerminalSessionInfo { mode: TerminalMode; idle_minutes: number }
export interface TerminalSettings { mode: TerminalMode; idle_minutes: number }
export interface TerminalWindow { index: number; name: string; active: boolean }

// Password-carrying requests opt out of the shared 401 refresh-replay: the
// backend freezes the account after 5 failed attempts per 15 minutes, and an
// interceptor replay would burn two attempts per typo (SP18 spec §4-6).
const NO_AUTH_RETRY = { _noAuthRetry: true } as AxiosRequestConfig

export function createTerminal(http: AxiosInstance) {
  return {
    async createSession(password?: string): Promise<TerminalSessionInfo> {
      if (password === undefined) return (await http.post('/terminal/session')).data as TerminalSessionInfo
      return (await http.post('/terminal/session', { password }, NO_AUTH_RETRY)).data as TerminalSessionInfo
    },
    /** Clears the ticket cookie only — tmux keeps running, ttyd stays up. */
    async deleteSession(): Promise<void> { await http.delete('/terminal/session') },
    async keepalive(): Promise<void> { await http.post('/terminal/keepalive') },
    async getSettings(): Promise<TerminalSettings> {
      return (await http.get('/terminal/settings')).data as TerminalSettings
    },
    async putSettings(body: { mode: TerminalMode; idle_minutes: number; password: string }): Promise<void> {
      await http.put('/terminal/settings', body, NO_AUTH_RETRY)
    },
    async listWindows(): Promise<TerminalWindow[]> {
      return (await http.get('/terminal/windows')).data as TerminalWindow[]
    },
    async newWindow(): Promise<void> { await http.post('/terminal/windows') },
    async selectWindow(i: number): Promise<void> { await http.post(`/terminal/windows/${i}/select`) },
    /** Closing the last remaining window returns 409 — callers ignore it (1:1 Vue2). */
    async closeWindow(i: number): Promise<void> { await http.delete(`/terminal/windows/${i}`) },
    async renameWindow(i: number, name: string): Promise<void> { await http.put(`/terminal/windows/${i}`, { name }) },
  }
}
```

In `packages/service/src/index.ts`, add next to the existing kvm lines (match the file's own ordering conventions):

```ts
import { createTerminal } from './terminal.js'
// … alongside the other type re-exports:
export type { TerminalMode, TerminalSessionInfo, TerminalSettings, TerminalWindow } from './terminal.js'
// … inside the `service` object, next to `get kvm()`:
  get terminal(): ReturnType<typeof createTerminal> {
    return createTerminal(getHttp() as AxiosInstance)
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/service/src/terminal.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Type-check and commit**

Run: `pnpm exec vue-tsc --noEmit` — expected clean.

```bash
git add packages/service/src/terminal.ts packages/service/src/terminal.test.ts packages/service/src/index.ts
git commit -m "feat(service): add terminal domain client (bare JSON, password calls skip 401 replay)"
```

---

