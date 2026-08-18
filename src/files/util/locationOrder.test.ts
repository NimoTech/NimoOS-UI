import { describe, it, expect, beforeEach } from 'vitest'
import { applyOrder, readOrder, writeOrder, readDefault, writeDefault } from './locationOrder'

beforeEach(() => localStorage.clear())

describe('applyOrder', () => {
  const disks = [{ path: '/a' }, { path: '/b' }, { path: '/c' }]
  it('no saved order → keep as is', () => {
    expect(applyOrder(disks, []).map((d) => d.path)).toEqual(['/a', '/b', '/c'])
  })
  it('reorder by saved order', () => {
    expect(applyOrder(disks, ['/c', '/a']).map((d) => d.path)).toEqual(['/c', '/a', '/b'])
  })
  it('unrecorded new disk placed after known items, keeps relative order', () => {
    expect(applyOrder([{ path: '/a' }, { path: '/x' }, { path: '/b' }], ['/b', '/a']).map((d) => d.path))
      .toEqual(['/b', '/a', '/x'])
  })
})

describe('order/default persistence', () => {
  it('order round-trip', () => { writeOrder(['/a', '/b']); expect(readOrder()).toEqual(['/a', '/b']) })
  it('default round-trip', () => { writeDefault('/a'); expect(readDefault()).toBe('/a') })
  it('missing/corrupted → empty', () => { expect(readOrder()).toEqual([]); expect(readDefault()).toBe('') })
})
