import { describe, it, expect } from 'vitest'
import { createSkillErrorKey, validateSkillForm } from './skillsErrorKey'

/** Wrap a raw backend string the way axios would, so createSkillErrorKey can read it. */
function errWith(message: string) {
  return { response: { data: { message } } }
}

describe('createSkillErrorKey', () => {
  // Real Go error strings, taken verbatim from NimoOS-AI/service/skills_store.go
  // (fmt.Errorf("%w: <reason>", ErrBadSkillID / ErrBadDescription / ErrDuplicateSkill /
  // ErrBadPath / ErrBundleTooLarge) and the SKILL.md size message).
  it('maps "skill already exists"', () => {
    expect(createSkillErrorKey(errWith('skill already exists'))).toBe('aiSkErrDuplicate')
  })

  it('maps "invalid skill id"', () => {
    expect(createSkillErrorKey(errWith('invalid skill id'))).toBe('aiSkErrBadId')
  })

  it('maps "invalid skill description: description required"', () => {
    expect(createSkillErrorKey(errWith('invalid skill description: description required'))).toBe(
      'aiSkErrDescRequired'
    )
  })

  it('maps "invalid skill description: longer than 256 characters"', () => {
    expect(
      createSkillErrorKey(errWith('invalid skill description: longer than 256 characters'))
    ).toBe('aiSkErrDescTooLong')
  })

  it('maps "invalid skill description: must be a single line"', () => {
    expect(
      createSkillErrorKey(errWith('invalid skill description: must be a single line'))
    ).toBe('aiSkErrDescSingleLine')
  })

  it('maps "invalid skill description: \'<\' and \'>\' are not allowed"', () => {
    expect(
      createSkillErrorKey(errWith("invalid skill description: '<' and '>' are not allowed"))
    ).toBe('aiSkErrDescAngle')
  })

  it('maps "invalid skill description: control characters are not allowed"', () => {
    expect(
      createSkillErrorKey(errWith('invalid skill description: control characters are not allowed'))
    ).toBe('aiSkErrDescControl')
  })

  it('maps "invalid file path in bundle"', () => {
    expect(createSkillErrorKey(errWith('invalid file path in bundle'))).toBe('aiSkErrBadPath')
  })

  it('maps "bundle exceeds size limits"', () => {
    expect(createSkillErrorKey(errWith('bundle exceeds size limits'))).toBe('aiSkErrBundleTooLarge')
  })

  // MaxSkillMDBytes = 50 * 1024 = 51200 (NimoOS-AI/service/skills_store.go:121); the
  // error is fmt.Errorf("SKILL.md exceeds %d bytes (got %d)", MaxSkillMDBytes, size)
  // at skills_store.go:155/229. Real limit, not a made-up number.
  it('maps "SKILL.md exceeds 51200 bytes (got 60000)" (case-insensitive)', () => {
    expect(createSkillErrorKey(errWith('SKILL.md exceeds 51200 bytes (got 60000)'))).toBe(
      'aiSkErrMdTooLarge'
    )
  })

  it('falls back to aiSkErrCreateFailed for an unrecognized backend string', () => {
    expect(createSkillErrorKey(errWith('something went sideways'))).toBe('aiSkErrCreateFailed')
  })

  it('falls back to aiSkErrCreateFailed when no error string can be extracted', () => {
    expect(createSkillErrorKey(new Error('network down'))).toBe('aiSkErrCreateFailed')
    expect(createSkillErrorKey(undefined)).toBe('aiSkErrCreateFailed')
    expect(createSkillErrorKey(null)).toBe('aiSkErrCreateFailed')
  })

  it('reads .detail when .message is absent (FastAPI shape)', () => {
    expect(createSkillErrorKey({ response: { data: { detail: 'skill already exists' } } })).toBe(
      'aiSkErrDuplicate'
    )
  })

  it('is case-insensitive on the backend string', () => {
    expect(createSkillErrorKey(errWith('SKILL ALREADY EXISTS'))).toBe('aiSkErrDuplicate')
  })
})

describe('validateSkillForm', () => {
  it('rejects an empty name', () => {
    expect(validateSkillForm('', 'a valid description')).toBe('aiSkErrBadId')
  })

  it('rejects a whitespace-only name', () => {
    expect(validateSkillForm('   ', 'a valid description')).toBe('aiSkErrBadId')
  })

  it('accepts a single-character name ("a")', () => {
    expect(validateSkillForm('a', 'a valid description')).toBe(null)
  })

  it('rejects uppercase letters in the name', () => {
    expect(validateSkillForm('Invoice-Tagger', 'a valid description')).toBe('aiSkErrBadId')
  })

  it('rejects underscores in the name', () => {
    expect(validateSkillForm('invoice_tagger', 'a valid description')).toBe('aiSkErrBadId')
  })

  it('rejects a name starting with a dash', () => {
    expect(validateSkillForm('-invoice-tagger', 'a valid description')).toBe('aiSkErrBadId')
  })

  it('rejects a name ending with a dash', () => {
    expect(validateSkillForm('invoice-tagger-', 'a valid description')).toBe('aiSkErrBadId')
  })

  it('accepts a name exactly at the 64-char boundary', () => {
    // 1 leading + 62 middle + 1 trailing = 64 chars total, matches skillIDRe exactly.
    const name = 'a' + 'b'.repeat(62) + 'c'
    expect(name.length).toBe(64)
    expect(validateSkillForm(name, 'a valid description')).toBe(null)
  })

  it('rejects a name one char past the 64-char boundary', () => {
    const name = 'a' + 'b'.repeat(63) + 'c'
    expect(name.length).toBe(65)
    expect(validateSkillForm(name, 'a valid description')).toBe('aiSkErrBadId')
  })

  it('rejects an empty description', () => {
    expect(validateSkillForm('valid-name', '')).toBe('aiSkErrDescRequired')
  })

  it('rejects a whitespace-only description', () => {
    expect(validateSkillForm('valid-name', '   ')).toBe('aiSkErrDescRequired')
  })

  it('accepts a description exactly at the 256-char boundary', () => {
    const description = 'x'.repeat(256)
    expect(validateSkillForm('valid-name', description)).toBe(null)
  })

  it('rejects a description one char past the 256-char boundary', () => {
    const description = 'x'.repeat(257)
    expect(validateSkillForm('valid-name', description)).toBe('aiSkErrDescTooLong')
  })

  it('rejects a description containing a newline', () => {
    expect(validateSkillForm('valid-name', 'line one\nline two')).toBe('aiSkErrDescSingleLine')
  })

  it('rejects a description containing a carriage return', () => {
    expect(validateSkillForm('valid-name', 'line one\rline two')).toBe('aiSkErrDescSingleLine')
  })

  it('rejects a description containing "<"', () => {
    expect(validateSkillForm('valid-name', 'use <tag> here')).toBe('aiSkErrDescAngle')
  })

  it('rejects a description containing ">"', () => {
    expect(validateSkillForm('valid-name', 'a > b')).toBe('aiSkErrDescAngle')
  })

  it('rejects a description containing a control character (\\x07)', () => {
    expect(validateSkillForm('valid-name', 'bell\x07here')).toBe('aiSkErrDescControl')
  })

  it('returns null when both name and description are valid', () => {
    expect(validateSkillForm('invoice-tagger', 'Tags invoices when they arrive.')).toBe(null)
  })
})
