import { ref } from 'vue'
import { service, refreshAccessToken, type TerminalMode } from '@nimotech/nimoos-service'
import { shouldRefreshToken } from '../util/tokenExpiry'
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
  const submitting = ref(false)
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
    // In-flight guard: Enter + button click emit two submits for one intent.
    // A duplicate POST would burn a second of the backend's 5-per-15min
    // lockout attempts, and two concurrent submits share one epoch — a slow
    // older response could overwrite state after a newer success landed.
    if (frozenSeconds.value > 0 || submitting.value) return
    submitting.value = true
    const myEpoch = epoch
    pwError.value = false
    try {
      // Proactive JWT refresh before the password POST. The locked screen is a
      // seam with no other traffic to keep the token fresh (keepalive/window
      // polling are stopped), and the password-carrying POST deliberately opts
      // out of the shared 401 refresh-replay (_noAuthRetry) — replaying a
      // wrong password would burn two lockout attempts. Without this, sitting
      // on the lock screen past access-token expiry turns a CORRECT password
      // into a plain 401 rendered as "wrong password", forever. Refresh
      // failures are swallowed: the POST then fails and surfaces as today.
      // expires_at is unix seconds — same parsing as useFileOps download,
      // Drop serverConnection and the apps-console TerminalPane.
      const raw = localStorage.getItem('expires_at')
      const expiresAt = raw != null && raw !== '' ? Number(raw) : null
      if (shouldRefreshToken(expiresAt, Date.now())) {
        await refreshAccessToken().catch(() => { /* proceed — failure surfaces via the POST */ })
      }
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
    } finally {
      submitting.value = false
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
    // Reset the freeze countdown whenever timers are torn down (lock/provision/dispose).
    // Without this, a stranded frozenSeconds > 0 (e.g. provision() re-landing in
    // 'locked' while a prior freeze window was still counting down) would make
    // submitPassword's early-return guard block the form forever. The backend
    // still enforces the freeze server-side and re-arms it with a fresh 429, so
    // clearing the UI counter here is safe and self-healing.
    frozenSeconds.value = 0
  }

  return { state, mode, idleMinutes, frameSrc, pwError, submitting, frozenSeconds, warning, provision, submitPassword, notifyActivity, lock, maybeDeleteSession, dispose }
}
