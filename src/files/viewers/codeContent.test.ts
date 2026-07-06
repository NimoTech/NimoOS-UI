import { describe, it, expect } from 'vitest'
import { coerceContent } from './codeContent'

describe('coerceContent', () => {
  it('对象 → 缩进 JSON(复刻 Vue2)', () => {
    expect(coerceContent({ a: 1 })).toBe(JSON.stringify({ a: 1 }, null, 2))
  })
  it('字符串原样', () => {
    expect(coerceContent('hello')).toBe('hello')
  })
  it('数字 → String', () => {
    expect(coerceContent(42)).toBe('42')
  })
  it('null → "null"', () => {
    expect(coerceContent(null)).toBe('null')
  })
})
