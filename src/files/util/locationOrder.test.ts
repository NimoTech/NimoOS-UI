import { describe, it, expect, beforeEach } from 'vitest'
import { applyOrder, readOrder, writeOrder, readDefault, writeDefault } from './locationOrder'

beforeEach(() => localStorage.clear())

describe('applyOrder', () => {
  const disks = [{ path: '/a' }, { path: '/b' }, { path: '/c' }]
  it('无保存顺序 → 原样', () => {
    expect(applyOrder(disks, []).map((d) => d.path)).toEqual(['/a', '/b', '/c'])
  })
  it('按保存顺序重排', () => {
    expect(applyOrder(disks, ['/c', '/a']).map((d) => d.path)).toEqual(['/c', '/a', '/b'])
  })
  it('未记录的新盘排到已知项之后、保持相对序', () => {
    expect(applyOrder([{ path: '/a' }, { path: '/x' }, { path: '/b' }], ['/b', '/a']).map((d) => d.path))
      .toEqual(['/b', '/a', '/x'])
  })
})

describe('order/default 持久化', () => {
  it('order 往返', () => { writeOrder(['/a', '/b']); expect(readOrder()).toEqual(['/a', '/b']) })
  it('default 往返', () => { writeDefault('/a'); expect(readDefault()).toBe('/a') })
  it('缺失/损坏 → 空', () => { expect(readOrder()).toEqual([]); expect(readDefault()).toBe('') })
})
