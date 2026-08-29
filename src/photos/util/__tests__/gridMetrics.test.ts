import { describe, it, expect } from 'vitest'
import {
  GRID_COLUMNS, GRID_GAP, CONTENT_INSET, FALLBACK_CONTAINER_WIDTH,
  columnsFor, tileEdge, estimateSectionBodyHeight, skeletonItemCount, tabHasDirectoryEstimate,
} from '../gridMetrics'

describe('columnsFor', () => {
  it('mirrors the fixed repeat(N, 1fr) column count per density (Vue2 photos.scss:315-317)', () => {
    expect(columnsFor('compact')).toBe(10)
    expect(columnsFor('comfortable')).toBe(7)
    expect(columnsFor('loose')).toBe(4)
  })
  it('is a pure lookup — container width plays no part', () => {
    // Unlike the old auto-fill/minmax model, a density's column count is the same
    // whether the container is 10px or 10000px wide.
    expect(columnsFor('comfortable')).toBe(GRID_COLUMNS.comfortable)
  })
  it('treats an unknown density as the default (comfortable)', () => {
    expect(columnsFor('nonsense')).toBe(columnsFor('comfortable'))
  })
})

describe('tileEdge', () => {
  // usableWidth = containerWidth - CONTENT_INSET. Chosen so usableWidth - (cols-1)*gap
  // divides evenly across every density, at containerWidth = 718 + CONTENT_INSET(40) = 758.
  const W = 718 + CONTENT_INSET

  it('splits the usable width across the fixed column count minus the inter-column gaps', () => {
    // comfortable: 7 cols, 6 gaps of 3px -> (718 - 18) / 7 = 100
    expect(tileEdge(W, 'comfortable')).toBeCloseTo(100, 5)
  })
  it('packs narrower tiles at compact and wider ones at loose (fewer/more columns)', () => {
    // compact: 10 cols, 9 gaps of 2px -> (718 - 18) / 10 = 70
    expect(tileEdge(W, 'compact')).toBeCloseTo(70, 5)
    // loose: 4 cols, 3 gaps of 6px -> (718 - 18) / 4 = 175
    expect(tileEdge(W, 'loose')).toBeCloseTo(175, 5)
  })
  it('falls back to a nominal width when the container has not been laid out', () => {
    // jsdom reports clientWidth 0 for everything; a 0 here would make every
    // skeleton 0px tall and the on-demand loader would never see a scrollable page.
    expect(tileEdge(0, 'comfortable')).toBeCloseTo(tileEdge(FALLBACK_CONTAINER_WIDTH, 'comfortable'), 5)
  })
})

describe('estimateSectionBodyHeight', () => {
  const W = 718 + CONTENT_INSET // tileEdge(W, 'comfortable') === 100, see above

  it('is zero for an empty section', () => {
    expect(estimateSectionBodyHeight(0, W, 'comfortable')).toBe(0)
  })
  it('counts rows and the gaps BETWEEN rows only', () => {
    // 15 items over 7 columns -> 3 rows -> 3 * 100 + 2 * 3 = 306
    expect(estimateSectionBodyHeight(15, W, 'comfortable')).toBeCloseTo(306, 5)
  })
  it('rounds partial rows up', () => {
    // Both fit in exactly one row at 7 columns -> same height, no between-row gap.
    const one = estimateSectionBodyHeight(1, W, 'comfortable')
    const sevenExact = estimateSectionBodyHeight(7, W, 'comfortable')
    expect(one).toBeCloseTo(100, 5)
    expect(one).toBeCloseTo(sevenExact, 5)
  })
})

describe('skeletonItemCount', () => {
  // Unchanged by the column-model rewrite: it answers "how many items", never
  // "how many columns" — see estimateSectionBodyHeight above for where the new
  // fixed-column geometry actually applies.
  it('estimates the photo tab as count minus videoCount', () => {
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
    expect(skeletonItemCount({ tab: 'photo', loaded: true, loadedLength: 7 })).toBe(7)
  })
  it('never returns a negative estimate when videoCount exceeds count', () => {
    expect(skeletonItemCount({ tab: 'photo', count: 2, videoCount: 5, loaded: false, loadedLength: 0 })).toBe(0)
  })
})

describe('constants', () => {
  it('exposes the three densities the grid CSS defines, on both tables', () => {
    expect(Object.keys(GRID_COLUMNS).sort()).toEqual(['comfortable', 'compact', 'loose'])
    expect(Object.keys(GRID_GAP).sort()).toEqual(['comfortable', 'compact', 'loose'])
  })
  it('matches Vue2 photos.scss:315-317 exactly', () => {
    expect(GRID_COLUMNS).toEqual({ compact: 10, comfortable: 7, loose: 4 })
    expect(GRID_GAP).toEqual({ compact: 2, comfortable: 3, loose: 6 })
  })
})

describe('tabHasDirectoryEstimate', () => {
  it('is true exactly for the tabs the directory can size', () => {
    expect(tabHasDirectoryEstimate('all')).toBe(true)
    expect(tabHasDirectoryEstimate('photo')).toBe(true)
    expect(tabHasDirectoryEstimate('video')).toBe(true)
  })
  // The grid uses this to decide whether to keep an unloaded month's container at
  // all: on a tab with no counter the container is the only thing the observer can
  // watch, so dropping it left the tab unable to ever load anything (Important 6).
  it('is false for the ocr tab, which the directory carries no counter for', () => {
    expect(tabHasDirectoryEstimate('ocr')).toBe(false)
  })
  it('is false for an unknown tab id, so a future tab defaults to the safe side', () => {
    expect(tabHasDirectoryEstimate('faces')).toBe(false)
  })
})
