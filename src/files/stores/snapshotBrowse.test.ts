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

    const stale = s.ensureVolumes() // P1 起飞,尚未落地
    expect(s.status).toBe('loading')

    s.reset() // 顶掉 P1 这一代
    expect(s.status).toBe('idle')

    const FRESH = [{ volume_uuid: 'u-fresh', mount: '/DATA2', supported: true }]
    listVolumesMock.mockImplementationOnce(() => Promise.resolve(FRESH))
    const fresh = s.ensureVolumes() // P2:reset 之后发起的新一代
    await fresh
    expect(s.status).toBe('ready')
    expect(s.volumes).toEqual(FRESH)

    // 这时才放行 P1 的 resolve —— 陈旧响应必须被整段丢弃,不能盖掉 P2 已经落地的结果
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
  // 评审修复(Critical 1):`.snapshots` 容器目录本身(没有具体快照名这一段)——
  // parseSnapshotBrowsePath 对它返回 null,shouldGuardSnapshotView 单独判不出锁,必须靠
  // isSnapshotsContainerPath 兜底。面包屑最自然的"点上一级"手势就会落在这条路径上。
  it('.snapshots 容器目录本身(未选中具体快照)也保持锁定', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/.snapshots'
    await s.ensureVolumes()
    expect(s.isSnapshotView).toBe(true)
    expect(s.browseInfo).toBeNull() // 没有快照名就没有时间可显示,横幅现有形态依赖它
  })

  // 评审复核(Critical 1,第二轮):上一轮的实现靠 volumes.some(...) 自己判定容器路径,
  // volumes 为空(idle/loading/error)时恒为 false —— 真实探针实测三态全部漏锁,而 error
  // 是 ensureVolumes() 的本会话终态(这台设备 /v2/snapshot/* 全 404),漏锁会持续整个会话。
  // 这三条各自独立触发一次真实探针能捕获到的三态,不再靠推断。
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
      release(VOLS) // 收尾,避免悬挂的 in-flight promise 溢出到下一条用例
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
    // restore() 先 await listVolumes() 才会真正调用 restoreMock 并捕获它的 resolver —
    // 这一步跨了微任务边界,不能在调用 s.restore() 之后原地同步 release(),否则捕获到的
    // 还是初始的空 no-op,p 永远不会 settle(之前踩过一次,跑出 5s 超时)。
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
  // 评审发现:混合结果(部分成功部分失败)时,原实现的 `&& !failed` 判断让两条成功分支都
  // 短路跳过,只剩失败文案——成功落盘的那几条被静默吞掉。人类拍板:合成一条新 toast
  // (snapBrowseRestoredPartial)说清"成功几条、失败几条",不再叠加具体失败原因文案。
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
    expect(useToast().msg).toContain('2') // 成功 2 条(a、c)
    expect(useToast().msg).toContain('1') // 失败 1 条(b)
    expect(useToast().msg).not.toContain('找不到') // 不再叠加具体失败原因文案
  })
  // 防止为了接混合分支而把"全失败"路径改坏:多条且全部失败时,仍要落到具体原因文案,
  // 不能误落进混合分支(混合分支的判定条件是 ok.length > 0)。
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
  // 评审修复(Important):Vue2/T7 版每条选中项都单独打一次 GET /v2/snapshot/volumes——
  // 30 项就是 31 次请求,且任意一次网络抖动都会把那一条误判成失败(其实根本没提交过)。
  // volumes.value 就是同一份已 ready 的数据,批量恢复该直接复用它,不逐条重新拉。
  it('批量恢复复用已缓存的 volumes,不为每一项重新请求', async () => {
    restoreMock.mockResolvedValue({ restored_path: '/DATA/x.restored-1' })
    const s = await inSnapshot()
    listVolumesMock.mockClear() // inSnapshot() 里的 ensureVolumes() 已经拉过一次,只看 restore() 期间
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
    // 故意不调用 s.ensureVolumes():模拟 volumes 还没加载就调用 restore() 的边界情况
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

  it('clears the progress even when a restore throws', async () => {
    restoreMock.mockRejectedValue(Object.assign(new Error('gone'), { code: 404 }))
    const s = await inSnapshot()
    await s.restore([{ path: '/DATA/.snapshots/snap1/a' }])
    expect(s.restoreProgress).toBeNull()
  })
})
