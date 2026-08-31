import { describe, it, expect } from 'vitest'
import { assetToPhoto, groupToMonth } from '../assetToPhoto'

describe('assetToPhoto', () => {
  it('detects isVideo from mimeType prefix', () => {
    expect(assetToPhoto({ id: '1', mimeType: 'video/mp4' }).isVideo).toBe(true)
    expect(assetToPhoto({ id: '1', mimeType: 'image/jpeg' }).isVideo).toBe(false)
    expect(assetToPhoto({ id: '1' }).isVideo).toBe(false)
  })

  it('formats duration as m:ss from durationMs, null when absent', () => {
    // 65000ms -> 65s -> 1:05
    expect(assetToPhoto({ id: '1', durationMs: 65000 }).duration).toBe('1:05')
    // 5000ms -> 5s -> 0:05
    expect(assetToPhoto({ id: '1', durationMs: 5000 }).duration).toBe('0:05')
    expect(assetToPhoto({ id: '1' }).duration).toBeNull()
    expect(assetToPhoto({ id: '1', durationMs: 0 }).duration).toBeNull()
    expect(assetToPhoto({ id: '1' }).durationMs).toBe(0)
    expect(assetToPhoto({ id: '1', durationMs: 65000 }).durationMs).toBe(65000)
  })

  it('fav is always false regardless of source asset', () => {
    expect(assetToPhoto({ id: '1' }).fav).toBe(false)
    // even if the raw asset carries a truthy fav field, output must still be false
    expect(assetToPhoto({ id: '1', fav: true }).fav).toBe(false)
  })

  it('maps livePhoto fields', () => {
    const withLive = assetToPhoto({ id: '1', livePhotoVideoId: 'vid-9' })
    expect(withLive.isLivePhoto).toBe(true)
    expect(withLive.livePhotoVideoId).toBe('vid-9')

    const withoutLive = assetToPhoto({ id: '1' })
    expect(withoutLive.isLivePhoto).toBe(false)
    expect(withoutLive.livePhotoVideoId).toBeNull()
  })

  it('boolean flags coerce to false by default and true when set', () => {
    const bare = assetToPhoto({ id: '1' })
    expect(bare.hasOcr).toBe(false)
    expect(bare.isNew).toBe(false)
    expect(bare.belowCut).toBe(false)

    const flagged = assetToPhoto({ id: '1', hasOcr: true, isNew: true, belowCut: true })
    expect(flagged.hasOcr).toBe(true)
    expect(flagged.isNew).toBe(true)
    expect(flagged.belowCut).toBe(true)
  })

  it('derives title from originalName stripped of extension, falls back to id', () => {
    expect(assetToPhoto({ id: 'abc123', originalName: 'sunset.jpeg' }).title).toBe('sunset')
    expect(assetToPhoto({ id: 'abc123' }).title).toBe('abc123')
  })

  it('builds dim only when both width and height present', () => {
    expect(assetToPhoto({ id: '1', width: 1920, height: 1080 }).dim).toBe('1920 × 1080')
    expect(assetToPhoto({ id: '1', width: 1920 }).dim).toBeNull()
    expect(assetToPhoto({ id: '1' }).width).toBeNull()
  })

  it('formats coords from latitude/longitude to 6 decimals, falls back to place lookup', () => {
    const p = assetToPhoto({ id: '1', latitude: 39.9042, longitude: 116.4074 })
    expect(p.coords).toBe('39.904200, 116.407400')
    expect(assetToPhoto({ id: '1' }).coords).toBeNull()
  })

  it('treats lat=0/lon=0 (both falsy) as absent coords, matching Vue2 truthiness check', () => {
    // Vue2 source: `(asset.latitude != null && asset.longitude != null && (asset.latitude || asset.longitude))`
    // — null-checks pass but 0 || 0 is falsy, so (0,0) still yields null coords.
    expect(assetToPhoto({ id: '1', latitude: 0, longitude: 0 }).coords).toBeNull()
  })

  it('joins camera make/model with middle dot, null when both absent', () => {
    expect(assetToPhoto({ id: '1', make: 'Apple', model: 'iPhone 15' }).camera).toBe('Apple · iPhone 15')
    expect(assetToPhoto({ id: '1', make: 'Apple' }).camera).toBe('Apple')
    expect(assetToPhoto({ id: '1' }).camera).toBeNull()
  })

  it('only preserves matchScore when it is a number', () => {
    expect(assetToPhoto({ id: '1', matchScore: 0.87 }).matchScore).toBe(0.87)
    expect(assetToPhoto({ id: '1', matchScore: '0.87' }).matchScore).toBeNull()
    expect(assetToPhoto({ id: '1' }).matchScore).toBeNull()
  })

  // Regression (structural spec item 7): matchedBy missing field → null; field present → passed through as-is.
  // grep already confirmed the four fields matchScore/matchedBy/belowCut/isNew all exist in this file
  // (added in P0 or an earlier task); this task doesn't change the implementation, it only adds this previously missing assertion.
  it('matchedBy: null when field is absent, passed through as-is when present', () => {
    expect(assetToPhoto({ id: '1' }).matchedBy).toBeNull()
    expect(assetToPhoto({ id: '1', matchedBy: 'semantic' }).matchedBy).toBe('semantic')
    expect(assetToPhoto({ id: '1', matchedBy: 'ocr' }).matchedBy).toBe('ocr')
  })

  it('defaults faces to empty array unless an array is provided', () => {
    expect(assetToPhoto({ id: '1' }).faces).toEqual([])
    expect(assetToPhoto({ id: '1', faces: ['f1'] }).faces).toEqual(['f1'])
    expect(assetToPhoto({ id: '1', faces: 'not-an-array' }).faces).toEqual([])
  })
})

describe('groupToMonth', () => {
  it('maps month===0 to the unknown-date bucket', () => {
    const m = groupToMonth({ year: 2024, month: 0 })
    expect(m.key).toBe('unknown')
    expect(m.title).toBe('Unknown Date')
  })

  it('formats key as YYYY-MM with zero-padded month', () => {
    expect(groupToMonth({ year: 2024, month: 3 }).key).toBe('2024-03')
    expect(groupToMonth({ year: 2024, month: 11 }).key).toBe('2024-11')
    expect(groupToMonth({ year: 2024, month: 1 }).key).toBe('2024-01')
  })

  it('formats title as "<Month name> <year>"', () => {
    expect(groupToMonth({ year: 2024, month: 3 }).title).toBe('March 2024')
    expect(groupToMonth({ year: 2023, month: 12 }).title).toBe('December 2023')
  })

  it('maps assets through assetToPhoto, defaults to empty array when absent', () => {
    const m = groupToMonth({ year: 2024, month: 5, assets: [{ id: 'x' }] })
    expect(m.photos).toHaveLength(1)
    expect(m.photos[0].id).toBe('x')

    expect(groupToMonth({ year: 2024, month: 5 }).photos).toEqual([])
  })

  it('loc is always the empty string', () => {
    expect(groupToMonth({ year: 2024, month: 5 }).loc).toBe('')
  })

  // Legacy (non-bucket) timeline groups carry no directory metadata at all, but
  // tabCountOf's callers read ocrCount unconditionally once a Month has any
  // count fields — default it to 0 so a legacy Month never leaks `undefined`.
  it('defaults ocrCount to 0 (legacy path carries no directory OCR counter)', () => {
    expect(groupToMonth({ year: 2024, month: 5 }).ocrCount).toBe(0)
  })
})
