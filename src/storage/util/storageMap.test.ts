import { describe, it, expect } from 'vitest'
import { mapVolumes, mapDrives, usageLevel, toFahrenheit, mapAvailDisks } from './storageMap'

// 真机 2026-07-23 实拍:size/avail 是字符串
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
  it('拍平 children、字符串数值转数字、算占用率', () => {
    const v = mapVolumes(LIVE_GROUPS)
    const sys = v.find((x) => x.isSystem)!
    expect(sys.name).toBe('NimoOS-HD')
    expect(sys.size).toBe(512110190592)
    expect(sys.availSize).toBe(384614653440)
    expect(sys.usedSize).toBe(512110190592 - 384614653440)
    // Vue2 逐字:100 - Math.floor(avail*100/size)
    expect(sys.usePercent).toBe(100 - Math.floor((384614653440 * 100) / 512110190592))
    expect(sys.fsType).toBe('ext4')
    expect(sys.mountPoint).toBe('/')
    expect(sys.disk).toBe('/dev/nvme0n1')
    expect(sys.driveName).toBe('nvme0n1p7')
  })
  it('isSystem 只认 disk_name === "System"', () => {
    const v = mapVolumes(LIVE_GROUPS)
    expect(v.filter((x) => x.isSystem)).toHaveLength(1)
    expect(v.find((x) => x.name === 'Storage1')!.isSystem).toBe(false)
  })
  it('RAID 挂载点被排除', () => {
    const v = mapVolumes(LIVE_GROUPS, new Set(['/mnt/raid0']))
    expect(v.map((x) => x.name)).not.toContain('zzz-on-raid')
    expect(v).toHaveLength(2)
  })
  it('排序:父盘名 desc、label asc(System 在前)', () => {
    const v = mapVolumes(LIVE_GROUPS)
    expect(v[0].isSystem).toBe(true)
    expect(v[1].name < (v[2]?.name ?? '￿')).toBe(true)
  })
  it('size 为 0 或缺失时占用率为 0,不产生 NaN', () => {
    const v = mapVolumes([{ disk_name: 'X', path: '/dev/x', children: [{ label: 'e', mount_point: '/e' }] }])
    expect(v[0].usePercent).toBe(0)
    expect(v[0].size).toBe(0)
  })
  it('非数组/垃圾输入返回空数组', () => {
    expect(mapVolumes(null)).toEqual([])
    expect(mapVolumes({ nope: 1 })).toEqual([])
  })
})

describe('mapDrives', () => {
  const LIVE_DISKS = [
    { name: 'nvme0n1', size: 512110190592, model: 'WPBSNM8-512GTP', health: 'true', temperature: 35, disk_type: 'SSD', serial: 'LP0625', path: '/dev/nvme0n1' },
  ]
  it('映射真机字段', () => {
    const d = mapDrives(LIVE_DISKS)
    expect(d[0]).toMatchObject({ name: 'nvme0n1', model: 'WPBSNM8-512GTP', size: 512110190592, diskType: 'SSD', healthy: true, temperature: 35 })
  })
  it('health 只认 true/"true"(修正 Vue2 把字符串 "false" 当健康的隐患)', () => {
    expect(mapDrives([{ health: 'false' }])[0].healthy).toBe(false)
    expect(mapDrives([{ health: true }])[0].healthy).toBe(true)
    expect(mapDrives([{}])[0].healthy).toBe(false)
  })
  it('health 原文保留三态:字符串原样、缺失为空串(详情页 —)', () => {
    expect(mapDrives([{ health: 'true' }])[0].health).toBe('true')
    expect(mapDrives([{ health: 'false' }])[0].health).toBe('false')
    expect(mapDrives([{}])[0].health).toBe('')
  })
  it('2026-08 新字段:serial/disk_by_id/power_on_time/children(mount_point+used_bytes)/raid', () => {
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
    // 未挂载分区:mount_point/used_bytes 缺席 → 空串/0;干净盘 raid → null
    const clean = mapDrives([{ children: [{ name: 'sdb1', size: 1, format: 'ext4' }] }])[0]
    expect(clean.children[0]).toEqual({ name: 'sdb1', size: 1, format: 'ext4', usedBytes: 0, mountPoint: '' })
    expect(clean.raid).toBeNull()
  })
  it('非数组输入返回空数组', () => {
    expect(mapDrives(undefined)).toEqual([])
  })
})

describe('usageLevel', () => {
  it('阈值与 Vue2 getProgressType 一致(80/90)', () => {
    expect(usageLevel(0)).toBe('ok')
    expect(usageLevel(79)).toBe('ok')
    expect(usageLevel(80)).toBe('warn')
    expect(usageLevel(89)).toBe('warn')
    expect(usageLevel(90)).toBe('danger')
    expect(usageLevel(100)).toBe('danger')
  })
})

describe('toFahrenheit', () => {
  it('与 Vue2 filter 一致:(32 + c*1.8).toFixed(1)', () => {
    expect(toFahrenheit(35)).toBe('95.0')
    expect(toFahrenheit(0)).toBe('32.0')
  })
})

// 真机逐字取值(2026-07-30,`curl -s http://127.0.0.1/v1/disks`,4 块 raidlab scsi_debug 假盘 + 系统 NVMe)。
// avail[0] 原文:{"name":"sda","size":536870912,"model":"scsi_debug","health":"","temperature":38,
//   "power_on_time":0,"disk_type":"SSD","need_format":true,"serial":"2000","path":"/dev/sda",
//   "children_number":0,"children":[],"supported":false}
// disks 里同一块 sda:health:"true"(其余字段同上)。⚠️ avail 的 health 恒为空串——后端
// route/v1/disk.go:152-157 值拷贝 append 早于 disk.Health 赋值(已登记后端票)。
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
  it('映射候选盘字段,size 字符串转数值', () => {
    const out = mapAvailDisks([
      { path: '/dev/sdb', name: 'sdb', model: 'WD Blue', size: '1000204886016', need_format: true, serial: 'S1' },
    ])
    expect(out).toEqual([
      { path: '/dev/sdb', name: 'sdb', model: 'WD Blue', size: 1000204886016, needFormat: true, serial: 'S1',
        disk_type: '', health: '', temperature: 0, power_on_time: 0, raid: null },
    ])
  })
  it('raid 残留信息原样透传(2026-08-11 真机:residue 盘出现在 avail 里)', () => {
    const residue = {
      role: 'residue' as const, array_name: 'zimaos:fc5616382c017331', array_uuid: 'u', level: 'raid5',
      md_device: '/dev/md126', registered: false, active: false,
      created_at: 'Thu Aug  6 21:54:49 2026', updated_at: 'Fri Aug  7 00:29:17 2026',
    }
    const out = mapAvailDisks([{ path: '/dev/sdb', name: 'sdb', size: 1, raid: residue }])
    expect(out[0].raid).toEqual(residue)
    // 干净盘 → null
    expect(mapAvailDisks([{ path: '/dev/sda', size: 1 }])[0].raid).toBeNull()
  })
  it('带上健康展示要用的四个字段(真机 avail 里都有值,除 health)', () => {
    const out = mapAvailDisks(LIVE_AVAIL)
    expect(out[0].disk_type).toBe('SSD')
    expect(out[0].temperature).toBe(38)
    expect(out[0].power_on_time).toBe(0)
  })
  it('health 按 path 从 disks 列表补齐——避开后端 avail 恒空串的赋值顺序缺陷', () => {
    const out = mapAvailDisks(LIVE_AVAIL, LIVE_DISKS)
    expect(out.map((d) => d.health)).toEqual(['true', 'true'])
  })
  it('disks 里同一块盘 SMART 未过 → 候选盘拿到 "false"', () => {
    const out = mapAvailDisks(LIVE_AVAIL, [{ path: '/dev/sda', health: 'false' }, { path: '/dev/sdb', health: 'true' }])
    expect(out.map((d) => d.health)).toEqual(['false', 'true'])
  })
  it('disks 缺该盘或未传 → 保留 avail 原值(空串 = 结论未知,不伪造健康)', () => {
    expect(mapAvailDisks(LIVE_AVAIL)[0].health).toBe('')
    expect(mapAvailDisks(LIVE_AVAIL, [{ path: '/dev/nvme0n1', health: 'true' }])[0].health).toBe('')
  })
  it('temperature/power_on_time 也按 path 从 disks 补齐(avail 缺值时)', () => {
    const out = mapAvailDisks(
      [{ path: '/dev/sda', name: 'sda', size: 1 }],
      [{ path: '/dev/sda', health: 'true', temperature: 38, power_on_time: 1381 }],
    )
    expect(out[0].temperature).toBe(38)
    expect(out[0].power_on_time).toBe(1381)
  })
  it('need_format 字符串 "true"/"false" 严格判定(后端布尔字符串化,P1 health 同款)', () => {
    const out = mapAvailDisks([
      { path: '/dev/sdb', need_format: 'true' },
      { path: '/dev/sdc', need_format: 'false' },
      { path: '/dev/sdd' },
    ])
    expect(out.map((d) => d.needFormat)).toEqual([true, false, false])
  })
  it('非数组输入返回空数组', () => {
    expect(mapAvailDisks(undefined)).toEqual([])
    expect(mapAvailDisks({})).toEqual([])
  })
})
