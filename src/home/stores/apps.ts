import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service, type AppGridItem, type AppGridWidget } from '@nimotech/nimoos-service'
import type { WidgetSize } from '../grid/types'
import { APP_WIDGET_SIZE, appWidgetRange } from '../widgets/appWidgetSize'
import { SYSTEM_APPS } from '../apps/systemApps'

export interface DesktopAppDecl { key: string; widget?: { w: number; h: number } }

/** spec §3:初始尺寸夹进有效范围(缺省 = 全局 w 2..4 / h 1..4);非法/缺省 → 2×2 再夹 */
export function clampWidgetDecl(w?: number, h?: number, range: WidgetSize = APP_WIDGET_SIZE): [number, number] {
  const iw = !w || w <= 0 ? 2 : w
  const ih = !h || h <= 0 ? 2 : h
  return [
    Math.max(range.min[0], Math.min(range.max[0], iw)),
    Math.max(range.min[1], Math.min(range.max[1], ih)),
  ]
}

export interface AppMeta {
  name: string; cls: string; glyph: string; icon: string | null; system: boolean
  app_type?: string; status?: string; scheme?: string; port?: string | number; index?: string; hostname?: string
  desktop?: boolean; widget?: AppGridWidget
}

export const useAppsStore = defineStore('home-apps', () => {
  const apps = ref<Record<string, AppMeta>>({})
  const order = ref<string[]>([])

  function setApps(container: AppGridItem[]) {
    const map: Record<string, AppMeta> = {}
    const ord: string[] = []
    SYSTEM_APPS.forEach((s) => {
      map[s.key] = { name: s.label, cls: s.cls, glyph: s.glyph, icon: s.icon, system: true, status: 'running' }
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

  /** 已停止(可启动)的容器应用:系统应用/LinkApp/无状态来源不算。
   *  status 缺省视为运行(与 desktopDecls 同一约定,不误伤)。 */
  function isStopped(key: string): boolean {
    const a = apps.value[key]
    if (!a || a.system || a.app_type === 'LinkApp') return false
    return !!a.status && a.status !== 'running'
  }

  function desktopDecls(): DesktopAppDecl[] {
    // spec §4:停止就消失——非 running 容器不算"该上桌",由 autoPin 的宽限期清理。
    // status 缺省(非容器来源)视为运行,不误伤。
    return order.value
      .filter((k) => {
        const a = apps.value[k]
        return a?.desktop && (!a.status || a.status === 'running')
      })
      .map((k) => {
        const a = apps.value[k]
        const [w, h] = clampWidgetDecl(a.widget?.w, a.widget?.h, appWidgetRange(a.widget))
        return { key: k, widget: a.widget?.path ? { w, h } : undefined }
      })
  }

  /** 已明确停止(exited/dead)的 desktop 应用——后端积极报告的停止不是抖动,可立即清理。
   *  restarting/paused 等中间态不算,走缺席宽限期兜底。 */
  function stoppedDesktopKeys(): string[] {
    return order.value.filter((k) => {
      const a = apps.value[k]
      return a?.desktop && (a.status === 'exited' || a.status === 'dead')
    })
  }

  setApps([]) // 系统应用立即可用
  return { apps, order, setApps, loadGrid, app, isStopped, desktopDecls, stoppedDesktopKeys }
})
