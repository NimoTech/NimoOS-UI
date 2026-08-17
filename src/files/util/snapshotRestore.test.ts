import { describe, it, expect, vi } from 'vitest'
import { blockedBySnapshotView, performSnapshotRestore } from './snapshotRestore'

describe('blockedBySnapshotView', () => {
  it('not in snapshot → allow, no toast', () => {
    const toast = vi.fn()
    expect(blockedBySnapshotView(false, toast, 'nope')).toBe(false)
    expect(toast).not.toHaveBeenCalled()
  })
  it('in snapshot → block and show toast', () => {
    const toast = vi.fn()
    expect(blockedBySnapshotView(true, toast, '只读')).toBe(true)
    expect(toast).toHaveBeenCalledWith('只读')
  })
})

const INFO = { mount: '/DATA', snapshotName: 'snap1' }
const VOLS = [{ volume_uuid: 'u-data', mount: '/DATA' }]

describe('performSnapshotRestore', () => {
  it('map snapshot absolute path back to volume relative path before submitting', async () => {
    const restore = vi.fn().mockResolvedValue({ restored_path: '/DATA/Photos/a.jpg.restored-1' })
    const r = await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/Photos/a.jpg' },
      info: INFO,
      listVolumes: async () => VOLS,
      restore,
    })
    expect(restore).toHaveBeenCalledWith({ volume_uuid: 'u-data', snapshot: 'snap1', path: 'Photos/a.jpg' })
    expect(r).toEqual({ ok: true, restoredPath: '/DATA/Photos/a.jpg.restored-1' })
  })
  it('compatibility: backend wraps restored_path inside data', async () => {
    const r = await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => VOLS,
      restore: async () => ({ data: { restored_path: '/DATA/a.txt.restored-1' } }),
    })
    expect(r).toEqual({ ok: true, restoredPath: '/DATA/a.txt.restored-1' })
  })
  it('info is null / item has no path → invalid, no request sent', async () => {
    const restore = vi.fn()
    expect(await performSnapshotRestore({ item: { path: '/x' }, info: null, listVolumes: async () => VOLS, restore }))
      .toEqual({ ok: false, reason: 'invalid' })
    expect(restore).not.toHaveBeenCalled()
  })
  it('path not in snapshot → invalid', async () => {
    expect(await performSnapshotRestore({
      item: { path: '/DATA/Photos/a.jpg' }, info: INFO, listVolumes: async () => VOLS, restore: async () => ({}),
    })).toEqual({ ok: false, reason: 'invalid' })
  })
  it('snapshot root itself (empty relPath) → invalid', async () => {
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1' }, info: INFO, listVolumes: async () => VOLS, restore: async () => ({}),
    })).toEqual({ ok: false, reason: 'invalid' })
  })
  it('mount not found in volume list → invalid', async () => {
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => [{ volume_uuid: 'u-other', mount: '/OTHER' }], restore: async () => ({}),
    })).toEqual({ ok: false, reason: 'invalid' })
  })
  it('volume list request fails → error', async () => {
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => { throw new Error('boom') }, restore: async () => ({}),
    })).toEqual({ ok: false, reason: 'error' })
  })
  it('backend 404 → not-found', async () => {
    const err = Object.assign(new Error('gone'), { code: 404 })
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => VOLS, restore: async () => { throw err },
    })).toEqual({ ok: false, reason: 'not-found' })
  })
  it('backend 400 → invalid', async () => {
    const err = Object.assign(new Error('bad'), { code: 400 })
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => VOLS, restore: async () => { throw err },
    })).toEqual({ ok: false, reason: 'invalid' })
  })
  it('other errors → error', async () => {
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => VOLS, restore: async () => { throw new Error('boom') },
    })).toEqual({ ok: false, reason: 'error' })
  })
  it('response missing restored_path → error (do not falsely report success)', async () => {
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => VOLS, restore: async () => ({}),
    })).toEqual({ ok: false, reason: 'error' })
  })
})
