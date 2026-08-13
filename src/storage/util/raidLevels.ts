// Ported verbatim from NimoOS-UI/src/utils/raidUtils.js (P4); the failure simulator survival()/rebuildable() is deferred.
// Migration scope: RAID_LEVELS (min/tolerance/read/write/cost/desc/usecase/capacity()/layout(), raidUtils.js:1-76),
// recommendRaidLevel (raidUtils.js:158-166), isDiskAtRisk (raidUtils.js:108-110).
// Mixed-spec group coloring (groupDisksBySpec L148-156 + assignGroupColors/GROUP_COLOR_COUNT L168-178) is reworked into
// groupColorKey: it outputs group semantic keys ('group-a'..'group-e'), never literal colors —— the component layer maps them to --nrm-*/--accent etc. tokens.
// Not migrated (deliberately deferred, failure simulator): survival(), rebuildable().

// Local minimal disk view type, aligned with the Vue2 disk.path/size/disk_type/health/temperature/power_on_time/model reads
// (raidView.ts exports no equivalent type). Field names keep the backend /v1/disks originals so AvailDisk is structurally assignable.
export interface RaidDisk {
  path: string
  size: number
  disk_type?: string
  health?: string
  temperature?: number
  power_on_time?: number
  model?: string
}

export type RaidRole = 'data' | 'mirror' | 'parity' | 'parity2'

export interface RaidLevelSpec {
  id: number
  name: string
  min: number
  tolerance: string
  read: number
  write: number
  cost: number
  desc: string
  usecase: string
  capacity: (n: number, sizeBytes: number) => number
  layout: (n: number) => RaidRole[]
}

export const RAID_LEVELS: RaidLevelSpec[] = [
  {
    id: 0,
    name: 'RAID 0',
    min: 2,
    // Vue2's original tolerance is the number 0 (raidUtils.js:4).
    tolerance: '0',
    read: 5,
    write: 5,
    cost: 5,
    desc: 'RAID 0 Description',
    usecase: 'Video scratch disks, caches, render farms',
    capacity: (n, s) => n * s,
    layout: (n) => Array.from({ length: n }, () => 'data'),
  },
  {
    id: 1,
    name: 'RAID 1',
    min: 2,
    // Vue2's original tolerance is the function (n) => n - 1 (raidUtils.js:15).
    tolerance: 'n-1',
    read: 4,
    write: 2,
    cost: 1,
    desc: 'RAID 1 Description',
    usecase: 'Photo library, personal NAS, boot volumes',
    capacity: (_n, s) => s,
    layout: (n) => Array.from({ length: n }, (_, i) => (i === 0 ? 'data' : 'mirror')),
  },
  {
    id: 5,
    name: 'RAID 5',
    min: 3,
    tolerance: '1',
    read: 4,
    write: 3,
    cost: 3,
    desc: 'RAID 5 Description',
    usecase: 'General NAS, media servers, small business',
    capacity: (n, s) => Math.max(0, (n - 1) * s),
    layout: (n) => Array.from({ length: n }, (_, i) => (i === n - 1 ? 'parity' : 'data')),
  },
  {
    id: 6,
    name: 'RAID 6',
    min: 4,
    tolerance: '2',
    read: 4,
    write: 2,
    cost: 3,
    desc: 'RAID 6 Description',
    usecase: 'Large arrays, archives, anything important',
    capacity: (n, s) => Math.max(0, (n - 2) * s),
    layout: (n) =>
      Array.from({ length: n }, (_, i) => (i === n - 1 ? 'parity' : i === n - 2 ? 'parity2' : 'data')),
  },
  {
    id: 10,
    name: 'RAID 10',
    min: 4,
    // Vue2's original tolerance is the string 'half' (raidUtils.js:50).
    tolerance: 'half',
    read: 5,
    write: 4,
    cost: 2,
    desc: 'RAID 10 Description',
    usecase: 'Databases, virtualization, heavy-write loads',
    capacity: (n, s) => Math.floor(n / 2) * s,
    layout: (n) => {
      const pairs = Math.floor(n / 2)
      const arr: RaidRole[] = []
      for (let p = 0; p < pairs; p++) {
        arr.push('data')
        arr.push('mirror')
      }
      return arr
    },
  },
]

// raidUtils.js:158-166, simplified to a pure disk-count decision (excludes groupDisksBySpec's mixed-spec/length checks, handled by the caller at disk-selection time).
export function recommendRaidLevel(n: number): number {
  if (n === 2) return 1
  if (n === 3) return 5
  return n % 2 === 0 ? 10 : 5
}

// ── Disk health verdict (real values of the health field, verified verbatim via on-device curl 2026-07-30) ────────────────
// The three real values from `curl -s http://127.0.0.1/v1/disks`:
//   · data.avail[*].health = ""       ← candidate-disk source for the RAID create wizard, always empty string
//   · data.disks[*].health = "true"   ← SMART passed
//   · same as above         "false"   ← SMART failed (strconv.FormatBool, always lowercase)
// avail always being empty is a backend defect: NimoOS-LocalStorage/route/v1/disk.go:152-157 appends a
// **value copy** of disk into avail, while disk.Health = strconv.FormatBool(...) runs after that, so avail gets the zero value.
// The frontend therefore backfills health by path from the disks list in mapAvailDisks (see storageMap.ts),
// so this code receives the real verdict; when backfilling fails it stays an empty string = verdict unknown.
// ⚠️ Empty string is neither "healthy" nor "at risk": it means "the backend gave no verdict". Hence three states, not binary ——
// Vue2 (raidUtils.js:108-110) has only the single `=== 'false'` check, silently treating empty as healthy; here the logic is split correctly
// (UI appearance unchanged: neither unknown nor healthy draws the risk border), per memory vue2-port-visual-only-fix-logic.
// ⚠️ Do not "casually" mix in the service/disk.go representation (Health="OK" passed / "" failed): there the empty string
// means the exact opposite, and it does not flow through /v1/disks, so it is outside this component's data contract.
export type DiskHealthState = 'good' | 'bad' | 'unknown'

export function diskHealthState(disk: RaidDisk): DiskHealthState {
  if (disk.health === 'false') return 'bad'
  if (disk.health === 'true') return 'good'
  return 'unknown'
}

export function isDiskAtRisk(disk: RaidDisk): boolean {
  return diskHealthState(disk) === 'bad'
}

// ── Health info display (verbatim port of Vue2 raidUtils.js:112-149) ──────────────────────────────
// Purpose = the disk-selection card's regular info display (health dot on the capacity row + temperature/power-on time/health score in the tooltip),
// **unrelated to the failure simulator** —— that is another modal in RaidMatrix (survival()/rebuildable()), still out of scope.
export type HealthTone = 'good' | 'warn' | 'bad'

// raidUtils.js:112-115. On-device fake disk temperature=38 → "38°C"; missing/0/negative → "-".
export function tempDisplay(t?: number): string {
  if (t == null || t <= 0) return '-'
  return `${t}°C`
}

// raidUtils.js:117-119.
export function tempTone(t?: number): HealthTone {
  const v = t ?? 0
  return v >= 46 ? 'bad' : v >= 42 ? 'warn' : 'good'
}

// raidUtils.js:122-126. On-device fake disk power_on_time=0 → "-"; system disk 1381 → "0.2yr" (from 1000 up, converted to years by 8760).
export function pohDisplay(hours?: number): string {
  if (!hours || hours <= 0) return '-'
  if (hours < 1000) return `${hours}h`
  return `${(hours / 8760).toFixed(1)}yr`
}

// raidUtils.js:128-131.
export function pohTone(hours?: number): HealthTone {
  if (!hours) return 'good'
  return hours >= 35000 ? 'bad' : hours >= 18000 ? 'warn' : 'good'
}

// raidUtils.js:135-144. Deduct from 100: SMART failure goes straight to 0; temperature 42/46 deducts 15/30; power-on 18000/35000 deducts 15/30.
// Unknown verdict (empty string) deducts nothing —— same as Vue2: this score expresses the state reflected by
// temperature/power-on time, not the SMART verdict itself; the SMART verdict is expressed via the dot/risk-border path.
export function diskHealthScore(disk: RaidDisk): number {
  if (diskHealthState(disk) === 'bad') return 0
  let score = 100
  const temp = disk.temperature ?? 0
  const poh = disk.power_on_time ?? 0
  if (temp >= 46) score -= 30
  else if (temp >= 42) score -= 15
  if (poh >= 35000) score -= 30
  else if (poh >= 18000) score -= 15
  return Math.max(0, score)
}

// raidUtils.js:146-149.
export function diskHealthTone(score: number): HealthTone {
  if (score >= 85) return 'good'
  if (score >= 60) return 'warn'
  return 'bad'
}

// raidUtils.js groupDisksBySpec (L148-156): group key = `${size}|${disk_type}`.
export function diskSpecKey(disk: RaidDisk): string {
  return `${disk.size}|${disk.disk_type ?? ''}`
}

// Group semantic key table aligned with Vue2 assignGroupColors' GROUP_COLOR_COUNT (=5, raidUtils.js:168),
// reused cyclically; the component layer maps these keys to concrete theme tokens (e.g. --nrm-a/--nrm-b/--accent).
const GROUP_KEYS = ['group-a', 'group-b', 'group-c', 'group-d', 'group-e'] as const

// Input disk + known group list (each group identified by a key in diskSpecKey format); returns the group
// semantic key by the group's position in the list (mod 5) —— never a literal color, only a token semantic
// identifier for the component layer to map.
export function groupColorKey(disk: RaidDisk, groups: Array<{ key: string }>): string {
  const key = diskSpecKey(disk)
  const idx = groups.findIndex((g) => g.key === key)
  const safeIdx = idx < 0 ? 0 : idx
  return GROUP_KEYS[safeIdx % GROUP_KEYS.length]
}
