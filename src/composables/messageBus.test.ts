import { describe, it, expect } from 'vitest'
import { extractProps } from './useMessageBus'

describe('extractProps', () => {
  it('prefers capitalized Properties', () => {
    expect(extractProps({ Properties: { a: 1 } })).toEqual({ a: 1 })
  })
  it('falls back to lowercase properties', () => {
    expect(extractProps({ properties: { b: 2 } })).toEqual({ b: 2 })
  })
  it('returns the message itself when neither present', () => {
    expect(extractProps({ c: 3 })).toEqual({ c: 3 })
  })
})
