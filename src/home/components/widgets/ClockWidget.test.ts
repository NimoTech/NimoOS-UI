import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ClockWidget from './ClockWidget.vue'
import type { LayoutItem } from '../../grid/types'
const item = (h: number): LayoutItem => ({ id: 'i', kind: 'widget', key: 'clock', c: 1, r: 1, w: 2, h })
describe('ClockWidget', () => {
  it('renders HH:MM time and a date', () => {
    const w = mount(ClockWidget, { props: { item: item(2) } })
    expect(w.get('[data-clock-time]').text()).toMatch(/^\d{2}:\d{2}$/)
    expect(w.find('[data-clock-date]').exists()).toBe(true)
  })
  it('adds mini class when h<2', () => {
    const w = mount(ClockWidget, { props: { item: item(1) } })
    expect(w.get('[data-clock-time]').classes()).toContain('mini')
  })
})
