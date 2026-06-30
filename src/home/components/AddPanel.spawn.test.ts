import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useLayoutStore } from '../stores/layout'
import AddPanel from './AddPanel.vue'
describe('AddPanel spawn (click = pin)', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })
  it('a quick pointerdown+up (no move) on a widget card toggles it onto the grid', async () => {
    const layout = useLayoutStore(); layout.replaceAll([])
    vi.spyOn(layout, 'save').mockImplementation(() => {})
    const w = mount(AddPanel, { props: { open: true }, attachTo: document.body })
    const card = w.get('.lib-card[data-key="clock"]')
    await card.trigger('pointerdown', { clientX: 10, clientY: 10 })
    await card.trigger('pointerup', { clientX: 10, clientY: 10 })
    expect(layout.items.some((i) => i.key === 'clock')).toBe(true)
    w.unmount()
  })
})
