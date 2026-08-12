// 用例移植自 NimoOS-UI/tests/raidReplaceTarget.test.js(2026-08-11),行为须与 Vue2 逐字一致。
import { describe, it, expect } from 'vitest'
import { findReplaceTarget, filterReplacementCandidates } from './raidReplace'
import type { RaidMemberDiskRow, DiskRaidInfo } from '@nimotech/nimoos-service'

// 复现 2026-08-11 事故的 fixture:4 盘 RAID10 拔掉一块,腾出的设备字母 /dev/sdb
// 被全新的替换盘复用。
const liveMembers = [
  { path: '/dev/sdd', state: 'active sync', serial: 'OLD-1' },
  { path: '/dev/sdc', state: 'active sync', serial: 'OLD-2' },
  { path: '/dev/sda', state: 'active sync', serial: 'OLD-3' },
  { path: '', state: 'removed', serial: '' },
]
const memberDisks: RaidMemberDiskRow[] = [
  { disk_by_id: 'id-1', disk_serial: 'OLD-1', device_path_cache: '/dev/sdd' },
  { disk_by_id: 'id-2', disk_serial: 'OLD-2', device_path_cache: '/dev/sdc' },
  { disk_by_id: 'id-3', disk_serial: 'OLD-3', device_path_cache: '/dev/sda' },
  { disk_by_id: 'id-4', disk_serial: 'OLD-4', device_path_cache: '/dev/sdb' }, // 已拔;路径被复用
]
const availNewDisk = { path: '/dev/sdb', size: 1000490287104, serial: 'NEW-1' }

describe('findReplaceTarget', () => {
  it('拔掉的盘按 serial 识别,不按陈旧缓存路径', () => {
    const t = findReplaceTarget(liveMembers, memberDisks)
    expect(t).toBeTruthy()
    expect(t!.serial).toBe('OLD-4')
    expect(t!.path).toBe('') // 陈旧缓存路径绝不当作盘身份暴露
    expect(t!.label).toBe('OLD-4')
  })

  it('优先取在位 faulty 成员,其实时路径可信', () => {
    const withFaulty = [
      ...liveMembers.slice(0, 3),
      { path: '/dev/sde', state: 'faulty', serial: 'OLD-4' },
    ]
    const t = findReplaceTarget(withFaulty, memberDisks)!
    expect(t.path).toBe('/dev/sde')
    expect(t.serial).toBe('OLD-4')
    expect(t.label).toBe('/dev/sde')
  })

  it('后端不报成员 serial 时回退按 path 检测', () => {
    const noSerials = liveMembers.map((m) => ({ path: m.path, state: m.state }))
    const t = findReplaceTarget(noSerials, memberDisks)!
    expect(t.serial).toBe('OLD-4')
  })

  it('没有缺席也没有故障 → null', () => {
    const full = memberDisks.map((m) => ({
      path: m.device_path_cache, state: 'active sync', serial: m.disk_serial,
    }))
    expect(findReplaceTarget(full, memberDisks)).toBeNull()
  })

  it('无实时视图(status 未拉到 / mdadm 不可达)→ null,不拿第一块健康盘顶包', () => {
    expect(findReplaceTarget([], memberDisks)).toBeNull()
    expect(findReplaceTarget(undefined, memberDisks)).toBeNull()
  })
})

describe('filterReplacementCandidates', () => {
  it('坐在被拔盘旧路径上的新盘要保留(事故案)', () => {
    const target = findReplaceTarget(liveMembers, memberDisks)
    const out = filterReplacementCandidates([availNewDisk], target)
    expect(out).toHaveLength(1)
    expect(out[0].path).toBe('/dev/sdb')
  })

  it('故障盘自己按 serial 排除', () => {
    const target = { path: '/dev/sde', serial: 'OLD-4', label: '/dev/sde' }
    const out = filterReplacementCandidates(
      [{ path: '/dev/sde', size: 1, serial: 'OLD-4' }, availNewDisk], target)
    expect(out.map((d) => d.path)).toEqual(['/dev/sdb'])
  })

  it('serial 不可用时按 path 排除', () => {
    const target = { path: '/dev/sde', serial: '', label: '/dev/sde' }
    const out = filterReplacementCandidates(
      [{ path: '/dev/sde', size: 1 }, { path: '/dev/sdb', size: 1 }], target)
    expect(out.map((d) => d.path)).toEqual(['/dev/sdb'])
  })

  it('无 target 全放行', () => {
    expect(filterReplacementCandidates([availNewDisk], null)).toHaveLength(1)
  })

  it('raid 残留信息透传(弹窗靠它打警告标 + 弹清除确认)', () => {
    const residue = { role: 'residue', array_name: 'zimaos:fc56' } as DiskRaidInfo
    const out = filterReplacementCandidates(
      [{ path: '/dev/sdb', size: 1, serial: 'S1', raid: residue }], null)
    expect(out[0].raid).toEqual(residue)
  })
})
