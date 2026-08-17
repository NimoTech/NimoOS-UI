import { describe, it, expect, vi } from 'vitest'
import { emptySnapshot, execute, fetchSnapshot, WIRED } from './folderPermissionsSnapshot'

describe('folderPermissionsSnapshot -- empty implementation for this iteration (debt D11)', () => {
  it('WIRED is false -- the UI uses this to show a "data source not yet wired" notice and disable write operations', () => {
    expect(WIRED).toBe(false)
  })

  it('emptySnapshot marks all four subsystems as offline', () => {
    expect(emptySnapshot().offline).toEqual({ search: true, knowledge: true, ai: true, photos: true })
  })

  it('emptySnapshot has empty lists everywhere, and photos is neither auto nor stale', () => {
    const s = emptySnapshot()
    expect(s.candidates).toEqual([])
    expect(s.searchRoots).toEqual([])
    expect(s.wikiRoots).toEqual([])
    expect(s.denyRules).toEqual([])
    expect(s.blacklist).toEqual([])
    expect(s.photos).toEqual({ auto: false, dirs: [], stale: false })
  })

  it('fetchSnapshot sends no network request at all', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    await fetchSnapshot()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('fetchSnapshot returns a fresh object every time (consumers cannot pollute each other)', async () => {
    const a = await fetchSnapshot()
    const b = await fetchSnapshot()
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })

  it('execute always refuses to run (write operations are not allowed this iteration)', async () => {
    await expect(execute([{ svc: 'search', op: 'putRoots', roots: ['/DATA'] }])).rejects.toThrow(/not wired/i)
  })

  it('execute rejects even an empty plan -- no loophole for "it was actually called but happened to do nothing"', async () => {
    await expect(execute([])).rejects.toThrow(/not wired/i)
  })
})
