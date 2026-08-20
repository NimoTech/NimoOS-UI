import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useLiveStatsStore } from '../../stores/liveStats'
import StorageWidget from './StorageWidget.vue'
import type { LayoutItem } from '../../grid/types'
const item = (w: number): LayoutItem => ({ id: 'i', kind: 'widget', key: 'storage', c: 1, r: 1, w, h: 2 })
describe('StorageWidget', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('shows used percent and abnormal status for unhealthy disk', async () => {
    const s = useLiveStatsStore()
    s.ingest({ cpu: null, mem: null, gpu: null, net: null, disk: { size: 100, avail: 25, health: false } } as any)
    const wp = mount(StorageWidget, { props: { item: item(4) } })
    expect(wp.text()).toContain('75%')   // 100 - floor(25*100/100)=75
    expect(wp.text()).toContain('异常')
  })
  it('healthy string maps to healthy status', async () => {
    const s = useLiveStatsStore()
    s.ingest({ cpu: null, mem: null, gpu: null, net: null, disk: { size: 100, avail: 50, health: 'healthy' } } as any)
    const wp = mount(StorageWidget, { props: { item: item(4) } })
    expect(wp.text()).toContain('正常')
  })
  // The ring used to fall back to a hardcoded 68%/84% three-colour gradient that
  // ignored the disk entirely, so the arc and the number in the middle disagreed.
  // The arc must now be driven by the same percentage as the text.
  it('drives the ring arc from the real used percentage', () => {
    const s = useLiveStatsStore()
    s.ingest({ disk: { size: 1000, avail: 250, used: 750, health: true }, cpu: null, mem: null, gpu: null, net: null } as any)
    const wp = mount(StorageWidget, { props: { item: item(4) } })
    const ring = wp.get('.ring')
    expect(ring.text()).toContain('75%')
    expect(ring.attributes('style')).toContain('--p: 75')
    // The dead three-colour fallback keyed off these hardcoded stops.
    expect(ring.attributes('style')).not.toContain('68%')
  })
})
