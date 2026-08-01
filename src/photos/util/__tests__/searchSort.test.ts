import { describe, it, expect } from 'vitest'
import { sortResults, splitTiers, matchPct, searchStateMatchesQuery, type ScoredPhoto } from '../searchSort'
import type { Photo } from '../assetToPhoto'

// 最小 Photo 桩:只填 sortResults/splitTiers 实际读取的字段(id/takenAt/belowCut),
// 其余字段用 as 断言跳过(测试只关心排序/分流行为,不关心 Photo 的完整形状)。
function stubPhoto(id: string, takenAt: string | null, belowCut = false): Photo {
  return { id, takenAt, belowCut } as Photo
}

function row(id: string, score: number | null, takenAt: string | null, belowCut = false): ScoredPhoto {
  return { p: stubPhoto(id, takenAt, belowCut), score }
}

describe('sortResults', () => {
  it('relevance:按 score 降序,null 当 0', () => {
    const rows = [row('a', 0.2, null), row('b', 0.9, null), row('c', null, null)]
    const sorted = sortResults(rows, 'relevance')
    expect(sorted.map(r => r.p.id)).toEqual(['b', 'a', 'c'])
  })

  it('newest/oldest:takenAt 为 null 的项恒在末尾,两个方向各验一次', () => {
    const rows = [
      row('a', null, '2026-01-01'),
      row('b', null, null),
      row('c', null, '2026-03-01'),
    ]
    const newest = sortResults(rows, 'newest')
    expect(newest[newest.length - 1].p.id).toBe('b')
    const oldest = sortResults(rows, 'oldest')
    expect(oldest[oldest.length - 1].p.id).toBe('b')
  })

  it('takenAt 相同 → 按 id 稳定排序', () => {
    const rows = [row('b', null, '2026-01-01'), row('a', null, '2026-01-01')]
    const sorted = sortResults(rows, 'newest')
    expect(sorted.map(r => r.p.id)).toEqual(['a', 'b'])
  })

  it('newest 与 oldest 互为逆序(排除 null 项)', () => {
    const rows = [row('a', null, '2026-01-01'), row('b', null, '2026-03-01'), row('c', null, '2026-02-01')]
    const newest = sortResults(rows, 'newest').map(r => r.p.id)
    const oldest = sortResults(rows, 'oldest').map(r => r.p.id)
    expect(newest).toEqual([...oldest].reverse())
  })

  it('不原地改:返回新数组引用,传入数组顺序不变', () => {
    const rows = [row('b', 0.1, null), row('a', 0.9, null)]
    const original = [...rows]
    const sorted = sortResults(rows, 'relevance')
    expect(sorted).not.toBe(rows)
    expect(rows).toEqual(original)
  })
})

describe('splitTiers', () => {
  it("sort='newest' → more 为空、best 全量(非 relevance 排序不分流)", () => {
    const rows = [row('a', null, '2026-01-01', true), row('b', null, '2026-01-02', false)]
    const sorted = sortResults(rows, 'newest')
    const { best, more } = splitTiers(sorted, 'newest')
    expect(more).toEqual([])
    expect(best).toEqual(sorted)
  })

  it("sort='relevance' + 3 条中 1 条 belowCut → best 2 / more 1", () => {
    const rows = [row('a', 0.9, null, false), row('b', 0.8, null, true), row('c', 0.7, null, false)]
    const sorted = sortResults(rows, 'relevance')
    const { best, more } = splitTiers(sorted, 'relevance')
    expect(best.length).toBe(2)
    expect(more.length).toBe(1)
    expect(more[0].p.id).toBe('b')
  })
})

describe('matchPct', () => {
  it('null → null', () => {
    expect(matchPct(null)).toBeNull()
    expect(matchPct(undefined)).toBeNull()
  })

  it('越界值被夹到 [0,1] 再转百分比', () => {
    expect(matchPct(-0.5)).toBe(0)
    expect(matchPct(1.7)).toBe(100)
  })

  it('正常值四舍五入', () => {
    expect(matchPct(0.456)).toBe(46)
  })
})

describe('searchStateMatchesQuery', () => {
  it('isSearchMode: false → false', () => {
    expect(searchStateMatchesQuery({ isSearchMode: false, searchQuery: 'tokyo' }, 'tokyo')).toBe(false)
  })

  it('query 带首尾空格 → trim 后比较命中', () => {
    expect(searchStateMatchesQuery({ isSearchMode: true, searchQuery: 'tokyo' }, '  tokyo  ')).toBe(true)
  })

  it('不同 query → false', () => {
    expect(searchStateMatchesQuery({ isSearchMode: true, searchQuery: 'tokyo' }, 'kyoto')).toBe(false)
  })
})
