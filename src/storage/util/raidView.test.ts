import { describe, it, expect } from 'vitest'
import {
  mapTask, resolveRaidState, raidSeverity, raidStateLabelKey,
  countActiveDisks, memberSquare, memberRow, raidUsagePercent, mirrorPairs, isRebuildingList, replaceOutcome, reclaimOutcome,
  slotMembers, memberDiskCount, mergeVacatedSlot,
  levelInfo, asRaidArray,
} from './raidView'
import type { RaidArray } from './raidView'

const arr = (o: Partial<RaidArray> = {}): RaidArray =>
  ({ id: 1, name: 'md0', level: 1, state: 'active', ...o }) as RaidArray

describe('resolveRaidState', () => {
  it('healthy: active with no rebuild → all flags false', () => {
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
  it('live_state containing resyncing also counts as rebuilding', () => {
    const f = resolveRaidState(arr({ state: 'active' }), { live_state: 'resyncing', rebuild_pct: 0 } as never)
    expect(f.isRebuilding).toBe(true)
  })
  it('rebuild_pct>0 also counts as rebuilding', () => {
    const f = resolveRaidState(arr({ state: 'active' }), { live_state: 'active', rebuild_pct: 5 } as never)
    expect(f.isRebuilding).toBe(true)
  })
  it('degraded and not rebuilding → isDegraded, danger', () => {
    const f = resolveRaidState(arr({ state: 'degraded' }), { live_state: 'degraded', rebuild_pct: 0 } as never)
    expect(f.isDegraded).toBe(true)
    expect(raidSeverity(f)).toBe('danger')
    expect(raidStateLabelKey(f)).toBe('raidStateDegraded')
  })
  it('degraded and rebuilding → isRebuilding takes priority, isDegraded=false', () => {
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
  it('falls back to array.state when status is missing', () => {
    const f = resolveRaidState(arr({ state: 'degraded' }), undefined)
    expect(f.effectiveState).toBe('degraded')
  })
})

describe('countActiveDisks', () => {
  it('prefix-matches "active sync" (including set-A/set-B)', () => {
    const members = [
      { path: '/dev/sda', state: 'active sync set-A', number: 0 },
      { path: '/dev/sdb', state: 'active sync set-B', number: 1 },
      { path: '/dev/sdc', state: 'faulty', number: 2 },
    ]
    expect(countActiveDisks(members, 3)).toBe(2)
  })
  it('falls back to the fallback count when members is empty', () => {
    expect(countActiveDisks([], 4)).toBe(4) // empty array → fall back to total (member_disks count)
  })
})

describe('asRaidArray', () => {
  it('maps id/name/level/state, level converted to Number', () => {
    const a = asRaidArray({ id: 3, name: 'md3', level: 5, state: 'active' })
    expect(a.id).toBe(3)
    expect(a.name).toBe('md3')
    expect(a.level).toBe(5)
    expect(a.state).toBe('active')
  })
  it('gives safe defaults for missing fields', () => {
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
  it('containing rebuilding → rebuild', () => { expect(memberSquare('spare rebuilding').kind).toBe('rebuild') })
  it('anything else → unknown', () => { expect(memberSquare('spare').kind).toBe('unknown') })
})

// The memberRow and memberSquare mappings are **deliberately different**: card squares put removed
// into red fail (Vue2 RaidCard L130), while detail rows only mark faulty red and removed goes gray
// (Vue2 RaidDetailPanel memberColor L343-350 / memberStateLabel L351-357).
describe('memberRow', () => {
  it('active sync* → green + active', () => {
    expect(memberRow('active sync set-A')).toEqual({ token: '--sem-fg', labelKey: 'raidMemberActive' })
  })
  it('faulty → red + faulty', () => {
    expect(memberRow('faulty')).toEqual({ token: '--remove-fg', labelKey: 'raidMemberFaulty' })
  })
  it('containing rebuilding → blue + rebuilding', () => {
    expect(memberRow('spare rebuilding')).toEqual({ token: '--accent', labelKey: 'raidMemberRebuilding' })
  })
  it('removed does not reuse the faulty copy/color (an empty slot is not a faulty disk)', () => {
    expect(memberRow('removed')).toEqual({ token: '--fg-muted', labelKey: 'raidMemberRemoved' })
    expect(memberRow('removed').labelKey).not.toBe(memberRow('faulty').labelKey)
    expect(memberRow('removed').token).not.toBe(memberRow('faulty').token)
  })
  it('unknown state → gray + empty labelKey (caller falls back to the raw string)', () => {
    expect(memberRow('spare')).toEqual({ token: '--fg-muted', labelKey: '' })
    expect(memberRow('')).toEqual({ token: '--fg-muted', labelKey: '' })
  })
})

describe('raidUsagePercent', () => {
  it('regular rounding', () => { expect(raidUsagePercent(50, 100)).toBe(50) })
  it('total=0 → 0', () => { expect(raidUsagePercent(10, 0)).toBe(0) })
  it('nonzero but <1% → clamped to 1', () => { expect(raidUsagePercent(1, 100000)).toBe(1) })
  it('used=0 → 0', () => { expect(raidUsagePercent(0, 100)).toBe(0) })
})

describe('mapTask', () => {
  it('maps snake_case API fields to camelCase', () => {
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
  it('gives safe defaults for missing fields', () => {
    const t = mapTask({ task_id: 'x', status: 'creating' })
    expect(t.name).toBe(''); expect(t.progress).toBe(0); expect(t.diskCount).toBe(0)
  })
})

// Test cases mirror Vue2 tests/raidMirrorPairs.test.js (69ea4798): pairs by slot, not by mdadm Number.
describe('mirrorPairs (RAID10)', () => {
  it('pairs by floor(slot/2), not by the mdadm device number', () => {
    // After a disk replacement, the new member gets number=4 but occupies slot 3: it mirrors the disk at slot 2, there is no phantom third pair.
    const members = [
      { path: '/dev/sdd', state: 'active sync set-A', number: 0, slot: 0 },
      { path: '/dev/sdc', state: 'active sync set-B', number: 1, slot: 1 },
      { path: '/dev/sda', state: 'active sync set-A', number: 2, slot: 2 },
      { path: '/dev/sdb', state: 'spare rebuilding', number: 4, slot: 3 },
    ]
    const pairs = mirrorPairs(members)
    expect(pairs.length).toBe(2)
    expect(pairs[0].map((m) => m.path)).toEqual(['/dev/sdd', '/dev/sdc'])
    expect(pairs[1].map((m) => m.path)).toEqual(['/dev/sda', '/dev/sdb'])
  })
  it('rows with no slot (ejected faulty disks / idle spares / rows without a slot) belong to no pair', () => {
    const members = [
      { path: '/dev/sda', state: 'active sync', number: 0, slot: 0 },
      { path: '/dev/sdb', state: 'active sync', number: 1, slot: 1 },
      { path: '/dev/sde', state: 'faulty', number: 4, slot: -1 },
      { path: '', state: '', slot: -1 },
    ]
    const pairs = mirrorPairs(members)
    expect(pairs.length).toBe(1)
    expect(pairs[0].length).toBe(2)
  })
  it('a degraded pair is kept as a single-member pair', () => {
    const members = [
      { path: '/dev/sda', state: 'active sync', slot: 0 },
      { path: '/dev/sdb', state: 'active sync', slot: 1 },
      { path: '/dev/sdc', state: 'active sync', slot: 2 },
      // slot 3 was pulled: mdadm's removed placeholder row has no path, omitted here
    ]
    const pairs = mirrorPairs(members)
    expect(pairs.length).toBe(2)
    expect(pairs[1].map((m) => m.path)).toEqual(['/dev/sdc'])
  })
  it('mergeVacatedSlot merged row is placed by vacatedSlot, it does not vanish from the mirror pair', () => {
    // The merged row's own slot=-1 (ejected), but it fills the vacancy at slot 0 — it should pair by vacatedSlot=0
    const members = [
      { path: '/dev/sda', state: 'faulty', slot: -1, vacatedSlot: 0 },
      { path: '/dev/sdb', state: 'active sync', slot: 1 },
      { path: '/dev/sdc', state: 'active sync', slot: 2 },
      { path: '/dev/sdd', state: 'active sync', slot: 3 },
    ]
    const pairs = mirrorPairs(members)
    expect(pairs.length).toBe(2)
    expect(pairs[0].map((m) => m.path)).toEqual(['/dev/sda', '/dev/sdb'])
  })
  it('empty input / old backend with no slot on any member → no pairs (caller falls back to a flat list)', () => {
    expect(mirrorPairs([])).toEqual([])
    expect(mirrorPairs<{ path: string; slot?: number }>([{ path: '/dev/sda' }, { path: '/dev/sdb' }])).toEqual([])
  })
})

describe('isRebuildingList', () => {
  it('any array rebuilding → true (drives the 5000ms refetch)', () => {
    const flags = [
      { isRebuilding: false } as never,
      { isRebuilding: true } as never,
    ]
    expect(isRebuildingList(flags)).toBe(true)
  })
  it('none rebuilding → false', () => {
    expect(isRebuildingList([{ isRebuilding: false } as never])).toBe(false)
  })
})

describe('levelInfo', () => {
  it('known levels (0/1/5/6/10) return non-null', () => {
    expect(levelInfo(0)).not.toBeNull()
    expect(levelInfo(1)).not.toBeNull()
    expect(levelInfo(5)).not.toBeNull()
    expect(levelInfo(6)).not.toBeNull()
    expect(levelInfo(10)).not.toBeNull()
  })
  it('unknown level returns null', () => {
    expect(levelInfo(99)).toBeNull()
  })
})

describe('replaceOutcome', () => {
  const task = { arrayId: '1', arrayName: 'md0', oldPath: '/dev/sda', newPath: '/dev/sdd' }

  it('array no longer in the list → gone (does not report completion)', () => {
    expect(replaceOutcome(task, { members: [] }, false)).toBe('gone')
  })
  it('status unreachable → pending', () => {
    expect(replaceOutcome(task, null, true)).toBe('pending')
    expect(replaceOutcome(task, undefined, true)).toBe('pending')
  })
  it('new disk has not appeared in the member table yet → pending (kernel has not registered it after mdadm --add)', () => {
    expect(replaceOutcome(task, { members: [
      { path: '', state: 'removed', number: 0 },
      { path: '/dev/sdb', state: 'active sync', number: 1 },
    ] }, true)).toBe('pending')
  })
  it('new disk spare rebuilding → rebuilding', () => {
    expect(replaceOutcome(task, { members: [
      { path: '/dev/sdd', state: 'spare rebuilding', number: 4 },
      { path: '/dev/sdb', state: 'active sync', number: 1 },
    ] }, true)).toBe('rebuilding')
  })
  it('new disk active sync → done', () => {
    expect(replaceOutcome(task, { members: [
      { path: '/dev/sdd', state: 'active sync', number: 4 },
      { path: '/dev/sdb', state: 'active sync', number: 1 },
    ] }, true)).toBe('done')
  })
  it('focuses on the state of the new disk itself, not overall array health: another disk being faulty still counts as done', () => {
    // The replaced disk has finished syncing —— the array staying degraded is another disk's failure,
    // which must not keep this replacement's dashboard spinning forever.
    expect(replaceOutcome(task, { members: [
      { path: '/dev/sdd', state: 'active sync', number: 4 },
      { path: '/dev/sdb', state: 'faulty', number: 1 },
    ] }, true)).toBe('done')
  })
  it('new disk turns faulty (failed again after being swapped in) → pending, does not falsely report completion', () => {
    expect(replaceOutcome(task, { members: [
      { path: '/dev/sdd', state: 'faulty', number: 4 },
    ] }, true)).toBe('pending')
  })
})

describe('reclaimOutcome (reclaim member disks: replaceOutcome over several disks)', () => {
  const task = { arrayId: '1', arrayName: 'md0', paths: ['/dev/sdc', '/dev/sdd'] }

  it('array no longer in the list -> gone (does not report completion)', () => {
    expect(reclaimOutcome(task, { members: [] }, false)).toBe('gone')
  })
  it('status unreachable -> pending', () => {
    expect(reclaimOutcome(task, null, true)).toBe('pending')
    expect(reclaimOutcome(task, undefined, true)).toBe('pending')
  })
  // The real shape in the first seconds after --re-add: the disk is registered but still a spare,
  // with no rebuilding anywhere —— this is the transition window behind "polling must not hang off
  // isRebuilding alone", and the task has to stay pending to hold it open.
  it('reclaimed disk still a spare (kernel has not started recovery) -> pending', () => {
    expect(reclaimOutcome(task, { members: [
      { path: '/dev/sdc', state: 'spare', number: 4 },
      { path: '/dev/sdd', state: 'spare', number: 5 },
    ] }, true)).toBe('pending')
  })
  it('a disk has not appeared in the member table yet -> pending', () => {
    expect(reclaimOutcome(task, { members: [
      { path: '/dev/sdc', state: 'active sync', number: 4 },
    ] }, true)).toBe('pending')
  })
  it('any reclaimed disk spare rebuilding -> rebuilding', () => {
    expect(reclaimOutcome(task, { members: [
      { path: '/dev/sdc', state: 'spare rebuilding', number: 4 },
      { path: '/dev/sdd', state: 'spare', number: 5 },
    ] }, true)).toBe('rebuilding')
  })
  it('some active, some not in place yet -> not done', () => {
    expect(reclaimOutcome(task, { members: [
      { path: '/dev/sdc', state: 'active sync', number: 4 },
      { path: '/dev/sdd', state: 'spare rebuilding', number: 5 },
    ] }, true)).toBe('rebuilding')
  })
  it('all active sync -> done; another disk being faulty does not matter (watches the reclaimed disks, not array health)', () => {
    expect(reclaimOutcome(task, { members: [
      { path: '/dev/sdc', state: 'active sync', number: 4 },
      { path: '/dev/sdd', state: 'active sync', number: 5 },
      { path: '/dev/sdb', state: 'faulty', number: 1 },
    ] }, true)).toBe('done')
  })
})

// Real member shape of a degraded RAID5 (on-device 2026-07-30): 4 rows —— the vacated slot + 2 good
// disks + the faulty disk kicked out of its slot (slot: -1).
const degradedRows = [
  { path: '/dev/sdd', state: 'active sync', number: 4, slot: 0 },
  { path: '', state: 'removed', number: 1, slot: 1 },
  { path: '/dev/sdc', state: 'active sync', number: 3, slot: 2 },
  { path: '/dev/sdb', state: 'faulty', number: 1, slot: -1 },
]

describe('slotMembers', () => {
  it('filters out rows with no slot (faulty disks kicked out of their slot), and sorts by slot', () => {
    const r = slotMembers(degradedRows)
    expect(r.map((m) => m.slot)).toEqual([0, 1, 2])
    expect(r.map((m) => m.path)).toEqual(['/dev/sdd', '', '/dev/sdc'])
    // 3-disk array → 3 slots, not 4
    expect(r.length).toBe(3)
  })
  it('an idle spare (slot -1) also does not occupy a disk slot', () => {
    const r = slotMembers([
      { path: '/dev/sda', state: 'active sync', number: 0, slot: 0 },
      { path: '/dev/sdd', state: 'spare', number: 4, slot: -1 },
    ])
    expect(r.map((m) => m.path)).toEqual(['/dev/sda'])
  })
  it('out-of-order slot input is still output sorted ascending by slot', () => {
    const r = slotMembers([
      { path: '/dev/sdc', state: 'active sync', number: 3, slot: 2 },
      { path: '/dev/sda', state: 'active sync', number: 0, slot: 0 },
      { path: '/dev/sdb', state: 'active sync', number: 1, slot: 1 },
    ])
    expect(r.map((m) => m.path)).toEqual(['/dev/sda', '/dev/sdb', '/dev/sdc'])
  })
  it('old backend without slot → falls back to all members (not 0)', () => {
    const noSlot = [
      { path: '/dev/sda', state: 'active sync', number: 0 },
      { path: '/dev/sdb', state: 'active sync', number: 1 },
    ]
    expect(slotMembers(noSlot).length).toBe(2)
  })
  it('safe on empty input', () => {
    expect(slotMembers([])).toEqual([])
    expect(slotMembers(undefined as never)).toEqual([])
  })
})

describe('memberDiskCount', () => {
  it('counts only rows with a device path: an empty-slot placeholder row is not a disk', () => {
    expect(memberDiskCount(degradedRows)).toBe(3)
    expect(degradedRows.length).toBe(4) // total row count really is 4, so it cannot be used as the disk count
  })
  it('a healthy array = member count', () => {
    expect(memberDiskCount([
      { path: '/dev/sda', state: 'active sync', number: 0, slot: 0 },
      { path: '/dev/sdb', state: 'active sync', number: 1, slot: 1 },
    ])).toBe(2)
  })
  it('physically pulled disk (only an empty slot, no faulty row) → disk count is one less, reflected accurately', () => {
    expect(memberDiskCount([
      { path: '', state: 'removed', number: 0, slot: 0 },
      { path: '/dev/sdb', state: 'active sync', number: 1, slot: 1 },
      { path: '/dev/sdc', state: 'active sync', number: 2, slot: 2 },
    ])).toBe(2)
  })
  it('safe on empty input', () => {
    expect(memberDiskCount([])).toBe(0)
    expect(memberDiskCount(undefined as never)).toBe(0)
  })
})

describe('mergeVacatedSlot', () => {
  it('the single pairing: an empty slot + the ejected bad disk merge into one row, placed at the original position of the empty slot', () => {
    const r = mergeVacatedSlot(degradedRows)
    expect(r.length).toBe(3)
    expect(r.map((m) => m.path)).toEqual(['/dev/sdd', '/dev/sdb', '/dev/sdc'])
    const merged = r[1]
    expect(merged.state).toBe('faulty')
    expect(merged.vacatedSlot).toBe(1)      // the slot the bad disk vacated
    expect(merged.slot).toBe(-1)            // it no longer occupies a slot itself
  })

  it('the merged row carries the slot number of the **empty slot**, not the device number of the bad disk', () => {
    // Measured shape: sdd occupies slot 0 but its device number is 4 —— using the number as the slot mislabels it
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

  it('two empty slots + two bad disks (RAID6 double failure) → does not merge, prefers extra rows over fabricating a pairing', () => {
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

  it('only an empty slot, no bad disk row (physical disk pull) → stays unchanged', () => {
    const rows = [
      { path: '', state: 'removed', number: 0, slot: 0 },
      { path: '/dev/sdb', state: 'active sync', number: 1, slot: 1 },
    ]
    const r = mergeVacatedSlot(rows)
    expect(r.length).toBe(2)
    expect(r[0].path).toBe('')
    expect(r.some((m) => m.vacatedSlot != null)).toBe(false)
  })

  it('only a bad disk row, no empty slot (rebuild has already filled it) → stays unchanged', () => {
    const rows = [
      { path: '/dev/sdd', state: 'spare rebuilding', number: 4, slot: 0 },
      { path: '/dev/sdb', state: 'faulty', number: 1, slot: -1 },
    ]
    expect(mergeVacatedSlot(rows).length).toBe(2)
  })

  it('healthy array: returned unchanged', () => {
    const rows = [
      { path: '/dev/sda', state: 'active sync', number: 0, slot: 0 },
      { path: '/dev/sdb', state: 'active sync', number: 1, slot: 1 },
    ]
    expect(mergeVacatedSlot(rows)).toEqual(rows)
  })

  it('old backend without slot → does not merge (cannot determine whether the bad disk has left its slot)', () => {
    const rows = [
      { path: '', state: 'removed', number: 1 },
      { path: '/dev/sdb', state: 'faulty', number: 1 },
    ]
    expect(mergeVacatedSlot(rows).length).toBe(2)
  })

  it('safe on empty input', () => {
    expect(mergeVacatedSlot([])).toEqual([])
    expect(mergeVacatedSlot(undefined as never)).toEqual([])
  })
})
