import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service, type AppGridItem } from '@nimotech/nimoos-service'
import { SYSTEM_APPS } from '../apps/systemApps'

export interface AppMeta {
  name: string; cls: string; glyph: string; icon: string | null; system: boolean
  app_type?: string; status?: string; scheme?: string; port?: string | number; index?: string; hostname?: string
}

export const useAppsStore = defineStore('home-apps', () => {
  const apps = ref<Record<string, AppMeta>>({})
  const order = ref<string[]>([])

  function setApps(container: AppGridItem[]) {
    const map: Record<string, AppMeta> = {}
    const ord: string[] = []
    SYSTEM_APPS.forEach((s) => {
      map[s.key] = { name: s.label, cls: s.cls, glyph: s.glyph, icon: null, system: true, status: 'running' }
      ord.push(s.key)
    })
    ;(container || []).forEach((a) => {
      const key = a.name
      if (!key || map[key]) return // 不覆盖系统应用
      const title = (a.title && (a.title.zh_cn || a.title.en_us)) || a.name
      map[key] = {
        name: title, cls: 'ic-app', glyph: '', icon: a.icon || null, system: false,
        app_type: (a as { appType?: string }).appType || a.app_type, status: a.status, scheme: a.scheme, port: a.port, index: a.index, hostname: a.hostname,
      }
      ord.push(key)
    })
    apps.value = map
    order.value = ord
  }

  async function loadGrid() {
    const list = await service.apps.getGrid()
    setApps(list || [])
  }

  function app(key: string): AppMeta | undefined { return apps.value[key] }

  setApps([]) // 系统应用立即可用
  return { apps, order, setApps, loadGrid, app }
})
