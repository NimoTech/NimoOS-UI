import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useLiveStatsStore } from '../../stores/liveStats'
import GpuWidget from './GpuWidget.vue'
import type { LayoutItem } from '../../grid/types'
const item = (w: number): LayoutItem => ({ id: 'i', kind: 'widget', key: 'gpu', c: 1, r: 1, w, h: 2 })
describe('GpuWidget', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('shows rounded usage and temperature', () => {
    const s = useLiveStatsStore()
    s.ingest({ cpu: null, mem: null, disk: null, net: null, gpu: [{ utilization_gpu: 33.4, temperature: 61, utilization_memory: 20, memory_total: 8e9, name: 'NV' }] } as any)
    const w = mount(GpuWidget, { props: { item: item(2) } })
    expect(w.text()).toContain('33%')
    expect(w.text()).toContain('61℃')
  })
})
