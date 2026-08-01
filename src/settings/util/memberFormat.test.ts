import { describe, it, expect } from 'vitest'
import { formatMemberDate, validateNewMember } from './memberFormat'

describe('formatMemberDate —— 1:1 对位 Vue2 AccountPanel formatDate(:538-543)', () => {
  it('本地时间 YYYY-MM-DD HH:mm:ss,各段补零', () => {
    // 用本地时间构造,避免测试机时区把断言弄成薛定谔
    const d = new Date(2026, 6, 3, 4, 5, 6) // 2026-07-03 04:05:06 本地
    expect(formatMemberDate(d.toISOString())).toBe('2026-07-03 04:05:06')
  })
  it('空值返回空串(Vue2 !dateStr 早退)', () => {
    expect(formatMemberDate('')).toBe('')
    expect(formatMemberDate(null)).toBe('')
    expect(formatMemberDate(undefined)).toBe('')
  })
  it('Go 零值时间不炸,但**年份不补零**(与 Vue2 逐字一致,故意保留)', () => {
    // 后端 created_at 可能是 Go 零值 0001-01-01T00:00:00Z(本机 /v1/users/current 实测就是)。
    // Vue2 formatDate 只对月/日/时/分/秒 padStart,**年份直接用 getFullYear()** → 输出 "1-01-01"
    // 而不是 "0001-01-01"。这不是 bug/竞态/吞错,按「界面严格 1:1」保留不改。
    // ⚠️ 不断言完整字符串:公元 1 年的本地偏移是 LMT(本机 Asia/Shanghai 是 +08:05:43),
    // 时分秒随测试机时区变,断死了换机器就红。
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
    // 空且短且不一致 → 仍报 empty
    expect(validateNewMember('bob', '', 'x')).toBe('empty')
    // 短且不一致 → 报 tooShort
    expect(validateNewMember('bob', 'ab', 'cd')).toBe('tooShort')
  })
})
