import { describe, it, expect } from 'vitest'
import { linearizeLayout } from './linearize'
import type { LayoutItem } from './types'

const it_ = (id: string, c: number, r: number): LayoutItem =>
  ({ id, kind: 'app', key: id, c, r, w: 1, h: 1 })

describe('linearizeLayout', () => {
  it('sorts by row then column (desktop visual order)', () => {
    const items = [it_('d', 3, 2), it_('b', 5, 1), it_('a', 1, 1), it_('c', 1, 2)]
    expect(linearizeLayout(items).map((i) => i.id)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('does not mutate the input array', () => {
    const items = [it_('b', 2, 1), it_('a', 1, 1)]
    linearizeLayout(items)
    expect(items[0].id).toBe('b')
  })
})
