import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useGuardedPoll } from './useGuardedPoll'

const host = (fn: () => Promise<void>, opts: { intervalMs: number; active: () => boolean }) =>
  defineComponent({ setup() { useGuardedPoll(fn, opts); return () => null } })

describe('useGuardedPoll', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('When active, repeatedly call fn at interval', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    mount(host(fn, { intervalMs: 1000, active: () => true }))
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('Single-flight: when fn is slower than interval, no overlapping (next beat waits for previous beat to resolve)', async () => {
    let inflight = 0
    let maxInflight = 0
    const fn = vi.fn(async () => {
      inflight++; maxInflight = Math.max(maxInflight, inflight)
      await new Promise((r) => setTimeout(r, 3000)) // Slower than interval
      inflight--
    })
    mount(host(fn, { intervalMs: 1000, active: () => true }))
    await vi.advanceTimersByTimeAsync(10000)
    expect(maxInflight).toBe(1) // Never overlapping
  })

  it('When active()=false, do not call fn but loop stays alive (can switch to true later)', async () => {
    let on = false
    const fn = vi.fn().mockResolvedValue(undefined)
    mount(host(fn, { intervalMs: 1000, active: () => on }))
    await vi.advanceTimersByTimeAsync(3000)
    expect(fn).not.toHaveBeenCalled()
    on = true
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenCalled()
  })

  it('Stop scheduling after unmount', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const w = mount(host(fn, { intervalMs: 1000, active: () => true }))
    await vi.advanceTimersByTimeAsync(1000)
    const n = fn.mock.calls.length
    w.unmount()
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn.mock.calls.length).toBe(n) // Does not increase after unmount
  })
})
