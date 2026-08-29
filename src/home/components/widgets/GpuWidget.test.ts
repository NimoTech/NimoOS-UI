import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
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
  integrated: true,
}

const DISCRETE = {
  index: 0, name: 'NVIDIA GeForce RTX 4070', vendor: 'nvidia',
  utilization_gpu: 43.5, utilization_memory: 61, memory_total: 12884901888,
  memory_used: 7858000000, temperature: 54, freq_mhz: 0, integrated: false,
}

describe('GpuWidget', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows rounded usage and temperature', () => {
    const s = useLiveStatsStore()
    s.ingest({ cpu: null, mem: null, disk: null, net: null, gpu: [{ utilization_gpu: 33.4, temperature: 61, utilization_memory: 20, memory_total: 8e9, name: 'NV' }] } as any)
    // Mounted wide: at the default 2x2 the card is the ring alone, so temperature
    // is only on the page from three columns up.
    const w = mount(GpuWidget, { props: { item: item(4) } })
    expect(w.text()).toContain('33%')
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

  // The 2x2 card is the ring alone. Pills do not fit at that size: the reference
  // screenshot showed them clipped through the middle of the word "Frequency",
  // which is why substituting one pill for another did not help. Everything the
  // pills carried is on the wide card.
  it('renders only the ring at the default 2x2 size, with no pills', () => {
    const w = mountWith(IGPU, 2)
    expect(w.find('.ring').exists()).toBe(true)
    expect(w.findAll('.pill').length).toBe(0)
    expect(w.get('.ring').text()).toContain('0.7%')
  })

  it('still shows temperature, VRAM and frequency once the card is widened', () => {
    const w = mountWith(IGPU, 4)
    const rows = w.findAll('.stat').map((r) => r.text())
    expect(rows.some((r) => r.includes('温度') && r.includes('—'))).toBe(true)
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

  // ── iGPU + discrete card: one ring each ────────────────────────────────────
  // The backend has always sent every GPU it finds; the widget only ever read
  // gpu[0], so the second card was invisible. Selection is on the `integrated`
  // flag, not on array position -- the backend sorts by "reports a temperature"
  // and an integrated GPU that does report one would otherwise take the discrete
  // card's ring.
  const mountBoth = (w = 4) => {
    const s = useLiveStatsStore()
    s.ingest({ gpu: [DISCRETE, IGPU], cpu: null, mem: null, disk: null, net: null } as any)
    return mount(GpuWidget, { props: { item: item(w) } })
  }

  it('gives the integrated and the discrete GPU a ring each on the wide card', () => {
    const w = mountBoth(4)
    const rings = w.findAll('.ring')
    expect(rings.length).toBe(2)
    expect(rings[0].text()).toContain('iGPU')
    expect(rings[0].text()).toContain('0.7%')
    expect(rings[1].text()).toContain('GPU')
    expect(rings[1].text()).toContain('44%')
  })

  it('keeps a single ring at 2x2 and gives it to the discrete card', () => {
    const w = mountBoth(2)
    expect(w.findAll('.ring').length).toBe(1)
    expect(w.get('.ring').text()).toContain('44%')
    expect(w.get('.ring').text()).not.toContain('iGPU')
  })

  // The five-row table has no room next to two rings, so each ring gets one
  // compact line -- and it lists only the fields that card actually reports,
  // rather than a row of em dashes.
  it('labels each ring with only the readings that card has', () => {
    const w = mountBoth(4)
    const subs = w.findAll('.num-sub').map((n) => n.text())
    expect(subs.length).toBe(2)
    expect(subs[0]).toContain('1000 MHz')   // iGPU: frequency is all it exposes
    expect(subs[0]).not.toContain('—')
    expect(subs[1]).toContain('54℃')        // discrete: temperature + VRAM
    expect(subs[1]).toContain('12 GB')
  })

  it('names the single ring after the kind of GPU it is', () => {
    expect(mountWith(IGPU, 2).get('.ring').text()).toContain('iGPU')
    expect(mountWith(DISCRETE, 2).get('.ring').text()).toContain('GPU')
    expect(mountWith(IGPU, 2).get('.ring').text()).not.toContain('使用率')
  })

  // A card without the flag (an older backend that has not been redeployed yet)
  // must still render: unknown means "just call it GPU", never a blank ring.
  it('falls back to GPU when the backend sends no integrated flag', () => {
    const { integrated, ...noFlag } = IGPU as any
    const w = mountWith(noFlag, 4)
    expect(w.get('.ring').text()).toContain('GPU')
    expect(w.findAll('.ring').length).toBe(1)
  })

  // Regression: .ring-row{flex:1} ate the whole card height, .stats was squeezed
  // to nothing and .card-body{overflow:hidden} cut four of its five rows off --
  // on the device only "Model" was visible. The wide single-card layout puts the
  // ring and the table side by side so the rows have somewhere to go.
  it('puts the ring beside the stats table on a wide single-GPU card', () => {
    const w = mountWith(DISCRETE, 4)
    expect(w.find('.ring-row.solo').exists()).toBe(false)
    expect(w.find('.ring-row').exists()).toBe(true)
    expect(w.findAll('.stat').length).toBeGreaterThanOrEqual(4)
  })

  // The card's max height went 2 -> 3 for exactly this: at three rows the two rings
  // each get their own readings table, which the 4x2 pair layout has no room for.
  it('gives each GPU a full readings table when the card is three rows tall', () => {
    const s = useLiveStatsStore()
    s.ingest({ gpu: [DISCRETE, IGPU], cpu: null, mem: null, disk: null, net: null } as any)
    const w = mount(GpuWidget, { props: { item: { ...item(4), h: 3 } } })
    expect(w.findAll('.ring').length).toBe(2)
    expect(w.findAll('.stats').length).toBe(2)
    const cells = w.findAll('.gpu-cell')
    expect(cells[0].findAll('.stat').length).toBe(5)
    expect(cells[0].text()).toContain('iGPU')
    expect(cells[0].text()).toContain('1000 MHz')
    expect(cells[1].text()).toContain('GPU')
    expect(cells[1].text()).toContain('54℃')
    expect(cells[1].text()).toContain('12 GB')
    // freq_mhz 0 on the discrete card: no frequency row at all, so this column is one
    // row shorter than the iGPU's. A fifth em dash would buy tidier alignment at the
    // cost of implying the field exists and merely went unread this tick.
    expect(cells[1].findAll('.stat').length).toBe(4)
    expect(cells[1].text()).not.toContain('频率')
  })

  // At two rows tall there is no room for the tables -- that layout stays the
  // ring-plus-one-line pair.
  it('keeps the compact pair layout at two rows tall', () => {
    const s = useLiveStatsStore()
    s.ingest({ gpu: [DISCRETE, IGPU], cpu: null, mem: null, disk: null, net: null } as any)
    const w = mount(GpuWidget, { props: { item: item(4) } })
    expect(w.findAll('.gpu-cell').length).toBe(0)
    expect(w.findAll('.num-sub').length).toBe(2)
  })

  // One GPU on a three-row card uses the same per-card layout, one column wide, with
  // the ring back at full scale -- it is not sharing the width with anything.
  it('stacks the ring over a full-width table for a single GPU at three rows', () => {
    const w = mountWith(IGPU, 4)
    const tall = mount(GpuWidget, { props: { item: { ...item(4), h: 3 } } })
    expect(w.find('.gpu-grid').exists()).toBe(false) // 4x2 stays ring-beside-table
    expect(tall.find('.gpu-grid.single').exists()).toBe(true)
    expect(tall.findAll('.ring').length).toBe(1)
    expect(tall.findAll('.gpu-cell').length).toBe(1)
    expect(tall.findAll('.stat').length).toBe(5)
    expect(tall.get('.ring').text()).toContain('iGPU')
  })

  // ── Row budget wiring ──────────────────────────────────────────────────────
  // The pure fit logic is covered in util/statFit.test.ts; what these check is the
  // wiring: that the component finds .card-in, measures a row off the hidden probe,
  // and subtracts the ring only where the ring sits above the rows. Reproduces the
  // device report: browser zoomed in, Chrome's minimum font size raised, and the
  // bottom row sliced in half by .card-in's overflow:hidden.
  const mountInCard = (gpu: unknown, h: number) => {
    const s = useLiveStatsStore()
    s.ingest({ gpu: [gpu], cpu: null, mem: null, disk: null, net: null } as any)
    return mount(
      {
        components: { GpuWidget },
        props: ['h'],
        template: '<div class="card-in"><GpuWidget :item="{ id: \'i\', kind: \'widget\', key: \'gpu\', c: 1, r: 1, w: 4, h }" /></div>',
      },
      { props: { h }, attachTo: document.body },
    )
  }

  // jsdom reports every box as 0px, so the heights are stubbed to the ones measured
  // on the deployed build.
  const stub = (w: ReturnType<typeof mountInCard>, availH: number, rowH: number, ringH: number) => {
    Object.defineProperty(w.get('.card-in').element, 'clientHeight', { value: availH, configurable: true })
    Object.defineProperty(w.get('.stat-probe').element, 'offsetHeight', { value: rowH, configurable: true })
    const ring = w.find('.ring')
    if (ring.exists()) Object.defineProperty(ring.element, 'offsetHeight', { value: ringH, configurable: true })
  }

  it('keeps all five rows when the card is tall enough', async () => {
    const w = mountInCard(IGPU, 3)
    stub(w, 288, 17, 124) // 2560x1440
    await w.setProps({ h: 3 })
    await nextTick()
    expect(w.findAll('.stat').length).toBe(5)
  })

  it('drops the em-dash rows before the readable ones when the card is too short', async () => {
    const w = mountInCard(IGPU, 3)
    stub(w, 101, 17, 64) // 1280x800: (101 - 64) / 17 = two rows fit under the ring
    await w.setProps({ h: 3 })
    await nextTick()
    const rows = w.findAll('.stat').map((r) => r.text())
    expect(rows.length).toBe(2)
    // The two survivors are the ones that say something: the model and the frequency.
    // Temp / VRAM / VRAM usage are em dashes on integrated graphics, so they go first
    // and nothing readable is lost.
    expect(rows.join()).not.toContain('—')
    expect(rows.join()).toContain('频率')
  })

  it('drops rows when a forced-larger minimum font size inflates them', async () => {
    const w = mountInCard(IGPU, 3)
    stub(w, 171, 21, 85) // 1600x1000 with minimumFontSize=16: (171 - 85) / 21 = 4
    await w.setProps({ h: 3 })
    await nextTick()
    const rows = w.findAll('.stat').map((r) => r.text())
    expect(rows.length).toBe(4)
    // One row over budget, so exactly one goes -- the least useful blank one.
    expect(rows.join()).not.toContain('显存占用')
  })

  // Side by side, the ring is not above the rows, so it must not be charged against
  // their height -- otherwise the wide card drops rows it has room for.
  it('does not charge the ring against the rows when they sit beside each other', async () => {
    const w = mountInCard(IGPU, 2)
    stub(w, 94, 17, 64) // 4x2 at 1600x1000
    await w.setProps({ h: 2 })
    await nextTick()
    expect(w.find('.ring-row').exists()).toBe(true)
    expect(w.findAll('.stat').length).toBe(5) // 94 / 17 = 5
  })

  // Everything the card cannot show is still reachable, so dropping rows never loses
  // a reading outright.
  it('keeps every reading in the hover title', async () => {
    const w = mountInCard(IGPU, 3)
    stub(w, 101, 17, 64)
    await w.setProps({ h: 3 })
    await nextTick()
    const title = w.get('.gpu-cell').attributes('title') || ''
    expect(title).toContain('Wildcat Lake')
    expect(title).toContain('温度')
    expect(title).toContain('1000 MHz')
  })
})
