// Unit tests migrated from the two local isConflict cases in T5 AlbumPickerDialog.test.ts (after
// extracting the util, the component side keeps its own end-to-end 409 behavior assertion — i.e.
// "when a 409 is thrown, the component really shows the duplicate-name toast"; here we only test
// the predicate function itself).
import { describe, it, expect } from 'vitest'
import { isConflict } from '../httpErrors'

describe('isConflict', () => {
  it('e.response.status === 409 → true', () => {
    const err = Object.assign(new Error('conflict'), { response: { status: 409 } })
    expect(isConflict(err)).toBe(true)
  })

  it('no response field but message contains 409 → true (message fallback)', () => {
    const err = new Error('request failed with status code 409')
    expect(isConflict(err)).toBe(true)
  })

  it('a non-409 error (e.g. network error) → false', () => {
    expect(isConflict(new Error('network error'))).toBe(false)
  })

  it('response.status is not 409 → false', () => {
    const err = Object.assign(new Error('bad request'), { response: { status: 400 } })
    expect(isConflict(err)).toBe(false)
  })

  it('non-object/null/undefined → false (don\'t assume the error shape, avoid a secondary throw)', () => {
    expect(isConflict(null)).toBe(false)
    expect(isConflict(undefined)).toBe(false)
    expect(isConflict('plain string error')).toBe(false)
  })

  it('word-boundary alignment matching isNotFound — do not misjudge 4090 / 1409 as 409', () => {
    expect(isConflict(new Error('code 4090'))).toBe(false)
    expect(isConflict(new Error('req 1409 failed'))).toBe(false)
    expect(isConflict(new Error('HTTP 409'))).toBe(true)
    expect(isConflict(Object.assign(new Error('x'), { response: { status: 409 } }))).toBe(true)
  })
})
