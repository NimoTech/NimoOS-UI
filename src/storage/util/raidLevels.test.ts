import { describe, it, expect } from 'vitest'
import {
  RAID_LEVELS, recommendRaidLevel, isDiskAtRisk, groupColorKey, diskSpecKey,
  diskHealthState, tempDisplay, tempTone, pohDisplay, pohTone, diskHealthScore, diskHealthTone,
  type RaidDisk,
} from './raidLevels'

// ── 真机逐字取值 ────────────────────────────────────────────────────────────
// 抓取命令(2026-07-30,设备本机;4 块 scsi_debug 假盘由 raidlab.sh up 造出 + 1 块系统 NVMe):
//   curl -s http://127.0.0.1/v1/disks
// data.avail[0](= 建 RAID 向导的候选盘,逐字):
//   {"name":"sda","size":536870912,"model":"scsi_debug","health":"","temperature":38,
//    "power_on_time":0,"disk_type":"SSD","need_format":true,"serial":"2000","path":"/dev/sda",
//    "children_number":0,"children":[],"supported":false}
// data.disks 里同一块 sda 则是 health:"true";系统盘 nvme0n1 = health:"true" temperature:35 power_on_time:1381
//
// ⚠️ avail 的 health 恒为空串 "" —— 不是 'true'/'false' 也不是 undefined。后端
// NimoOS-LocalStorage/route/v1/disk.go:152-157 把 disk **值拷贝** append 进 avail,
// 而 disk.Health = strconv.FormatBool(...) 在那之后才执行 → avail 拿到的是零值。
// 旧测试喂的是手编的 'false'/'true'/undefined,三个真实取值一个没覆盖(见记忆 newui-fixture-from-imagination-trap)。
const LIVE_AVAIL_SDA: RaidDisk = {
  path: '/dev/sda', size: 536870912, model: 'scsi_debug',
  health: '', temperature: 38, power_on_time: 0, disk_type: 'SSD',
}
const LIVE_NVME: RaidDisk = {
  path: '/dev/nvme0n1', size: 512110190592, model: 'WPBSNM8-512GTP',
  health: 'true', temperature: 35, power_on_time: 1381, disk_type: 'SSD',
}

describe('RAID_LEVELS', () => {
  it('含 5 个级别,顺序 0,1,5,6,10', () => {
    expect(RAID_LEVELS.map(l => l.id)).toEqual([0, 1, 5, 6, 10])
  })
  it('每级最少盘数逐字对齐 Vue2', () => {
    const min = Object.fromEntries(RAID_LEVELS.map(l => [l.id, l.min]))
    expect(min).toEqual({ 0: 2, 1: 2, 5: 3, 6: 4, 10: 4 })
  })
  it('容量公式:4 盘 × 1000 → RAID0=4000 / RAID1=1000 / RAID5=3000 / RAID6=2000 / RAID10=2000', () => {
    const cap = (id: number) => RAID_LEVELS.find(l => l.id === id)!.capacity(4, 1000)
    expect(cap(0)).toBe(4000)
    expect(cap(1)).toBe(1000)
    expect(cap(5)).toBe(3000)
    expect(cap(6)).toBe(2000)
    expect(cap(10)).toBe(2000)
  })
  it('布局角色数量随盘数:RAID5 3盘 = 2 data + 1 parity', () => {
    const roles = RAID_LEVELS.find(l => l.id === 5)!.layout(3)
    expect(roles.filter(r => r === 'data')).toHaveLength(2)
    expect(roles.filter(r => r === 'parity')).toHaveLength(1)
  })
})

describe('recommendRaidLevel', () => {
  it('2盘→1, 3盘→5, 4盘→10, 6盘→10, 5盘→5', () => {
    expect(recommendRaidLevel(2)).toBe(1)
    expect(recommendRaidLevel(3)).toBe(5)
    expect(recommendRaidLevel(4)).toBe(10)
    expect(recommendRaidLevel(6)).toBe(10)
    expect(recommendRaidLevel(5)).toBe(5)
  })
})

describe('diskHealthState', () => {
  it('真机 avail 的空串 health → unknown(既不算健康也不算风险)', () => {
    expect(diskHealthState(LIVE_AVAIL_SDA)).toBe('unknown')
  })
  it('真机 "true" → good;SMART 未过的 "false" → bad', () => {
    expect(diskHealthState(LIVE_NVME)).toBe('good')
    expect(diskHealthState({ ...LIVE_NVME, health: 'false' })).toBe('bad')
  })
  it('字段缺失 → unknown(不能默认健康)', () => {
    expect(diskHealthState({ path: '/dev/sdz', size: 1 })).toBe('unknown')
  })
})

describe('isDiskAtRisk', () => {
  it('只有 SMART 明确未过("false")才判风险', () => {
    expect(isDiskAtRisk({ ...LIVE_NVME, health: 'false' })).toBe(true)
  })
  it('真机 avail 的空串 health 不判风险(结论未知 ≠ 有风险)', () => {
    expect(isDiskAtRisk(LIVE_AVAIL_SDA)).toBe(false)
  })
  it('"true" 与字段缺失都不判风险', () => {
    expect(isDiskAtRisk(LIVE_NVME)).toBe(false)
    expect(isDiskAtRisk({ path: '/dev/sdz', size: 1 })).toBe(false)
  })
})

describe('温度显示与分级(逐字对齐 Vue2 raidUtils.js:112-120)', () => {
  it('tempDisplay:真机 38 → "38°C";0 与缺失 → "-"', () => {
    expect(tempDisplay(LIVE_AVAIL_SDA.temperature)).toBe('38°C')
    expect(tempDisplay(0)).toBe('-')
    expect(tempDisplay(undefined)).toBe('-')
  })
  it('tempTone:阈值 42(warn)/46(bad)', () => {
    expect(tempTone(38)).toBe('good')
    expect(tempTone(41)).toBe('good')
    expect(tempTone(42)).toBe('warn')
    expect(tempTone(45)).toBe('warn')
    expect(tempTone(46)).toBe('bad')
  })
})

describe('通电时长显示与分级(逐字对齐 Vue2 raidUtils.js:122-133)', () => {
  it('pohDisplay:假盘 0 → "-";<1000 按小时;>=1000 按 8760 折算年、1 位小数', () => {
    expect(pohDisplay(0)).toBe('-')
    expect(pohDisplay(undefined)).toBe('-')
    expect(pohDisplay(999)).toBe('999h')
    expect(pohDisplay(LIVE_NVME.power_on_time)).toBe('0.2yr')
    expect(pohDisplay(8760)).toBe('1.0yr')
  })
  it('pohTone:阈值 18000(warn)/35000(bad)', () => {
    expect(pohTone(0)).toBe('good')
    expect(pohTone(1381)).toBe('good')
    expect(pohTone(18000)).toBe('warn')
    expect(pohTone(35000)).toBe('bad')
  })
})

describe('diskHealthScore / diskHealthTone(逐字对齐 Vue2 raidUtils.js:135-149)', () => {
  it('真机假盘(health "" / 38°C / 0h)→ 100 分、good —— 健康态可见,不再一片空白', () => {
    expect(diskHealthScore(LIVE_AVAIL_SDA)).toBe(100)
    expect(diskHealthTone(diskHealthScore(LIVE_AVAIL_SDA))).toBe('good')
  })
  it('SMART 未过直接 0 分、bad', () => {
    expect(diskHealthScore({ ...LIVE_AVAIL_SDA, health: 'false' })).toBe(0)
    expect(diskHealthTone(0)).toBe('bad')
  })
  it('高温扣 15/30,长通电扣 15/30,可叠加且不低于 0', () => {
    expect(diskHealthScore({ ...LIVE_AVAIL_SDA, temperature: 42 })).toBe(85)
    expect(diskHealthScore({ ...LIVE_AVAIL_SDA, temperature: 46 })).toBe(70)
    expect(diskHealthScore({ ...LIVE_AVAIL_SDA, power_on_time: 18000 })).toBe(85)
    expect(diskHealthScore({ ...LIVE_AVAIL_SDA, temperature: 46, power_on_time: 35000 })).toBe(40)
  })
  it('diskHealthTone:>=85 good / >=60 warn / 其余 bad', () => {
    expect(diskHealthTone(100)).toBe('good')
    expect(diskHealthTone(85)).toBe('good')
    expect(diskHealthTone(84)).toBe('warn')
    expect(diskHealthTone(60)).toBe('warn')
    expect(diskHealthTone(59)).toBe('bad')
  })
})

// groupColorKey/diskSpecKey 未在 brief 给定的测试代码块中出现,但属于 Produces 接口的一部分——
// 补测以确保分组语义 key 行为正确、且绝不泄露字面色。
describe('groupColorKey', () => {
  const diskA: RaidDisk = { path: '/dev/sda', size: 1000, disk_type: 'ssd' }
  const diskB: RaidDisk = { path: '/dev/sdb', size: 2000, disk_type: 'hdd' }

  it('diskSpecKey 按 size|disk_type 组合', () => {
    expect(diskSpecKey(diskA)).toBe('1000|ssd')
    expect(diskSpecKey({ path: '/dev/sdc', size: 500 } as RaidDisk)).toBe('500|')
  })

  it('按 groups 中的位置返回分组语义 key,不返回字面色', () => {
    const groups = [{ key: diskSpecKey(diskA) }, { key: diskSpecKey(diskB) }]
    expect(groupColorKey(diskA, groups)).toBe('group-a')
    expect(groupColorKey(diskB, groups)).toBe('group-b')
  })

  it('未匹配任何分组时回退到第一个语义 key', () => {
    const unknown: RaidDisk = { path: '/dev/sdz', size: 999, disk_type: 'nvme' }
    expect(groupColorKey(unknown, [{ key: diskSpecKey(diskA) }])).toBe('group-a')
  })

  it('返回值不含字面色特征(不以 # 开头,不含 rgb)', () => {
    const groups = [{ key: diskSpecKey(diskA) }]
    const result = groupColorKey(diskA, groups)
    expect(result).not.toMatch(/^#/)
    expect(result).not.toMatch(/rgb/i)
  })
})
