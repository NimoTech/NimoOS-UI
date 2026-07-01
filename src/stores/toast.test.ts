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
})
