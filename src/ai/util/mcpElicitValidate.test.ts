import { describe, it, expect } from 'vitest'
import { validateArrayFields } from './mcpElicitValidate'
import type { ElicitField } from '../types/mcpElicit'

// Field shape taken verbatim from the backend's _blank() in
// elicitation_schema.py:134-143, not hand-authored.
function multiEnum(over: Partial<ElicitField> = {}): ElicitField {
  return {
    key: 'tags', type: 'multi_enum', title: '标签', description: '',
    required: false, default: null, format: null,
    min_length: null, max_length: null, minimum: null, maximum: null,
    options: [{ value: 'a', title: 'A' }, { value: 'b', title: 'B' }],
    min_items: null, max_items: null,
    ...over,
  }
}

// Fake `t`: echoes the key plus its params as JSON, so assertions can check both
// which key was chosen and what was passed to it, without depending on real i18n copy.
const echo = (s: string, p?: Record<string, unknown>) => `${s}|${JSON.stringify(p ?? {})}`

describe('validateArrayFields', () => {
  it('all valid returns null', () => {
    expect(validateArrayFields([multiEnum()], { tags: ['a'] }, echo)).toBeNull()
  })

  it('required and nothing selected → returns aiMcpElicitErrRequired', () => {
    const r = validateArrayFields([multiEnum({ required: true })], { tags: [] }, echo)
    expect(r).toBe('aiMcpElicitErrRequired|{"label":"标签"}')
  })

  it('min_items independent of required: required=false selecting 0 items still violates', () => {
    const r = validateArrayFields([multiEnum({ required: false, min_items: 1 })], { tags: [] }, echo)
    expect(r).toBe('aiMcpElicitErrMinItems|{"label":"标签","n":1}')
  })

  it('max_items exceeded reports aiMcpElicitErrMaxItems', () => {
    const r = validateArrayFields([multiEnum({ max_items: 1 })], { tags: ['a', 'b'] }, echo)
    expect(r).toBe('aiMcpElicitErrMaxItems|{"label":"标签","n":1}')
  })

  it('non multi_enum fields are all skipped (even if value is invalid)', () => {
    const f: ElicitField = { key: 'name', type: 'string', required: true, min_items: 5 }
    expect(validateArrayFields([f], { name: '' }, echo)).toBeNull()
  })

  it('when title is missing use key as fallback', () => {
    const r = validateArrayFields([multiEnum({ title: undefined, required: true })], { tags: [] }, echo)
    expect(r).toBe('aiMcpElicitErrRequired|{"label":"tags"}')
  })

  it('empty or missing key fields/values don\'t crash', () => {
    expect(validateArrayFields(null, null, echo)).toBeNull()
    expect(validateArrayFields([multiEnum({ min_items: 1 })], {}, echo)).toBe('aiMcpElicitErrMinItems|{"label":"标签","n":1}')
  })

  it('when t is not passed returns the key name as-is (remain independently testable)', () => {
    const r = validateArrayFields([multiEnum({ required: true })], { tags: [] })
    expect(r).toBe('aiMcpElicitErrRequired')
  })
})
