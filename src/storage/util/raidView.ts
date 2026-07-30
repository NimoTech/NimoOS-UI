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

// memberSquare 只服务 RaidCard 的成员小方块(逐字对应 Vue2 RaidCard.vue
// memberSquares L125-136)。**不要用它渲染详情页带文字标签的成员行** —— 详情行
// 走下面的 memberRow。
//
// 起初这一个函数同时喂了两处(注释原文写着"RaidCard.vue memberSquares +
// RaidDetailPanel memberColor/memberStateLabel"),但 Vue2 在这两个面上用的是两个
// **映射不同**的函数:卡片方块把 removed 与 faulty 同归 fail(红),详情行只把
// faulty 判红、removed 落到灰色兜底并原样显示状态串。合成一个函数就必然在其中
// 一面失真 —— 实际失真在详情行:空槽位(removed,path 为空)被标成「故障」,
// 3 盘阵列坏 1 块时读起来像坏了 2 块(2026-07-28 实盘验收发现)。
//
// 默认分支有意区别于 Vue2(未知态不伪装成 ok):Vue2 default 落到 "ok ✓",这里改为 'unknown' 中性态,更安全。
export function memberSquare(state: string): MemberSquare {
  const s = state || ''
  if (s.startsWith('active sync')) return { kind: 'ok', token: '--sem-fg', labelKey: 'raidMemberActive', glyph: '✓' }
  if (s === 'faulty' || s === 'removed') return { kind: 'fail', token: '--remove-fg', labelKey: 'raidMemberFaulty', glyph: '✕' }
  if (s.includes('rebuilding')) return { kind: 'rebuild', token: '--accent', labelKey: 'raidMemberRebuilding', glyph: '↻' }
  return { kind: 'unknown', token: '--fg-muted', labelKey: '', glyph: '•' }
}

export interface MemberRow {
  token: string // theme token(不含 var());模板里包 var()
  labelKey: string // 空串 = 无对应文案,调用方回退原始 state 串
}

// 详情页成员行的颜色 + 文案,逐字对应 Vue2 RaidDetailPanel.vue
// memberColor L343-350 / memberStateLabel L351-357:
//   active sync* → 绿 / "活动"      faulty → 红 / "故障"
//   *rebuilding* → 蓝 / "重建中"    其余   → 灰 / 原样 state 串
//
// 与 Vue2 的唯一有意偏离:removed(阵列槽位空置)在 Vue2 里显示未翻译的原始
// 英文小写串 "removed"。那是 i18n 漏项,不照抄 —— 这里给它 raidMemberRemoved
// 文案。颜色仍是灰色兜底,与 Vue2 一致。
export function memberRow(state: string): MemberRow {
  const s = state || ''
  if (s.startsWith('active sync')) return { token: '--sem-fg', labelKey: 'raidMemberActive' }
  if (s === 'faulty') return { token: '--remove-fg', labelKey: 'raidMemberFaulty' }
  if (s.includes('rebuilding')) return { token: '--accent', labelKey: 'raidMemberRebuilding' }
  if (s === 'removed') return { token: '--fg-muted', labelKey: 'raidMemberRemoved' }
  return { token: '--fg-muted', labelKey: '' }
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

// ── 换盘看板任务 ───────────────────────────────────────────────────────
// 后端换盘接口是同步的、没有 task_id(见 storage.ts replaceTask 处的说明),
// 所以这份任务态由前端维护,完成判定靠核对 status.members。
export interface ReplaceTask {
  arrayId: string
  arrayName: string
  oldPath: string
  newPath: string
}

export type ReplaceOutcome = 'gone' | 'pending' | 'rebuilding' | 'done'

// replaceOutcome —— 换盘任务此刻处于哪一步。
//   gone       阵列已不在列表里(被删/被卸),看板该撤掉,不报完成
//   pending    还看不出来:status 拉不到,或新盘尚未出现在成员表
//              (mdadm --add 后内核尚未把它登记为 spare / 尚未开始 recovery)
//   rebuilding 新盘已就位、正在同步
//   done       新盘已 active sync —— 这一次**替换**完成了
//
// 判定盯的是"新盘自己的成员态",不是阵列级健康度:阵列可能因为**另一块**盘也坏了
// 而仍然 degraded,那属于另一个故障,不该让这次替换的看板永远转下去。
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

// slotMembers —— 只保留占阵列槽位的成员,按槽位升序。
//
// 降级时 mdadm 对一个 3 盘 RAID 5 报 4 行:腾空的槽位(removed)与被踢出槽位的
// 故障盘(faulty)各一条。任何"一个方块代表一个盘位"的展示都必须按槽位过滤,
// 否则会渲染出比阵列实际盘位更多的方块 —— 卡片曾出现 4 个方块(其中两个红 ✕)
// 却同时写着「在线磁盘 2/3」,同一张卡上分母自相矛盾(2026-07-30 实盘验收)。
//
// slot 字段 2026-07-30 才加入后端。老后端不带它 → 过滤结果为空 → 退回全体成员,
// 保持加字段之前的行为,而不是渲染成 0 个方块。
export function slotMembers(members: RaidMemberDisk[]): RaidMemberDisk[] {
  const list = members || []
  const withSlot = list.filter((m) => typeof m?.slot === 'number' && (m.slot as number) >= 0)
  if (!withSlot.length) return list
  return withSlot.slice().sort((a, b) => (a.slot as number) - (b.slot as number))
}

// memberDiskCount —— 真正的盘数(有设备路径的行)。
// 空槽位占位行没有设备路径,它不是一块盘;拿总行数当"成员磁盘数"会把 3 盘阵列
// 在降级时显示成 4 块(详情页表头曾写 MEMBER DISKS (4))。
export function memberDiskCount(members: RaidMemberDisk[]): number {
  return (members || []).filter((m) => !!m?.path).length
}
