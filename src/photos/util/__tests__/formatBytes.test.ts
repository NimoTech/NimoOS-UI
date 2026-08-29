// SP7-P7a-T6: formatMB -- storage-size formatting for the Smart View detail page's stats row.
// Ported verbatim from the Vue 2 panel's src/views/Photos/PhotosSmartViewDetail.vue:424-428:
//   mb = bytes / 1048576; mb >= 1024 → (mb/1024).toFixed(1) + ' GB'; otherwise Math.round(mb) + ' MB'.
import { describe, it, expect } from 'vitest'
import { formatMB } from '../formatBytes'

describe('formatMB', () => {
  it('0 bytes → "0 MB"', () => {
    expect(formatMB(0)).toBe('0 MB')
  })

  it('1572864 bytes (1.5MB) → rounds to "2 MB"', () => {
    // 1572864 / 1048576 = 1.5 → Math.round(1.5) = 2
    expect(formatMB(1572864)).toBe('2 MB')
  })

  it('2147483648 bytes (2048MB=2GB) → the ">= 1024" branch gives "2.0 GB"', () => {
    // 2147483648 / 1048576 = 2048 → /1024 = 2 → toFixed(1) = '2.0'
    expect(formatMB(2147483648)).toBe('2.0 GB')
  })

  it('exactly 1024 MB (boundary) → takes the GB branch, not the MB branch', () => {
    expect(formatMB(1024 * 1048576)).toBe('1.0 GB')
  })

  it('treats undefined/missing input as 0', () => {
    expect(formatMB(undefined as unknown as number)).toBe('0 MB')
  })
})
