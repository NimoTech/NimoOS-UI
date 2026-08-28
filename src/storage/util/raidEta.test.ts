// Test cases ported 1:1 from the Vue 2 panel's tests/raidEtaFormat.test.js (commit 028837e8)
import { describe, it, expect } from 'vitest'
import { etaDurationParts, etaCompletionParts } from './raidEta'

describe('etaDurationParts', () => {
  it('under 1 hour: minutes only', () => {
    expect(etaDurationParts(35 * 60)).toEqual({ days: 0, hours: 0, minutes: 35 })
  })
  it('under 1 day: hours + minutes', () => {
    expect(etaDurationParts(2 * 3600 + 5 * 60)).toEqual({ days: 0, hours: 2, minutes: 5 })
  })
  it('over 1 day: days + hours + minutes', () => {
    expect(etaDurationParts(26 * 3600 + 30 * 60)).toEqual({ days: 1, hours: 2, minutes: 30 })
  })
  it('minutes round up; never show 0 minutes while the rebuild is still running', () => {
    expect(etaDurationParts(30)).toEqual({ days: 0, hours: 0, minutes: 1 })
  })
  it('unknown (negative/null) -> null', () => {
    expect(etaDurationParts(-1)).toBeNull()
    expect(etaDurationParts(null)).toBeNull()
    expect(etaDurationParts(undefined)).toBeNull()
  })
})

describe('etaCompletionParts', () => {
  const now = new Date(2026, 7, 12, 10, 0, 0) // 2026-08-12 10:00
  it('later the same day -> today', () => {
    expect(etaCompletionParts(2 * 3600, now)).toEqual({ dayType: 'today', month: 8, day: 12, time: '12:00' })
  })
  it('crosses midnight -> tomorrow', () => {
    expect(etaCompletionParts(16 * 3600, now)).toEqual({ dayType: 'tomorrow', month: 8, day: 13, time: '02:00' })
  })
  it('spans multiple days -> specific date', () => {
    expect(etaCompletionParts(50 * 3600, now)).toEqual({ dayType: 'other', month: 8, day: 14, time: '12:00' })
  })
  it('unknown (negative) -> null', () => {
    expect(etaCompletionParts(-1, now)).toBeNull()
  })
})
