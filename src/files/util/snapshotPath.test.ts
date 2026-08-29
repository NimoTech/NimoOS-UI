import { describe, it, expect, vi } from 'vitest'
import {
  snapshotBrowsePath, parseSnapshotBrowsePath, liveVolumePath, parseSnapshotName,
  formatSnapshotBannerTime, findVolumeForPath, findVolumeUuidForMount,
  shouldGuardSnapshotView, resolveExitTarget, relPathUnderMount, parseSnapshotsContainerPath,
} from './snapshotPath'

describe('snapshotBrowsePath', () => {
  it('compose <mount>/.snapshots/<snapshot-name>', () => {
    expect(snapshotBrowsePath('/DATA', '20260713T061900Z_manual_x')).toBe('/DATA/.snapshots/20260713T061900Z_manual_x')
  })
})

describe('parseSnapshotBrowsePath', () => {
  it('parse mount / snapshotName / relPath', () => {
    expect(parseSnapshotBrowsePath('/DATA/.snapshots/snap1/Photos/2024')).toEqual({
      mount: '/DATA', snapshotName: 'snap1', relPath: 'Photos/2024',
    })
  })
  it('snapshot root has empty relPath', () => {
    expect(parseSnapshotBrowsePath('/DATA/.snapshots/snap1')).toEqual({ mount: '/DATA', snapshotName: 'snap1', relPath: '' })
  })
  it('tolerate trailing slash', () => {
    expect(parseSnapshotBrowsePath('/DATA/.snapshots/snap1/')).toEqual({ mount: '/DATA', snapshotName: 'snap1', relPath: '' })
  })
  it('match segments, not substrings: directories with .snapshots in name are not misidentified', () => {
    expect(parseSnapshotBrowsePath('/DATA/my.snapshotsbackup/x')).toBeNull()
  })
  it('multiple .snapshots segments: take the leftmost (outer is the mount boundary)', () => {
    expect(parseSnapshotBrowsePath('/DATA/.snapshots/snap1/inner/.snapshots/deep')).toEqual({
      mount: '/DATA', snapshotName: 'snap1', relPath: 'inner/.snapshots/deep',
    })
  })
  it('no mount prefix (starts with /.snapshots) returns null', () => {
    expect(parseSnapshotBrowsePath('/.snapshots/snap1')).toBeNull()
  })
  it('.snapshots itself (no snapshot selected) returns null', () => {
    expect(parseSnapshotBrowsePath('/DATA/.snapshots')).toBeNull()
  })
  it('empty/non-string values return null', () => {
    expect(parseSnapshotBrowsePath('')).toBeNull()
    expect(parseSnapshotBrowsePath(null)).toBeNull()
  })
})

describe('liveVolumePath', () => {
  it('concat with relative path if present', () => { expect(liveVolumePath('/DATA', 'Photos/2024')).toBe('/DATA/Photos/2024') })
  it('return volume root if relative path is empty', () => { expect(liveVolumePath('/DATA', '')).toBe('/DATA') })
})

describe('parseSnapshotName', () => {
  it('parse ISO8601 basic timestamp segment', () => {
    const r = parseSnapshotName('20260713T061900Z_manual_改版前')
    expect(r?.createdAt.toISOString()).toBe('2026-07-13T06:19:00.000Z')
  })
  it('type segment is not validated: unknown type still parses timestamp', () => {
    expect(parseSnapshotName('20260713T061900Z_unknown')?.createdAt.toISOString()).toBe('2026-07-13T06:19:00.000Z')
  })
  it('invalid format returns null instead of throwing', () => {
    expect(parseSnapshotName('not-a-snapshot')).toBeNull()
    expect(parseSnapshotName('')).toBeNull()
  })
})

describe('formatSnapshotBannerTime', () => {
  it('on parse failure, fall back to original name instead of empty', () => {
    expect(formatSnapshotBannerTime('weird-name')).toBe('weird-name')
  })
  it('on success, return localized time string (not original name)', () => {
    expect(formatSnapshotBannerTime('20260713T061900Z_manual')).not.toBe('20260713T061900Z_manual')
  })
})

describe('findVolumeForPath', () => {
  const vols = [
    { mount: '/DATA', volume_uuid: 'u-data' },
    { mount: '/DATA/sub', volume_uuid: 'u-sub' },
  ]
  it('take the longest matching mount prefix', () => {
    expect(findVolumeForPath(vols, '/DATA/sub/x')?.volume_uuid).toBe('u-sub')
    expect(findVolumeForPath(vols, '/DATA/other')?.volume_uuid).toBe('u-data')
  })
  it('mount point itself also matches', () => {
    expect(findVolumeForPath(vols, '/DATA')?.volume_uuid).toBe('u-data')
  })
  it('name-prefix match alone does not count (/DATAX does not belong to /DATA)', () => {
    expect(findVolumeForPath(vols, '/DATAX/y')).toBeNull()
  })
  it('invalid input returns null', () => {
    expect(findVolumeForPath(vols, '')).toBeNull()
    expect(findVolumeForPath(null as never, '/DATA')).toBeNull()
  })
})

describe('findVolumeUuidForMount', () => {
  it('exact match, tolerate trailing slash', () => {
    const vols = [{ mount: '/DATA/', volume_uuid: 'u1' }]
    expect(findVolumeUuidForMount(vols, '/DATA')).toBe('u1')
  })
  it('no match returns null', () => {
    expect(findVolumeUuidForMount([{ mount: '/A', volume_uuid: 'u1' }], '/B')).toBeNull()
  })
})

describe('shouldGuardSnapshotView (fail-safe direction must not reverse)', () => {
  const info = { mount: '/DATA', snapshotName: 's1', relPath: '' }
  it('path is not a snapshot → do not lock', () => {
    expect(shouldGuardSnapshotView(null, { status: 'ready', volumes: [] })).toBe(false)
  })
  it('volume list not loaded (idle) → keep locked', () => {
    expect(shouldGuardSnapshotView(info, { status: 'idle', volumes: [] })).toBe(true)
  })
  it('volume list in progress (loading) → keep locked', () => {
    expect(shouldGuardSnapshotView(info, { status: 'loading', volumes: [] })).toBe(true)
  })
  it('volume list load failed (error) → keep locked', () => {
    expect(shouldGuardSnapshotView(info, { status: 'error', volumes: [] })).toBe(true)
  })
  it('ready but mount not in list → keep locked', () => {
    expect(shouldGuardSnapshotView(info, { status: 'ready', volumes: [{ mount: '/OTHER', supported: true }] })).toBe(true)
  })
  it('ready and exact match and supported === false → only unlock condition', () => {
    expect(shouldGuardSnapshotView(info, { status: 'ready', volumes: [{ mount: '/DATA', supported: false }] })).toBe(false)
  })
  it('ready and match but supported === true → lock (this is real snapshot)', () => {
    expect(shouldGuardSnapshotView(info, { status: 'ready', volumes: [{ mount: '/DATA', supported: true }] })).toBe(true)
  })
  it('state is null/undefined → keep locked', () => {
    expect(shouldGuardSnapshotView(info, null)).toBe(true)
  })
})

describe('resolveExitTarget', () => {
  it('same-name directory exists on live volume → navigate there', async () => {
    const dirExists = vi.fn().mockResolvedValue(true)
    await expect(resolveExitTarget({ mount: '/DATA', snapshotName: 's1', relPath: 'Photos/2024' }, dirExists))
      .resolves.toBe('/DATA/Photos/2024')
    expect(dirExists).toHaveBeenCalledWith('/DATA/Photos/2024')
  })
  it('directory no longer exists on live volume → navigate to volume root', async () => {
    await expect(resolveExitTarget({ mount: '/DATA', snapshotName: 's1', relPath: 'gone' }, async () => false))
      .resolves.toBe('/DATA')
  })
  it('info is null → null', async () => {
    await expect(resolveExitTarget(null, async () => true)).resolves.toBeNull()
  })
})

describe('parseSnapshotsContainerPath (Critical 1 second round: .snapshots container directory itself, path parsing alone does not recognize volumes)', () => {
  it('match: path equals exactly <mount>/.snapshots, synthesize empty snapshotName/relPath', () => {
    expect(parseSnapshotsContainerPath('/DATA/.snapshots')).toEqual({ mount: '/DATA', snapshotName: '', relPath: '' })
  })
  it('tolerate trailing slash', () => {
    expect(parseSnapshotsContainerPath('/DATA/.snapshots/')).toEqual({ mount: '/DATA', snapshotName: '', relPath: '' })
  })
  it('no match: specific snapshot selected (extra segment) is not container path itself — pass to parseSnapshotBrowsePath', () => {
    expect(parseSnapshotsContainerPath('/DATA/.snapshots/snap1')).toBeNull()
  })
  it('no match: regular directory', () => {
    expect(parseSnapshotsContainerPath('/DATA/Photos')).toBeNull()
  })
  it('does not recognize "volume" concept: even if not under any known volume, synthesize result if path shape matches — whether to lock is decided by shouldGuardSnapshotView in fail-safe direction, no overthinking here', () => {
    expect(parseSnapshotsContainerPath('/OTHER/.snapshots')).toEqual({ mount: '/OTHER', snapshotName: '', relPath: '' })
  })
  it('no mount prefix (starts with /.snapshots) returns null', () => {
    expect(parseSnapshotsContainerPath('/.snapshots')).toBeNull()
  })
  it('invalid input returns null', () => {
    expect(parseSnapshotsContainerPath('')).toBeNull()
    expect(parseSnapshotsContainerPath(null)).toBeNull()
  })
})

describe('relPathUnderMount', () => {
  it('mount point itself → empty string', () => { expect(relPathUnderMount('/DATA', '/DATA')).toBe('') })
  it('get relative path from volume root', () => { expect(relPathUnderMount('/DATA', '/DATA/Photos/2024')).toBe('Photos/2024') })
  it('tolerate trailing slash on both sides', () => { expect(relPathUnderMount('/DATA/', '/DATA/Photos/')).toBe('Photos') })
  it('path not under mount → empty string (fall back to volume root, do not guess)', () => {
    expect(relPathUnderMount('/DATA', '/OTHER/x')).toBe('')
    expect(relPathUnderMount('/DATA', '/DATAX/x')).toBe('')
  })
  it('empty input → empty string', () => { expect(relPathUnderMount('', '/DATA/x')).toBe('') })
})
