import type { RaidStatus, RaidMemberDisk } from '@nimotech/nimoos-service'

export interface RaidArray {
  id: number | string
  name: string
  level: number
  state: string
  member_disks?: unknown[]
  mount_point?: string
  device_path?: string
  uuid?: string
  chunk_kb?: number
  filesystem?: string
  fsType?: string
}

export interface RaidTask {
  taskId: string
  name: string
  level: number
  filesystem: string
  diskCount: number
  step: number
  stepName: string
  progress: number
  elapsedSeconds: number
  error: string
  status: string
}

export interface RaidUsage {
  filesystem?: string
  btrfs_usage?: { free_estimated_bytes?: number; cached_at?: string | number }
}

export interface RaidStateFlags {
  effectiveState: string
  liveState: string
  isRebuilding: boolean
  isDegraded: boolean
  isFailed: boolean
  isRetrying: boolean
}

export type RaidSeverity = 'ok' | 'info' | 'warning' | 'danger'

// list() returns RaidStatus[] (index signature passes through id/name/level etc.); narrow to RaidArray.
export function asRaidArray(raw: RaidStatus | Record<string, unknown>): RaidArray {
  const r = raw as Record<string, unknown>
  return {
    id: (r.id as number | string) ?? '',
    name: (r.name as string) || '',
    level: Number(r.level) || 0,
    state: (r.state as string) || '',
    member_disks: Array.isArray(r.member_disks) ? (r.member_disks as unknown[]) : [],
    mount_point: (r.mount_point as string) || '',
    device_path: (r.device_path as string) || '',
    uuid: (r.uuid as string) || '',
    chunk_kb: Number(r.chunk_kb) || 0,
    filesystem: (r.filesystem as string) || '',
    fsType: (r.fsType as string) || '',
  }
}

export function mapTask(raw: Record<string, unknown>): RaidTask {
  return {
    taskId: String(raw.task_id ?? ''),
    name: (raw.name as string) || '',
    level: Number(raw.level) || 0,
    filesystem: (raw.filesystem as string) || '',
    diskCount: Number(raw.disk_count) || 0,
    step: Number(raw.step) || 0,
    stepName: (raw.step_name as string) || '',
    progress: Number(raw.progress) || 0,
    elapsedSeconds: Number(raw.elapsed_seconds) || 0,
    error: (raw.error as string) || '',
    status: (raw.status as string) || '',
  }
}

// Verbatim port of the RaidCard.vue state computation (L82-92).
export function resolveRaidState(array: RaidArray, status?: RaidStatus | null): RaidStateFlags {
  const effectiveState = (status?.state as string) || array.state || ''
  const liveState = (status?.live_state as string) || effectiveState
  const rebuildPct = Number(status?.rebuild_pct) || 0
  const isRebuilding =
    effectiveState === 'rebuilding' ||
    liveState.includes('recovering') ||
    liveState.includes('resyncing') ||
    rebuildPct > 0
  const isDegraded = effectiveState === 'degraded' && !isRebuilding
  const isFailed = effectiveState === 'failed'
  const isRetrying = effectiveState === 'retrying'
  return { effectiveState, liveState, isRebuilding, isDegraded, isFailed, isRetrying }
}

// Color semantics (RaidCard.vue statusColor L100-105): degraded/failed→danger, rebuilding→info, retrying→warning, else ok.
export function raidSeverity(f: RaidStateFlags): RaidSeverity {
  if (f.isDegraded || f.isFailed) return 'danger'
  if (f.isRebuilding) return 'info'
  if (f.isRetrying) return 'warning'
  return 'ok'
}

// Label key (RaidCard.vue statusLabel L106-112). isDegraded is already mutually exclusive with rebuilding, so this order is safe.
export function raidStateLabelKey(f: RaidStateFlags): string {
  if (f.isDegraded) return 'raidStateDegraded'
  if (f.isRebuilding) return 'raidStateRebuilding'
  if (f.isFailed) return 'raidStateFailed'
  if (f.isRetrying) return 'raidStateRetrying'
  return 'raidStateHealthy'
}

// RaidCard.vue activeDisks L114-118: with members, prefix-match "active sync"; when members is empty fall back to total (member_disks count).
export function countActiveDisks(members: RaidMemberDisk[], total: number): number {
  const list = members || []
  if (list.length) return list.filter((m) => (m?.state || '').startsWith('active sync')).length
  return total || 0
}

export interface MemberSquare {
  kind: 'ok' | 'fail' | 'rebuild' | 'unknown'
  token: string // theme token (without var()); the template wraps it in var()
  labelKey: string
  glyph: string
}

// memberSquare only serves RaidCard's small member squares (verbatim port of Vue2 RaidCard.vue
// memberSquares L125-136). **Do not use it to render the detail page's text-labeled member rows** ——
// detail rows go through memberRow below.
//
// Originally this one function fed both places (the original comment said "RaidCard.vue memberSquares +
// RaidDetailPanel memberColor/memberStateLabel"), but Vue2 uses two functions with **different
// mappings** on these two surfaces: the card squares lump removed and faulty together as fail (red),
// while the detail rows only mark faulty red and let removed fall to the gray fallback showing the raw
// state string. Merging them into one function necessarily distorts one surface —— in practice the
// detail rows: an empty slot (removed, empty path) got labeled "faulty", so a 3-disk array with 1 bad
// disk read as 2 bad disks (found in on-device acceptance 2026-07-28).
//
// The default branch deliberately diverges from Vue2 (unknown state does not masquerade as ok): Vue2's default falls to "ok ✓"; here it is a neutral 'unknown' state, which is safer.
export function memberSquare(state: string): MemberSquare {
  const s = state || ''
  if (s.startsWith('active sync')) return { kind: 'ok', token: '--sem-fg', labelKey: 'raidMemberActive', glyph: '✓' }
  if (s === 'faulty' || s === 'removed') return { kind: 'fail', token: '--remove-fg', labelKey: 'raidMemberFaulty', glyph: '✕' }
  if (s.includes('rebuilding')) return { kind: 'rebuild', token: '--accent', labelKey: 'raidMemberRebuilding', glyph: '↻' }
  return { kind: 'unknown', token: '--fg-muted', labelKey: '', glyph: '•' }
}

export interface MemberRow {
  token: string // theme token (without var()); the template wraps it in var()
  labelKey: string // empty string = no matching label; caller falls back to the raw state string
}

// Color + label for detail-page member rows, verbatim port of Vue2 RaidDetailPanel.vue
// memberColor L343-350 / memberStateLabel L351-357:
//   active sync* → green / "active"      faulty → red / "faulty"
//   *rebuilding* → blue / "rebuilding"   others → gray / raw state string
//
// The only deliberate deviation from Vue2: removed (vacated array slot) is shown in Vue2 as the
// untranslated raw lowercase English string "removed". That is a missing i18n key, not copied ——
// here it gets the raidMemberRemoved label. The color stays the gray fallback, same as Vue2.
export function memberRow(state: string): MemberRow {
  const s = state || ''
  if (s.startsWith('active sync')) return { token: '--sem-fg', labelKey: 'raidMemberActive' }
  if (s === 'faulty') return { token: '--remove-fg', labelKey: 'raidMemberFaulty' }
  if (s.includes('rebuilding')) return { token: '--accent', labelKey: 'raidMemberRebuilding' }
  if (s === 'removed') return { token: '--fg-muted', labelKey: 'raidMemberRemoved' }
  return { token: '--fg-muted', labelKey: '' }
}

// RaidCard.vue usagePercent L139-144: nonzero <1% is clamped to 1, then rounded.
export function raidUsagePercent(used: number, total: number): number {
  if (!total || total <= 0) return 0
  const pct = (used / total) * 100
  if (pct > 0 && pct < 1) return 1
  return Math.round(pct)
}

// RaidDetailPanel mirrorPairs L291-307: group by floor(number/2), set-A first.
export function mirrorPairs(members: RaidMemberDisk[]): RaidMemberDisk[][] {
  const groups = new Map<number, RaidMemberDisk[]>()
  for (const m of members || []) {
    const key = Math.floor((Number(m?.number) || 0) / 2)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(m)
  }
  return [...groups.keys()].sort((a, b) => a - b).map((k) =>
    groups.get(k)!.slice().sort((a, b) => {
      const aA = (a.state || '').includes('set-A') ? 0 : 1
      const bA = (b.state || '').includes('set-A') ? 0 : 1
      return aA - bA
    }),
  )
}

export function isRebuildingList(flags: Array<Pick<RaidStateFlags, 'isRebuilding'>>): boolean {
  return (flags || []).some((f) => f.isRebuilding)
}

// Static per-level info. Values ported verbatim from RaidDetailPanel.vue L267-290 (levelFaultTolerance/ReadSpeed/WriteSpeed)
// and raidUtils.js RAID_LEVELS (L1-76, including level 10); descKey goes through i18n.
export interface RaidLevelInfo {
  name: string          // 'RAID 0'..'RAID 10'
  faultToleranceKey: string
  readSpeedKey: string
  writeSpeedKey: string
  descKey: string
}
// TODO(implementation step): convert the tolerance/read/write copy from RaidDetailPanel.vue L267-290 and the name/desc
// from raidUtils RAID_LEVELS verbatim into i18n keys (raidLevel0Tolerance etc.) and fill the table below. 0/1/5/6 required; 10 comes from raidUtils.
export const RAID_LEVEL_INFO: Record<number, RaidLevelInfo> = {
  0: { name: 'RAID 0', faultToleranceKey: 'raidLevel0Tolerance', readSpeedKey: 'raidLevel0Read', writeSpeedKey: 'raidLevel0Write', descKey: 'raidLevel0Desc' },
  1: { name: 'RAID 1', faultToleranceKey: 'raidLevel1Tolerance', readSpeedKey: 'raidLevel1Read', writeSpeedKey: 'raidLevel1Write', descKey: 'raidLevel1Desc' },
  5: { name: 'RAID 5', faultToleranceKey: 'raidLevel5Tolerance', readSpeedKey: 'raidLevel5Read', writeSpeedKey: 'raidLevel5Write', descKey: 'raidLevel5Desc' },
  6: { name: 'RAID 6', faultToleranceKey: 'raidLevel6Tolerance', readSpeedKey: 'raidLevel6Read', writeSpeedKey: 'raidLevel6Write', descKey: 'raidLevel6Desc' },
  10: { name: 'RAID 10', faultToleranceKey: 'raidLevel10Tolerance', readSpeedKey: 'raidLevel10Read', writeSpeedKey: 'raidLevel10Write', descKey: 'raidLevel10Desc' },
}
export function levelInfo(level: number): RaidLevelInfo | null {
  return RAID_LEVEL_INFO[level] ?? null
}

// ── Disk-replacement dashboard task ───────────────────────────────────────────────────────
// The backend replace-disk endpoint is synchronous with no task_id (see the note at replaceTask in storage.ts),
// so this task state is maintained by the frontend; completion is decided by checking status.members.
export interface ReplaceTask {
  arrayId: string
  arrayName: string
  oldPath: string
  newPath: string
}

export type ReplaceOutcome = 'gone' | 'pending' | 'rebuilding' | 'done'

// replaceOutcome —— which step the replacement task is at right now.
//   gone       array no longer in the list (deleted/removed); dashboard should be dismissed, no completion reported
//   pending    can't tell yet: status unavailable, or the new disk hasn't appeared in the member table
//              (after mdadm --add the kernel hasn't registered it as spare / hasn't started recovery)
//   rebuilding new disk is in place and syncing
//   done       new disk is active sync —— this **replacement** is finished
//
// The decision watches "the new disk's own member state", not array-level health: the array may still be
// degraded because **another** disk is also bad; that is a separate failure and must not keep this
// replacement's dashboard spinning forever.
export function replaceOutcome(
  task: ReplaceTask,
  status: { members?: RaidMemberDisk[] } | null | undefined,
  arrayExists: boolean,
): ReplaceOutcome {
  if (!arrayExists) return 'gone'
  if (!status) return 'pending'
  const m = (status.members || []).find((x) => x?.path === task.newPath)
  if (!m) return 'pending'
  const s = m.state || ''
  if (s.startsWith('active sync')) return 'done'
  if (s.includes('rebuilding')) return 'rebuilding'
  return 'pending'
}

// slotMembers —— keep only members occupying an array slot, in ascending slot order.
//
// When degraded, mdadm reports 4 rows for a 3-disk RAID 5: one for the vacated slot (removed) and one
// for the faulty disk kicked out of it. Any display where "one square represents one slot" must filter
// by slot, or it renders more squares than the array actually has —— the card once showed 4 squares
// (two of them red ✕) while also saying "online disks 2/3", a self-contradicting denominator on the
// same card (on-device acceptance 2026-07-30).
//
// The slot field was only added to the backend on 2026-07-30. Older backends lack it → the filter result
// is empty → fall back to all members, preserving the pre-field behavior instead of rendering 0 squares.
export function slotMembers(members: RaidMemberDisk[]): RaidMemberDisk[] {
  const list = members || []
  const withSlot = list.filter((m) => typeof m?.slot === 'number' && (m.slot as number) >= 0)
  if (!withSlot.length) return list
  return withSlot.slice().sort((a, b) => (a.slot as number) - (b.slot as number))
}

// memberDiskCount —— the real disk count (rows with a device path).
// An empty-slot placeholder row has no device path and is not a disk; using the total row count as
// "member disk count" would show a 3-disk array as 4 when degraded (the detail header once read MEMBER DISKS (4)).
export function memberDiskCount(members: RaidMemberDisk[]): number {
  return (members || []).filter((m) => !!m?.path).length
}

// ── Merging the vacated slot with the ejected bad disk ────────────────────────────────────────────
// mdadm reports one disk failure as two records: --fail **immediately** kicks the disk out of its slot,
// producing a removed placeholder row (that slot now has no disk); the ejected disk itself is still
// attached to the array as a separate row with `-` in the RaidDevice column. The two rows describe two
// sides of the same event; showing them separately makes a 3-disk array look like 4 disks.
//
// Merging requires knowing "which slot this bad disk used to occupy", and mdadm does **not** provide it:
// the bad disk row's Number is a device number, not the slot it vacated (measured: sdd occupied slot 0,
// Number was 4). So merge only when the pairing is unique —— exactly 1 empty slot + 1 ejected bad disk.
// With RAID 6 losing two disks at once there is no way to tell who vacated which slot, so keep separate
// rows: a few extra rows beat a wrong slot number.
export interface MemberRowView {
  path: string
  state: string
  number: number
  slot?: number
  rebuild_pct?: number
  // vacatedSlot: the empty slot number merged into this row —— i.e. "the slot this bad disk vacated".
  // Present only on merged rows; undefined on unmerged rows.
  vacatedSlot?: number
}

export function mergeVacatedSlot(members: RaidMemberDisk[]): MemberRowView[] {
  const list = (members || []) as MemberRowView[]
  const vacatedIdx = list.findIndex((m) => !m?.path && m?.state === 'removed')
  const ejectedIdx = list.findIndex(
    (m) => !!m?.path && m?.state === 'faulty' && typeof m?.slot === 'number' && (m.slot as number) < 0,
  )
  // The pairing must be unique: a second entry on either side means no merge
  const vacatedCount = list.filter((m) => !m?.path && m?.state === 'removed').length
  const ejectedCount = list.filter(
    (m) => !!m?.path && m?.state === 'faulty' && typeof m?.slot === 'number' && (m.slot as number) < 0,
  ).length
  if (vacatedIdx < 0 || ejectedIdx < 0 || vacatedCount !== 1 || ejectedCount !== 1) return list.slice()

  const vacated = list[vacatedIdx]
  const ejected = list[ejectedIdx]
  // Place the merged row at the **empty slot's original position** so the list keeps slot order (the bad-disk row was originally at the end of the table)
  return list
    .filter((_, i) => i !== ejectedIdx)
    .map((m, i) => (i === (vacatedIdx > ejectedIdx ? vacatedIdx - 1 : vacatedIdx)
      ? { ...ejected, vacatedSlot: vacated.slot }
      : m))
}
