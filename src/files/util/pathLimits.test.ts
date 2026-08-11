import { describe, it, expect } from 'vitest'
import { nameTooLong, pathTooLong, createBlocked } from './pathLimits'

describe('pathLimits(Linux NAME_MAX=255 / PATH_MAX=4096 字节,UTF-8)', () => {
  it('255 字节名可用,256 字节名过长', () => {
    expect(nameTooLong('a'.repeat(255))).toBe(false)
    expect(nameTooLong('a'.repeat(256))).toBe(true)
  })
  it('多字节按字节数算:86 个中文字 = 258 字节 → 过长', () => {
    expect(nameTooLong('文'.repeat(85))).toBe(false) // 255 字节
    expect(nameTooLong('文'.repeat(86))).toBe(true)  // 258 字节
  })
  it('全路径超 4095 字节 → 过长', () => {
    expect(pathTooLong('/' + 'a'.repeat(4094))).toBe(false)
    expect(pathTooLong('/' + 'a'.repeat(4095))).toBe(true)
  })
  it('createBlocked:名字先判,再判拼接后的全路径', () => {
    expect(createBlocked('/DATA', 'x'.repeat(256))).toBe('name')
    expect(createBlocked('/' + 'd'.repeat(4000), 'x'.repeat(100))).toBe('path')
    expect(createBlocked('/DATA', 'ok')).toBe(null)
  })
})
