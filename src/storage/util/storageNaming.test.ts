import { describe, it, expect } from 'vitest'
import { DEFAULT_STORAGE_NAME, computeNextStorageName } from './storageNaming'

describe('computeNextStorageName', () => {
  it('returns base itself when there is no conflict', () => {
    expect(computeNextStorageName()).toBe('Main-storage')
    expect(computeNextStorageName('Main-storage', [])).toBe('Main-storage')
  })
  it('appends an incrementing suffix on conflict, taking the first free slot', () => {
    expect(computeNextStorageName('Main-storage', ['Main-storage'])).toBe('Main-storage1')
    expect(computeNextStorageName('Main-storage', ['Main-storage', 'Main-storage1'])).toBe('Main-storage2')
    // Takes the smallest number when there is a gap in the sequence
    expect(computeNextStorageName('Main-storage', ['Main-storage', 'Main-storage2'])).toBe('Main-storage1')
  })
  it('deduplicates case-insensitively', () => {
    expect(computeNextStorageName('Main-storage', ['MAIN-STORAGE'])).toBe('Main-storage1')
  })
  it('ignores empty-string entries', () => {
    expect(computeNextStorageName('Main-storage', ['', 'Main-storage'])).toBe('Main-storage1')
  })
  it('exports the default name constant', () => {
    expect(DEFAULT_STORAGE_NAME).toBe('Main-storage')
  })
})
