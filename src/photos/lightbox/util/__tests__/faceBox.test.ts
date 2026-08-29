// T12b (merge-review face-locate line, 2026-08-27 addendum to the detector-gen6 plan): maps a
// merge-question preview face's normalized bbox [x1,y1,x2,y2] onto the lightbox <img>'s rendered
// content-frame pixel rect. Reuses ocrHighlight.ts's containContentRect (same object-fit:contain
// letterbox math the OCR highlight overlay already relies on) rather than duplicating it -- see
// that module's own test file for the containContentRect cases this one composes with.
import { describe, it, expect } from 'vitest'
import { mapFaceBoxToRect } from '../faceBox'

describe('mapFaceBoxToRect', () => {
  it('maps a normalized box through a letterboxed (wide) contain frame', () => {
    // elem 200x200, natural 100x50 (2:1) -> scale=min(200/100,200/200)=2, content frame
    // x=0,y=50,w=200,h=100 (same fixture ocrHighlight.test.ts's containContentRect case uses).
    const rect = mapFaceBoxToRect([0.1, 0.2, 0.5, 0.6], 200, 200, 100, 50)
    expect(rect).toEqual({ left: 20, top: 70, width: 80, height: 40 })
  })

  it('maps a normalized box through a letterboxed (tall) contain frame', () => {
    // elem 100x200, natural 50x200 (1:4) -> scale=min(100/50,200/200)=1, content frame
    // x=25,y=0,w=50,h=200 (pillarboxed left/right, no vertical margin).
    const rect = mapFaceBoxToRect([0, 0, 1, 1], 100, 200, 50, 200)
    expect(rect).toEqual({ left: 25, top: 0, width: 50, height: 200 })
  })

  it('a box spanning the full frame maps to the full content rect', () => {
    const rect = mapFaceBoxToRect([0, 0, 1, 1], 200, 200, 100, 50)
    expect(rect).toEqual({ left: 0, top: 50, width: 200, height: 100 })
  })

  it('length !== 4 returns null', () => {
    expect(mapFaceBoxToRect([0.1, 0.2, 0.3], 200, 200, 100, 50)).toBeNull()
    expect(mapFaceBoxToRect([0.1, 0.2, 0.3, 0.4, 0.5], 200, 200, 100, 50)).toBeNull()
  })

  it('a non-finite coordinate (NaN/Infinity) returns null', () => {
    expect(mapFaceBoxToRect([0.1, Number.NaN, 0.5, 0.6], 200, 200, 100, 50)).toBeNull()
    expect(mapFaceBoxToRect([0.1, 0.2, Number.POSITIVE_INFINITY, 0.6], 200, 200, 100, 50)).toBeNull()
  })

  it('reversed x (x1 >= x2) returns null', () => {
    expect(mapFaceBoxToRect([0.6, 0.2, 0.1, 0.6], 200, 200, 100, 50)).toBeNull()
    expect(mapFaceBoxToRect([0.3, 0.2, 0.3, 0.6], 200, 200, 100, 50)).toBeNull() // zero-width, x1 == x2
  })

  it('reversed y (y1 >= y2) returns null', () => {
    expect(mapFaceBoxToRect([0.1, 0.6, 0.5, 0.2], 200, 200, 100, 50)).toBeNull()
    expect(mapFaceBoxToRect([0.1, 0.3, 0.5, 0.3], 200, 200, 100, 50)).toBeNull() // zero-height, y1 == y2
  })

  it('degenerate element/natural dimensions (contain frame itself unavailable) return null', () => {
    expect(mapFaceBoxToRect([0.1, 0.2, 0.5, 0.6], 0, 200, 100, 50)).toBeNull()
    expect(mapFaceBoxToRect([0.1, 0.2, 0.5, 0.6], 200, 200, 0, 50)).toBeNull()
  })

  // ── cover-fit clipping edge (T12c review follow-up): with object-fit: cover the
  // content extends past the element and gets center-cropped, so a face near an
  // edge can map PARTLY or ENTIRELY outside the visible box. The mapper's contract
  // is to return the geometrically true rect either way -- the overlay's
  // overflow:hidden wrapper is what clips it visually -- so these pin that the
  // math stays truthful instead of clamping or nulling a crop-zone face. ──
  it('cover: a box that sticks out of the cropped viewport keeps its true (partly negative) rect', () => {
    // elem 300x300, nat 300x600 -> scale = max(1, 0.5) = 1, offsetY = (300-600)/2 = -150
    const r = mapFaceBoxToRect([0.1, 0.6, 0.4, 0.9], 300, 300, 300, 600, 'cover')!
    expect(r.left).toBeCloseTo(30, 6)
    expect(r.top).toBeCloseTo(210, 6)
    expect(r.width).toBeCloseTo(90, 6)
    expect(r.height).toBeCloseTo(180, 6)
    // bottom edge (top + height = 390) lies 90px past the 300px viewport: clipped by CSS, not by math
  })

  it('cover: a box that falls ENTIRELY inside the cropped-away strip still returns its true off-screen rect', () => {
    // same geometry; the face lives in the bottom strip that cover cropped away
    const r = mapFaceBoxToRect([0.1, 0.8, 0.4, 0.95], 300, 300, 300, 600, 'cover')!
    expect(r.left).toBeCloseTo(30, 6)
    expect(r.top).toBeCloseTo(330, 6)
    expect(r.width).toBeCloseTo(90, 6)
    expect(r.height).toBeCloseTo(90, 6)
    expect(r.top).toBeGreaterThan(300) // fully below the viewport: invisible, never misplaced
  })
})
