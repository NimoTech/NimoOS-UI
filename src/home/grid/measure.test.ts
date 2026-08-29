import { describe, it, expect } from 'vitest'
import { computeCell } from './measure'

describe('computeCell', () => {
  it('takes the min of width- and height-constrained cell size, floored', () => {
    // availW constraint: (1480-11*16)/12 = 108.66 → 108; availH constraint is smaller so takes that
    const byW = computeCell(1480, 10000, 12, 8, 16)
    expect(byW).toBe(Math.floor((1480 - 11 * 16) / 12))
  })
  it('never goes below 40', () => {
    expect(computeCell(100, 100, 12, 8, 16)).toBe(40)
  })
})
