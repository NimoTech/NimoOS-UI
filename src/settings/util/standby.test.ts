import { describe, it, expect } from 'vitest'
import { STANDBY_OPTIONS, parseStandbyMinutes } from './standby'

describe('STANDBY_OPTIONS', () => {
  it('9 项,顺序与取值对位 Vue2 L989-999', () => {
    expect(STANDBY_OPTIONS.map((o) => o.value)).toEqual(
      ['never', '10m', '20m', '30m', '1h', '2h', '3h', '4h', '5h'],
    )
  })
  it('每项都有 i18n 键(Vue2 是内联 zh/en 两栏,这里改走 i18n 分片)', () => {
    for (const o of STANDBY_OPTIONS) expect(o.labelKey).toMatch(/^settingsStandby/)
  })
})

describe('parseStandbyMinutes(对位 Vue2 L1093-1098)', () => {
  it('never → 0', () => expect(parseStandbyMinutes('never')).toBe(0))
  it('空/undefined → 0', () => {
    expect(parseStandbyMinutes('')).toBe(0)
    expect(parseStandbyMinutes(undefined)).toBe(0)
  })
  it('分钟后缀原样取值', () => {
    expect(parseStandbyMinutes('10m')).toBe(10)
    expect(parseStandbyMinutes('30m')).toBe(30)
  })
  it('小时后缀 ×60', () => {
    expect(parseStandbyMinutes('1h')).toBe(60)
    expect(parseStandbyMinutes('5h')).toBe(300)
  })
  it('无法识别的值 → 0(不是 NaN —— 后端要求 minutes 是整数,NaN 会被 400)', () => {
    expect(parseStandbyMinutes('abc')).toBe(0)
    expect(parseStandbyMinutes('12')).toBe(0)
  })
})
