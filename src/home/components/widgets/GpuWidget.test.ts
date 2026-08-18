import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useLiveStatsStore } from '../../stores/liveStats'
import GpuWidget from './GpuWidget.vue'
import type { LayoutItem } from '../../grid/types'
const item = (w: number): LayoutItem => ({ id: 'i', kind: 'widget', key: 'gpu', c: 1, r: 1, w, h: 2 })

// Captured verbatim from GET /v1/sys/utilization on the device, 2026-08-18.
// An integrated GPU reports no temperature and no VRAM, so those arrive as 0.
const IGPU = {
  index: 0,
  name: 'Intel Corporation Wildcat Lake [Intel Graphics] (rev 01)',
  vendor: 'intel',
  utilization_gpu: 0.687593423019428,
  utilization_memory: 0,
  memory_total: 0,
  memory_used: 0,
  temperature: 0,
  freq_mhz: 1000,
}

const DISCRETE = {
  index: 0, name: 'NVIDIA GeForce RTX 4070', vendor: 'nvidia',
  utilization_gpu: 43.5, utilization_memory: 61, memory_total: 12884901888,
  memory_used: 7858000000, temperature: 54, freq_mhz: 0,
}

describe('GpuWidget', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows rounded usage and temperature', () => {
    const s = useLiveStatsStore()
    s.ingest({ cpu: null, mem: null, disk: null, net: null, gpu: [{ utilization_gpu: 33.4, temperature: 61, utilization_memory: 20, memory_total: 8e9, name: 'NV' }] } as any)
    const w = mount(GpuWidget, { props: { item: item(2) } })
    expect(w.text()).toContain('33.4%')
    expect(w.text()).toContain('61℃')
  })

  const mountWith = (gpu: unknown, w = 4) => {
    const s = useLiveStatsStore()
    s.ingest({ gpu: [gpu], cpu: null, mem: null, disk: null, net: null } as any)
    return mount(GpuWidget, { props: { item: item(w) } })
  }

  // An integrated GPU has no VRAM and its sysfs exposes no temperature. Zero
  // means "absent", and printing it as 0℃ / 0 B states something false.
  it('renders absent readings as an em dash, not as zeros', () => {
    const w = mountWith(IGPU, 4)
    expect(w.text()).not.toContain('0℃')
    expect(w.text()).not.toContain('0 B')
    const rows = w.findAll('.stat').map((r) => r.text())
    expect(rows.some((r) => r.includes('温度') && r.includes('—'))).toBe(true)
    expect(rows.some((r) => r.includes('显存') && r.includes('—'))).toBe(true)
  })

  // freq_mhz is the only field with a real value on integrated graphics and was
  // not rendered at all.
  it('shows the clock frequency when the backend reports one', () => {
    const w = mountWith(IGPU, 4)
    const rows = w.findAll('.stat').map((r) => r.text())
    expect(rows.some((r) => r.includes('频率') && r.includes('1000'))).toBe(true)
  })

  it('omits the frequency row when there is no reading', () => {
    const w = mountWith(DISCRETE, 4)
    expect(w.findAll('.stat').map((r) => r.text()).some((r) => r.includes('频率'))).toBe(false)
  })

  // 0.687% is a real reading. Rounding it to 0% throws the only signal away.
  it('keeps a decimal so a lightly loaded GPU does not read as idle', () => {
    const w = mountWith(IGPU, 4)
    expect(w.get('.ring').text()).toContain('0.7%')
  })

  it('still renders real readings from a discrete card', () => {
    const w = mountWith(DISCRETE, 4)
    expect(w.text()).toContain('54℃')
    expect(w.get('.ring').text()).toContain('43.5%')
  })

  // A discrete card with real VRAM and nothing resident in it genuinely reports
  // utilization_memory: 0 -- unlike temperature/memory_total/freq_mhz, a running
  // card can legitimately be at 0% VRAM used. This must render as a real value,
  // not be swallowed by the "zero means absent" rule that applies to the others.
  it('shows a genuine 0% VRAM usage on a discrete card, not an em dash', () => {
    const w = mountWith({ ...DISCRETE, utilization_memory: 0 }, 4)
    const rows = w.findAll('.stat').map((r) => r.text())
    expect(rows.some((r) => r.includes('显存占用') && r.includes('0%'))).toBe(true)
    expect(rows.some((r) => r.includes('显存占用') && r.includes('—'))).toBe(false)
  })
})
