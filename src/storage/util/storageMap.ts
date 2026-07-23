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
