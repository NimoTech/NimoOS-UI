// SP15-P1-T2: mosaic size/template pure functions. Ported field-by-field from Vue2
// 899af59b:src/views/Photos/PhotosSmartViewsView.vue:322-357 (classifyMomentSize/
// pickMomentTemplate/assignMomentSizes); the rules themselves are unchanged.
import { describe, it, expect } from 'vitest'
import {
  classifyMomentSize, pickMomentTemplate, assignMomentSizes, packMasonry, spanForMomentSize,
  type MomentLayoutInput, type MasonryItem,
} from '../momentLayout'

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

describe('spanForMomentSize', () => {
  it('maps each size to the exact col/row spans the deleted CSS spans used to encode (photos-smartview.scss:144-146)', () => {
    expect(spanForMomentSize('standard')).toEqual({ colSpan: 1, rowSpan: 3 })
    expect(spanForMomentSize('wide')).toEqual({ colSpan: 2, rowSpan: 3 })
    expect(spanForMomentSize('tall')).toEqual({ colSpan: 1, rowSpan: 5 })
  })
})

// Fix-6 (owner acceptance, 2026-08-18): the masonry packer that replaces CSS Grid's own
// `grid-auto-flow: row dense` auto-placement. See momentLayout.ts's own header comment above
// packMasonry for the full root-cause trace (a column can lose a same-row tie to a leftward
// column and then sit empty for several rows until a later wide card claims it).
describe('packMasonry', () => {
  /** Reconstructs each column's occupied row-intervals from the returned placements and asserts
   *  every void is bounded by `maxAllowedVoid` (rows) — the actual bug this packer exists to
   *  prevent was an *unbounded*, multi-row void (measured up to 756px / ~5 rows in the isolated
   *  repro against the production CSS, and growing with list composition). A small residual gap
   *  smaller than any real card's own rowSpan (3, for a standard card) is a genuine, bounded
   *  geometric remainder of this system's discrete row units (rowSpan only ever 3 or 5) — no
   *  card could ever have filled it, so it is not a missed placement, just an unavoidable
   *  leftover. Defaults to 0 (strict, no gap at all) for callers that don't hit that edge case. */
  function assertVoidsBounded(items: MasonryItem[], numColumns: number, maxAllowedVoid = 0): void {
    const placements = packMasonry(items, numColumns)
    const byCol = new Map<number, Array<{ start: number; end: number }>>()
    for (const item of items) {
      const p = placements[item.id]
      const span = Math.max(1, Math.min(item.colSpan, Math.max(1, numColumns)))
      for (let c = p.colStart; c < p.colStart + span; c++) {
        const list = byCol.get(c) ?? []
        list.push({ start: p.rowStart, end: p.rowStart + item.rowSpan })
        byCol.set(c, list)
      }
    }
    for (const [col, intervals] of byCol) {
      intervals.sort((a, b) => a.start - b.start)
      let cursor = 1
      for (const iv of intervals) {
        const voidSize = iv.start - cursor
        expect(voidSize, `column ${col}: void of ${voidSize} rows before row ${iv.start} exceeds the allowed bound of ${maxAllowedVoid}`)
          .toBeLessThanOrEqual(maxAllowedVoid)
        expect(voidSize, `column ${col}: negative void (overlap) before row ${iv.start}`).toBeGreaterThanOrEqual(0)
        cursor = iv.end
      }
    }
  }

  it('a single standard item is placed at the origin', () => {
    const items: MasonryItem[] = [{ id: 'a', colSpan: 1, rowSpan: 3 }]
    expect(packMasonry(items, 3)).toEqual({ a: { colStart: 1, rowStart: 1, colSpan: 1, rowSpan: 3 } })
  })

  it('two standard items with 2 columns land side by side on row 1 (ties keep the leftmost)', () => {
    const items: MasonryItem[] = [{ id: 'a', colSpan: 1, rowSpan: 3 }, { id: 'b', colSpan: 1, rowSpan: 3 }]
    expect(packMasonry(items, 2)).toEqual({
      a: { colStart: 1, rowStart: 1, colSpan: 1, rowSpan: 3 },
      b: { colStart: 2, rowStart: 1, colSpan: 1, rowSpan: 3 },
    })
  })

  it('a wide (2-col) item picks the pair of adjacent columns with the lowest combined height', () => {
    // col1 gets a standard first (height 3); with 3 columns, the wide item's only 2-adjacent-free
    // options are (1,2) [max height 3] and (2,3) [max height 0] — it must pick (2,3).
    const items: MasonryItem[] = [
      { id: 'a', colSpan: 1, rowSpan: 3 },
      { id: 'w', colSpan: 2, rowSpan: 3 },
    ]
    const out = packMasonry(items, 3)
    expect(out.w).toEqual({ colStart: 2, rowStart: 1, colSpan: 2, rowSpan: 3 })
  })

  it('a wide item degrades to 1 column when the container only offers 1 (replaces the deleted @media fallback)', () => {
    const items: MasonryItem[] = [{ id: 'w', colSpan: 2, rowSpan: 3 }]
    expect(packMasonry(items, 1)).toEqual({ w: { colStart: 1, rowStart: 1, colSpan: 1, rowSpan: 3 } })
  })

  it('bounds the void to well under the original bug: the exact realistic mix that produced a 5-row/756px void under plain CSS Grid dense', () => {
    // Reproduces the acceptance repro's data shape: recurring recipes cycling trip (wide
    // candidate)/theme/pets/family, with an occasional portrait cover (tall candidate) — the
    // same mix that, measured against the actual .mo-grid CSS via getBoundingClientRect in an
    // isolated harness, left one column empty for multiple rows (a 312px-756px / 2-5 row void)
    // while a wide card several rows later claimed it. `maxAllowedVoid: 2` (< the smallest real
    // rowSpan, 3) proves any remaining gap is the genuine unfillable geometric remainder
    // described in packMasonry's header comment, not a resurgence of the original bug.
    const sizes: Array<'wide' | 'standard' | 'tall'> = [
      'wide', 'standard', 'tall', 'standard', 'wide', 'standard', 'standard', 'tall',
      'wide', 'standard', 'standard', 'standard', 'tall', 'standard', 'standard', 'wide',
    ]
    const items: MasonryItem[] = sizes.map((size, i) => ({ id: 'm' + i, ...spanForMomentSize(size) }))
    assertVoidsBounded(items, 4, 2)
    assertVoidsBounded(items, 3, 2)
    assertVoidsBounded(items, 2, 2)
    assertVoidsBounded(items, 1, 2)
  })

  it('never leaves any void at all when every item is the same size (no wide/tall mix to create a shortfall)', () => {
    const items: MasonryItem[] = Array.from({ length: 12 }, (_, i) => ({ id: 'm' + i, colSpan: 1 as const, rowSpan: 3 }))
    assertVoidsBounded(items, 4, 0)
    assertVoidsBounded(items, 3, 0)
  })

  it('backfills a pending gap with a later single-column item when it exactly fits', () => {
    // Engineered to force a real, exactly-fillable shortfall:
    //  A (col-span1, row-span5) -> col0: 0 -> 5
    //  B (col-span1, row-span3) -> shortest is col1 (0 < col0's 5): col1: 0 -> 3
    //  heights are now [5, 3, 0]
    //  C (col-span2, row-span3) -> the two adjacent-pair options are (col0,col1)=max(5,3)=5 and
    //    (col1,col2)=max(3,0)=3 — the second wins. col1 is already at 3 (no shortfall), but col2
    //    jumps straight from 0 to 3, leaving exactly a 3-row gap [0,3) in col2 -- precisely one
    //    standard card's worth.
    //  D (col-span1, row-span3) -> without backfill this would go to "shortest column" (col1 or
    //    col2, both now at 6) and land at row 7; WITH backfill it must reclaim col2's pending
    //    [0,3) gap instead, landing at row 1.
    const items: MasonryItem[] = [
      { id: 'a', colSpan: 1, rowSpan: 5 },
      { id: 'b', colSpan: 1, rowSpan: 3 },
      { id: 'c', colSpan: 2, rowSpan: 3 },
      { id: 'd', colSpan: 1, rowSpan: 3 },
    ]
    const out = packMasonry(items, 3)
    expect(out.a).toMatchObject({ colStart: 1, rowStart: 1 })
    expect(out.b).toMatchObject({ colStart: 2, rowStart: 1 })
    expect(out.c).toMatchObject({ colStart: 2, rowStart: 4 })
    expect(out.d).toMatchObject({ colStart: 3, rowStart: 1 }) // backfilled into col2's [0,3) gap, not row 7
    assertVoidsBounded(items, 3, 0)
  })

  it('an empty list returns an empty map, does not throw', () => {
    expect(packMasonry([], 3)).toEqual({})
  })

  it('numColumns is clamped to at least 1 (never divides by zero / produces an empty span)', () => {
    const items: MasonryItem[] = [{ id: 'a', colSpan: 1, rowSpan: 3 }]
    expect(packMasonry(items, 0)).toMatchObject({ a: { colStart: 1, rowStart: 1 } })
    expect(packMasonry(items, -5)).toMatchObject({ a: { colStart: 1, rowStart: 1 } })
  })

  it('is a pure function: calling twice with the same input gives deep-equal results', () => {
    const items: MasonryItem[] = [{ id: 'a', colSpan: 1, rowSpan: 3 }, { id: 'b', colSpan: 2, rowSpan: 3 }]
    expect(packMasonry(items, 3)).toEqual(packMasonry(items, 3))
  })
})
