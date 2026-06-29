import { describe, it, expect } from 'vitest'
import { fmtSize, fmtSpeed, heatColor, relTime } from './format'

describe('fmtSize/fmtSpeed', () => {
  it('formats bytes with 1024 units', () => {
    expect(fmtSize(0)).toBe('0 B')
    expect(fmtSize(1536)).toBe('1.5 KB')          // 1.5*1024, <100 → 1 decimal
    expect(fmtSize(1024 * 1024 * 200)).toBe('200 MB') // >=100 → rounded
    expect(fmtSpeed(2048)).toBe('2 KB/s')
  })
})
describe('heatColor', () => {
  it('cool/warm/hot by temperature', () => {
    expect(heatColor(40)).toBe('var(--good)')
    expect(heatColor(70)).toBe('#ffcc66')
    expect(heatColor(90)).toBe('#ff6b6b')
    expect(heatColor(null)).toBe('var(--accent)')
  })
})
describe('relTime', () => {
  const now = 1_000_000_000_000
  it('buckets by elapsed', () => {
    expect(relTime(now, now)).toBe('刚刚')
    expect(relTime(now - 5 * 60000, now)).toBe('5 分钟前')
    expect(relTime(now - 2 * 3600000, now)).toBe('2 小时前')
  })
})
