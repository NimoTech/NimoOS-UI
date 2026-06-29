import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useLiveStatsStore } from '../../stores/liveStats'
import NetworkWidget from './NetworkWidget.vue'
import type { LayoutItem } from '../../grid/types'
const item = (w: number): LayoutItem => ({ id: 'i', kind: 'widget', key: 'network', c: 1, r: 1, w, h: 3 })
describe('NetworkWidget', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('clicking a NIC chip changes netSel', async () => {
    const s = useLiveStatsStore()
    s.ingest({ cpu: null, mem: null, disk: null, gpu: null, net: [
      { name: 'eth0', state: 'up', bytesSent: 0, bytesRecv: 0, time: 0 },
      { name: 'wlan0', state: 'up', bytesSent: 0, bytesRecv: 0, time: 0 },
    ] } as any)
    const w = mount(NetworkWidget, { props: { item: item(4) } })
    const chips = w.findAll('.net-dev')
    expect(chips.length).toBe(2)
    await chips[1].trigger('click')
    expect(s.netSel).toBe('wlan0')
  })
})
