import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useLiveStatsStore } from '../../stores/liveStats'
import StorageWidget from './StorageWidget.vue'
import type { LayoutItem } from '../../grid/types'
const item = (w: number): LayoutItem => ({ id: 'i', kind: 'widget', key: 'storage', c: 1, r: 1, w, h: 2 })
describe('StorageWidget', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('shows used percent and 异常 for unhealthy disk', async () => {
    const s = useLiveStatsStore()
    s.ingest({ cpu: null, mem: null, gpu: null, net: null, disk: { size: 100, avail: 25, health: false } } as any)
    const wp = mount(StorageWidget, { props: { item: item(4) } })
    expect(wp.text()).toContain('75%')   // 100 - floor(25*100/100)=75
    expect(wp.text()).toContain('异常')
  })
  it('healthy string maps to 正常', async () => {
    const s = useLiveStatsStore()
    s.ingest({ cpu: null, mem: null, gpu: null, net: null, disk: { size: 100, avail: 50, health: 'healthy' } } as any)
    const wp = mount(StorageWidget, { props: { item: item(4) } })
    expect(wp.text()).toContain('正常')
  })
})
