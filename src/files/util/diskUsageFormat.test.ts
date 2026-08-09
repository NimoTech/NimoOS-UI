import { describe, it, expect } from 'vitest'
import { usedPercent } from './diskUsageFormat'

describe('usedPercent', () => {
  it('rounds the used share to a whole percent', () => {
    expect(usedPercent({ used: 400, total: 1000, avail: 600 })).toBe(40)
    expect(usedPercent({ used: 336, total: 1000, avail: 664 })).toBe(34)
  })

  it('floors a non-empty disk at 1% so the bar is never invisible', () => {
    expect(usedPercent({ used: 1, total: 1_000_000, avail: 999_999 })).toBe(1)
  })

  it('reports 0 for a genuinely empty disk', () => {
    expect(usedPercent({ used: 0, total: 1000, avail: 1000 })).toBe(0)
  })

  it('reports 0 rather than dividing by zero or by nothing', () => {
    expect(usedPercent({ used: 5, total: 0, avail: 0 })).toBe(0)
    expect(usedPercent(null)).toBe(0)
  })

  it('clamps a backend overshoot to 100', () => {
    expect(usedPercent({ used: 1200, total: 1000, avail: 0 })).toBe(100)
  })
})
