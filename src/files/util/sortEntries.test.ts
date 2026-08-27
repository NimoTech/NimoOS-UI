import { describe, it, expect } from 'vitest'
import { sortEntries } from './sortEntries'

describe('sortEntries', () => {
  const entries = [
    { name: 'b.txt', is_dir: false, size: 20, date: '2026-01-02' },
    { name: 'Zeta', is_dir: true },
    { name: 'a.txt', is_dir: false, size: 10, date: '2026-01-03' },
    { name: 'Alpha', is_dir: true },
  ]

  it('puts folders first, then sorts by name asc', () => {
    expect(sortEntries(entries, 'name', 'asc').map((e) => e.name)).toEqual(['Alpha', 'Zeta', 'a.txt', 'b.txt'])
  })

  it('sorts files by size desc, folders always still first', () => {
    const names = sortEntries(entries, 'size', 'desc').map((e) => e.name)
    expect(names.slice(0, 2).sort()).toEqual(['Alpha', 'Zeta'])
    expect(names.slice(2)).toEqual(['b.txt', 'a.txt'])
  })

  it('sorts by date', () => {
    const names = sortEntries(entries, 'date', 'asc').map((e) => e.name)
    expect(names.slice(2)).toEqual(['b.txt', 'a.txt'])
  })

  it('does not mutate the input array', () => {
    const copy = [...entries]
    sortEntries(entries, 'name', 'asc')
    expect(entries).toEqual(copy)
  })

  it('falls back to name for an unknown sort field', () => {
    expect(sortEntries(entries, 'bogus' as never, 'asc').map((e) => e.name)).toEqual(['Alpha', 'Zeta', 'a.txt', 'b.txt'])
  })
})
