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

import { dropTarget } from './dockMath'

// Slots are (key, midX) pairs read from the DOM by HomeDock. Extracted here
// because jsdom reports every getBoundingClientRect as 0, so a component test
// cannot say anything about where a drop lands.
describe('dropTarget', () => {
  const fav = [{ key: 'files', midX: 100 }, { key: 'photos', midX: 200 }]
  const more = [{ key: 'settings', midX: 400 }, { key: 'kvm', midX: 500 }]

  it('picks the favourites zone left of the separator and more to its right', () => {
    expect(dropTarget(120, 300, fav, more).toZone).toBe('fav')
    expect(dropTarget(420, 300, fav, more).toZone).toBe('more')
  })
  it('inserts before the nearest slot when dropped to its left', () => {
    expect(dropTarget(180, 300, fav, more).beforeKey).toBe('photos')
  })
  it('appends when dropped to the right of the nearest slot', () => {
    expect(dropTarget(230, 300, fav, more).beforeKey).toBeNull()
  })
  it('appends into an empty zone', () => {
    expect(dropTarget(120, 300, [], more)).toEqual({ toZone: 'fav', beforeKey: null })
  })
  // The separator is rendered only on desktop (v-if="!isMobile"), and the
  // pre-existing behaviour without one is to target the more zone.
  it('targets the more zone when there is no separator', () => {
    expect(dropTarget(10, null, fav, more).toZone).toBe('more')
  })
})
