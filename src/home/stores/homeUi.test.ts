import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useHomeUiStore } from './homeUi'

describe('useHomeUiStore', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.useFakeTimers() })
  it('toggleEdit flips and forces', () => {
    const s = useHomeUiStore()
    expect(s.editing).toBe(false)
    s.toggleEdit(); expect(s.editing).toBe(true)
    s.toggleEdit(false); expect(s.editing).toBe(false)
  })
  it('showToast sets message then clears after 1500ms', () => {
    const s = useHomeUiStore()
    s.showToast('hi'); expect(s.toastMsg).toBe('hi')
    vi.advanceTimersByTime(1500); expect(s.toastMsg).toBe('')
  })
  it('a newer toast cancels the older clear', () => {
    const s = useHomeUiStore()
    s.showToast('a'); vi.advanceTimersByTime(800); s.showToast('b')
    vi.advanceTimersByTime(800); expect(s.toastMsg).toBe('b') // 旧 1500ms 清不应清掉 b
    vi.advanceTimersByTime(700); expect(s.toastMsg).toBe('')
  })
})
