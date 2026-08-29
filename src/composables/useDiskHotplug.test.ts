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

  it('On mount, subscribe to added/removed and loadOnMount defaults to immediate refresh once', () => {
    const refresh = vi.fn()
    mount(host(refresh))
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(typeof handlers['local-storage:disk:added']).toBe('function')
    expect(typeof handlers['local-storage:disk:removed']).toBe('function')
  })

  it('When loadOnMount:false, mount does not refresh', () => {
    const refresh = vi.fn()
    mount(host(refresh, { loadOnMount: false }))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('500ms debounce: multiple consecutive events trigger refresh only once', () => {
    const refresh = vi.fn()
    mount(host(refresh, { loadOnMount: false }))
    handlers['local-storage:disk:added']()
    handlers['local-storage:disk:added']()
    handlers['local-storage:disk:removed']()
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('unmount calls both off-fns and clears timer', () => {
    const refresh = vi.fn()
    const w = mount(host(refresh, { loadOnMount: false }))
    handlers['local-storage:disk:added']() // Suspend a pending debounce
    w.unmount()
    expect(offs['local-storage:disk:added']).toHaveBeenCalledTimes(1)
    expect(offs['local-storage:disk:removed']).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(500)
    expect(refresh).not.toHaveBeenCalled() // Does not trigger after unmount
  })
})
