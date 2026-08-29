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

  // Task 9 (SP7-P3 recycle bin view): show()'s third, optional action param is stored
  // on the toast item as-is, rendered by AppToast.vue as a clickable button (like 「撤销」).
  it('the third argument to show (action) is stored on the toasts item unchanged', () => {
    const t = useToast()
    const onClick = vi.fn()
    t.show('已恢复', 4500, { label: '撤销', onClick })
    expect(t.toasts[0].action).toEqual({ label: '撤销', onClick })
  })

  it('dismiss(id) immediately removes the matching toast', () => {
    const t = useToast()
    t.show('a')
    const id = t.toasts[0].id
    t.dismiss(id)
    expect(t.toasts).toEqual([])
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

  // [SP8-P6-T3 merge] The third param is a discriminated union (string = tier / object = action).
  // sp7 and sp8 each claimed this position independently; if the merge gets the discriminant
  // backwards, one side's call sites silently break (action stored as tier -> button never
  // renders; or tier treated as action -> severity styling is lost). One test pins each direction.
  it('when the third arg is an object: stored as action, tier falls back to info (sp7 call sites unaffected)', () => {
    const t = useToast()
    const onClick = vi.fn()
    t.show('已恢复', 4500, { label: '撤销', onClick })
    expect(t.toasts[0].action).toEqual({ label: '撤销', onClick })
    expect(t.toasts[0].tier).toBe('info')
  })

  it('when the third arg is a string: stored as tier, action is undefined (sp8 call sites unaffected)', () => {
    const t = useToast()
    t.show('失败了', 3000, 'danger')
    expect(t.toasts[0].tier).toBe('danger')
    expect(t.toasts[0].action).toBeUndefined()
  })
})
