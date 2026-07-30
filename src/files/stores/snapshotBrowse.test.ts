import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSnapshotBrowseStore } from './snapshotBrowse'
import { useFilesStore } from './files'

const listVolumesMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { snapshot: { listVolumes: () => listVolumesMock() } },
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
