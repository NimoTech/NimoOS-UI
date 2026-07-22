import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createContainerEventHandler, CONTAINER_EVENT, createUninstallEndHandler, APP_UNINSTALL_END } from './containerEventBridge'

describe('containerEventBridge', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('事件名与后端契约一致', () => {
    expect(CONTAINER_EVENT).toBe('docker:container:state-changed')
  })

  it('destroy 立即 evict,其余动作不 evict', () => {
    const evict = vi.fn(); const refresh = vi.fn()
    const { handle } = createContainerEventHandler({ evict, refresh })
    handle({ 'docker:container:action': 'destroy', 'docker:container:name': 'tasklist' })
    expect(evict).toHaveBeenCalledWith('tasklist')
    handle({ 'docker:container:action': 'die', 'docker:container:name': 'a' })
    handle({ 'docker:container:action': 'start', 'docker:container:name': 'b' })
    expect(evict).toHaveBeenCalledTimes(1)
  })

  it('连发事件去抖成一次 refresh', () => {
    const evict = vi.fn(); const refresh = vi.fn()
    const { handle } = createContainerEventHandler({ evict, refresh })
    handle({ 'docker:container:action': 'die', 'docker:container:name': 'a' })
    handle({ 'docker:container:action': 'destroy', 'docker:container:name': 'a' })
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('畸形消息(缺属性/非对象)不抛错不触发 evict', () => {
    const evict = vi.fn(); const refresh = vi.fn()
    const { handle } = createContainerEventHandler({ evict, refresh })
    expect(() => { handle(null); handle('x'); handle({}) }).not.toThrow()
    expect(evict).not.toHaveBeenCalled()
  })

  it('dispose 取消待触发的去抖定时器,卸载后不再 refresh', () => {
    const evict = vi.fn(); const refresh = vi.fn()
    const { handle, dispose } = createContainerEventHandler({ evict, refresh })
    handle({ 'docker:container:action': 'die', 'docker:container:name': 'a' })
    dispose()
    vi.advanceTimersByTime(500)
    expect(refresh).not.toHaveBeenCalled()
    // 幂等:重复调用无害
    expect(() => dispose()).not.toThrow()
  })
})

describe('createUninstallEndHandler', () => {
  it('事件名与后端契约一致', () => {
    expect(APP_UNINSTALL_END).toBe('app:uninstall-end')
  })

  it('解析 app:name 强制清位并刷新;缺 name 只刷新', () => {
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
