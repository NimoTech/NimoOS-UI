// Ported byte-for-byte from the Vue 2 panel's src/utils/raidUtils.js (2026-08-11, commit 0623ce20/69ea4798/b6cffd6c):
// findReplaceTarget (L190-213) + filterReplacementCandidates (L219-227). Behavior stays identical,
// including the "no live member view → null" guard; only TS types were added, the decision logic is unchanged.
//
// Background (2026-08-11 incident): after pulling a disk and swapping in a new one, the device
// letter freed up by the pulled disk (/dev/sdb) gets reused by the new disk — the pulled disk's
// device_path_cache cached in the DB now points at **a different** physical disk. Identifying/
// filtering by path would empty out the candidate-disk list and target the wrong disk in the
// request body. So: an in-place faulty disk's path is trustworthy, use it directly; a pulled
// disk can only be matched by serial, and its stale cached path must never be exposed as if it were the disk itself.
import type { DiskRaidInfo, RaidMemberDiskRow } from '@nimotech/nimoos-service'

export interface ReplaceTarget {
  // Live path of an in-place faulty disk; '' for a pulled disk (stale cached path is never exposed)
  path: string
  serial: string
  // For display: an in-place disk shows path, a pulled disk shows serial (falling back to the cached path)
  label: string
}

// findReplaceTarget consumes status.members rows (path/state/serial); all fields may be absent for compatibility with older backends.
export interface LiveMemberLike {
  path?: string
  state?: string
  serial?: string
}

// Candidate-disk input: store.availDisks (AvailDisk) satisfies this structurally; falls back to name when path is absent (same as Vue2).
export interface CandidateDiskLike {
  path?: string
  name?: string
  size?: number
  serial?: string
  raid?: DiskRaidInfo | null
}

export interface ReplacementCandidate {
  path: string
  size: number
  serial: string
  // residue info passed through as-is: the replace-disk dialog uses it to show a warning badge + pop a wipe confirmation
  raid: DiskRaidInfo | null
}

// Identifies the swapped-out member in a degraded array.
// A disk marked faulty is still in place, its live path is trustworthy; a pulled disk only has
// its DB member row left, matched by serial, and its stale cached path is never exposed as
// disk identity. When the backend doesn't report member serial, fall back to detecting by path.
export function findReplaceTarget(
  liveMembers: LiveMemberLike[] | null | undefined,
  memberDisks: RaidMemberDiskRow[] | null | undefined,
): ReplaceTarget | null {
  const live = (liveMembers || []).filter((m) => m && m.path)
  // A completely absent live view (status hasn't been fetched yet, or mdadm is unreachable) means
  // "no information," not "every member is gone" — without this guard, the first healthy disk would be served up as the faulty one.
  if (!live.length) return null
  const faulty = live.find((m) => m.state === 'faulty')
  if (faulty) {
    return { path: faulty.path as string, serial: faulty.serial || '', label: faulty.path as string }
  }
  const liveSerials = new Set(live.map((m) => m.serial).filter(Boolean))
  const livePaths = new Set(live.map((m) => m.path))
  const bySerial = liveSerials.size > 0
  const missing = (memberDisks || []).find((m) => {
    if (bySerial && m.disk_serial) return !liveSerials.has(m.disk_serial)
    return !!m.device_path_cache && !livePaths.has(m.device_path_cache)
  })
  if (!missing) return null
  return {
    path: '',
    serial: missing.disk_serial || '',
    label: missing.disk_serial || missing.device_path_cache || '',
  }
}

// Filters replacement candidates: the disk being replaced must never appear among the candidates.
// When both sides have a serial, match by serial — after hot-swapping, the new disk may sit at
// exactly the pulled disk's old path, and that path collision must not empty out the candidate list.
export function filterReplacementCandidates(
  disks: CandidateDiskLike[] | null | undefined,
  target: ReplaceTarget | null | undefined,
): ReplacementCandidate[] {
  return (disks || [])
    .map((d) => ({ path: d.path || d.name || '', size: d.size || 0, serial: d.serial || '', raid: d.raid || null }))
    .filter((d) => {
      if (!target) return true
      if (target.serial && d.serial) return d.serial !== target.serial
      return !target.path || d.path !== target.path
    })
}
