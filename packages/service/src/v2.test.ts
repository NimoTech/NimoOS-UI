import { describe, it, expect } from 'vitest'
import { v2Data } from './v2'

describe('v2Data', () => {
  it('v2 裸信封 {message,data} 无 success → 取 data', () => {
    expect(v2Data<string[]>({ message: '', data: ['a'] })).toEqual(['a'])
  })
  it('带 success 的标准信封 → 走 unwrap 语义', () => {
    expect(v2Data<number>({ success: 200, data: 7 })).toBe(7)
    expect(() => v2Data({ success: 500, message: 'boom', data: null })).toThrow('boom')
  })
  it('裸值(无 data 键)原样返回', () => {
    expect(v2Data<string[]>(['x'])).toEqual(['x'])
    expect(v2Data<null>(null)).toBeNull()
  })
})
