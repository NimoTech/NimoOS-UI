import { describe, it, expect } from 'vitest'
import { formatMemberDate, validateNewMember } from './memberFormat'

describe('formatMemberDate —— 1:1 对位 Vue2 AccountPanel formatDate(:538-543)', () => {
  it('本地时间 YYYY-MM-DD HH:mm:ss,各段补零', () => {
    // Construct with local time so the test machine's timezone can't make the assertion flaky
    const d = new Date(2026, 6, 3, 4, 5, 6) // 2026-07-03 04:05:06 local
    expect(formatMemberDate(d.toISOString())).toBe('2026-07-03 04:05:06')
  })
  it('空值返回空串(Vue2 !dateStr 早退)', () => {
    expect(formatMemberDate('')).toBe('')
    expect(formatMemberDate(null)).toBe('')
    expect(formatMemberDate(undefined)).toBe('')
  })
  it('Go 零值时间不炸,但**年份不补零**(与 Vue2 逐字一致,故意保留)', () => {
    // Backend created_at may be Go's zero value 0001-01-01T00:00:00Z (verified on this
    // machine's /v1/users/current). Vue2 formatDate only padStart's month/day/h/m/s and
    // **uses getFullYear() directly for the year** -> outputs "1-01-01", not "0001-01-01".
    // Not a bug/race/swallowed error; kept unchanged per "UI strictly 1:1".
    // ⚠️ Don't assert the full string: the local offset in year 1 AD is LMT (this
    // machine's Asia/Shanghai is +08:05:43); h/m/s vary with the test machine's timezone,
    // so a hard assertion goes red on another machine.
    const out = formatMemberDate('0001-01-01T00:00:00Z')
    expect(out).toMatch(/^\d{1,4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(out.startsWith('0001-')).toBe(false)
  })
  it('无法解析的串返回空串(Vue2 会渲染 NaN-NaN-NaN,这是照 plan C1 改正的行为)', () => {
    expect(formatMemberDate('not-a-date')).toBe('')
  })
})

describe('validateNewMember —— 1:1 对位 Vue2 submitAddMember(:493-506)', () => {
  it('用户名或密码为空 → empty', () => {
    expect(validateNewMember('', 'pw1234', 'pw1234')).toBe('empty')
    expect(validateNewMember('bob', '', '')).toBe('empty')
  })
  it('密码短于 6 位 → tooShort', () => {
    expect(validateNewMember('bob', 'pw123', 'pw123')).toBe('tooShort')
  })
  it('刚好 6 位放过', () => {
    expect(validateNewMember('bob', 'pw1234'.slice(0, 6), 'pw1234'.slice(0, 6))).toBeNull()
  })
  it('两次密码不一致 → mismatch', () => {
    expect(validateNewMember('bob', 'pw1234', 'pw4321')).toBe('mismatch')
  })
  it('校验顺序与 Vue2 一致:空 > 长度 > 一致性', () => {
    // Empty AND short AND mismatched -> still reports empty
    expect(validateNewMember('bob', '', 'x')).toBe('empty')
    // Short AND mismatched -> reports tooShort
    expect(validateNewMember('bob', 'ab', 'cd')).toBe('tooShort')
  })
})
