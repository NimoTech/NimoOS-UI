import { describe, it, expect } from 'vitest'
import { trashAssetToPhoto } from '../trashAssetToPhoto'

const NOW = new Date('2026-07-27T00:00:00Z')

describe('trashAssetToPhoto', () => {
  it('daysLeft = retention - days elapsed, floored at 0', () => {
    const a = { id: '1', mimeType: 'image/jpeg', deletedAt: '2026-07-20T00:00:00Z', originalPath: '/DATA/Gallery/2026/x.jpg', originalName: 'x.jpg', fileSize: 2 * 1024 * 1024 }
    const p = trashAssetToPhoto(a, 30, NOW)
    expect(p.daysLeft).toBe(23) // 30 - 7
    expect(p.isVideo).toBe(false)
    expect(p.from).toBe('2026')  // second-to-last segment of originalPath
    expect(p.sizeMb).toBe('2.0')
    expect(p.size).toBe(2 * 1024 * 1024)
    expect(p.title).toBe('x')    // extension stripped
  })
  it('daysLeft clamps to 0 once past due', () => {
    const a = { id: '2', deletedAt: '2026-01-01T00:00:00Z', fileSize: 0 }
    expect(trashAssetToPhoto(a, 30, NOW).daysLeft).toBe(0)
  })
  it('when deletedAt is absent, daysLeft = retention; from defaults to NAS; video detection', () => {
    const a = { id: '3', mimeType: 'video/mp4', originalName: 'clip.mp4', fileSize: 0 }
    const p = trashAssetToPhoto(a, 15, NOW)
    expect(p.daysLeft).toBe(15)
    expect(p.from).toBe('NAS')
    expect(p.isVideo).toBe(true)
    expect(p.deletedAt).toBe('')
  })
  it('title = id when originalName is absent', () => {
    expect(trashAssetToPhoto({ id: 'zid', fileSize: 0 }, 30, NOW).title).toBe('zid')
  })
})
