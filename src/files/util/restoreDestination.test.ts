// Byte-compat port of Vue2 NimoOS-UI's tests/restoreDestination.test.js — same case names/values
// where the logic is identical, adapted only for TS types and this codebase's already-unwrapped
// `service.folder.getList`-shaped listFolder response (`{content: [...]}` directly, not Vue2's
// axios-raw `{data:{data:{content:[...]}}}`).

import { describe, it, expect, vi } from 'vitest'
import {
  parentRelPath,
  defaultDestDirForItem,
  defaultDestDirForChildren,
  buildRestoreBody,
  listRestoreDirEntries,
  destPathBreadcrumbs,
  computeRestoreConflicts,
} from './restoreDestination'

describe('parentRelPath', () => {
  it('strips the last segment', () => {
    expect(parentRelPath('a/b/c')).toBe('a/b')
  })
  it('returns "" for a top-level (no-slash) relPath', () => {
    expect(parentRelPath('report.docx')).toBe('')
  })
  it('returns "" for an already-empty relPath (volume root)', () => {
    expect(parentRelPath('')).toBe('')
  })
})

describe('defaultDestDirForItem', () => {
  it('maps to the live-volume parent directory of a nested item', () => {
    expect(defaultDestDirForItem('/media/RAID_0', 'Documents/report.docx')).toBe('/media/RAID_0/Documents')
  })
  it('maps to the volume mount root for a top-level item', () => {
    expect(defaultDestDirForItem('/media/RAID_0', 'report.docx')).toBe('/media/RAID_0')
  })
  it('maps to the volume mount root for the volume root itself', () => {
    expect(defaultDestDirForItem('/media/RAID_0', '')).toBe('/media/RAID_0')
  })
})

describe('defaultDestDirForChildren', () => {
  it('maps directly (no parent-stripping) to the currently-browsed directory', () => {
    expect(defaultDestDirForChildren('/media/RAID_0', 'Documents/Q3')).toBe('/media/RAID_0/Documents/Q3')
  })
  it('maps to the volume mount root when browsing at the root', () => {
    expect(defaultDestDirForChildren('/media/RAID_0', '')).toBe('/media/RAID_0')
  })
})

describe('buildRestoreBody', () => {
  it('omits dest_dir/with_marker/on_conflict entirely when none are passed -- unchanged wire shape for non-picker callers', () => {
    expect(buildRestoreBody({ volumeUuid: 'uuid-a', snapshot: 'snap-1', path: 'Documents/report.docx' })).toEqual({
      volume_uuid: 'uuid-a',
      snapshot: 'snap-1',
      path: 'Documents/report.docx',
    })
  })

  it('includes dest_dir when destDir is passed', () => {
    expect(buildRestoreBody({ volumeUuid: 'uuid-a', snapshot: 'snap-1', path: 'a', destDir: '/media/RAID_0/Other' })).toEqual({
      volume_uuid: 'uuid-a',
      snapshot: 'snap-1',
      path: 'a',
      dest_dir: '/media/RAID_0/Other',
    })
  })

  it('includes with_marker: false when explicitly passed', () => {
    expect(buildRestoreBody({ volumeUuid: 'uuid-a', snapshot: 'snap-1', path: 'a', withMarker: false })).toEqual({
      volume_uuid: 'uuid-a',
      snapshot: 'snap-1',
      path: 'a',
      with_marker: false,
    })
  })

  it('includes with_marker: true when explicitly passed (not omitted just because it is the backend default)', () => {
    expect(buildRestoreBody({ volumeUuid: 'uuid-a', snapshot: 'snap-1', path: 'a', withMarker: true })).toEqual({
      volume_uuid: 'uuid-a',
      snapshot: 'snap-1',
      path: 'a',
      with_marker: true,
    })
  })

  it('includes both dest_dir and with_marker together', () => {
    expect(buildRestoreBody({
      volumeUuid: 'uuid-a', snapshot: 'snap-1', path: 'a', destDir: '/media/RAID_0/Other', withMarker: false,
    })).toEqual({
      volume_uuid: 'uuid-a',
      snapshot: 'snap-1',
      path: 'a',
      dest_dir: '/media/RAID_0/Other',
      with_marker: false,
    })
  })

  it('includes on_conflict: "overwrite" when the conflict dialog resolved to Overwrite', () => {
    expect(buildRestoreBody({
      volumeUuid: 'uuid-a', snapshot: 'snap-1', path: 'a', destDir: '/media/RAID_0/Other', withMarker: false, onConflict: 'overwrite',
    })).toEqual({
      volume_uuid: 'uuid-a',
      snapshot: 'snap-1',
      path: 'a',
      dest_dir: '/media/RAID_0/Other',
      with_marker: false,
      on_conflict: 'overwrite',
    })
  })

  it('includes on_conflict: "keep_both" when the conflict dialog resolved to Keep both', () => {
    expect(buildRestoreBody({
      volumeUuid: 'uuid-a', snapshot: 'snap-1', path: 'a', destDir: '/media/RAID_0/Other', withMarker: false, onConflict: 'keep_both',
    })).toEqual({
      volume_uuid: 'uuid-a',
      snapshot: 'snap-1',
      path: 'a',
      dest_dir: '/media/RAID_0/Other',
      with_marker: false,
      on_conflict: 'keep_both',
    })
  })

  it('omits on_conflict entirely when not passed -- unconflicted items keep the exact same wire shape', () => {
    expect(buildRestoreBody({ volumeUuid: 'uuid-a', snapshot: 'snap-1', path: 'a', destDir: '/media/RAID_0/Other', withMarker: false })).toEqual({
      volume_uuid: 'uuid-a',
      snapshot: 'snap-1',
      path: 'a',
      dest_dir: '/media/RAID_0/Other',
      with_marker: false,
    })
  })

  it('a falsy but explicit destDir ("") is treated the same as omitted -- no dest_dir key', () => {
    expect(buildRestoreBody({ volumeUuid: 'uuid-a', snapshot: 'snap-1', path: 'a', destDir: '' })).toEqual({
      volume_uuid: 'uuid-a',
      snapshot: 'snap-1',
      path: 'a',
    })
  })
})

describe('computeRestoreConflicts', () => {
  const destDir = '/media/RAID_0/Documents'

  it('never fetches the destination listing at all when withMarker is on -- treated as unconditionally conflict-free', async () => {
    const listFolder = vi.fn()
    const items = [{ name: 'report.docx', is_dir: false }]
    const conflicts = await computeRestoreConflicts({ items, destDir, withMarker: true, listFolder })
    expect(conflicts).toEqual([])
    expect(listFolder).not.toHaveBeenCalled()
  })

  it('returns an empty array when withMarker is off but nothing in destDir collides', async () => {
    const listFolder = vi.fn().mockResolvedValue({ content: [] })
    const items = [{ name: 'report.docx', is_dir: false }]
    const conflicts = await computeRestoreConflicts({ items, destDir, withMarker: false, listFolder })
    expect(listFolder).toHaveBeenCalledWith(destDir)
    expect(conflicts).toEqual([])
  })

  it('flags a file item whose name already exists in destDir, carrying name/isDir/groupKey', async () => {
    const listFolder = vi.fn().mockResolvedValue({
      content: [{ name: 'report.docx', path: `${destDir}/report.docx`, is_dir: false }],
    })
    const items = [{ name: 'report.docx', is_dir: false }]
    const conflicts = await computeRestoreConflicts({ items, destDir, withMarker: false, listFolder })
    expect(conflicts).toEqual([{ name: 'report.docx', isDir: false, groupKey: 'report.docx' }])
  })

  it('flags a directory item the same way, with isDir: true', async () => {
    const listFolder = vi.fn().mockResolvedValue({
      content: [{ name: 'Photos', path: `${destDir}/Photos`, is_dir: true }],
    })
    const items = [{ name: 'Photos', is_dir: true }]
    const conflicts = await computeRestoreConflicts({ items, destDir, withMarker: false, listFolder })
    expect(conflicts).toEqual([{ name: 'Photos', isDir: true, groupKey: 'Photos' }])
  })

  it('only flags the colliding items out of a mixed batch', async () => {
    const listFolder = vi.fn().mockResolvedValue({
      content: [{ name: 'a.txt', path: `${destDir}/a.txt`, is_dir: false }],
    })
    const items = [{ name: 'a.txt', is_dir: false }, { name: 'b.txt', is_dir: false }]
    const conflicts = await computeRestoreConflicts({ items, destDir, withMarker: false, listFolder })
    expect(conflicts).toEqual([{ name: 'a.txt', isDir: false, groupKey: 'a.txt' }])
  })

  it('treats a missing is_dir as a file (isDir: false)', async () => {
    const listFolder = vi.fn().mockResolvedValue({
      content: [{ name: 'report.docx', path: `${destDir}/report.docx`, is_dir: false }],
    })
    const items = [{ name: 'report.docx' }]
    const conflicts = await computeRestoreConflicts({ items, destDir, withMarker: false, listFolder })
    expect(conflicts).toEqual([{ name: 'report.docx', isDir: false, groupKey: 'report.docx' }])
  })
})

describe('listRestoreDirEntries', () => {
  it('filters to directories only, mapped to {name, path}, sorted by name', async () => {
    const listFolder = vi.fn().mockResolvedValue({
      content: [
        { name: 'zeta', path: '/media/RAID_0/zeta', is_dir: true },
        { name: 'report.docx', path: '/media/RAID_0/report.docx', is_dir: false },
        { name: 'Alpha', path: '/media/RAID_0/Alpha', is_dir: true },
      ],
    })
    const entries = await listRestoreDirEntries('/media/RAID_0', listFolder)
    expect(listFolder).toHaveBeenCalledWith('/media/RAID_0')
    expect(entries).toEqual([
      { name: 'Alpha', path: '/media/RAID_0/Alpha' },
      { name: 'zeta', path: '/media/RAID_0/zeta' },
    ])
  })

  it('returns an empty array when the response has no content', async () => {
    const listFolder = vi.fn().mockResolvedValue({})
    expect(await listRestoreDirEntries('/media/RAID_0', listFolder)).toEqual([])
  })

  it('returns an empty array when the response is null', async () => {
    const listFolder = vi.fn().mockResolvedValue(null)
    expect(await listRestoreDirEntries('/media/RAID_0', listFolder)).toEqual([])
  })
})

describe('destPathBreadcrumbs', () => {
  it('returns just the mount crumb when path equals mount', () => {
    expect(destPathBreadcrumbs('/media/RAID_0', '/media/RAID_0')).toEqual([
      { label: '/media/RAID_0', path: '/media/RAID_0' },
    ])
  })
  it('splits nested segments into their own crumbs, each with a cumulative path', () => {
    expect(destPathBreadcrumbs('/media/RAID_0', '/media/RAID_0/Documents/Q3')).toEqual([
      { label: '/media/RAID_0', path: '/media/RAID_0' },
      { label: 'Documents', path: '/media/RAID_0/Documents' },
      { label: 'Q3', path: '/media/RAID_0/Documents/Q3' },
    ])
  })
  it('falls back to just the mount crumb (never throws) when path is not under mount at all', () => {
    expect(destPathBreadcrumbs('/media/RAID_0', '/mnt/other/Documents')).toEqual([
      { label: '/media/RAID_0', path: '/media/RAID_0' },
    ])
  })
  it('tolerates a trailing slash on either side', () => {
    expect(destPathBreadcrumbs('/media/RAID_0/', '/media/RAID_0/Documents/')).toEqual([
      { label: '/media/RAID_0', path: '/media/RAID_0' },
      { label: 'Documents', path: '/media/RAID_0/Documents' },
    ])
  })
})
