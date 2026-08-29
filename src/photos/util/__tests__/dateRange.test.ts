import { describe, it, expect } from 'vitest'
import {
  isoDate,
  dateInRange,
  quickRange,
  yearRange,
  rangeLabel,
  calCells,
  calDowLabels,
  calMonthLabel,
  QUICK_KEYS,
} from '../dateRange'

describe('isoDate', () => {
  it('zero-pads both month and day', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('dateInRange', () => {
  it('range is null → true (no filtering)', () => {
    expect(dateInRange('2026-01-01', null)).toBe(true)
  })

  it('range has no start → true', () => {
    expect(dateInRange('2026-01-01', { label: '', start: '', end: null })).toBe(true)
  })

  it('takenAt is null → false (assets with no capture time are excluded once a filter is active)', () => {
    expect(dateInRange(null, { label: '', start: '2026-01-01', end: '2026-01-31' })).toBe(false)
  })

  it('takenAt is a malformed string → false', () => {
    expect(dateInRange('not-a-date', { label: '', start: '2026-01-01', end: '2026-01-31' })).toBe(false)
  })

  it('single-day range (end: null): matches that day, does not match the day before/after', () => {
    const range = { label: '', start: '2026-03-14', end: null }
    expect(dateInRange('2026-03-14T10:00:00Z', range)).toBe(true)
    expect(dateInRange('2026-03-13T10:00:00Z', range)).toBe(false)
    expect(dateInRange('2026-03-15T10:00:00Z', range)).toBe(false)
  })

  it('multi-day range: both endpoints count as a match (closed interval)', () => {
    // Constructed from a local Date (rather than a UTC ISO string) to avoid the test
    // machine's timezone rolling a UTC boundary instant over into an adjacent date —
    // isoDate/dateInRange themselves interpret Date in local time.
    const range = { label: '', start: '2026-03-10', end: '2026-03-12' }
    expect(dateInRange(new Date(2026, 2, 10, 0, 0).toISOString(), range)).toBe(true)
    expect(dateInRange(new Date(2026, 2, 12, 23, 0).toISOString(), range)).toBe(true)
    expect(dateInRange(new Date(2026, 2, 9, 23, 0).toISOString(), range)).toBe(false)
    expect(dateInRange(new Date(2026, 2, 13, 0, 0).toISOString(), range)).toBe(false)
  })
})

describe('quickRange', () => {
  it('today: hours/minutes/seconds are stripped', () => {
    const r = quickRange('today', new Date(2026, 6, 31, 15, 30), 'X')
    expect(r).toEqual({ label: 'X', start: '2026-07-31', end: '2026-07-31', key: 'today' })
  })

  it('last7: start = today - 6 days (not 7)', () => {
    const r = quickRange('last7', new Date(2026, 6, 31), 'X')
    expect(r.start).toBe('2026-07-25')
    expect(r.end).toBe('2026-07-31')
  })

  it('last30: start = today - 29 days', () => {
    const r = quickRange('last30', new Date(2026, 6, 31), 'X')
    expect(r.start).toBe('2026-07-02')
    expect(r.end).toBe('2026-07-31')
  })

  it('thisYear: end is today, not 12/31', () => {
    const r = quickRange('thisYear', new Date(2026, 6, 31), 'X')
    expect(r).toEqual({ label: 'X', start: '2026-01-01', end: '2026-07-31', key: 'thisYear' })
  })

  it('lastYear: the whole of last year', () => {
    const r = quickRange('lastYear', new Date(2026, 6, 31), 'X')
    expect(r).toEqual({ label: 'X', start: '2025-01-01', end: '2025-12-31', key: 'lastYear' })
  })

  it('year boundary: last7 on Jan 3 → start lands on Dec 28 of last year', () => {
    const r = quickRange('last7', new Date(2026, 0, 3), 'X')
    expect(r.start).toBe('2025-12-28')
  })

  // Coverage added back (SP7-P7a-T13 A3): each of the 5 key branches must pass the input
  // key straight through into DateRange.key — run through every enumerated value instead
  // of only the three already covered (today/thisYear/lastYear), to catch cases where the
  // last7/last30 branches' key passthrough was copied wrong (e.g. a slip that hardcodes
  // the literal 'today') without any test catching it.
  it.each(QUICK_KEYS)('key field passes the input key straight through: %s', (k) => {
    expect(quickRange(k, new Date(2026, 6, 31), 'X').key).toBe(k)
  })
})

describe('yearRange', () => {
  it('a whole-year range', () => {
    expect(yearRange(2025, 'X')).toEqual({ label: 'X', start: '2025-01-01', end: '2025-12-31', key: 2025 })
  })

  it('key field is the year number itself (SP7-P7a-T13 A3 coverage added back)', () => {
    expect(yearRange(1999, 'X').key).toBe(1999)
  })
})

describe('rangeLabel', () => {
  it('single day: includes the year, no en dash', () => {
    const out = rangeLabel('2026-03-14', '2026-03-14', 'en_us')
    expect(out).toContain('2026')
    expect(out).not.toContain('–')
  })

  it('same-year range: includes en dash and year', () => {
    const out = rangeLabel('2026-03-14', '2026-03-22', 'en_us')
    expect(out).toContain('–')
    expect(out).toContain('2026')
  })

  it('cross-year range: includes en dash, no year (matches Vue2\'s quirk)', () => {
    const out = rangeLabel('2025-12-30', '2026-01-02', 'en_us')
    expect(out).toContain('–')
    expect(out).not.toContain('2026')
  })

  it('locale takes effect: zh_cn and en_us produce different results', () => {
    const zhOut = rangeLabel('2026-03-14', '2026-03-22', 'zh_cn')
    const enOut = rangeLabel('2026-03-14', '2026-03-22', 'en_us')
    expect(zhOut).not.toBe(enOut)
  })
})

describe('calCells', () => {
  it('July 2026 (the 1st is a Wednesday): 3 leading blanks, then 31 non-blank, 34 total; in/start/end all falsy', () => {
    const cells = calCells(2026, 6, null)
    expect(cells.length).toBe(34)
    expect(cells.slice(0, 3).every((c) => c.blank)).toBe(true)
    expect(cells.slice(3).every((c) => !c.blank)).toBe(true)
    for (const c of cells) {
      expect(c.in).toBeFalsy()
      expect(c.start).toBeFalsy()
      expect(c.end).toBeFalsy()
    }
  })

  it('with a range: both endpoints are flagged correctly, in is true for every day inside the range and false outside it', () => {
    const range = { label: '', start: '2026-07-10', end: '2026-07-12' }
    const cells = calCells(2026, 6, range)
    const byDate = (day: string) => cells.find((c) => c.date === day)!
    expect(byDate('2026-07-10').start).toBe(true)
    expect(byDate('2026-07-10').in).toBe(true)
    expect(byDate('2026-07-11').start).toBe(false)
    expect(byDate('2026-07-11').end).toBe(false)
    expect(byDate('2026-07-11').in).toBe(true)
    expect(byDate('2026-07-12').end).toBe(true)
    expect(byDate('2026-07-12').in).toBe(true)
    const d09 = byDate('2026-07-09')
    expect(d09.start).toBe(false)
    expect(d09.end).toBe(false)
    expect(d09.in).toBe(false)
  })

  it('single-day range (end: null): that day has both start and end true (the result of hi = end || start)', () => {
    const range = { label: '', start: '2026-07-10', end: null }
    const cells = calCells(2026, 6, range)
    const cell = cells.find((c) => c.date === '2026-07-10')!
    expect(cell.start).toBe(true)
    expect(cell.end).toBe(true)
  })

  it('leap-year February has 29 days, common-year February has 28', () => {
    expect(calCells(2024, 1, null).filter((c) => !c.blank).length).toBe(29)
    expect(calCells(2026, 1, null).filter((c) => !c.blank).length).toBe(28)
  })
})

describe('calDowLabels', () => {
  it('length 7, first item is the narrow label for Sunday', () => {
    const labels = calDowLabels('en_us')
    expect(labels.length).toBe(7)
    expect(labels[0]).toBe('S')
  })

  it('zh_cn and en_us produce different results', () => {
    expect(calDowLabels('zh_cn')).not.toEqual(calDowLabels('en_us'))
  })

  // fix wave F5 (final-review required fix, mutation-tested): the `labels[0] === 'S'`
  // assertion for en_us above has no discriminating power — the narrow English label for
  // Saturday is also 'S', so if the implementation quietly changed its anchor from
  // `new Date(1970, 0, 4 + i)` (1970-01-04 is a Sunday) to `3 + i` (shifting the whole row
  // one day to the right, making it Saturday-first), `labels[0]` would still be 'S' and this
  // assertion would stay green — while calCells() uses `getDay()` to compute leading blanks
  // under the existing "Sunday-first" convention, so any mismatch between the two would put
  // every date in the calendar under the wrong day-of-week column (on a real device you'd
  // see every date in the month shifted left/right by one column). The Chinese narrow labels
  // are unambiguous: Sunday is '日', Saturday is '六' — use them to pin down the invariant
  // that the first item really is Sunday, not Saturday.
  it('zh_cn\'s first item is "日" (Sunday), not "六" (Saturday) — pins down the Sunday-first invariant (fix wave F5)', () => {
    expect(calDowLabels('zh_cn')[0]).toBe('日')
  })
})

describe('calMonthLabel', () => {
  it('includes the year', () => {
    expect(calMonthLabel(2026, 6, 'en_us')).toContain('2026')
  })

  it('zh_cn and en_us produce different results', () => {
    expect(calMonthLabel(2026, 6, 'zh_cn')).not.toBe(calMonthLabel(2026, 6, 'en_us'))
  })
})
