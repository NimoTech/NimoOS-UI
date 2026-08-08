import { describe, it, expect } from 'vitest'
import { validateArrayFields } from './mcpElicitValidate'
import type { ElicitField } from '../types/mcpElicit'

// 字段形状逐字取自后端 elicitation_schema.py:134-143 的 _blank(),不手编。
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

const echo = (s: string, p?: Record<string, unknown>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(p?.[k] ?? ''))

describe('validateArrayFields', () => {
  it('全合法时返回 null', () => {
    expect(validateArrayFields([multiEnum()], { tags: ['a'] }, echo)).toBeNull()
  })

  it('required 且一项没选 → 报 is required', () => {
    const r = validateArrayFields([multiEnum({ required: true })], { tags: [] }, echo)
    expect(r).toBe('标签: is required')
  })

  it('min_items 独立于 required:required=false 选 0 项照样违规', () => {
    const r = validateArrayFields([multiEnum({ required: false, min_items: 1 })], { tags: [] }, echo)
    expect(r).toBe('标签: pick at least 1')
  })

  it('max_items 超了报 pick at most', () => {
    const r = validateArrayFields([multiEnum({ max_items: 1 })], { tags: ['a', 'b'] }, echo)
    expect(r).toBe('标签: pick at most 1')
  })

  it('非 multi_enum 字段一律跳过(哪怕值不合法)', () => {
    const f: ElicitField = { key: 'name', type: 'string', required: true, min_items: 5 }
    expect(validateArrayFields([f], { name: '' }, echo)).toBeNull()
  })

  it('缺 title 时用 key 兜底', () => {
    const r = validateArrayFields([multiEnum({ title: undefined, required: true })], { tags: [] }, echo)
    expect(r).toBe('tags: is required')
  })

  it('fields/values 为空或缺键都不炸', () => {
    expect(validateArrayFields(null, null, echo)).toBeNull()
    expect(validateArrayFields([multiEnum({ min_items: 1 })], {}, echo)).toBe('标签: pick at least 1')
  })

  it('不传 t 时原样返回模板串(保持独立可测)', () => {
    const r = validateArrayFields([multiEnum({ required: true })], { tags: [] })
    expect(r).toBe('{label}: is required')
  })
})
