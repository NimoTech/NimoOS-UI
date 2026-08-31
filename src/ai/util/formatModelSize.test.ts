// Verbatim reference test values, not rewritten.
import { describe, it, expect } from 'vitest'
import { formatModelSize, formatEtaSeconds } from './formatModelSize'

describe('formatModelSize', () => {
  it('1 GB and above use GB, one decimal place', () => {
    expect(formatModelSize(1024 ** 3)).toBe('1.0 GB')
    expect(formatModelSize(4.7 * 1024 ** 3)).toBe('4.7 GB')
  })
  it('Below 1 GB use MB, integer', () => {
    expect(formatModelSize(500 * 1024 ** 2)).toBe('500 MB')
  })
  it('Exactly 1 GB boundary goes to GB branch', () => {
    expect(formatModelSize(1024 ** 3)).toBe('1.0 GB')
    expect(formatModelSize(1024 ** 3 - 1)).toMatch(/MB$/)
  })
  it('0 / null / undefined all return em dash (Vue2 :171 is truthy check, 0 falls here too)', () => {
    expect(formatModelSize(0)).toBe('—')
    expect(formatModelSize(null)).toBe('—')
    expect(formatModelSize(undefined)).toBe('—')
  })
})

describe('formatEtaSeconds', () => {
  it('Below 60 seconds count in seconds', () => {
    expect(formatEtaSeconds(45)).toEqual({ unit: 'sec', n: 45 })
    expect(formatEtaSeconds(59.6)).toEqual({ unit: 'sec', n: 60 })
  })
  it('60 is the lower boundary of minute branch', () => {
    expect(formatEtaSeconds(60)).toEqual({ unit: 'min', n: 1 })
  })
  it('3600 is the lower boundary of hour branch', () => {
    expect(formatEtaSeconds(3599)).toEqual({ unit: 'min', n: 60 })
    expect(formatEtaSeconds(3600)).toEqual({ unit: 'hr', n: 1 })
  })
  it('Hours keep one decimal place', () => {
    expect(formatEtaSeconds(5400)).toEqual({ unit: 'hr', n: 1.5 })
  })
})
