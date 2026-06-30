import { describe, it, expect } from 'vitest'
import { magScale } from './dockMath'
describe('magScale', () => {
  it('peaks at distance 0 (1+0.55) and decays with distance', () => {
    expect(magScale(0)).toBeCloseTo(1.55, 3)
    expect(magScale(70)).toBeLessThan(magScale(0))
    expect(magScale(70)).toBeGreaterThan(1)
    expect(magScale(99999)).toBeCloseTo(1, 3)
  })
})
