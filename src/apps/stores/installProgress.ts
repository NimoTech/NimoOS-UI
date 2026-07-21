import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useMessageBus } from '../../composables/useMessageBus'
import { useInstalledAppsStore } from './installedApps'
import { useAppstoreStore } from './appstore'
import { resolveAppTitle } from '../util/appTitle'

export interface InstallTask {
  id: string
  title: string
  icon: string
  percent: number
  state: 'installing' | 'error'
  message: string
}

/** 事件静默 60s 后主动探测 compose.get(id) 收敛(spec §5:pending 不许永久卡死) */
export const WATCHDOG_MS = 60_000
/** 连续 5 轮(约 5 分钟)探不到 → error 态交用户 dismiss */
export const WATCHDOG_MAX_PROBES = 5

function titleFromProps(p: Record<string, unknown>, fallback: string): string {
  // app:title 是 JSON 字符串({"en_us":"…"},AppManagement common/message.go:24-28)
  if (typeof p['app:title'] === 'string') {
    try { return resolveAppTitle(JSON.parse(p['app:title']), fallback) } catch { /* 容忍坏 JSON */ }
  }
  return fallback
}

export const useInstallProgressStore = defineStore('install-progress', () => {
  const tasks = ref<Record<string, InstallTask>>({})
  const timers: Record<string, ReturnType<typeof setTimeout>> = {}
  const probes: Record<string, number> = {}

  function arm(id: string) {
    clearTimeout(timers[id])
    timers[id] = setTimeout(() => { void probe(id) }, WATCHDOG_MS)
  }

  async function probe(id: string) {
    const cur = tasks.value[id]
    if (!cur || cur.state === 'error') {
      clearTimeout(timers[id]); delete timers[id]; delete probes[id]
      return
    }
    try {
      const app = await service.compose.get(id)
      // Fix2: await 落定后任务可能已被 dismiss/finish——重新读取,不存在就直接退出,
      // 不再写 probes[id]/arm(id),也不要误触发 finish() 的 refresh/installed 副作用。
      if (!tasks.value[id]) return
      if (app) { finish(id); return }
    } catch {
      // Fix3: 网络错不计罚——不递增 probes,下一轮再探(装置仍是 installing)
      arm(id)
      return
    }
    probes[id] = (probes[id] ?? 0) + 1
    if (probes[id] >= WATCHDOG_MAX_PROBES) fail(id, '')
    else arm(id)
  }

  /** 发起端登记(POST /compose 受理后调;begin 事件到达前就有卡可看) */
  function track(id: string, title?: string, icon?: string) {
    tasks.value = {
      ...tasks.value,
      [id]: { id, title: title || id, icon: icon || '', percent: 0, state: 'installing', message: '' },
    }
    probes[id] = 0
    arm(id)
  }

  /** 成功收敛:删任务 + 已装列表浮出 + 商店「已安装」徽章乐观更新 */
  function finish(id: string) {
    clearTimeout(timers[id]); delete timers[id]; delete probes[id]
    const next = { ...tasks.value }; delete next[id]; tasks.value = next
    useInstalledAppsStore().refresh().catch((e) => console.warn('[apps] refresh after install', e))
    const store = useAppstoreStore()
    if (!store.installed.includes(id)) store.installed = [...store.installed, id]
  }

  function fail(id: string, message: string) {
    clearTimeout(timers[id]); delete timers[id]; delete probes[id]
    const cur = tasks.value[id]
    if (!cur) return
    tasks.value = { ...tasks.value, [id]: { ...cur, state: 'error', message } }
  }

  function dismiss(id: string) {
    clearTimeout(timers[id]); delete timers[id]; delete probes[id]
    const next = { ...tasks.value }; delete next[id]; tasks.value = next
  }

  function onEvent(name: string, props: unknown) {
    const p = (props && typeof props === 'object' ? props : {}) as Record<string, unknown>
    const id = typeof p['app:name'] === 'string' ? p['app:name'] : ''
    if (!id) return
    if (name === 'app:install-begin') {
      const cur = tasks.value[id]
      if (!cur) {
        track(id, titleFromProps(p, id), typeof p['app:icon'] === 'string' ? p['app:icon'] : '')
      } else if (cur.state === 'error') {
        // Fix1: begin 要能复活 error 态任务(比如用户 dismiss 前又重装/重试)
        tasks.value = { ...tasks.value, [id]: { ...cur, state: 'installing', percent: 0, message: '' } }
        probes[id] = 0
        arm(id)
      } else {
        // Minor#2: installing 任务重复 begin 也要重置探测计数,不只是续期定时器
        probes[id] = 0
        arm(id)
      }
    } else if (name === 'app:install-progress') {
      // D5:update 流复用本事件(image.go pullImageProgress),只更新已跟踪任务
      const cur = tasks.value[id]
      if (!cur || cur.state === 'error') return
      const n = Number(p['app:progress'])
      const percent = Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : cur.percent
      tasks.value = { ...tasks.value, [id]: { ...cur, percent } }
      probes[id] = 0
      arm(id)
    } else if (name === 'app:install-end') {
      if (tasks.value[id]) finish(id)
      else useInstalledAppsStore().refresh().catch(() => {}) // 错过 begin 也要浮出新应用(承 P1 行为)
    } else if (name === 'app:install-error') {
      fail(id, typeof p['message'] === 'string' ? p['message'] : '')
    }
  }

  // 订阅挂 store 生命周期(应用级单例):页面切走安装继续推进 = spec「后台继续」
  const bus = useMessageBus()
  ;(['app:install-begin', 'app:install-progress', 'app:install-end', 'app:install-error'] as const)
    .forEach((ev) => bus.on(ev, (props) => onEvent(ev, props)))

  return { tasks, track, onEvent, dismiss, finish }
})
