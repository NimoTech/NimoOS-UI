import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// mock the shared package, avoid real network calls
vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return {
    ...actual,
    service: { sys: { getUtilization: vi.fn(async () => ({ cpu: { percent: 42 }, mem: { usedPercent: 73 }, disk: null, gpu: null, net: null, usb: null })) } },
  }
})

import { useUtilizationStore } from './utilization'

describe('useUtilizationStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('fetchOnce loads REST data and derives percents', async () => {
    const s = useUtilizationStore()
    await s.fetchOnce()
    expect(s.cpuPercent).toBe(42)
    expect(s.memPercent).toBe(73)
  })

  it('applySocket merges live socket payload (sys_* JSON strings)', () => {
    const s = useUtilizationStore()
    s.applySocket({ sys_cpu: '{"percent":9}', sys_mem: '{"usedPercent":11}' })
    expect(s.cpuPercent).toBe(9)
    expect(s.memPercent).toBe(11)
  })
})
