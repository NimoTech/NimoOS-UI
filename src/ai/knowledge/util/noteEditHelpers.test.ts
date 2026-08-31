// Inherit Vue2's existing `__tests__/noteEditHelpers.spec.js` (2 cases,
// governance §4.3), plus more thorough than original spec (each branch + early exit paths).
import { describe, it, expect } from 'vitest'
import { parseTags, conflictMessage } from './noteEditHelpers'

describe('parseTags', () => {
  // Original __tests__/noteEditHelpers.spec.js:5 —— comma + whitespace mixed delimiters, trim, dedupe.
  it('comma and whitespace mixed delimiters, trim, deduplicate —— original spec example', () => {
    expect(parseTags(' a, b ,a  c,')).toEqual(['a', 'b', 'c'])
  })

  it('empty string → [] (original spec example)', () => {
    expect(parseTags('')).toEqual([])
  })

  it('null / undefined both → [] (loose fallback of String(str || ""))', () => {
    expect(parseTags(null)).toEqual([])
    expect(parseTags(undefined)).toEqual([])
  })

  it('single comma-separated simple case, no deduplication', () => {
    expect(parseTags('foo,bar')).toEqual(['foo', 'bar'])
  })

  it('whitespace-only delimiters also work (not just comma)', () => {
    expect(parseTags('foo bar   baz')).toEqual(['foo', 'bar', 'baz'])
  })

  it('deduplication after trim ("a" and " a " same tag)', () => {
    expect(parseTags('a, a ,  a')).toEqual(['a'])
  })
})

describe('conflictMessage', () => {
  // Original __tests__/noteEditHelpers.spec.js:11 —— on 409, string contains revision number.
  it('409 → return string contains revision number (original spec example: current_revision=4)', () => {
    const msg = conflictMessage({ response: { status: 409, data: { current_revision: 4 } } })
    expect(msg).toContain('4')
  })

  // N23: string doesn't go through i18n, but content can't simplify to `return true` —— use
  // another revision to cross-verify return is "complete string with that revision", not
  // coincidence of toContain('4').
  it('409 → complete string exact match (not simplified return true)', () => {
    const msg = conflictMessage({ response: { status: 409, data: { current_revision: 7 } } })
    expect(msg).toBe('Note changed elsewhere (now revision 7) — reload and retry')
  })

  it('non-409 status code → null (original spec example: 500)', () => {
    expect(conflictMessage({ response: { status: 500 } })).toBe(null)
  })

  it('no response (not axios error) → null (original spec example: {})', () => {
    expect(conflictMessage({})).toBe(null)
  })

  it('err itself null / undefined → null (early exit path, original spec uncovered, supplemented)', () => {
    expect(conflictMessage(null)).toBe(null)
    expect(conflictMessage(undefined)).toBe(null)
  })

  it('409 but data missing current_revision → "undefined" in string (Vue2 status quo, copied verbatim; still truthy)', () => {
    const msg = conflictMessage({ response: { status: 409, data: {} } })
    expect(msg).toBe('Note changed elsewhere (now revision undefined) — reload and retry')
  })
})
