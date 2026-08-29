import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createContainerEventHandler, CONTAINER_EVENT, createUninstallEndHandler, APP_UNINSTALL_END } from './containerEventBridge'

describe('containerEventBridge', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('event name matches backend contract', () => {
    expect(CONTAINER_EVENT).toBe('docker:container:state-changed')
  })

  it('destroy immediately evicts, other actions do not evict', () => {
    const evict = vi.fn(); const refresh = vi.fn()
    const { handle } = createContainerEventHandler({ evict, refresh })
    handle({ 'docker:container:action': 'destroy', 'docker:container:name': 'tasklist' })
    expect(evict).toHaveBeenCalledWith('tasklist')
    handle({ 'docker:container:action': 'die', 'docker:container:name': 'a' })
    handle({ 'docker:container:action': 'start', 'docker:container:name': 'b' })
    expect(evict).toHaveBeenCalledTimes(1)
  })

  it('consecutive events deduplicate to a single refresh', () => {
    const evict = vi.fn(); const refresh = vi.fn()
    const { handle } = createContainerEventHandler({ evict, refresh })
    handle({ 'docker:container:action': 'die', 'docker:container:name': 'a' })
    handle({ 'docker:container:action': 'destroy', 'docker:container:name': 'a' })
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('malformed messages (missing properties / non-objects) do not throw or trigger evict', () => {
    const evict = vi.fn(); const refresh = vi.fn()
    const { handle } = createContainerEventHandler({ evict, refresh })
    expect(() => { handle(null); handle('x'); handle({}) }).not.toThrow()
    expect(evict).not.toHaveBeenCalled()
  })

  it('dispose cancels pending debounce timers; after unload, refresh is no longer called', () => {
    const evict = vi.fn(); const refresh = vi.fn()
    const { handle, dispose } = createContainerEventHandler({ evict, refresh })
    handle({ 'docker:container:action': 'die', 'docker:container:name': 'a' })
    dispose()
    vi.advanceTimersByTime(500)
    expect(refresh).not.toHaveBeenCalled()
    // idempotent: repeated calls are harmless
    expect(() => dispose()).not.toThrow()
  })
})

describe('createUninstallEndHandler', () => {
  it('event name matches backend contract', () => {
    expect(APP_UNINSTALL_END).toBe('app:uninstall-end')
  })

  it('parse app:name to force evict and refresh; missing name only refreshes', () => {
    const evictForce = vi.fn(); const refresh = vi.fn()
    const handle = createUninstallEndHandler({ evictForce, refresh })
    handle({ 'app:name': 'test-nginx' })
    expect(evictForce).toHaveBeenCalledWith('test-nginx')
    expect(refresh).toHaveBeenCalledTimes(1)
    handle({})
    expect(evictForce).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(2)
  })
})
