import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useHomeUiStore } from './homeUi'
import { useToast } from '../../stores/toast'

describe('useHomeUiStore', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('toggleEdit flips and forces', () => {
    const s = useHomeUiStore()
    expect(s.editing).toBe(false)
    s.toggleEdit(); expect(s.editing).toBe(true)
    s.toggleEdit(false); expect(s.editing).toBe(false)
  })

  it('showToast delegates to useToast', () => {
    const s = useHomeUiStore()
    const t = useToast()
    s.showToast('hi'); expect(t.msg).toBe('hi')
  })
})
