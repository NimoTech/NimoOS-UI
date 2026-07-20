import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service, type ComposeAppWithStoreInfo } from '@nimotech/nimoos-service'
import { resolveAppTitle } from '../util/appTitle'
import { composeWebUrl, type WebUrlSource } from '../util/appUrl'

export type AppOp = 'start' | 'stop' | 'restart' | 'update' | 'uninstall'

export interface InstalledApp {
  id: string
  title: string
  icon: string
  status: string          // docker 主容器 State;后端取不到时 "unknown"
  updateAvailable: boolean
  isUncontrolled: boolean
  webUrl: string | null
}

/** pending 兜底:MessageBus buffer=1 可能丢 end 事件,30s 无收敛就主动重拉(spec §5) */
export const PENDING_TIMEOUT_MS = 30_000

export function mapInstalled(id: string, raw: ComposeAppWithStoreInfo, currentHost: string): InstalledApp {
  const si = (raw.store_info ?? {}) as WebUrlSource & { title?: Record<string, string>; icon?: unknown }
  return {
    id,
    title: resolveAppTitle(si.title, id),
    icon: typeof si.icon === 'string' ? si.icon : '',
    status: raw.status || 'unknown',
    updateAvailable: !!raw.update_available,
    isUncontrolled: !!raw.is_uncontrolled,
    webUrl: composeWebUrl(si, currentHost),
  }
}

const EVENT_RE = /^app:(start|stop|restart|update|uninstall)-(begin|end|error)$/

export const useInstalledAppsStore = defineStore('installed-apps', () => {
  const apps = ref<InstalledApp[]>([])
  const loading = ref(false)
  const pending = ref<Record<string, AppOp>>({})
  const timers: Record<string, ReturnType<typeof setTimeout>> = {}

  async function refresh() {
    loading.value = true
    try {
      const map = await service.compose.list()
      const host = window.location.hostname
      apps.value = Object.entries(map)
        .map(([id, raw]) => mapInstalled(id, raw, host))
        .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
    } finally {
      loading.value = false
    }
  }

  function begin(id: string, op: AppOp) {
    pending.value = { ...pending.value, [id]: op }
    clearTimeout(timers[id])
    timers[id] = setTimeout(() => { resolve(id) }, PENDING_TIMEOUT_MS)
  }

  /** 收敛:清 pending + 重拉列表(操作完成 / 事件到达 / 30s 兜底共用同一出口) */
  function resolve(id: string) {
    clearTimeout(timers[id]); delete timers[id]
    if (pending.value[id]) {
      const next = { ...pending.value }; delete next[id]
      pending.value = next
    }
    refresh().catch((e) => console.warn('[apps] refresh', e))
  }

  function clearPendingOnly(id: string) {
    clearTimeout(timers[id]); delete timers[id]
    const next = { ...pending.value }; delete next[id]
    pending.value = next
  }

  async function setStatus(id: string, action: 'start' | 'stop' | 'restart') {
    begin(id, action)
    try { await service.compose.setStatus(id, action) } catch (e) { clearPendingOnly(id); throw e }
    resolve(id)
  }

  /** 检查并更新:返回后端 message(「已是最新」/「异步更新中」),真在更新时 app:update-* 事件接管 pending */
  async function update(id: string): Promise<string> {
    begin(id, 'update')
    try {
      const msg = await service.compose.update(id)
      resolve(id)
      return msg
    } catch (e) { clearPendingOnly(id); throw e }
  }

  async function uninstall(id: string, deleteConfigFolder: boolean) {
    begin(id, 'uninstall')
    try { await service.compose.uninstall(id, { deleteConfigFolder }) } catch (e) { clearPendingOnly(id); throw e }
    resolve(id)
  }

  /** 立即移除(容器 destroy / uninstall-end),后续 refresh 再收敛一次 */
  function evict(id: string) {
    clearPendingOnly(id)
    apps.value = apps.value.filter((a) => a.id !== id)
  }

  /** MessageBus app:* 生命周期事件 → pending 收敛(页面接线调用;props 已被 useMessageBus 解包) */
  function onAppEvent(name: string, props: unknown) {
    const m = EVENT_RE.exec(name)
    if (!m) return
    const p = (props && typeof props === 'object' ? props : {}) as Record<string, unknown>
    const id = typeof p['app:name'] === 'string' ? p['app:name'] : ''
    if (!id) return
    const [, op, phase] = m
    if (phase === 'begin') begin(id, op as AppOp)
    else resolve(id) // end 与 error 都收敛;error 的 toast 由页面层做
  }

  return { apps, loading, pending, refresh, setStatus, update, uninstall, evict, onAppEvent }
})
