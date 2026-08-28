import { describe, it, expect, vi } from 'vitest'
import {
  blockedBySnapshotView, performSnapshotRestore, executeRestoreBatch, buildRestoreToasts,
  shouldRejectRootRestore, wholeFolderRestoreItem, type ResolvedRestoreEntry, type RestoreOutcome,
} from './snapshotRestore'

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
  // The shape axios really throws for LocalStorage's 404 (route/snapshot.go:202): a STRING code,
  // with the number on response.status. The old local helper read `code ?? response.status`, so the
  // string won and this branch never fired -- a file genuinely gone from the snapshot reported the
  // generic "restore failed" instead.
  it('a real HTTP 404 (axios string code, status on the response) → not-found', async () => {
    const err = Object.assign(new Error('Request failed'), {
      name: 'AxiosError',
      code: 'ERR_BAD_REQUEST',
      response: { status: 404, data: { success: 10002, message: 'restore source not found' } },
    })
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => VOLS, restore: async () => { throw err },
    })).toEqual({ ok: false, reason: 'not-found' })
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
  // destDir/withMarker/onConflict thread through buildRestoreBody (restoreDestination.ts)
  // unchanged -- see that module's own test for the exact field-omission rules; this only proves
  // performSnapshotRestore actually forwards what it's given.
  it('destDir/withMarker/onConflict are forwarded into the request body via buildRestoreBody', async () => {
    const restore = vi.fn().mockResolvedValue({ restored_path: '/DATA/Photos/a.jpg' })
    await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/Photos/a.jpg' }, info: INFO,
      listVolumes: async () => VOLS, restore,
      destDir: '/DATA/Elsewhere', withMarker: false, onConflict: 'overwrite',
    })
    expect(restore).toHaveBeenCalledWith({
      volume_uuid: 'u-data', snapshot: 'snap1', path: 'Photos/a.jpg',
      dest_dir: '/DATA/Elsewhere', with_marker: false, on_conflict: 'overwrite',
    })
  })
})

describe('executeRestoreBatch', () => {
  const INFO = { mount: '/DATA', snapshotName: 'snap1' }
  const VOLS = [{ volume_uuid: 'u-data', mount: '/DATA' }]
  const entry = (path: string, onConflict?: 'overwrite' | 'keep_both'): ResolvedRestoreEntry =>
    ({ item: { path, name: path.split('/').pop()! }, onConflict })

  it('submits entries strictly one at a time, in order', async () => {
    const order: string[] = []
    const restore = vi.fn().mockImplementation(async (body: { path: string }) => {
      order.push(body.path)
      return { restored_path: `/DATA/${body.path}` }
    })
    const outcomes = await executeRestoreBatch({
      entries: [
        entry('/DATA/.snapshots/snap1/a'),
        entry('/DATA/.snapshots/snap1/b'),
        entry('/DATA/.snapshots/snap1/c'),
      ],
      info: INFO, listVolumes: async () => VOLS, restore,
    })
    expect(order).toEqual(['a', 'b', 'c'])
    expect(outcomes.map((o) => o.result.ok)).toEqual([true, true, true])
  })

  it('a slow first item is fully awaited before the second is even submitted (no overlap)', async () => {
    let releaseFirst: (() => void) | null = null
    const restore = vi.fn()
      .mockImplementationOnce(() => new Promise((res) => { releaseFirst = () => res({ restored_path: '/x' }) }))
      .mockResolvedValueOnce({ restored_path: '/y' })
    const p = executeRestoreBatch({
      entries: [entry('/DATA/.snapshots/snap1/a'), entry('/DATA/.snapshots/snap1/b')],
      info: INFO, listVolumes: async () => VOLS, restore,
    })
    await vi.waitFor(() => expect(restore).toHaveBeenCalledTimes(1))
    expect(restore).toHaveBeenCalledTimes(1) // second item not submitted yet
    releaseFirst!()
    await p
    expect(restore).toHaveBeenCalledTimes(2)
  })

  it('per-entry onConflict is forwarded to the network call', async () => {
    const restore = vi.fn().mockResolvedValue({ restored_path: '/x' })
    await executeRestoreBatch({
      entries: [entry('/DATA/.snapshots/snap1/a', 'overwrite'), entry('/DATA/.snapshots/snap1/b', 'keep_both')],
      info: INFO, listVolumes: async () => VOLS, restore,
    })
    expect(restore).toHaveBeenNthCalledWith(1, expect.objectContaining({ on_conflict: 'overwrite' }))
    expect(restore).toHaveBeenNthCalledWith(2, expect.objectContaining({ on_conflict: 'keep_both' }))
  })

  it('reports progress after each item settles', async () => {
    const restore = vi.fn().mockResolvedValue({ restored_path: '/x' })
    const progress: { done: number; total: number }[] = []
    await executeRestoreBatch({
      entries: [entry('/DATA/.snapshots/snap1/a'), entry('/DATA/.snapshots/snap1/b')],
      info: INFO, listVolumes: async () => VOLS, restore,
      onProgress: (done, total) => progress.push({ done, total }),
    })
    expect(progress).toEqual([{ done: 1, total: 2 }, { done: 2, total: 2 }])
  })

  it('one item failing does not stop the rest of the batch', async () => {
    const restore = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { code: 404 }))
      .mockResolvedValueOnce({ restored_path: '/x' })
    const outcomes = await executeRestoreBatch({
      entries: [entry('/DATA/.snapshots/snap1/a'), entry('/DATA/.snapshots/snap1/b')],
      info: INFO, listVolumes: async () => VOLS, restore,
    })
    expect(outcomes[0].result).toEqual({ ok: false, reason: 'not-found' })
    expect(outcomes[1].result).toEqual({ ok: true, restoredPath: '/x' })
  })

  it('empty entries → no calls, empty outcomes', async () => {
    const restore = vi.fn()
    const outcomes = await executeRestoreBatch({ entries: [], info: INFO, listVolumes: async () => VOLS, restore })
    expect(outcomes).toEqual([])
    expect(restore).not.toHaveBeenCalled()
  })
})

describe('buildRestoreToasts', () => {
  const ok = (path: string): RestoreOutcome => ({ item: { path, name: path }, result: { ok: true, restoredPath: path } })
  const fail = (path: string, reason: 'not-found' | 'invalid' | 'error'): RestoreOutcome =>
    ({ item: { path, name: path }, result: { ok: false, reason } })

  it('everything restored, no skips → tmRestoredCount only, path is the FIRST success', () => {
    expect(buildRestoreToasts([ok('/a'), ok('/b')], 0)).toEqual([
      { key: 'tmRestoredCount', params: { count: 2, path: '/a' } },
    ])
  })

  it('default (no opts, e.g. a one-item selection): a single restored item still uses tmRestoredCount (Vue2 parity: executeSnapshotRestore uses the same copy for 1 or many)', () => {
    expect(buildRestoreToasts([ok('/a')], 0)).toEqual([
      { key: 'tmRestoredCount', params: { count: 1, path: '/a' } },
    ])
  })

  // The key list was planning shorthand, not a copy ruling — visible copy follows Vue2 exactly.
  // Vue2's restoreSnapshotItem (context-menu single item) uses
  // a DIFFERENT copy than executeSnapshotRestore (every other entry point): "Restored to {path}",
  // no count. `opts.singleItemFlow` is how the CALLER (not this function) picks that branch.
  it('singleItemFlow: true → snapBrowseRestored ("Restored to {path}"), no count', () => {
    expect(buildRestoreToasts([ok('/a')], 0, { singleItemFlow: true })).toEqual([
      { key: 'snapBrowseRestored', params: { path: '/a' } },
    ])
  })
  it('singleItemFlow: false is identical to omitting opts entirely (tmRestoredCount)', () => {
    expect(buildRestoreToasts([ok('/a')], 0, { singleItemFlow: false })).toEqual([
      { key: 'tmRestoredCount', params: { count: 1, path: '/a' } },
    ])
  })

  it('skipped items get their own toast, in addition to the success toast', () => {
    expect(buildRestoreToasts([ok('/a')], 2)).toEqual([
      { key: 'filesUploadSkipped', params: { count: 2 } },
      { key: 'tmRestoredCount', params: { count: 1, path: '/a' } },
    ])
  })

  it('nothing executed (everything skipped) → only the skipped toast, no restored toast', () => {
    expect(buildRestoreToasts([], 3)).toEqual([{ key: 'filesUploadSkipped', params: { count: 3 } }])
  })

  it('nothing executed, nothing skipped → no toasts at all', () => {
    expect(buildRestoreToasts([], 0)).toEqual([])
  })

  it('mixed success/failure → one combined partial toast, not a success toast plus a failure toast (colleague fix ⑦)', () => {
    expect(buildRestoreToasts([ok('/a'), fail('/b', 'not-found'), ok('/c')], 0)).toEqual([
      { key: 'snapBrowseRestoredPartial', params: { ok: 2, fail: 1 }, tier: 'warning' },
    ])
  })

  it('all failed, same reason → the specific-reason key, keyed off the FIRST failure', () => {
    expect(buildRestoreToasts([fail('/a', 'not-found'), fail('/b', 'not-found')], 0)).toEqual([
      { key: 'snapBrowseRestoreNotFound', tier: 'danger' },
    ])
  })
  it('all failed, mixed reasons → still keyed off the FIRST failure only (no stacking every reason)', () => {
    expect(buildRestoreToasts([fail('/a', 'invalid'), fail('/b', 'not-found')], 0)).toEqual([
      { key: 'snapBrowseRestoreInvalid', tier: 'danger' },
    ])
  })
  it('all failed, generic reason', () => {
    expect(buildRestoreToasts([fail('/a', 'error')], 0)).toEqual([
      { key: 'snapBrowseRestoreFailed', tier: 'danger' },
    ])
  })
})

describe('shouldRejectRootRestore', () => {
  it('empty relPath (the snapshot\'s own root) → reject', () => {
    expect(shouldRejectRootRestore('')).toBe(true)
  })
  it('any non-empty relPath → do not reject', () => {
    expect(shouldRejectRootRestore('Photos')).toBe(false)
    expect(shouldRejectRootRestore('Photos/2024')).toBe(false)
  })
})

describe('wholeFolderRestoreItem', () => {
  it('name is the LAST segment of relPath; path is the browsed directory\'s own absolute path', () => {
    expect(wholeFolderRestoreItem('/DATA/.snapshots/snap1/Photos/2024', 'Photos/2024')).toEqual({
      path: '/DATA/.snapshots/snap1/Photos/2024', name: '2024', is_dir: true,
    })
  })
  it('a single-segment relPath: name equals the whole relPath', () => {
    expect(wholeFolderRestoreItem('/DATA/.snapshots/snap1/Photos', 'Photos')).toEqual({
      path: '/DATA/.snapshots/snap1/Photos', name: 'Photos', is_dir: true,
    })
  })
})
