import { describe, it, expect } from 'vitest'
import { raidFallbackSpaceFrom } from './raidSpaceFallback'

describe('raidFallbackSpaceFrom', () => {
  it('maps a RAID status onto the sidebar space shape', () => {
    expect(raidFallbackSpaceFrom({ total_bytes: 1000, used_bytes: 400, free_bytes: 600 })).toEqual({
      used: 400,
      total: 1000,
      avail: 600,
    })
  })

  it('returns null when total_bytes is missing, zero or negative', () => {
    expect(raidFallbackSpaceFrom({ used_bytes: 400 })).toBeNull()
    expect(raidFallbackSpaceFrom({ total_bytes: 0, used_bytes: 0, free_bytes: 0 })).toBeNull()
    expect(raidFallbackSpaceFrom({ total_bytes: -1 })).toBeNull()
  })

  it('returns null for a missing status rather than inventing a 0/0 array', () => {
    expect(raidFallbackSpaceFrom(null)).toBeNull()
    expect(raidFallbackSpaceFrom(undefined)).toBeNull()
  })

  it('defaults the two optional byte counts to 0 when total is known', () => {
    expect(raidFallbackSpaceFrom({ total_bytes: 1000 })).toEqual({ used: 0, total: 1000, avail: 0 })
  })
})
