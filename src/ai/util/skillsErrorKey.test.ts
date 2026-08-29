import { describe, it, expect } from 'vitest'
import { createSkillErrorKey, validateSkillForm, slugify } from './skillsErrorKey'

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
  // Acceptance patch A1: report separate error reasons for name. After slugify, charset problems
  // are structurally impossible, so "empty slug" and "too long" each have dedicated keys, no longer
  // falling back to aiSkErrBadId which discusses charset.
  it('rejects an empty name (no alphanumeric survives slugify)', () => {
    expect(validateSkillForm('', 'a valid description')).toBe('aiSkErrNameNoAlnum')
  })

  it('rejects a whitespace-only name (no alphanumeric survives slugify)', () => {
    expect(validateSkillForm('   ', 'a valid description')).toBe('aiSkErrNameNoAlnum')
  })

  it('accepts a single-character name ("a")', () => {
    expect(validateSkillForm('a', 'a valid description')).toBe(null)
  })

  // P3b final review C1 — these four previously pinned 'aiSkErrBadId' as assertions, but the
  // backend slugifies(name) first then validates (skills_store.go:221); these four original names
  // all slugify to valid ids ("Invoice-Tagger"/"invoice_tagger" -> "invoice-tagger", leading/trailing
  // '-' removed by strings.Trim) — the backend can create successfully, Vue2 (only checking non-empty)
  // can also create successfully, but we previously rejected them under the guise of "same validation",
  // which is a reproducible feature regression, not a valid validation result.
  // Before (incorrect, deleted):
  //   expect(validateSkillForm('Invoice-Tagger', ...)).toBe('aiSkErrBadId')
  //   expect(validateSkillForm('invoice_tagger', ...)).toBe('aiSkErrBadId')
  //   expect(validateSkillForm('-invoice-tagger', ...)).toBe('aiSkErrBadId')
  //   expect(validateSkillForm('invoice-tagger-', ...)).toBe('aiSkErrBadId')
  it('accepts uppercase letters in the name (backend slugifies before validating)', () => {
    expect(validateSkillForm('Invoice-Tagger', 'a valid description')).toBe(null)
  })

  it('accepts underscores in the name (slugify folds them into a single dash)', () => {
    expect(validateSkillForm('invoice_tagger', 'a valid description')).toBe(null)
  })

  it('accepts a name starting with a dash (leading separator is dropped, not written)', () => {
    expect(validateSkillForm('-invoice-tagger', 'a valid description')).toBe(null)
  })

  it('accepts a name ending with a dash (trailing separator is trimmed by slugify)', () => {
    expect(validateSkillForm('invoice-tagger-', 'a valid description')).toBe(null)
  })

  it('accepts a name with spaces and mixed case (realistic UI input, e.g. "Invoice Tagger")', () => {
    expect(validateSkillForm('Invoice Tagger', 'a valid description')).toBe(null)
  })

  // Truly invalid input: slug still does not satisfy skillIDRe.
  it('rejects a name made entirely of non-alphanumeric characters (slugifies to an empty string)', () => {
    expect(validateSkillForm('!!!___---', 'a valid description')).toBe('aiSkErrNameNoAlnum')
  })

  it('rejects a name that is pure Chinese characters (slugifies to an empty string, no [a-z0-9] survives)', () => {
    expect(validateSkillForm('发票标签', 'a valid description')).toBe('aiSkErrNameNoAlnum')
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
    expect(validateSkillForm(name, 'a valid description')).toBe('aiSkErrNameTooLong')
  })

  // Acceptance patch A1 regression guard: real user test case — when a name is too long, the message
  // must mention length, never the character-set message (both are non-null, weak assertion with
  // not.toBeNull() cannot catch this bug).
  it('a too-long name reports length, never the character-set message', () => {
    const key = validateSkillForm('a-very-long-invoice-tagger-name-'.repeat(5), 'a valid description')
    expect(key).toBe('aiSkErrNameTooLong')
    expect(key).not.toBe('aiSkErrBadId')
  })

  // Reverse guard: a name that is too long but has no [a-z0-9] characters (pure Chinese sentence),
  // the real reason is "slug is empty" not "too long" — the two dedicated keys must not override each
  // other.
  it('a long name with no alphanumerics reports no-alnum, not too-long', () => {
    expect(validateSkillForm('这是一个非常长的技能名字'.repeat(10), 'a valid description'))
      .toBe('aiSkErrNameNoAlnum')
  })

  // Length is measured on the slug, not the raw input: raw 70 characters with spaces and uppercase,
  // still > 64 after slugify, so should still be judged as too long (not as charset-invalid due to
  // spaces/uppercase).
  it('length is measured on the slug, not the raw input', () => {
    const raw = 'Invoice Tagger ' + 'x'.repeat(60)
    expect(validateSkillForm(raw, 'a valid description')).toBe('aiSkErrNameTooLong')
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

// P3b final review C1 — slugify line-by-line ported from NimoOS-AI/service/skills_store.go:17-35,
// directly pinning the port result here, not just indirectly testing through validateSkillForm.
describe('slugify', () => {
  it('lowercases and leaves an already-valid slug unchanged', () => {
    expect(slugify('invoice-tagger')).toBe('invoice-tagger')
  })

  it('folds internal spaces into a single dash', () => {
    expect(slugify('Invoice Tagger')).toBe('invoice-tagger')
  })

  it('folds underscores into a single dash', () => {
    expect(slugify('invoice_tagger')).toBe('invoice-tagger')
  })

  it('uppercases fold to lowercase', () => {
    expect(slugify('INVOICE')).toBe('invoice')
  })

  it('collapses a run of consecutive separators into one dash, not one per separator', () => {
    expect(slugify('invoice   ___---tagger')).toBe('invoice-tagger')
  })

  it('drops a leading separator entirely (no dash is written before the first alnum char)', () => {
    expect(slugify('  -invoice-tagger')).toBe('invoice-tagger')
  })

  it('trims a trailing separator', () => {
    expect(slugify('invoice-tagger--  ')).toBe('invoice-tagger')
  })

  it('returns an empty string when no [a-z0-9] character survives (pure symbols)', () => {
    expect(slugify('!!!___---')).toBe('')
  })

  it('returns an empty string for pure Chinese input (no ASCII alnum to keep)', () => {
    expect(slugify('发票标签')).toBe('')
  })

  it('returns an empty string for an all-whitespace input', () => {
    expect(slugify('   ')).toBe('')
  })

  it('preserves digits and digit-leading input (backend comment: "123 skill" must not be rejected)', () => {
    expect(slugify('123 skill')).toBe('123-skill')
  })
})
