import { describe, it, expect } from 'vitest'
import {
  RAID_LEVELS, recommendRaidLevel, isDiskAtRisk, groupColorKey, diskSpecKey,
  diskHealthState, tempDisplay, tempTone, pohDisplay, pohTone, diskHealthScore, diskHealthTone,
  type RaidDisk,
} from './raidLevels'

// ── Verbatim on-device values ────────────────────────────────────────────────────────────
// Capture command (2026-07-30, on the device itself; 4 scsi_debug fake disks created by raidlab.sh up + 1 system NVMe):
//   curl -s http://127.0.0.1/v1/disks
// data.avail[0] (= candidate disk for the RAID create wizard, verbatim):
//   {"name":"sda","size":536870912,"model":"scsi_debug","health":"","temperature":38,
//    "power_on_time":0,"disk_type":"SSD","need_format":true,"serial":"2000","path":"/dev/sda",
//    "children_number":0,"children":[],"supported":false}
// The same sda in data.disks is health:"true"; system disk nvme0n1 = health:"true" temperature:35 power_on_time:1381
//
// ⚠️ health in avail is always the empty string "" —— neither 'true'/'false' nor undefined. The backend
// NimoOS-LocalStorage/route/v1/disk.go:152-157 appends a **value copy** of disk into avail,
// while disk.Health = strconv.FormatBool(...) runs after that → avail gets the zero value.
// The old tests fed hand-written 'false'/'true'/undefined, covering none of the three real values.
const LIVE_AVAIL_SDA: RaidDisk = {
  path: '/dev/sda', size: 536870912, model: 'scsi_debug',
  health: '', temperature: 38, power_on_time: 0, disk_type: 'SSD',
}
const LIVE_NVME: RaidDisk = {
  path: '/dev/nvme0n1', size: 512110190592, model: 'WPBSNM8-512GTP',
  health: 'true', temperature: 35, power_on_time: 1381, disk_type: 'SSD',
}

describe('RAID_LEVELS', () => {
  it('contains 5 levels, in order 0,1,5,6,10', () => {
    expect(RAID_LEVELS.map(l => l.id)).toEqual([0, 1, 5, 6, 10])
  })
  it('minimum disk count per level matches Vue2 byte-for-byte', () => {
    const min = Object.fromEntries(RAID_LEVELS.map(l => [l.id, l.min]))
    expect(min).toEqual({ 0: 2, 1: 2, 5: 3, 6: 4, 10: 4 })
  })
  it('capacity formula: 4 disks × 1000 → RAID0=4000 / RAID1=1000 / RAID5=3000 / RAID6=2000 / RAID10=2000', () => {
    const cap = (id: number) => RAID_LEVELS.find(l => l.id === id)!.capacity(4, 1000)
    expect(cap(0)).toBe(4000)
    expect(cap(1)).toBe(1000)
    expect(cap(5)).toBe(3000)
    expect(cap(6)).toBe(2000)
    expect(cap(10)).toBe(2000)
  })
  it('layout role counts scale with disk count: RAID5 with 3 disks = 2 data + 1 parity', () => {
    const roles = RAID_LEVELS.find(l => l.id === 5)!.layout(3)
    expect(roles.filter(r => r === 'data')).toHaveLength(2)
    expect(roles.filter(r => r === 'parity')).toHaveLength(1)
  })
})

describe('recommendRaidLevel', () => {
  it('2 disks→1, 3 disks→5, 4 disks→10, 6 disks→10, 5 disks→5', () => {
    expect(recommendRaidLevel(2)).toBe(1)
    expect(recommendRaidLevel(3)).toBe(5)
    expect(recommendRaidLevel(4)).toBe(10)
    expect(recommendRaidLevel(6)).toBe(10)
    expect(recommendRaidLevel(5)).toBe(5)
  })
})

describe('diskHealthState', () => {
  it('real-hardware avail\'s empty-string health → unknown (counted as neither healthy nor at risk)', () => {
    expect(diskHealthState(LIVE_AVAIL_SDA)).toBe('unknown')
  })
  it('real-hardware "true" → good; SMART-failed "false" → bad', () => {
    expect(diskHealthState(LIVE_NVME)).toBe('good')
    expect(diskHealthState({ ...LIVE_NVME, health: 'false' })).toBe('bad')
  })
  it('missing field → unknown (must not default to healthy)', () => {
    expect(diskHealthState({ path: '/dev/sdz', size: 1 })).toBe('unknown')
  })
})

describe('isDiskAtRisk', () => {
  it('only flags a risk when SMART explicitly failed ("false")', () => {
    expect(isDiskAtRisk({ ...LIVE_NVME, health: 'false' })).toBe(true)
  })
  it('real-hardware avail\'s empty-string health is not flagged as risk (verdict unknown ≠ at risk)', () => {
    expect(isDiskAtRisk(LIVE_AVAIL_SDA)).toBe(false)
  })
  it('neither "true" nor a missing field is flagged as risk', () => {
    expect(isDiskAtRisk(LIVE_NVME)).toBe(false)
    expect(isDiskAtRisk({ path: '/dev/sdz', size: 1 })).toBe(false)
  })
})

describe('temperature display and tiering (matches Vue2 raidUtils.js:112-120 byte-for-byte)', () => {
  it('tempDisplay: real-hardware 38 → "38°C"; 0 and missing → "-"', () => {
    expect(tempDisplay(LIVE_AVAIL_SDA.temperature)).toBe('38°C')
    expect(tempDisplay(0)).toBe('-')
    expect(tempDisplay(undefined)).toBe('-')
  })
  it('tempTone: thresholds 42 (warn) / 46 (bad)', () => {
    expect(tempTone(38)).toBe('good')
    expect(tempTone(41)).toBe('good')
    expect(tempTone(42)).toBe('warn')
    expect(tempTone(45)).toBe('warn')
    expect(tempTone(46)).toBe('bad')
  })
})

describe('power-on-hours display and tiering (matches Vue2 raidUtils.js:122-133 byte-for-byte)', () => {
  it('pohDisplay: fake disk 0 → "-"; <1000 in hours; >=1000 converted to years via 8760, 1 decimal place', () => {
    expect(pohDisplay(0)).toBe('-')
    expect(pohDisplay(undefined)).toBe('-')
    expect(pohDisplay(999)).toBe('999h')
    expect(pohDisplay(LIVE_NVME.power_on_time)).toBe('0.2yr')
    expect(pohDisplay(8760)).toBe('1.0yr')
  })
  it('pohTone: thresholds 18000 (warn) / 35000 (bad)', () => {
    expect(pohTone(0)).toBe('good')
    expect(pohTone(1381)).toBe('good')
    expect(pohTone(18000)).toBe('warn')
    expect(pohTone(35000)).toBe('bad')
  })
})

describe('diskHealthScore / diskHealthTone (matches Vue2 raidUtils.js:135-149 byte-for-byte)', () => {
  it('real-hardware fake disk (health "" / 38°C / 0h) → score 100, good — health state is visible, no longer blank', () => {
    expect(diskHealthScore(LIVE_AVAIL_SDA)).toBe(100)
    expect(diskHealthTone(diskHealthScore(LIVE_AVAIL_SDA))).toBe('good')
  })
  it('SMART failed → score 0 directly, bad', () => {
    expect(diskHealthScore({ ...LIVE_AVAIL_SDA, health: 'false' })).toBe(0)
    expect(diskHealthTone(0)).toBe('bad')
  })
  it('high temperature deducts 15/30, long power-on time deducts 15/30, deductions stack and never go below 0', () => {
    expect(diskHealthScore({ ...LIVE_AVAIL_SDA, temperature: 42 })).toBe(85)
    expect(diskHealthScore({ ...LIVE_AVAIL_SDA, temperature: 46 })).toBe(70)
    expect(diskHealthScore({ ...LIVE_AVAIL_SDA, power_on_time: 18000 })).toBe(85)
    expect(diskHealthScore({ ...LIVE_AVAIL_SDA, temperature: 46, power_on_time: 35000 })).toBe(40)
  })
  it('diskHealthTone: >=85 good / >=60 warn / otherwise bad', () => {
    expect(diskHealthTone(100)).toBe('good')
    expect(diskHealthTone(85)).toBe('good')
    expect(diskHealthTone(84)).toBe('warn')
    expect(diskHealthTone(60)).toBe('warn')
    expect(diskHealthTone(59)).toBe('bad')
  })
})

// groupColorKey/diskSpecKey did not appear in the test code block given by the brief, but they are part of the Produces interface ——
// tests added to ensure the group semantic key behaves correctly and never leaks literal colors.
describe('groupColorKey', () => {
  const diskA: RaidDisk = { path: '/dev/sda', size: 1000, disk_type: 'ssd' }
  const diskB: RaidDisk = { path: '/dev/sdb', size: 2000, disk_type: 'hdd' }

  it('diskSpecKey combines size|disk_type', () => {
    expect(diskSpecKey(diskA)).toBe('1000|ssd')
    expect(diskSpecKey({ path: '/dev/sdc', size: 500 } as RaidDisk)).toBe('500|')
  })

  it('returns a group semantic key based on position in groups, never a literal color', () => {
    const groups = [{ key: diskSpecKey(diskA) }, { key: diskSpecKey(diskB) }]
    expect(groupColorKey(diskA, groups)).toBe('group-a')
    expect(groupColorKey(diskB, groups)).toBe('group-b')
  })

  it('falls back to the first semantic key when no group matches', () => {
    const unknown: RaidDisk = { path: '/dev/sdz', size: 999, disk_type: 'nvme' }
    expect(groupColorKey(unknown, [{ key: diskSpecKey(diskA) }])).toBe('group-a')
  })

  it('the return value has no literal-color traits (does not start with #, does not contain rgb)', () => {
    const groups = [{ key: diskSpecKey(diskA) }]
    const result = groupColorKey(diskA, groups)
    expect(result).not.toMatch(/^#/)
    expect(result).not.toMatch(/rgb/i)
  })
})
