// SP8-P5d Task 3 —— 承接 Vue2 既有 `__tests__/noteEditHelpers.spec.js`(2 条,治理 §4.3),
// 且比蓝本 spec 更细(逐分支 + 早退路径)。
import { describe, it, expect } from 'vitest'
import { parseTags, conflictMessage } from './noteEditHelpers'

describe('parseTags', () => {
  // 蓝本 __tests__/noteEditHelpers.spec.js:5 —— 逗号 + 空白混合分隔,trim,去重。
  it('逗号与空白混合分隔、trim、去重 —— 蓝本 spec 原例', () => {
    expect(parseTags(' a, b ,a  c,')).toEqual(['a', 'b', 'c'])
  })

  it('空字符串 → []（蓝本 spec 原例）', () => {
    expect(parseTags('')).toEqual([])
  })

  it('null / undefined 都 → []（String(str || "") 的宽松兜底）', () => {
    expect(parseTags(null)).toEqual([])
    expect(parseTags(undefined)).toEqual([])
  })

  it('单个逗号分隔的简单情形，不去重', () => {
    expect(parseTags('foo,bar')).toEqual(['foo', 'bar'])
  })

  it('分隔符只有空白也生效（不是只认逗号）', () => {
    expect(parseTags('foo bar   baz')).toEqual(['foo', 'bar', 'baz'])
  })

  it('去重发生在 trim 之后（"a" 与 " a " 视为同一个标签）', () => {
    expect(parseTags('a, a ,  a')).toEqual(['a'])
  })
})

describe('conflictMessage', () => {
  // 蓝本 __tests__/noteEditHelpers.spec.js:11 —— 409 时串里含 revision 数字。
  it('409 → 返回串包含 revision 数字（蓝本 spec 原例：current_revision=4）', () => {
    const msg = conflictMessage({ response: { status: 409, data: { current_revision: 4 } } })
    expect(msg).toContain('4')
  })

  // N23：串本身不进 i18n，但内容不许简化成 `return true` —— 用另一个 revision 值
  // 交叉验证返回的确实是"含该 revision 的完整串"，不是恰好命中 toContain('4') 的巧合。
  it('409 → 完整串逐字匹配（不是 return true 的简化实现）', () => {
    const msg = conflictMessage({ response: { status: 409, data: { current_revision: 7 } } })
    expect(msg).toBe('Note changed elsewhere (now revision 7) — reload and retry')
  })

  it('非 409 状态码 → null（蓝本 spec 原例：500）', () => {
    expect(conflictMessage({ response: { status: 500 } })).toBe(null)
  })

  it('没有 response（不是 axios 错误）→ null（蓝本 spec 原例：{}）', () => {
    expect(conflictMessage({})).toBe(null)
  })

  it('err 本身是 null / undefined → null（早退路径，蓝本 spec 未覆盖，本仓补全）', () => {
    expect(conflictMessage(null)).toBe(null)
    expect(conflictMessage(undefined)).toBe(null)
  })

  it('409 但 data 缺失 current_revision → 串里出现 "undefined"（Vue2 现状，照抄不改；仍 truthy）', () => {
    const msg = conflictMessage({ response: { status: 409, data: {} } })
    expect(msg).toBe('Note changed elsewhere (now revision undefined) — reload and retry')
  })
})
