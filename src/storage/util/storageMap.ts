// /v1/storage children 的 size/avail/used 是字符串(2026-07-23 真机核实),必须显式 Number()。
// usePercent 公式与 Vue2 StorageManagerPanel 逐字一致,保证迁移前后读数不变。

export interface StorageVolume {
  uuid: string
  name: string
  isSystem: boolean
  fsType: string
  size: number
  availSize: number
  usedSize: number
  usePercent: number
  driveName: string
  path: string
  mountPoint: string
  disk: string
}

export interface PhysicalDrive {
  name: string
  model: string
  size: number
  diskType: string
  healthy: boolean
  temperature: number
}

interface RawChild {
  uuid?: string
  label?: string
  type?: string
  size?: unknown
  avail?: unknown
  path?: string
  drive_name?: string
  mount_point?: string
}
interface RawGroup { path?: string; disk_name?: string; children?: RawChild[] }

export function mapVolumes(groups: unknown, raidMountPoints: Set<string> = new Set()): StorageVolume[] {
  const arr = Array.isArray(groups) ? (groups as RawGroup[]) : []
  const flat: Array<RawChild & { _disk: string; _diskName: string }> = []
  for (const g of arr) {
    for (const c of g?.children || []) {
      if (raidMountPoints.has(c?.mount_point || '')) continue // RAID 卷归 /storage/raid(P3)
      flat.push({ ...c, _disk: g?.path || '', _diskName: g?.disk_name || '' })
    }
  }
  // Vue2 orderBy(['diskName','label'],['desc','asc']):System 组排最前
  flat.sort((a, b) => {
    if (a._diskName !== b._diskName) return a._diskName < b._diskName ? 1 : -1
    const la = a.label || ''
    const lb = b.label || ''
    return la < lb ? -1 : la > lb ? 1 : 0
  })
  return flat.map((c) => {
    const size = Number(c.size) || 0
    const avail = Number(c.avail) || 0
    return {
      uuid: c.uuid || '',
      name: c.label || c.drive_name || '',
      isSystem: c._diskName === 'System',
      fsType: c.type || '',
      size,
      availSize: avail,
      usedSize: Math.max(0, size - avail),
      usePercent: size > 0 ? 100 - Math.floor((avail * 100) / size) : 0,
      driveName: c.drive_name || '',
      path: c.path || '',
      mountPoint: c.mount_point || '',
      disk: c._disk,
    }
  })
}

interface RawDisk {
  name?: string
  model?: string
  size?: unknown
  disk_type?: string
  health?: unknown
  temperature?: unknown
}

export function mapDrives(disks: unknown): PhysicalDrive[] {
  const arr = Array.isArray(disks) ? (disks as RawDisk[]) : []
  return arr.map((d) => ({
    name: d.name || '',
    model: d.model || '',
    size: Number(d.size) || 0,
    diskType: d.disk_type || '',
    // 后端 health 是字符串 "true"/"false";严格比较,避免 "false" 被当真值(Vue2 隐患)
    healthy: d.health === true || d.health === 'true',
    temperature: Number(d.temperature) || 0,
  }))
}

// 与 Vue2 mixin getProgressType 阈值一致
export function usageLevel(pct: number): 'ok' | 'warn' | 'danger' {
  if (pct < 80) return 'ok'
  if (pct < 90) return 'warn'
  return 'danger'
}

export function toFahrenheit(c: number): string {
  return (32 + c * 1.8).toFixed(1)
}

// disk_type/health/temperature/power_on_time 保留后端 /v1/disks 的原文命名(不改成 camelCase):
// RAID 选盘卡片那条链路的 RaidDisk 是逐字对齐 Vue2 的读法(disk.disk_type / disk.health / …),
// 保持同名才能让 AvailDisk 直接结构化赋值给 RaidDisk(StorageRaidCreate.vue 的 candidateDisks)。
export interface AvailDisk {
  path: string
  name: string
  model: string
  size: number
  needFormat: boolean
  serial: string
  disk_type: string
  health: string
  temperature: number
  power_on_time: number
}

interface RawAvail {
  path?: string
  name?: string
  model?: string
  size?: unknown
  need_format?: unknown
  serial?: string
  disk_type?: string
  health?: unknown
  temperature?: unknown
  power_on_time?: unknown
}

// GET /v1/disks 响应的 avail 字段 → 创建存储候选盘 / RAID 选盘卡片。
// need_format 同 health:后端可能给字符串 "true"/"false",严格判定。
//
// ⚠️ 第二参数 disks = 同一响应里的 data.disks,用来按 path 补齐 health(以及 avail 万一缺的
// temperature/power_on_time)。原因:后端 route/v1/disk.go:152-157 把 disk **值拷贝** append
// 进 avail,而 disk.Health = strconv.FormatBool(...) 在那之后才执行 →
// **avail 里每块盘的 health 恒为空串 ""**(2026-07-30 真机 curl 逐字核实:
// avail[*].health="" 而 disks 里同一块 sda 是 "true")。同一块物理盘在两个列表里都在、path 相同,
// 所以前端在同一份响应内就能把真实 SMART 结论接上,不必等后端修。后端票已登记在
// vue3-migration-roadmap.md §4 SP6 台账 B-bis。补不上时保留 avail 原值(空串 = 结论未知,不伪造健康)。
export function mapAvailDisks(avail: unknown, disks?: unknown): AvailDisk[] {
  const arr = Array.isArray(avail) ? (avail as RawAvail[]) : []
  const byPath = new Map<string, RawAvail>()
  if (Array.isArray(disks)) {
    for (const d of disks as RawAvail[]) {
      if (d && d.path) byPath.set(d.path, d)
    }
  }
  return arr.map((d) => {
    const full = (d.path && byPath.get(d.path)) || undefined
    const health = String(d.health ?? '') || String(full?.health ?? '')
    return {
      path: d.path || '',
      name: d.name || '',
      model: d.model || '',
      size: Number(d.size) || 0,
      needFormat: d.need_format === true || d.need_format === 'true',
      serial: d.serial || '',
      disk_type: d.disk_type || full?.disk_type || '',
      health,
      temperature: Number(d.temperature) || Number(full?.temperature) || 0,
      power_on_time: Number(d.power_on_time) || Number(full?.power_on_time) || 0,
    }
  })
}
