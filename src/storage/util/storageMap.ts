// /v1/storage children's size/avail/used are strings (confirmed on real hardware 2026-07-23) — must call Number() explicitly.
// The usePercent formula matches Vue2 StorageManagerPanel byte-for-byte, so the displayed reading doesn't change across the migration.

import type { DiskRaidInfo } from '@nimotech/nimoos-service'

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

// Partition row (/v1/disks children[]): mount_point/used_bytes were added 2026-08, present only when mounted.
export interface DriveChild {
  name: string
  format: string
  size: number
  usedBytes: number
  mountPoint: string
}

export interface PhysicalDrive {
  name: string
  model: string
  size: number
  diskType: string
  healthy: boolean
  temperature: number
  // health raw value ("true"/"false", empty "" when both are missing). Detail page shows three states (healthy/damaged/unknown)
  // Must be compared strictly as a string, never truthy-checked — "false" is truthy (Vue2 used to show a bad drive as healthy because of this).
  health: string
  serial: string
  path: string
  diskById: string
  powerOnHours: number
  children: DriveChild[]
  // Backend raid object is passed through as-is (field names keep the /v1/disks original naming; see DiskRaidInfo in the service package).
  // ⚠️ array_name/created_at/updated_at come from the on-disk mdadm superblock and are untrusted text —
  // only ever render via template interpolation, never concatenate into HTML.
  raid: DiskRaidInfo | null
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
      if (raidMountPoints.has(c?.mount_point || '')) continue // RAID volumes belong to /storage/raid
      flat.push({ ...c, _disk: g?.path || '', _diskName: g?.disk_name || '' })
    }
  }
  // Vue2 orderBy(['diskName','label'],['desc','asc']): the System group sorts first
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

interface RawDiskChild {
  name?: string
  format?: string
  size?: unknown
  mount_point?: string
  used_bytes?: unknown
}

interface RawDisk {
  name?: string
  model?: string
  size?: unknown
  disk_type?: string
  health?: unknown
  temperature?: unknown
  serial?: string
  path?: string
  disk_by_id?: string
  power_on_time?: unknown
  children?: RawDiskChild[]
  raid?: DiskRaidInfo
}

export function mapDrives(disks: unknown): PhysicalDrive[] {
  const arr = Array.isArray(disks) ? (disks as RawDisk[]) : []
  return arr.map((d) => ({
    name: d.name || '',
    model: d.model || '',
    size: Number(d.size) || 0,
    diskType: d.disk_type || '',
    // Backend health is the string "true"/"false"; compare strictly to avoid "false" being treated as truthy (Vue2 pitfall)
    healthy: d.health === true || d.health === 'true',
    health: typeof d.health === 'string' ? d.health : d.health === true ? 'true' : '',
    temperature: Number(d.temperature) || 0,
    serial: d.serial || '',
    path: d.path || '',
    diskById: d.disk_by_id || '',
    powerOnHours: Number(d.power_on_time) || 0,
    children: (Array.isArray(d.children) ? d.children : []).map((c) => ({
      name: c?.name || '',
      format: c?.format || '',
      size: Number(c?.size) || 0,
      usedBytes: Number(c?.used_bytes) || 0,
      mountPoint: c?.mount_point || '',
    })),
    raid: d.raid ?? null,
  }))
}

// Matches the thresholds in the Vue2 mixin getProgressType
export function usageLevel(pct: number): 'ok' | 'warn' | 'danger' {
  if (pct < 80) return 'ok'
  if (pct < 90) return 'warn'
  return 'danger'
}

export function toFahrenheit(c: number): string {
  return (32 + c * 1.8).toFixed(1)
}

// disk_type/health/temperature/power_on_time keep the backend /v1/disks original naming (not renamed to camelCase):
// the RaidDisk type on the RAID drive-picker card path reads fields exactly like Vue2 does (disk.disk_type / disk.health / …),
// keeping the same names lets AvailDisk be assigned straight into RaidDisk by structural typing (candidateDisks in StorageRaidCreate.vue).
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
  // Leftover superblocks from a foreign array (role:"residue") are passed through as-is: the drive-picker UI shows a warning badge, and create/replace-drive requests
  // use this to decide wipe_raid_residue. Local members (role:"member") are already excluded from avail by the backend.
  raid?: DiskRaidInfo | null
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
  raid?: DiskRaidInfo
}

// The avail field from the GET /v1/disks response → storage-creation candidate drives / RAID drive-picker card.
// need_format works like health: the backend may send the string "true"/"false", so compare strictly.
//
// ⚠️ The second argument, disks, is data.disks from the same response, used to backfill health by path (and
// temperature/power_on_time for the rare case avail is missing them). Reason: backend route/v1/disk.go:152-157
// appends a **value copy** of disk into avail, and disk.Health = strconv.FormatBool(...) only runs after that →
// **health for every drive in avail is always the empty string ""** (confirmed byte-for-byte with curl on real
// hardware 2026-07-30: avail[*].health="" while the same sda in disks is "true"). The same physical drive
// appears in both lists with the same path, so the frontend can attach the real SMART verdict within a single
// response without waiting for a backend fix. The backend ticket is logged in
// vue3-migration-roadmap.md §4 SP6 ledger B-bis. When it can't be backfilled, keep the avail value as-is (empty string = verdict unknown — never fabricate a healthy status).
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
      raid: d.raid ?? full?.raid ?? null,
    }
  })
}
