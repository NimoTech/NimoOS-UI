### Task 4: `useTerminalSession` composable

**Files:**
- Create: `src/terminal/terminalHttp.ts` (tiny error-reading helpers shared by Tasks 4/5/9)
- Create: `src/terminal/useTerminalSession.ts`
- Test: `src/terminal/useTerminalSession.test.ts`

**Interfaces:**
- Consumes: `service.terminal.createSession/keepalive/deleteSession` (Task 2).
- Produces (consumed by Task 7's `TerminalView.vue`):

```ts
export type TerminalState = 'loading' | 'forbidden' | 'error' | 'locked' | 'ready'
export function useTerminalSession(): {
  state: Ref<TerminalState>; mode: Ref<TerminalMode>; idleMinutes: Ref<number>
  frameSrc: Ref<string>; pwError: Ref<boolean>; frozenSeconds: Ref<number>; warning: Ref<boolean>
  provision(): Promise<void>; submitPassword(pw: string): Promise<void>
  notifyActivity(): void; lock(): void; maybeDeleteSession(): void; dispose(): void
}
// terminalHttp.ts:
export function statusOf(e: unknown): number | undefined
export interface TerminalErrorBody { password_required?: boolean; mode?: TerminalMode; idle_minutes?: number; retry_after_seconds?: number }
export function errorBody(e: unknown): TerminalErrorBody | undefined
```

- [ ] **Step 1: Write `terminalHttp.ts`** (no own test file — pinned through the composable tests)

```ts
import type { TerminalMode } from '@nimotech/nimoos-service'

/** HTTP status of an axios-shaped error; undefined for network/timeout errors. */
export function statusOf(e: unknown): number | undefined {
  return (e as { response?: { status?: number } } | undefined)?.response?.status
}

/** Bare-JSON error body of the terminal service (no Result envelope). */
export interface TerminalErrorBody {
  password_required?: boolean
  mode?: TerminalMode
  idle_minutes?: number
  retry_after_seconds?: number
}

export function errorBody(e: unknown): TerminalErrorBody | undefined {
  return (e as { response?: { data?: TerminalErrorBody } } | undefined)?.response?.data
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/terminal/useTerminalSession.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const createSession = vi.fn()
const keepalive = vi.fn()
const deleteSession = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    terminal: {
      createSession: (pw?: string) => createSession(pw),
      keepalive: () => keepalive(),
      deleteSession: () => deleteSession(),
    },
  },
}))

import { useTerminalSession } from './useTerminalSession'

// Axios-shaped rejection; call with no args for a network-style error.
function httpErr(status?: number, data?: unknown) {
  const e = new Error('http') as Error & { response?: { status: number; data: unknown } }
  if (status !== undefined) e.response = { status, data }
  return e
}

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.useFakeTimers()
  createSession.mockReset()
  keepalive.mockReset().mockResolvedValue(undefined)
  deleteSession.mockReset().mockResolvedValue(undefined)
})
afterEach(() => { vi.useRealTimers() })

describe('useTerminalSession — provisioning', () => {
  it('goes ready and exposes the iframe src on a passwordless success', async () => {
    createSession.mockResolvedValue({ mode: 'off', idle_minutes: 15 })
    const s = useTerminalSession()
    await s.provision()
    expect(s.state.value).toBe('ready')
    expect(s.frameSrc.value).toBe('/v1/terminal/')
    expect(s.mode.value).toBe('off')
  })

  it('locks with the announced policy on 401 password_required', async () => {
    createSession.mockRejectedValue(httpErr(401, { password_required: true, mode: 'idle', idle_minutes: 30 }))
    const s = useTerminalSession()
    await s.provision()
    expect(s.state.value).toBe('locked')
    expect(s.mode.value).toBe('idle')
    expect(s.idleMinutes.value).toBe(30)
  })

  it('maps 403 to forbidden and network/5xx to error', async () => {
    const s = useTerminalSession()
    createSession.mockRejectedValue(httpErr(403))
    await s.provision()
    expect(s.state.value).toBe('forbidden')
    createSession.mockRejectedValue(httpErr())
    await s.provision()
    expect(s.state.value).toBe('error')
  })
})

describe('useTerminalSession — password step-up', () => {
  async function lockedSession() {
    createSession.mockRejectedValueOnce(httpErr(401, { password_required: true, mode: 'on_open', idle_minutes: 15 }))
    const s = useTerminalSession()
    await s.provision()
    return s
  }

  it('flags a wrong password inline and stays locked', async () => {
    const s = await lockedSession()
    createSession.mockRejectedValue(httpErr(401, {}))
    await s.submitPassword('nope')
    expect(s.state.value).toBe('locked')
    expect(s.pwError.value).toBe(true)
  })

  it('starts the freeze countdown on 429 and ignores submits while frozen', async () => {
    const s = await lockedSession()
    createSession.mockRejectedValue(httpErr(429, { retry_after_seconds: 3 }))
    await s.submitPassword('x')
    expect(s.frozenSeconds.value).toBe(3)
    createSession.mockClear()
    await s.submitPassword('x') // frozen — must not even call the backend
    expect(createSession).not.toHaveBeenCalled()
    vi.advanceTimersByTime(3000)
    expect(s.frozenSeconds.value).toBe(0)
  })

  it('treats 5xx during step-up as service error, not a wrong password', async () => {
    const s = await lockedSession()
    createSession.mockRejectedValue(httpErr(500, {}))
    await s.submitPassword('x')
    expect(s.state.value).toBe('error')
    expect(s.pwError.value).toBe(false)
  })

  it('unlocks on success', async () => {
    const s = await lockedSession()
    createSession.mockResolvedValue({ mode: 'on_open', idle_minutes: 15 })
    await s.submitPassword('right')
    expect(s.state.value).toBe('ready')
    expect(s.frameSrc.value).toBe('/v1/terminal/')
  })
})

describe('useTerminalSession — keepalive', () => {
  it('renews every 30s in on_open mode and re-locks on 401', async () => {
    createSession.mockResolvedValue({ mode: 'on_open', idle_minutes: 15 })
    const s = useTerminalSession()
    await s.provision()
    await vi.advanceTimersByTimeAsync(30000)
    expect(keepalive).toHaveBeenCalledTimes(1)
    keepalive.mockRejectedValue(httpErr(401))
    await vi.advanceTimersByTimeAsync(30000)
    expect(s.state.value).toBe('locked')
    expect(s.frameSrc.value).toBe('')
  })

  it('in idle mode only renews after activity', async () => {
    createSession.mockResolvedValue({ mode: 'idle', idle_minutes: 15 })
    const s = useTerminalSession()
    await s.provision()
    await vi.advanceTimersByTimeAsync(60000)
    expect(keepalive).not.toHaveBeenCalled() // no activity — no renewal
    s.notifyActivity()
    await vi.advanceTimersByTimeAsync(60000)
    expect(keepalive).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60000)
    expect(keepalive).toHaveBeenCalledTimes(1) // activity flag consumed
  })
})

describe('useTerminalSession — idle lock', () => {
  it('warns 60s ahead, then locks; activity rearms both', async () => {
    createSession.mockResolvedValue({ mode: 'idle', idle_minutes: 2 })
    const s = useTerminalSession()
    await s.provision()
    await vi.advanceTimersByTimeAsync(60000) // 2min idle → warn at 1min
    expect(s.warning.value).toBe(true)
    s.notifyActivity()
    expect(s.warning.value).toBe(false)
    await vi.advanceTimersByTimeAsync(60000) // only 1min since activity — still open
    expect(s.state.value).toBe('ready')
    await vi.advanceTimersByTimeAsync(60000) // 2min since activity → lock
    expect(s.state.value).toBe('locked')
  })
})

describe('useTerminalSession — staleness epoch (spec §4-1)', () => {
  it('a keepalive 401 that resolves after re-unlock must not re-lock the new session', async () => {
    createSession.mockResolvedValue({ mode: 'on_open', idle_minutes: 15 })
    const s = useTerminalSession()
    await s.provision()
    const gate = deferred<void>()
    keepalive.mockReturnValueOnce(gate.promise)
    await vi.advanceTimersByTimeAsync(30000) // keepalive now in flight
    s.lock() // user got locked out meanwhile
    createSession.mockResolvedValue({ mode: 'on_open', idle_minutes: 15 })
    await s.submitPassword('right') // …and unlocked again
    expect(s.state.value).toBe('ready')
    gate.reject(httpErr(401)) // stale keepalive from the OLD session finally fails
    await vi.advanceTimersByTimeAsync(0)
    expect(s.state.value).toBe('ready') // stale 401 must be discarded
  })
})

describe('useTerminalSession — teardown', () => {
  it('dispose deletes the session in on_open mode only, and stops all timers', async () => {
    createSession.mockResolvedValue({ mode: 'on_open', idle_minutes: 15 })
    const s = useTerminalSession()
    await s.provision()
    s.dispose()
    expect(deleteSession).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(120000)
    expect(keepalive).not.toHaveBeenCalled()

    deleteSession.mockClear()
    createSession.mockResolvedValue({ mode: 'idle', idle_minutes: 15 })
    const s2 = useTerminalSession()
    await s2.provision()
    s2.dispose()
    expect(deleteSession).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/terminal/useTerminalSession.test.ts`
Expected: FAIL — `./useTerminalSession` not found.

- [ ] **Step 4: Implement the composable**

Create `src/terminal/useTerminalSession.ts`:

```ts
import { ref } from 'vue'
import { service, type TerminalMode } from '@nimotech/nimoos-service'
import { statusOf, errorBody } from './terminalHttp'

export type TerminalState = 'loading' | 'forbidden' | 'error' | 'locked' | 'ready'

// Five-state session machine ported from Vue2 Terminal.vue (FETCH_HEAD), DOM-free.
// Registered deviation (spec §4-1): every async landing is guarded by an epoch
// counter — Vue2 let stale keepalive/window responses write state across a
// lock/unlock boundary. lock(), provision() and dispose() each open a new epoch.
export function useTerminalSession() {
  const state = ref<TerminalState>('loading')
  const mode = ref<TerminalMode>('off')
  const idleMinutes = ref(15)
  const frameSrc = ref('')
  const pwError = ref(false)
  const frozenSeconds = ref(0)
  const warning = ref(false)

  let epoch = 0
  let kaTimer: ReturnType<typeof setInterval> | undefined
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  let warnTimer: ReturnType<typeof setTimeout> | undefined
  let frozenTimer: ReturnType<typeof setInterval> | undefined
  let activitySince = false

  function applyInfo(d?: { mode?: TerminalMode; idle_minutes?: number }) {
    if (d?.mode) mode.value = d.mode
    if (d?.idle_minutes) idleMinutes.value = Number(d.idle_minutes)
  }

  async function provision() {
    const myEpoch = ++epoch
    teardownTimers()
    state.value = 'loading'
    pwError.value = false
    try {
      const d = await service.terminal.createSession()
      if (myEpoch !== epoch) return
      onUnlocked(d)
    } catch (e) {
      if (myEpoch !== epoch) return
      const st = statusOf(e)
      const body = errorBody(e)
      if (st === 401 && body?.password_required) { applyInfo(body); state.value = 'locked' }
      else if (st === 403) state.value = 'forbidden'
      else state.value = 'error'
    }
  }

  async function submitPassword(pw: string) {
    if (frozenSeconds.value > 0) return
    const myEpoch = epoch
    pwError.value = false
    try {
      const d = await service.terminal.createSession(pw)
      if (myEpoch !== epoch) return
      onUnlocked(d)
    } catch (e) {
      if (myEpoch !== epoch) return
      const st = statusOf(e)
      if (st === 429) startFrozen(errorBody(e)?.retry_after_seconds ?? 60)
      else if (st === 403) state.value = 'forbidden'
      // Network/timeout or 5xx is a service problem, not a wrong password (1:1 Vue2).
      else if (st === undefined || st >= 500) state.value = 'error'
      else pwError.value = true
    }
  }

  function onUnlocked(d?: { mode?: TerminalMode; idle_minutes?: number }) {
    applyInfo(d)
    frameSrc.value = '/v1/terminal/'
    state.value = 'ready'
    startTimers()
  }

  function startTimers() {
    teardownTimers()
    // on_open renews faster; idle renews slower and only after activity (1:1 Vue2).
    const kaMs = mode.value === 'on_open' ? 30000 : 60000
    kaTimer = setInterval(() => { void keepalive() }, kaMs)
    if (mode.value === 'idle') armIdle()
  }

  async function keepalive() {
    if (state.value !== 'ready') return
    if (mode.value === 'idle' && !activitySince) return
    activitySince = false
    const myEpoch = epoch
    try {
      await service.terminal.keepalive()
    } catch (e) {
      if (myEpoch !== epoch) return
      if (statusOf(e) === 401) lock()
    }
  }

  /** Activity signal fed by the view (window + iframe document listeners). */
  function notifyActivity() {
    if (state.value !== 'ready' || mode.value !== 'idle') return
    activitySince = true
    warning.value = false
    armIdle()
  }

  function armIdle() {
    clearTimeout(idleTimer); clearTimeout(warnTimer)
    const ms = idleMinutes.value * 60000
    warnTimer = setTimeout(() => { warning.value = true }, Math.max(ms - 60000, 0))
    idleTimer = setTimeout(() => lock(), ms)
  }

  // Locking only drops the ticket/rendering; tmux keeps running — unlocking
  // restores the session exactly as left (backend Known Boundary ③).
  function lock() {
    epoch++
    teardownTimers()
    frameSrc.value = ''
    warning.value = false
    pwError.value = false
    state.value = 'locked'
  }

  function startFrozen(sec: number) {
    frozenSeconds.value = sec
    if (frozenTimer) clearInterval(frozenTimer)
    frozenTimer = setInterval(() => {
      frozenSeconds.value -= 1
      if (frozenSeconds.value <= 0 && frozenTimer) { clearInterval(frozenTimer); frozenTimer = undefined }
    }, 1000)
  }

  /** on_open sessions are single-use: leaving the page returns the ticket (1:1 Vue2). */
  function maybeDeleteSession() {
    if (mode.value === 'on_open') void service.terminal.deleteSession().catch(() => { /* best effort */ })
  }

  function dispose() {
    epoch++
    teardownTimers()
    maybeDeleteSession()
  }

  function teardownTimers() {
    if (kaTimer) { clearInterval(kaTimer); kaTimer = undefined }
    if (frozenTimer) { clearInterval(frozenTimer); frozenTimer = undefined }
    clearTimeout(idleTimer); idleTimer = undefined
    clearTimeout(warnTimer); warnTimer = undefined
    activitySince = false
  }

  return { state, mode, idleMinutes, frameSrc, pwError, frozenSeconds, warning, provision, submitPassword, notifyActivity, lock, maybeDeleteSession, dispose }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/terminal/useTerminalSession.test.ts`
Expected: PASS (12 tests). Note: `startFrozen` keeps counting while `teardownTimers` isn't called between lock and countdown — the frozen countdown lives in the locked state and is cleared on the next successful provision/unlock via `startTimers → teardownTimers`. If the "ignores submits while frozen" test flakes on that, check that `submitPassword` early-returns BEFORE touching epoch.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/terminalHttp.ts src/terminal/useTerminalSession.ts src/terminal/useTerminalSession.test.ts
git commit -m "feat(terminal): session state machine composable with staleness epoch"
```

---

