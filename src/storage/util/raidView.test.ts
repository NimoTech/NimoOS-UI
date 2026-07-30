import { describe, it, expect } from 'vitest'
import {
  mapTask, resolveRaidState, raidSeverity, raidStateLabelKey,
  countActiveDisks, memberSquare, memberRow, raidUsagePercent, mirrorPairs, isRebuildingList, replaceOutcome,
  slotMembers, memberDiskCount, mergeVacatedSlot,
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

describe('replaceOutcome', () => {
  const task = { arrayId: '1', arrayName: 'md0', oldPath: '/dev/sda', newPath: '/dev/sdd' }

  it('阵列已不在列表 → gone(不报完成)', () => {
    expect(replaceOutcome(task, { members: [] }, false)).toBe('gone')
  })
  it('status 拉不到 → pending', () => {
    expect(replaceOutcome(task, null, true)).toBe('pending')
    expect(replaceOutcome(task, undefined, true)).toBe('pending')
  })
  it('新盘还没出现在成员表 → pending(mdadm --add 后内核尚未登记)', () => {
    expect(replaceOutcome(task, { members: [
      { path: '', state: 'removed', number: 0 },
      { path: '/dev/sdb', state: 'active sync', number: 1 },
    ] }, true)).toBe('pending')
  })
  it('新盘 spare rebuilding → rebuilding', () => {
    expect(replaceOutcome(task, { members: [
      { path: '/dev/sdd', state: 'spare rebuilding', number: 4 },
      { path: '/dev/sdb', state: 'active sync', number: 1 },
    ] }, true)).toBe('rebuilding')
  })
  it('新盘 active sync → done', () => {
    expect(replaceOutcome(task, { members: [
      { path: '/dev/sdd', state: 'active sync', number: 4 },
      { path: '/dev/sdb', state: 'active sync', number: 1 },
    ] }, true)).toBe('done')
  })
  it('盯的是新盘自身状态,不是阵列健康度:另一块盘 faulty 也算 done', () => {
    // 换的这块盘已经同步好了 —— 阵列仍 degraded 是另一块盘的故障,
    // 不该让这次替换的看板永远转下去。
    expect(replaceOutcome(task, { members: [
      { path: '/dev/sdd', state: 'active sync', number: 4 },
      { path: '/dev/sdb', state: 'faulty', number: 1 },
    ] }, true)).toBe('done')
  })
  it('新盘变 faulty(换上去又坏了)→ pending,不误报完成', () => {
    expect(replaceOutcome(task, { members: [
      { path: '/dev/sdd', state: 'faulty', number: 4 },
    ] }, true)).toBe('pending')
  })
})

// 降级 RAID5 的真实成员形状(2026-07-30 真机):4 行 —— 腾空的槽位 + 2 好盘 +
// 被踢出槽位的故障盘(slot: -1)。
const degradedRows = [
  { path: '/dev/sdd', state: 'active sync', number: 4, slot: 0 },
  { path: '', state: 'removed', number: 1, slot: 1 },
  { path: '/dev/sdc', state: 'active sync', number: 3, slot: 2 },
  { path: '/dev/sdb', state: 'faulty', number: 1, slot: -1 },
]

describe('slotMembers', () => {
  it('滤掉不占槽位的行(faulty 被踢出槽位),并按槽位排序', () => {
    const r = slotMembers(degradedRows)
    expect(r.map((m) => m.slot)).toEqual([0, 1, 2])
    expect(r.map((m) => m.path)).toEqual(['/dev/sdd', '', '/dev/sdc'])
    // 3 盘阵列 → 3 个盘位,不是 4
    expect(r.length).toBe(3)
  })
  it('闲置热备(slot -1)也不占盘位', () => {
    const r = slotMembers([
      { path: '/dev/sda', state: 'active sync', number: 0, slot: 0 },
      { path: '/dev/sdd', state: 'spare', number: 4, slot: -1 },
    ])
    expect(r.map((m) => m.path)).toEqual(['/dev/sda'])
  })
  it('槽位乱序输入也按槽位升序输出', () => {
    const r = slotMembers([
      { path: '/dev/sdc', state: 'active sync', number: 3, slot: 2 },
      { path: '/dev/sda', state: 'active sync', number: 0, slot: 0 },
      { path: '/dev/sdb', state: 'active sync', number: 1, slot: 1 },
    ])
    expect(r.map((m) => m.path)).toEqual(['/dev/sda', '/dev/sdb', '/dev/sdc'])
  })
  it('老后端不带 slot → 退回全体成员(而不是 0 个)', () => {
    const noSlot = [
      { path: '/dev/sda', state: 'active sync', number: 0 },
      { path: '/dev/sdb', state: 'active sync', number: 1 },
    ]
    expect(slotMembers(noSlot).length).toBe(2)
  })
  it('空输入安全', () => {
    expect(slotMembers([])).toEqual([])
    expect(slotMembers(undefined as never)).toEqual([])
  })
})

describe('memberDiskCount', () => {
  it('只数有设备路径的行:空槽位占位行不是一块盘', () => {
    expect(memberDiskCount(degradedRows)).toBe(3)
    expect(degradedRows.length).toBe(4) // 总行数确实是 4,所以不能用它当盘数
  })
  it('健康阵列 = 成员数', () => {
    expect(memberDiskCount([
      { path: '/dev/sda', state: 'active sync', number: 0, slot: 0 },
      { path: '/dev/sdb', state: 'active sync', number: 1, slot: 1 },
    ])).toBe(2)
  })
  it('物理拔盘(只有空槽位、无 faulty 行)→ 盘数少一个,如实反映', () => {
    expect(memberDiskCount([
      { path: '', state: 'removed', number: 0, slot: 0 },
      { path: '/dev/sdb', state: 'active sync', number: 1, slot: 1 },
      { path: '/dev/sdc', state: 'active sync', number: 2, slot: 2 },
    ])).toBe(2)
  })
  it('空输入安全', () => {
    expect(memberDiskCount([])).toBe(0)
    expect(memberDiskCount(undefined as never)).toBe(0)
  })
})

describe('mergeVacatedSlot', () => {
  it('唯一配对:空槽位 + 被弹出坏盘 合并成一行,放在空槽位原位置', () => {
    const r = mergeVacatedSlot(degradedRows)
    expect(r.length).toBe(3)
    expect(r.map((m) => m.path)).toEqual(['/dev/sdd', '/dev/sdb', '/dev/sdc'])
    const merged = r[1]
    expect(merged.state).toBe('faulty')
    expect(merged.vacatedSlot).toBe(1)      // 坏盘腾出的槽位
    expect(merged.slot).toBe(-1)            // 它自己已不占槽位
  })

  it('合并行带的是**空槽位**的槽位号,不是坏盘的设备编号', () => {
    // 实测形状:sdd 占 0 号槽位但设备编号是 4 —— 拿编号当槽位就会标错
    const rows = [
      { path: '', state: 'removed', number: 0, slot: 0 },
      { path: '/dev/sdb', state: 'active sync', number: 1, slot: 1 },
      { path: '/dev/sdc', state: 'active sync', number: 3, slot: 2 },
      { path: '/dev/sdd', state: 'faulty', number: 4, slot: -1 },
    ]
    const merged = mergeVacatedSlot(rows).find((m) => m.state === 'faulty')!
    expect(merged.vacatedSlot).toBe(0)
    expect(merged.number).toBe(4)
  })

  it('两个空槽位 + 两块坏盘(RAID6 双故障)→ 不合并,宁可多几行也不编造配对', () => {
    const rows = [
      { path: '', state: 'removed', number: 0, slot: 0 },
      { path: '', state: 'removed', number: 1, slot: 1 },
      { path: '/dev/sdc', state: 'active sync', number: 3, slot: 2 },
      { path: '/dev/sda', state: 'faulty', number: 0, slot: -1 },
      { path: '/dev/sdb', state: 'faulty', number: 1, slot: -1 },
    ]
    const r = mergeVacatedSlot(rows)
    expect(r.length).toBe(5)
    expect(r.some((m) => m.vacatedSlot != null)).toBe(false)
  })

  it('只有空槽位、没有坏盘行(物理拔盘)→ 保持原样', () => {
    const rows = [
      { path: '', state: 'removed', number: 0, slot: 0 },
      { path: '/dev/sdb', state: 'active sync', number: 1, slot: 1 },
    ]
    const r = mergeVacatedSlot(rows)
    expect(r.length).toBe(2)
    expect(r[0].path).toBe('')
    expect(r.some((m) => m.vacatedSlot != null)).toBe(false)
  })

  it('只有坏盘行、没有空槽位(重建已顶上)→ 保持原样', () => {
    const rows = [
      { path: '/dev/sdd', state: 'spare rebuilding', number: 4, slot: 0 },
      { path: '/dev/sdb', state: 'faulty', number: 1, slot: -1 },
    ]
    expect(mergeVacatedSlot(rows).length).toBe(2)
  })

  it('健康阵列:原样返回', () => {
    const rows = [
      { path: '/dev/sda', state: 'active sync', number: 0, slot: 0 },
      { path: '/dev/sdb', state: 'active sync', number: 1, slot: 1 },
    ]
    expect(mergeVacatedSlot(rows)).toEqual(rows)
  })

  it('老后端不带 slot → 不合并(无法判定坏盘是否已离开槽位)', () => {
    const rows = [
      { path: '', state: 'removed', number: 1 },
      { path: '/dev/sdb', state: 'faulty', number: 1 },
    ]
    expect(mergeVacatedSlot(rows).length).toBe(2)
  })

  it('空输入安全', () => {
    expect(mergeVacatedSlot([])).toEqual([])
    expect(mergeVacatedSlot(undefined as never)).toEqual([])
  })
})
