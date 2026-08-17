import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const listVolumes = vi.fn()
const listMock = vi.fn()
const getPolicy = vi.fn()
const patchPolicy = vi.fn()
const togglePolicy = vi.fn()
const createMock = vi.fn()
const removeMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    snapshot: {
      listVolumes: (...a: unknown[]) => listVolumes(...a),
      list: (...a: unknown[]) => listMock(...a),
      getPolicy: (...a: unknown[]) => getPolicy(...a),
      patchPolicy: (...a: unknown[]) => patchPolicy(...a),
      togglePolicy: (...a: unknown[]) => togglePolicy(...a),
      create: (...a: unknown[]) => createMock(...a),
      remove: (...a: unknown[]) => removeMock(...a),
    },
  },
}))
const toastShow = vi.fn()
vi.mock('../../stores/toast', () => ({ useToast: () => ({ show: toastShow }) }))
vi.mock('../../i18n', () => ({ i18n: { global: { t: (k: string) => k } } }))

import { useSnapshotStore } from './snapshot'

const VOL = { volume_uuid: 'u1', mount: '/DATA', supported: true, enabled: true, count: 2, last_at: '2026-07-27T01:00:00Z' }

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

describe('reset', () => {
  it('clears volume/policy/snapshots, forces both loading flags back to true (must-fix 1)', async () => {
    listVolumes.mockResolvedValue([VOL])
    getPolicy.mockResolvedValue({ hourly_keep: 1, daily_keep: 1, weekly_keep: 1, pause_threshold_pct: 1 })
    listMock.mockResolvedValue([{ name: 'a', created_at: '2026-07-27T00:00:00Z' }])
    const s = useSnapshotStore()
    await s.loadVolume('u1')
    await s.loadPolicy('u1')
    await s.loadSnapshots('u1')
    s.reset()
    expect(s.volume).toBeNull()
    expect(s.policy).toBeNull()
    expect(s.snapshots).toEqual([])
    expect(s.volumeLoading).toBe(true)
    expect(s.listLoading).toBe(true)
  })
})

describe('loadVolume', () => {
  it('bails out early on an empty uuid: no request sent, volume=null, volumeLoading released (ledger 7)', async () => {
    const s = useSnapshotStore()
    await s.loadVolume('')
    expect(listVolumes).not.toHaveBeenCalled()
    expect(s.volume).toBeNull()
    expect(s.volumeLoading).toBe(false)
  })
  it('stale-response guard: A\'s slow response must not overwrite B\'s already-landed data (must-fix 2)', async () => {
    let resolveA: (v: unknown) => void = () => {}
    listVolumes.mockImplementationOnce(() => new Promise((r) => { resolveA = r }))
    const s = useSnapshotStore()
    const pA = s.loadVolume('A') // slow request, sent first, not yet resolved
    listVolumes.mockResolvedValueOnce([{ volume_uuid: 'B', supported: true, enabled: true, count: 9 }])
    await s.loadVolume('B') // fast request, sent later but arrives first
    expect(s.volume?.volume_uuid).toBe('B')
    // A's response only arrives now, belatedly, with data clearly different from B's (to prove it wasn't written in)
    resolveA([{ volume_uuid: 'A', supported: true, enabled: false, count: 1 }])
    await pA
    expect(s.volume?.volume_uuid).toBe('B')
    expect(s.volume?.count).toBe(9)
    expect(s.volumeLoading).toBe(false)
  })
  it('matches this volume by volume_uuid, narrows it into a view object', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'other' }, VOL])
    const s = useSnapshotStore()
    await s.loadVolume('u1')
    expect(s.volume?.volume_uuid).toBe('u1')
    expect(s.volume?.count).toBe(2)
    expect(s.volumeLoading).toBe(false)
  })
  it('volume not found in the list → volume=null (panel falls into unsupported state)', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'other' }])
    const s = useSnapshotStore()
    await s.loadVolume('u1')
    expect(s.volume).toBeNull()
  })
  it('endpoint 404/throws → volume=null, loading released, only logs the message not the whole error', async () => {
    listVolumes.mockRejectedValue(Object.assign(new Error('boom'), { config: { data: 'secret' } }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSnapshotStore()
    await s.loadVolume('u1')
    expect(s.volume).toBeNull()
    expect(s.volumeLoading).toBe(false)
    expect(warn).toHaveBeenCalled()
    expect(JSON.stringify(warn.mock.calls)).not.toContain('config')
  })
})

describe('loadSnapshots', () => {
  it('fetches the list; a non-array response normalizes to an empty array', async () => {
    listMock.mockResolvedValue([{ name: 'a', created_at: '2026-07-27T00:00:00Z' }])
    const s = useSnapshotStore()
    await s.loadSnapshots('u1')
    expect(listMock).toHaveBeenCalledWith('u1')
    expect(s.snapshots).toHaveLength(1)
    listMock.mockResolvedValue(null)
    await s.loadSnapshots('u1')
    expect(s.snapshots).toEqual([])
    expect(s.listLoading).toBe(false)
  })
  it('throws → list cleared, loading released', async () => {
    listMock.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSnapshotStore()
    await s.loadSnapshots('u1')
    expect(s.snapshots).toEqual([])
    expect(s.listLoading).toBe(false)
  })
  it('stale-response guard: A\'s slow response must not overwrite B\'s already-landed list (must-fix 2)', async () => {
    let resolveA: (v: unknown) => void = () => {}
    listMock.mockImplementationOnce(() => new Promise((r) => { resolveA = r }))
    const s = useSnapshotStore()
    const pA = s.loadSnapshots('A')
    listMock.mockResolvedValueOnce([{ name: 'b-snap', created_at: '2026-07-27T00:00:00Z' }])
    await s.loadSnapshots('B')
    expect(s.snapshots.map((x) => x.name)).toEqual(['b-snap'])
    resolveA([{ name: 'a-snap', created_at: '2026-07-26T00:00:00Z' }])
    await pA
    expect(s.snapshots.map((x) => x.name)).toEqual(['b-snap'])
    expect(s.listLoading).toBe(false)
  })
})

describe('toggle', () => {
  it('success: calls togglePolicy(uuid, enabled), local enabled follows, success toast shown, single-flight', async () => {
    listVolumes.mockResolvedValue([VOL])
    togglePolicy.mockResolvedValue(undefined)
    const s = useSnapshotStore()
    await s.loadVolume('u1')
    await Promise.all([s.toggle('u1', false), s.toggle('u1', false)]) // the concurrent second call is swallowed by the guard
    expect(togglePolicy).toHaveBeenCalledTimes(1)
    expect(togglePolicy).toHaveBeenCalledWith('u1', false)
    expect(s.volume?.enabled).toBe(false)
    expect(toastShow).toHaveBeenCalledWith('snapToggleOff')
    expect(s.toggling).toBe(false)
  })
  it('failure: local value rolls back to the original + failure toast', async () => {
    listVolumes.mockResolvedValue([VOL])           // enabled: true
    togglePolicy.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSnapshotStore()
    await s.loadVolume('u1')
    await s.toggle('u1', false)
    expect(s.volume?.enabled).toBe(true)
    expect(toastShow).toHaveBeenCalledWith('snapToggleFailed')
  })
})

describe('savePolicy', () => {
  const form = { hourly_keep: 12, daily_keep: 5, weekly_keep: 3, pause_threshold_pct: 80 }
  it('goes through patchPolicy (read-modify-write), passing the whole form; returns true on success', async () => {
    patchPolicy.mockResolvedValue(null)
    const s = useSnapshotStore()
    const ok = await s.savePolicy('u1', form)
    expect(patchPolicy).toHaveBeenCalledWith('u1', form)
    expect(ok).toBe(true)
    expect(toastShow).toHaveBeenCalledWith('snapPolicySaved')
  })
  it('when the backend PUT returns null, local policy uses the just-saved form values (Vue2 would show undefined here — not replicated)', async () => {
    getPolicy.mockResolvedValue({ volume_uuid: 'u1', enabled: true, hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 })
    patchPolicy.mockResolvedValue(null)
    const s = useSnapshotStore()
    await s.loadPolicy('u1')
    await s.savePolicy('u1', form)
    expect(s.policy?.hourly_keep).toBe(12)
    expect(s.policy?.pause_threshold_pct).toBe(80)
    expect(s.policy?.enabled).toBe(true)      // fields not present in the form keep their original value
  })
  it('failure → returns false + failure toast + busy flag reset', async () => {
    patchPolicy.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSnapshotStore()
    expect(await s.savePolicy('u1', form)).toBe(false)
    expect(toastShow).toHaveBeenCalledWith('snapPolicySaveFailed')
    expect(s.policySaving).toBe(false)
  })
})

describe('createSnapshot', () => {
  it('with a note: body = {volume_uuid, label} (leading/trailing whitespace in label is trimmed)', async () => {
    createMock.mockResolvedValue(undefined)
    listVolumes.mockResolvedValue([VOL])
    listMock.mockResolvedValue([])
    const s = useSnapshotStore()
    expect(await s.createSnapshot('u1', '  升级前  ')).toBe(true)
    expect(createMock).toHaveBeenCalledWith({ volume_uuid: 'u1', label: '升级前' })
    expect(toastShow).toHaveBeenCalledWith('snapCreated')
  })
  it('without a note: body must not contain a label field', async () => {
    createMock.mockResolvedValue(undefined)
    listVolumes.mockResolvedValue([VOL])
    listMock.mockResolvedValue([])
    const s = useSnapshotStore()
    await s.createSnapshot('u1', '   ')
    expect(createMock).toHaveBeenCalledWith({ volume_uuid: 'u1' })
    expect(Object.keys(createMock.mock.calls[0][0] as object)).toEqual(['volume_uuid'])
  })
  it('refreshes the volume summary and snapshot list after success', async () => {
    createMock.mockResolvedValue(undefined)
    listVolumes.mockResolvedValue([VOL])
    listMock.mockResolvedValue([])
    const s = useSnapshotStore()
    await s.createSnapshot('u1', '')
    expect(listVolumes).toHaveBeenCalled()
    expect(listMock).toHaveBeenCalledWith('u1')
  })
  it('single-flight: the concurrent second call is swallowed; failure shows a failure toast and resets busy', async () => {
    createMock.mockResolvedValue(undefined)
    listVolumes.mockResolvedValue([VOL]); listMock.mockResolvedValue([])
    const s = useSnapshotStore()
    await Promise.all([s.createSnapshot('u1', ''), s.createSnapshot('u1', '')])
    expect(createMock).toHaveBeenCalledTimes(1)
    createMock.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await s.createSnapshot('u1', '')).toBe(false)
    expect(toastShow).toHaveBeenCalledWith('snapCreateFailed')
    expect(s.creatingSnapshot).toBe(false)
  })
})

describe('removeSnapshot', () => {
  it('calls remove(name, uuid) — the argument order must not be reversed; on success removes the entry locally and refreshes the volume summary', async () => {
    listMock.mockResolvedValue([
      { name: 'snap-a', created_at: '2026-07-27T00:00:00Z' },
      { name: 'snap-b', created_at: '2026-07-26T00:00:00Z' },
    ])
    listVolumes.mockResolvedValue([VOL])
    removeMock.mockResolvedValue(undefined)
    const s = useSnapshotStore()
    await s.loadSnapshots('u1')
    expect(await s.removeSnapshot('u1', 'snap-a')).toBe(true)
    expect(removeMock).toHaveBeenCalledWith('snap-a', 'u1')
    expect(s.snapshots.map(x => x.name)).toEqual(['snap-b'])
    expect(listVolumes).toHaveBeenCalled()
    expect(toastShow).toHaveBeenCalledWith('snapDeleted')
    expect(s.deletingName).toBeNull()
  })
  it('clicking again while deleting (same/another entry) is swallowed by the guard', async () => {
    listMock.mockResolvedValue([{ name: 'snap-a', created_at: '2026-07-27T00:00:00Z' }])
    listVolumes.mockResolvedValue([VOL])
    removeMock.mockResolvedValue(undefined)
    const s = useSnapshotStore()
    await s.loadSnapshots('u1')
    await Promise.all([s.removeSnapshot('u1', 'snap-a'), s.removeSnapshot('u1', 'snap-a')])
    expect(removeMock).toHaveBeenCalledTimes(1)
  })
  it('failure → returns false, list unchanged, failure toast, guard reset', async () => {
    listMock.mockResolvedValue([{ name: 'snap-a', created_at: '2026-07-27T00:00:00Z' }])
    removeMock.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSnapshotStore()
    await s.loadSnapshots('u1')
    expect(await s.removeSnapshot('u1', 'snap-a')).toBe(false)
    expect(s.snapshots).toHaveLength(1)
    expect(toastShow).toHaveBeenCalledWith('snapDeleteFailed')
    expect(s.deletingName).toBeNull()
  })
})
