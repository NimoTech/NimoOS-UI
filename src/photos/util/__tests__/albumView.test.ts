import { describe, it, expect } from 'vitest'
import { albumToView, formatAlbumSpan, sortAlbumPhotos } from '../albumView'

describe('formatAlbumSpan', () => {
  it('same year, same month → "May 2026"', () => { expect(formatAlbumSpan('2026-05-02', '2026-05-20')).toBe('May 2026') })
  it('same year, across months → "Jun - Dec 2025"', () => { expect(formatAlbumSpan('2025-06-03', '2025-12-31')).toBe('Jun - Dec 2025') })
  it('across years → "2023-2025"', () => { expect(formatAlbumSpan('2023-01-01', '2025-08-09')).toBe('2023-2025') })
  it('missing either end or invalid format → empty string', () => {
    expect(formatAlbumSpan(null, '2025-01-01')).toBe('')
    expect(formatAlbumSpan('2025-01-01', undefined)).toBe('')
    expect(formatAlbumSpan('bad', 'bad')).toBe('')
  })
  it('RFC3339 with a time component also parses (does not rely on Date)', () => {
    expect(formatAlbumSpan('2026-05-02T10:00:00Z', '2026-05-20T23:59:59Z')).toBe('May 2026')
  })
})

describe('albumToView', () => {
  it('maps backend fields (name/coverAssetId/assetCount/dateStart..dateEnd)', () => {
    const v = albumToView({ id: 7, name: '旅行', coverAssetId: 'a1', assetCount: 12, dateStart: '2025-06-01', dateEnd: '2025-06-30', createdAt: '2025-07-01T00:00:00Z' }, '未命名')
    expect(v).toMatchObject({ id: 7, title: '旅行', cover: 'a1', count: 12, dateRange: 'Jun 2025', createdAt: '2025-07-01T00:00:00Z', dateStart: '2025-06-01' })
  })
  it('falls back to title when name is absent, then to the passed-in untitled default', () => {
    expect(albumToView({ id: 1, title: 'T' }, '未命名').title).toBe('T')
    expect(albumToView({ id: 1 }, '未命名').title).toBe('未命名')
  })
  it('falls back to assets.length when assetCount is missing, then to 0', () => {
    expect(albumToView({ id: 1, assets: [{}, {}] }, 'x').count).toBe(2)
    expect(albumToView({ id: 1 }, 'x').count).toBe(0)
  })
  it('coverAssetId missing → null', () => { expect(albumToView({ id: 1 }, 'x').cover).toBeNull() })

  it('carries videoCount and dateStart through for the detail sidebar and the global sort', () => {
    const v = albumToView({ id: 1, videoCount: 3, dateStart: '2025-06-01' }, 'x')
    expect(v.videoCount).toBe(3)
    expect(v.dateStart).toBe('2025-06-01')
  })
  it('defaults videoCount to 0 and dateStart to null when absent', () => {
    // videoCount is not omitempty on the wire (NimoOS-Photos service/types.go:179), so
    // the fallback only covers a partial fixture, not a real response.
    const v = albumToView({ id: 1 }, 'x')
    expect(v.videoCount).toBe(0)
    expect(v.dateStart).toBeNull()
  })
})

describe('sortAlbumPhotos', () => {
  const P = (id: string, takenAt: string | null, indexedAt: string | null) => ({ id, takenAt, indexedAt } as never)
  const ps = [P('a', '2024-01-01', '2026-01-01'), P('b', '2026-01-01', '2024-01-01'), P('c', null, null)]
  it('taken sorts by takenAt descending', () => { expect(sortAlbumPhotos(ps, 'taken').map((p) => p.id)).toEqual(['b', 'a', 'c']) })
  it('added sorts by indexedAt descending', () => { expect(sortAlbumPhotos(ps, 'added').map((p) => p.id)).toEqual(['a', 'b', 'c']) })
  it('manual keeps original order', () => { expect(sortAlbumPhotos(ps, 'manual').map((p) => p.id)).toEqual(['a', 'b', 'c']) })
})
