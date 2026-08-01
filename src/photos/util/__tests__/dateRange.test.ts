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
} from '../dateRange'

describe('isoDate', () => {
  it('零填充月和日两处', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('dateInRange', () => {
  it('range 为 null → true(不过滤)', () => {
    expect(dateInRange('2026-01-01', null)).toBe(true)
  })

  it('range 无 start → true', () => {
    expect(dateInRange('2026-01-01', { label: '', start: '', end: null })).toBe(true)
  })

  it('takenAt 为 null → false(有过滤时无拍摄时间的资产被排除)', () => {
    expect(dateInRange(null, { label: '', start: '2026-01-01', end: '2026-01-31' })).toBe(false)
  })

  it('takenAt 是坏串 → false', () => {
    expect(dateInRange('not-a-date', { label: '', start: '2026-01-01', end: '2026-01-31' })).toBe(false)
  })

  it('单日区间(end: null):命中当天,不命中前后一天', () => {
    const range = { label: '', start: '2026-03-14', end: null }
    expect(dateInRange('2026-03-14T10:00:00Z', range)).toBe(true)
    expect(dateInRange('2026-03-13T10:00:00Z', range)).toBe(false)
    expect(dateInRange('2026-03-15T10:00:00Z', range)).toBe(false)
  })

  it('跨日区间:两个端点都算命中(闭区间)', () => {
    // 用本地 Date 构造(而非 UTC ISO 字符串)传入,避开跑测机器时区把 UTC 边界时刻
    // 卷到相邻日期的问题——isoDate/dateInRange 本身就是按本地时区解读 Date 的。
    const range = { label: '', start: '2026-03-10', end: '2026-03-12' }
    expect(dateInRange(new Date(2026, 2, 10, 0, 0).toISOString(), range)).toBe(true)
    expect(dateInRange(new Date(2026, 2, 12, 23, 0).toISOString(), range)).toBe(true)
    expect(dateInRange(new Date(2026, 2, 9, 23, 0).toISOString(), range)).toBe(false)
    expect(dateInRange(new Date(2026, 2, 13, 0, 0).toISOString(), range)).toBe(false)
  })
})

describe('quickRange', () => {
  it("today:时分秒被抹掉", () => {
    const r = quickRange('today', new Date(2026, 6, 31, 15, 30), 'X')
    expect(r).toEqual({ label: 'X', start: '2026-07-31', end: '2026-07-31' })
  })

  it('last7: start = today - 6 天(不是 7)', () => {
    const r = quickRange('last7', new Date(2026, 6, 31), 'X')
    expect(r.start).toBe('2026-07-25')
    expect(r.end).toBe('2026-07-31')
  })

  it('last30: start = today - 29 天', () => {
    const r = quickRange('last30', new Date(2026, 6, 31), 'X')
    expect(r.start).toBe('2026-07-02')
    expect(r.end).toBe('2026-07-31')
  })

  it('thisYear: end 是今天,不是 12/31', () => {
    const r = quickRange('thisYear', new Date(2026, 6, 31), 'X')
    expect(r).toEqual({ label: 'X', start: '2026-01-01', end: '2026-07-31' })
  })

  it('lastYear: 去年整年', () => {
    const r = quickRange('lastYear', new Date(2026, 6, 31), 'X')
    expect(r).toEqual({ label: 'X', start: '2025-01-01', end: '2025-12-31' })
  })

  it('跨年边界: last7 在 1 月 3 日 → start 落到去年 12 月 28 日', () => {
    const r = quickRange('last7', new Date(2026, 0, 3), 'X')
    expect(r.start).toBe('2025-12-28')
  })
})

describe('yearRange', () => {
  it('整年区间', () => {
    expect(yearRange(2025, 'X')).toEqual({ label: 'X', start: '2025-01-01', end: '2025-12-31' })
  })
})

describe('rangeLabel', () => {
  it('单日:含年份,不含 en dash', () => {
    const out = rangeLabel('2026-03-14', '2026-03-14', 'en_us')
    expect(out).toContain('2026')
    expect(out).not.toContain('–')
  })

  it('同年区间:含 en dash 和年份', () => {
    const out = rangeLabel('2026-03-14', '2026-03-22', 'en_us')
    expect(out).toContain('–')
    expect(out).toContain('2026')
  })

  it('跨年区间:含 en dash,不含年份(照搬 Vue2 的瑕疵)', () => {
    const out = rangeLabel('2025-12-30', '2026-01-02', 'en_us')
    expect(out).toContain('–')
    expect(out).not.toContain('2026')
  })

  it('locale 生效:zh_cn 与 en_us 结果不同', () => {
    const zhOut = rangeLabel('2026-03-14', '2026-03-22', 'zh_cn')
    const enOut = rangeLabel('2026-03-14', '2026-03-22', 'en_us')
    expect(zhOut).not.toBe(enOut)
  })
})

describe('calCells', () => {
  it('2026 年 7 月(1 日周三):前 3 个 blank,之后 31 个非 blank,总 34;in/start/end 全 falsy', () => {
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

  it('带 range:起止两端标记正确,区间内每天 in 为真,区间外为假', () => {
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

  it('单日区间(end: null):该天 start 与 end 都真(hi = end || start 的结果)', () => {
    const range = { label: '', start: '2026-07-10', end: null }
    const cells = calCells(2026, 6, range)
    const cell = cells.find((c) => c.date === '2026-07-10')!
    expect(cell.start).toBe(true)
    expect(cell.end).toBe(true)
  })

  it('闰年二月 29 天,平年二月 28 天', () => {
    expect(calCells(2024, 1, null).filter((c) => !c.blank).length).toBe(29)
    expect(calCells(2026, 1, null).filter((c) => !c.blank).length).toBe(28)
  })
})

describe('calDowLabels', () => {
  it('长度 7,首项是周日的窄标签', () => {
    const labels = calDowLabels('en_us')
    expect(labels.length).toBe(7)
    expect(labels[0]).toBe('S')
  })

  it('zh_cn 与 en_us 结果不同', () => {
    expect(calDowLabels('zh_cn')).not.toEqual(calDowLabels('en_us'))
  })
})

describe('calMonthLabel', () => {
  it('含年份', () => {
    expect(calMonthLabel(2026, 6, 'en_us')).toContain('2026')
  })

  it('zh_cn 与 en_us 结果不同', () => {
    expect(calMonthLabel(2026, 6, 'zh_cn')).not.toBe(calMonthLabel(2026, 6, 'en_us'))
  })
})
