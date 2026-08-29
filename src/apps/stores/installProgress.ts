import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useMessageBus } from '../../composables/useMessageBus'
import { useInstalledAppsStore } from './installedApps'
import { useAppstoreStore } from './appstore'
import { resolveAppTitle } from '../util/appTitle'

export interface InstallTask {
  id: string
  title: string
  icon: string
  percent: number
  state: 'installing' | 'error'
  message: string
}

/** After 60s of event silence, actively probe compose.get(id) to converge (spec §5: pending must never hang forever) */
export const WATCHDOG_MS = 60_000
/** 5 consecutive rounds (~5 minutes) without a hit → error state, left to the user to dismiss */
export const WATCHDOG_MAX_PROBES = 5

/** Task table persisted to localStorage: rebuilt after a full page refresh (spec §3.5 "rebuild on return").
 *  Without persistence, refresh loses the registry → subsequent progress events are all dropped by D5
 *  as strangers → progress permanently invisible, and clicking install again only gets the backend's
 *  "already installing" 400 (observed during acceptance). */
export const INSTALL_PROGRESS_STORAGE_KEY = 'nimoos:install-progress'

function loadPersisted(): Record<string, InstallTask> {
  try {
    const raw = JSON.parse(localStorage.getItem(INSTALL_PROGRESS_STORAGE_KEY) || '{}') as Record<string, unknown>
    const out: Record<string, InstallTask> = {}
    for (const [id, v] of Object.entries(raw)) {
      const t = (v && typeof v === 'object' ? v : {}) as Partial<InstallTask>
      if (!id || (t.state !== 'installing' && t.state !== 'error')) continue
      out[id] = {
        id,
        title: typeof t.title === 'string' && t.title ? t.title : id,
        icon: typeof t.icon === 'string' ? t.icon : '',
        percent: typeof t.percent === 'number' ? Math.min(100, Math.max(0, t.percent)) : 0,
        state: t.state,
        message: typeof t.message === 'string' ? t.message : '',
      }
    }
    return out
  } catch {
    return {} // bad JSON/private mode: treat as no tasks
  }
}

function titleFromProps(p: Record<string, unknown>, fallback: string): string {
  // app:title is a JSON string ({"en_us":"…"}, AppManagement common/message.go:24-28)
  if (typeof p['app:title'] === 'string') {
    try { return resolveAppTitle(JSON.parse(p['app:title']), fallback) } catch { /* tolerate bad JSON */ }
  }
  return fallback
}

export const useInstallProgressStore = defineStore('install-progress', () => {
  const tasks = ref<Record<string, InstallTask>>(loadPersisted())
  const timers: Record<string, ReturnType<typeof setTimeout>> = {}
  const probes: Record<string, number> = {}

  // Persist synchronously on every task-table change (all writes to tasks are whole-object
  // replacements, so a shallow watch always fires; sync flush guarantees no write is lost in
  // tests or before real unload/refresh)
  watch(tasks, (v) => {
    try { localStorage.setItem(INSTALL_PROGRESS_STORAGE_KEY, JSON.stringify(v)) } catch { /* ignore quota/private mode */ }
  }, { flush: 'sync' })

  function arm(id: string) {
    clearTimeout(timers[id])
    timers[id] = setTimeout(() => { void probe(id) }, WATCHDOG_MS)
  }

  async function probe(id: string) {
    const cur = tasks.value[id]
    if (!cur || cur.state === 'error') {
      clearTimeout(timers[id]); delete timers[id]; delete probes[id]
      return
    }
    try {
      const app = await service.compose.get(id)
      // Fix2: after the await settles, the task may already be dismissed/finished — re-read and bail
      // if it's gone; do not write probes[id]/arm(id), and do not wrongly trigger finish()'s
      // refresh/installed side effects.
      if (!tasks.value[id]) return
      if (app) { finish(id); return }
    } catch {
      // Fix3: network errors carry no penalty — don't increment probes, probe again next round (task stays installing)
      arm(id)
      return
    }
    probes[id] = (probes[id] ?? 0) + 1
    if (probes[id] >= WATCHDOG_MAX_PROBES) fail(id, '')
    else arm(id)
  }

  /** Initiator-side registration (called after POST /compose is accepted; a card is visible before the begin event arrives) */
  function track(id: string, title?: string, icon?: string) {
    tasks.value = {
      ...tasks.value,
      [id]: { id, title: title || id, icon: icon || '', percent: 0, state: 'installing', message: '' },
    }
    probes[id] = 0
    arm(id)
  }

  /** Successful convergence: remove the task + surface it in the installed list + optimistically update the store's "installed" badge */
  function finish(id: string) {
    clearTimeout(timers[id]); delete timers[id]; delete probes[id]
    const next = { ...tasks.value }; delete next[id]; tasks.value = next
    useInstalledAppsStore().refresh().catch((e) => console.warn('[apps] refresh after install', e))
    const store = useAppstoreStore()
    if (!store.installed.includes(id)) store.installed = [...store.installed, id]
  }

  function fail(id: string, message: string) {
    clearTimeout(timers[id]); delete timers[id]; delete probes[id]
    const cur = tasks.value[id]
    if (!cur) return
    tasks.value = { ...tasks.value, [id]: { ...cur, state: 'error', message } }
  }

  function dismiss(id: string) {
    clearTimeout(timers[id]); delete timers[id]; delete probes[id]
    const next = { ...tasks.value }; delete next[id]; tasks.value = next
  }

  function onEvent(name: string, props: unknown) {
    const p = (props && typeof props === 'object' ? props : {}) as Record<string, unknown>
    const id = typeof p['app:name'] === 'string' ? p['app:name'] : ''
    if (!id) return
    if (name === 'app:install-begin') {
      const cur = tasks.value[id]
      if (!cur) {
        track(id, titleFromProps(p, id), typeof p['app:icon'] === 'string' ? p['app:icon'] : '')
      } else if (cur.state === 'error') {
        // Fix1: begin must be able to revive an error-state task (e.g. user reinstalls/retries before dismissing)
        tasks.value = { ...tasks.value, [id]: { ...cur, state: 'installing', percent: 0, message: '' } }
        probes[id] = 0
        arm(id)
      } else {
        // Minor#2: a duplicate begin for an installing task must also reset the probe count, not just renew the timer
        probes[id] = 0
        arm(id)
      }
    } else if (name === 'app:install-progress') {
      // D5: the update flow reuses this event (image.go pullImageProgress); only update tracked tasks
      const cur = tasks.value[id]
      if (!cur || cur.state === 'error') return
      const n = Number(p['app:progress'])
      const percent = Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : cur.percent
      tasks.value = { ...tasks.value, [id]: { ...cur, percent } }
      probes[id] = 0
      arm(id)
    } else if (name === 'app:install-end') {
      if (tasks.value[id]) finish(id)
      else useInstalledAppsStore().refresh().catch(() => {}) // surface the new app even if begin was missed (inherits P1 behavior)
    } else if (name === 'app:install-error') {
      fail(id, typeof p['message'] === 'string' ? p['message'] : '')
    }
  }

  // Re-arm the watchdog for installing tasks restored after refresh: whether the install finished
  // or died (no events received while the page was closed), probing converges either way — no ghost cards left
  for (const t of Object.values(tasks.value)) {
    if (t.state === 'installing') { probes[t.id] = 0; arm(t.id) }
  }

  // Subscription tied to store lifecycle (app-level singleton): install keeps progressing after navigating away = spec "continues in background"
  const bus = useMessageBus()
  ;(['app:install-begin', 'app:install-progress', 'app:install-end', 'app:install-error'] as const)
    .forEach((ev) => bus.on(ev, (props) => onEvent(ev, props)))

  return { tasks, track, onEvent, dismiss, finish }
})
