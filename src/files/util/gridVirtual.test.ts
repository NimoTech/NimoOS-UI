import { describe, it, expect } from 'vitest'
import { columnsFor, chunkRows, computeVisibleRange } from './gridVirtual'

describe('columnsFor', () => {
  it('matches CSS auto-fill: floor((width + gap) / (min + gap))', () => {
    expect(columnsFor(614, 120, 14)).toBe(4) // (614+14)/134 = 4.68
    expect(columnsFor(134, 120, 14)).toBe(1)
    expect(columnsFor(268, 120, 14)).toBe(2)
  })

  it('never returns less than one column, even at zero width', () => {
    expect(columnsFor(0, 120, 14)).toBe(1)
    expect(columnsFor(-5, 120, 14)).toBe(1)
  })
})

describe('chunkRows', () => {
  it('slices a flat list into rows of `cols`', () => {
    expect(chunkRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('returns an empty array for an empty list', () => {
    expect(chunkRows([], 3)).toEqual([])
  })

  it('coerces a nonsense column count to 1 rather than looping forever', () => {
    expect(chunkRows([1, 2], 0)).toEqual([[1], [2]])
    expect(chunkRows([1, 2], -3)).toEqual([[1], [2]])
    expect(chunkRows([1, 2], 1.7)).toEqual([[1], [2]])
  })
})

describe('computeVisibleRange', () => {
  const base = { rowHeight: 130, rowCount: 100, buffer: 2 }

  it('covers the viewport plus the buffer on both sides', () => {
    // scrollTop 1300 -> row 10 at the top; a 600px viewport spans ~4.6 rows
    const r = computeVisibleRange({ ...base, scrollTop: 1300, viewportHeight: 600 })
    expect(r.start).toBe(8) // 10 - buffer
    expect(r.end).toBe(17) // ceil((1300+600)/130)=15, +2 buffer
  })

  it('clamps to the start of the list', () => {
    expect(computeVisibleRange({ ...base, scrollTop: 0, viewportHeight: 600 }).start).toBe(0)
  })

  it('clamps to the end of the list', () => {
    const r = computeVisibleRange({ ...base, scrollTop: 99999, viewportHeight: 600 })
    expect(r.end).toBe(100)
    expect(r.start).toBeLessThanOrEqual(100)
  })

  it('renders everything when the row height is unknown, rather than nothing', () => {
    const r = computeVisibleRange({ ...base, rowHeight: 0, scrollTop: 0, viewportHeight: 600 })
    expect(r).toEqual({ start: 0, end: 100 })
  })

  it('returns an empty range for an empty list', () => {
    expect(computeVisibleRange({ ...base, rowCount: 0, scrollTop: 0, viewportHeight: 600 })).toEqual({
      start: 0,
      end: 0,
    })
  })
})
