import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useAppsStore, type AppMeta } from '../stores/apps'
import { useToast } from '../../stores/toast'
import { i18n } from '../../i18n'

/** The web address of a container app; returns null when there is no page to open */
export function appUrl(a: AppMeta): string | null {
  if (!a.port && !a.index) return null
  const scheme = a.scheme || 'http'
  const host = a.hostname || window.location.hostname
  const port = a.port ? ':' + a.port : ''
  return `${scheme}://${host}${port}${a.index || '/'}`
}

export interface StartState { key: string; phase: 'confirm' | 'starting' }
export interface ConfirmOpts {
  pollMs?: number
  timeoutMs?: number
  /** Inject for testing; defaults to navigating current page */
  navigate?: (url: string) => void
}

// Module-level singleton: dialog state is shared among all callers (same pattern as useDock/useAddPanel),
// view is StartAppDialog in Home.vue.
const state = ref<StartState | null>(null)
// When user dismisses dialog during startup → startup continues but doesn't auto-navigate on completion (spec §2.5)
let navigateOnSuccess = true

/** Reset singleton state — call in test beforeEach */
export function __resetStartAppForTest() {
  state.value = null
  navigateOnSuccess = true
}

export function useStartApp() {
  const apps = useAppsStore()
  const toast = useToast()
  const t = i18n.global.t

  function prompt(key: string) {
    if (state.value) return // already has confirmation/startup flow, no stacking
    state.value = { key, phase: 'confirm' }
  }

  /** Close dialog (cancel button / Esc / click overlay). During startup it's just "collapse", flow continues. */
  function dismiss() {
    if (!state.value) return
    if (state.value.phase === 'starting') navigateOnSuccess = false
    state.value = null
  }

  async function confirm(opts: ConfirmOpts = {}): Promise<boolean> {
    if (state.value?.phase !== 'confirm') return false
    const key = state.value.key
    const meta = apps.app(key)
    if (!meta) { state.value = null; return false }
    state.value = { key, phase: 'starting' }
    navigateOnSuccess = true
    const navigate = opts.navigate ?? ((url: string) => { window.location.href = url })
    try {
      await service.apps.start({ name: key, app_type: meta.app_type })
      const pollMs = opts.pollMs ?? 1000
      const deadline = Date.now() + (opts.timeoutMs ?? 30_000)
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, pollMs))
        await apps.loadGrid().catch(() => {})
        const cur = apps.app(key)
        if (cur?.status === 'running') {
          const url = appUrl(cur)
          const shouldNavigate = navigateOnSuccess && url
          state.value = null
          if (shouldNavigate) navigate(url)
          else toast.show(t('startAppStarted', { name: cur.name }))
          return true
        }
      }
      throw new Error('timeout')
    } catch (e) {
      console.warn('[home] start app', key, e)
      state.value = null
      toast.show(t('startAppFailed', { name: meta.name }), 4000)
      return false
    }
  }

  return { state, prompt, dismiss, confirm }
}
