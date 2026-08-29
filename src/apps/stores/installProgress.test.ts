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
  localStorage.clear()
  svc.compose.list.mockResolvedValue({})
  svc.compose.get.mockResolvedValue(undefined)
  busOn.mockClear()
  vi.useFakeTimers()
})
afterEach(() => { vi.useRealTimers() })

describe('installProgress refresh recovery (localStorage persistence)', () => {
  it('track/progress persisted to disk; new store instance (simulating full page refresh) recovers tasks and continues to consume progress events', () => {
    const s = useInstallProgressStore()
    s.track('jellyfin', 'Jellyfin', 'i.png')
    s.onEvent('app:install-progress', { 'app:name': 'jellyfin', 'app:progress': '42' })
    // simulate a refresh: brand-new pinia + brand-new store, only localStorage remains
    setActivePinia(createPinia())
    const s2 = useInstallProgressStore()
    expect(s2.tasks['jellyfin']).toMatchObject({ title: 'Jellyfin', icon: 'i.png', percent: 42, state: 'installing' })
    // after restore it is a tracked task: progress events are no longer dropped as strangers by D5
    s2.onEvent('app:install-progress', { 'app:name': 'jellyfin', 'app:progress': '77' })
    expect(s2.tasks['jellyfin'].percent).toBe(77)
  })

  it('recovered tasks re-arm watchdog: installation complete (compose.get hit) → finish clears card and persistent storage', async () => {
    const s = useInstallProgressStore()
    s.track('jellyfin')
    setActivePinia(createPinia())
    svc.compose.get.mockResolvedValue({ status: 'running' })
    const s2 = useInstallProgressStore()
    const installed = useInstalledAppsStore()
    vi.spyOn(installed, 'refresh').mockResolvedValue()
    await vi.advanceTimersByTimeAsync(WATCHDOG_MS)
    expect(s2.tasks['jellyfin']).toBeUndefined()
    expect(JSON.parse(localStorage.getItem('nimoos:install-progress') || 'null')).toEqual({})
  })

  it('error tasks also recover on refresh (can dismiss to clear storage); malformed JSON silently ignored', () => {
    const s = useInstallProgressStore()
    s.track('a')
    s.onEvent('app:install-error', { 'app:name': 'a', message: 'boom' })
    setActivePinia(createPinia())
    const s2 = useInstallProgressStore()
    expect(s2.tasks['a']).toMatchObject({ state: 'error', message: 'boom' })
    s2.dismiss('a')
    expect(JSON.parse(localStorage.getItem('nimoos:install-progress') || 'null')).toEqual({})

    localStorage.setItem('nimoos:install-progress', '{oops')
    setActivePinia(createPinia())
    expect(useInstallProgressStore().tasks).toEqual({})
  })
})

describe('installProgress store', () => {
  it('setup immediately subscribes to 4 install events (app-level = background continues)', () => {
    useInstallProgressStore()
    const evs = busOn.mock.calls.map((c) => c[0])
    expect(evs).toEqual(expect.arrayContaining([
      'app:install-begin', 'app:install-progress', 'app:install-end', 'app:install-error',
    ]))
  })

  it('track creates task; progress events clamped to 0-100 range', () => {
    const s = useInstallProgressStore()
    s.track('jellyfin', 'Jellyfin', 'i.png')
    expect(s.tasks['jellyfin']).toMatchObject({ percent: 0, state: 'installing', title: 'Jellyfin' })
    s.onEvent('app:install-progress', { 'app:name': 'jellyfin', 'app:progress': '64' })
    expect(s.tasks['jellyfin'].percent).toBe(64)
    s.onEvent('app:install-progress', { 'app:name': 'jellyfin', 'app:progress': '400' })
    expect(s.tasks['jellyfin'].percent).toBe(100)
    s.onEvent('app:install-progress', { 'app:name': 'jellyfin', 'app:progress': 'garbage' })
    expect(s.tasks['jellyfin'].percent).toBe(100) // unparseable → keep previous value
  })

  it('D5: untracked progress always ignored (update flow reuses the same event)', () => {
    const s = useInstallProgressStore()
    s.onEvent('app:install-progress', { 'app:name': 'syncthing', 'app:progress': '30' })
    expect(s.tasks['syncthing']).toBeUndefined()
  })

  it('begin event creates task for untracked name (visible on other endpoints), app:title JSON parsed tolerantly', () => {
    const s = useInstallProgressStore()
    s.onEvent('app:install-begin', { 'app:name': 'navidrome', 'app:title': '{"en_us":"Navidrome"}', 'app:icon': 'n.png' })
    expect(s.tasks['navidrome']).toMatchObject({ title: 'Navidrome', icon: 'n.png', state: 'installing' })
    s.onEvent('app:install-begin', { 'app:name': 'bad', 'app:title': '{oops' })
    expect(s.tasks['bad'].title).toBe('bad') // parse failure falls back to name
  })

  it('end: delete task + refresh installed app list + appstore installed optimistic push', async () => {
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

  it('end refreshes even for untracked name (fallback for missed begin)', () => {
    const s = useInstallProgressStore()
    const installed = useInstalledAppsStore()
    const spy = vi.spyOn(installed, 'refresh').mockResolvedValue()
    s.onEvent('app:install-end', { 'app:name': 'ghost' })
    expect(spy).toHaveBeenCalled()
  })

  it('error: task transitions to error state with message, can be dismissed', () => {
    const s = useInstallProgressStore()
    s.track('jellyfin')
    s.onEvent('app:install-error', { 'app:name': 'jellyfin', message: 'pull failed' })
    expect(s.tasks['jellyfin']).toMatchObject({ state: 'error', message: 'pull failed' })
    s.dismiss('jellyfin')
    expect(s.tasks['jellyfin']).toBeUndefined()
  })

  it('watchdog: 60s silent probe of compose.get — if exists, converge per end', async () => {
    const s = useInstallProgressStore()
    const installed = useInstalledAppsStore()
    vi.spyOn(installed, 'refresh').mockResolvedValue()
    svc.compose.get.mockResolvedValue({ status: 'running' })
    s.track('jellyfin')
    await vi.advanceTimersByTimeAsync(WATCHDOG_MS)
    expect(svc.compose.get).toHaveBeenCalledWith('jellyfin')
    expect(s.tasks['jellyfin']).toBeUndefined()
  })

  it('watchdog: 5 consecutive probes yield nothing → error state (message empty, UI uses i18n fallback)', async () => {
    const s = useInstallProgressStore()
    svc.compose.get.mockResolvedValue(undefined)
    s.track('jellyfin')
    await vi.advanceTimersByTimeAsync(WATCHDOG_MS * WATCHDOG_MAX_PROBES)
    expect(s.tasks['jellyfin']).toMatchObject({ state: 'error', message: '' })
  })

  it('progress event resets watchdog probe counter', async () => {
    const s = useInstallProgressStore()
    svc.compose.get.mockResolvedValue(undefined)
    s.track('jellyfin')
    await vi.advanceTimersByTimeAsync(WATCHDOG_MS * (WATCHDOG_MAX_PROBES - 1))
    s.onEvent('app:install-progress', { 'app:name': 'jellyfin', 'app:progress': '50' })
    await vi.advanceTimersByTimeAsync(WATCHDOG_MS * (WATCHDOG_MAX_PROBES - 1))
    expect(s.tasks['jellyfin'].state).toBe('installing') // counter was reset by progress, not yet at 5
  })

  // --- Task 3 fixes (4 review findings) ---

  it('Fix1: begin revives error state tasks — back to installing, percent 0, message cleared', () => {
    const s = useInstallProgressStore()
    s.track('jellyfin', 'Jellyfin', 'i.png')
    s.onEvent('app:install-progress', { 'app:name': 'jellyfin', 'app:progress': '77' })
    s.onEvent('app:install-error', { 'app:name': 'jellyfin', message: 'pull failed' })
    expect(s.tasks['jellyfin']).toMatchObject({ state: 'error', message: 'pull failed' })
    s.onEvent('app:install-begin', { 'app:name': 'jellyfin', 'app:title': 'Jellyfin' })
    expect(s.tasks['jellyfin']).toMatchObject({ state: 'installing', percent: 0, message: '' })
  })

  it('Fix1: begin leaves already-installing task state unchanged (only extends watchdog)', () => {
    const s = useInstallProgressStore()
    s.track('jellyfin', 'Jellyfin', 'i.png')
    s.onEvent('app:install-progress', { 'app:name': 'jellyfin', 'app:progress': '50' })
    s.onEvent('app:install-begin', { 'app:name': 'jellyfin' })
    expect(s.tasks['jellyfin']).toMatchObject({ state: 'installing', percent: 50, title: 'Jellyfin' })
  })

  it('Fix1(Minor#2): begin resets probe counter — after 4 probes, begin is issued, then 4 more probes should not reach 5-probe error', async () => {
    const s = useInstallProgressStore()
    svc.compose.get.mockResolvedValue(undefined)
    s.track('jellyfin')
    await vi.advanceTimersByTimeAsync(WATCHDOG_MS * (WATCHDOG_MAX_PROBES - 1))
    expect(s.tasks['jellyfin'].state).toBe('installing')
    s.onEvent('app:install-begin', { 'app:name': 'jellyfin' })
    await vi.advanceTimersByTimeAsync(WATCHDOG_MS * (WATCHDOG_MAX_PROBES - 1))
    expect(s.tasks['jellyfin'].state).toBe('installing') // counter was reset by begin, not yet at 5
  })

  it('Fix2: dismiss vs in-flight probe race condition — after resolve settles, task does not revive, does not trigger finish side effects, does not reschedule new probe', async () => {
    const s = useInstallProgressStore()
    const installed = useInstalledAppsStore()
    const store = useAppstoreStore()
    const refreshSpy = vi.spyOn(installed, 'refresh').mockResolvedValue()
    let resolveGet: (v: unknown) => void = () => {}
    const callsBefore = svc.compose.get.mock.calls.length
    svc.compose.get.mockImplementation(() => new Promise((resolve) => { resolveGet = resolve }))
    s.track('jellyfin')
    await vi.advanceTimersByTimeAsync(WATCHDOG_MS) // trigger probe, compose.get stays pending
    expect(svc.compose.get.mock.calls.length - callsBefore).toBe(1)
    s.dismiss('jellyfin')
    // the in-flight probe settles with a truthy "installed" value — without re-reading tasks.value it would
    // mistakenly treat the task as still tracked and call finish(), causing refresh()/installed optimistic-push side effects (even though the user already dismissed it)
    resolveGet({ status: 'running' })
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(s.tasks['jellyfin']).toBeUndefined()
    expect(refreshSpy).not.toHaveBeenCalled()
    expect(store.installed).not.toContain('jellyfin')
    // and no dead key should be left behind to trigger further probing (degenerate case: a falsy settlement must not re-arm either)
    const callsAfterDismiss = svc.compose.get.mock.calls.length
    await vi.advanceTimersByTimeAsync(WATCHDOG_MS * 2)
    expect(svc.compose.get.mock.calls.length).toBe(callsAfterDismiss) // not re-armed
    expect(s.tasks['jellyfin']).toBeUndefined()
  })

  it('Fix3: probe network errors incur no penalty — compose.get continuously rejected, still installing after 5 probes', async () => {
    const s = useInstallProgressStore()
    svc.compose.get.mockRejectedValue(new Error('network down'))
    s.track('jellyfin')
    await vi.advanceTimersByTimeAsync(WATCHDOG_MS * WATCHDOG_MAX_PROBES)
    expect(s.tasks['jellyfin']).toMatchObject({ state: 'installing' })
  })
})
