import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service, type AppGridItem, type AppGridWidget } from '@nimotech/nimoos-service'
import type { WidgetSize } from '../grid/types'
import { APP_WIDGET_SIZE, appWidgetRange } from '../widgets/appWidgetSize'
import { SYSTEM_APPS } from '../apps/systemApps'
import { listLinkApps, type LinkApp } from '../../apps/util/linkApps'
import { useSessionStore } from '../../stores/session'

export interface DesktopAppDecl { key: string; widget?: { w: number; h: number } }

/** spec §3: clamp initial size to valid range (default = global w 2..4 / h 1..4); invalid/default → 2x2 then clamp */
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
  const session = useSessionStore()
  const apps = ref<Record<string, AppMeta>>({})
  const order = ref<string[]>([])
  // null = not probed yet. Unknown must render as "available": the store calls
  // setApps([]) at init so the desktop has its system tiles before any request has
  // been made, and hiding the tile there would make it blink out and back in.
  const kvmAvailable = ref<boolean | null>(null)
  const terminalAvailable = ref<boolean | null>(null)

  function setApps(container: AppGridItem[], links?: LinkApp[]) {
    const map: Record<string, AppMeta> = {}
    const ord: string[] = []
    SYSTEM_APPS
      .filter((s) =>
        (s.requiresService !== 'kvm' || kvmAvailable.value !== false)
        && (s.requiresService !== 'terminal' || terminalAvailable.value !== false)
        && (!s.adminOnly || session.isAdmin))
      .forEach((s) => {
        map[s.key] = { name: s.label, cls: s.cls, glyph: s.glyph, icon: s.icon, system: true, status: 'running' }
        ord.push(s.key)
      })
    ;(container || []).forEach((a) => {
      const key = a.name
      if (!key || map[key]) return // do not overwrite system apps
      // Title i18n key case is inconsistent: v2 apps from the app store use `en_US` (uppercase),
      // while v1/containers use DefaultLanguage=`en_us` (lowercase). Try each, fall back to any available, finally use id.
      const t = a.title || {}
      const title = t.zh_cn || t.en_us || t.en_US || t.zh_CN || Object.values(t)[0] || a.name
      // desktop app relative icon served by the app itself (spec §3)
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
    ;(links || []).forEach((l) => {
      const key = l.name
      if (!key || map[key]) return // system/container apps already occupy this key, external links do not overwrite (container wins)
      map[key] = {
        name: l.name, cls: 'ic-app', glyph: (l.name[0] || '').toUpperCase(), icon: l.icon || null, system: false,
        app_type: l.app_type, status: l.status, hostname: l.hostname,
      }
      ord.push(key)
    })
    apps.value = map
    order.value = ord
  }

  /** Any failure -- not registered with the gateway, unreachable, timing out -- means
   *  "not available" here. It is not an error worth surfacing: a machine without KVM
   *  installed is the normal case (Vue 2 AppSection.checkKvmAvailability). */
  async function probeKvm(): Promise<boolean> {
    try {
      await service.kvm.getSettings()
      return true
    } catch {
      return false
    }
  }

  /** Probe the optional terminal service. Unlike probeKvm, an auth-shaped refusal
   *  (401/403) still proves the service is registered and answering — ttyd may
   *  simply be talking to a non-admin. Only "route not there" (404), server
   *  errors and network failures count as not installed (spec §3.3). */
  async function probeTerminal(): Promise<boolean> {
    try {
      await service.terminal.getSettings()
      return true
    } catch (e) {
      const st = (e as { response?: { status?: number } })?.response?.status
      return st === 401 || st === 403
    }
  }

  async function loadGrid() {
    const [list, links, kvmOk, termOk] = await Promise.all([
      service.apps.getGrid(),
      listLinkApps().catch(() => []),
      probeKvm(),
      probeTerminal(),
    ])
    kvmAvailable.value = kvmOk
    terminalAvailable.value = termOk
    setApps(list || [], links)
  }

  function app(key: string): AppMeta | undefined { return apps.value[key] }

  /** Stopped (restartable) container apps: system apps / LinkApp / stateless sources do not count.
   *  Default status is treated as running (same convention as desktopDecls, no false positives). */
  function isStopped(key: string): boolean {
    const a = apps.value[key]
    if (!a || a.system || a.app_type === 'LinkApp') return false
    return !!a.status && a.status !== 'running'
  }

  function desktopDecls(): DesktopAppDecl[] {
    // spec §4: stopped means gone — non-running containers do not count as "should be on desktop", cleaned up by autoPin grace period.
    // default status (non-container source) is treated as running, no false positives.
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

  /** Desktop apps explicitly stopped (exited/dead) — backend proactively reports stop, not a flicker, can clean up immediately.
   *  Intermediate states like restarting/paused do not count, fall back to absence grace period. */
  function stoppedDesktopKeys(): string[] {
    return order.value.filter((k) => {
      const a = apps.value[k]
      return a?.desktop && (a.status === 'exited' || a.status === 'dead')
    })
  }

  setApps([]) // system apps immediately available
  return { apps, order, kvmAvailable, terminalAvailable, setApps, loadGrid, app, isStopped, desktopDecls, stoppedDesktopKeys }
})
