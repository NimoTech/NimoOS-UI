## Task 9: 电源流(关机 / 重启 + 6 状态浮层)

**⚠️ 自查绝对不要点关机或重启** —— 会真的关掉/重启这台开发机。相位机全部逻辑都在 `powerFlow.ts` 里用假定时器单测;界面只自查两个按钮和确认弹窗的形状。

**Files:**
- Create: `src/settings/util/powerFlow.ts`
- Create: `src/settings/util/powerFlow.test.ts`
- Create: `src/settings/components/PowerOverlay.vue`
- Create: `src/settings/components/PowerOverlay.test.ts`
- Create: `src/settings/components/PowerFlow.vue`
- Create: `src/settings/components/PowerFlow.test.ts`
- Modify: `src/settings/components/SettingsShell.vue`(**本期唯一一次碰它**:`.set-rail-foot` 里塞 `<PowerFlow />`)
- Modify: `src/settings/components/SettingsShell.test.ts`

**Interfaces:**
- Consumes: `service.sys.power('off' | 'restart')`、`AlertDialog.vue`、`Dialog.vue`、Task 3 的 `.set-btn` / `.set-warn`
- Produces:
  ```ts
  export type PowerPhase =
    | 'idle' | 'shutting' | 'offline'
    | 'restarting' | 'reconnecting' | 'done' | 'fallback' | 'appUpdating'
  export const PING_INTERVAL_MS = 3000
  export const SHUTDOWN_FALLBACK_MS = 60_000
  export const RESTART_FALLBACK_MS = 180_000
  export const RESTART_PING_DELAY_MS = 5_000
  export const DONE_RELOAD_DELAY_MS = 1_500
  export const SHUTDOWN_FAIL_THRESHOLD = 2
  /** 探活:拿到任何 HTTP 响应(含 401)都算「服务器活着」,只有网络错误才算下线。 */
  export function probeAlive(fetchImpl?: typeof fetch): Promise<boolean>
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
  export function createPowerFlow(deps: PowerFlowDeps): PowerFlowController
  ```

- [ ] **Step 1: 写 `powerFlow.ts` 的失败测试**

`src/settings/util/powerFlow.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createPowerFlow, probeAlive,
  PING_INTERVAL_MS, SHUTDOWN_FALLBACK_MS, RESTART_FALLBACK_MS,
  RESTART_PING_DELAY_MS, DONE_RELOAD_DELAY_MS,
  type PowerPhase,
} from './powerFlow'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

function harness(probeSeq: boolean[]) {
  const phases: PowerPhase[] = []
  const reload = vi.fn()
  let i = 0
  const probe = vi.fn(async () => probeSeq[Math.min(i++, probeSeq.length - 1)])
  const c = createPowerFlow({ probe, reload, onPhase: (p) => phases.push(p) })
  return { c, phases, reload, probe }
}

describe('probeAlive(移植纪律 #6)', () => {
  it('200 → 活着', async () => {
    expect(await probeAlive(vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch)).toBe(true)
  })
  it('401 也算活着 —— 服务器能回 401 说明它起来了', async () => {
    expect(await probeAlive(vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch)).toBe(true)
  })
  it('500 也算活着', async () => {
    expect(await probeAlive(vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch)).toBe(true)
  })
  it('网络错误 → 下线', async () => {
    expect(await probeAlive(vi.fn(async () => { throw new TypeError('Failed to fetch') }) as unknown as typeof fetch)).toBe(false)
  })
})

describe('关机流(对位 Vue2 onShutdownConfirmed L1779-1811)', () => {
  it('立刻进 shutting', () => {
    const { c, phases } = harness([true])
    c.startShutdown()
    expect(phases).toEqual(['shutting'])
  })

  it('连续 2 次探活失败才判定 offline(单次失败可能只是抖动)', async () => {
    const { c, phases } = harness([false])
    c.startShutdown()
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS)
    expect(phases).toEqual(['shutting'])
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS)
    expect(phases).toEqual(['shutting', 'offline'])
  })

  it('中间探活成功会把失败计数清零', async () => {
    const { c, phases } = harness([false, true, false])
    c.startShutdown()
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS * 3)
    expect(phases).toEqual(['shutting'])   // 失败-成功-失败 → 从未连续两次
  })

  it('60 秒兜底也进 offline(机器没回应探活的极端情况)', async () => {
    const { c, phases } = harness([true])
    c.startShutdown()
    await vi.advanceTimersByTimeAsync(SHUTDOWN_FALLBACK_MS)
    expect(phases).toEqual(['shutting', 'offline'])
  })

  it('判定 offline 后停止探活(不继续打已关机的机器)', async () => {
    const { c, probe } = harness([false])
    c.startShutdown()
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS * 2)
    const n = probe.mock.calls.length
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS * 5)
    expect(probe.mock.calls.length).toBe(n)
  })
})

describe('重启流(对位 Vue2 onRestartConfirmed L1816-1861)', () => {
  it('立刻进 restarting', () => {
    const { c, phases } = harness([true])
    c.startRestart()
    expect(phases).toEqual(['restarting'])
  })

  it('前 5 秒不探活(给重启命令生效的时间)', async () => {
    const { c, probe } = harness([true])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS - 1)
    expect(probe).not.toHaveBeenCalled()
  })

  it('探活失败一次即进 reconnecting(重启不像关机,下线是必经态)', async () => {
    const { c, phases } = harness([false])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS)
    expect(phases).toEqual(['restarting', 'reconnecting'])
  })

  it('必须先下线再上线才算重启完成(否则只是命令还没生效)', async () => {
    const { c, phases, reload } = harness([true, true, true])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS * 3)
    expect(phases).toEqual(['restarting'])   // 一直在线 → 不判完成
    expect(reload).not.toHaveBeenCalled()
  })

  it('下线再上线 → done,并在 1.5 秒后 reload', async () => {
    const { c, phases, reload } = harness([false, true])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS * 2)
    expect(phases).toEqual(['restarting', 'reconnecting', 'done'])
    expect(reload).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(DONE_RELOAD_DELAY_MS)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('180 秒仍没回来 → fallback', async () => {
    const { c, phases } = harness([false])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_FALLBACK_MS)
    expect(phases[phases.length - 1]).toBe('fallback')
  })

  it('fallback 后停止探活与兜底表', async () => {
    const { c, probe, reload } = harness([false])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_FALLBACK_MS)
    const n = probe.mock.calls.length
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS * 10)
    expect(probe.mock.calls.length).toBe(n)
    expect(reload).not.toHaveBeenCalled()
  })

  it('done 之后不再有多余的相位变化(不会又滑回 reconnecting)', async () => {
    const { c, phases } = harness([false, true, false, false])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS * 6)
    expect(phases).toEqual(['restarting', 'reconnecting', 'done'])
  })
})

describe('应用更新流(对位 Vue2 startAppUpdate L1501-1534)', () => {
  it('进 appUpdating,5 秒后直接当作已下线开始等回来', async () => {
    const { c, phases } = harness([true])
    c.startAppUpdating()
    expect(phases).toEqual(['appUpdating'])
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS)
    expect(phases).toEqual(['appUpdating', 'done'])
  })
})

describe('reset', () => {
  it('清掉所有定时器并回 idle', async () => {
    const { c, phases, probe, reload } = harness([false])
    c.startRestart()
    c.reset()
    expect(phases[phases.length - 1]).toBe('idle')
    const n = probe.mock.calls.length
    await vi.advanceTimersByTimeAsync(RESTART_FALLBACK_MS * 2)
    expect(probe.mock.calls.length).toBe(n)
    expect(reload).not.toHaveBeenCalled()
  })

  it('reset 后可以重新开一轮', async () => {
    const { c, phases } = harness([false])
    c.startShutdown(); c.reset(); c.startShutdown()
    expect(phases).toEqual(['shutting', 'idle', 'shutting'])
  })
})
```

- [ ] **Step 2: 跑测试确认失败,然后实现 `powerFlow.ts`**

```bash
pnpm test src/settings/util/powerFlow.test.ts 2>&1 | tail -12
```

```ts
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
    for (const [t, clear] of [
      [ping, clearInterval], [fallback, clearTimeout],
      [delay, clearTimeout], [reloadTimer, clearTimeout],
    ] as const) if (t) (clear as (h: unknown) => void)(t)
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
```

> `settle()` 里的 `clearAll()` 用了一个 `for…of` 配对表,若实现时觉得不清晰,直接写四行 `if (ping) clearInterval(ping)` 也行 —— 行为一致,别为了简洁牺牲可读性。

- [ ] **Step 3: 写 `PowerFlow.vue` 的失败测试**

`src/settings/components/PowerFlow.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'

const powerCalls: string[] = []
vi.mock('@nimotech/nimoos-service', () => ({
  service: { sys: { power: async (a: string) => { powerCalls.push(a) } } },
}))

import PowerFlow from './PowerFlow.vue'
import PowerOverlay from './PowerOverlay.vue'
import AlertDialog from '../../components/ui/AlertDialog.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const mountIt = () => mount(PowerFlow, { global: { plugins: [i18n] } })

beforeEach(() => {
  setActivePinia(createPinia())
  powerCalls.length = 0
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down') }))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('PowerFlow 按钮与确认', () => {
  it('渲染关机与重启两个按钮', () => {
    const w = mountIt()
    expect(w.find('.pf-shutdown').exists()).toBe(true)
    expect(w.find('.pf-restart').exists()).toBe(true)
  })

  it('两个按钮都有无障碍名(纯图标按钮)', () => {
    const w = mountIt()
    expect(w.find('.pf-shutdown').attributes('aria-label')).toBe('关机')
    expect(w.find('.pf-restart').attributes('aria-label')).toBe('重启')
  })

  it('点关机先弹确认,**未确认前不下发**(对位 Vue2 power() 只是开确认框)', async () => {
    const w = mountIt()
    await w.find('.pf-shutdown').trigger('click')
    expect(w.findAllComponents(AlertDialog)[0].props('open')).toBe(true)
    expect(powerCalls).toEqual([])
  })

  it('确认关机才 PUT off,并显示 shutting 浮层', async () => {
    const w = mountIt()
    await w.find('.pf-shutdown').trigger('click')
    w.findAllComponents(AlertDialog)[0].vm.$emit('confirm')
    await flushPromises()
    expect(powerCalls).toEqual(['off'])
    expect(w.text()).toContain('正在关机')
  })

  it('取消关机:不下发、无浮层', async () => {
    const w = mountIt()
    await w.find('.pf-shutdown').trigger('click')
    w.findAllComponents(AlertDialog)[0].vm.$emit('update:open', false)
    await flushPromises()
    expect(powerCalls).toEqual([])
    expect(w.text()).not.toContain('正在关机')
  })

  it('确认重启才 PUT restart', async () => {
    const w = mountIt()
    await w.find('.pf-restart').trigger('click')
    w.findAllComponents(AlertDialog)[1].vm.$emit('confirm')
    await flushPromises()
    expect(powerCalls).toEqual(['restart'])
    expect(w.text()).toContain('正在重启')
  })

  it('power 接口报错也照样进浮层(Vue2 .catch(()=>{}) —— 关机请求常常来不及回响应)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'power').mockRejectedValueOnce(new Error('boom'))
    const w = mountIt()
    await w.find('.pf-shutdown').trigger('click')
    w.findAllComponents(AlertDialog)[0].vm.$emit('confirm')
    await flushPromises()
    expect(w.text()).toContain('正在关机')
  })
})

// 六个浮层态直接挂纯展示组件 PowerOverlay —— 它只吃一个 phase prop,
// 不需要在 PowerFlow 上开 __setPhase 这类只为测试存在的生产接口。
describe('PowerOverlay 六个浮层态', () => {
  const mountOverlay = (phase: string) =>
    mount(PowerOverlay, { props: { phase }, global: { plugins: [i18n] } })

  it('shutting', () => expect(mountOverlay('shutting').text()).toContain('请等待约 30 秒'))
  it('offline', () => expect(mountOverlay('offline').text()).toContain('可以安全断电'))
  it('restarting', () => expect(mountOverlay('restarting').text()).toContain('正在发送重启指令'))
  it('reconnecting', () => expect(mountOverlay('reconnecting').text()).toContain('自动重新连接'))
  it('done', () => expect(mountOverlay('done').text()).toContain('正在跳转'))
  it('appUpdating', () => expect(mountOverlay('appUpdating').text()).toContain('系统正在更新'))

  it('每个态的标题都有译文(没渲染出裸 key)', () => {
    for (const ph of ['shutting', 'offline', 'restarting', 'reconnecting', 'done', 'appUpdating', 'fallback']) {
      expect(mountOverlay(ph).find('.pf-card-title').text()).not.toMatch(/^settings/)
    }
  })

  it('fallback 带警示色与刷新按钮', () => {
    const w = mountOverlay('fallback')
    expect(w.find('.set-warn').exists()).toBe(true)
    expect(w.find('.pf-reload').exists()).toBe(true)
  })

  it('offline 与 fallback 可关闭,点关闭 emit close(其余等待态不给关闭按钮)', async () => {
    for (const ph of ['offline', 'fallback']) {
      const w = mountOverlay(ph)
      expect(w.find('.pf-close').exists()).toBe(true)
      await w.find('.pf-close').trigger('click')
      expect(w.emitted('close')).toHaveLength(1)
    }
    for (const ph of ['shutting', 'restarting', 'reconnecting', 'done', 'appUpdating']) {
      expect(mountOverlay(ph).find('.pf-close').exists()).toBe(false)
    }
  })

  it('idle 时什么都不渲染', () => {
    expect(mountOverlay('idle').find('.pf-overlay').exists()).toBe(false)
  })
})

describe('PowerFlow 清理', () => {
  it('卸载时停掉相位机的定时器', async () => {
    const w = mountIt()
    await w.find('.pf-shutdown').trigger('click')
    w.findAllComponents(AlertDialog)[0].vm.$emit('confirm')
    await flushPromises()
    w.unmount()
    const before = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length
    await vi.advanceTimersByTimeAsync(3000 * 10)
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before)
  })
})
```

- [ ] **Step 4a: 实现 `PowerOverlay.vue`(纯展示,只吃一个 phase)**

```vue
<script setup lang="ts">
// 电源状态浮层,对位 Vue2 SettingsPanel.vue L714-790 的 6 个态。
// 拆成纯展示组件的理由:相位由父组件的相位机驱动,这里只做「相位 → 文案 + 可否关闭」的映射,
// 于是 6 个态能直接挂载断言,不必在 PowerFlow 上开只为测试存在的接口。
//
// 自绘而不用 ui/Dialog.vue:等待类相位不允许 Esc / 点外部关闭,
// 而 reka 的 DialogRoot 默认允许两者,逐个关掉不如自绘清楚。
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PowerPhase } from '../util/powerFlow'
import '../styles/settings.css'

const props = defineProps<{ phase: PowerPhase }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

// 含 idle 一起给键(值为空串)。模板里的 v-if="phase !== 'idle'" **不会**为
// TITLE[phase] 这种索引访问收窄类型,写成 Exclude<PowerPhase,'idle'> 会让 vue-tsc 报错。
const TITLE: Record<PowerPhase, string> = {
  idle: '',
  shutting: 'settingsPowerShutting', offline: 'settingsPowerOffline',
  restarting: 'settingsPowerRestarting', reconnecting: 'settingsPowerReconnecting',
  done: 'settingsPowerBack', appUpdating: 'settingsPowerAppUpdating',
  fallback: 'settingsPowerFallback',
}
const MSG: Record<PowerPhase, string> = {
  idle: '',
  shutting: 'settingsPowerShuttingMsg', offline: 'settingsPowerOfflineMsg',
  restarting: 'settingsPowerRestartingMsg', reconnecting: 'settingsPowerReconnectingMsg',
  done: 'settingsPowerBackMsg', appUpdating: 'settingsPowerAppUpdatingMsg',
  fallback: 'settingsPowerFallbackMsg',
}

// 等待类相位不给关闭按钮(对位 Vue2 :can-cancel="false" —— 只有 offline / fallback 有 delete 按钮)
const CLOSABLE: readonly PowerPhase[] = ['offline', 'fallback']
const closable = computed(() => CLOSABLE.includes(props.phase))

function reloadPage() {
  window.location.reload()
}
</script>

<template>
  <div v-if="phase !== 'idle'" class="pf-overlay">
    <div class="pf-card">
      <header class="pf-card-head">
        <h2 class="pf-card-title" :class="{ 'set-warn': phase === 'fallback' }">
          {{ t(TITLE[phase]) }}
        </h2>
        <button
          v-if="closable"
          class="pf-close"
          type="button"
          :aria-label="t('settingsCancel')"
          @click="emit('close')"
        >×</button>
      </header>
      <p class="pf-card-msg">{{ t(MSG[phase]) }}</p>
      <footer v-if="phase === 'fallback'" class="pf-card-foot">
        <button class="set-btn primary pf-reload" type="button" @click="reloadPage">
          {{ t('settingsRefresh') }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.pf-overlay {
  position: fixed; inset: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: center;
  background: var(--overlay-bg); backdrop-filter: var(--overlay-blur);
}
.pf-card {
  width: min(360px, 88vw); padding: 20px; border-radius: 18px;
  background: var(--popup-bg); border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow-hi); color: var(--fg);
}
.pf-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.pf-card-title { margin: 0 0 10px; font-size: 16px; font-weight: 600; }
.pf-close {
  border: 0; background: none; color: var(--fg-faint);
  font-size: 20px; line-height: 1; cursor: pointer; padding: 0; font-family: inherit;
}
.pf-close:hover { color: var(--fg); }
.pf-card-msg { margin: 0; font-size: 14px; color: var(--fg-muted); }
.pf-card-foot { display: flex; justify-content: flex-end; margin-top: 18px; }
</style>
```

- [ ] **Step 4b: 实现 `PowerFlow.vue`(按钮 + 确认 + 驱动相位机)**

```vue
<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue 的侧栏电源块(L33-46)+ 两个确认弹窗(L711-712)
// + 电源状态浮层(L714-790,6 个态)。相位机在 util/powerFlow.ts,这里只管界面。
import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import AlertDialog from '../../components/ui/AlertDialog.vue'
import PowerOverlay from './PowerOverlay.vue'
import { createPowerFlow, probeAlive, type PowerPhase } from '../util/powerFlow'
import '../styles/settings.css'

const { t } = useI18n()

const phase = ref<PowerPhase>('idle')
const askShutdown = ref(false)
const askRestart = ref(false)

const flow = createPowerFlow({
  probe: () => probeAlive(),
  reload: () => window.location.reload(),
  onPhase: (p) => { phase.value = p },
})
onBeforeUnmount(() => flow.reset())

async function doShutdown() {
  askShutdown.value = false
  flow.startShutdown()
  // Vue2 是 .catch(()=>{}) —— 关机请求常常在响应回来之前连接就断了,
  // 报错不代表没关成功,所以不因此中断相位机。
  try { await service.sys.power('off') } catch { /* 见上 */ }
}

async function doRestart() {
  askRestart.value = false
  flow.startRestart()
  try { await service.sys.power('restart') } catch { /* 同上 */ }
}

function close() { flow.reset() }
</script>

<template>
  <div class="pf">
    <button class="pf-btn pf-shutdown" type="button" :aria-label="t('settingsShutdown')" @click="askShutdown = true">
      ⏻
    </button>
    <button class="pf-btn pf-restart" type="button" :aria-label="t('settingsRestart')" @click="askRestart = true">
      ⟳
    </button>

    <AlertDialog
      :open="askShutdown"
      :title="t('settingsShutdownConfirmTitle')"
      :message="t('settingsShutdownConfirmMsg')"
      :confirm-text="t('settingsShutdown')"
      :cancel-text="t('settingsCancel')"
      destructive
      @update:open="askShutdown = $event"
      @confirm="doShutdown"
    />
    <AlertDialog
      :open="askRestart"
      :title="t('settingsRestartConfirmTitle')"
      :message="t('settingsRestartConfirmMsg')"
      :confirm-text="t('settingsRestart')"
      :cancel-text="t('settingsCancel')"
      @update:open="askRestart = $event"
      @confirm="doRestart"
    />

    <PowerOverlay :phase="phase" @close="close" />
  </div>
</template>

<style scoped>
.pf { display: flex; align-items: center; gap: 8px; padding: 8px 4px; }
.pf-btn {
  width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--chip-border); border-radius: 50%;
  background: var(--chip-bg); color: var(--fg-muted);
  font-size: 16px; cursor: pointer; font-family: inherit;
}
.pf-btn:hover { background: var(--chip-bg-hi); color: var(--fg); }
/* 关机是破坏性动作,hover 给危险色提示(Vue2 的 .power-item-btn.attention 同理) */
.pf-shutdown:hover { color: var(--remove-fg); border-color: var(--remove-fg); }
</style>
```

- [ ] **Step 5: 把 `PowerFlow` 塞进 `SettingsShell` 的 `.set-rail-foot`**

`src/settings/components/SettingsShell.vue` —— **本期唯一一次改它**,改动尽量小(它是将来合并 master 的接触面):

1. 顶部 import 加一行:`import PowerFlow from './PowerFlow.vue'`
2. 把 P0 留的占位替换掉:
```vue
      <!-- P0 留的占位,P1 填入电源流(spec §5.1) -->
      <div class="set-rail-foot"><PowerFlow /></div>
```

在 `src/settings/components/SettingsShell.test.ts` 追加:

```ts
it('侧栏底部有电源按钮(P0 的空容器已填)', () => {
  const w = mountShell()   // 沿用该文件既有的挂载辅助
  expect(w.find('.set-rail-foot .pf-shutdown').exists()).toBe(true)
  expect(w.find('.set-rail-foot .pf-restart').exists()).toBe(true)
})
```

> 若 `SettingsShell.test.ts` 原本没 mock 共享包,加入 `PowerFlow` 后会引入 `service.sys.power` 的 import。给该测试文件补上最小 mock:
> ```ts
> vi.mock('@nimotech/nimoos-service', () => ({ service: { sys: { power: async () => {} } } }))
> ```

- [ ] **Step 6: 跑测试确认通过 + 任务门 + 提交**

```bash
pnpm test src/settings 2>&1 | tail -8
pnpm test 2>&1 | tail -8
pnpm exec vue-tsc --noEmit
git status --short
git add src/settings/util/powerFlow.ts src/settings/util/powerFlow.test.ts \
        src/settings/components/PowerOverlay.vue src/settings/components/PowerOverlay.test.ts \
        src/settings/components/PowerFlow.vue src/settings/components/PowerFlow.test.ts
git commit src/settings/util/powerFlow.ts src/settings/util/powerFlow.test.ts \
           src/settings/components/PowerOverlay.vue src/settings/components/PowerOverlay.test.ts \
           src/settings/components/PowerFlow.vue src/settings/components/PowerFlow.test.ts \
           src/settings/components/SettingsShell.vue src/settings/components/SettingsShell.test.ts \
  -m "feat(settings): 侧栏电源流 + 6 状态浮层(SP9-P1)

- 相位机抽成不依赖 Vue 的控制器,用假定时器把「下线→上线」时序真的测出来
- 移植纪律 #6:探活改裸 fetch,任何 HTTP 响应(含 401)都算服务器活着
  (Vue2 走带认证拦截器的 axios,重启期间一个 401 就会跳登录页打断流程)
- 关机连续 2 次探活失败才判下线;重启必须先见下线再见上线才算完成
- 等待类相位不给关闭按钮,只有 offline / fallback 可关
- 浮层拆成纯展示 PowerOverlay(只吃 phase),6 个态可直接挂载断言
- 浮层自绘不用 reka Dialog:等待态不允许 Esc/点外关闭"
```

---

