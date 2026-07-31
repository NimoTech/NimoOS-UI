/**
 * 电源相位机。对位 Vue2 SettingsPanel.vue 的
 * onShutdownConfirmed(L1779) / onRestartConfirmed(L1816) / startAppUpdate(L1501) /
 * _onShutdownOffline(L1812) / _onRestartFallback(L1862) / resetPower(L1873)。
 *
 * 抽成不依赖 Vue 的控制器,是为了能用假定时器把「下线→上线」这类时序真的测出来 ——
 * Vue2 那边全混在组件方法里,一条都测不了,而这块逻辑一旦错就是用户盯着
 * 「正在重启」永远不动,或者机器还没关就说「已关机」。
 */
export type PowerPhase =
  | 'idle' | 'shutting' | 'offline'
  | 'restarting' | 'reconnecting' | 'done' | 'fallback' | 'appUpdating'

export const PING_INTERVAL_MS = 3000
export const SHUTDOWN_FALLBACK_MS = 60_000
export const RESTART_FALLBACK_MS = 180_000
export const RESTART_PING_DELAY_MS = 5_000
export const DONE_RELOAD_DELAY_MS = 1_500
/** 关机:连续 2 次探活失败才判定已下线(单次失败可能只是网络抖动) */
export const SHUTDOWN_FAIL_THRESHOLD = 2

/**
 * 移植纪律 #6:Vue2 用 $api.users.getUserStatus() 探活,走的是带认证拦截器的 axios ——
 * 重启期间一个 401 就会触发 onAuthFail、清 token 并跳登录页,把电源流打断。
 * 这里用裸 fetch,并且**任何 HTTP 响应(含 401/500)都算「服务器活着」** ——
 * 能回 HTTP 状态码就说明它起来了,这才是探活真正要问的问题。
 */
export async function probeAlive(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    await fetchImpl('/v1/users/status', { cache: 'no-store' })
    return true
  } catch {
    return false
  }
}

export interface PowerFlowDeps {
  probe: () => Promise<boolean>
  reload: () => void
  onPhase: (p: PowerPhase) => void
}

export interface PowerFlowController {
  startShutdown(): void
  startRestart(): void
  startAppUpdating(): void
  reset(): void
}

export function createPowerFlow(deps: PowerFlowDeps): PowerFlowController {
  let ping: ReturnType<typeof setInterval> | null = null
  let fallback: ReturnType<typeof setTimeout> | null = null
  let delay: ReturnType<typeof setTimeout> | null = null
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  let fails = 0
  let sawOffline = false
  let settled = false   // done / offline / fallback 之后不再接受相位变化

  function clearAll() {
    if (ping) clearInterval(ping)
    if (fallback) clearTimeout(fallback)
    if (delay) clearTimeout(delay)
    if (reloadTimer) clearTimeout(reloadTimer)
    ping = fallback = delay = reloadTimer = null
  }

  function settle(p: PowerPhase) {
    if (settled) return
    settled = true
    clearAll()
    deps.onPhase(p)
  }

  function reset() {
    clearAll()
    fails = 0
    sawOffline = false
    settled = false
    deps.onPhase('idle')
  }

  function startShutdown() {
    clearAll()
    fails = 0; sawOffline = false; settled = false
    deps.onPhase('shutting')
    fallback = setTimeout(() => settle('offline'), SHUTDOWN_FALLBACK_MS)
    ping = setInterval(async () => {
      const alive = await deps.probe()
      if (settled) return
      if (alive) { fails = 0; return }
      fails++
      if (fails >= SHUTDOWN_FAIL_THRESHOLD) settle('offline')
    }, PING_INTERVAL_MS)
  }

  /** 重启与应用更新共用「等下线 → 等上线 → done → reload」这段。 */
  function waitForComeback(assumeOffline: boolean) {
    sawOffline = assumeOffline
    fallback = setTimeout(() => settle('fallback'), RESTART_FALLBACK_MS)
    // Vue2 先等 5 秒再开始探活:重启命令下发到服务真的开始停,需要时间,
    // 太早探到"还活着"没有意义。
    delay = setTimeout(() => {
      ping = setInterval(async () => {
        const alive = await deps.probe()
        if (settled) return
        if (!alive) {
          if (!sawOffline) { sawOffline = true; deps.onPhase('reconnecting') }
          return
        }
        // 活着:只有先见过下线,才说明真的重启完成了
        if (!sawOffline) return
        settle('done')
        reloadTimer = setTimeout(() => deps.reload(), DONE_RELOAD_DELAY_MS)
      }, PING_INTERVAL_MS)
    }, RESTART_PING_DELAY_MS)
  }

  function startRestart() {
    clearAll()
    fails = 0; settled = false
    deps.onPhase('restarting')
    waitForComeback(false)
  }

  function startAppUpdating() {
    clearAll()
    fails = 0; settled = false
    deps.onPhase('appUpdating')
    // Vue2 startAppUpdate 在 5 秒后直接把 restartServerOffline 置真 ——
    // 应用更新一定会重启服务,所以不必先观察到下线。
    waitForComeback(true)
  }

  return { startShutdown, startRestart, startAppUpdating, reset }
}
