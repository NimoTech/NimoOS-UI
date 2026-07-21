import { describe, it, expect } from 'vitest'
import zh from './zh_cn'
import en from './en_us'

describe('i18n locale parity', () => {
  it('en_us 与 zh_cn 顶层 key 集合完全一致', () => {
    const zhKeys = Object.keys(zh).sort()
    const enKeys = Object.keys(en).sort()
    expect(enKeys).toEqual(zhKeys)
  })

  it('en_us 值均为非空字符串', () => {
    for (const [k, v] of Object.entries(en)) {
      expect(typeof v, `key ${k}`).toBe('string')
      expect((v as string).length, `key ${k}`).toBeGreaterThan(0)
    }
  })

  it('抽查若干英文文案', () => {
    expect(en.cpu).toBe('CPU')
    expect(en.memory).toBe('Memory')
    expect(en.filesTitle).toBe('Files')
  })
})
