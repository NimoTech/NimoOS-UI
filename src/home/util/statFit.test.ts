import { describe, it, expect } from 'vitest'
import { fitRowCount, pickRows, STAT_DROP_ORDER } from './statFit'

// The numbers here are the ones measured on the deployed build (see statFit.ts's
// header): a 4x3 GPU card is 288px inside at 2560x1440 and 101px at 1280x800, the
// ring is 124px / 64px, and a row is 17px normally but 21px once Chrome's minimum
// font size is forced to 16.
describe('fitRowCount', () => {
  it('fits all five rows on a full-size card', () => {
    expect(fitRowCount(288, 124 + 7, 17)).toBeGreaterThanOrEqual(5)
  })

  it('cuts the count down on a zoomed-in viewport', () => {
    // 101px interior, 64px ring: two rows at most, not five.
    expect(fitRowCount(101, 64 + 4, 17)).toBe(1)
  })

  it('accounts for a forced-larger minimum font size', () => {
    // Same card as the working case, but every row is 21px instead of 17px.
    expect(fitRowCount(171, 85 + 5, 21)).toBe(3)
    expect(fitRowCount(171, 85 + 5, 17)).toBe(4)
  })

  it('never returns a negative count', () => {
    expect(fitRowCount(40, 64, 17)).toBe(0)
  })

  it('shows everything when the row height cannot be measured', () => {
    // jsdom reports 0 for every box. Hiding all rows under test would be worse than
    // showing rows that would not fit in a real browser.
    expect(fitRowCount(0, 0, 0)).toBe(Infinity)
    expect(fitRowCount(288, 124, Number.NaN)).toBe(Infinity)
  })
})

describe('pickRows', () => {
  const row = (key: string, has: boolean) => ({ key, has })
  // An integrated GPU: only the model and the frequency have anything to show.
  const IGPU = [row('model', true), row('temp', false), row('vram', false), row('vramUse', false), row('freq', true)]
  // A discrete card fills in everything.
  const DISCRETE = [row('model', true), row('temp', true), row('vram', true), row('vramUse', true), row('freq', true)]

  it('keeps every row when they all fit', () => {
    expect(pickRows(DISCRETE, 5).map((r) => r.key)).toEqual(['model', 'temp', 'vram', 'vramUse', 'freq'])
    expect(pickRows(DISCRETE, Infinity)).toHaveLength(5)
  })

  it('drops the em-dash rows first, so nothing readable is lost', () => {
    expect(pickRows(IGPU, 2).map((r) => r.key)).toEqual(['model', 'freq'])
  })

  // Regression: the first version walked display order here, so with room for four
  // of five rows it dropped "Temp" and kept "VRAM" and "VRAM usage" -- both equally
  // blank. Importance order drops the least useful blank one instead.
  it('drops the least important blank row when only one has to go', () => {
    expect(pickRows(IGPU, 4).map((r) => r.key)).toEqual(['model', 'temp', 'vram', 'freq'])
  })

  it('drops the model name before any live reading', () => {
    expect(pickRows(IGPU, 1).map((r) => r.key)).toEqual(['freq'])
  })

  it('falls back to the declared order when every row has a reading', () => {
    expect(pickRows(DISCRETE, 3).map((r) => r.key)).toEqual(['temp', 'vram', 'freq'])
    expect(pickRows(DISCRETE, 1).map((r) => r.key)).toEqual(['freq'])
  })

  it('returns nothing at all when not even one row fits', () => {
    expect(pickRows(DISCRETE, 0)).toEqual([])
  })

  it('keeps the frequency last to go — on integrated graphics it is the only reading', () => {
    expect(STAT_DROP_ORDER[STAT_DROP_ORDER.length - 1]).toBe('freq')
  })
})
