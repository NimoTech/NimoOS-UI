import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useEventsStore } from '../../stores/events'
import EventsWidget from './EventsWidget.vue'
import type { LayoutItem } from '../../grid/types'
const item = (h: number): LayoutItem => ({ id: 'i', kind: 'widget', key: 'events', c: 1, r: 1, w: 2, h })
describe('EventsWidget', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('shows empty state with no events', () => {
    const w = mount(EventsWidget, { props: { item: item(4) } })
    expect(w.text()).toContain('暂无活动')
  })
  it('renders up to h events', () => {
    const s = useEventsStore()
    s.list = [1, 2, 3, 4, 5].map((n) => ({ uuid: 'u' + n, ts: Date.now(), title: 'E' + n, icon: '' }))
    const w = mount(EventsWidget, { props: { item: item(3) } })
    expect(w.findAll('.event').length).toBe(3)
  })
})
