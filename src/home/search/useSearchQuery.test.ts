import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NormalizedAggregate } from '@nimotech/nimoos-service'

const agentTool = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({ service: { search: { agentTool: (...a: unknown[]) => agentTool(...a) } } }))

import { useSearchQuery } from './useSearchQuery'

function aggWith(names: string[], warnings: string[] = []): NormalizedAggregate {
  return {
    semantic: [], images: [], notes: [],
    filenames: names.map((n, i) => ({ path: '/DATA/Documents/' + n, name: n, ext: n.split('.').pop() ?? '', size: 1, mtimeMs: 1, isDir: false, match: 2 - i * 0.1 })),
    stats: { fileindexStatus: 'ready', totalCandidates: names.length }, warnings,
  }
}

beforeEach(() => { agentTool.mockReset() })

describe('useSearchQuery', () => {
  it('初始是 idle,view / degrade 都是 null', () => {
    const s = useSearchQuery()
    expect(s.state.value).toBe('idle')
    expect(s.view.value).toBeNull()
    expect(s.degrade.value).toBeNull()
  })

  it('空白查询词不发请求', async () => {
    const s = useSearchQuery()
    s.query.value = '   '
    await s.run()
    expect(agentTool).not.toHaveBeenCalled()
    expect(s.state.value).toBe('idle')
  })

  it('成功:searching → done,view 与 degrade 都填上,查询词已 trim', async () => {
    agentTool.mockResolvedValue(aggWith(['Receipt.pdf'], ['images_unavailable']))
    const s = useSearchQuery()
    s.query.value = '  receipt  '
    const p = s.run()
    expect(s.state.value).toBe('searching')
    await p
    expect(agentTool).toHaveBeenCalledWith('receipt')
    expect(s.state.value).toBe('done')
    expect(s.view.value?.total).toBe(1)
    expect(s.degrade.value?.unavailableSources).toEqual(['images'])
  })

  it('失败:state=error,errorDetail 取后端 message,view 不被写成空结果', async () => {
    agentTool.mockRejectedValue(new Error('ai service unreachable'))
    const s = useSearchQuery()
    s.query.value = 'receipt'
    await s.run()
    expect(s.state.value).toBe('error')
    expect(s.errorDetail.value).toBe('ai service unreachable')
    expect(s.view.value).toBeNull()   // 绝不静默显示空结果(spec §7.8)
  })

  it('过期守卫:先发的慢请求后回来,不许覆盖后发请求的结果', async () => {
    // 交错路径:run#1 挂起 → run#2 立刻完成 → run#1 才 resolve
    let resolveFirst: (v: NormalizedAggregate) => void = () => {}
    agentTool
      .mockImplementationOnce(() => new Promise<NormalizedAggregate>((r) => { resolveFirst = r }))
      .mockResolvedValueOnce(aggWith(['NEW.pdf']))

    const s = useSearchQuery()
    s.query.value = 'old'
    const first = s.run()
    s.query.value = 'new'
    await s.run()
    expect(s.view.value?.rows[0].name).toBe('NEW.pdf')

    resolveFirst(aggWith(['OLD.pdf']))
    await first
    expect(s.view.value?.rows[0].name).toBe('NEW.pdf')  // 仍是新的
    expect(s.state.value).toBe('done')
  })

  it('过期守卫:过期的失败请求不许把界面打成 error', async () => {
    let rejectFirst: (e: Error) => void = () => {}
    agentTool
      .mockImplementationOnce(() => new Promise((_, rj) => { rejectFirst = rj }))
      .mockResolvedValueOnce(aggWith(['NEW.pdf']))

    const s = useSearchQuery()
    s.query.value = 'old'
    const first = s.run()
    s.query.value = 'new'
    await s.run()

    rejectFirst(new Error('stale failure'))
    await first
    expect(s.state.value).toBe('done')
    expect(s.errorDetail.value).toBe('')
  })

  it('reset 清回 idle 并作废在途请求', async () => {
    let resolveIt: (v: NormalizedAggregate) => void = () => {}
    agentTool.mockImplementationOnce(() => new Promise<NormalizedAggregate>((r) => { resolveIt = r }))
    const s = useSearchQuery()
    s.query.value = 'receipt'
    const p = s.run()
    s.reset()
    expect(s.state.value).toBe('idle')
    resolveIt(aggWith(['LATE.pdf']))
    await p
    expect(s.view.value).toBeNull()   // 在途结果不许落地
    expect(s.state.value).toBe('idle')
  })
})
