import { describe, it, expect } from 'vitest'
import { albumToView, formatAlbumSpan, sortAlbums, sortAlbumPhotos } from '../albumView'

describe('formatAlbumSpan', () => {
  it('同年同月 → "May 2026"', () => { expect(formatAlbumSpan('2026-05-02', '2026-05-20')).toBe('May 2026') })
  it('同年跨月 → "Jun - Dec 2025"', () => { expect(formatAlbumSpan('2025-06-03', '2025-12-31')).toBe('Jun - Dec 2025') })
  it('跨年 → "2023-2025"', () => { expect(formatAlbumSpan('2023-01-01', '2025-08-09')).toBe('2023-2025') })
  it('缺任一端或非法格式 → 空串', () => {
    expect(formatAlbumSpan(null, '2025-01-01')).toBe('')
    expect(formatAlbumSpan('2025-01-01', undefined)).toBe('')
    expect(formatAlbumSpan('bad', 'bad')).toBe('')
  })
  it('带时间的 RFC3339 也能解析(不依赖 Date)', () => {
    expect(formatAlbumSpan('2026-05-02T10:00:00Z', '2026-05-20T23:59:59Z')).toBe('May 2026')
  })
})

describe('albumToView', () => {
  it('映射后端字段(name/coverAssetId/assetCount/dateStart..dateEnd)', () => {
    const v = albumToView({ id: 7, name: '旅行', coverAssetId: 'a1', assetCount: 12, dateStart: '2025-06-01', dateEnd: '2025-06-30', createdAt: '2025-07-01T00:00:00Z' }, '未命名')
    expect(v).toMatchObject({ id: 7, title: '旅行', cover: 'a1', count: 12, dateRange: 'Jun 2025', createdAt: '2025-07-01T00:00:00Z', dateEnd: '2025-06-30' })
  })
  it('无 name 用 title 兜底,再无则用传入的 untitled', () => {
    expect(albumToView({ id: 1, title: 'T' }, '未命名').title).toBe('T')
    expect(albumToView({ id: 1 }, '未命名').title).toBe('未命名')
  })
  it('assetCount 缺失时回退 assets.length,再缺回 0', () => {
    expect(albumToView({ id: 1, assets: [{}, {}] }, 'x').count).toBe(2)
    expect(albumToView({ id: 1 }, 'x').count).toBe(0)
  })
  it('coverAssetId 缺失 → null', () => { expect(albumToView({ id: 1 }, 'x').cover).toBeNull() })
})

describe('sortAlbums', () => {
  const V = (id: string, title: string, count: number, createdAt: string | null, dateEnd: string | null) =>
    ({ id, title, count, createdAt, dateEnd, cover: null, dateRange: '' })
  const list = [V('a', 'Beta', 3, '2025-01-01', '2024-05-01'), V('b', 'Alpha', 9, '2026-01-01', '2026-09-01'), V('c', 'Gamma', 1, null, null)]

  it('name 正序 / name-r 逆序', () => {
    expect(sortAlbums(list, 'name').map((x) => x.title)).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(sortAlbums(list, 'name-r').map((x) => x.title)).toEqual(['Gamma', 'Beta', 'Alpha'])
  })
  it('count 降序', () => { expect(sortAlbums(list, 'count').map((x) => x.id)).toEqual(['b', 'a', 'c']) })
  it('created 按 createdAt 降序,缺失记 0 排最后', () => { expect(sortAlbums(list, 'created').map((x) => x.id)).toEqual(['b', 'a', 'c']) })
  it('date 按 dateEnd 降序(不是 createdAt),缺失排最后', () => { expect(sortAlbums(list, 'date').map((x) => x.id)).toEqual(['b', 'a', 'c']) })
  it('updated / 未知值 → 原序', () => {
    expect(sortAlbums(list, 'updated').map((x) => x.id)).toEqual(['a', 'b', 'c'])
    expect(sortAlbums(list, 'zzz').map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })
  it('不原地修改入参数组', () => {
    const src = [...list]
    sortAlbums(src, 'name')
    expect(src.map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('sortAlbumPhotos', () => {
  const P = (id: string, takenAt: string | null, indexedAt: string | null) => ({ id, takenAt, indexedAt } as never)
  const ps = [P('a', '2024-01-01', '2026-01-01'), P('b', '2026-01-01', '2024-01-01'), P('c', null, null)]
  it('taken 按 takenAt 降序', () => { expect(sortAlbumPhotos(ps, 'taken').map((p) => p.id)).toEqual(['b', 'a', 'c']) })
  it('added 按 indexedAt 降序', () => { expect(sortAlbumPhotos(ps, 'added').map((p) => p.id)).toEqual(['a', 'b', 'c']) })
  it('manual 原序', () => { expect(sortAlbumPhotos(ps, 'manual').map((p) => p.id)).toEqual(['a', 'b', 'c']) })
})
