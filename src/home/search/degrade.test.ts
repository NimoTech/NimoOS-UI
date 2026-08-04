import { describe, it, expect } from 'vitest'
import type { NormalizedAggregate } from '@nimotech/nimoos-service'
import { deriveDegrade } from './degrade'

function agg(warnings: string[]): NormalizedAggregate {
  return {
    semantic: [], filenames: [], images: [], notes: [],
    stats: { fileindexStatus: 'ready', totalCandidates: 0 }, warnings,
  }
}

describe('deriveDegrade', () => {
  it('真机常态:images_unavailable + 有结果 → 挂提示条,不显示空态', () => {
    expect(deriveDegrade(agg(['images_unavailable']), 2)).toEqual({
      unavailableSources: ['images'], unknownWarnings: [], empty: 'none',
    })
  })

  it('多个源不可用全部列出,顺序照 warnings', () => {
    const d = deriveDegrade(agg(['semantic_unavailable', 'images_unavailable']), 1)
    expect(d.unavailableSources).toEqual(['semantic', 'images'])
  })

  it('notes_unavailable 过滤掉 —— 本期根本不请求 notes 源,报它只会让人困惑', () => {
    const d = deriveDegrade(agg(['notes_unavailable', 'images_unavailable']), 1)
    expect(d.unavailableSources).toEqual(['images'])
    // notes_unavailable 必须彻底消失 —— 既不进 unavailableSources 也不进 unknownWarnings。
    // (若只断言 unavailableSources,删掉 notes 特判后它会静默漏进 unknownWarnings,
    //  这条用例照样绿——变异验证时实测过这个漏洞,所以补这一行。)
    expect(d.unknownWarnings).toEqual([])
  })

  it('no_accessible_roots → 空态 no_roots(与「没搜到」区分),且不算进不可用源', () => {
    const d = deriveDegrade(agg(['no_accessible_roots']), 0)
    expect(d.empty).toBe('no_roots')
    expect(d.unavailableSources).toEqual([])
    // no_accessible_roots 必须被这一分支的 continue 吃掉,不能落到 unknownWarnings。
    // (若删掉 noRoots=true 后面的 continue,它会越过 endsWith('_unavailable') 检查
    //  漏进 unknownWarnings,而 empty/unavailableSources 恰好不受影响——若不断言这里,
    //  10 例会照样全绿,变异验证时实测过这个漏洞,所以补这一行。)
    expect(d.unknownWarnings).toEqual([])
  })

  it('no_accessible_roots 优先于 backend_not_ready(即使同时有源不可用)', () => {
    const d = deriveDegrade(agg(['no_accessible_roots', 'images_unavailable']), 0)
    expect(d.empty).toBe('no_roots')
    expect(d.unknownWarnings).toEqual([])
  })

  it('零结果 + 有 warning → backend_not_ready(不是「没找到」)', () => {
    expect(deriveDegrade(agg(['semantic_unavailable']), 0).empty).toBe('backend_not_ready')
  })

  it('零结果 + 无 warning → no_match', () => {
    expect(deriveDegrade(agg([]), 0).empty).toBe('no_match')
  })

  it('有结果 + 无 warning → 什么都不提示', () => {
    expect(deriveDegrade(agg([]), 3)).toEqual({ unavailableSources: [], unknownWarnings: [], empty: 'none' })
  })

  it('认不出的 warning 原样透出,不静默丢弃', () => {
    const d = deriveDegrade(agg(['quota_exceeded', 'images_unavailable']), 1)
    expect(d.unknownWarnings).toEqual(['quota_exceeded'])
    expect(d.unavailableSources).toEqual(['images'])
  })

  it('零结果 + 只有认不出的 warning → 仍算 backend_not_ready', () => {
    expect(deriveDegrade(agg(['quota_exceeded']), 0).empty).toBe('backend_not_ready')
  })
})

