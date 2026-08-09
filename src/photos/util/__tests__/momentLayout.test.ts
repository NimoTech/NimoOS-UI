// SP15-P1-T2: mosaic size/template pure functions. Ported field-by-field from Vue2
// 899af59b:src/views/Photos/PhotosSmartViewsView.vue:322-357 (classifyMomentSize/
// pickMomentTemplate/assignMomentSizes); the rules themselves are unchanged.
import { describe, it, expect } from 'vitest'
import { classifyMomentSize, pickMomentTemplate, assignMomentSizes, type MomentLayoutInput } from '../momentLayout'

function m(over: Partial<MomentLayoutInput> = {}): MomentLayoutInput {
  return { id: 'x', recipeKey: 'theme:food', assetCount: 10, coverRatio: 1.5, featuredAssetIds: ['a', 'b'], ...over }
}

describe('classifyMomentSize', () => {
  it('portrait cover (0 < ratio < 0.85) is judged tall, and takes priority over wide', () => {
    expect(classifyMomentSize(m({ coverRatio: 0.6 }))).toBe('tall')
    // When both the tall and wide conditions are met, tall wins (Vue2 checks in order, first match returns)
    expect(classifyMomentSize(m({ coverRatio: 0.6, recipeKey: 'trip:1', assetCount: 200 }))).toBe('tall')
  })
  it('ratio exactly 0 means unknown, does not count as tall', () => {
    expect(classifyMomentSize(m({ coverRatio: 0 }))).toBe('standard')
  })
  it('ratio exactly 0.85 is the open interval\'s upper bound, does not count as tall', () => {
    expect(classifyMomentSize(m({ coverRatio: 0.85 }))).toBe('standard')
  })
  it('trip prefix with assetCount >= 100 counts as wide; 99 assets does not', () => {
    expect(classifyMomentSize(m({ coverRatio: 1.5, recipeKey: 'trip', assetCount: 100 }))).toBe('wide')
    expect(classifyMomentSize(m({ coverRatio: 1.5, recipeKey: 'trip', assetCount: 99 }))).toBe('standard')
  })
  it('recipeKey merely containing trip (not starting with it) does not count as wide', () => {
    expect(classifyMomentSize(m({ coverRatio: 1.5, recipeKey: 'theme:trip', assetCount: 500 }))).toBe('standard')
  })
})

describe('pickMomentTemplate', () => {
  it('featured >= 2 picks T2/T4/T1 by size class', () => {
    expect(pickMomentTemplate('tall', 2)).toBe('T2')
    expect(pickMomentTemplate('wide', 3)).toBe('T4')
    expect(pickMomentTemplate('standard', 2)).toBe('T1')
  })
  it('featured == 1 falls to T3 regardless of size class (never drops to a single image)', () => {
    expect(pickMomentTemplate('tall', 1)).toBe('T3')
    expect(pickMomentTemplate('wide', 1)).toBe('T3')
    expect(pickMomentTemplate('standard', 1)).toBe('T3')
  })
  it('featured == 0 falls to single', () => {
    expect(pickMomentTemplate('wide', 0)).toBe('single')
  })
})

describe('assignMomentSizes', () => {
  it('spacing quota: a wide fewer than 3 positions after the last wide is downgraded to standard', () => {
    const wide = (id: string) => m({ id, coverRatio: 1.5, recipeKey: 'trip', assetCount: 200 })
    const out = assignMomentSizes([wide('a'), wide('b'), wide('c'), wide('d')])
    // idx0 passes (lastWide = -Infinity); idx1/idx2 are too close → downgraded; idx3 is exactly 3 past idx0 → passes
    expect([out.a.size, out.b.size, out.c.size, out.d.size]).toEqual(['wide', 'standard', 'standard', 'wide'])
  })
  it('spacing quota: a tall fewer than 2 positions after the last tall is downgraded to standard', () => {
    const tall = (id: string) => m({ id, coverRatio: 0.6 })
    const out = assignMomentSizes([tall('a'), tall('b'), tall('c')])
    expect([out.a.size, out.b.size, out.c.size]).toEqual(['tall', 'standard', 'tall'])
  })
  it('a downgraded item does not update "the position of the last wide/tall"', () => {
    // Only a size that actually survives counts toward the position baseline — if a downgraded
    // item counted too, the 4th item would be incorrectly downgraded as well
    const wide = (id: string) => m({ id, coverRatio: 1.5, recipeKey: 'trip', assetCount: 200 })
    const out = assignMomentSizes([wide('a'), wide('b'), wide('c'), wide('d')])
    expect(out.d.size).toBe('wide')
  })
  it('after downgrading to standard, the template is recomputed for the standard size class', () => {
    const tall = (id: string) => m({ id, coverRatio: 0.6, featuredAssetIds: ['p', 'q'] })
    const out = assignMomentSizes([tall('a'), tall('b')])
    expect(out.a.template).toBe('T2')
    expect(out.b.template).toBe('T1') // downgraded to standard ⇒ T1, not T2
  })
  it('featuredAssetIds truly missing (not an array) counts as 0, falls to single', () => {
    // Cast past strict TypeScript to exercise the Array.isArray defensive branch itself,
    // not just its true side — an omitted/non-array field is what the guard is actually for.
    const out = assignMomentSizes([
      { id: 'a', recipeKey: 'theme:food', assetCount: 3, coverRatio: 1.5 } as unknown as MomentLayoutInput,
    ])
    expect(out.a.template).toBe('single')
  })
  it('featuredAssetIds as an empty array also counts as 0, falls to single', () => {
    const out = assignMomentSizes([{ id: 'a', recipeKey: 'theme:food', assetCount: 3, coverRatio: 1.5, featuredAssetIds: [] }])
    expect(out.a.template).toBe('single')
  })
  it('an empty list returns an empty map, does not throw', () => {
    expect(assignMomentSizes([])).toEqual({})
  })
  it('is a pure function: calling twice with the same input gives deep-equal results', () => {
    const list = [m({ id: 'a' }), m({ id: 'b', coverRatio: 0.6 })]
    expect(assignMomentSizes(list)).toEqual(assignMomentSizes(list))
  })
})
