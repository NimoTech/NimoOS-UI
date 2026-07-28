import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useDiskHotplug } from './useDiskHotplug'

const handlers: Record<string, (...a: unknown[]) => void> = {}
const offs: Record<string, ReturnType<typeof vi.fn>> = {}
vi.mock('./useMessageBus', () => ({
  useMessageBus: () => ({
    on: (ev: string, cb: (...a: unknown[]) => void) => {
      handlers[ev] = cb
      offs[ev] = vi.fn()
      return offs[ev]
    },
  }),
}))

function host(refresh: () => void, opts?: Record<string, unknown>) {
  return defineComponent({
    setup() { useDiskHotplug(refresh, opts); return () => null },
  })
}

describe('useDiskHotplug', () => {
  beforeEach(() => { vi.useFakeTimers(); for (const k in handlers) delete handlers[k]; for (const k in offs) delete offs[k] })
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('mount 时订阅 added/removed 且 loadOnMount 默认立即 refresh 一次', () => {
    const refresh = vi.fn()
    mount(host(refresh))
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(typeof handlers['local-storage:disk:added']).toBe('function')
    expect(typeof handlers['local-storage:disk:removed']).toBe('function')
  })

  it('loadOnMount:false 时 mount 不 refresh', () => {
    const refresh = vi.fn()
    mount(host(refresh, { loadOnMount: false }))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('500ms 防抖:连发多次事件只刷新一次', () => {
    const refresh = vi.fn()
    mount(host(refresh, { loadOnMount: false }))
    handlers['local-storage:disk:added']()
    handlers['local-storage:disk:added']()
    handlers['local-storage:disk:removed']()
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('unmount 调两个 off-fn 且清定时器', () => {
    const refresh = vi.fn()
    const w = mount(host(refresh, { loadOnMount: false }))
    handlers['local-storage:disk:added']() // 挂起一个未触发的防抖
    w.unmount()
    expect(offs['local-storage:disk:added']).toHaveBeenCalledTimes(1)
    expect(offs['local-storage:disk:removed']).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(500)
    expect(refresh).not.toHaveBeenCalled() // 卸载后不再触发
  })
})
