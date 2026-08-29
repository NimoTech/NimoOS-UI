import { describe, it, expect } from 'vitest'
import { sortResults, splitTiers, matchPct, searchStateMatchesQuery, type ScoredPhoto } from '../searchSort'
import type { Photo } from '../assetToPhoto'

// Minimal Photo stub: fills only the fields sortResults/splitTiers actually read
// (id/takenAt/belowCut); the rest are skipped via an `as` assertion (the tests only care
// about sort/tier behavior, not Photo's full shape).
// The id type is widened to string | number (matching Photo.id) — narrowing it to string
// would mean the mixed-type scenario that pins down the String() normalization rule never
// runs at all (fix round 1 · I1).
function stubPhoto(id: string | number, takenAt: string | null, belowCut = false): Photo {
  return { id, takenAt, belowCut } as Photo
}

function row(id: string | number, score: number | null, takenAt: string | null, belowCut = false): ScoredPhoto {
  return { p: stubPhoto(id, takenAt, belowCut), score }
}

describe('sortResults', () => {
  it('relevance: descending by score, null treated as 0', () => {
    const rows = [row('a', 0.2, null), row('b', 0.9, null), row('c', null, null)]
    const sorted = sortResults(rows, 'relevance')
    expect(sorted.map(r => r.p.id)).toEqual(['b', 'a', 'c'])
  })

  it('newest/oldest: items with takenAt null always sort last, checked in both directions', () => {
    const rows = [
      row('a', null, '2026-01-01'),
      row('b', null, null),
      row('c', null, '2026-03-01'),
    ]
    const newest = sortResults(rows, 'newest')
    expect(newest[newest.length - 1].p.id).toBe('b')
    const oldest = sortResults(rows, 'oldest')
    expect(oldest[oldest.length - 1].p.id).toBe('b')
  })

  it('equal takenAt -> stable sort by id', () => {
    const rows = [row('b', null, '2026-01-01'), row('a', null, '2026-01-01')]
    const sorted = sortResults(rows, 'newest')
    expect(sorted.map(r => r.p.id)).toEqual(['a', 'b'])
  })

  // fix round 1 · I1 (mutation-tested by review): when id mixes string/number types, the raw
  // comparison `a.p.id > b.p.id` and `String(a.p.id) > String(b.p.id)` give opposite results,
  // which cleanly distinguishes whether String() normalization actually happened. id=10
  // (number) vs id='9' (string), same takenAt:
  // raw comparison 10 > '9' coerces numerically ('9' becomes the number 9) -> true;
  // after String(), '10' > '9' compares lexicographically (first char '1' < '9') -> false —
  // opposite results.
  it('mixed string/number id types -> compared after String() normalization (opposite of a direct comparison, distinguishes whether String() was skipped)', () => {
    const rows = [row(10, null, '2026-01-01'), row('9', null, '2026-01-01')]
    const sorted = sortResults(rows, 'newest')
    // String(10)='10' < String('9')='9' (lexicographic), so 10 sorts before '9'.
    expect(sorted.map(r => r.p.id)).toEqual([10, '9'])
  })

  it('newest and oldest are exact reverses of each other (excluding null items)', () => {
    const rows = [row('a', null, '2026-01-01'), row('b', null, '2026-03-01'), row('c', null, '2026-02-01')]
    const newest = sortResults(rows, 'newest').map(r => r.p.id)
    const oldest = sortResults(rows, 'oldest').map(r => r.p.id)
    expect(newest).toEqual([...oldest].reverse())
  })

  it('does not mutate in place: returns a new array reference, and the input array\'s order is unchanged', () => {
    const rows = [row('b', 0.1, null), row('a', 0.9, null)]
    const original = [...rows]
    const sorted = sortResults(rows, 'relevance')
    expect(sorted).not.toBe(rows)
    expect(rows).toEqual(original)
  })
})

describe('splitTiers', () => {
  it("sort='newest' -> more is empty, best has everything (non-relevance sorts don't tier)", () => {
    const rows = [row('a', null, '2026-01-01', true), row('b', null, '2026-01-02', false)]
    const sorted = sortResults(rows, 'newest')
    const { best, more } = splitTiers(sorted, 'newest')
    expect(more).toEqual([])
    expect(best).toEqual(sorted)
  })

  it("sort='relevance' + 1 of 3 items is belowCut -> best 2 / more 1", () => {
    const rows = [row('a', 0.9, null, false), row('b', 0.8, null, true), row('c', 0.7, null, false)]
    const sorted = sortResults(rows, 'relevance')
    const { best, more } = splitTiers(sorted, 'relevance')
    expect(best.length).toBe(2)
    expect(more.length).toBe(1)
    expect(more[0].p.id).toBe('b')
  })
})

describe('matchPct', () => {
  it('null -> null', () => {
    expect(matchPct(null)).toBeNull()
    expect(matchPct(undefined)).toBeNull()
  })

  it('out-of-range values are clamped to [0,1] before converting to a percentage', () => {
    expect(matchPct(-0.5)).toBe(0)
    expect(matchPct(1.7)).toBe(100)
  })

  it('normal values round to the nearest integer', () => {
    expect(matchPct(0.456)).toBe(46)
  })
})

describe('searchStateMatchesQuery', () => {
  it('isSearchMode: false -> false', () => {
    expect(searchStateMatchesQuery({ isSearchMode: false, searchQuery: 'tokyo' }, 'tokyo')).toBe(false)
  })

  it('query with leading/trailing whitespace -> matches after trimming', () => {
    expect(searchStateMatchesQuery({ isSearchMode: true, searchQuery: 'tokyo' }, '  tokyo  ')).toBe(true)
  })

  it('different query -> false', () => {
    expect(searchStateMatchesQuery({ isSearchMode: true, searchQuery: 'tokyo' }, 'kyoto')).toBe(false)
  })
})
