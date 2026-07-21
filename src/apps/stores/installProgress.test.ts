import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const svc = vi.hoisted(() => ({
  compose: { list: vi.fn(), get: vi.fn() },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

const busOn = vi.hoisted(() => vi.fn((..._args: unknown[]) => () => {}))
vi.mock('../../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: busOn }) }))

import { useInstallProgressStore, WATCHDOG_MS, WATCHDOG_MAX_PROBES } from './installProgress'
import { useInstalledAppsStore } from './installedApps'
import { useAppstoreStore } from './appstore'

beforeEach(() => {
  setActivePinia(createPinia())
  svc.compose.list.mockResolvedValue({})
  svc.compose.get.mockResolvedValue(undefined)
  busOn.mockClear()
  vi.useFakeTimers()
})
afterEach(() => { vi.useRealTimers() })

describe('installProgress store', () => {
  it('setup 即订阅 4 个 install 事件(应用级=后台继续)', () => {
    useInstallProgressStore()
    const evs = busOn.mock.calls.map((c) => c[0])
    expect(evs).toEqual(expect.arrayContaining([
      'app:install-begin', 'app:install-progress', 'app:install-end', 'app:install-error',
    ]))
  })

  it('track 建任务;progress 事件夹紧 0-100 更新', () => {
    const s = useInstallProgressStore()
    s.track('jellyfin', 'Jellyfin', 'i.png')
    expect(s.tasks['jellyfin']).toMatchObject({ percent: 0, state: 'installing', title: 'Jellyfin' })
    s.onEvent('app:install-progress', { 'app:name': 'jellyfin', 'app:progress': '64' })
    expect(s.tasks['jellyfin'].percent).toBe(64)
    s.onEvent('app:install-progress', { 'app:name': 'jellyfin', 'app:progress': '400' })
    expect(s.tasks['jellyfin'].percent).toBe(100)
    s.onEvent('app:install-progress', { 'app:name': 'jellyfin', 'app:progress': 'garbage' })
    expect(s.tasks['jellyfin'].percent).toBe(100) // 不可解析 → 保持原值
  })

  it('D5:未跟踪的 progress 一律忽略(update 流复用同一事件)', () => {
    const s = useInstallProgressStore()
    s.onEvent('app:install-progress', { 'app:name': 'syncthing', 'app:progress': '30' })
    expect(s.tasks['syncthing']).toBeUndefined()
  })

  it('begin 事件对未跟踪 name 建任务(他端安装也可见),app:title JSON 容忍解析', () => {
    const s = useInstallProgressStore()
    s.onEvent('app:install-begin', { 'app:name': 'navidrome', 'app:title': '{"en_us":"Navidrome"}', 'app:icon': 'n.png' })
    expect(s.tasks['navidrome']).toMatchObject({ title: 'Navidrome', icon: 'n.png', state: 'installing' })
    s.onEvent('app:install-begin', { 'app:name': 'bad', 'app:title': '{oops' })
    expect(s.tasks['bad'].title).toBe('bad') // 解析失败退化 name
  })

  it('end:删任务 + 已装列表 refresh + 商店 installed 乐观 push', async () => {
    const s = useInstallProgressStore()
    const installed = useInstalledAppsStore()
    const store = useAppstoreStore()
    const spy = vi.spyOn(installed, 'refresh').mockResolvedValue()
    s.track('jellyfin')
    s.onEvent('app:install-end', { 'app:name': 'jellyfin' })
    expect(s.tasks['jellyfin']).toBeUndefined()
    expect(spy).toHaveBeenCalled()
    expect(store.installed).toContain('jellyfin')
  })

  it('end 对未跟踪 name 也 refresh(错过 begin 的兜底)', () => {
    const s = useInstallProgressStore()
    const installed = useInstalledAppsStore()
    const spy = vi.spyOn(installed, 'refresh').mockResolvedValue()
    s.onEvent('app:install-end', { 'app:name': 'ghost' })
    expect(spy).toHaveBeenCalled()
  })

  it('error:任务转 error 态带 message,可 dismiss', () => {
    const s = useInstallProgressStore()
    s.track('jellyfin')
    s.onEvent('app:install-error', { 'app:name': 'jellyfin', message: 'pull failed' })
    expect(s.tasks['jellyfin']).toMatchObject({ state: 'error', message: 'pull failed' })
    s.dismiss('jellyfin')
    expect(s.tasks['jellyfin']).toBeUndefined()
  })

  it('watchdog:60s 静默探测 compose.get——已存在则按 end 收敛', async () => {
    const s = useInstallProgressStore()
    const installed = useInstalledAppsStore()
    vi.spyOn(installed, 'refresh').mockResolvedValue()
    svc.compose.get.mockResolvedValue({ status: 'running' })
    s.track('jellyfin')
    await vi.advanceTimersByTimeAsync(WATCHDOG_MS)
    expect(svc.compose.get).toHaveBeenCalledWith('jellyfin')
    expect(s.tasks['jellyfin']).toBeUndefined()
  })

  it('watchdog:连续 5 轮探不到 → error 态(message 空,UI 用 i18n 兜底)', async () => {
    const s = useInstallProgressStore()
    svc.compose.get.mockResolvedValue(undefined)
    s.track('jellyfin')
    await vi.advanceTimersByTimeAsync(WATCHDOG_MS * WATCHDOG_MAX_PROBES)
    expect(s.tasks['jellyfin']).toMatchObject({ state: 'error', message: '' })
  })

  it('progress 事件重置 watchdog 探测计数', async () => {
    const s = useInstallProgressStore()
    svc.compose.get.mockResolvedValue(undefined)
    s.track('jellyfin')
    await vi.advanceTimersByTimeAsync(WATCHDOG_MS * (WATCHDOG_MAX_PROBES - 1))
    s.onEvent('app:install-progress', { 'app:name': 'jellyfin', 'app:progress': '50' })
    await vi.advanceTimersByTimeAsync(WATCHDOG_MS * (WATCHDOG_MAX_PROBES - 1))
    expect(s.tasks['jellyfin'].state).toBe('installing') // 计数已被 progress 重置,尚未到 5
  })

  // --- Task 3 修复(评审 4 洞) ---

  it('Fix1: begin 复活 error 态任务——回 installing、percent 0、message 清空', () => {
    const s = useInstallProgressStore()
    s.track('jellyfin', 'Jellyfin', 'i.png')
    s.onEvent('app:install-progress', { 'app:name': 'jellyfin', 'app:progress': '77' })
    s.onEvent('app:install-error', { 'app:name': 'jellyfin', message: 'pull failed' })
    expect(s.tasks['jellyfin']).toMatchObject({ state: 'error', message: 'pull failed' })
    s.onEvent('app:install-begin', { 'app:name': 'jellyfin', 'app:title': 'Jellyfin' })
    expect(s.tasks['jellyfin']).toMatchObject({ state: 'installing', percent: 0, message: '' })
  })

  it('Fix1: begin 对已 installing 任务状态不变(仅续期看门狗)', () => {
    const s = useInstallProgressStore()
    s.track('jellyfin', 'Jellyfin', 'i.png')
    s.onEvent('app:install-progress', { 'app:name': 'jellyfin', 'app:progress': '50' })
    s.onEvent('app:install-begin', { 'app:name': 'jellyfin' })
    expect(s.tasks['jellyfin']).toMatchObject({ state: 'installing', percent: 50, title: 'Jellyfin' })
  })

  it('Fix1(Minor#2): begin 重置探测计数——已探 4 轮后 begin,再过 4 轮不应到 5 轮 error', async () => {
    const s = useInstallProgressStore()
    svc.compose.get.mockResolvedValue(undefined)
    s.track('jellyfin')
    await vi.advanceTimersByTimeAsync(WATCHDOG_MS * (WATCHDOG_MAX_PROBES - 1))
    expect(s.tasks['jellyfin'].state).toBe('installing')
    s.onEvent('app:install-begin', { 'app:name': 'jellyfin' })
    await vi.advanceTimersByTimeAsync(WATCHDOG_MS * (WATCHDOG_MAX_PROBES - 1))
    expect(s.tasks['jellyfin'].state).toBe('installing') // 计数已被 begin 重置,尚未到 5
  })

  it('Fix2: dismiss 与飞行中 probe 竞态——resolve 落定后任务不复活、不触发 finish 副作用、不再排新探测', async () => {
    const s = useInstallProgressStore()
    const installed = useInstalledAppsStore()
    const store = useAppstoreStore()
    const refreshSpy = vi.spyOn(installed, 'refresh').mockResolvedValue()
    let resolveGet: (v: unknown) => void = () => {}
    const callsBefore = svc.compose.get.mock.calls.length
    svc.compose.get.mockImplementation(() => new Promise((resolve) => { resolveGet = resolve }))
    s.track('jellyfin')
    await vi.advanceTimersByTimeAsync(WATCHDOG_MS) // 触发 probe,compose.get 挂起
    expect(svc.compose.get.mock.calls.length - callsBefore).toBe(1)
    s.dismiss('jellyfin')
    // 飞行中的 probe 落定时收到「已安装」的真值——若不重新读取 tasks.value,会误当仍在跟踪
    // 而调用 finish() 产生 refresh()/installed 乐观 push 的副作用(任务明明已被用户 dismiss)
    resolveGet({ status: 'running' })
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(s.tasks['jellyfin']).toBeUndefined()
    expect(refreshSpy).not.toHaveBeenCalled()
    expect(store.installed).not.toContain('jellyfin')
    // 且不应遗留死 key 导致后续再探测(退化场景:falsy 落定也不得重新 arm)
    const callsAfterDismiss = svc.compose.get.mock.calls.length
    await vi.advanceTimersByTimeAsync(WATCHDOG_MS * 2)
    expect(svc.compose.get.mock.calls.length).toBe(callsAfterDismiss) // 没有被重新 arm
    expect(s.tasks['jellyfin']).toBeUndefined()
  })

  it('Fix3: probe 网络错不计罚——compose.get 连续 reject,5 轮后仍 installing', async () => {
    const s = useInstallProgressStore()
    svc.compose.get.mockRejectedValue(new Error('network down'))
    s.track('jellyfin')
    await vi.advanceTimersByTimeAsync(WATCHDOG_MS * WATCHDOG_MAX_PROBES)
    expect(s.tasks['jellyfin']).toMatchObject({ state: 'installing' })
  })
})
