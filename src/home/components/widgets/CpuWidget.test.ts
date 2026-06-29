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
})
