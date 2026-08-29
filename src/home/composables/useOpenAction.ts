import type { LayoutItem } from '../grid/types'
import { useAppsStore } from '../stores/apps'
import { useStartApp, appUrl } from './useStartApp'
import { router } from '../../router'

// Files section (/files), Apps section (/apps), Storage section (/storage), Photos section
// (/photos), Settings (/settings), KVM (/kvm) and AI section (/ai) all live in this app.
// Vue2 has been retired, so there is no fallback route for any of these system tiles anymore —
// every key below is handled unconditionally in openApp().
// router module cycle (router → Home → ... → this file) only accesses push at runtime; ESM lazy binding is safe.

// Defensive fallback map for a system-app key that isn't explicitly handled in openApp()
// below (every key currently enumerated there returns early, so this is only reached for a
// future system tile that hasn't been wired up yet).
const SYS_ROUTE: Record<string, string> = {
  vm: '/kvm', settings: '/settings',
}

// Open an in-app hash route in a *new* browser tab (same URL shape SearchDialog
// uses for file hits: `<origin>/#/<path>`). The "workspace" apps launched
// from the home screen — Files / Photos / AI / AppStore / Knowledge / Terminal —
// open this way so the desktop stays put in its own tab (2026-08-27 request);
// the system panels (Storage / Settings / VM) still navigate in place.
function openInNewTab(path: string): void {
  window.open(`${window.location.origin}${import.meta.env.BASE_URL}#${path}`, '_blank', 'noopener')
}

export function useOpenAction() {
  const apps = useAppsStore()
  const startApp = useStartApp()

  function openApp(key: string) {
    const a = apps.app(key)
    if (!a) return
    if (a.system) {
      if (key === 'files') { openInNewTab('/files'); return }
      if (key === 'appstore') { openInNewTab('/apps/store'); return }
      if (key === 'storage') { router.push('/storage'); return }
      if (key === 'photos') { openInNewTab('/photos'); return }
      if (key === 'settings') { router.push('/settings'); return }
      if (key === 'vm') { router.push('/kvm'); return }
      if (key === 'ai') { openInNewTab('/ai/agent'); return }
      // Knowledge: an in-app route built at SP8 (eleven routes, nine-item rail).
      if (key === 'knowledge') { openInNewTab('/ai/knowledge'); return }
      // Terminal: SP18 in-app route.
      if (key === 'terminal') { openInNewTab('/terminal'); return }
      router.push(SYS_ROUTE[key] || '/')
      return
    }
    if (a.app_type === 'LinkApp') { if (a.hostname) window.open(a.hostname, '_blank', 'noopener'); return }
    const url = appUrl(a)
    if (a.status === 'running') {
      if (url) window.open(url, '_blank', 'noopener')
    } else if (a.status) {
      // Not running (exited/dead/unknown…): don't open a web page, pop "start?" confirmation dialog (StartAppDialog).
      // missing status from non-container sources stays inactive (same convention as greying out logic).
      startApp.prompt(key)
    }
  }

  function openItem(it: LayoutItem) {
    if (it.kind === 'app') openApp(it.key)
    else if (it.kind === 'folder') router.push({ path: '/files', query: { path: it.path || '/DATA/' + it.key } })
    // Desktop photo tile: enter in-app timeline. Deliberately no asset (desktop tile's key
    // is a gradient color string, not an asset id) — "entering photos home" is the intent.
    else if (it.kind === 'photo') {
      router.push('/photos')
    }
    // Desktop AI widget: enter in-app Agent page.
    else if (it.kind === 'widget' && it.key === 'ai') {
      router.push('/ai/agent')
    }
  }

  function sendToAI(text?: string) {
    const q = (text || '').trim()
    // Query passed to vue-router as object form for encoding, not manually concatenated
    // (AgentPage.vue's onMounted reads route.query.message, consumed once then router.replace clears it).
    router.push(q ? { path: '/ai/agent', query: { message: q } } : { path: '/ai/agent' })
  }

  return { openApp, openItem, sendToAI }
}
