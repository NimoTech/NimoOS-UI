import type { LayoutItem } from '../grid/types'
import { useAppsStore } from '../stores/apps'
import { useStartApp, appUrl } from './useStartApp'
import { router } from '../../router'

// Files section (/files, SP4-P8), Apps section (/apps, SP5-P8), Storage section (/storage, SP6-P1), Photos section
// (/photos, SP7-P8b), Settings (/settings) and KVM (/kvm, both SP9-P8), AI section (/ai, SP8-P6)
// all now live in this app; SP1-SP9 migration is finalized here.
// photos / ai / vm are not dead keys left in the table —— at cutover rollback (flag set to 1)
// they redirect through them, so they are "rollback targets" not "main paths"; this is also the difference
// from appstore/storage/settings (those three are modal dialogs on Vue2, have no own routes,
// rollback can only land on /#/legacy legacy desktop —— settings therefore also uses '/#/legacy' as rollback target;
// after landing there, clicking the "settings" tile is decided by Vue2's resolveEntryTarget('/settings') to pop modal).
// router module cycle (router → Home → ... → this file) only accesses push at runtime; ESM lazy binding is safe.
const SYS_ROUTE: Record<string, string> = {
  photos: '/#/photos', ai: '/#/ai/agent', vm: '/#/kvm',
  settings: '/#/legacy',
}

// Fallback flag (naming consistent with Vue2's strangler.js strangler:disabled:<from>):
// == '1' when tile falls back to Vue2 old page (see SYS_ROUTE fallback targets), reversible cutover.
// /apps = SP5-P8; /storage = SP6-P6 (the three storage entry points on Vue2 desktop share the same key,
// same-origin shared localStorage, so setting once rolls back both sides); /photos = SP7-P8b (shares the same key
// with the /photos in Vue2's strangler.js migratedRoutes, setting once rolls back both sides);
// /kvm and /settings = SP9-P8, similarly one key controls both sides (/kvm in Vue2's migratedRoutes,
// /settings in migratedEntries).
// /ai = SP8-P6, similarly one key controls both sides (Vue2 side in migratedRoutes).
// ⚠️ Key name uses the **route path**, not the tile key —— vm tile's key is '/kvm'.
function cutoverDisabled(from: string): boolean {
  try { return localStorage.getItem(`strangler:disabled:${from}`) === '1' } catch { return false }
}

// Open an in-app hash route in a *new* browser tab (same URL shape SearchDialog
// uses for file hits: `<origin>/app/#/<path>`). The "workspace" apps launched
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
      if (key === 'appstore' && !cutoverDisabled('/apps')) { openInNewTab('/apps/store'); return }
      if (key === 'storage' && !cutoverDisabled('/storage')) { router.push('/storage'); return }
      if (key === 'photos' && !cutoverDisabled('/photos')) { openInNewTab('/photos'); return }
      if (key === 'settings' && !cutoverDisabled('/settings')) { router.push('/settings'); return }
      if (key === 'vm' && !cutoverDisabled('/kvm')) { router.push('/kvm'); return }
      if (key === 'ai' && !cutoverDisabled('/ai')) { openInNewTab('/ai/agent'); return }
      // Knowledge: an in-app route built at SP8 (eleven routes, nine-item rail);
      // Vue 2 has no counterpart entry for it, so there is nowhere to fall back to
      // and no strangler:disabled flag is set here (unlike ai/photos/vm/settings above).
      // Consequence: setting strangler:disabled:/ai = '1' only rolls the AI tile
      // back to Vue 2 (line above) -- the Knowledge tile keeps routing into this
      // app regardless, because it has no Vue 2 counterpart to roll back to. That
      // partial rollback is correct by necessity, not an oversight.
      if (key === 'knowledge') { openInNewTab('/ai/knowledge'); return }
      // Terminal: SP18 in-app route. Like knowledge above, Vue2 no longer exists
      // on-device (retired 08-07), so there is no fallback target and no
      // strangler:disabled flag — the tile always routes into this app.
      if (key === 'terminal') { openInNewTab('/terminal'); return }
      window.location.href = SYS_ROUTE[key] || '/#/legacy'
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
    // Desktop photo tile: after cutover, enter in-app timeline. Deliberately no asset —— Vue2 here also just jumps
    // to /#/photos, not to a specific photo (desktop tile's key is a gradient color string, not an asset id),
    // UI 1:1 should maintain "entering photos home". flag set to 1 falls back to Vue2 old album.
    else if (it.kind === 'photo') {
      if (cutoverDisabled('/photos')) window.location.href = '/#/photos'
      else router.push('/photos')
    }
    // Desktop AI widget: after cutover, enter in-app Agent page. flag set to 1 falls back to Vue2 old Agent.
    else if (it.kind === 'widget' && it.key === 'ai') {
      if (cutoverDisabled('/ai')) window.location.href = '/#/ai/agent'
      else router.push('/ai/agent')
    }
  }

  function sendToAI(text?: string) {
    const q = (text || '').trim()
    // After cutover, use in-app router: query passed to vue-router as object form for encoding, not manually concatenated
    // (AgentPage.vue's onMounted reads route.query.message, consumed once then router.replace clears it).
    // flag set to 1 falls back to Vue2, which only recognizes pre-built hash URL, so keep encodeURIComponent.
    if (cutoverDisabled('/ai')) {
      window.location.href = '/#/ai/agent' + (q ? '?message=' + encodeURIComponent(q) : '')
      return
    }
    router.push(q ? { path: '/ai/agent', query: { message: q } } : { path: '/ai/agent' })
  }

  return { openApp, openItem, sendToAI }
}
