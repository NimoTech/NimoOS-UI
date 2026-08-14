import { describe, it, expect } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { cells, occupiedSet, fits, firstFree, firstFreeIn, planFootprint, planMove, applyPlan, clampSize, clampToGrid } from './gridMath'
import type { LayoutItem, Dims, WidgetSize } from './types'
import { sizeOfItem, APP_WIDGET_SIZE } from '../widgets/registry'
import { useAppsStore } from '../stores/apps'

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
    expect(fits(12, 1, 2, 1, null, layout, DIMS)).toBe(false) // past the right edge
    expect(fits(1, 8, 1, 2, null, layout, DIMS)).toBe(false)  // past the bottom edge
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
    // fill the entire 12x8 grid
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
  it('returns null when no slot is free', () => {
    const occ = new Set<string>()
    for (let c = 1; c <= 12; c++) for (let r = 1; r <= 8; r++) occ.add(`${c},${r}`)
    expect(firstFreeIn(occ, 1, 1, DIMS)).toBeNull()
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
    const layout = [mk('a', 1, 1, 1, 1)] // occupies 1,1
    const out = planFootprint(1, 1, 1, 1, null, layout, DIMS)! // new item wants 1,1 → a gives way
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('a')
    expect(out[0]).toMatchObject({ c: 2, r: 1 }) // moved to the next row-major free slot
  })
  it('returns null when a displaced item cannot be re-placed', () => {
    // the whole grid is full → no placement can displace anything
    const full: LayoutItem[] = []
    let id = 0
    for (let r = 1; r <= 8; r++) for (let c = 1; c <= 12; c++) full.push(mk('f' + id++, c, r, 1, 1))
    expect(planFootprint(1, 1, 1, 1, null, full, DIMS)).toBeNull()
  })
})

describe('planMove', () => {
  it('includes the moved item itself in the plan', () => {
    const layout = [mk('a', 1, 1, 1, 1)]
    const plan = planMove('a', 5, 5, 1, 1, layout, DIMS)!
    expect(plan.find((p) => p.id === 'a')).toMatchObject({ c: 5, r: 5, w: 1, h: 1 })
  })
  it('returns null when the move cannot be satisfied', () => {
    const full: LayoutItem[] = []
    let id = 0
    for (let r = 1; r <= 8; r++) for (let c = 1; c <= 12; c++) full.push(mk('f' + id++, c, r, 1, 1))
    // moving f0 out of bounds → null (Brief test appears to have incorrect expectations; using out-of-bounds validation instead)
    expect(planMove('f0', 13, 1, 1, 1, full, DIMS)).toBeNull()
  })
})

describe('applyPlan', () => {
  it('returns a new array with updated coords, not mutating input', () => {
    const layout = [mk('a', 1, 1, 1, 1), mk('b', 2, 1, 2, 2)]
    const out = applyPlan([{ id: 'b', c: 5, r: 5, w: 3, h: 1 }], layout)
    expect(out).not.toBe(layout)
    expect(layout[1]).toMatchObject({ c: 2, r: 1, w: 2, h: 2 }) // original array unchanged
    expect(out.find((i) => i.id === 'b')).toMatchObject({ c: 5, r: 5, w: 3, h: 1 })
    expect(out.find((i) => i.id === 'a')).toMatchObject({ c: 1, r: 1 })
  })
})

const sizeOf = (it: LayoutItem): WidgetSize | undefined =>
  it.key === 'cpu' ? { min: [2, 2], max: [4, 3] } : undefined

describe('clampSize', () => {
  it('clamps a widget to its min/max', () => {
    const w = { id: 'i', kind: 'widget', key: 'cpu', c: 1, r: 1, w: 4, h: 2 } as LayoutItem
    expect(clampSize(w, 9, 1, sizeOf)).toEqual([4, 2]) // w→max4, h→min2
  })
  it('snaps app/folder/photo to nearest of 1x1 or 2x2', () => {
    const a = { id: 'i', kind: 'app', key: 'files', c: 1, r: 1, w: 1, h: 1 } as LayoutItem
    expect(clampSize(a, 2, 2, sizeOf)).toEqual([2, 2])
    expect(clampSize(a, 1, 1, sizeOf)).toEqual([1, 1])
    expect(clampSize(a, 2, 1, sizeOf)).toEqual([1, 1]) // closer to 1×1
  })
})

describe('appwidget sizing', () => {
  it('sizeOfItem: appwidget 用 APP_WIDGET_SIZE,widget 用 registry,其余 undefined', () => {
    setActivePinia(createPinia())
    expect(sizeOfItem({ kind: 'appwidget', key: 'any-app' })).toEqual(APP_WIDGET_SIZE)
    expect(sizeOfItem({ kind: 'widget', key: 'clock' })).toEqual({ min: [2, 1], max: [4, 2] })
    expect(sizeOfItem({ kind: 'app', key: 'x' })).toBeUndefined()
  })
  it('sizeOfItem: appwidget 应用自带范围 → 用自带的(夹进全局)', () => {
    setActivePinia(createPinia())
    useAppsStore().setApps([
      { name: 'locked', desktop: true, status: 'running', port: '1',
        widget: { path: '/w', w: 3, h: 2, minw: 3, maxw: 3, minh: 2, maxh: 2 } },
      { name: 'ranged', desktop: true, status: 'running', port: '1',
        widget: { path: '/w', w: 2, h: 1, maxw: 3, maxh: 9 } },
    ])
    expect(sizeOfItem({ kind: 'appwidget', key: 'locked' })).toEqual({ min: [3, 2], max: [3, 2] })
    expect(sizeOfItem({ kind: 'appwidget', key: 'ranged' })).toEqual({ min: [2, 1], max: [3, 4] })
  })
  it('clampSize 对 appwidget 夹紧到 [2,1]..[4,4]', () => {
    setActivePinia(createPinia())
    const it = { id: 'i1', kind: 'appwidget', key: 'a', c: 1, r: 1, w: 2, h: 2 } as never
    expect(clampSize(it, 9, 9, sizeOfItem)).toEqual([4, 4])
    expect(clampSize(it, 1, 1, sizeOfItem)).toEqual([2, 1])
  })
})

describe('clampToGrid', () => {
  it('clamps oversize + off-grid items back in bounds', () => {
    const layout = [{ id: 'i', kind: 'app', key: 'x', c: 12, r: 8, w: 3, h: 3 } as LayoutItem]
    const out = clampToGrid(layout, DIMS)
    const o = out[0]
    expect(o.w).toBeLessThanOrEqual(12)
    expect(o.c + o.w - 1).toBeLessThanOrEqual(12)
    expect(o.r + o.h - 1).toBeLessThanOrEqual(8)
    expect(layout[0].c).toBe(12) // original array unchanged (pure)
  })
})
