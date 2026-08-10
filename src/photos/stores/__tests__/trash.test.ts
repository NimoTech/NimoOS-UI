import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: {
    listTrash: vi.fn(() => Promise.resolve([{ id: 't1', mimeType: 'image/jpeg', deletedAt: '2026-07-20T00:00:00Z', fileSize: 1048576 }])),
    restoreTrashBatch: vi.fn(() => Promise.resolve()),
    restoreAllTrash: vi.fn(() => Promise.resolve()),
    purgeTrash: vi.fn(() => Promise.resolve()),
    emptyTrash: vi.fn(() => Promise.resolve()),
    deleteAsset: vi.fn(() => Promise.resolve()),
    getConfig: vi.fn(() => Promise.resolve({ watchDirs: ['/DATA/Gallery'], retentionDays: 15 })),
    updateConfig: vi.fn(() => Promise.resolve()),
  } },
}))
// timeline store 依赖:mock 其 fetchTimeline/refreshBuckets,避免真跑网络。
// bucketMode is mutable per-test (default false = legacy) so bucket-mode cases
// can flip it before calling the trash action under test.
const timelineStub = vi.hoisted(() => ({
  bucketMode: false,
  fetchTimeline: vi.fn(),
  refreshBuckets: vi.fn(),
}))
vi.mock('../timeline', () => ({ useTimelineStore: () => timelineStub }))
import { service } from '@nimotech/nimoos-service'
import { usePhotosTrash } from '../trash'

describe('photosTrash store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    timelineStub.bucketMode = false
    timelineStub.fetchTimeline.mockClear()
    timelineStub.refreshBuckets.mockClear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('fetchTrash 映射 trashAssetToPhoto,容忍 null', async () => {
    const s = usePhotosTrash()
    await s.fetchTrash()
    expect(s.items.length).toBe(1)
    expect(s.items[0].id).toBe('t1')
    ;(service.photos.listTrash as any).mockResolvedValueOnce(null)
    await s.fetchTrash()
    expect(s.items.length).toBe(0)
  })

  it('fetchTrash 失败时 items 清空但 loaded 保持 false(可重试)', async () => {
    const s = usePhotosTrash()
    ;(service.photos.listTrash as any).mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await s.fetchTrash()
    expect(s.items).toEqual([])
    expect(s.loaded).toBe(false)
    expect(spy).toHaveBeenCalledWith('[photos-trash] fetchTrash', expect.any(Error))
    spy.mockRestore()
  })

  it('fetchTrash 成功后置 loaded=true', async () => {
    const s = usePhotosTrash()
    expect(s.loaded).toBe(false)
    await s.fetchTrash()
    expect(s.loaded).toBe(true)
  })

  it('restore 调 batch 后重拉,legacy 模式下仍全量刷新时间线', async () => {
    const s = usePhotosTrash()
    await s.restore(['t1'])
    expect(service.photos.restoreTrashBatch).toHaveBeenCalledWith(['t1'])
    expect(service.photos.listTrash).toHaveBeenCalled()
    expect(timelineStub.fetchTimeline).toHaveBeenCalledTimes(1)
    expect(timelineStub.refreshBuckets).not.toHaveBeenCalled()
  })

  it('restoreAll 调 restoreAllTrash 后重拉,legacy 模式下仍全量刷新时间线', async () => {
    const s = usePhotosTrash()
    await s.restoreAll()
    expect(service.photos.restoreAllTrash).toHaveBeenCalled()
    expect(service.photos.listTrash).toHaveBeenCalled()
    expect(timelineStub.fetchTimeline).toHaveBeenCalledTimes(1)
    expect(timelineStub.refreshBuckets).not.toHaveBeenCalled()
  })

  it('empty 调 emptyTrash 后重拉', async () => {
    const s = usePhotosTrash()
    await s.empty()
    expect(service.photos.emptyTrash).toHaveBeenCalled()
  })

  it('purge 逐个删后重拉', async () => {
    const s = usePhotosTrash()
    await s.purge(['t1', 't2'])
    expect(service.photos.purgeTrash).toHaveBeenCalledTimes(2)
  })

  it('purge 单项失败时吞错并记日志,不影响其余项与后续重拉', async () => {
    const s = usePhotosTrash()
    ;(service.photos.purgeTrash as any)
      .mockImplementationOnce(() => Promise.reject(new Error('boom')))
      .mockImplementationOnce(() => Promise.resolve())
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await s.purge(['t1', 't2'])
    expect(spy).toHaveBeenCalledWith('[photos-trash] purge', 't1', expect.any(Error))
    expect(service.photos.listTrash).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('undoRestore 逐个 deleteAsset 后重拉,legacy 模式下仍全量刷新时间线', async () => {
    const s = usePhotosTrash()
    await s.undoRestore(['t1'])
    expect(service.photos.deleteAsset).toHaveBeenCalledWith('t1')
    expect(timelineStub.fetchTimeline).toHaveBeenCalledTimes(1)
    expect(timelineStub.refreshBuckets).not.toHaveBeenCalled()
  })

  it('undoRestore 单项失败时吞错并记日志', async () => {
    const s = usePhotosTrash()
    ;(service.photos.deleteAsset as any).mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await s.undoRestore(['t1'])
    expect(spy).toHaveBeenCalledWith('[photos-trash] undoRestore', 't1', expect.any(Error))
    spy.mockRestore()
  })

  it('fetchRetention 读 config', async () => {
    const s = usePhotosTrash()
    await s.fetchRetention()
    expect(s.retentionDays).toBe(15)
  })

  it('fetchRetention 失败时记日志且保留默认值', async () => {
    const s = usePhotosTrash()
    ;(service.photos.getConfig as any).mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await s.fetchRetention()
    expect(s.retentionDays).toBe(30)
    expect(spy).toHaveBeenCalledWith('[photos-trash] fetchRetention', expect.any(Error))
    spy.mockRestore()
  })

  it('setRetention 先 GET watchDirs 再 PUT', async () => {
    const s = usePhotosTrash()
    await s.setRetention(60)
    expect(service.photos.updateConfig).toHaveBeenCalledWith(['/DATA/Gallery'], 60)
    expect(s.retentionDays).toBe(60)
  })
})

// Task 9: restoring out of the trash used to always do a full timeline refetch.
// In bucket mode it should refresh the (cheap) directory instead.
describe('photosTrash store — bucket mode refresh routing', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    timelineStub.bucketMode = true
    timelineStub.fetchTimeline.mockClear()
    timelineStub.refreshBuckets.mockClear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('restore refreshes the bucket directory rather than the whole timeline', async () => {
    const s = usePhotosTrash()
    await s.restore(['t1'])
    expect(timelineStub.refreshBuckets).toHaveBeenCalledTimes(1)
    expect(timelineStub.fetchTimeline).not.toHaveBeenCalled()
  })

  it('restoreAll refreshes the bucket directory rather than the whole timeline', async () => {
    const s = usePhotosTrash()
    await s.restoreAll()
    expect(timelineStub.refreshBuckets).toHaveBeenCalledTimes(1)
    expect(timelineStub.fetchTimeline).not.toHaveBeenCalled()
  })

  it('undoRestore refreshes the bucket directory rather than the whole timeline', async () => {
    const s = usePhotosTrash()
    await s.undoRestore(['t1'])
    expect(timelineStub.refreshBuckets).toHaveBeenCalledTimes(1)
    expect(timelineStub.fetchTimeline).not.toHaveBeenCalled()
  })
})
