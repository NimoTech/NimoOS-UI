import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createPowerFlow, probeAlive,
  PING_INTERVAL_MS, SHUTDOWN_FALLBACK_MS, RESTART_FALLBACK_MS,
  RESTART_PING_DELAY_MS, DONE_RELOAD_DELAY_MS,
  type PowerPhase,
} from './powerFlow'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

function harness(probeSeq: boolean[]) {
  const phases: PowerPhase[] = []
  const reload = vi.fn()
  let i = 0
  const probe = vi.fn(async () => probeSeq[Math.min(i++, probeSeq.length - 1)])
  const c = createPowerFlow({ probe, reload, onPhase: (p) => phases.push(p) })
  return { c, phases, reload, probe }
}

// Review fix round 1 (Critical + Important 1): the probe in harness() resolves within the
// same microtask, so it can't test interleavings like "the probe is still in flight while
// this round has already moved on". Use a manually-resolved deferred promise here so the
// probe genuinely stays pending across phase transitions -- only then can the gen/settled
// guards be tested separately.
function deferredHarness() {
  const phases: PowerPhase[] = []
  const reload = vi.fn()
  const pending: Array<(v: boolean) => void> = []
  const probe = vi.fn(() => new Promise<boolean>((resolve) => { pending.push(resolve) }))
  const c = createPowerFlow({ probe, reload, onPhase: (p) => phases.push(p) })
  // Resolve the i-th (0-indexed) probe call, and run through the synchronous continuation
  // after `await deps.probe()` -- that continuation itself doesn't await anything else, so
  // one microtask flush is enough; keep an extra one for safety.
  async function resolveProbe(i: number, value: boolean) {
    pending[i](value)
    await Promise.resolve()
    await Promise.resolve()
  }
  return { c, phases, reload, probe, resolveProbe }
}

describe('probeAlive (port discipline #6)', () => {
  it('200 -> alive', async () => {
    expect(await probeAlive(vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch)).toBe(true)
  })
  it('401 counts as alive too -- the server responding 401 means it is up', async () => {
    expect(await probeAlive(vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch)).toBe(true)
  })
  it('500 also counts as alive', async () => {
    expect(await probeAlive(vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch)).toBe(true)
  })
  it('network error -> offline', async () => {
    expect(await probeAlive(vi.fn(async () => { throw new TypeError('Failed to fetch') }) as unknown as typeof fetch)).toBe(false)
  })
})

describe('shutdown flow (mirrors Vue2 onShutdownConfirmed L1779-1811)', () => {
  it('immediately enters shutting', () => {
    const { c, phases } = harness([true])
    c.startShutdown()
    expect(phases).toEqual(['shutting'])
  })

  it('only declares offline after 2 consecutive probe failures (a single failure might just be a blip)', async () => {
    const { c, phases } = harness([false])
    c.startShutdown()
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS)
    expect(phases).toEqual(['shutting'])
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS)
    expect(phases).toEqual(['shutting', 'offline'])
  })

  it('a successful probe in between resets the failure count', async () => {
    const { c, phases } = harness([false, true, false])
    c.startShutdown()
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS * 3)
    expect(phases).toEqual(['shutting'])   // fail-success-fail -> never two in a row
  })

  it('the 60-second fallback also enters offline (the extreme case of the machine never responding to probes)', async () => {
    const { c, phases } = harness([true])
    c.startShutdown()
    await vi.advanceTimersByTimeAsync(SHUTDOWN_FALLBACK_MS)
    expect(phases).toEqual(['shutting', 'offline'])
  })

  it('stops probing once offline is declared (does not keep hitting an already-shut-down machine)', async () => {
    const { c, probe } = harness([false])
    c.startShutdown()
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS * 2)
    const n = probe.mock.calls.length
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS * 5)
    expect(probe.mock.calls.length).toBe(n)
  })
})

describe('restart flow (mirrors Vue2 onRestartConfirmed L1816-1861)', () => {
  it('immediately enters restarting', () => {
    const { c, phases } = harness([true])
    c.startRestart()
    expect(phases).toEqual(['restarting'])
  })

  it('does not probe for the first 5 seconds (giving the restart command time to take effect)', async () => {
    const { c, probe } = harness([true])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS - 1)
    expect(probe).not.toHaveBeenCalled()
  })

  it('enters reconnecting after a single probe failure (unlike shutdown, offline is a mandatory intermediate state for restart)', async () => {
    const { c, phases } = harness([false])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS)
    expect(phases).toEqual(['restarting', 'reconnecting'])
  })

  it('restart is only complete after going offline then back online (otherwise the command has simply not taken effect yet)', async () => {
    const { c, phases, reload } = harness([true, true, true])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS * 3)
    expect(phases).toEqual(['restarting'])   // stayed online the whole time -> not considered complete
    expect(reload).not.toHaveBeenCalled()
  })

  it('offline then online -> done, and reloads 1.5 seconds later', async () => {
    const { c, phases, reload } = harness([false, true])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS * 2)
    expect(phases).toEqual(['restarting', 'reconnecting', 'done'])
    expect(reload).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(DONE_RELOAD_DELAY_MS)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('still not back after 180 seconds -> fallback', async () => {
    const { c, phases } = harness([false])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_FALLBACK_MS)
    expect(phases[phases.length - 1]).toBe('fallback')
  })

  it('stops probing and the fallback timer after fallback', async () => {
    const { c, probe, reload } = harness([false])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_FALLBACK_MS)
    const n = probe.mock.calls.length
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS * 10)
    expect(probe.mock.calls.length).toBe(n)
    expect(reload).not.toHaveBeenCalled()
  })

  it('no further phase changes after done (does not slide back into reconnecting)', async () => {
    const { c, phases } = harness([false, true, false, false])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS * 6)
    expect(phases).toEqual(['restarting', 'reconnecting', 'done'])
  })
})

describe('app update flow (mirrors Vue2 startAppUpdate L1501-1534)', () => {
  it('enters appUpdating, and after 5 seconds treats it as offline and starts waiting for it to come back', async () => {
    const { c, phases } = harness([true])
    c.startAppUpdating()
    expect(phases).toEqual(['appUpdating'])
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS)
    expect(phases).toEqual(['appUpdating', 'done'])
  })
})

describe('reset', () => {
  it('clears all timers and returns to idle', async () => {
    const { c, phases, probe, reload } = harness([false])
    c.startRestart()
    c.reset()
    expect(phases[phases.length - 1]).toBe('idle')
    const n = probe.mock.calls.length
    await vi.advanceTimersByTimeAsync(RESTART_FALLBACK_MS * 2)
    expect(probe.mock.calls.length).toBe(n)
    expect(reload).not.toHaveBeenCalled()
  })

  it('can start a new round after reset', async () => {
    const { c, phases } = harness([false])
    c.startShutdown(); c.reset(); c.startShutdown()
    expect(phases).toEqual(['shutting', 'idle', 'shutting'])
  })
})

// Review fix round 1: the probe is awaited, and in real scenarios a single probe can hang
// for tens of seconds (a machine mid-restart just leaves the fetch dangling). All the cases
// above resolve within the same microtask, so they never actually test interleavings like
// "the probe hasn't come back yet, and this round has already ended/moved on" -- the review
// pointed out that removing the two `if (settled) return` guards in the callbacks still left
// the whole suite green, precisely because of this blind spot.
describe('review fix round 1: staleness guard for dangling probes (gen + settled double gate)', () => {
  it('1) once the phase is settled, a late-arriving probe result must not advance the phase again (settled gate)', async () => {
    const { c, phases, resolveProbe } = deferredHarness()
    c.startRestart()
    // advance to the moment the restart flow makes its first real probe call, and leave it dangling without resolving
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS)
    expect(phases).toEqual(['restarting'])
    // the 180-second fallback fires, the probe still hasn't come back -> fallback
    await vi.advanceTimersByTimeAsync(
      RESTART_FALLBACK_MS - (RESTART_PING_DELAY_MS + PING_INTERVAL_MS),
    )
    expect(phases).toEqual(['restarting', 'fallback'])
    // the late probe finally comes back (offline) -- must not push the phase to reconnecting again
    await resolveProbe(0, false)
    expect(phases).toEqual(['restarting', 'fallback'])
  })

  it('2) after reset(), a late-arriving probe result must not drag idle back to reconnecting (Critical regression, gen gate)', async () => {
    const { c, phases, resolveProbe } = deferredHarness()
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(
      RESTART_FALLBACK_MS - (RESTART_PING_DELAY_MS + PING_INTERVAL_MS),
    )
    expect(phases).toEqual(['restarting', 'fallback'])
    // mirrors step 3 in the Critical description: user clicks close -> reset()
    c.reset()
    expect(phases).toEqual(['restarting', 'fallback', 'idle'])
    // mirrors step 4: the dangling probe finally rejects/resolves(false)
    await resolveProbe(0, false)
    expect(phases).toEqual(['restarting', 'fallback', 'idle'])   // no extra reconnecting
  })

  it('3) a dangling probe from the previous round must not contaminate sawOffline in the next round (core invariant, gen gate)', async () => {
    const { c, phases, reload, probe, resolveProbe } = deferredHarness()
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS)
    expect(probe).toHaveBeenCalledTimes(1)   // the first round's probe has already been sent and is dangling unresolved
    expect(phases).toEqual(['restarting'])

    // user cancels midway, then immediately starts a new restart round (same flow instance, corresponds to "closed then clicked again")
    c.reset()
    c.startRestart()
    expect(phases).toEqual(['restarting', 'idle', 'restarting'])

    // the previous round's dangling probe finally comes back now, reporting "offline" -- it
    // must be discarded as a stale result, and must not prematurely set sawOffline true for
    // the new round
    await resolveProbe(0, false)
    expect(phases).toEqual(['restarting', 'idle', 'restarting'])   // no extra reconnecting

    // the new round's own first real probe call, reporting "alive"
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS)
    expect(probe).toHaveBeenCalledTimes(2)
    await resolveProbe(1, true)
    // the new round has never actually seen offline, so a single "alive" must not jump
    // straight to done -- this is precisely the core reason this task exists (restart is
    // only complete after going offline then back online)
    expect(phases).toEqual(['restarting', 'idle', 'restarting'])
    expect(reload).not.toHaveBeenCalled()
  })

  it('4) unmounting (reset) does not create a new reload timer, and even if stale probes assemble a "fake offline -> fake online" it will not actually reload (gen gate)', async () => {
    // The same kind of interleaving as case 3 (previous round's dangling probe + new round's
    // real probe), but carried through to the end -- what's asserted is not the phase, but the
    // real side effect: whether reload() was called. This is what requirement 8 ("no leftover
    // timers after unmount") ultimately protects: even if the phase logic gets something else
    // wrong, the user's page must never actually be reloaded.
    const { c, phases, reload, probe, resolveProbe } = deferredHarness()
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS)
    expect(probe).toHaveBeenCalledTimes(1)   // the first round's probe has already been sent and is dangling unresolved

    // mirrors the "unmount" scenario in Critical: onBeforeUnmount calls flow.reset()
    c.reset()
    // if it's remounted after unmount and restart is clicked again (the same flow instance can be reused)
    c.startRestart()
    expect(phases).toEqual(['restarting', 'idle', 'restarting'])

    // the previous round's dangling probe finally comes back now, reporting "offline" -- a stale result that must be discarded
    await resolveProbe(0, false)
    // the new round's own first real probe call, reporting "alive"
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS)
    expect(probe).toHaveBeenCalledTimes(2)
    await resolveProbe(1, true)

    // even after waiting far longer than the reload delay, the new round has never actually
    // seen offline, and must never actually reload
    await vi.advanceTimersByTimeAsync(DONE_RELOAD_DELAY_MS * 10)
    expect(phases).not.toContain('done')
    expect(reload).not.toHaveBeenCalled()
  })
})
