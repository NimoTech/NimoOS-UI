import { describe, it, expect } from 'vitest'
import { computeFrameFromX, computeWindowStyle, computeStripStyle } from '../hoverScrub'

describe('computeFrameFromX', () => {
  it('returns 0 when rectWidth or frameCount is non-positive', () => {
    expect(computeFrameFromX(50, 0, 0, 10)).toBe(0)
    expect(computeFrameFromX(50, 0, -5, 10)).toBe(0)
    expect(computeFrameFromX(50, 0, 100, 0)).toBe(0)
    expect(computeFrameFromX(50, 0, 100, -1)).toBe(0)
  })

  it('maps a mid-rect position to the middle frame', () => {
    // rectLeft=0, rectWidth=100, clientX=50 -> p=0.5, frameCount=10 -> floor(5)=5
    expect(computeFrameFromX(50, 0, 100, 10)).toBe(5)
  })

  it('clamps below-range results to 0', () => {
    // clientX before rectLeft -> negative p -> negative idx -> clamp to 0
    expect(computeFrameFromX(-10, 0, 100, 10)).toBe(0)
  })

  it('clamps above-range results to frameCount-1', () => {
    // clientX past the right edge -> p > 1 -> idx >= frameCount -> clamp to frameCount-1
    expect(computeFrameFromX(500, 0, 100, 10)).toBe(9)
    // exactly at the right edge: p=1 -> idx=frameCount -> clamp to frameCount-1
    expect(computeFrameFromX(100, 0, 100, 10)).toBe(9)
  })

  it('accounts for rectLeft offset', () => {
    expect(computeFrameFromX(150, 100, 100, 10)).toBe(5)
  })
})

describe('computeWindowStyle', () => {
  it('landscape/square (ar>=1): width 100%, height scaled down by ar', () => {
    expect(computeWindowStyle(200, 100)).toEqual({ width: '100%', height: '50%' })
    expect(computeWindowStyle(100, 100)).toEqual({ width: '100%', height: '100%' })
  })

  it('portrait (ar<1): height 100%, width scaled by ar', () => {
    expect(computeWindowStyle(100, 200)).toEqual({ width: '50%', height: '100%' })
  })
})

describe('computeStripStyle', () => {
  it('width is N*100% where N = max(1, frameCount)', () => {
    expect(computeStripStyle(5, 0).width).toBe('500%')
    // frameCount<=0 clamps N to 1
    expect(computeStripStyle(0, 0).width).toBe('100%')
    expect(computeStripStyle(-3, 0).width).toBe('100%')
  })

  it('transform is translateX(-100*currentFrame/N %)', () => {
    // currentFrame=0 -> -(100*0)/N is JS negative zero, which template-literal-stringifies
    // to "0" (not "-0") — this is genuine Vue2 behavior (`${-0}` === '0'), not a rounding bug.
    expect(computeStripStyle(4, 0).transform).toBe('translateX(0%)')
    expect(computeStripStyle(4, 1).transform).toBe('translateX(-25%)')
    expect(computeStripStyle(4, 2).transform).toBe('translateX(-50%)')
    expect(computeStripStyle(4, 3).transform).toBe('translateX(-75%)')
  })
})
