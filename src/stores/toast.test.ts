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
})
