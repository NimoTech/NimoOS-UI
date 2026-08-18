import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSnapshots } from './useSnapshots'
import type { KvmSnapshot } from '@nimotech/nimoos-service'

const api = {
  getSnapshots: vi.fn(), createSnapshot: vi.fn(), deleteSnapshot: vi.fn(), restoreSnapshot: vi.fn(),
}
vi.mock('@nimotech/nimoos-service', () => ({ service: { get kvm() { return api } } }))

// When creating non-empty list, fields follow backend NimoOS-KVM/model/snapshot.go (per brief), not hand-crafted.
const SNAP = (over: Partial<KvmSnapshot> = {}): KvmSnapshot => ({
  id: 'snap-1', vmId: 'vm-1', name: 'before-upgrade', description: 'backup before upgrade',
  state: 'complete', createdAt: '2026-08-03T10:00:00Z', ...over,
})

beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()) })

describe('useSnapshots', () => {
  // Real device 2026-08-03 curl data (per brief, not hand-crafted fixture): two-layer envelope,
  // shared package already unwrapped, receives [] here.
  it('successful fetch fills list (real device fixture: empty array)', async () => {
    api.getSnapshots.mockResolvedValue([])
    const s = useSnapshots()
    await s.fetch('vm-1')
    expect(api.getSnapshots).toHaveBeenCalledWith('vm-1')
    expect(s.snapshots.value).toEqual([])
  })

  it('successful fetch fills non-empty list', async () => {
    api.getSnapshots.mockResolvedValue([SNAP()])
    const s = useSnapshots()
    await s.fetch('vm-1')
    expect(s.snapshots.value).toEqual([SNAP()])
  })

  // Follow Vue2's fetchSnapshots (:1232-1234): on failure, only console.warn, keep old list —
  // here first use successful fetch to seed non-empty list, then make second fetch fail, assert
  // list wasn't cleared/replaced.
  it('fetch fails, keeps old list, only console.warn (intentionally copies Vue2)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    api.getSnapshots.mockResolvedValueOnce([SNAP()])
    const s = useSnapshots()
    await s.fetch('vm-1')
    expect(s.snapshots.value).toEqual([SNAP()])

    api.getSnapshots.mockRejectedValueOnce(new Error('network down'))
    await s.fetch('vm-1')
    expect(s.snapshots.value).toEqual([SNAP()]) // not cleared
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  // After create succeeds, fetch again itself (follow Vue2 :1251), not local splice.
  it('after create succeeds, fetch again itself and return ""', async () => {
    api.createSnapshot.mockResolvedValue(SNAP())
    api.getSnapshots.mockResolvedValue([SNAP({ id: 'snap-2', name: 'after-create' })])
    const s = useSnapshots()
    const err = await s.create('vm-1', 'before-upgrade', 'backup before upgrade')
    expect(err).toBe('')
    expect(api.createSnapshot).toHaveBeenCalledWith('vm-1', { name: 'before-upgrade', description: 'backup before upgrade' })
    expect(api.getSnapshots).toHaveBeenCalledWith('vm-1')
    // Assert list is result of "fetch again", not local splice — else this test appears to pass
    // even under bad implementation "local push, don't call getSnapshots" (create's SNAP() vs
    // fetch's SNAP({id:'snap-2',...}) intentionally use different id/name to distinguish).
    expect(s.snapshots.value).toEqual([SNAP({ id: 'snap-2', name: 'after-create' })])
  })

  it('create fails returns backend message', async () => {
    api.createSnapshot.mockRejectedValue(new Error('disk quota exceeded'))
    const s = useSnapshots()
    expect(await s.create('vm-1', 'x', '')).toBe('disk quota exceeded')
    expect(api.getSnapshots).not.toHaveBeenCalled() // on failure don't fetch again
  })

  // After remove succeeds, filter locally (follow Vue2 :1307), don't re-fetch.
  it('after remove succeeds, filter locally, don\'t re-fetch', async () => {
    api.getSnapshots.mockResolvedValue([SNAP({ id: 'snap-1' }), SNAP({ id: 'snap-2', name: 'other' })])
    const s = useSnapshots()
    await s.fetch('vm-1')
    expect(s.snapshots.value).toHaveLength(2)

    api.deleteSnapshot.mockResolvedValue(undefined)
    api.getSnapshots.mockClear()
    const err = await s.remove('vm-1', 'snap-1')
    expect(err).toBe('')
    expect(s.snapshots.value).toEqual([SNAP({ id: 'snap-2', name: 'other' })])
    expect(api.getSnapshots).not.toHaveBeenCalled() // don't re-fetch
  })

  it('remove fails returns backend message, list unchanged', async () => {
    api.getSnapshots.mockResolvedValue([SNAP()])
    const s = useSnapshots()
    await s.fetch('vm-1')
    api.deleteSnapshot.mockRejectedValue(new Error('snapshot is in use'))
    expect(await s.remove('vm-1', 'snap-1')).toBe('snapshot is in use')
    expect(s.snapshots.value).toEqual([SNAP()]) // on failure don't filter
  })

  it('restore succeeds returns ""', async () => {
    api.restoreSnapshot.mockResolvedValue(undefined)
    const s = useSnapshots()
    expect(await s.restore('vm-1', 'snap-1')).toBe('')
    expect(api.restoreSnapshot).toHaveBeenCalledWith('vm-1', 'snap-1')
  })

  it('restore fails returns backend message', async () => {
    api.restoreSnapshot.mockRejectedValue(new Error('VM must be stopped'))
    const s = useSnapshots()
    expect(await s.restore('vm-1', 'snap-1')).toBe('VM must be stopped')
  })

  // All three write methods on failure return backend message (merged into one, verify per-call that
  // fallback doesn't override real message).
  it('all three write methods on failure prioritize backend message over i18n fallback key', async () => {
    api.createSnapshot.mockRejectedValue(new Error('create boom'))
    api.deleteSnapshot.mockRejectedValue(new Error('delete boom'))
    api.restoreSnapshot.mockRejectedValue(new Error('restore boom'))
    const s = useSnapshots()
    expect(await s.create('vm-1', 'x', '')).toBe('create boom')
    expect(await s.remove('vm-1', 'snap-1')).toBe('delete boom')
    expect(await s.restore('vm-1', 'snap-1')).toBe('restore boom')
  })

  // After dispose, settled call doesn't write state (interleaving path). remove is the only
  // "write state on success" branch (fetch already covered specially), demo with remove: dispose
  // mid-request, then release success result, assert list not filtered (proves guard really blocks write).
  it('after dispose, remove settles (even if success) doesn\'t filter list locally (stale guard; interleaving)', async () => {
    api.getSnapshots.mockResolvedValue([SNAP({ id: 'snap-1' })])
    const s = useSnapshots()
    await s.fetch('vm-1')

    let release: (v: unknown) => void = () => {}
    api.deleteSnapshot.mockReturnValue(new Promise((r) => { release = r }))
    const p = s.remove('vm-1', 'snap-1')
    s.dispose() // component unmounts while request in flight
    release(undefined)
    expect(await p).toBe('') // guard short-circuits still returns '' (not error, just nowhere to consume result)
    expect(s.snapshots.value).toEqual([SNAP({ id: 'snap-1' })]) // not filtered out
  })

  it('after dispose, fetch settles also doesn\'t write list (stale guard; interleaving)', async () => {
    let release: (v: unknown) => void = () => {}
    api.getSnapshots.mockReturnValue(new Promise((r) => { release = r }))
    const s = useSnapshots()
    const p = s.fetch('vm-1')
    s.dispose()
    release([SNAP()])
    await p
    expect(s.snapshots.value).toEqual([]) // initial value, not written by late response
  })
})
