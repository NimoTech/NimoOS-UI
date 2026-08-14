import { describe, it, expect } from 'vitest'
import { nameTooLong, pathTooLong, createBlocked } from './pathLimits'

describe('pathLimits (Linux NAME_MAX=255 / PATH_MAX=4096 bytes, UTF-8)', () => {
  it('255-byte name OK, 256-byte name too long', () => {
    expect(nameTooLong('a'.repeat(255))).toBe(false)
    expect(nameTooLong('a'.repeat(256))).toBe(true)
  })
  it('Multi-byte counted by bytes: 86 Chinese characters = 258 bytes → too long', () => {
    expect(nameTooLong('文'.repeat(85))).toBe(false) // 255 bytes
    expect(nameTooLong('文'.repeat(86))).toBe(true)  // 258 bytes
  })
  it('Full path exceeds 4095 bytes → too long', () => {
    expect(pathTooLong('/' + 'a'.repeat(4094))).toBe(false)
    expect(pathTooLong('/' + 'a'.repeat(4095))).toBe(true)
  })
  it('createBlocked: check name first, then check full path after concatenation', () => {
    expect(createBlocked('/DATA', 'x'.repeat(256))).toBe('name')
    expect(createBlocked('/' + 'd'.repeat(4000), 'x'.repeat(100))).toBe('path')
    expect(createBlocked('/DATA', 'ok')).toBe(null)
  })
})
