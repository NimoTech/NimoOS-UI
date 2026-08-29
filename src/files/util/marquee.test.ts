import { describe, it, expect } from 'vitest'
import { rectFromPoints, marqueeSelect, type ItemRect } from './marquee'

describe('rectFromPoints', () => {
  it('normalizes any drag direction into a top-left/bottom-right rect', () => {
    expect(rectFromPoints(10, 10, 40, 50)).toEqual({ left: 10, top: 10, right: 40, bottom: 50 })
    expect(rectFromPoints(40, 50, 10, 10)).toEqual({ left: 10, top: 10, right: 40, bottom: 50 })
  })
})

describe('marqueeSelect', () => {
  const items: ItemRect[] = [
    { path: 'a', rect: { left: 0, top: 0, right: 20, bottom: 20 } },
    { path: 'b', rect: { left: 30, top: 0, right: 50, bottom: 20 } },
    { path: 'c', rect: { left: 0, top: 30, right: 20, bottom: 50 } },
  ]
  it('returns items overlapping the selection rect', () => {
    expect(marqueeSelect(items, { left: 5, top: 5, right: 35, bottom: 10 })).toEqual(['a', 'b'])
  })
  it('returns empty when nothing overlaps', () => {
    expect(marqueeSelect(items, { left: 100, top: 100, right: 120, bottom: 120 })).toEqual([])
  })
  it('edge-touching does not count as overlap (strict)', () => {
    // selRect right edge at 30 exactly meets b.left=30 → no overlap
    expect(marqueeSelect(items, { left: 22, top: 0, right: 30, bottom: 20 })).toEqual([])
  })
})
