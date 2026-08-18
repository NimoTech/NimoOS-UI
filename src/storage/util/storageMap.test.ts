import { describe, it, expect } from 'vitest'
import { mapVolumes, mapDrives, usageLevel, toFahrenheit, mapAvailDisks } from './storageMap'

// Captured live on real hardware 2026-07-23: size/avail are strings
const LIVE_GROUPS = [
  {
    disk_name: 'System', size: 512110190592, path: '/dev/nvme0n1', type: 'nvme',
    children: [
      {
        uuid: 'da0e4da3', mount_point: '/', size: '512110190592', avail: '384614653440',
        used: '127495537152', type: 'ext4', path: '/dev/nvme0n1p7',
        drive_name: 'nvme0n1p7', label: 'NimoOS-HD',
      },
    ],
  },
  {
    disk_name: 'Storage1', size: 2000000000000, path: '/dev/sda', type: 'sata',
    children: [
      { uuid: 'aaa', mount_point: '/mnt/s1', size: '2000000000000', avail: '1000000000000', type: 'ext4', path: '/dev/sda1', drive_name: 'sda1', label: 'Storage1' },
      { uuid: 'bbb', mount_point: '/mnt/raid0', size: '100', avail: '50', type: 'ext4', path: '/dev/sda9', drive_name: 'sda9', label: 'zzz-on-raid' },
    ],
  },
]

describe('mapVolumes', () => {
  it('flattens children, converts string values to numbers, computes usage percentage', () => {
    const v = mapVolumes(LIVE_GROUPS)
    const sys = v.find((x) => x.isSystem)!
    expect(sys.name).toBe('NimoOS-HD')
    expect(sys.size).toBe(512110190592)
    expect(sys.availSize).toBe(384614653440)
    expect(sys.usedSize).toBe(512110190592 - 384614653440)
    // Matches Vue2 byte-for-byte: 100 - Math.floor(avail*100/size)
    expect(sys.usePercent).toBe(100 - Math.floor((384614653440 * 100) / 512110190592))
    expect(sys.fsType).toBe('ext4')
    expect(sys.mountPoint).toBe('/')
    expect(sys.disk).toBe('/dev/nvme0n1')
    expect(sys.driveName).toBe('nvme0n1p7')
  })
  it('isSystem only recognizes disk_name === "System"', () => {
    const v = mapVolumes(LIVE_GROUPS)
    expect(v.filter((x) => x.isSystem)).toHaveLength(1)
    expect(v.find((x) => x.name === 'Storage1')!.isSystem).toBe(false)
  })
  it('excludes RAID mount points', () => {
    const v = mapVolumes(LIVE_GROUPS, new Set(['/mnt/raid0']))
    expect(v.map((x) => x.name)).not.toContain('zzz-on-raid')
    expect(v).toHaveLength(2)
  })
  it('sorts by parent disk name desc, label asc (System first)', () => {
    const v = mapVolumes(LIVE_GROUPS)
    expect(v[0].isSystem).toBe(true)
    expect(v[1].name < (v[2]?.name ?? '￿')).toBe(true)
  })
  it('usage percentage is 0 when size is 0 or missing, never NaN', () => {
    const v = mapVolumes([{ disk_name: 'X', path: '/dev/x', children: [{ label: 'e', mount_point: '/e' }] }])
    expect(v[0].usePercent).toBe(0)
    expect(v[0].size).toBe(0)
  })
  it('returns an empty array for non-array/garbage input', () => {
    expect(mapVolumes(null)).toEqual([])
    expect(mapVolumes({ nope: 1 })).toEqual([])
  })
})

describe('mapDrives', () => {
  const LIVE_DISKS = [
    { name: 'nvme0n1', size: 512110190592, model: 'WPBSNM8-512GTP', health: 'true', temperature: 35, disk_type: 'SSD', serial: 'LP0625', path: '/dev/nvme0n1' },
  ]
  it('maps real-hardware fields', () => {
    const d = mapDrives(LIVE_DISKS)
    expect(d[0]).toMatchObject({ name: 'nvme0n1', model: 'WPBSNM8-512GTP', size: 512110190592, diskType: 'SSD', healthy: true, temperature: 35 })
  })
  it('health only recognizes true/"true" (fixes the Vue2 pitfall of treating string "false" as healthy)', () => {
    expect(mapDrives([{ health: 'false' }])[0].healthy).toBe(false)
    expect(mapDrives([{ health: true }])[0].healthy).toBe(true)
    expect(mapDrives([{}])[0].healthy).toBe(false)
  })
  it('health raw value preserves three states: string as-is, empty string when missing (detail page shows —)', () => {
    expect(mapDrives([{ health: 'true' }])[0].health).toBe('true')
    expect(mapDrives([{ health: 'false' }])[0].health).toBe('false')
    expect(mapDrives([{}])[0].health).toBe('')
  })
  it('2026-08 new fields: serial/disk_by_id/power_on_time/children (mount_point+used_bytes)/raid', () => {
    const raid = {
      role: 'member' as const, array_name: 'raid10', array_uuid: 'u', level: 'raid10',
      md_device: '/dev/md127', registered: true, active: true,
    }
    const d = mapDrives([{
      name: 'sda', path: '/dev/sda', serial: 'WD-1', disk_by_id: 'ata-WDC_WD-1', power_on_time: 2494,
      children: [{ name: 'md127', size: 2000138797056, format: 'btrfs', mount_point: '/media/RAID_raid10', used_bytes: 763134341120 }],
      raid,
    }])[0]
    expect(d.serial).toBe('WD-1')
    expect(d.diskById).toBe('ata-WDC_WD-1')
    expect(d.powerOnHours).toBe(2494)
    expect(d.children).toEqual([{ name: 'md127', size: 2000138797056, format: 'btrfs', usedBytes: 763134341120, mountPoint: '/media/RAID_raid10' }])
    expect(d.raid).toEqual(raid)
    // Unmounted partition: mount_point/used_bytes are absent → empty string/0; clean drive raid → null
    const clean = mapDrives([{ children: [{ name: 'sdb1', size: 1, format: 'ext4' }] }])[0]
    expect(clean.children[0]).toEqual({ name: 'sdb1', size: 1, format: 'ext4', usedBytes: 0, mountPoint: '' })
    expect(clean.raid).toBeNull()
  })
  it('returns an empty array for non-array input', () => {
    expect(mapDrives(undefined)).toEqual([])
  })
})

describe('usageLevel', () => {
  it('thresholds match Vue2 getProgressType (80/90)', () => {
    expect(usageLevel(0)).toBe('ok')
    expect(usageLevel(79)).toBe('ok')
    expect(usageLevel(80)).toBe('warn')
    expect(usageLevel(89)).toBe('warn')
    expect(usageLevel(90)).toBe('danger')
    expect(usageLevel(100)).toBe('danger')
  })
})

describe('toFahrenheit', () => {
  it('matches the Vue2 filter: (32 + c*1.8).toFixed(1)', () => {
    expect(toFahrenheit(35)).toBe('95.0')
    expect(toFahrenheit(0)).toBe('32.0')
  })
})

// Captured byte-for-byte on real hardware (2026-07-30, `curl -s http://127.0.0.1/v1/disks`, 4 raidlab scsi_debug fake drives + system NVMe).
// avail[0] raw: {"name":"sda","size":536870912,"model":"scsi_debug","health":"","temperature":38,
//   "power_on_time":0,"disk_type":"SSD","need_format":true,"serial":"2000","path":"/dev/sda",
//   "children_number":0,"children":[],"supported":false}
// The same sda in disks: health:"true" (other fields same as above). ⚠️ avail's health is always the empty string — the backend
// route/v1/disk.go:152-157 does the value-copy append before disk.Health is assigned (backend ticket already logged).
const LIVE_AVAIL = [
  { name: 'sda', size: 536870912, model: 'scsi_debug', health: '', temperature: 38, power_on_time: 0, disk_type: 'SSD', need_format: true, serial: '2000', path: '/dev/sda' },
  { name: 'sdb', size: 536870912, model: 'scsi_debug', health: '', temperature: 38, power_on_time: 0, disk_type: 'SSD', need_format: true, serial: '4000', path: '/dev/sdb' },
]
const LIVE_DISKS = [
  { name: 'sda', path: '/dev/sda', health: 'true', temperature: 38, power_on_time: 0, disk_type: 'SSD' },
  { name: 'sdb', path: '/dev/sdb', health: 'true', temperature: 38, power_on_time: 0, disk_type: 'SSD' },
  { name: 'nvme0n1', path: '/dev/nvme0n1', health: 'true', temperature: 35, power_on_time: 1381, disk_type: 'SSD' },
]

describe('mapAvailDisks', () => {
  it('maps candidate-drive fields, converts size string to a number', () => {
    const out = mapAvailDisks([
      { path: '/dev/sdb', name: 'sdb', model: 'WD Blue', size: '1000204886016', need_format: true, serial: 'S1' },
    ])
    expect(out).toEqual([
      { path: '/dev/sdb', name: 'sdb', model: 'WD Blue', size: 1000204886016, needFormat: true, serial: 'S1',
        disk_type: '', health: '', temperature: 0, power_on_time: 0, raid: null },
    ])
  })
  it('raid residue info is passed through as-is (2026-08-11 real hardware: residue drives show up in avail)', () => {
    const residue = {
      role: 'residue' as const, array_name: 'zimaos:fc5616382c017331', array_uuid: 'u', level: 'raid5',
      md_device: '/dev/md126', registered: false, active: false,
      created_at: 'Thu Aug  6 21:54:49 2026', updated_at: 'Fri Aug  7 00:29:17 2026',
    }
    const out = mapAvailDisks([{ path: '/dev/sdb', name: 'sdb', size: 1, raid: residue }])
    expect(out[0].raid).toEqual(residue)
    // clean drive → null
    expect(mapAvailDisks([{ path: '/dev/sda', size: 1 }])[0].raid).toBeNull()
  })
  it('carries the four fields needed for health display (all populated in real avail except health)', () => {
    const out = mapAvailDisks(LIVE_AVAIL)
    expect(out[0].disk_type).toBe('SSD')
    expect(out[0].temperature).toBe(38)
    expect(out[0].power_on_time).toBe(0)
  })
  it('backfills health by path from the disks list — works around the backend assignment-order bug that leaves avail always empty', () => {
    const out = mapAvailDisks(LIVE_AVAIL, LIVE_DISKS)
    expect(out.map((d) => d.health)).toEqual(['true', 'true'])
  })
  it('when the same drive in disks fails SMART → the candidate drive gets "false"', () => {
    const out = mapAvailDisks(LIVE_AVAIL, [{ path: '/dev/sda', health: 'false' }, { path: '/dev/sdb', health: 'true' }])
    expect(out.map((d) => d.health)).toEqual(['false', 'true'])
  })
  it('when disks lacks that drive or is not passed → keep the avail original value (empty string = verdict unknown, never fabricate healthy)', () => {
    expect(mapAvailDisks(LIVE_AVAIL)[0].health).toBe('')
    expect(mapAvailDisks(LIVE_AVAIL, [{ path: '/dev/nvme0n1', health: 'true' }])[0].health).toBe('')
  })
  it('temperature/power_on_time are also backfilled by path from disks (when avail is missing them)', () => {
    const out = mapAvailDisks(
      [{ path: '/dev/sda', name: 'sda', size: 1 }],
      [{ path: '/dev/sda', health: 'true', temperature: 38, power_on_time: 1381 }],
    )
    expect(out[0].temperature).toBe(38)
    expect(out[0].power_on_time).toBe(1381)
  })
  it('need_format string "true"/"false" is strictly checked (backend stringifies booleans, same pattern as P1 health)', () => {
    const out = mapAvailDisks([
      { path: '/dev/sdb', need_format: 'true' },
      { path: '/dev/sdc', need_format: 'false' },
      { path: '/dev/sdd' },
    ])
    expect(out.map((d) => d.needFormat)).toEqual([true, false, false])
  })
  it('returns an empty array for non-array input', () => {
    expect(mapAvailDisks(undefined)).toEqual([])
    expect(mapAvailDisks({})).toEqual([])
  })
})
