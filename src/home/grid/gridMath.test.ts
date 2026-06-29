import { describe, it, expect } from 'vitest'
import { cells, occupiedSet, fits, firstFree, firstFreeIn, planFootprint } from './gridMath'
import type { LayoutItem, Dims } from './types'

const DIMS: Dims = { cols: 12, rows: 8 }
const mk = (id: string, c: number, r: number, w: number, h: number): LayoutItem =>
  ({ id, kind: 'app', key: id, c, r, w, h })

describe('cells', () => {
  it('lists every occupied "c,r" cell', () => {
    expect(cells({ c: 2, r: 3, w: 2, h: 2 }).sort()).toEqual(['2,3', '2,4', '3,3', '3,4'].sort())
  })
})

describe('occupiedSet', () => {
  it('unions all items except the excepted id', () => {
    const layout = [mk('a', 1, 1, 1, 1), mk('b', 2, 1, 1, 1)]
    expect(occupiedSet(layout, 'b').has('1,1')).toBe(true)
    expect(occupiedSet(layout, 'b').has('2,1')).toBe(false)
  })
})

describe('fits', () => {
  const layout = [mk('a', 1, 1, 2, 2)]
  it('rejects out-of-bounds placements', () => {
    expect(fits(12, 1, 2, 1, null, layout, DIMS)).toBe(false) // 越右边界
    expect(fits(1, 8, 1, 2, null, layout, DIMS)).toBe(false)  // 越下边界
    expect(fits(0, 1, 1, 1, null, layout, DIMS)).toBe(false)  // c<1
  })
  it('rejects overlap with existing item', () => {
    expect(fits(2, 2, 1, 1, null, layout, DIMS)).toBe(false)
  })
  it('accepts a free in-bounds slot', () => {
    expect(fits(5, 5, 2, 2, null, layout, DIMS)).toBe(true)
  })
  it('ignores the excepted item when checking overlap', () => {
    expect(fits(1, 1, 2, 2, 'a', layout, DIMS)).toBe(true)
  })
})

describe('firstFree', () => {
  it('returns row-major first free slot', () => {
    const layout = [mk('a', 1, 1, 1, 1)]
    expect(firstFree(1, 1, layout, DIMS)).toEqual({ c: 2, r: 1 })
  })
  it('returns null when nothing fits', () => {
    // 填满整张 12x8 网格
    const full: LayoutItem[] = []
    let id = 0
    for (let r = 1; r <= 8; r++) for (let c = 1; c <= 12; c++) full.push(mk('f' + id++, c, r, 1, 1))
    expect(firstFree(1, 1, full, DIMS)).toBeNull()
  })
})

describe('firstFreeIn', () => {
  it('finds a slot avoiding the occupied set', () => {
    const occ = new Set<string>(['1,1'])
    expect(firstFreeIn(occ, 1, 1, DIMS)).toEqual({ c: 2, r: 1 })
  })
})

describe('planFootprint', () => {
  it('returns boundary null when target is off-grid', () => {
    expect(planFootprint(12, 1, 2, 1, null, [], DIMS)).toBeNull()
  })
  it('leaves non-overlapping items untouched', () => {
    const layout = [mk('a', 1, 1, 1, 1), mk('b', 5, 5, 1, 1)]
    const out = planFootprint(8, 8, 1, 1, null, layout, DIMS)!
    expect(out.find((i) => i.id === 'a')).toMatchObject({ c: 1, r: 1 })
    expect(out.find((i) => i.id === 'b')).toMatchObject({ c: 5, r: 5 })
  })
  it('displaces an overlapped item to the first free slot', () => {
    const layout = [mk('a', 1, 1, 1, 1)] // 占 1,1
    const out = planFootprint(1, 1, 1, 1, null, layout, DIMS)! // 新项目要占 1,1 → a 让位
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('a')
    expect(out[0]).toMatchObject({ c: 2, r: 1 }) // 让到下一个行优先空位
  })
  it('returns null when a displaced item cannot be re-placed', () => {
    // 整张网格被占满 → 任意落子都无法让位
    const full: LayoutItem[] = []
    let id = 0
    for (let r = 1; r <= 8; r++) for (let c = 1; c <= 12; c++) full.push(mk('f' + id++, c, r, 1, 1))
    expect(planFootprint(1, 1, 1, 1, null, full, DIMS)).toBeNull()
  })
})
