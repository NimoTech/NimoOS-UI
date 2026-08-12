// 用例 1:1 移植 Vue2 NimoOS-UI tests/raidEtaFormat.test.js(commit 028837e8)
import { describe, it, expect } from 'vitest'
import { etaDurationParts, etaCompletionParts } from './raidEta'

describe('etaDurationParts', () => {
  it('不足 1 小时:只有分钟', () => {
    expect(etaDurationParts(35 * 60)).toEqual({ days: 0, hours: 0, minutes: 35 })
  })
  it('不足 1 天:小时 + 分钟', () => {
    expect(etaDurationParts(2 * 3600 + 5 * 60)).toEqual({ days: 0, hours: 2, minutes: 5 })
  })
  it('超过 1 天:天 + 小时 + 分钟', () => {
    expect(etaDurationParts(26 * 3600 + 30 * 60)).toEqual({ days: 1, hours: 2, minutes: 30 })
  })
  it('分钟向上取整,重建还在跑绝不显示 0 分钟', () => {
    expect(etaDurationParts(30)).toEqual({ days: 0, hours: 0, minutes: 1 })
  })
  it('未知(负数/null)→ null', () => {
    expect(etaDurationParts(-1)).toBeNull()
    expect(etaDurationParts(null)).toBeNull()
    expect(etaDurationParts(undefined)).toBeNull()
  })
})

describe('etaCompletionParts', () => {
  const now = new Date(2026, 7, 12, 10, 0, 0) // 2026-08-12 10:00
  it('当天晚些时候 → today', () => {
    expect(etaCompletionParts(2 * 3600, now)).toEqual({ dayType: 'today', month: 8, day: 12, time: '12:00' })
  })
  it('跨过午夜 → tomorrow', () => {
    expect(etaCompletionParts(16 * 3600, now)).toEqual({ dayType: 'tomorrow', month: 8, day: 13, time: '02:00' })
  })
  it('跨多天 → 具体日期', () => {
    expect(etaCompletionParts(50 * 3600, now)).toEqual({ dayType: 'other', month: 8, day: 14, time: '12:00' })
  })
  it('未知(负数)→ null', () => {
    expect(etaCompletionParts(-1, now)).toBeNull()
  })
})
