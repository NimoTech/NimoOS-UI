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
