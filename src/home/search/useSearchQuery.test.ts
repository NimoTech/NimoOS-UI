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
  it('initial state is idle, view / degrade are null', () => {
    const s = useSearchQuery()
    expect(s.state.value).toBe('idle')
    expect(s.view.value).toBeNull()
    expect(s.degrade.value).toBeNull()
  })

  it('blank query does not send request', async () => {
    const s = useSearchQuery()
    s.query.value = '   '
    await s.run()
    expect(agentTool).not.toHaveBeenCalled()
    expect(s.state.value).toBe('idle')
  })

  it('success: searching → done, view and degrade are filled, query is trimmed', async () => {
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

  it('failure: state=error, errorDetail from backend message, view is not set to empty result', async () => {
    agentTool.mockRejectedValue(new Error('ai service unreachable'))
    const s = useSearchQuery()
    s.query.value = 'receipt'
    await s.run()
    expect(s.state.value).toBe('error')
    expect(s.errorDetail.value).toBe('ai service unreachable')
    expect(s.view.value).toBeNull()   // must never silently display empty result (spec §7.8)
  })

  it('stale guard: slow request sent first must not overwrite result of later request', async () => {
    // interleaved path: run#1 suspended → run#2 immediately completes → run#1 finally resolves
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
    expect(s.view.value?.rows[0].name).toBe('NEW.pdf')  // still the new one
    expect(s.state.value).toBe('done')
  })

  it('stale guard: stale failed request must not set UI to error state', async () => {
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

  it('reset clears back to idle and invalidates in-flight requests', async () => {
    let resolveIt: (v: NormalizedAggregate) => void = () => {}
    agentTool.mockImplementationOnce(() => new Promise<NormalizedAggregate>((r) => { resolveIt = r }))
    const s = useSearchQuery()
    s.query.value = 'receipt'
    const p = s.run()
    s.reset()
    expect(s.state.value).toBe('idle')
    resolveIt(aggWith(['LATE.pdf']))
    await p
    expect(s.view.value).toBeNull()   // in-flight result must not be persisted
    expect(s.state.value).toBe('idle')
  })
})
