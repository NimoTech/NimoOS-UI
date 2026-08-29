import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const svc = vi.hoisted(() => ({
  appstore: {
    listSources: vi.fn(),
    registerSource: vi.fn(),
    unregisterSource: vi.fn(),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// Capture event handlers so tests can trigger them manually
const busHandlers = vi.hoisted(() => new Map<string, (props: unknown) => void>())
const busOn = vi.hoisted(() =>
  vi.fn((ev: string, cb: (props: unknown) => void) => {
    busHandlers.set(ev, cb)
    return () => {}
  }),
)
vi.mock('../../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: busOn }) }))

import { useSourcesStore } from './sources'
import { useAppstoreStore } from './appstore'
import { useToast } from '../../stores/toast'

const SRC = { id: 0, url: 'https://github.com/NimoTech/NimoOS-AppStore/archive/main.zip', store_root: 'NimoOS-AppStore-main' }
const THIRD = { id: 1, url: 'https://github.com/WisdomSky/CasaOS-Coolstore/archive/main.zip' }

describe('sources store', () => {
  beforeEach(() => {
    localStorage.clear() // registering state is persisted; prevent cross-test pollution (fresh pinia runs the restore logic)
    setActivePinia(createPinia())
    busHandlers.clear()
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('load succeeds writes sources/loaded; fails sets error', async () => {
    const store = useSourcesStore()
    svc.appstore.listSources.mockResolvedValueOnce([SRC, THIRD])
    await store.load()
    expect(store.sources).toEqual([SRC, THIRD])
    expect(store.loaded).toBe(true)
    expect(store.error).toBe(false)

    svc.appstore.listSources.mockRejectedValueOnce(new Error('boom'))
    await store.load()
    expect(store.error).toBe(true)
  })

  it('register accepted: registeringUrl set to target, service receives trimmed URL', async () => {
    const store = useSourcesStore()
    svc.appstore.registerSource.mockResolvedValueOnce(undefined)
    await store.register('  https://example.com/store.zip  ')
    expect(svc.appstore.registerSource).toHaveBeenCalledWith('https://example.com/store.zip')
    expect(store.registeringUrl).toBe('https://example.com/store.zip')
  })

  it('register sync 409: throw backend message, registeringUrl resets', async () => {
    const store = useSourcesStore()
    svc.appstore.registerSource.mockRejectedValueOnce({
      response: { data: { message: 'appstore source already exists' } },
    })
    await expect(store.register('https://dup.example.com/s.zip')).rejects.toThrow('appstore source already exists')
    expect(store.registeringUrl).toBeNull()
  })

  it('register-end event converges: clear pending + refetch list + invalidate + toast', async () => {
    const store = useSourcesStore()
    const appstore = useAppstoreStore()
    const inv = vi.spyOn(appstore, 'invalidate')
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')

    svc.appstore.registerSource.mockResolvedValueOnce(undefined)
    await store.register('https://example.com/store.zip')
    svc.appstore.listSources.mockResolvedValueOnce([SRC, THIRD])

    busHandlers.get('app-store:register-end')!({})
    // All assertions verifiable synchronously: convergeRegistered synchronously clears pending / calls invalidate/toast, and load() synchronously initiates listSources
    expect(store.registeringUrl).toBeNull()
    expect(inv).toHaveBeenCalled()
    expect(show).toHaveBeenCalled()
    expect(svc.appstore.listSources).toHaveBeenCalled()
  })

  it('register-error event: clear pending + toast with backend message, no refetch', async () => {
    const store = useSourcesStore()
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    svc.appstore.registerSource.mockResolvedValueOnce(undefined)
    await store.register('https://bad.example.com/s.zip')

    busHandlers.get('app-store:register-error')!({ message: 'not an appstore' })
    expect(store.registeringUrl).toBeNull()
    expect(show).toHaveBeenCalledWith(expect.stringContaining('not an appstore'), expect.any(Number))
    expect(svc.appstore.listSources).not.toHaveBeenCalled()
  })

  it('concurrent guard: while registration in flight, re-calling register() directly rejects, no second service call, in-flight URL not cleared', async () => {
    const store = useSourcesStore()
    svc.appstore.registerSource.mockResolvedValueOnce(undefined)
    await store.register('https://a.example.com/store.zip')
    expect(store.registeringUrl).toBe('https://a.example.com/store.zip')

    await expect(store.register('https://b.example.com/store.zip')).rejects.toThrow()
    expect(svc.appstore.registerSource).toHaveBeenCalledTimes(1)
    expect(store.registeringUrl).toBe('https://a.example.com/store.zip')
  })

  it('event loss fallback: 15s polling listSources, converge once new URL is seen (case-insensitive)', async () => {
    const store = useSourcesStore()
    const appstore = useAppstoreStore()
    const inv = vi.spyOn(appstore, 'invalidate')
    svc.appstore.registerSource.mockResolvedValueOnce(undefined)
    await store.register('https://Example.com/Store.zip')

    // First round: not appeared yet → still pending
    svc.appstore.listSources.mockResolvedValueOnce([SRC])
    await vi.advanceTimersByTimeAsync(15_000)
    expect(store.registeringUrl).not.toBeNull()

    // Second round: appears (backend stores lowercase) → converge
    svc.appstore.listSources.mockResolvedValue([SRC, { id: 1, url: 'https://example.com/store.zip' }])
    await vi.advanceTimersByTimeAsync(15_000)
    expect(store.registeringUrl).toBeNull()
    expect(inv).toHaveBeenCalled()

    // Polling must have truly stopped after convergence: advance another 15s, listSources call count must not grow
    const callsAfterConverge = svc.appstore.listSources.mock.calls.length
    await vi.advanceTimersByTimeAsync(15_000)
    expect(svc.appstore.listSources.mock.calls.length).toBe(callsAfterConverge)
  })

  it('unregister succeeds: refetch + invalidate; fails: toast backend message', async () => {
    const store = useSourcesStore()
    const appstore = useAppstoreStore()
    const inv = vi.spyOn(appstore, 'invalidate')
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')

    svc.appstore.unregisterSource.mockResolvedValueOnce(undefined)
    svc.appstore.listSources.mockResolvedValueOnce([SRC])
    await store.unregister(1)
    expect(svc.appstore.unregisterSource).toHaveBeenCalledWith(1)
    expect(inv).toHaveBeenCalled()

    svc.appstore.unregisterSource.mockRejectedValueOnce({
      response: { data: { message: 'cannot unregister the last app store - need at least one app store' } },
    })
    await store.unregister(0)
    expect(show).toHaveBeenCalledWith(expect.stringContaining('cannot unregister the last app store'), expect.any(Number))
  })

  it('registration in-flight state persists: register writes to localStorage, clears after convergence', async () => {
    const store = useSourcesStore()
    svc.appstore.registerSource.mockResolvedValueOnce(undefined)
    await store.register('https://example.com/store.zip')
    const raw = localStorage.getItem('nimoos:sources-registering')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!)).toMatchObject({ url: 'https://example.com/store.zip' })

    svc.appstore.listSources.mockResolvedValue([SRC])
    busHandlers.get('app-store:register-end')!({})
    expect(store.registeringUrl).toBeNull()
    expect(localStorage.getItem('nimoos:sources-registering')).toBeNull()
  })

  it('refresh recovery: new store instance recovers pending from persistent storage and re-arms polling to converge', async () => {
    localStorage.setItem(
      'nimoos:sources-registering',
      JSON.stringify({ url: 'https://Example.com/Store.zip', at: Date.now() }),
    )
    const store = useSourcesStore()
    expect(store.registeringUrl).toBe('https://Example.com/Store.zip')

    // Polling sees the URL (backend stores lowercase) → converge + clear persisted state
    svc.appstore.listSources.mockResolvedValue([SRC, { id: 1, url: 'https://example.com/store.zip' }])
    await vi.advanceTimersByTimeAsync(15_000)
    expect(store.registeringUrl).toBeNull()
    expect(localStorage.getItem('nimoos:sources-registering')).toBeNull()
  })

  it('refresh recovery: persisted data over 10 minute TTL considered stale and discarded', () => {
    localStorage.setItem(
      'nimoos:sources-registering',
      JSON.stringify({ url: 'https://example.com/store.zip', at: Date.now() - 11 * 60_000 }),
    )
    const store = useSourcesStore()
    expect(store.registeringUrl).toBeNull()
  })
})
