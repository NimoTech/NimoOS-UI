import { describe, it, expect } from 'vitest'
import { rectsFromGeometry } from './gridGeometry'
import { marqueeSelect, rectFromPoints } from './marquee'

const geom = { cols: 3, colWidth: 100, rowHeight: 130, gap: 14, originLeft: 50, originTop: 200 }

describe('rectsFromGeometry', () => {
  it('places item 0 at the grid origin', () => {
    const [first] = rectsFromGeometry({ ...geom, paths: ['/a'] })
    expect(first).toEqual({ path: '/a', rect: { left: 50, top: 200, right: 150, bottom: 330 } })
  })

  it('advances by colWidth + gap across a row', () => {
    const rects = rectsFromGeometry({ ...geom, paths: ['/a', '/b', '/c'] })
    expect(rects[1].rect.left).toBe(50 + 100 + 14)
    expect(rects[2].rect.left).toBe(50 + 2 * (100 + 14))
  })

  it('wraps to the next row after `cols` items, advancing by rowHeight', () => {
    const rects = rectsFromGeometry({ ...geom, paths: ['/a', '/b', '/c', '/d'] })
    expect(rects[3].rect.left).toBe(50)
    expect(rects[3].rect.top).toBe(200 + 130)
  })

  it('emits one rect per path, in order', () => {
    const rects = rectsFromGeometry({ ...geom, paths: ['/a', '/b', '/c', '/d', '/e'] })
    expect(rects.map((r) => r.path)).toEqual(['/a', '/b', '/c', '/d', '/e'])
  })

  it('returns nothing for an empty list', () => {
    expect(rectsFromGeometry({ ...geom, paths: [] })).toEqual([])
  })

  it('feeds marqueeSelect so off-screen rows are still selectable', () => {
    // 200 items = 67 rows. A box over row 40 must select it even though nothing
    // in that range would ever be rendered into the DOM.
    const paths = Array.from({ length: 200 }, (_, i) => `/f${i}`)
    const rects = rectsFromGeometry({ ...geom, paths })
    const y = 200 + 40 * 130 + 5
    const sel = rectFromPoints(40, y, 400, y + 100)
    const picked = marqueeSelect(rects, sel)
    expect(picked).toContain('/f120') // row 40, col 0
    expect(picked).toContain('/f122') // row 40, col 2
  })
})
