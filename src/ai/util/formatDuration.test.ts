// 1:1 移植自 Vue2 src/views/AI/Agent/tabs/ActivityTab.vue:47-52(formatDuration)。
import { describe, it, expect } from 'vitest'
import { formatDuration } from './formatDuration'

describe('formatDuration', () => {
  it('< 1000ms → 整数毫秒 + "ms"', () => {
    expect(formatDuration(500)).toBe('500ms')
    expect(formatDuration(999)).toBe('999ms')
  })

  it('0ms 是合法值(非"完成"分支)→ Math.max(1,...) 兜底成 "1ms"', () => {
    // Vue2 判据是 `!ms && ms !== 0` —— ms===0 时 !ms 为 true 但 ms!==0 为 false,
    // 整体为 false,故落到数字格式化分支而非"完成"。
    expect(formatDuration(0)).toBe('1ms')
  })

  it('>= 1000ms 且 < 10s → 一位小数 + "s"', () => {
    expect(formatDuration(1000)).toBe('1.0s')
    expect(formatDuration(4500)).toBe('4.5s')
    expect(formatDuration(9499)).toBe('9.5s')
  })

  it('>= 10s → 四舍五入整数秒 + "s"', () => {
    expect(formatDuration(15000)).toBe('15s')
    expect(formatDuration(59999)).toBe('60s')
  })

  it('falsy 且非 0(null/undefined)→ 返回 null,由调用方渲染成"完成"(aiActivityDone)', () => {
    expect(formatDuration(null)).toBeNull()
    expect(formatDuration(undefined)).toBeNull()
  })
})
