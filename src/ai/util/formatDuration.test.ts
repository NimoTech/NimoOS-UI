// 1:1 Ported from Vue2 src/views/AI/Agent/tabs/ActivityTab.vue:47-52(formatDuration).
import { describe, it, expect } from 'vitest'
import { formatDuration } from './formatDuration'

describe('formatDuration', () => {
  it('< 1000ms → integer milliseconds + "ms"', () => {
    expect(formatDuration(500)).toBe('500ms')
    expect(formatDuration(999)).toBe('999ms')
  })

  it('0ms is valid (not "done" branch) → Math.max(1,...) fallback to "1ms"', () => {
    // Vue2 condition is `!ms && ms !== 0` — when ms===0, !ms is true but ms!==0 is false,
    // overall is false, so falls to numeric formatting branch not "done".
    expect(formatDuration(0)).toBe('1ms')
  })

  it('>= 1000ms and < 10s → one decimal place + "s"', () => {
    expect(formatDuration(1000)).toBe('1.0s')
    expect(formatDuration(4500)).toBe('4.5s')
    expect(formatDuration(9499)).toBe('9.5s')
  })

  it('>= 10s → rounded integer seconds + "s"', () => {
    expect(formatDuration(15000)).toBe('15s')
    expect(formatDuration(59999)).toBe('60s')
  })

  it('falsy and not 0 (null/undefined) → return null, caller renders as "done" (aiActivityDone)', () => {
    expect(formatDuration(null)).toBeNull()
    expect(formatDuration(undefined)).toBeNull()
  })
})
