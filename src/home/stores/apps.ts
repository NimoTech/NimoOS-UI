import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service, type AppGridItem } from '@nimotech/nimoos-service'
import { SYSTEM_APPS } from '../apps/systemApps'

export interface DesktopAppDecl { key: string; widget?: { w: number; h: number } }

/** spec §3:w∈[2,4] h∈[1,4],非法/缺省 → 2×2 */
export function clampWidgetDecl(w?: number, h?: number): [number, number] {
  const cw = !w || w < 2 ? 2 : Math.min(4, w)
  const ch = !h || h < 1 ? 2 : Math.min(4, h)
  return [!w || w <= 0 ? 2 : cw, !h || h <= 0 ? 2 : ch]
}

export interface AppMeta {
  name: string; cls: string; glyph: string; icon: string | null; system: boolean
  app_type?: string; status?: string; scheme?: string; port?: string | number; index?: string; hostname?: string
  desktop?: boolean; widget?: { path: string; w?: number; h?: number }
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
      // desktop 应用的相对 icon 由应用自身伺服(spec §3)
      let icon = a.icon || null
      if (a.desktop && icon && icon.startsWith('/') && a.port) {
        icon = `${a.scheme || 'http'}://${a.hostname || window.location.hostname}:${a.port}${icon}`
      }
      map[key] = {
        name: title, cls: 'ic-app', glyph: '', icon, system: false,
        app_type: (a as { appType?: string }).appType || a.app_type, status: a.status, scheme: a.scheme, port: a.port, index: a.index, hostname: a.hostname,
        desktop: a.desktop, widget: a.widget,
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

  function desktopDecls(): DesktopAppDecl[] {
    return order.value
      .filter((k) => apps.value[k]?.desktop)
      .map((k) => {
        const a = apps.value[k]
        const [w, h] = clampWidgetDecl(a.widget?.w, a.widget?.h)
        return { key: k, widget: a.widget?.path ? { w, h } : undefined }
      })
  }

  setApps([]) // 系统应用立即可用
  return { apps, order, setApps, loadGrid, app, desktopDecls }
})
