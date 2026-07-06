import { describe, it, expect } from 'vitest'
import { useValidation } from './useValidation'

describe('useValidation', () => {
  const { required, minLen, sameAs } = useValidation()
  it('required flags empty/whitespace', () => {
    expect(required('')).toBe('validateRequired')
    expect(required('   ')).toBe('validateRequired')
    expect(required('x')).toBeNull()
  })
  it('minLen(6) flags short', () => {
    expect(minLen(6)('12345')).toBe('validateMin6')
    expect(minLen(6)('123456')).toBeNull()
  })
  it('sameAs compares to other getter', () => {
    const check = sameAs(() => 'abc')
    expect(check('abd')).toBe('validateConfirm')
    expect(check('abc')).toBeNull()
  })
})
