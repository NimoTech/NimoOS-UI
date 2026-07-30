import { describe, it, expect, vi } from 'vitest'
import {
  snapshotBrowsePath, parseSnapshotBrowsePath, liveVolumePath, parseSnapshotName,
  formatSnapshotBannerTime, findVolumeForPath, findVolumeUuidForMount,
  shouldGuardSnapshotView, resolveExitTarget, relPathUnderMount,
} from './snapshotPath'

describe('snapshotBrowsePath', () => {
  it('拼成 <挂载点>/.snapshots/<快照名>', () => {
    expect(snapshotBrowsePath('/DATA', '20260713T061900Z_manual_x')).toBe('/DATA/.snapshots/20260713T061900Z_manual_x')
  })
})

describe('parseSnapshotBrowsePath', () => {
  it('拆出 mount / snapshotName / relPath', () => {
    expect(parseSnapshotBrowsePath('/DATA/.snapshots/snap1/Photos/2024')).toEqual({
      mount: '/DATA', snapshotName: 'snap1', relPath: 'Photos/2024',
    })
  })
  it('快照根 relPath 为空串', () => {
    expect(parseSnapshotBrowsePath('/DATA/.snapshots/snap1')).toEqual({ mount: '/DATA', snapshotName: 'snap1', relPath: '' })
  })
  it('容忍末尾斜杠', () => {
    expect(parseSnapshotBrowsePath('/DATA/.snapshots/snap1/')).toEqual({ mount: '/DATA', snapshotName: 'snap1', relPath: '' })
  })
  it('段匹配而非子串匹配:名字里含 .snapshots 的普通目录不误判', () => {
    expect(parseSnapshotBrowsePath('/DATA/my.snapshotsbackup/x')).toBeNull()
  })
  it('多个 .snapshots 段取最左边那个(外层才是挂载边界)', () => {
    expect(parseSnapshotBrowsePath('/DATA/.snapshots/snap1/inner/.snapshots/deep')).toEqual({
      mount: '/DATA', snapshotName: 'snap1', relPath: 'inner/.snapshots/deep',
    })
  })
  it('没有挂载点前缀(以 /.snapshots 开头)返回 null', () => {
    expect(parseSnapshotBrowsePath('/.snapshots/snap1')).toBeNull()
  })
  it('.snapshots 自身(没选中任何快照)返回 null', () => {
    expect(parseSnapshotBrowsePath('/DATA/.snapshots')).toBeNull()
  })
  it('空值/非字符串返回 null', () => {
    expect(parseSnapshotBrowsePath('')).toBeNull()
    expect(parseSnapshotBrowsePath(null)).toBeNull()
  })
})

describe('liveVolumePath', () => {
  it('有相对路径就拼上', () => { expect(liveVolumePath('/DATA', 'Photos/2024')).toBe('/DATA/Photos/2024') })
  it('相对路径为空则回卷根', () => { expect(liveVolumePath('/DATA', '')).toBe('/DATA') })
})

describe('parseSnapshotName', () => {
  it('解析 ISO8601 basic 时间戳段', () => {
    const r = parseSnapshotName('20260713T061900Z_manual_改版前')
    expect(r?.createdAt.toISOString()).toBe('2026-07-13T06:19:00.000Z')
  })
  it('类型段不做校验:未知类型仍解析出时间', () => {
    expect(parseSnapshotName('20260713T061900Z_unknown')?.createdAt.toISOString()).toBe('2026-07-13T06:19:00.000Z')
  })
  it('格式不对返回 null 而不是抛错', () => {
    expect(parseSnapshotName('not-a-snapshot')).toBeNull()
    expect(parseSnapshotName('')).toBeNull()
  })
})

describe('formatSnapshotBannerTime', () => {
  it('解析失败时回退成原始名字,而不是空白', () => {
    expect(formatSnapshotBannerTime('weird-name')).toBe('weird-name')
  })
  it('解析成功时返回本地化时间串(非原始名)', () => {
    expect(formatSnapshotBannerTime('20260713T061900Z_manual')).not.toBe('20260713T061900Z_manual')
  })
})

describe('findVolumeForPath', () => {
  const vols = [
    { mount: '/DATA', volume_uuid: 'u-data' },
    { mount: '/DATA/sub', volume_uuid: 'u-sub' },
  ]
  it('取最长匹配的挂载前缀', () => {
    expect(findVolumeForPath(vols, '/DATA/sub/x')?.volume_uuid).toBe('u-sub')
    expect(findVolumeForPath(vols, '/DATA/other')?.volume_uuid).toBe('u-data')
  })
  it('挂载点自身也算命中', () => {
    expect(findVolumeForPath(vols, '/DATA')?.volume_uuid).toBe('u-data')
  })
  it('只是名字前缀相同不算命中(/DATAX 不属于 /DATA)', () => {
    expect(findVolumeForPath(vols, '/DATAX/y')).toBeNull()
  })
  it('非法输入返回 null', () => {
    expect(findVolumeForPath(vols, '')).toBeNull()
    expect(findVolumeForPath(null as never, '/DATA')).toBeNull()
  })
})

describe('findVolumeUuidForMount', () => {
  it('精确匹配,容忍末尾斜杠', () => {
    const vols = [{ mount: '/DATA/', volume_uuid: 'u1' }]
    expect(findVolumeUuidForMount(vols, '/DATA')).toBe('u1')
  })
  it('匹配不上返回 null', () => {
    expect(findVolumeUuidForMount([{ mount: '/A', volume_uuid: 'u1' }], '/B')).toBeNull()
  })
})

describe('shouldGuardSnapshotView(fail-safe 方向不得反转)', () => {
  const info = { mount: '/DATA', snapshotName: 's1', relPath: '' }
  it('路径本身不是快照 → 不锁', () => {
    expect(shouldGuardSnapshotView(null, { status: 'ready', volumes: [] })).toBe(false)
  })
  it('卷列表还没拉(idle)→ 保持锁定', () => {
    expect(shouldGuardSnapshotView(info, { status: 'idle', volumes: [] })).toBe(true)
  })
  it('卷列表在途(loading)→ 保持锁定', () => {
    expect(shouldGuardSnapshotView(info, { status: 'loading', volumes: [] })).toBe(true)
  })
  it('卷列表拉失败(error)→ 保持锁定', () => {
    expect(shouldGuardSnapshotView(info, { status: 'error', volumes: [] })).toBe(true)
  })
  it('已 ready 但列表里没有这个挂载点 → 保持锁定', () => {
    expect(shouldGuardSnapshotView(info, { status: 'ready', volumes: [{ mount: '/OTHER', supported: true }] })).toBe(true)
  })
  it('已 ready 且精确命中且 supported === false → 唯一解锁条件', () => {
    expect(shouldGuardSnapshotView(info, { status: 'ready', volumes: [{ mount: '/DATA', supported: false }] })).toBe(false)
  })
  it('已 ready 且命中但 supported === true → 锁定(这是真快照)', () => {
    expect(shouldGuardSnapshotView(info, { status: 'ready', volumes: [{ mount: '/DATA', supported: true }] })).toBe(true)
  })
  it('state 为 null/undefined → 保持锁定', () => {
    expect(shouldGuardSnapshotView(info, null)).toBe(true)
  })
})

describe('resolveExitTarget', () => {
  it('活卷上同名目录还在 → 回到那里', async () => {
    const dirExists = vi.fn().mockResolvedValue(true)
    await expect(resolveExitTarget({ mount: '/DATA', snapshotName: 's1', relPath: 'Photos/2024' }, dirExists))
      .resolves.toBe('/DATA/Photos/2024')
    expect(dirExists).toHaveBeenCalledWith('/DATA/Photos/2024')
  })
  it('活卷上该目录已不存在 → 回卷根', async () => {
    await expect(resolveExitTarget({ mount: '/DATA', snapshotName: 's1', relPath: 'gone' }, async () => false))
      .resolves.toBe('/DATA')
  })
  it('info 为 null → null', async () => {
    await expect(resolveExitTarget(null, async () => true)).resolves.toBeNull()
  })
})

describe('relPathUnderMount', () => {
  it('挂载点自身 → 空串', () => { expect(relPathUnderMount('/DATA', '/DATA')).toBe('') })
  it('取相对卷根的路径', () => { expect(relPathUnderMount('/DATA', '/DATA/Photos/2024')).toBe('Photos/2024') })
  it('容忍两侧末尾斜杠', () => { expect(relPathUnderMount('/DATA/', '/DATA/Photos/')).toBe('Photos') })
  it('路径不在该挂载点下 → 空串(退回卷根,不猜)', () => {
    expect(relPathUnderMount('/DATA', '/OTHER/x')).toBe('')
    expect(relPathUnderMount('/DATA', '/DATAX/x')).toBe('')
  })
  it('空输入 → 空串', () => { expect(relPathUnderMount('', '/DATA/x')).toBe('') })
})
