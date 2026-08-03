import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useGuardedPoll } from './useGuardedPoll'

const host = (fn: () => Promise<void>, opts: { intervalMs: number; active: () => boolean }) =>
  defineComponent({ setup() { useGuardedPoll(fn, opts); return () => null } })

describe('useGuardedPoll', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('active 时按 interval 反复调用 fn', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    mount(host(fn, { intervalMs: 1000, active: () => true }))
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('单飞:fn 慢于 interval 时不重叠(下一拍等上一拍 resolve)', async () => {
    let inflight = 0
    let maxInflight = 0
    const fn = vi.fn(async () => {
      inflight++; maxInflight = Math.max(maxInflight, inflight)
      await new Promise((r) => setTimeout(r, 3000)) // 比 interval 慢
      inflight--
    })
    mount(host(fn, { intervalMs: 1000, active: () => true }))
    await vi.advanceTimersByTimeAsync(10000)
    expect(maxInflight).toBe(1) // 从不重叠
  })

  it('active()=false 时不调 fn 但循环存活(可后续转 true)', async () => {
    let on = false
    const fn = vi.fn().mockResolvedValue(undefined)
    mount(host(fn, { intervalMs: 1000, active: () => on }))
    await vi.advanceTimersByTimeAsync(3000)
    expect(fn).not.toHaveBeenCalled()
    on = true
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenCalled()
  })

  it('unmount 后停止排程', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const w = mount(host(fn, { intervalMs: 1000, active: () => true }))
    await vi.advanceTimersByTimeAsync(1000)
    const n = fn.mock.calls.length
    w.unmount()
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn.mock.calls.length).toBe(n) // 卸载后不再增
  })
})
