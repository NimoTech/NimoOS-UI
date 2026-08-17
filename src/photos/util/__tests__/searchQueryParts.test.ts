import { describe, it, expect } from 'vitest'
import { queryParts } from '../searchQueryParts'

describe('queryParts', () => {
  it('empty query → single segment, hl:false', () => {
    expect(queryParts('', ['tokyo'])).toEqual([{ text: '', hl: false }])
  })

  it('empty keywords → single segment, hl:false', () => {
    expect(queryParts('sunset in tokyo', [])).toEqual([{ text: 'sunset in tokyo', hl: false }])
  })

  it('keywords containing a blank string → no infinite loop, result equals the result after filtering out the blank string', { timeout: 1000 }, () => {
    const withBlank = queryParts('sunset in tokyo', ['', 'tokyo'])
    const filtered = queryParts('sunset in tokyo', ['tokyo'])
    expect(withBlank).toEqual(filtered)
  })

  it("queryParts('sunset in tokyo', ['tokyo']) → 2 segments total: 'sunset in ' (false) + 'tokyo' (true)", () => {
    expect(queryParts('sunset in tokyo', ['tokyo'])).toEqual([
      { text: 'sunset in ', hl: false },
      { text: 'tokyo', hl: true },
    ])
  })

  it("multiple occurrences: queryParts('a b a', ['a']) → three segments", () => {
    expect(queryParts('a b a', ['a'])).toEqual([
      { text: 'a', hl: true },
      { text: ' b ', hl: false },
      { text: 'a', hl: true },
    ])
  })

  it("regex metacharacters: keywords containing 'c++' does not throw and still matches 'c++ code'", () => {
    expect(() => queryParts('c++ code', ['c++'])).not.toThrow()
    expect(queryParts('c++ code', ['c++'])).toEqual([
      { text: 'c++', hl: true },
      { text: ' code', hl: false },
    ])
  })

  it('case-insensitive matching but preserves the original text casing', () => {
    expect(queryParts('Tokyo', ['tokyo'])).toEqual([{ text: 'Tokyo', hl: true }])
  })
})
