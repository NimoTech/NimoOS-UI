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
      // 标题多语言键大小写不统一:应用市场装的 v2 应用来自 store 的 title 用 `en_US`(大写),
      // 而 v1/容器走 DefaultLanguage=`en_us`(小写)。逐一容忍再回退到任意可用值,最后才用 id。
      const t = a.title || {}
      const title = t.zh_cn || t.en_us || t.en_US || t.zh_CN || Object.values(t)[0] || a.name
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
