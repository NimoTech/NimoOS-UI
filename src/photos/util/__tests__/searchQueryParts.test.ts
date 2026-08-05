import { describe, it, expect } from 'vitest'
import { queryParts } from '../searchQueryParts'

describe('queryParts', () => {
  it('空 query → 一段、hl:false', () => {
    expect(queryParts('', ['tokyo'])).toEqual([{ text: '', hl: false }])
  })

  it('keywords 空 → 一段、hl:false', () => {
    expect(queryParts('sunset in tokyo', [])).toEqual([{ text: 'sunset in tokyo', hl: false }])
  })

  it('keywords 含空串 → 不死循环,结果等价于过滤空串后的结果', { timeout: 1000 }, () => {
    const withBlank = queryParts('sunset in tokyo', ['', 'tokyo'])
    const filtered = queryParts('sunset in tokyo', ['tokyo'])
    expect(withBlank).toEqual(filtered)
  })

  it("queryParts('sunset in tokyo', ['tokyo']) → 共 2 段:'sunset in '(假)+ 'tokyo'(真)", () => {
    expect(queryParts('sunset in tokyo', ['tokyo'])).toEqual([
      { text: 'sunset in ', hl: false },
      { text: 'tokyo', hl: true },
    ])
  })

  it("多次出现:queryParts('a b a', ['a']) → 三段", () => {
    expect(queryParts('a b a', ['a'])).toEqual([
      { text: 'a', hl: true },
      { text: ' b ', hl: false },
      { text: 'a', hl: true },
    ])
  })

  it("正则元字符:keywords 含 'c++' 不抛错且能命中 'c++ code'", () => {
    expect(() => queryParts('c++ code', ['c++'])).not.toThrow()
    expect(queryParts('c++ code', ['c++'])).toEqual([
      { text: 'c++', hl: true },
      { text: ' code', hl: false },
    ])
  })

  it('大小写不敏感但保留原文大小写', () => {
    expect(queryParts('Tokyo', ['tokyo'])).toEqual([{ text: 'Tokyo', hl: true }])
  })
})
