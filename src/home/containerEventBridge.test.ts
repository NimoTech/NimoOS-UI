import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createContainerEventHandler, CONTAINER_EVENT } from './containerEventBridge'

describe('containerEventBridge', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('事件名与后端契约一致', () => {
    expect(CONTAINER_EVENT).toBe('docker:container:state-changed')
  })

  it('destroy 立即 evict,其余动作不 evict', () => {
    const evict = vi.fn(); const refresh = vi.fn()
    const h = createContainerEventHandler({ evict, refresh })
    h({ 'docker:container:action': 'destroy', 'docker:container:name': 'tasklist' })
    expect(evict).toHaveBeenCalledWith('tasklist')
    h({ 'docker:container:action': 'die', 'docker:container:name': 'a' })
    h({ 'docker:container:action': 'start', 'docker:container:name': 'b' })
    expect(evict).toHaveBeenCalledTimes(1)
  })

  it('连发事件去抖成一次 refresh', () => {
    const evict = vi.fn(); const refresh = vi.fn()
    const h = createContainerEventHandler({ evict, refresh })
    h({ 'docker:container:action': 'die', 'docker:container:name': 'a' })
    h({ 'docker:container:action': 'destroy', 'docker:container:name': 'a' })
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('畸形消息(缺属性/非对象)不抛错不触发 evict', () => {
    const evict = vi.fn(); const refresh = vi.fn()
    const h = createContainerEventHandler({ evict, refresh })
    expect(() => { h(null); h('x'); h({}) }).not.toThrow()
    expect(evict).not.toHaveBeenCalled()
  })
})
