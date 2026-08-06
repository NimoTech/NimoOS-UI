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
  // 验收补丁 A1：名称的失败原因分开报。slugify 之后字符集问题在结构上已不可能存在，
  // 所以「空 slug」与「过长」各有专用键，不再统一落回讲字符集的 aiSkErrBadId。
  it('rejects an empty name (no alphanumeric survives slugify)', () => {
    expect(validateSkillForm('', 'a valid description')).toBe('aiSkErrNameNoAlnum')
  })

  it('rejects a whitespace-only name (no alphanumeric survives slugify)', () => {
    expect(validateSkillForm('   ', 'a valid description')).toBe('aiSkErrNameNoAlnum')
  })

  it('accepts a single-character name ("a")', () => {
    expect(validateSkillForm('a', 'a valid description')).toBe(null)
  })

  // P3b 终审 C1 —— 这四条此前把 'aiSkErrBadId' 钉成了断言，但后端先 slugify(name) 再
  // 校验（skills_store.go:221），这四个原始名字全部会被 slugify 成合法 id
  // （"Invoice-Tagger"/"invoice_tagger" -> "invoice-tagger"，前后导 '-' 被
  // strings.Trim 去掉）——后端能建成功，Vue2（只查非空）也能建成功，本仓之前对着
  // "同款校验"的名义把它们堵死了，是可复现的功能回退，不是合法的校验结果。
  // 改前（错误，已删）：
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

  // 真·非法输入：slug 之后仍然/依然不满足 skillIDRe。
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

  // 验收补丁 A1 的回归钉子：用户实测就是这个场景——名字过长时，提示必须讲长度，
  // 绝不能是讲字符集的那条（两者都非 null，弱断言 not.toBeNull() 抓不出这个 bug）。
  it('a too-long name reports length, never the character-set message', () => {
    const key = validateSkillForm('a-very-long-invoice-tagger-name-'.repeat(5), 'a valid description')
    expect(key).toBe('aiSkErrNameTooLong')
    expect(key).not.toBe('aiSkErrBadId')
  })

  // 反过来钉一条：长到超标、但一个 [a-z0-9] 都没有的名字（纯中文长句），真实原因是
  // 「slug 为空」而不是「太长」——两条专用键不能互相盖过。
  it('a long name with no alphanumerics reports no-alnum, not too-long', () => {
    expect(validateSkillForm('这是一个非常长的技能名字'.repeat(10), 'a valid description'))
      .toBe('aiSkErrNameNoAlnum')
  })

  // 长度判定跑在 slug 上，不是原始输入上：原始 70 字符里含空格与大写，
  // slug 之后仍 > 64，故仍应判过长（而不是因为空格/大写被判字符集非法）。
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

// P3b 终审 C1 —— slugify 逐行移植自 NimoOS-AI/service/skills_store.go:17-35，
// 这里直接钉住移植结果，不只是通过 validateSkillForm 间接测。
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
