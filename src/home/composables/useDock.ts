import { ref, computed } from 'vue'
import { useAppsStore } from '../stores/apps'
import { useOpenAction } from './useOpenAction'

const FAV_KEY = 'nimoos.home.dockfav'
const DEFAULT_FAV = ['files', 'photos', 'ai', 'vm', 'appstore']

// Module-level singleton refs so all useDock() calls share state
const favKeys = ref<string[]>([])
const expanded = ref(false)
let _initialized = false

function loadFav(apps: ReturnType<typeof useAppsStore>): string[] | null {
  try { const a = JSON.parse(localStorage.getItem(FAV_KEY) || 'null'); if (Array.isArray(a) && a.length) return a.filter((k) => apps.app(k)) } catch { /* ignore */ }
  return null
}

/** Reset singleton state — call in test beforeEach after localStorage.clear() */
export function __resetDockForTest() {
  favKeys.value = []
  expanded.value = false
  _initialized = false
}

export function useDock() {
  const apps = useAppsStore()
  const { openApp } = useOpenAction()

  // (Re-)initialize singleton state: if not yet initialized or favKeys is empty, load from storage/defaults
  if (!_initialized || favKeys.value.length === 0) {
    favKeys.value = loadFav(apps) || DEFAULT_FAV.filter((k) => apps.app(k))
    _initialized = true
  }

  const moreKeys = computed(() => apps.order.filter((k) => !favKeys.value.includes(k)))

  function persist() { try { localStorage.setItem(FAV_KEY, JSON.stringify(favKeys.value)) } catch { /* ignore */ } }
  function setFav(keys: string[]) { favKeys.value = keys.filter((k) => apps.app(k)); persist() }
  function toggleExpanded() { expanded.value = !expanded.value; if (!expanded.value) persist() }
  function refresh() { favKeys.value = favKeys.value.filter((k) => apps.app(k)) }
  function openDockApp(key: string) { openApp(key) }

  return { favKeys, expanded, moreKeys, setFav, toggleExpanded, refresh, openDockApp }
}
