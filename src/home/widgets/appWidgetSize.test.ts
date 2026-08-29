import { describe, it, expect } from 'vitest'
import { APP_WIDGET_SIZE, appWidgetRange } from './appWidgetSize'

describe('appWidgetRange', () => {
  it('Undeclared/empty object → global range', () => {
    expect(appWidgetRange(undefined)).toEqual(APP_WIDGET_SIZE)
    expect(appWidgetRange({})).toEqual(APP_WIDGET_SIZE)
  })

  it('Partial declaration: missing axes fill global values', () => {
    expect(appWidgetRange({ maxw: 3 })).toEqual({ min: [2, 1], max: [3, 4] })
    expect(appWidgetRange({ minh: 2 })).toEqual({ min: [2, 2], max: [4, 4] })
  })

  it('min==max lock (canResize hides handle accordingly)', () => {
    expect(appWidgetRange({ minw: 3, maxw: 3, minh: 2, maxh: 2 })).toEqual({ min: [3, 2], max: [3, 2] })
  })

  it('Out-of-bounds values clamped to global 2×1..4×4', () => {
    expect(appWidgetRange({ minw: 1, maxw: 9, minh: 0, maxh: 9 })).toEqual({ min: [2, 1], max: [4, 4] })
  })

  it('When min > max, use min as authoritative (max raised to min)', () => {
    expect(appWidgetRange({ minw: 4, maxw: 2 })).toEqual({ min: [4, 1], max: [4, 4] })
    expect(appWidgetRange({ minh: 3, maxh: 1 })).toEqual({ min: [2, 3], max: [4, 3] })
  })
})
