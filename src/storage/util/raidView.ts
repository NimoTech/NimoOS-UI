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

// list() 返回 RaidStatus[](索引签名透传 id/name/level 等);收窄为 RaidArray。
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

// 逐字移植 RaidCard.vue 状态计算(L82-92)。
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

// 颜色语义(RaidCard.vue statusColor L100-105):degraded/failed→danger,rebuilding→info,retrying→warning,else ok。
export function raidSeverity(f: RaidStateFlags): RaidSeverity {
  if (f.isDegraded || f.isFailed) return 'danger'
  if (f.isRebuilding) return 'info'
  if (f.isRetrying) return 'warning'
  return 'ok'
}

// 文案 key(RaidCard.vue statusLabel L106-112)。isDegraded 已互斥重建,故此序安全。
export function raidStateLabelKey(f: RaidStateFlags): string {
  if (f.isDegraded) return 'raidStateDegraded'
  if (f.isRebuilding) return 'raidStateRebuilding'
  if (f.isFailed) return 'raidStateFailed'
  if (f.isRetrying) return 'raidStateRetrying'
  return 'raidStateHealthy'
}

// RaidCard.vue activeDisks L114-118:有 members 时前缀匹配 "active sync";members 为空则回退 total(member_disks 计数)。
export function countActiveDisks(members: RaidMemberDisk[], total: number): number {
  const list = members || []
  if (list.length) return list.filter((m) => (m?.state || '').startsWith('active sync')).length
  return total || 0
}

export interface MemberSquare {
  kind: 'ok' | 'fail' | 'rebuild' | 'unknown'
  token: string // theme token(不含 var());模板里包 var()
  labelKey: string
  glyph: string
}

// RaidCard.vue memberSquares L125-136 + RaidDetailPanel memberColor/memberStateLabel L343-375。
// 默认分支有意区别于 Vue2(未知态不伪装成 ok):Vue2 default 落到 "ok ✓",这里改为 'unknown' 中性态,更安全。
export function memberSquare(state: string): MemberSquare {
  const s = state || ''
  if (s.startsWith('active sync')) return { kind: 'ok', token: '--sem-fg', labelKey: 'raidMemberActive', glyph: '✓' }
  if (s === 'faulty' || s === 'removed') return { kind: 'fail', token: '--remove-fg', labelKey: 'raidMemberFaulty', glyph: '✕' }
  if (s.includes('rebuilding')) return { kind: 'rebuild', token: '--accent', labelKey: 'raidMemberRebuilding', glyph: '↻' }
  return { kind: 'unknown', token: '--fg-muted', labelKey: '', glyph: '•' }
}

// RaidCard.vue usagePercent L139-144:非零 <1% 夹为 1,再 round。
export function raidUsagePercent(used: number, total: number): number {
  if (!total || total <= 0) return 0
  const pct = (used / total) * 100
  if (pct > 0 && pct < 1) return 1
  return Math.round(pct)
}

// RaidDetailPanel mirrorPairs L291-307:按 floor(number/2) 分组,set-A 在前。
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

// 级别静态信息。值逐字移植自 RaidDetailPanel.vue L267-290(levelFaultTolerance/ReadSpeed/WriteSpeed)
// 与 raidUtils.js RAID_LEVELS(L1-76,含 level 10);descKey 走 i18n。
export interface RaidLevelInfo {
  name: string          // 'RAID 0'..'RAID 10'
  faultToleranceKey: string
  readSpeedKey: string
  writeSpeedKey: string
  descKey: string
}
// TODO(实现步):把 RaidDetailPanel.vue L267-290 的 tolerance/read/write 文案、raidUtils RAID_LEVELS 的 name/desc
// 逐字转成 i18n key(raidLevel0Tolerance 等),填入下表。0/1/5/6 必填;10 从 raidUtils 补。
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
