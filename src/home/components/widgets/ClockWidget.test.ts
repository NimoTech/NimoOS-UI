import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ClockWidget from './ClockWidget.vue'
import type { LayoutItem } from '../../grid/types'
const item = (w: number, h: number): LayoutItem => ({ id: 'i', kind: 'widget', key: 'clock', c: 1, r: 1, w, h })
describe('ClockWidget', () => {
  it('renders HH:MM time', () => {
    const w = mount(ClockWidget, { props: { item: item(2, 2) } })
    expect(w.get('[data-clock-time]').text()).toMatch(/^\d{2}:\d{2}$/)
  })
  it('shows the analog dial in non-mini variants', () => {
    const w = mount(ClockWidget, { props: { item: item(2, 2) } })
    expect(w.find('.dial').exists()).toBe(true)
  })
  it('uses the mini variant (time only, no dial) when h<2', () => {
    const w = mount(ClockWidget, { props: { item: item(2, 1) } })
    expect(w.get('.clock').classes()).toContain('v-mini')
    expect(w.find('.dial').exists()).toBe(false)
  })
  it('shows greeting and date in the wide variant', () => {
    const w = mount(ClockWidget, { props: { item: item(4, 2) } })
    expect(w.find('.greet').exists()).toBe(true)
    expect(w.get('.sub').text()).toContain('月')
  })
})
