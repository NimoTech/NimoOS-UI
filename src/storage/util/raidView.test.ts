import { describe, it, expect } from 'vitest'
import {
  mapTask, resolveRaidState, raidSeverity, raidStateLabelKey,
  countActiveDisks, memberSquare, memberRow, raidUsagePercent, mirrorPairs, isRebuildingList,
  levelInfo, asRaidArray,
} from './raidView'
import type { RaidArray } from './raidView'

const arr = (o: Partial<RaidArray> = {}): RaidArray =>
  ({ id: 1, name: 'md0', level: 1, state: 'active', ...o }) as RaidArray

describe('resolveRaidState', () => {
  it('healthy: active 无重建 → 全 false', () => {
    const f = resolveRaidState(arr({ state: 'active' }), { state: 'active', live_state: 'active', rebuild_pct: 0 } as never)
    expect(f).toMatchObject({ isRebuilding: false, isDegraded: false, isFailed: false, isRetrying: false })
    expect(raidSeverity(f)).toBe('ok')
    expect(raidStateLabelKey(f)).toBe('raidStateHealthy')
  })
  it('rebuilding: state==rebuilding → isRebuilding, info', () => {
    const f = resolveRaidState(arr({ state: 'rebuilding' }), { live_state: 'recovering', rebuild_pct: 42 } as never)
    expect(f.isRebuilding).toBe(true)
    expect(raidSeverity(f)).toBe('info')
    expect(raidStateLabelKey(f)).toBe('raidStateRebuilding')
  })
  it('live_state 含 resyncing 也算重建', () => {
    const f = resolveRaidState(arr({ state: 'active' }), { live_state: 'resyncing', rebuild_pct: 0 } as never)
    expect(f.isRebuilding).toBe(true)
  })
  it('rebuild_pct>0 也算重建', () => {
    const f = resolveRaidState(arr({ state: 'active' }), { live_state: 'active', rebuild_pct: 5 } as never)
    expect(f.isRebuilding).toBe(true)
  })
  it('degraded 且非重建 → isDegraded, danger', () => {
    const f = resolveRaidState(arr({ state: 'degraded' }), { live_state: 'degraded', rebuild_pct: 0 } as never)
    expect(f.isDegraded).toBe(true)
    expect(raidSeverity(f)).toBe('danger')
    expect(raidStateLabelKey(f)).toBe('raidStateDegraded')
  })
  it('degraded 且重建中 → isRebuilding 优先,isDegraded=false', () => {
    const f = resolveRaidState(arr({ state: 'degraded' }), { live_state: 'recovering', rebuild_pct: 30 } as never)
    expect(f.isRebuilding).toBe(true)
    expect(f.isDegraded).toBe(false)
    expect(raidStateLabelKey(f)).toBe('raidStateRebuilding')
  })
  it('failed → danger, raidStateFailed', () => {
    const f = resolveRaidState(arr({ state: 'failed' }), { live_state: 'failed', rebuild_pct: 0 } as never)
    expect(f.isFailed).toBe(true)
    expect(raidSeverity(f)).toBe('danger')
    expect(raidStateLabelKey(f)).toBe('raidStateFailed')
  })
  it('retrying → warning, raidStateRetrying', () => {
    const f = resolveRaidState(arr({ state: 'retrying' }), undefined)
    expect(f.isRetrying).toBe(true)
    expect(raidSeverity(f)).toBe('warning')
    expect(raidStateLabelKey(f)).toBe('raidStateRetrying')
  })
  it('status 缺失时回退 array.state', () => {
    const f = resolveRaidState(arr({ state: 'degraded' }), undefined)
    expect(f.effectiveState).toBe('degraded')
  })
})

describe('countActiveDisks', () => {
  it('前缀匹配 "active sync"(含 set-A/set-B)', () => {
    const members = [
      { path: '/dev/sda', state: 'active sync set-A', number: 0 },
      { path: '/dev/sdb', state: 'active sync set-B', number: 1 },
      { path: '/dev/sdc', state: 'faulty', number: 2 },
    ]
    expect(countActiveDisks(members, 3)).toBe(2)
  })
  it('members 为空时回退 fallback 计数', () => {
    expect(countActiveDisks([], 4)).toBe(4) // 空数组 → 回退 total(member_disks 计数)
  })
})

describe('asRaidArray', () => {
  it('映射 id/name/level/state,level 转为 Number', () => {
    const a = asRaidArray({ id: 3, name: 'md3', level: 5, state: 'active' })
    expect(a.id).toBe(3)
    expect(a.name).toBe('md3')
    expect(a.level).toBe(5)
    expect(a.state).toBe('active')
  })
  it('缺字段给安全默认', () => {
    const a = asRaidArray({})
    expect(a.name).toBe('')
    expect(a.level).toBe(0)
    expect(a.state).toBe('')
    expect(a.member_disks).toEqual([])
  })
})

describe('memberSquare', () => {
  it('active sync* → ok', () => { expect(memberSquare('active sync set-A').kind).toBe('ok') })
  it('faulty → fail', () => { expect(memberSquare('faulty').kind).toBe('fail') })
  it('removed → fail', () => { expect(memberSquare('removed').kind).toBe('fail') })
  it('含 rebuilding → rebuild', () => { expect(memberSquare('spare rebuilding').kind).toBe('rebuild') })
  it('其它 → unknown', () => { expect(memberSquare('spare').kind).toBe('unknown') })
})

// memberRow 与 memberSquare 的映射**有意不同**:卡片方块把 removed 归红色 fail
// (Vue2 RaidCard L130),详情行只把 faulty 判红、removed 走灰色(Vue2
// RaidDetailPanel memberColor L343-350 / memberStateLabel L351-357)。
describe('memberRow', () => {
  it('active sync* → 绿 + 活动', () => {
    expect(memberRow('active sync set-A')).toEqual({ token: '--sem-fg', labelKey: 'raidMemberActive' })
  })
  it('faulty → 红 + 故障', () => {
    expect(memberRow('faulty')).toEqual({ token: '--remove-fg', labelKey: 'raidMemberFaulty' })
  })
  it('含 rebuilding → 蓝 + 重建中', () => {
    expect(memberRow('spare rebuilding')).toEqual({ token: '--accent', labelKey: 'raidMemberRebuilding' })
  })
  it('removed 不复用 faulty 文案/颜色(空槽位不是故障盘)', () => {
    expect(memberRow('removed')).toEqual({ token: '--fg-muted', labelKey: 'raidMemberRemoved' })
    expect(memberRow('removed').labelKey).not.toBe(memberRow('faulty').labelKey)
    expect(memberRow('removed').token).not.toBe(memberRow('faulty').token)
  })
  it('未知态 → 灰 + 空 labelKey(调用方回退原始串)', () => {
    expect(memberRow('spare')).toEqual({ token: '--fg-muted', labelKey: '' })
    expect(memberRow('')).toEqual({ token: '--fg-muted', labelKey: '' })
  })
})

describe('raidUsagePercent', () => {
  it('常规四舍五入', () => { expect(raidUsagePercent(50, 100)).toBe(50) })
  it('total=0 → 0', () => { expect(raidUsagePercent(10, 0)).toBe(0) })
  it('非零但 <1% → 夹为 1', () => { expect(raidUsagePercent(1, 100000)).toBe(1) })
  it('used=0 → 0', () => { expect(raidUsagePercent(0, 100)).toBe(0) })
})

describe('mapTask', () => {
  it('把 snake_case API 字段映射为 camelCase', () => {
    const t = mapTask({
      task_id: 'abc', name: 'md0', level: 5, filesystem: 'btrfs', disk_count: 4,
      step: 3, step_name: 'Create RAID Array', progress: 55, elapsed_seconds: 120,
      error: '', status: 'creating',
    })
    expect(t).toEqual({
      taskId: 'abc', name: 'md0', level: 5, filesystem: 'btrfs', diskCount: 4,
      step: 3, stepName: 'Create RAID Array', progress: 55, elapsedSeconds: 120,
      error: '', status: 'creating',
    })
  })
  it('缺字段给安全默认', () => {
    const t = mapTask({ task_id: 'x', status: 'creating' })
    expect(t.name).toBe(''); expect(t.progress).toBe(0); expect(t.diskCount).toBe(0)
  })
})

describe('mirrorPairs (RAID10)', () => {
  it('按 floor(number/2) 分对,set-A 在前', () => {
    const members = [
      { path: '/dev/sdb', state: 'active sync set-B', number: 1 },
      { path: '/dev/sda', state: 'active sync set-A', number: 0 },
      { path: '/dev/sdd', state: 'active sync set-B', number: 3 },
      { path: '/dev/sdc', state: 'active sync set-A', number: 2 },
    ]
    const pairs = mirrorPairs(members)
    expect(pairs.length).toBe(2)
    expect(pairs[0].map((m) => m.path)).toEqual(['/dev/sda', '/dev/sdb'])
    expect(pairs[1].map((m) => m.path)).toEqual(['/dev/sdc', '/dev/sdd'])
  })
})

describe('isRebuildingList', () => {
  it('任一阵列重建中 → true(驱动 5000ms 重拉)', () => {
    const flags = [
      { isRebuilding: false } as never,
      { isRebuilding: true } as never,
    ]
    expect(isRebuildingList(flags)).toBe(true)
  })
  it('全不重建 → false', () => {
    expect(isRebuildingList([{ isRebuilding: false } as never])).toBe(false)
  })
})

describe('levelInfo', () => {
  it('已知级别(0/1/5/6/10)返回非空', () => {
    expect(levelInfo(0)).not.toBeNull()
    expect(levelInfo(1)).not.toBeNull()
    expect(levelInfo(5)).not.toBeNull()
    expect(levelInfo(6)).not.toBeNull()
    expect(levelInfo(10)).not.toBeNull()
  })
  it('未知级别返回 null', () => {
    expect(levelInfo(99)).toBeNull()
  })
})
