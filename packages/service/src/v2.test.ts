import { describe, it, expect } from 'vitest'
import { v2Data } from './v2'

describe('v2Data', () => {
  it('v2 bare envelope {message,data} with no success → takes data', () => {
    expect(v2Data<string[]>({ message: '', data: ['a'] })).toEqual(['a'])
  })
  it('standard envelope with success → follows unwrap semantics', () => {
    expect(v2Data<number>({ success: 200, data: 7 })).toBe(7)
    expect(() => v2Data({ success: 500, message: 'boom', data: null })).toThrow('boom')
  })
  it('a bare value (no data key) is returned as-is', () => {
    expect(v2Data<string[]>(['x'])).toEqual(['x'])
    expect(v2Data<null>(null)).toBeNull()
  })
})
