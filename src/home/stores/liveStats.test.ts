import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLiveStatsStore } from './liveStats'
import type { Utilization } from '@nimotech/nimoos-service'

describe('useLiveStatsStore.ingest', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })

  it('stores cpu/mem/disk and caps cpuHist at 60', () => {
    const s = useLiveStatsStore()
    for (let i = 0; i < 65; i++) s.ingest({ cpu: { percent: i }, mem: null, disk: null, gpu: null, net: null, usb: null } as Utilization)
    expect(s.cpuHist.length).toBe(60)
    expect(s.cpuHist[s.cpuHist.length - 1]).toBe(64)
  })

  it('computes net up/down speed from byte deltas over dt', () => {
    const s = useLiveStatsStore()
    s.ingest({ cpu: null, mem: null, disk: null, gpu: null, net: [{ name: 'eth0', state: 'up', bytesSent: 0, bytesRecv: 0, time: 0 }] as any, usb: null } as Utilization)
    s.ingest({ cpu: null, mem: null, disk: null, gpu: null, net: [{ name: 'eth0', state: 'up', bytesSent: 100, bytesRecv: 200, time: 2 }] as any, usb: null } as Utilization)
    const h = s.netHist['eth0']
    expect(h.up[h.up.length - 1]).toBe(50)   // 100/2
    expect(h.down[h.down.length - 1]).toBe(100) // 200/2
    expect(s.netSel).toBe('eth0')
  })

  it('empty gpu array means known-absent (gpuPresent false)', () => {
    const s = useLiveStatsStore()
    s.ingest({ cpu: null, mem: null, disk: null, gpu: [] as any, net: null, usb: null } as Utilization)
    expect(s.gpuPresent).toBe(false)
    s.ingest({ cpu: null, mem: null, disk: null, gpu: [{ utilization_gpu: 5 }] as any, net: null, usb: null } as Utilization)
    expect(s.gpuPresent).toBe(true)
  })
})
