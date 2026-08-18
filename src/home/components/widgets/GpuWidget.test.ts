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
    expect(w.text()).toContain('33%')
    expect(w.text()).not.toContain('33.4%')
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

  // registry.ts:27 defaults this card to 2x2, which renders the pill grid rather
  // than the .stats list. The frequency row was added only to .stats, so on the
  // very device that motivated it -- integrated GPU, temperature 0, memory_total 0,
  // freq_mhz 1000 -- the one field with a real value was still dropped at the size
  // the card actually ships at. Every other new case here mounts at w:4, which is
  // exactly why the gap was invisible.
  it('shows the frequency at the default 2x2 size, in place of the empty VRAM pill', () => {
    const w = mountWith(IGPU, 2)
    const pills = w.findAll('.pill').map((p) => p.text())
    expect(pills).toHaveLength(2) // the branch has no room for a third
    expect(pills.some((p) => p.includes('频率') && p.includes('1000'))).toBe(true)
  })

  // The substitution is only justified by the VRAM pill having nothing to report.
  it('keeps the VRAM pill at 2x2 when the card really has VRAM', () => {
    const w = mountWith({ ...DISCRETE, freq_mhz: 1500 }, 2)
    const pills = w.findAll('.pill').map((p) => p.text())
    expect(pills).toHaveLength(2)
    expect(pills.some((p) => p.includes('显存'))).toBe(true)
    expect(pills.some((p) => p.includes('频率'))).toBe(false)
  })

  // Nothing to report on either side: keep the two pills rather than leave a hole.
  it('falls back to the em-dashed VRAM pill when there is no frequency either', () => {
    const w = mountWith({ ...IGPU, freq_mhz: 0 }, 2)
    const pills = w.findAll('.pill').map((p) => p.text())
    expect(pills).toHaveLength(2)
    expect(pills.some((p) => p.includes('显存') && p.includes('—'))).toBe(true)
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

  // The decimal only buys anything under 10%, and it costs a glyph the ring hole
  // does not have: measured in Chromium at the GPU card's real ring size (42cqmin
  // = 70.5px, 57.8px hole), "43.5%" is 64.1px of ink against a 49.2px chord at the
  // text's top edge, so it prints across the colour band the ring uses to mean
  // something. Two digits and up are rounded to keep the string three glyphs wide.
  it('drops the decimal from ten percent up so the number stays inside the ring', () => {
    const w = mountWith({ ...DISCRETE, utilization_gpu: 43.5 }, 4)
    expect(w.get('.ring').text()).toContain('44%')
    expect(w.get('.ring').text()).not.toContain('43.5')
  })

  it('rounds a full load to a whole number too', () => {
    const w = mountWith({ ...DISCRETE, utilization_gpu: 99.94 }, 4)
    expect(w.get('.ring').text()).toContain('100%')
  })

  it('keeps the decimal right up to the threshold', () => {
    const w = mountWith({ ...DISCRETE, utilization_gpu: 9.96 }, 4)
    expect(w.get('.ring').text()).toContain('10%') // 9.96 -> 10.0 -> "10%"
    const w2 = mountWith({ ...DISCRETE, utilization_gpu: 9.44 }, 4)
    expect(w2.get('.ring').text()).toContain('9.4%')
  })

  it('still renders real readings from a discrete card', () => {
    const w = mountWith(DISCRETE, 4)
    expect(w.text()).toContain('54℃')
    expect(w.get('.ring').text()).toContain('44%')
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
