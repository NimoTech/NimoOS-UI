import { describe, it, expect } from 'vitest'
import { groupPhotosByMonth } from '../groupPhotosByMonth'
const P = (id: string, takenAt: string | null) => ({ id, takenAt, isVideo: false } as any)

describe('groupPhotosByMonth', () => {
  it('按月分组、组降序(新月在前)、组内保序', () => {
    const out = groupPhotosByMonth([
      P('a', '2026-03-10T00:00:00Z'),
      P('b', '2026-05-02T00:00:00Z'),
      P('c', '2026-05-20T00:00:00Z'),
    ])
    expect(out.map((m) => m.key)).toEqual(['2026-05', '2026-03'])
    expect(out[0].photos.map((p) => p.id)).toEqual(['b', 'c'])
    expect(out[0].title).toBe('May 2026')
  })
  it('缺/非法 takenAt 归 unknown 组并排最后', () => {
    const out = groupPhotosByMonth([P('x', null), P('y', '2026-01-01T00:00:00Z')])
    expect(out.map((m) => m.key)).toEqual(['2026-01', 'unknown'])
    expect(out[1].title).toBe('Unknown Date')
  })
  it('空列表返回空数组', () => {
    expect(groupPhotosByMonth([])).toEqual([])
  })
})
