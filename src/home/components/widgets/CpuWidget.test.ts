import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useLiveStatsStore } from '../../stores/liveStats'
import CpuWidget from './CpuWidget.vue'
import type { LayoutItem } from '../../grid/types'
const item = (w: number, h: number): LayoutItem => ({ id: 'i', kind: 'widget', key: 'cpu', c: 1, r: 1, w, h })
describe('CpuWidget', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('shows rounded cpu and mem percent', () => {
    const s = useLiveStatsStore()
    s.ingest({ cpu: { percent: 42.6, num: 6, temperature: 50 }, mem: { usedPercent: 70.2, total: 16e9 }, disk: null, gpu: null, net: null } as any)
    const w = mount(CpuWidget, { props: { item: item(4, 2) } })
    expect(w.text()).toContain('43%') // CPU rounded
    expect(w.text()).toContain('70%') // mem rounded
  })

  // The Processor card is w:4,h:2 by default (defaultLayout.ts:22) and at that
  // height the chart is squeezed against the rings, so it is gated on height too.
  it('hides the sparkline in a two-row card', () => {
    const s = useLiveStatsStore()
    s.ingest({ cpu: { percent: 42, num: 6, temperature: 50 }, mem: { usedPercent: 70, total: 16e9 }, disk: null, gpu: null, net: null } as any)
    const w = mount(CpuWidget, { props: { item: item(4, 2) } })
    expect(w.find('.chart-box').exists()).toBe(false)
    expect(w.find('.ring-pair').exists()).toBe(true) // the rings stay
  })

  it('shows the sparkline once the card is tall enough', () => {
    const s = useLiveStatsStore()
    s.ingest({ cpu: { percent: 42, num: 6, temperature: 50 }, mem: { usedPercent: 70, total: 16e9 }, disk: null, gpu: null, net: null } as any)
    const w = mount(CpuWidget, { props: { item: item(4, 3) } })
    expect(w.find('.chart-box').exists()).toBe(true)
  })
})
