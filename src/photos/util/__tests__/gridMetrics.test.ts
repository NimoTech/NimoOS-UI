import { describe, it, expect } from 'vitest'
import {
  GRID_METRICS, CONTENT_INSET, FALLBACK_CONTAINER_WIDTH, MONTH_HEAD_HEIGHT,
  columnsFor, tileEdge, estimateSectionBodyHeight, skeletonItemCount,
} from '../gridMetrics'

describe('columnsFor', () => {
  it('mirrors repeat(auto-fill, minmax(min, 1fr)) for the default density', () => {
    // 800 usable px, min 140, gap 4 -> floor((800 + 4) / 144) = 5
    expect(columnsFor(800 + CONTENT_INSET, 'comfortable')).toBe(5)
  })
  it('packs more columns at compact and fewer at loose', () => {
    expect(columnsFor(800 + CONTENT_INSET, 'compact')).toBe(8)   // floor(802 / 98)
    expect(columnsFor(800 + CONTENT_INSET, 'loose')).toBe(3)     // floor(810 / 210)
  })
  it('never returns less than one column', () => {
    expect(columnsFor(10, 'loose')).toBe(1)
  })
  it('falls back to a nominal width when the container has not been laid out', () => {
    // jsdom reports clientWidth 0 for everything; a 0 here would make every
    // skeleton 0px tall and the on-demand loader would never see a scrollable page.
    expect(columnsFor(0, 'comfortable')).toBe(columnsFor(FALLBACK_CONTAINER_WIDTH, 'comfortable'))
  })
  it('treats an unknown density as the default', () => {
    expect(columnsFor(800 + CONTENT_INSET, 'nonsense')).toBe(columnsFor(800 + CONTENT_INSET, 'comfortable'))
  })
})

describe('tileEdge', () => {
  it('splits the usable width across columns minus the inter-column gaps', () => {
    // 5 columns, 4 gaps of 4px -> (800 - 16) / 5 = 156.8
    expect(tileEdge(800 + CONTENT_INSET, 'comfortable')).toBeCloseTo(156.8, 5)
  })
})

describe('estimateSectionBodyHeight', () => {
  it('is zero for an empty section', () => {
    expect(estimateSectionBodyHeight({ containerWidth: 868, density: 'comfortable', itemCount: 0 })).toBe(0)
  })
  it('counts rows and the gaps BETWEEN rows only', () => {
    // 12 items over 5 columns -> 3 rows -> 3 * 156.8 + 2 * 4 = 478.4
    expect(estimateSectionBodyHeight({ containerWidth: 868, density: 'comfortable', itemCount: 12 }))
      .toBeCloseTo(478.4, 5)
  })
  it('rounds partial rows up', () => {
    const one = estimateSectionBodyHeight({ containerWidth: 868, density: 'comfortable', itemCount: 1 })
    const five = estimateSectionBodyHeight({ containerWidth: 868, density: 'comfortable', itemCount: 5 })
    expect(one).toBeCloseTo(five, 5)
  })
})

describe('skeletonItemCount', () => {
  it('estimates the photo tab as count minus videoCount', () => {
    // The photo tab is the DEFAULT tab on this page (Photos.vue). Estimating 0
    // here would leave every month past the first viewport permanently unloaded.
    expect(skeletonItemCount({ tab: 'photo', count: 100, videoCount: 12, loaded: false, loadedLength: 0 })).toBe(88)
  })
  it('estimates the video tab from videoCount and the all tab from count', () => {
    expect(skeletonItemCount({ tab: 'video', count: 100, videoCount: 12, loaded: false, loadedLength: 0 })).toBe(12)
    expect(skeletonItemCount({ tab: 'all', count: 100, videoCount: 12, loaded: false, loadedLength: 0 })).toBe(100)
  })
  it('estimates nothing on the ocr tab, which the directory has no counter for', () => {
    expect(skeletonItemCount({ tab: 'ocr', count: 100, videoCount: 12, loaded: false, loadedLength: 0 })).toBe(0)
  })
  it('uses the real length for already-loaded groups that carry no directory counts', () => {
    // Favorites and the place-assets page feed synthetic month groups: no count,
    // no videoCount, already in hand. Their placeholders must keep a true height.
    expect(skeletonItemCount({ tab: 'photo', loaded: true, loadedLength: 7 })).toBe(7)
  })
  it('never returns a negative estimate when videoCount exceeds count', () => {
    expect(skeletonItemCount({ tab: 'photo', count: 2, videoCount: 5, loaded: false, loadedLength: 0 })).toBe(0)
  })
})

describe('constants', () => {
  it('exposes the three densities the grid CSS defines', () => {
    expect(Object.keys(GRID_METRICS).sort()).toEqual(['comfortable', 'compact', 'loose'])
  })
  it('keeps a positive month-head allowance', () => {
    expect(MONTH_HEAD_HEIGHT).toBeGreaterThan(0)
  })
})
