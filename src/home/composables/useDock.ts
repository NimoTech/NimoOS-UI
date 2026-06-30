import { ref } from 'vue'
import { useAppsStore } from '../stores/apps'
import { useOpenAction } from './useOpenAction'

const FAV_KEY = 'nimoos.home.dockfav'
const DEFAULT_FAV = ['files', 'photos', 'ai', 'vm', 'appstore']

// Module-level singleton refs so all useDock() calls share state
const favKeys = ref<string[]>([])
const moreKeys = ref<string[]>([])
const expanded = ref(false)
const justDragged = ref(false)
let _initialized = false

function loadFav(apps: ReturnType<typeof useAppsStore>): string[] | null {
  try { const a = JSON.parse(localStorage.getItem(FAV_KEY) || 'null'); if (Array.isArray(a) && a.length) return a.filter((k) => apps.app(k)) } catch { /* ignore */ }
  return null
}

/** Reset singleton state — call in test beforeEach after localStorage.clear() */
export function __resetDockForTest() {
  favKeys.value = []
  moreKeys.value = []
  expanded.value = false
  _initialized = false
}

export function useDock() {
  const apps = useAppsStore()
  const { openApp } = useOpenAction()

  // (Re-)initialize singleton state: if not yet initialized or favKeys is empty, load from storage/defaults
  if (!_initialized || favKeys.value.length === 0) {
    favKeys.value = loadFav(apps) || DEFAULT_FAV.filter((k) => apps.app(k))
    moreKeys.value = apps.order.filter((k) => !favKeys.value.includes(k))
    _initialized = true
  }

  function persist() { try { localStorage.setItem(FAV_KEY, JSON.stringify(favKeys.value)) } catch { /* ignore */ } }
  function setFav(keys: string[]) {
    favKeys.value = keys.filter((k) => apps.app(k))
    moreKeys.value = apps.order.filter((k) => !favKeys.value.includes(k))
    persist()
  }
  function toggleExpanded() { expanded.value = !expanded.value; if (!expanded.value) persist() }
  function refresh() {
    // Keep current fav order, drop invalid keys; recompute more from order minus fav
    favKeys.value = favKeys.value.filter((k) => apps.app(k))
    moreKeys.value = apps.order.filter((k) => !favKeys.value.includes(k))
  }
  function openDockApp(key: string) { openApp(key) }
  function reorder(key: string, toZone: 'fav' | 'more', beforeKey: string | null) {
    // Remove key from both arrays
    const fav = favKeys.value.filter((k) => k !== key)
    const more = moreKeys.value.filter((k) => k !== key)

    if (toZone === 'fav') {
      const idx = beforeKey != null ? fav.indexOf(beforeKey) : fav.length
      fav.splice(idx < 0 ? fav.length : idx, 0, key)
    } else {
      // toZone === 'more'
      const idx = beforeKey != null ? more.indexOf(beforeKey) : more.length
      more.splice(idx < 0 ? more.length : idx, 0, key)
    }

    favKeys.value = fav
    moreKeys.value = more
    persist()
  }

  return { favKeys, expanded, moreKeys, justDragged, setFav, toggleExpanded, refresh, openDockApp, reorder }
}
