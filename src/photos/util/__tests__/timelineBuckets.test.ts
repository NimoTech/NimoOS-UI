import { describe, it, expect } from 'vitest'
import { bucketKey, parseBucketKey, normalizeBuckets, bucketToMonth, staleBucketKeys, tabCountOf } from '../timelineBuckets'
import { groupToMonth, assetToPhoto } from '../assetToPhoto'

const B = (year: number, month: number, count = 1, videoCount = 0, ocrCount = 0) =>
  ({ year, month, count, videoCount, ocrCount })

describe('bucketKey / parseBucketKey', () => {
  it('matches groupToMonth byte for byte, including the unknown bucket', () => {
    expect(bucketKey(B(2026, 8))).toBe(groupToMonth({ year: 2026, month: 8 }).key)
    expect(bucketKey(B(2026, 8))).toBe('2026-08')
    expect(bucketKey(B(0, 0))).toBe(groupToMonth({ year: 0, month: 0 }).key)
    expect(bucketKey(B(0, 0))).toBe('unknown')
  })
  it('round-trips a month key', () => {
    expect(parseBucketKey('2026-08')).toEqual({ year: 2026, month: 8 })
  })
  it('parses the unknown key to a zero PAIR, never a half-zero key', () => {
    // The backend answers 400 when only one of year/month is zero.
    expect(parseBucketKey('unknown')).toEqual({ year: 0, month: 0 })
  })
  it('rejects junk keys instead of producing NaN', () => {
    expect(parseBucketKey('search')).toBeNull()
    expect(parseBucketKey('')).toBeNull()
    expect(parseBucketKey('2026-13')).toBeNull()
  })
})

describe('normalizeBuckets', () => {
  it('keeps backend order and coerces missing counts to 0', () => {
    const out = normalizeBuckets([{ year: 2026, month: 8, count: 3 }, { year: 2026, month: 7, count: 1, videoCount: 1 }])
    expect(out).toEqual([B(2026, 8, 3, 0), B(2026, 7, 1, 1)])
  })
  it('tolerates a null body and non-array junk', () => {
    expect(normalizeBuckets(null)).toEqual([])
    expect(normalizeBuckets({ buckets: [] })).toEqual([])
  })
  it('drops entries with no usable year/month', () => {
    expect(normalizeBuckets([{ count: 5 }, { year: 'x', month: 2, count: 1 }])).toEqual([])
  })
  // Deployment-order decoupling: the backend counterpart that adds `ocrCount`
  // may land after this frontend change ships, so a row from an un-upgraded
  // backend (field absent) or a malformed row (non-numeric) must default to 0
  // rather than throw, produce NaN, or leak `undefined` into BucketMeta.
  it('defaults ocrCount to 0 when the field is missing or non-numeric (backend not yet upgraded)', () => {
    expect(normalizeBuckets([{ year: 2026, month: 8, count: 5, videoCount: 0 }]))
      .toEqual([B(2026, 8, 5, 0, 0)])
    expect(normalizeBuckets([{ year: 2026, month: 8, count: 5, videoCount: 0, ocrCount: 'nope' }]))
      .toEqual([B(2026, 8, 5, 0, 0)])
  })
  it('keeps a real ocrCount from an upgraded backend', () => {
    expect(normalizeBuckets([{ year: 2026, month: 8, count: 5, videoCount: 0, ocrCount: 5 }]))
      .toEqual([B(2026, 8, 5, 0, 5)])
  })
})

describe('tabCountOf', () => {
  // The core regression case (2026-08 ghost month, real production data shape):
  // a month whose 5 assets are all documents. matchesTab's default photo tab
  // excludes both video AND OCR assets, so the honest expectation is 0 — before
  // this fix the estimate was `count - videoCount` = 5, which rendered a month
  // section that always showed 0 real items once loaded.
  it('estimates 0 for the default photo tab when every asset is OCR/document (ghost month)', () => {
    expect(tabCountOf({ count: 5, videoCount: 0, ocrCount: 5 }, 'photo')).toBe(0)
  })
  it('subtracts both video and ocr from count for the default photo tab', () => {
    expect(tabCountOf({ count: 10, videoCount: 2, ocrCount: 3 }, 'photo')).toBe(5)
  })
  it('never returns a negative estimate when video+ocr exceed count', () => {
    expect(tabCountOf({ count: 3, videoCount: 2, ocrCount: 3 }, 'photo')).toBe(0)
  })
  it('reads straight off the matching counter for all/video/ocr', () => {
    const m = { count: 10, videoCount: 2, ocrCount: 3 }
    expect(tabCountOf(m, 'all')).toBe(10)
    expect(tabCountOf(m, 'video')).toBe(2)
    expect(tabCountOf(m, 'ocr')).toBe(3)
  })
})

describe('bucketToMonth', () => {
  it('marks a bucket with no photos as not loaded and carries the counts', () => {
    const m = bucketToMonth(B(2026, 8, 12, 3, 5), null)
    expect(m).toMatchObject({
      key: '2026-08', title: 'August 2026', loc: '', photos: [], loaded: false,
      count: 12, videoCount: 3, ocrCount: 5,
    })
  })
  it('marks an empty-but-fetched bucket as loaded', () => {
    // A bucket whose assets came back as [] is loaded, not pending — otherwise
    // the grid would keep requesting it forever.
    expect(bucketToMonth(B(2026, 8, 0, 0), []).loaded).toBe(true)
  })
  it('passes photos through untouched', () => {
    const p = assetToPhoto({ id: 'a1', mimeType: 'image/jpeg' })
    expect(bucketToMonth(B(2026, 8, 1, 0), [p]).photos).toEqual([p])
  })
})

describe('staleBucketKeys', () => {
  it('invalidates a loaded bucket whose count changed', () => {
    expect(staleBucketKeys([B(2026, 8, 3)], [B(2026, 8, 4)], ['2026-08'])).toEqual(['2026-08'])
  })
  it('invalidates a loaded bucket that vanished', () => {
    expect(staleBucketKeys([B(2026, 8, 3)], [], ['2026-08'])).toEqual(['2026-08'])
  })
  it('leaves an unchanged bucket alone so the grid never flashes', () => {
    expect(staleBucketKeys([B(2026, 8, 3)], [B(2026, 8, 3)], ['2026-08'])).toEqual([])
  })
  it('invalidates on a videoCount-only change (the photo tab estimates from it)', () => {
    expect(staleBucketKeys([B(2026, 8, 3, 0)], [B(2026, 8, 3, 1)], ['2026-08'])).toEqual(['2026-08'])
  })
  it('ignores buckets that were never loaded', () => {
    expect(staleBucketKeys([B(2026, 8, 3)], [B(2026, 8, 9)], [])).toEqual([])
  })
})
