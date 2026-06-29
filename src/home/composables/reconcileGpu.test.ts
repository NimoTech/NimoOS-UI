import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLayoutStore } from '../stores/layout'
import { useLiveStatsStore } from '../stores/liveStats'
import { reconcileGpu } from './reconcileGpu'
describe('reconcileGpu', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })
  it('removes the gpu widget when gpu is a known-empty array', () => {
    const layout = useLayoutStore(); layout.loadInitial()
    const live = useLiveStatsStore()
    expect(layout.items.some((i) => i.key === 'gpu')).toBe(true)
    live.ingest({ cpu: null, mem: null, disk: null, net: null, gpu: [] } as any)
    reconcileGpu(layout, live)
    expect(layout.items.some((i) => i.key === 'gpu')).toBe(false)
  })
  it('keeps gpu widget when gpu is unknown (null)', () => {
    const layout = useLayoutStore(); layout.loadInitial()
    const live = useLiveStatsStore()
    reconcileGpu(layout, live)
    expect(layout.items.some((i) => i.key === 'gpu')).toBe(true)
  })
})
