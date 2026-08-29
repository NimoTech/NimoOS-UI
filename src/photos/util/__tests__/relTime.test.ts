import { describe, it, expect } from 'vitest'
import { relTime } from '../relTime'

const t = (k: string, p?: Record<string, unknown>) => k + JSON.stringify(p ?? {})

describe('relTime', () => {
  it('empty/null iso → ""', () => {
    expect(relTime('', 0, t, 'zh_cn')).toBe('')
    expect(relTime(null, 0, t, 'zh_cn')).toBe('')
    expect(relTime(undefined, 0, t, 'zh_cn')).toBe('')
  })

  it('bad string (Invalid Date) → "" (added guard)', () => {
    expect(relTime('not-a-date', Date.parse('2026-07-31'), t, 'zh_cn')).toBe('')
  })

  it('30 seconds ago → photosSvRelMinutes with n===1', () => {
    const now = Date.parse('2026-07-31T12:00:30Z')
    const iso = new Date('2026-07-31T12:00:00Z').toISOString()
    const out = relTime(iso, now, t, 'zh_cn')
    expect(out).toBe('photosSvRelMinutes' + JSON.stringify({ n: 1 }))
  })

  // Finding (already logged in the task report): the brief labeled "30 seconds ago" as the
  // "Math.max(1,…) lower-bound" case, but in practice 30/60=0.5, and JS's Math.round(0.5)===1
  // (rounds toward +∞), so even with Math.max(1,…) deleted this case's n is still 1 — the
  // 30-second point itself never actually touches the lower bound. What actually hits bottom is
  // the diff<30s range (rounds to 0); use "10 seconds ago" here instead, which is the case that
  // actually turns red for the "lower bound" under mutation-deletion verification.
  it('10 seconds ago → still n===1 (actually hits the Math.max(1,…) lower bound, round(10/60)=0)', () => {
    const now = Date.parse('2026-07-31T12:00:10Z')
    const iso = new Date('2026-07-31T12:00:00Z').toISOString()
    const out = relTime(iso, now, t, 'zh_cn')
    expect(out).toBe('photosSvRelMinutes' + JSON.stringify({ n: 1 }))
  })

  it('90 minutes ago → photosSvRelHours with n===2 (Math.round(5400/3600)=2)', () => {
    const iso = new Date('2026-07-31T10:30:00Z').toISOString()
    const now = Date.parse('2026-07-31T12:00:00Z')
    const out = relTime(iso, now, t, 'zh_cn')
    expect(out).toBe('photosSvRelHours' + JSON.stringify({ n: 2 }))
  })

  it('59 minutes ago (3599 seconds) is still photosSvRelMinutes', () => {
    const now = Date.parse('2026-07-31T12:00:00Z')
    const iso = new Date(now - 3599 * 1000).toISOString()
    const out = relTime(iso, now, t, 'zh_cn')
    expect(out.startsWith('photosSvRelMinutes')).toBe(true)
  })

  it('exactly 3600 seconds → photosSvRelHours (the other side of the boundary)', () => {
    const now = Date.parse('2026-07-31T12:00:00Z')
    const iso = new Date(now - 3600 * 1000).toISOString()
    const out = relTime(iso, now, t, 'zh_cn')
    expect(out.startsWith('photosSvRelHours')).toBe(true)
  })

  it('exactly 86400 seconds → absolute date tier (result does not contain photosSvRel)', () => {
    const now = Date.parse('2026-07-31T12:00:00Z')
    const iso = new Date(now - 86400 * 1000).toISOString()
    const out = relTime(iso, now, t, 'zh_cn')
    expect(out).not.toContain('photosSvRel')
    expect(out.length).toBeGreaterThan(0)
  })

  it('locale takes effect: the same iso passed with zh_cn vs en_us gives different strings (absolute date tier)', () => {
    const now = Date.parse('2026-07-31T12:00:00Z')
    const iso = new Date(now - 200000 * 1000).toISOString()
    const zhOut = relTime(iso, now, t, 'zh_cn')
    const enOut = relTime(iso, now, t, 'en_us')
    expect(zhOut).not.toBe(enOut)
  })
})
