import { describe, it, expect } from 'vitest'
import { dragCell, resizeSize } from './pointerMath'
import type { Dims } from './types'

const DIMS: Dims = { cols: 12, rows: 8 }
const stride = 100 // cell 84 + gap 16 假设

describe('dragCell', () => {
  it('rounds local offset to nearest cell (1-indexed) and clamps to grid', () => {
    expect(dragCell(0, 0, 2, 2, stride, DIMS)).toEqual({ c: 1, r: 1 })
    expect(dragCell(180, 0, 1, 1, stride, DIMS)).toEqual({ c: 3, r: 1 }) // round(1.8)=2 → +1 =3
    expect(dragCell(9999, 9999, 2, 2, stride, DIMS)).toEqual({ c: 11, r: 7 }) // 夹到 cols-w+1 / rows-h+1
  })
})

describe('resizeSize', () => {
  it('computes span from local pointer minus origin, clamps to grid edge', () => {
    expect(resizeSize(180, 180, 1, 1, stride, DIMS)).toEqual([2, 2]) // round(1.8)=2 -(1-1)=2
    expect(resizeSize(0, 0, 3, 3, stride, DIMS)).toEqual([1, 1]) // 下限 1
    expect(resizeSize(99999, 0, 5, 1, stride, DIMS)[0]).toBe(12 - 5 + 1) // 夹到 cols-c+1=8
  })
})
