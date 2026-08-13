// SP8-P5a Task 9 —— Ported from Vue2 `src/views/AI/Knowledge/__tests__/dashboardHelpers.spec.js`
// (main@7a6ee6b7). The original spec has 6 test cases (updatePeak 1, progressPercent 1,
// fmtEta 1, summarizeNotes 3); the test code from brief adds 3 edge cases (updatePeak
// default tolerance, progressPercent negative peak, fmtEta 0/3600 new assertions), and
// brief code is copied verbatim word-for-word in this file.
//
// After brief code, we add a second group of "switch point sides" supplementary cases
// (governance §9 hard requirement: every "A/B binary choice" branch must have assertions
// on both sides) —— these are new coverage added this round, not part of the brief's
// verbatim section, grouped separately with rationale noted.
import { describe, it, expect } from 'vitest'
import { progressPercent, fmtEta, updatePeak, summarizeNotes } from './dashboardHelpers'

describe('dashboard progress helpers', () => {
  it('updatePeak is a rolling maximum', () => {
    expect(updatePeak(0, 50)).toBe(50)
    expect(updatePeak(50, 30)).toBe(50)
    expect(updatePeak(50, 80)).toBe(80)
  })

  it('updatePeak tolerates 0/NaN defaults', () => {
    expect(updatePeak(undefined as unknown as number, 5)).toBe(5)
    expect(updatePeak(5, undefined as unknown as number)).toBe(5)
  })

  it('progressPercent clamps to 0..100, recedes when backlog grows', () => {
    expect(progressPercent(0, 0)).toBe(0)
    expect(progressPercent(100, 100)).toBe(0)
    expect(progressPercent(25, 100)).toBe(75)
    expect(progressPercent(0, 100)).toBe(100)
    const peak = updatePeak(100, 120)
    expect(progressPercent(120, peak)).toBe(0)
  })

  it('progressPercent returns 0 for negative peak (no negative values)', () => {
    expect(progressPercent(10, -5)).toBe(0)
  })

  it('fmtEta renders human-readable duration', () => {
    expect(fmtEta(null)).toBe('')
    expect(fmtEta(0)).toBe('')
    expect(fmtEta(45)).toBe('<1m')
    expect(fmtEta(150)).toBe('2m')
    expect(fmtEta(5400)).toBe('1h 30m')
    expect(fmtEta(3600)).toBe('1h 0m')
  })
})

describe('summarizeNotes', () => {
  it('counts by status', () => {
    expect(summarizeNotes([{ status: 'draft' }, { status: 'draft' }, { status: 'curated' }, { status: 'archived' }]))
      .toEqual({ total: 4, draft: 2, curated: 1, archived: 1 })
  })

  it('unknown status adds only to total (distribution bar does not over-report)', () => {
    expect(summarizeNotes([{ status: 'weird' }, null as never, { status: 'draft' }]))
      .toEqual({ total: 2, draft: 1, curated: 0, archived: 0 })
  })

  it('empty and default inputs both result in all zeros', () => {
    expect(summarizeNotes([])).toEqual({ total: 0, draft: 0, curated: 0, archived: 0 })
    expect(summarizeNotes(undefined)).toEqual({ total: 0, draft: 0, curated: 0, archived: 0 })
  })
})

// ---- Supplement: switch point sides comparison (new this round, not part of brief's verbatim) ----

describe('updatePeak branch boundary supplement', () => {
  it('when backlog equals peak, unchanged (boundary between "exceed" and "below")', () => {
    // dashboardHelpers.ts:9 `Math.max` —— when equal, both sides yield same result, pin
    // this moment to prevent mischange to strict `>` variants (50,50 would still be 50,
    // consistent with Math.max semantics, but RED probe below validates we catch the
    // real error: comparison operator direction).
    expect(updatePeak(50, 50)).toBe(50)
  })
})

describe('progressPercent branch boundary supplement', () => {
  it('non-integer results round (Math.round, not truncate)', () => {
    // (1 - 1/3) * 100 = 66.666...7 → rounds to 67; if implemented with Math.floor
    // would get 66; use this to pin the rounding method.
    expect(progressPercent(1, 3)).toBe(67)
    // (1 - 2/3) * 100 = 33.333...3 → rounds to 33; floor also gives 33; paired with
    // above, each side (round up vs down) is hit once.
    expect(progressPercent(2, 3)).toBe(33)
  })
})

describe('fmtEta branch boundary supplement', () => {
  it('minute boundary between <1m and {m}m (59s vs 60s)', () => {
    expect(fmtEta(59)).toBe('<1m')
    expect(fmtEta(60)).toBe('1m')
  })

  it('hour boundary between {m}m and {h}h {m}m (59 min vs 60 min)', () => {
    expect(fmtEta(3540)).toBe('59m') // 59*60 = 3540s
    expect(fmtEta(3600)).toBe('1h 0m') // 60*60 = 3600s, already covered in brief case above, pair here to mark boundary semantics
  })

  it('etaS<=0 branch both sides: 0 and negative return empty, undefined and null same branch', () => {
    expect(fmtEta(-10)).toBe('')
    expect(fmtEta(undefined)).toBe('')
  })
})

describe('summarizeNotes(null) input', () => {
  it('null and undefined same branch, both return all zeros', () => {
    // Original `for (const n of notes || [])`—— null and undefined both fallback via `||[]`,
    // same branch; brief only tested undefined, supplement null side here.
    expect(summarizeNotes(null)).toEqual({ total: 0, draft: 0, curated: 0, archived: 0 })
  })
})
