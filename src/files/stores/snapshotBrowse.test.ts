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
  it('空选区不发请求', async () => {
    const s = await inSnapshot()
    await s.restore([])
    expect(restoreMock).not.toHaveBeenCalled()
  })
})
