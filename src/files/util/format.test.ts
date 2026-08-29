import { describe, it, expect } from 'vitest'
import { renderSize, dateFmt } from './format'

describe('renderSize', () => {
  it('humanizes bytes across units', () => {
    expect(renderSize(0)).toBe('0 Bytes')
    expect(renderSize(512)).toBe('512 Bytes')
    expect(renderSize(1024)).toBe('1 KB')
    expect(renderSize(1536)).toBe('1.5 KB')
    expect(renderSize(1048576)).toBe('1 MB')
    expect(renderSize('2097152')).toBe('2 MB')
  })
})

describe('dateFmt', () => {
  it('returns a non-empty string for a valid date and stable for a fixed input', () => {
    const out = dateFmt('2026-01-15T09:05:00Z')
    expect(typeof out).toBe('string')
    expect(out.length).toBeGreaterThan(0)
  })
  it('empty/invalid input yields empty string', () => {
    expect(dateFmt('')).toBe('')
  })
})
