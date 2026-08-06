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

  // Task 9 (SP7-P3 回收站视图):show() 的第三个可选 action 参数原样存进 toast 项,
  // 供 AppToast.vue 渲染成可点按钮(如「撤销」)。
  it('show 的第三参数 action 原样存入 toasts 项', () => {
    const t = useToast()
    const onClick = vi.fn()
    t.show('已恢复', 4500, { label: '撤销', onClick })
    expect(t.toasts[0].action).toEqual({ label: '撤销', onClick })
  })

  it('dismiss(id) 立即移除对应 toast', () => {
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

  // 【SP8-P6-T3 合流】第三参是判别联合(字符串=tier / 对象=action)。sp7 与 sp8 各自
  // 占用过这个位置,合流时若判别写反,一侧的调用点会静默失效(action 当成 tier 存进去
  // → 按钮不渲染;或 tier 当成 action → 分级配色丢失)。两个方向各钉一条。
  it('第三参给对象时:存为 action,tier 回落 info(sp7 侧调用点不受影响)', () => {
    const t = useToast()
    const onClick = vi.fn()
    t.show('已恢复', 4500, { label: '撤销', onClick })
    expect(t.toasts[0].action).toEqual({ label: '撤销', onClick })
    expect(t.toasts[0].tier).toBe('info')
  })

  it('第三参给字符串时:存为 tier,action 为 undefined(sp8 侧调用点不受影响)', () => {
    const t = useToast()
    t.show('失败了', 3000, 'danger')
    expect(t.toasts[0].tier).toBe('danger')
    expect(t.toasts[0].action).toBeUndefined()
  })
})
