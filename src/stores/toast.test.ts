import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useToast } from './toast'

describe('useToast', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.useFakeTimers() })

  it('show sets message then clears after 1500ms', () => {
    const t = useToast()
    t.show('hi'); expect(t.msg).toBe('hi')
    vi.advanceTimersByTime(1500); expect(t.msg).toBe('')
  })

  it('a newer toast cancels the older clear', () => {
    const t = useToast()
    t.show('a'); vi.advanceTimersByTime(800); t.show('b')
    vi.advanceTimersByTime(800); expect(t.msg).toBe('b') // old 1500ms clear must not wipe b
    vi.advanceTimersByTime(700); expect(t.msg).toBe('')
  })

  // SP8-P1c2 Task 6: tiers. Backward compat is a hard requirement — every
  // existing show(text) / show(text, ms) call site across the repo must keep
  // working unchanged. These two prove that: no third argument at all still
  // produces a default-tier ('info') toast with the same push/clear timing.
  it('show(text) with no tier arg defaults to tier=info (backward compat)', () => {
    const t = useToast()
    t.show('hi')
    expect(t.toasts[0].tier).toBe('info')
  })

  it('show(text, ms) two-arg call still defaults to tier=info and keeps its own duration', () => {
    const t = useToast()
    t.show('hi', 5000)
    expect(t.toasts[0].tier).toBe('info')
    vi.advanceTimersByTime(1500)
    expect(t.msg).toBe('hi') // must NOT have cleared at the old default 1500ms
    vi.advanceTimersByTime(3500)
    expect(t.msg).toBe('')
  })

  it('show(text, ms, tier) tags the toast with the given tier', () => {
    const t = useToast()
    t.show('bad', 5000, 'danger')
    t.show('careful', 7000, 'warning')
    expect(t.toasts.map((x) => x.tier)).toEqual(['danger', 'warning'])
  })
})
