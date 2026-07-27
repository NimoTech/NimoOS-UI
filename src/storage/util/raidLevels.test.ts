import { describe, it, expect } from 'vitest'
import { RAID_LEVELS, recommendRaidLevel, isDiskAtRisk, groupColorKey, diskSpecKey, type RaidDisk } from './raidLevels'

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

describe('isDiskAtRisk', () => {
  it('health 字符串 "false" 视为风险,其余不是', () => {
    expect(isDiskAtRisk({ path: '/dev/sda', size: 1, health: 'false' } as RaidDisk)).toBe(true)
    expect(isDiskAtRisk({ path: '/dev/sda', size: 1, health: 'true' } as RaidDisk)).toBe(false)
    expect(isDiskAtRisk({ path: '/dev/sda', size: 1 } as RaidDisk)).toBe(false)
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
