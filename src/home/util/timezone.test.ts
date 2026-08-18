import { describe, it, expect } from 'vitest'
import { utcOffsetLabel } from './timezone'

// A fixed instant, so a whole-hour zone and a DST zone can both be asserted.
const AUG = new Date('2026-08-18T04:00:00Z')
const JAN = new Date('2026-01-15T04:00:00Z')

describe('utcOffsetLabel', () => {
  it('drops the minutes for a whole-hour zone', () => {
    expect(utcOffsetLabel('Asia/Shanghai', AUG)).toBe('UTC+8')
  })
  it('keeps the minutes for a half- and quarter-hour zone', () => {
    expect(utcOffsetLabel('Asia/Kolkata', AUG)).toBe('UTC+5:30')
    expect(utcOffsetLabel('Asia/Kathmandu', AUG)).toBe('UTC+5:45')
  })
  it('renders UTC itself as UTC+0', () => {
    expect(utcOffsetLabel('UTC', AUG)).toBe('UTC+0')
  })
  it('follows daylight saving rather than a fixed table', () => {
    expect(utcOffsetLabel('America/New_York', AUG)).toBe('UTC-4')
    expect(utcOffsetLabel('America/New_York', JAN)).toBe('UTC-5')
  })
  // Intl throws RangeError on an unknown zone name. Returning null lets the caller
  // hide the badge; throwing would take the whole clock widget down with it.
  it('returns null instead of throwing for an unusable zone', () => {
    expect(utcOffsetLabel('Not/AZone', AUG)).toBeNull()
    expect(utcOffsetLabel('', AUG)).toBeNull()
  })
})
