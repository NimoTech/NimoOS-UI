// SP8-P2a Task 9 —— brief Step 1,逐字取自任务简报,未改写。
import { describe, it, expect } from 'vitest'
import { formatModelSize, formatEtaSeconds } from './formatModelSize'

describe('formatModelSize', () => {
  it('1 GB 及以上用 GB,一位小数', () => {
    expect(formatModelSize(1024 ** 3)).toBe('1.0 GB')
    expect(formatModelSize(4.7 * 1024 ** 3)).toBe('4.7 GB')
  })
  it('1 GB 以下用 MB,整数', () => {
    expect(formatModelSize(500 * 1024 ** 2)).toBe('500 MB')
  })
  it('恰好 1 GB 的边界走 GB 分支', () => {
    expect(formatModelSize(1024 ** 3)).toBe('1.0 GB')
    expect(formatModelSize(1024 ** 3 - 1)).toMatch(/MB$/)
  })
  it('0 / null / undefined 都是破折号(Vue2 :171 是真值判断,0 也落这里)', () => {
    expect(formatModelSize(0)).toBe('—')
    expect(formatModelSize(null)).toBe('—')
    expect(formatModelSize(undefined)).toBe('—')
  })
})

describe('formatEtaSeconds', () => {
  it('60 秒以下按秒', () => {
    expect(formatEtaSeconds(45)).toEqual({ unit: 'sec', n: 45 })
    expect(formatEtaSeconds(59.6)).toEqual({ unit: 'sec', n: 60 })
  })
  it('60 是分钟分支的下边界', () => {
    expect(formatEtaSeconds(60)).toEqual({ unit: 'min', n: 1 })
  })
  it('3600 是小时分支的下边界', () => {
    expect(formatEtaSeconds(3599)).toEqual({ unit: 'min', n: 60 })
    expect(formatEtaSeconds(3600)).toEqual({ unit: 'hr', n: 1 })
  })
  it('小时保留一位小数', () => {
    expect(formatEtaSeconds(5400)).toEqual({ unit: 'hr', n: 1.5 })
  })
})
