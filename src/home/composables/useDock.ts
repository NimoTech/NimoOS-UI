import { ref, computed } from 'vue'
import { useAppsStore } from '../stores/apps'
import { useOpenAction } from './useOpenAction'

const FAV_KEY = 'nimoos.home.dockfav'
const DEFAULT_FAV = ['files', 'photos', 'ai', 'vm', 'appstore']

export function useDock() {
  const apps = useAppsStore()
  const { openApp } = useOpenAction()

  function loadFav(): string[] | null {
    try { const a = JSON.parse(localStorage.getItem(FAV_KEY) || 'null'); if (Array.isArray(a) && a.length) return a.filter((k) => apps.app(k)) } catch { /* ignore */ }
    return null
  }
  const favKeys = ref<string[]>(loadFav() || DEFAULT_FAV.filter((k) => apps.app(k)))
  const expanded = ref(false)
  const moreKeys = computed(() => apps.order.filter((k) => !favKeys.value.includes(k)))

  function persist() { try { localStorage.setItem(FAV_KEY, JSON.stringify(favKeys.value)) } catch { /* ignore */ } }
  function setFav(keys: string[]) { favKeys.value = keys.filter((k) => apps.app(k)); persist() }
  function toggleExpanded() { expanded.value = !expanded.value; if (!expanded.value) persist() }
  function refresh() { favKeys.value = favKeys.value.filter((k) => apps.app(k)) } // more 为 computed,自动重算
  function openDockApp(key: string) { openApp(key) }

  return { favKeys, expanded, moreKeys, setFav, toggleExpanded, refresh, openDockApp }
}
