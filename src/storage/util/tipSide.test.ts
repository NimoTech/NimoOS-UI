import { describe, it, expect } from 'vitest'
import { tipSide, TIP_RESERVE } from './tipSide'

// Expansion direction for the drive-selection card's hover tooltip. It used to expand
// upward (matching Vue2), but the first row of the drive-selection area sits flush
// against the top bar, so the tooltip got covered by it (2026-07-30 real-device user
// feedback) → changed to expand rightward; when there is no room on the right it flips
// to the left, so we do not mirror the same "clipped by the boundary" problem onto the
// rightmost column.
describe('tipSide', () => {
  it('enough space on the right → right', () => {
    expect(tipSide({ left: 100, right: 200 }, 1000, 210)).toBe('right')
  })

  it('no room on the right → flips to left', () => {
    expect(tipSide({ left: 800, right: 900 }, 1000, 210)).toBe('left')
  })

  it('exactly enough room counts as right; 1px short flips to left (boundary case; the card needs room on the left to flip)', () => {
    expect(tipSide({ left: 690, right: 790 }, 1000, 210)).toBe('right')
    expect(tipSide({ left: 691, right: 791 }, 1000, 210)).toBe('left')
  })

  it('when neither side has room, still choose right (flipping left would only be worse)', () => {
    expect(tipSide({ left: 5, right: 995 }, 1000, 210)).toBe('right')
  })

  it('uses TIP_RESERVE when the width parameter is omitted', () => {
    expect(TIP_RESERVE).toBeGreaterThan(0)
    expect(tipSide({ left: 0, right: 1000 - TIP_RESERVE }, 1000)).toBe('right')
    expect(tipSide({ left: 300, right: 1000 - TIP_RESERVE + 1 }, 1000)).toBe('left')
  })
})
