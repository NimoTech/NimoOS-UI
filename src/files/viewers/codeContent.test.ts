import { describe, it, expect } from 'vitest'
import { coerceContent } from './codeContent'

describe('coerceContent', () => {
  it('Object → indented JSON (replicate Vue2)', () => {
    expect(coerceContent({ a: 1 })).toBe(JSON.stringify({ a: 1 }, null, 2))
  })
  it('String as-is', () => {
    expect(coerceContent('hello')).toBe('hello')
  })
  it('Number → String', () => {
    expect(coerceContent(42)).toBe('42')
  })
  it('null → "null"', () => {
    expect(coerceContent(null)).toBe('null')
  })
})
