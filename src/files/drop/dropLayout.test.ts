import { describe, it, expect } from 'vitest'
import { positionFor, contentsBox, DISPLAY_ORDER } from './dropLayout'

describe('dropLayout', () => {
  it('positionFor matches Vue2 formula exactly (inner ring at 30° increments for index<5; outer ring at 45° increments/1.86 for ≥5)', () => {
    const center = { x: 400, y: 300 }
    const r = 500
    // index=0: angle=30°, realRadius=500 → x=400+250*cos30, y=300-250*sin30
    const p0 = positionFor(0, r, center)
    expect(parseFloat(p0.left)).toBeCloseTo(400 + 250 * Math.cos(Math.PI / 6), 5)
    expect(parseFloat(p0.top)).toBeCloseTo(300 - 250 * Math.sin(Math.PI / 6), 5)
    // index=5: angle=45*(5%5)=0°, realRadius=500/1.86
    const p5 = positionFor(5, r, center)
    expect(parseFloat(p5.left)).toBeCloseTo(400 + 500 / 1.86 / 2, 5)
    expect(parseFloat(p5.top)).toBeCloseTo(300, 5)
  })
  it('contentsBox: when width > 2×height, use height to determine width (Vue2 resize branch)', () => {
    const b = contentsBox(2000, 500) // cW=1880, cHeight=500-60-144=296 → 1880>592
    expect(b.width).toBe(296 * 2)
    expect(b.height).toBe(296 + 144)
    expect(b.radius).toBe(b.width)
    expect(b.center).toEqual({ x: b.width / 2, y: b.height - 144 })
  })
  it('display order table matches Vue2 exactly', () => {
    expect(DISPLAY_ORDER).toEqual([8, 6, 2, 3, 1, 7, 4, 0, 9, 5])
  })
})
