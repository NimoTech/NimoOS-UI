import { describe, it, expect } from 'vitest'
import { dragCell, resizeSize } from './pointerMath'
import type { Dims } from './types'

const DIMS: Dims = { cols: 12, rows: 8 }
const stride = 100 // assumes cell 84 + gap 16

describe('dragCell', () => {
  it('rounds local offset to nearest cell (1-indexed) and clamps to grid', () => {
    expect(dragCell(0, 0, 2, 2, stride, DIMS)).toEqual({ c: 1, r: 1 })
    expect(dragCell(180, 0, 1, 1, stride, DIMS)).toEqual({ c: 3, r: 1 }) // round(1.8)=2 → +1 =3
    expect(dragCell(9999, 9999, 2, 2, stride, DIMS)).toEqual({ c: 11, r: 7 }) // clamped to cols-w+1 / rows-h+1
  })
})

describe('resizeSize', () => {
  it('computes span from local pointer minus origin, clamps to grid edge', () => {
    expect(resizeSize(180, 180, 1, 1, stride, DIMS)).toEqual([2, 2]) // round(1.8)=2 -(1-1)=2
    expect(resizeSize(0, 0, 3, 3, stride, DIMS)).toEqual([1, 1]) // lower bound 1
    expect(resizeSize(99999, 0, 5, 1, stride, DIMS)[0]).toBe(12 - 5 + 1) // clamped to cols-c+1=8
  })
})

import { cellAtPointer } from './pointerMath'

// Extracted from AddPanel so the dock can use the same hit-test. A pointer outside
// the grid must be null rather than a clamped edge cell: the caller distinguishes
// "dropped on the desktop" from "dropped somewhere else", and a clamped answer
// would place an item the user was trying not to place.
describe('cellAtPointer', () => {
  const rect = { left: 100, top: 50, right: 100 + 12 * 76, bottom: 50 + 8 * 76 }
  const grid = { cell: 60, gap: 16, cols: 12, rows: 8 }
  const one = { w: 1, h: 1 }

  it('returns null when the pointer is outside the grid', () => {
    expect(cellAtPointer(99, 60, rect, one, grid)).toBeNull()
    expect(cellAtPointer(200, 49, rect, one, grid)).toBeNull()
    expect(cellAtPointer(rect.right + 1, 60, rect, one, grid)).toBeNull()
    expect(cellAtPointer(200, rect.bottom + 1, rect, one, grid)).toBeNull()
  })

  it('maps the grid origin to cell 1,1', () => {
    expect(cellAtPointer(130, 80, rect, one, grid)).toEqual({ tc: 1, tr: 1 })
  })

  it('advances one column per step', () => {
    expect(cellAtPointer(130 + 76, 80, rect, one, grid)).toEqual({ tc: 2, tr: 1 })
    expect(cellAtPointer(130, 80 + 76, rect, one, grid)).toEqual({ tc: 1, tr: 2 })
  })

  // A wide item cannot start so far right that it would hang off the grid.
  it('clamps so the item fits inside the grid', () => {
    expect(cellAtPointer(rect.right - 1, rect.bottom - 1, rect, { w: 4, h: 2 }, grid))
      .toEqual({ tc: 9, tr: 7 })
  })
})
