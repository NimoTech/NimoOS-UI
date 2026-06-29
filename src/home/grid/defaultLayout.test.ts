import { describe, it, expect } from 'vitest'
import { DEFAULT } from './defaultLayout'
import { WIDGETS } from '../widgets/registry'
import { cells } from './gridMath'

describe('DEFAULT layout', () => {
  it('every widget item references a known widget key', () => {
    DEFAULT.filter((i) => i.kind === 'widget').forEach((i) => {
      expect(WIDGETS[i.key], `unknown widget ${i.key}`).toBeTruthy()
    })
  })
  it('has no overlapping cells and stays within 12x8', () => {
    const seen = new Set<string>()
    DEFAULT.forEach((i) => {
      expect(i.c >= 1 && i.r >= 1 && i.c + i.w - 1 <= 12 && i.r + i.h - 1 <= 8).toBe(true)
      cells(i).forEach((k) => {
        expect(seen.has(k), `overlap at ${k}`).toBe(false)
        seen.add(k)
      })
    })
  })
})

describe('WIDGETS registry', () => {
  it('carries min/max/default for the 7 widgets', () => {
    expect(Object.keys(WIDGETS).sort()).toEqual(['ai', 'clock', 'cpu', 'events', 'gpu', 'network', 'storage'])
    expect(WIDGETS.cpu.min).toEqual([2, 2])
    expect(WIDGETS.cpu.max).toEqual([4, 3])
    expect(WIDGETS.clock.default).toEqual([2, 2])
  })
})
