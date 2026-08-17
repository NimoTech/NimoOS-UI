import { describe, it, expect } from 'vitest'
import { STANDBY_OPTIONS, parseStandbyMinutes } from './standby'

describe('STANDBY_OPTIONS', () => {
  it('9 entries, order and values map to Vue2 L989-999', () => {
    expect(STANDBY_OPTIONS.map((o) => o.value)).toEqual(
      ['never', '10m', '20m', '30m', '1h', '2h', '3h', '4h', '5h'],
    )
  })
  it('every entry has an i18n key (Vue2 has inline zh/en columns; here it goes through i18n instead)', () => {
    for (const o of STANDBY_OPTIONS) expect(o.labelKey).toMatch(/^settingsStandby/)
  })
})

describe('parseStandbyMinutes (maps to Vue2 L1093-1098)', () => {
  it('never → 0', () => expect(parseStandbyMinutes('never')).toBe(0))
  it('empty/undefined → 0', () => {
    expect(parseStandbyMinutes('')).toBe(0)
    expect(parseStandbyMinutes(undefined)).toBe(0)
  })
  it('minute suffix takes the value as-is', () => {
    expect(parseStandbyMinutes('10m')).toBe(10)
    expect(parseStandbyMinutes('30m')).toBe(30)
  })
  it('hour suffix ×60', () => {
    expect(parseStandbyMinutes('1h')).toBe(60)
    expect(parseStandbyMinutes('5h')).toBe(300)
  })
  it('unrecognized value → 0 (not NaN -- the backend requires minutes to be an integer, and NaN gets a 400)', () => {
    expect(parseStandbyMinutes('abc')).toBe(0)
    expect(parseStandbyMinutes('12')).toBe(0)
  })
})
