import { describe, it, expect } from 'vitest'
import { containContentRect, quadBounds, mapOcrBoxesToRects } from '../ocrHighlight'

describe('containContentRect', () => {
  it('Wide image mailbox: fill horizontally, center vertically with margin', () => {
    // Element 200x200, natural 100x50 (2:1) → scale min(200/100, 200/50)=2, content 200x100, center y=50
    expect(containContentRect(200, 200, 100, 50)).toEqual({ x: 0, y: 50, w: 200, h: 100 })
  })
  it('Degenerate dimensions return null', () => {
    expect(containContentRect(0, 200, 100, 50)).toBeNull()
    expect(containContentRect(200, 200, 0, 50)).toBeNull()
  })
  it('Negative dimensions return null (Vue2 uses > 0, not falsy)', () => {
    // Negative numbers should also be rejected; -200 as elemW does not satisfy !(elemW > 0), should return null
    expect(containContentRect(-200, 200, 100, 50)).toBeNull()
    expect(containContentRect(200, -200, 100, 50)).toBeNull()
    expect(containContentRect(200, 200, -100, 50)).toBeNull()
    expect(containContentRect(200, 200, 100, -50)).toBeNull()
  })
})

describe('quadBounds', () => {
  it('8-point normalized quadrilateral to axis-aligned bounding box clamped to [0,1]', () => {
    expect(quadBounds([0.1, 0.2, 0.5, 0.2, 0.5, 0.6, 0.1, 0.6])).toEqual({ x0: 0.1, y0: 0.2, x1: 0.5, y1: 0.6 })
  })
  it('Degenerate/zero-area return null', () => {
    expect(quadBounds([0.1, 0.2])).toBeNull()
    expect(quadBounds([0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3])).toBeNull()
  })
  it('Array length !== 8 returns null (10-element array)', () => {
    // Vue2 uses !== rather than <, so oversized arrays are also rejected
    expect(quadBounds([0.1, 0.2, 0.5, 0.2, 0.5, 0.6, 0.1, 0.6, 0.8, 0.8])).toBeNull()
  })
})

describe('mapOcrBoxesToRects', () => {
  it('Map normalized boxes to content-frame pixel rectangles', () => {
    const rects = mapOcrBoxesToRects([{ box: [0, 0, 1, 0, 1, 1, 0, 1] }], 200, 200, 100, 50)
    // Content frame x0,y0=0,50 w,h=200,100; entire frame → left0 top50 width200 height100
    expect(rects).toEqual([{ left: 0, top: 50, width: 200, height: 100 }])
  })
})
