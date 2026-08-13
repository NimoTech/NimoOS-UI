import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSnapshotBrowseStore } from './snapshotBrowse'
import { useFilesStore } from './files'
import { useToast } from '../../stores/toast'

const listVolumesMock = vi.fn()
const restoreMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { snapshot: { listVolumes: () => listVolumesMock(), restore: (b: unknown) => restoreMock(b) } },
}))

const VOLS = [
  { volume_uuid: 'u-data', mount: '/DATA', supported: true },
  { volume_uuid: 'u-usb', mount: '/mnt/usb', supported: false },
]

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  listVolumesMock.mockResolvedValue(VOLS)
})

describe('ensureVolumes', () => {
  it('拉一次就落 ready', async () => {
    const s = useSnapshotBrowseStore()
    expect(s.status).toBe('idle')
    await s.ensureVolumes()
    expect(s.status).toBe('ready')
    expect(s.volumes).toEqual(VOLS)
    expect(listVolumesMock).toHaveBeenCalledTimes(1)
  })
  it('重复调用不重复发请求(每会话一次)', async () => {
    const s = useSnapshotBrowseStore()
    await s.ensureVolumes()
    await s.ensureVolumes()
    expect(listVolumesMock).toHaveBeenCalledTimes(1)
  })
  it('并发调用共用同一次在途请求', async () => {
    let release: (v: unknown) => void = () => {}
    listVolumesMock.mockImplementation(() => new Promise((r) => { release = r }))
    const s = useSnapshotBrowseStore()
    const a = s.ensureVolumes()
    const b = s.ensureVolumes()
    expect(s.status).toBe('loading')
    release(VOLS)
    await Promise.all([a, b])
    expect(listVolumesMock).toHaveBeenCalledTimes(1)
    expect(s.status).toBe('ready')
  })
  it('失败落 error 且不抛出去(快照是可选功能,老后端全 404)', async () => {
    listVolumesMock.mockRejectedValue(new Error('404'))
    const s = useSnapshotBrowseStore()
    await expect(s.ensureVolumes()).resolves.toBeUndefined()
    expect(s.status).toBe('error')
    expect(s.volumes).toEqual([])
  })
  it('返回非数组时退化成空列表', async () => {
    listVolumesMock.mockResolvedValue(null)
    const s = useSnapshotBrowseStore()
    await s.ensureVolumes()
    expect(s.volumes).toEqual([])
    expect(s.status).toBe('ready')
  })
  it('reset 顶掉在途请求,陈旧响应落地后不覆盖 reset 之后新请求的结果', async () => {
    let releaseStale: (v: unknown) => void = () => {}
    listVolumesMock.mockImplementationOnce(() => new Promise((r) => { releaseStale = r }))
    const s = useSnapshotBrowseStore()

    const stale = s.ensureVolumes() // P1 in flight, not yet resolved
    expect(s.status).toBe('loading')

    s.reset() // supersedes the P1 generation
    expect(s.status).toBe('idle')

    const FRESH = [{ volume_uuid: 'u-fresh', mount: '/DATA2', supported: true }]
    listVolumesMock.mockImplementationOnce(() => Promise.resolve(FRESH))
    const fresh = s.ensureVolumes() // P2: the new generation started after reset
    await fresh
    expect(s.status).toBe('ready')
    expect(s.volumes).toEqual(FRESH)

    // Only now release P1's resolve — the stale response must be discarded entirely, never clobbering P2's already-landed result
    releaseStale(VOLS)
    await stale
    expect(s.status).toBe('ready')
    expect(s.volumes).toEqual(FRESH)
  })
})

describe('浏览态派生', () => {
  it('普通路径不是快照视图', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/Photos'
    await s.ensureVolumes()
    expect(s.isSnapshotView).toBe(false)
    expect(s.browseInfo).toBeNull()
  })
  it('快照路径 + 卷 supported → 锁定,browseInfo 出结果', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/.snapshots/snap1/Photos'
    await s.ensureVolumes()
    expect(s.isSnapshotView).toBe(true)
    expect(s.browseInfo).toEqual({ mount: '/DATA', snapshotName: 'snap1', relPath: 'Photos' })
  })
  it('卷列表还没拉时,快照路径同样保持锁定(fail-safe)', () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/.snapshots/snap1'
    expect(s.status).toBe('idle')
    expect(s.isSnapshotView).toBe(true)
  })
  it('确认 supported:false 的挂载点上,叫 .snapshots 的普通目录不误锁', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/mnt/usb/.snapshots/whatever'
    await s.ensureVolumes()
    expect(s.isSnapshotView).toBe(false)
  })
  // Review fix (Critical 1): the `.snapshots` container directory itself (path without a concrete snapshot name) —
  // parseSnapshotBrowsePath returns null for it, shouldGuardSnapshotView alone can't decide to lock, so
  // isSnapshotsContainerPath must catch it. The breadcrumb's most natural "go up one level" gesture lands exactly on this path.
  it('.snapshots 容器目录本身(未选中具体快照)也保持锁定', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/.snapshots'
    await s.ensureVolumes()
    expect(s.isSnapshotView).toBe(true)
    expect(s.browseInfo).toBeNull() // no snapshot name means no timestamp to show; the banner's current shape relies on this
  })

  // Review recheck (Critical 1, round 2): the previous round's implementation decided the container path via volumes.some(...),
  // which is always false while volumes is empty (idle/loading/error) — a real probe confirmed all three states leaked the lock, and error
  // is ensureVolumes()'s terminal state for the session (this device 404s on all of /v2/snapshot/*), so the leak persists for the whole session.
  // These three cases each independently trigger one of the three states a real probe can capture, no longer relying on inference.
  describe('.snapshots 容器目录三态复核(Critical 1 第二轮:上一轮在此漏锁)', () => {
    it('idle(volumes 还没拉)→ 保持锁定', () => {
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/.snapshots'
      expect(s.status).toBe('idle')
      expect(s.isSnapshotView).toBe(true)
    })
    it('loading(请求在途)→ 保持锁定', () => {
      let release: (v: unknown) => void = () => {}
      listVolumesMock.mockImplementation(() => new Promise((r) => { release = r }))
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/.snapshots'
      s.ensureVolumes()
      expect(s.status).toBe('loading')
      expect(s.isSnapshotView).toBe(true)
      release(VOLS) // cleanup: keep the dangling in-flight promise from leaking into the next case
    })
    it('error(拉取失败,本会话终态)→ 保持锁定', async () => {
      listVolumesMock.mockRejectedValue(new Error('404'))
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/DATA/.snapshots'
      await s.ensureVolumes()
      expect(s.status).toBe('error')
      expect(s.isSnapshotView).toBe(true)
    })
    it('已 ready 且确认 supported:false 的挂载点上,容器目录本身不误锁', async () => {
      const s = useSnapshotBrowseStore(); const files = useFilesStore()
      files.currentPath = '/mnt/usb/.snapshots'
      await s.ensureVolumes()
      expect(s.status).toBe('ready')
      expect(s.isSnapshotView).toBe(false)
    })
  })
})

describe('canShowEntry 真值表', () => {
  it('ready + 命中 supported 卷 + 不在快照里 → 显示', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/Photos'
    await s.ensureVolumes()
    expect(s.canShowEntry).toBe(true)
  })
  it('还没 ready → 不显示(避免闪现)', () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/Photos'
    expect(s.canShowEntry).toBe(false)
  })
  it('路径不属于任何快照卷 → 不显示', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/mnt/smb-host/x'
    await s.ensureVolumes()
    expect(s.canShowEntry).toBe(false)
  })
  it('卷 supported:false → 不显示', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/mnt/usb/x'
    await s.ensureVolumes()
    expect(s.canShowEntry).toBe(false)
  })
  it('已经在快照里 → 不显示', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/.snapshots/snap1'
    await s.ensureVolumes()
    expect(s.canShowEntry).toBe(false)
  })
  it('.snapshots 容器目录本身 → 不显示(Critical 1,否则时间机器 chip 和只读锁一起冒出来)', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/.snapshots'
    await s.ensureVolumes()
    expect(s.canShowEntry).toBe(false)
  })
})

describe('时间机器开关', () => {
  it('open/close 切换,reset 归位', async () => {
    const s = useSnapshotBrowseStore()
    s.openWheel(); expect(s.wheelOpen).toBe(true)
    s.closeWheel(); expect(s.wheelOpen).toBe(false)
    await s.ensureVolumes()
    s.openWheel()
    s.reset()
    expect(s.wheelOpen).toBe(false)
    expect(s.status).toBe('idle')
    expect(s.volumes).toEqual([])
  })
})

describe('恢复', () => {
  const inSnapshot = async () => {
    const s = useSnapshotBrowseStore()
    useFilesStore().currentPath = '/DATA/.snapshots/snap1/Photos'
    await s.ensureVolumes()
    return s
  }
  it('单条成功:toast 报出恢复后的路径', async () => {
    restoreMock.mockResolvedValue({ restored_path: '/DATA/Photos/a.jpg.restored-1' })
    const s = await inSnapshot()
    await s.restore([{ path: '/DATA/.snapshots/snap1/Photos/a.jpg' }])
    expect(useToast().msg).toContain('/DATA/Photos/a.jpg.restored-1')
  })
  it('多条成功:toast 只报条数,不逐条刷屏', async () => {
    restoreMock.mockResolvedValue({ restored_path: '/DATA/x.restored-1' })
    const s = await inSnapshot()
    await s.restore([{ path: '/DATA/.snapshots/snap1/a' }, { path: '/DATA/.snapshots/snap1/b' }])
    expect(restoreMock).toHaveBeenCalledTimes(2)
    expect(useToast().msg).toContain('2')
  })
  it('恢复期间 restoring 为真,结束落回 false', async () => {
    let release: (v: unknown) => void = () => {}
    restoreMock.mockImplementation(() => new Promise((r) => { release = r }))
    const s = await inSnapshot()
    const p = s.restore([{ path: '/DATA/.snapshots/snap1/a' }])
    expect(s.restoring).toBe(true)
    // restore() awaits listVolumes() before it actually calls restoreMock and captures its resolver —
    // that step crosses a microtask boundary, so we can't release() synchronously right after calling s.restore(); otherwise
    // we'd still hold the initial empty no-op and p would never settle (hit this once before, ran into the 5s timeout).
    await vi.waitFor(() => expect(restoreMock).toHaveBeenCalled())
    release({ restored_path: '/DATA/a.restored-1' })
    await p
    expect(s.restoring).toBe(false)
  })
  it('在途时再次调用直接忽略(防重复提交)', async () => {
    let release: (v: unknown) => void = () => {}
    restoreMock.mockImplementation(() => new Promise((r) => { release = r }))
    const s = await inSnapshot()
    const p = s.restore([{ path: '/DATA/.snapshots/snap1/a' }])
    await s.restore([{ path: '/DATA/.snapshots/snap1/b' }])
    release({ restored_path: '/x' })
    await p
    expect(restoreMock).toHaveBeenCalledTimes(1)
  })
  it('404 → 专用文案', async () => {
    restoreMock.mockRejectedValue(Object.assign(new Error('gone'), { code: 404 }))
    const s = await inSnapshot()
    await s.restore([{ path: '/DATA/.snapshots/snap1/a' }])
    expect(useToast().msg).toContain('找不到')
  })
  // Review finding: on mixed results (some succeed, some fail), the original `&& !failed` check short-circuited
  // both success branches, leaving only the failure copy — the entries that actually restored were silently swallowed. Human decision: emit one new toast
  // (snapBrowseRestoredPartial) stating "N succeeded, M failed", without stacking the specific failure-reason copy on top.
  it('混合结果(部分成功部分失败):toast 同时报出成功与失败条数,不吞成功也不叠加失败原因', async () => {
    restoreMock
      .mockResolvedValueOnce({ restored_path: '/DATA/a.restored-1' })
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { code: 404 }))
      .mockResolvedValueOnce({ restored_path: '/DATA/c.restored-1' })
    const s = await inSnapshot()
    await s.restore([
      { path: '/DATA/.snapshots/snap1/a' },
      { path: '/DATA/.snapshots/snap1/b' },
      { path: '/DATA/.snapshots/snap1/c' },
    ])
    expect(restoreMock).toHaveBeenCalledTimes(3)
    expect(useToast().msg).toContain('2') // 2 succeeded (a, c)
    expect(useToast().msg).toContain('1') // 1 failed (b)
    expect(useToast().msg).not.toContain('找不到') // no longer stacks the specific failure-reason copy
  })
  // Guard against wiring the mixed branch at the cost of the "all failed" path: when multiple entries all fail, it must still land on the specific-reason copy,
  // not fall into the mixed branch by mistake (the mixed branch's condition is ok.length > 0).
  it('多条全部失败:仍走具体原因文案,不误判成混合结果', async () => {
    restoreMock
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { code: 404 }))
      .mockRejectedValueOnce(Object.assign(new Error('bad'), { code: 400 }))
    const s = await inSnapshot()
    await s.restore([{ path: '/DATA/.snapshots/snap1/a' }, { path: '/DATA/.snapshots/snap1/b' }])
    expect(restoreMock).toHaveBeenCalledTimes(2)
    expect(useToast().msg).toContain('找不到')
  })
  it('空选区不发请求', async () => {
    const s = await inSnapshot()
    await s.restore([])
    expect(restoreMock).not.toHaveBeenCalled()
  })
  // Review fix (Important): the Vue2/T7 version fired a separate GET /v2/snapshot/volumes per selected item —
  // 30 items meant 31 requests, and any single network hiccup misreported that item as failed (it was never even submitted).
  // volumes.value is the same already-ready data; batch restore should reuse it directly instead of refetching per item.
  it('批量恢复复用已缓存的 volumes,不为每一项重新请求', async () => {
    restoreMock.mockResolvedValue({ restored_path: '/DATA/x.restored-1' })
    const s = await inSnapshot()
    listVolumesMock.mockClear() // ensureVolumes() inside inSnapshot() already fetched once; only count calls during restore()
    await s.restore([
      { path: '/DATA/.snapshots/snap1/a' },
      { path: '/DATA/.snapshots/snap1/b' },
      { path: '/DATA/.snapshots/snap1/c' },
    ])
    expect(restoreMock).toHaveBeenCalledTimes(3)
    expect(listVolumesMock).not.toHaveBeenCalled()
  })
  it('volumes 尚未加载时兜底先拉一次,而不是把选中项都误判成失败(理论上不该发生的边界情况)', async () => {
    const s = useSnapshotBrowseStore()
    useFilesStore().currentPath = '/DATA/.snapshots/snap1/Photos'
    // Deliberately skip s.ensureVolumes(): simulate the edge case of calling restore() before volumes have loaded
    restoreMock.mockResolvedValue({ restored_path: '/DATA/Photos/a.restored-1' })
    await s.restore([{ path: '/DATA/.snapshots/snap1/Photos/a.jpg' }])
    expect(listVolumesMock).toHaveBeenCalledTimes(1)
    expect(useToast().msg).toContain('/DATA/Photos/a.restored-1')
  })

  // Task 11: the backend restores one path per call, so a 40-item batch stays
  // serial — but a single disabled button gave no sign of life for the whole
  // wait. Each restore call is gated on a manually-resolved promise so the
  // test can assert progress mid-batch.
  it('reports how far a batch restore has got', async () => {
    const gates: Array<() => void> = []
    restoreMock.mockImplementation(() => new Promise((res) => {
      gates.push(() => res({ restored_path: '/DATA/x.restored-1' }))
    }))
    const s = await inSnapshot()
    expect(s.restoreProgress).toBeNull()

    const p = s.restore([
      { path: '/DATA/.snapshots/snap1/a' },
      { path: '/DATA/.snapshots/snap1/b' },
      { path: '/DATA/.snapshots/snap1/c' },
    ])
    await vi.waitFor(() => expect(restoreMock).toHaveBeenCalledTimes(1))
    expect(s.restoreProgress).toEqual({ done: 0, total: 3 })

    gates[0]!()
    await vi.waitFor(() => expect(restoreMock).toHaveBeenCalledTimes(2))
    expect(s.restoreProgress).toEqual({ done: 1, total: 3 })

    gates[1]!()
    await vi.waitFor(() => expect(restoreMock).toHaveBeenCalledTimes(3))
    expect(s.restoreProgress).toEqual({ done: 2, total: 3 })

    gates[2]!()
    await p
    expect(s.restoreProgress).toBeNull()
  })

  it('clears the progress even when a restore fails', async () => {
    restoreMock.mockRejectedValue(Object.assign(new Error('gone'), { code: 404 }))
    const s = await inSnapshot()
    await s.restore([{ path: '/DATA/.snapshots/snap1/a' }])
    expect(s.restoreProgress).toBeNull()
  })
})
