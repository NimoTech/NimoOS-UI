/**
 * Power phase machine. Maps to Vue2 SettingsPanel.vue's
 * onShutdownConfirmed(L1779) / onRestartConfirmed(L1816) / startAppUpdate(L1501) /
 * _onShutdownOffline(L1812) / _onRestartFallback(L1862) / resetPower(L1873).
 *
 * Extracted into a Vue-independent controller so fake timers can actually test timing sequences like
 * "offline → back online" — over on the Vue2 side everything is mixed into component methods, none
 * of it is testable, and if this logic ever gets it wrong the user is stuck staring at "restarting"
 * forever, or is told "shut down" before the machine has even powered off.
 */
export type PowerPhase =
  | 'idle' | 'shutting' | 'offline'
  | 'restarting' | 'reconnecting' | 'done' | 'fallback' | 'appUpdating'

export const PING_INTERVAL_MS = 3000
export const SHUTDOWN_FALLBACK_MS = 60_000
export const RESTART_FALLBACK_MS = 180_000
export const RESTART_PING_DELAY_MS = 5_000
export const DONE_RELOAD_DELAY_MS = 1_500
/** Shutdown: only declared offline after 2 consecutive probe failures (a single failure could just be a network blip) */
export const SHUTDOWN_FAIL_THRESHOLD = 2

/**
 * Porting discipline #6: Vue2 probes with $api.users.getUserStatus(), which goes through axios with
 * its auth interceptor — a single 401 during a restart triggers onAuthFail, clears the token, and
 * navigates to the login page, breaking the power flow.
 * Here we use a bare fetch, and **any HTTP response (including 401/500) counts as "the server is
 * alive"** — getting back any HTTP status code means it's up, and that's the actual question the
 * probe needs answered.
 */
export async function probeAlive(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    await fetchImpl('/v1/users/status', { cache: 'no-store' })
    return true
  } catch {
    return false
  }
}

export interface PowerFlowDeps {
  probe: () => Promise<boolean>
  reload: () => void
  onPhase: (p: PowerPhase) => void
}

export interface PowerFlowController {
  startShutdown(): void
  startRestart(): void
  startAppUpdating(): void
  reset(): void
}

export function createPowerFlow(deps: PowerFlowDeps): PowerFlowController {
  let ping: ReturnType<typeof setInterval> | null = null
  let fallback: ReturnType<typeof setTimeout> | null = null
  let delay: ReturnType<typeof setTimeout> | null = null
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  let fails = 0
  let sawOffline = false
  let settled = false   // no longer accepts phase changes after done / offline / fallback
  // Review fix round 1 — at most one probe in flight at a time, to prevent out-of-order settling
  // from treating non-consecutive probe results as consecutive failures/consecutive offline-online
  // transitions. Only cleared for the current round (gen matches); see the finally block comment below.
  let inFlight = false
  // Review fix round 1 (Critical) — epoch counter. probe() is awaited, and a single probe can hang
  // for tens of seconds before resolving (e.g. on a machine that's restarting, where fetch just
  // dangles). Relying on `settled` alone to judge "has this round already ended" isn't enough:
  // reset() sets settled back to false, so a probe result issued **before** reset() but only
  // resolving **after** reset() would get treated as a genuine result from the "new round" — at
  // best it re-advances a phase machine that's already idle, at worst it strands the user in a
  // phase with no close button and no timer still running (e.g. fallback→closed→reconnecting stuck
  // forever).
  // gen answers a different question: "was this probe result produced by the current round?"
  // gen increments on every reset()/start*; the probe callback records g = gen before the await,
  // and after the await, if g !== gen that means this round has already moved on, so the result is
  // simply discarded.
  let gen = 0

  function clearAll() {
    if (ping) clearInterval(ping)
    if (fallback) clearTimeout(fallback)
    if (delay) clearTimeout(delay)
    if (reloadTimer) clearTimeout(reloadTimer)
    ping = fallback = delay = reloadTimer = null
  }

  function settle(p: PowerPhase) {
    if (settled) return
    settled = true
    clearAll()
    deps.onPhase(p)
  }

  function reset() {
    gen++
    clearAll()
    fails = 0
    sawOffline = false
    settled = false
    inFlight = false
    deps.onPhase('idle')
  }

  function startShutdown() {
    gen++
    clearAll()
    fails = 0; sawOffline = false; settled = false; inFlight = false
    deps.onPhase('shutting')
    fallback = setTimeout(() => settle('offline'), SHUTDOWN_FALLBACK_MS)
    ping = setInterval(async () => {
      if (inFlight) return   // the previous probe hasn't come back yet, don't stack another one on top
      inFlight = true
      const g = gen
      try {
        const alive = await deps.probe()
        if (g !== gen || settled) return
        if (alive) { fails = 0; return }
        fails++
        if (fails >= SHUTDOWN_FAIL_THRESHOLD) settle('offline')
      } finally {
        // Only clear the in-flight flag for its own round — if this probe belongs to a previous
        // round (g no longer matches the current gen), the current round has already reset inFlight
        // long ago, and this must not clear it again, or it would wrongly mark "a probe currently in
        // flight for the current round" as idle.
        if (g === gen) inFlight = false
      }
    }, PING_INTERVAL_MS)
  }

  /** Restart and app update share this "wait for offline → wait for back online → done → reload" section. */
  function waitForComeback(assumeOffline: boolean) {
    sawOffline = assumeOffline
    fallback = setTimeout(() => settle('fallback'), RESTART_FALLBACK_MS)
    // Vue2 waits 5 seconds before starting to probe: it takes time between the restart command
    // being issued and the service actually starting to stop, so probing too early and finding
    // it "still alive" is meaningless.
    delay = setTimeout(() => {
      ping = setInterval(async () => {
        if (inFlight) return
        inFlight = true
        const g = gen
        try {
          const alive = await deps.probe()
          if (g !== gen || settled) return
          if (!alive) {
            if (!sawOffline) { sawOffline = true; deps.onPhase('reconnecting') }
            return
          }
          // Alive: only having seen it go offline first confirms the restart has really completed
          if (!sawOffline) return
          settle('done')
          reloadTimer = setTimeout(() => deps.reload(), DONE_RELOAD_DELAY_MS)
        } finally {
          if (g === gen) inFlight = false
        }
      }, PING_INTERVAL_MS)
    }, RESTART_PING_DELAY_MS)
  }

  function startRestart() {
    gen++
    clearAll()
    fails = 0; settled = false; inFlight = false
    deps.onPhase('restarting')
    waitForComeback(false)
  }

  function startAppUpdating() {
    gen++
    clearAll()
    fails = 0; settled = false; inFlight = false
    deps.onPhase('appUpdating')
    // Vue2's startAppUpdate sets restartServerOffline to true directly after 5 seconds — an app
    // update always restarts the service, so there's no need to first observe it going offline.
    waitForComeback(true)
  }

  return { startShutdown, startRestart, startAppUpdating, reset }
}
