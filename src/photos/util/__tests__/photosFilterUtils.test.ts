// SP7-P7b-T1: EXIF filter predicates.
// Ported from the Vue 2 panel tests/photosFilterUtils.test.js (58 lines), with the
// "excludes archived ids" case dropped per D17/F2 (the archive loop is fully dead in
// Vue2 and was never migrated to New-UI), plus an added F1 regression case.
import { describe, expect, it } from 'vitest'
import { applyExifFilters, matchesExifFilters, photoYear } from '../photosFilterUtils'

// Use a localized date string (same shape as the `date` produced by assetToPhoto), so
// getFullYear() returns the nominal year and isn't affected by the test machine's timezone.
const p = (over: Record<string, unknown> = {}) => ({
  id: 'x', date: 'May 1, 2023', place: 'Tokyo, Japan', camera: 'Sony A7 · 35mm', ...over,
})

describe('photosFilterUtils', () => {
  it('photoYear extracts the year, returns empty string when there is no date', () => {
    expect(photoYear(p())).toBe('2023')
    expect(photoYear(p({ date: '' }))).toBe('')
  })

  it('photoYear returns empty string for an Invalid Date', () => {
    expect(photoYear({ date: 'not-a-date' })).toBe('')
  })

  it('photoYear returns empty string for null/undefined', () => {
    expect(photoYear(null)).toBe('')
    expect(photoYear(undefined)).toBe('')
  })

  it('passes everything through when no filters are set', () => {
    expect(matchesExifFilters(p(), {})).toBe(true)
    expect(matchesExifFilters(p())).toBe(true)
  })

  it('filters by year / city name segment / camera body name segment', () => {
    expect(matchesExifFilters(p(), { years: ['2023'] })).toBe(true)
    expect(matchesExifFilters(p(), { years: ['2024'] })).toBe(false)
    expect(matchesExifFilters(p(), { places: ['Tokyo'] })).toBe(true)
    expect(matchesExifFilters(p(), { places: ['Osaka'] })).toBe(false)
    expect(matchesExifFilters(p(), { cameras: ['Sony A7'] })).toBe(true)
    expect(matchesExifFilters(p(), { cameras: ['Canon'] })).toBe(false)
  })

  it('is AND semantics when multiple dimensions are active at once', () => {
    expect(matchesExifFilters(p(), { years: ['2023'], places: ['Osaka'] })).toBe(false)
    expect(matchesExifFilters(p(), { years: ['2023'], places: ['Tokyo'] })).toBe(true)
    expect(matchesExifFilters(p(), { years: ['2022'], places: ['Tokyo'] })).toBe(false)
  })

  it('excludes a dateless photo only when the year filter is active', () => {
    expect(matchesExifFilters(p({ date: '' }), {})).toBe(true)
    expect(matchesExifFilters(p({ date: '' }), { years: ['2023'] })).toBe(false)
  })

  it('matches place/camera as empty string when null, without throwing', () => {
    expect(matchesExifFilters(p({ place: null }), { places: ['Tokyo'] })).toBe(false)
    expect(matchesExifFilters(p({ camera: null }), { cameras: ['Sony A7'] })).toBe(false)
    expect(matchesExifFilters(p({ place: null, camera: null }), {})).toBe(true)
  })

  it('applyExifFilters filters a list and tolerates null input', () => {
    const list = [
      p({ id: '1', date: 'January 1, 2023' }),
      p({ id: '2', date: 'January 1, 2022' }),
    ]
    expect(applyExifFilters(list, { years: ['2023'] }).map(x => x.id)).toEqual(['1'])
    expect(applyExifFilters(null, { years: ['2023'] })).toEqual([])
    expect(applyExifFilters(undefined, { years: ['2023'] })).toEqual([])
  })

  it('D17/F2: the archiveIds branch has been removed — passing it has no effect', () => {
    // The Vue2 version would return false on an archiveIds hit; this repo has removed that
    // branch entirely, so the extra key must be ignored (not silently revive archive semantics).
    expect(matchesExifFilters(p({ id: 'arch' }), { archiveIds: ['arch'] } as never)).toBe(true)
  })
})
