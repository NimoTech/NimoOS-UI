// 1:1 移植自 Vue2 src/views/AI/Agent/blocks/ContextUsageBar.vue:2-28,
// test cases ported from ContextUsageBar.spec.js:8-52 (pure-function part only;
// the Vue2 spec's `rendering` describe block covers SFC mounting, which is out
// of scope for this pure-module task).
import { describe, it, expect } from 'vitest'
import { RING_R, RING_C, formatTokens, levelFor, dashArrayFor } from './contextUsage'

describe('RING_R/RING_C', () => {
  it('RING_R === 15.5, RING_C === 2*PI*R', () => {
    expect(RING_R).toBe(15.5)
    expect(RING_C).toBeCloseTo(2 * Math.PI * 15.5, 10)
  })
})

describe('formatTokens', () => {
  it('formats 1200 → "1.2K"', () => { expect(formatTokens(1200)).toBe('1.2K') })
  it('formats 8192 → "8.2K"', () => { expect(formatTokens(8192)).toBe('8.2K') })
  it('formats 500 → "500"', () => { expect(formatTokens(500)).toBe('500') })
  it('formats 128000 → "128K"', () => { expect(formatTokens(128000)).toBe('128K') })
  it('formats 200000 → "200K"', () => { expect(formatTokens(200000)).toBe('200K') })
})

describe('levelFor', () => {
  it('69 → ok', () => { expect(levelFor(69)).toBe('ok') })
  it('75 → warn', () => { expect(levelFor(75)).toBe('warn') })
  it('95 → danger', () => { expect(levelFor(95)).toBe('danger') })
  // Boundary cases not covered by the Vue2 spec.
  it('70 → warn(边界)', () => { expect(levelFor(70)).toBe('warn') })
  it('90 → danger(边界)', () => { expect(levelFor(90)).toBe('danger') })
})

describe('dashArrayFor', () => {
  const fmt = (p: number) => ((p / 100) * (2 * Math.PI * 15.5)).toFixed(2)
  it('15 → "<filled> <circumference>"', () => {
    expect(dashArrayFor(15)).toBe(`${fmt(15)} ${RING_C.toFixed(2)}`)
  })
  it('110 → 截顶到满圆', () => {
    expect(dashArrayFor(110)).toBe(`${RING_C.toFixed(2)} ${RING_C.toFixed(2)}`)
  })
  it('0 → 零长弧', () => {
    expect(dashArrayFor(0)).toBe(`0.00 ${RING_C.toFixed(2)}`)
  })
})
