import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service, type ComposeAppWithStoreInfo } from '@nimotech/nimoos-service'
import { resolveAppTitle } from '../util/appTitle'
import { composeWebUrl, type WebUrlSource } from '../util/appUrl'
import { isSystemComposeApp } from '../util/systemApp'

export type AppOp = 'start' | 'stop' | 'restart' | 'update' | 'uninstall' | 'apply-changes'

export interface InstalledApp {
  id: string
  title: string
  icon: string
  status: string          // docker main container State; "unknown" when the backend cannot read it
  updateAvailable: boolean
  isUncontrolled: boolean
  webUrl: string | null
}

/** Pending fallback: MessageBus buffer=1 may drop the end event; refetch proactively after 30s without convergence (spec §5) */
export const PENDING_TIMEOUT_MS = 30_000

export function mapInstalled(id: string, raw: ComposeAppWithStoreInfo, currentHost: string): InstalledApp {
  const si = (raw.store_info ?? {}) as WebUrlSource & { title?: Record<string, string>; icon?: unknown }
  return {
    id,
    title: resolveAppTitle(si.title, id),
    icon: typeof si.icon === 'string' ? si.icon : '',
    status: raw.status || 'unknown',
    updateAvailable: !!raw.update_available,
    isUncontrolled: !!raw.is_uncontrolled,
    webUrl: composeWebUrl(si, currentHost),
  }
}

const EVENT_RE = /^app:(start|stop|restart|update|uninstall|apply-changes)-(begin|end|error)$/

export const useInstalledAppsStore = defineStore('installed-apps', () => {
  const apps = ref<InstalledApp[]>([])
  const loading = ref(false)
  const pending = ref<Record<string, AppOp>>({})
  const timers: Record<string, ReturnType<typeof setTimeout>> = {}

  async function refresh() {
    loading.value = true
    try {
      const map = await service.compose.list()
      const host = window.location.hostname
      apps.value = Object.entries(map)
        // System background containers (nimoos.system=true, e.g. AI agent / Photos ML) are hidden from users —
        // consistent with the desktop appgrid (same rule as backend isSystemComposeApp).
        .filter(([, raw]) => !isSystemComposeApp(raw))
        .map(([id, raw]) => mapInstalled(id, raw, host))
        .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
    } finally {
      loading.value = false
    }
  }

  function begin(id: string, op: AppOp) {
    pending.value = { ...pending.value, [id]: op }
    clearTimeout(timers[id])
    timers[id] = setTimeout(() => { resolve(id) }, PENDING_TIMEOUT_MS)
  }

  /** Converge: clear pending + refetch the list (op completion / event arrival / 30s fallback all share this exit) */
  function resolve(id: string) {
    clearTimeout(timers[id]); delete timers[id]
    if (pending.value[id]) {
      const next = { ...pending.value }; delete next[id]
      pending.value = next
    }
    refresh().catch((e) => console.warn('[apps] refresh', e))
  }

  function clearPendingOnly(id: string) {
    clearTimeout(timers[id]); delete timers[id]
    const next = { ...pending.value }; delete next[id]
    pending.value = next
  }

  async function setStatus(id: string, action: 'start' | 'stop' | 'restart') {
    begin(id, action)
    try { await service.compose.setStatus(id, action) } catch (e) { clearPendingOnly(id); throw e }
    // Backend returns on acceptance (SetStatus runs async in a go func); do not converge here — otherwise
    // the "processing" state flashes away, begin's 30s fallback is cancelled, and one dropped end event (buffer=1) leaves the list stale forever.
    // Convergence paths: app:*-end/-error event → resolve; event lost → 30s fallback resolve.
  }

  /** Check and update: returns backend message ("already up to date" / "updating asynchronously"); when an update really runs, app:update-* events take over pending */
  async function update(id: string): Promise<string> {
    begin(id, 'update')
    try {
      const msg = await service.compose.update(id)
      resolve(id)
      return msg
    } catch (e) { clearPendingOnly(id); throw e }
  }

  async function uninstall(id: string, deleteConfigFolder: boolean) {
    begin(id, 'uninstall')
    try { await service.compose.uninstall(id, { deleteConfigFolder }) } catch (e) { clearPendingOnly(id); throw e }
    // Same as setStatus: returns on acceptance, no early convergence; the uninstall-end event goes through evict (icon disappears immediately) + refetch,
    // and a lost event converges via the 30s fallback refetch.
  }

  /** Remove immediately (container destroy / uninstall-end); a later refresh converges once more */
  function evict(id: string) {
    clearPendingOnly(id)
    apps.value = apps.value.filter((a) => a.id !== id)
  }

  /** MessageBus app:* lifecycle events → pending convergence (called from page wiring; props already unwrapped by useMessageBus) */
  function onAppEvent(name: string, props: unknown) {
    const m = EVENT_RE.exec(name)
    if (!m) return
    const p = (props && typeof props === 'object' ? props : {}) as Record<string, unknown>
    const id = typeof p['app:name'] === 'string' ? p['app:name'] : ''
    if (!id) return
    const [, op, phase] = m
    if (phase === 'begin') begin(id, op as AppOp)
    else if (op === 'uninstall' && phase === 'end') { evict(id); resolve(id) } // icon disappears immediately, then refetch to converge
    else resolve(id) // both end and error converge; the error toast is handled at the page layer
  }

  /** Mark pending once a settings save is accepted (PUT returns on acceptance, Apply runs async in a go func; convergence via apply-changes event / 30s fallback) */
  function markApplying(id: string) { begin(id, 'apply-changes') }

  return { apps, loading, pending, refresh, setStatus, update, uninstall, evict, onAppEvent, markApplying }
})
