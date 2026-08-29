// 1:1 Ported from Vue2 src/views/AI/Agent/Agent.vue:221-239(toStoragePayload).
import { describe, it, expect } from 'vitest'
import { toStoragePayload } from './toStoragePayload'

describe('toStoragePayload(Agent.vue:221-239)', () => {
  it('Normal aggregation: sum size/used across multiple disks, convert to TB, breakdown has single segment with color as string var(--accent)', () => {
    const disks = [
      { size: 4e12, used: 2e12 },
      { size: 8e12, used: 3e12 },
    ]
    expect(toStoragePayload(disks)).toEqual({
      used: 5, // (2e12+3e12)/1e12
      total: 12, // (4e12+8e12)/1e12
      breakdown: [{ name: 'Used', value: 5, color: 'var(--accent)' }],
      label: 'NimoOS Storage',
    })
  })

  it('Disks missing size or used are excluded from aggregation (Vue2:227 `if (d.size && d.used)`)', () => {
    const disks = [
      { size: 4e12, used: 2e12 },
      { size: 8e12 }, // No used, skip
      { used: 1e12 }, // No size, skip
    ]
    expect(toStoragePayload(disks)).toEqual({
      used: 2,
      total: 4,
      breakdown: [{ name: 'Used', value: 2, color: 'var(--accent)' }],
      label: 'NimoOS Storage',
    })
  })

  it('Non-array → null (triggers "storage info unavailable" empty state)', () => {
    expect(toStoragePayload(null)).toBeNull()
    expect(toStoragePayload(undefined)).toBeNull()
    expect(toStoragePayload({})).toBeNull()
    expect(toStoragePayload('nope')).toBeNull()
  })

  it('Empty array → null', () => {
    expect(toStoragePayload([])).toBeNull()
  })

  it('Total is 0 (all disks missing fields, or size/used all 0) → null', () => {
    expect(toStoragePayload([{ size: 0, used: 0 }])).toBeNull()
    expect(toStoragePayload([{ foo: 'bar' }])).toBeNull()
  })

  // Code review F1 — disclosed deviation from Vue2 Agent.vue:227 (`if (d.size
  // && d.used)`, no `d &&` guard): Vue2 would throw reading `d.size` off a
  // null/undefined array element. New-UI's `d &&` guard skips such elements
  // instead of throwing — proving that here, not just claiming it in prose.
  it('Array with null/undefined elements → skip them, do not throw, aggregate only valid disks (intentional hardening of Vue2:227, see toStoragePayload.ts inline comment)', () => {
    const disks = [
      { size: 4e12, used: 2e12 },
      null,
      undefined,
      { size: 8e12, used: 3e12 },
    ]
    expect(() => toStoragePayload(disks)).not.toThrow()
    expect(toStoragePayload(disks)).toEqual({
      used: 5, // (2e12+3e12)/1e12 — null/undefined entries contribute nothing
      total: 12, // (4e12+8e12)/1e12
      breakdown: [{ name: 'Used', value: 5, color: 'var(--accent)' }],
      label: 'NimoOS Storage',
    })
  })
})
