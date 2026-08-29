// Directly ported from Vue2 src/views/AI/Agent/stream/timelineMath.spec.js
import { describe, it, expect } from 'vitest'
import { tickWidth, clip, ticksFromMessages } from './timelineMath'

describe('tickWidth', () => {
  it('returns base width at zero distance plus full amplitude', () => {
    // distance 0 => base + amp
    expect(tickWidth(0, { base: 14, amp: 36, spread: 22 })).toBeCloseTo(50, 5)
  })
  it('decays toward base as distance grows', () => {
    const near = tickWidth(5, { base: 14, amp: 36, spread: 22 })
    const far = tickWidth(80, { base: 14, amp: 36, spread: 22 })
    expect(near).toBeGreaterThan(far)
    expect(far).toBeCloseTo(14, 1)
  })
  it('returns base when distance is null (idle)', () => {
    expect(tickWidth(null)).toBe(14)
  })
})

describe('clip', () => {
  it('keeps short strings', () => { expect(clip('abc', 15)).toBe('abc') })
  it('truncates with ellipsis', () => { expect(clip('0123456789abcdef', 15)).toBe('0123456789abcde…') })
  it('handles empty', () => { expect(clip('', 15)).toBe('') })
})

describe('ticksFromMessages', () => {
  it('maps role user→user, anything else→ai, and pulls text', () => {
    const out = ticksFromMessages([
      { id: 'a', role: 'user', content: 'hi' },
      { id: 'b', role: 'assistant', blocks: [{ type: 'md', text: 'hello there' }] },
    ])
    expect(out).toEqual([
      { role: 'user', id: 'a', text: 'hi' },
      { role: 'ai', id: 'b', text: 'hello there' },
    ])
  })
  it('returns [] for nullish', () => { expect(ticksFromMessages(null as unknown as never)).toEqual([]) })
})
