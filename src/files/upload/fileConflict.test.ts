import { describe, it, expect, vi } from 'vitest'
import { fetchExistingNames, findConflicts, resolveConflictQueue } from './fileConflict'
import type { ConflictCandidate, ConflictChoice } from './fileConflict'

const cand = (name: string, isDir = false): ConflictCandidate => ({ name, isDir, groupKey: name })

describe('fetchExistingNames', () => {
  it('builds a name -> isDir map from a folder listing', async () => {
    const listFolder = vi.fn().mockResolvedValue({
      content: [
        { name: 'a.txt', is_dir: false },
        { name: 'Trip', is_dir: true },
      ],
    })
    const map = await fetchExistingNames('/DATA/Documents', listFolder)
    expect(listFolder).toHaveBeenCalledWith('/DATA/Documents')
    expect(map.get('a.txt')).toBe(false)
    expect(map.get('Trip')).toBe(true)
    expect(map.size).toBe(2)
  })

  it('returns an empty map when the listing has no content', async () => {
    expect((await fetchExistingNames('/DATA', vi.fn().mockResolvedValue(null))).size).toBe(0)
    expect((await fetchExistingNames('/DATA', vi.fn().mockResolvedValue({}))).size).toBe(0)
  })

  it('keeps hidden entries — a dotfile still collides', async () => {
    const map = await fetchExistingNames('/DATA', vi.fn().mockResolvedValue({
      content: [{ name: '.env', is_dir: false }],
    }))
    expect(map.has('.env')).toBe(true)
  })
})

describe('findConflicts', () => {
  it('keeps only candidates whose name is already taken', () => {
    const existing = new Map([['a.txt', false], ['Trip', true]])
    const out = findConflicts([cand('a.txt'), cand('b.txt'), cand('Trip', true)], existing)
    expect(out.map((c) => c.name)).toEqual(['a.txt', 'Trip'])
  })

  it('tolerates a null candidate list', () => {
    expect(findConflicts(null as unknown as ConflictCandidate[], new Map())).toEqual([])
  })
})

describe('resolveConflictQueue', () => {
  it('asks once per conflict and records each action', async () => {
    const decide = vi.fn()
      .mockResolvedValueOnce({ action: 'overwrite' } as ConflictChoice)
      .mockResolvedValueOnce({ action: 'skip' } as ConflictChoice)
    const out = await resolveConflictQueue([cand('a'), cand('b')], decide)
    expect(decide).toHaveBeenCalledTimes(2)
    expect(out.map((r) => r.action)).toEqual(['overwrite', 'skip'])
  })

  it('passes the queue position to decide', async () => {
    const decide = vi.fn().mockResolvedValue({ action: 'skip' } as ConflictChoice)
    await resolveConflictQueue([cand('a'), cand('b'), cand('c')], decide)
    expect(decide.mock.calls.map((c) => c[1])).toEqual([
      { index: 0, total: 3 },
      { index: 1, total: 3 },
      { index: 2, total: 3 },
    ])
  })

  it('applyToAll stops asking and reuses the same action for the rest', async () => {
    const decide = vi.fn().mockResolvedValueOnce({ action: 'keep_both', applyToAll: true } as ConflictChoice)
    const out = await resolveConflictQueue([cand('a'), cand('b'), cand('c')], decide)
    expect(decide).toHaveBeenCalledTimes(1)
    expect(out.map((r) => r.action)).toEqual(['keep_both', 'keep_both', 'keep_both'])
  })

  it('a null choice cancels this conflict AND every remaining one', async () => {
    const decide = vi.fn()
      .mockResolvedValueOnce({ action: 'overwrite' } as ConflictChoice)
      .mockResolvedValueOnce(null)
    const out = await resolveConflictQueue([cand('a'), cand('b'), cand('c')], decide)
    expect(decide).toHaveBeenCalledTimes(2)
    expect(out.map((r) => r.action)).toEqual(['overwrite', 'cancelled', 'cancelled'])
  })

  it('returns an empty list for an empty queue without calling decide', async () => {
    const decide = vi.fn()
    expect(await resolveConflictQueue([], decide)).toEqual([])
    expect(decide).not.toHaveBeenCalled()
  })
})
