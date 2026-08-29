// Test cases ported from the Vue 2 panel's tests/raidReplaceTarget.test.js (2026-08-11); behavior must match Vue2 verbatim.
import { describe, it, expect } from 'vitest'
import { findReplaceTarget, filterReplacementCandidates } from './raidReplace'
import type { RaidMemberDiskRow, DiskRaidInfo } from '@nimotech/nimoos-service'

// Fixture reproducing the 2026-08-11 incident: a 4-disk RAID10 has one disk pulled, and the
// freed device letter /dev/sdb gets reused by a brand-new replacement disk.
const liveMembers = [
  { path: '/dev/sdd', state: 'active sync', serial: 'OLD-1' },
  { path: '/dev/sdc', state: 'active sync', serial: 'OLD-2' },
  { path: '/dev/sda', state: 'active sync', serial: 'OLD-3' },
  { path: '', state: 'removed', serial: '' },
]
const memberDisks: RaidMemberDiskRow[] = [
  { disk_by_id: 'id-1', disk_serial: 'OLD-1', device_path_cache: '/dev/sdd' },
  { disk_by_id: 'id-2', disk_serial: 'OLD-2', device_path_cache: '/dev/sdc' },
  { disk_by_id: 'id-3', disk_serial: 'OLD-3', device_path_cache: '/dev/sda' },
  { disk_by_id: 'id-4', disk_serial: 'OLD-4', device_path_cache: '/dev/sdb' }, // Pulled; path has been reused
]
const availNewDisk = { path: '/dev/sdb', size: 1000490287104, serial: 'NEW-1' }

describe('findReplaceTarget', () => {
  it('a pulled disk is identified by serial, not by a stale cached path', () => {
    const t = findReplaceTarget(liveMembers, memberDisks)
    expect(t).toBeTruthy()
    expect(t!.serial).toBe('OLD-4')
    expect(t!.path).toBe('') // A stale cached path must never be exposed as disk identity
    expect(t!.label).toBe('OLD-4')
  })

  it('prefers an in-place faulty member, whose live path is trustworthy', () => {
    const withFaulty = [
      ...liveMembers.slice(0, 3),
      { path: '/dev/sde', state: 'faulty', serial: 'OLD-4' },
    ]
    const t = findReplaceTarget(withFaulty, memberDisks)!
    expect(t.path).toBe('/dev/sde')
    expect(t.serial).toBe('OLD-4')
    expect(t.label).toBe('/dev/sde')
  })

  it('falls back to path-based detection when the backend does not report member serials', () => {
    const noSerials = liveMembers.map((m) => ({ path: m.path, state: m.state }))
    const t = findReplaceTarget(noSerials, memberDisks)!
    expect(t.serial).toBe('OLD-4')
  })

  it('no missing member and no fault → null', () => {
    const full = memberDisks.map((m) => ({
      path: m.device_path_cache, state: 'active sync', serial: m.disk_serial,
    }))
    expect(findReplaceTarget(full, memberDisks)).toBeNull()
  })

  it('no live view (status not fetched / mdadm unreachable) → null, does not substitute the first healthy disk', () => {
    expect(findReplaceTarget([], memberDisks)).toBeNull()
    expect(findReplaceTarget(undefined, memberDisks)).toBeNull()
  })
})

describe('filterReplacementCandidates', () => {
  it('a new disk sitting on the old path of a pulled disk must be kept (the incident case)', () => {
    const target = findReplaceTarget(liveMembers, memberDisks)
    const out = filterReplacementCandidates([availNewDisk], target)
    expect(out).toHaveLength(1)
    expect(out[0].path).toBe('/dev/sdb')
  })

  it('excludes the faulty disk itself by serial', () => {
    const target = { path: '/dev/sde', serial: 'OLD-4', label: '/dev/sde' }
    const out = filterReplacementCandidates(
      [{ path: '/dev/sde', size: 1, serial: 'OLD-4' }, availNewDisk], target)
    expect(out.map((d) => d.path)).toEqual(['/dev/sdb'])
  })

  it('excludes by path when serial is unavailable', () => {
    const target = { path: '/dev/sde', serial: '', label: '/dev/sde' }
    const out = filterReplacementCandidates(
      [{ path: '/dev/sde', size: 1 }, { path: '/dev/sdb', size: 1 }], target)
    expect(out.map((d) => d.path)).toEqual(['/dev/sdb'])
  })

  it('lets everything through when there is no target', () => {
    expect(filterReplacementCandidates([availNewDisk], null)).toHaveLength(1)
  })

  it('raid residue info is passed through unchanged (the dialog relies on it for the warning flag + wipe confirmation)', () => {
    const residue = { role: 'residue', array_name: 'zimaos:fc56' } as DiskRaidInfo
    const out = filterReplacementCandidates(
      [{ path: '/dev/sdb', size: 1, serial: 'S1', raid: residue }], null)
    expect(out[0].raid).toEqual(residue)
  })
})
