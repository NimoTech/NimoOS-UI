import { describe, it, expect } from 'vitest'
import {
  asSnapshotVolume, resolveSnapshotState, validatePolicyForm, classifySnapshotType,
  snapshotTypeLabelKey, formatSnapshotClockTime, snapshotDayLabel, toSnapshotViewModel,
  groupSnapshotsByDay, defaultExpandedDayKeys, type SnapshotRaw,
} from './snapshotView'

describe('asSnapshotVolume', () => {
  it('missing fields all get safe defaults (supported/enabled=false, count=0, strings empty)', () => {
    expect(asSnapshotVolume({})).toEqual({
      volume_uuid: '', mount: '', supported: false, enabled: false,
      count: 0, last_at: '', paused_reason: '',
    })
  })
  it('passes backend fields through unchanged', () => {
    const v = asSnapshotVolume({ volume_uuid: 'u1', mount: '/DATA', supported: true, enabled: true, count: 3, last_at: '2026-07-27T01:00:00Z', paused_reason: 'disk full' })
    expect(v.count).toBe(3)
    expect(v.mount).toBe('/DATA')
    expect(v.paused_reason).toBe('disk full')
  })
})

describe('resolveSnapshotState', () => {
  it('null or supported=false → unsupported; when supported, splits into two states by enabled', () => {
    expect(resolveSnapshotState(null)).toBe('unsupported')
    expect(resolveSnapshotState(asSnapshotVolume({ supported: false, enabled: true }))).toBe('unsupported')
    expect(resolveSnapshotState(asSnapshotVolume({ supported: true, enabled: false }))).toBe('disabled')
    expect(resolveSnapshotState(asSnapshotVolume({ supported: true, enabled: true }))).toBe('enabled')
  })
})

describe('validatePolicyForm', () => {
  const ok = { hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 }
  it('valid form → valid=true with no errors', () => {
    expect(validatePolicyForm(ok)).toEqual({ valid: true, errors: {} })
  })
  it('keep is 0/fractional/negative → snapErrPositiveInt', () => {
    expect(validatePolicyForm({ ...ok, hourly_keep: 0 }).errors.hourly_keep).toBe('snapErrPositiveInt')
    expect(validatePolicyForm({ ...ok, daily_keep: 1.5 }).errors.daily_keep).toBe('snapErrPositiveInt')
    expect(validatePolicyForm({ ...ok, weekly_keep: -1 }).errors.weekly_keep).toBe('snapErrPositiveInt')
  })
  it('threshold 0 / 101 / fractional → snapErrPercent; 1 and 100 are valid boundaries', () => {
    expect(validatePolicyForm({ ...ok, pause_threshold_pct: 0 }).errors.pause_threshold_pct).toBe('snapErrPercent')
    expect(validatePolicyForm({ ...ok, pause_threshold_pct: 101 }).errors.pause_threshold_pct).toBe('snapErrPercent')
    expect(validatePolicyForm({ ...ok, pause_threshold_pct: 50.5 }).errors.pause_threshold_pct).toBe('snapErrPercent')
    expect(validatePolicyForm({ ...ok, pause_threshold_pct: 1 }).valid).toBe(true)
    expect(validatePolicyForm({ ...ok, pause_threshold_pct: 100 }).valid).toBe(true)
  })
})

describe('classifySnapshotType', () => {
  it('only manual/preop are called out separately; everything else (including auto-hourly/unknown/undefined) collapses to auto', () => {
    expect(classifySnapshotType('manual')).toBe('manual')
    expect(classifySnapshotType('preop')).toBe('preop')
    expect(classifySnapshotType('auto-hourly')).toBe('auto')
    expect(classifySnapshotType('whatever')).toBe('auto')
    expect(classifySnapshotType(undefined)).toBe('auto')
  })
  it('label key maps one-to-one with the category', () => {
    expect(snapshotTypeLabelKey('manual')).toBe('snapTypeManual')
    expect(snapshotTypeLabelKey('preop')).toBe('snapTypePreop')
    expect(snapshotTypeLabelKey('auto-daily')).toBe('snapTypeAuto')
  })
})

describe('formatSnapshotClockTime', () => {
  it('local clock HH:mm, zero-padded to two digits', () => {
    expect(formatSnapshotClockTime(new Date(2026, 6, 27, 9, 5))).toBe('09:05')
    expect(formatSnapshotClockTime(new Date(2026, 6, 27, 23, 59))).toBe('23:59')
  })
})

describe('snapshotDayLabel', () => {
  const now = new Date(2026, 6, 27, 12, 0)
  it('today/yesterday use an i18n key; anything earlier gets pre-formatted text', () => {
    expect(snapshotDayLabel(new Date(2026, 6, 27, 1, 0), now)).toEqual({ i18nKey: 'snapToday' })
    expect(snapshotDayLabel(new Date(2026, 6, 26, 23, 0), now)).toEqual({ i18nKey: 'snapYesterday' })
    const older = snapshotDayLabel(new Date(2026, 6, 20, 8, 0), now)
    expect(older.i18nKey).toBeUndefined()
    expect(typeof older.text).toBe('string')
  })
})

describe('groupSnapshotsByDay / defaultExpandedDayKeys', () => {
  const snaps: SnapshotRaw[] = [
    { id: 1, name: 'a', type: 'auto-hourly', created_at: new Date(2026, 6, 25, 10, 0).toISOString() },
    { id: 2, name: 'b', type: 'manual', label: '升级前', created_at: new Date(2026, 6, 27, 8, 30).toISOString() },
    { id: 3, name: 'c', type: 'preop', created_at: new Date(2026, 6, 27, 20, 15).toISOString() },
    { id: 4, name: 'd', type: 'auto-daily', created_at: new Date(2026, 6, 26, 6, 0).toISOString() },
  ]
  const now = new Date(2026, 6, 27, 23, 0)
  it('groups by day in descending order, newest first within each group', () => {
    const groups = groupSnapshotsByDay(snaps, now)
    expect(groups.map(g => g.dayKey)).toEqual(['2026-07-27', '2026-07-26', '2026-07-25'])
    expect(groups[0].items.map(i => i.name)).toEqual(['c', 'b'])
  })
  it('does not mutate the input array', () => {
    const input = [...snaps]
    groupSnapshotsByDay(input, now)
    expect(input.map(s => s.name)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('item view carries category / label key / clock time / note', () => {
    const vm = toSnapshotViewModel(snaps[1])
    expect(vm.typeKind).toBe('manual')
    expect(vm.typeLabelKey).toBe('snapTypeManual')
    expect(vm.time).toBe('08:30')
    expect(vm.label).toBe('升级前')
  })
  it('no label normalizes to an empty string (template does a plain truthy check)', () => {
    expect(toSnapshotViewModel(snaps[0]).label).toBe('')
  })
  it('defaults to expanding the most recent 2 groups', () => {
    const groups = groupSnapshotsByDay(snaps, now)
    expect(defaultExpandedDayKeys(groups)).toEqual(['2026-07-27', '2026-07-26'])
    expect(defaultExpandedDayKeys(groups, 1)).toEqual(['2026-07-27'])
  })
  it('empty list → empty groups, empty expanded keys', () => {
    expect(groupSnapshotsByDay([], now)).toEqual([])
    expect(defaultExpandedDayKeys([])).toEqual([])
  })
})
