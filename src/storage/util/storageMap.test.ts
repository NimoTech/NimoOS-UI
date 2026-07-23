import { describe, it, expect } from 'vitest'
import { mapVolumes, mapDrives, usageLevel, toFahrenheit } from './storageMap'

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
