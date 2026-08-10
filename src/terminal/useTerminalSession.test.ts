import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const createSession = vi.fn()
const keepalive = vi.fn()
const deleteSession = vi.fn()
const refreshAccessToken = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    terminal: {
      createSession: (pw?: string) => createSession(pw),
      keepalive: () => keepalive(),
      deleteSession: () => deleteSession(),
    },
  },
  refreshAccessToken: () => refreshAccessToken(),
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
  refreshAccessToken.mockReset().mockResolvedValue('token')
  localStorage.removeItem('expires_at')
})
afterEach(() => { vi.useRealTimers(); localStorage.removeItem('expires_at') })

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

  it('a teardown while still frozen resets the counter so a later retry is not blocked forever (regression)', async () => {
    const s = await lockedSession()
    createSession.mockRejectedValue(httpErr(429, { retry_after_seconds: 5 }))
    await s.submitPassword('x')
    expect(s.frozenSeconds.value).toBe(5)
    // Still frozen — the user retries via a fresh provision() call (e.g. an
    // error-state Retry button), which tears down the frozen timer mid-countdown.
    createSession.mockRejectedValue(httpErr(500, {}))
    await s.provision()
    expect(s.state.value).toBe('error')
    // Retrying again lands back in 'locked'. frozenSeconds must not be stranded
    // above zero by the earlier teardown, or submitPassword would block forever.
    createSession.mockRejectedValue(httpErr(401, { password_required: true, mode: 'on_open', idle_minutes: 15 }))
    await s.provision()
    expect(s.state.value).toBe('locked')
    expect(s.frozenSeconds.value).toBe(0)
    createSession.mockResolvedValue({ mode: 'on_open', idle_minutes: 15 })
    createSession.mockClear()
    await s.submitPassword('right')
    expect(createSession).toHaveBeenCalled()
    expect(s.state.value).toBe('ready')
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

  it('ignores a second submit while the first is still in flight (double-submit guard)', async () => {
    const s = await lockedSession()
    // Fresh token so the pre-POST refresh is skipped — this test pins the
    // in-flight guard alone, not the refresh path.
    localStorage.setItem('expires_at', String(Math.floor(Date.now() / 1000) + 3600))
    const gate = deferred<{ mode: string; idle_minutes: number }>()
    createSession.mockClear()
    createSession.mockReturnValueOnce(gate.promise)
    const first = s.submitPassword('right')
    expect(s.submitting.value).toBe(true)
    // The lock card emits twice for one intent (Enter + click) — the duplicate
    // must not reach the backend: each POST burns a 5-per-15min lockout attempt.
    await s.submitPassword('right')
    expect(createSession).toHaveBeenCalledTimes(1)
    gate.resolve({ mode: 'on_open', idle_minutes: 15 })
    await first
    // State resolved solely from the first submit's response.
    expect(s.state.value).toBe('ready')
    expect(s.submitting.value).toBe(false)
  })
})

describe('useTerminalSession — proactive token refresh before unlock', () => {
  // The locked screen has no other traffic (keepalive/window polling stopped)
  // and the password POST skips the shared 401 refresh-replay, so submitPassword
  // must refresh a stale JWT itself before POSTing.
  async function lockedSession() {
    createSession.mockRejectedValueOnce(httpErr(401, { password_required: true, mode: 'on_open', idle_minutes: 15 }))
    const s = useTerminalSession()
    await s.provision()
    return s
  }

  it('refreshes the token before the password POST when expires_at is expired', async () => {
    const s = await lockedSession()
    localStorage.setItem('expires_at', String(Math.floor(Date.now() / 1000) - 10))
    createSession.mockClear()
    createSession.mockResolvedValue({ mode: 'on_open', idle_minutes: 15 })
    await s.submitPassword('right')
    expect(refreshAccessToken).toHaveBeenCalledTimes(1)
    // The refresh must strictly precede the password POST.
    expect(refreshAccessToken.mock.invocationCallOrder[0]).toBeLessThan(createSession.mock.invocationCallOrder[0])
    expect(s.state.value).toBe('ready')
  })

  it('refreshes conservatively when expires_at is missing (download pre-refresh precedent)', async () => {
    const s = await lockedSession()
    createSession.mockResolvedValue({ mode: 'on_open', idle_minutes: 15 })
    await s.submitPassword('right')
    expect(refreshAccessToken).toHaveBeenCalledTimes(1)
    expect(s.state.value).toBe('ready')
  })

  it('skips the refresh while the token is still fresh', async () => {
    const s = await lockedSession()
    localStorage.setItem('expires_at', String(Math.floor(Date.now() / 1000) + 3600))
    createSession.mockResolvedValue({ mode: 'on_open', idle_minutes: 15 })
    await s.submitPassword('right')
    expect(refreshAccessToken).not.toHaveBeenCalled()
    expect(s.state.value).toBe('ready')
  })

  it('a failed refresh still lets the password submit proceed', async () => {
    const s = await lockedSession()
    localStorage.setItem('expires_at', String(Math.floor(Date.now() / 1000) - 10))
    refreshAccessToken.mockRejectedValue(new Error('refresh endpoint down'))
    createSession.mockResolvedValue({ mode: 'on_open', idle_minutes: 15 })
    await s.submitPassword('right')
    expect(s.state.value).toBe('ready')
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
