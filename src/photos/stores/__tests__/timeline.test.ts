import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const svc = vi.hoisted(() => ({
  photos: {
    getTimeline: vi.fn(),
    getStatus: vi.fn(),
    listTasks: vi.fn(),
    deleteAsset: vi.fn(),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import { useTimelineStore } from '../timeline'

const GROUP_A = { year: 2026, month: 7, assets: [{ id: 'a1', mimeType: 'image/jpeg', originalName: 'a1.jpg' }] }
const GROUP_B = {
  year: 2026,
  month: 6,
  assets: [
    { id: 'v1', mimeType: 'video/mp4', originalName: 'v1.mp4' },
    { id: 'a2', mimeType: 'image/png', originalName: 'a2.png' },
  ],
}

describe('photos-timeline store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => {
    useTimelineStore().__resetForTest()
    vi.useRealTimers()
  })

  it('fetchTimeline: 裸数组落 state,loading 包裹', async () => {
    const s = useTimelineStore()
    svc.photos.getTimeline.mockResolvedValueOnce([GROUP_A])
    const p = s.fetchTimeline()
    expect(s.loading).toBe(true)
    await p
    expect(s.loading).toBe(false)
    expect(s.timelineGroups).toEqual([GROUP_A])
  })

  it('fetchTimeline: null/undefined 兜底为 []', async () => {
    const s = useTimelineStore()
    svc.photos.getTimeline.mockResolvedValueOnce(undefined)
    await s.fetchTimeline()
    expect(s.timelineGroups).toEqual([])
  })

  it('refreshTimelineQuiet: 不改 loading', async () => {
    const s = useTimelineStore()
    svc.photos.getTimeline.mockResolvedValueOnce([GROUP_A])
    await s.refreshTimelineQuiet()
    expect(s.loading).toBe(false)
    expect(s.timelineGroups).toEqual([GROUP_A])
  })

  it('months getter:按 groupToMonth 正确分组(标题/key/照片数)', async () => {
    const s = useTimelineStore()
    svc.photos.getTimeline.mockResolvedValueOnce([GROUP_A, GROUP_B])
    await s.fetchTimeline()
    expect(s.months.map(m => m.key)).toEqual(['2026-07', '2026-06'])
    expect(s.months[1].photos).toHaveLength(2)
    expect(s.months[1].photos[0].isVideo).toBe(true)
  })

  it('photoCount/videoCount:扫全部月份资产', async () => {
    const s = useTimelineStore()
    svc.photos.getTimeline.mockResolvedValueOnce([GROUP_A, GROUP_B])
    await s.fetchTimeline()
    expect(s.photoCount).toBe(2)
    expect(s.videoCount).toBe(1)
  })

  it('fetchIndexStatus: indexed 增长触发 refreshTimelineQuiet(quiet 刷新时间线,不切 loading)', async () => {
    const s = useTimelineStore()
    svc.photos.getStatus.mockResolvedValueOnce({ pending: 1, indexed: 0, error: 0, queueLen: 1, totalBytes: 0, galleryDir: '', diskTotal: 0, diskAvail: 0, mlReady: null })
    await s.fetchIndexStatus()
    expect(s.indexStatus.indexed).toBe(0)
    expect(svc.photos.getTimeline).not.toHaveBeenCalled()

    svc.photos.getStatus.mockResolvedValueOnce({ pending: 1, indexed: 3, error: 0, queueLen: 1, totalBytes: 0, galleryDir: '', diskTotal: 0, diskAvail: 0, mlReady: null })
    svc.photos.getTimeline.mockResolvedValueOnce([GROUP_A])
    await s.fetchIndexStatus()
    expect(s.indexStatus.indexed).toBe(3)
    // quiet refresh fires (getTimeline called) without ever flipping loading true
    expect(svc.photos.getTimeline).toHaveBeenCalledTimes(1)
    expect(s.loading).toBe(false)
    await Promise.resolve(); await Promise.resolve()
    expect(s.timelineGroups).toEqual([GROUP_A])
  })

  it('fetchIndexStatus: indexed 不变/下降不触发 quiet 刷新', async () => {
    const s = useTimelineStore()
    svc.photos.getStatus.mockResolvedValueOnce({ pending: 0, indexed: 5, error: 0, queueLen: 0, totalBytes: 0, galleryDir: '', diskTotal: 0, diskAvail: 0, mlReady: null })
    svc.photos.getTimeline.mockResolvedValueOnce([])
    await s.fetchIndexStatus() // 0 -> 5 is growth (initial indexed is 0) — one quiet refresh here
    await Promise.resolve(); await Promise.resolve()
    const callsAfterFirst = svc.photos.getTimeline.mock.calls.length
    expect(callsAfterFirst).toBe(1)

    svc.photos.getStatus.mockResolvedValueOnce({ pending: 0, indexed: 5, error: 0, queueLen: 0, totalBytes: 0, galleryDir: '', diskTotal: 0, diskAvail: 0, mlReady: null })
    await s.fetchIndexStatus() // 5 -> 5, no growth
    expect(svc.photos.getTimeline.mock.calls.length).toBe(callsAfterFirst)

    svc.photos.getStatus.mockResolvedValueOnce({ pending: 0, indexed: 2, error: 0, queueLen: 0, totalBytes: 0, galleryDir: '', diskTotal: 0, diskAvail: 0, mlReady: null })
    await s.fetchIndexStatus() // 5 -> 2, decrease
    expect(svc.photos.getTimeline.mock.calls.length).toBe(callsAfterFirst)
  })

  it('fetchIndexStatus: idle(pending=0,queueLen=0)且无在途 upload 任务 → 清空 index 任务', async () => {
    const s = useTimelineStore()
    s.ingestTaskBus({ id: 'idx-1', type: 'index', status: 'done' })
    s.ingestTaskBus({ id: 'face-1', type: 'face', status: 'running' })
    svc.photos.getStatus.mockResolvedValueOnce({ pending: 0, indexed: 0, error: 0, queueLen: 0, totalBytes: 0, galleryDir: '', diskTotal: 0, diskAvail: 0, mlReady: null })
    await s.fetchIndexStatus()
    expect(s.tasks.some(t => t.type === 'index')).toBe(false)
    expect(s.tasks.some(t => t.type === 'face')).toBe(true)
  })

  it('fetchIndexStatus: idle 但有在途 upload 任务 → 不清 index 任务(避免任务栏闪烁消失)', async () => {
    const s = useTimelineStore()
    s.ingestTaskBus({ id: 'idx-1', type: 'index', status: 'running' })
    s.ingestTaskBus({ id: 'up-1', type: 'upload', status: 'uploading' })
    svc.photos.getStatus.mockResolvedValueOnce({ pending: 0, indexed: 0, error: 0, queueLen: 0, totalBytes: 0, galleryDir: '', diskTotal: 0, diskAvail: 0, mlReady: null })
    await s.fetchIndexStatus()
    expect(s.tasks.some(t => t.type === 'index')).toBe(true)
  })

  it('fetchIndexStatus: not idle(pending>0) → 不清 index 任务', async () => {
    const s = useTimelineStore()
    s.ingestTaskBus({ id: 'idx-1', type: 'index', status: 'running' })
    svc.photos.getStatus.mockResolvedValueOnce({ pending: 2, indexed: 0, error: 0, queueLen: 0, totalBytes: 0, galleryDir: '', diskTotal: 0, diskAvail: 0, mlReady: null })
    await s.fetchIndexStatus()
    expect(s.tasks.some(t => t.type === 'index')).toBe(true)
  })

  it('startIndexPoll: 立即拉一次 + 每 5s 轮询;幂等(重复调用不重开 timer)', async () => {
    const s = useTimelineStore()
    svc.photos.getStatus.mockResolvedValue({ pending: 0, indexed: 0, error: 0, queueLen: 0, totalBytes: 0, galleryDir: '', diskTotal: 0, diskAvail: 0, mlReady: null })
    s.startIndexPoll()
    await Promise.resolve()
    expect(svc.photos.getStatus).toHaveBeenCalledTimes(1)

    s.startIndexPoll() // idempotent — should not start a second timer
    await vi.advanceTimersByTimeAsync(5000)
    expect(svc.photos.getStatus).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(5000)
    expect(svc.photos.getStatus).toHaveBeenCalledTimes(3)
  })

  it('stopIndexPoll: 清干净,之后推进时间不再调用', async () => {
    const s = useTimelineStore()
    svc.photos.getStatus.mockResolvedValue({ pending: 0, indexed: 0, error: 0, queueLen: 0, totalBytes: 0, galleryDir: '', diskTotal: 0, diskAvail: 0, mlReady: null })
    s.startIndexPoll()
    await Promise.resolve()
    s.stopIndexPoll()
    const callsAfterStop = svc.photos.getStatus.mock.calls.length
    await vi.advanceTimersByTimeAsync(20000)
    expect(svc.photos.getStatus.mock.calls.length).toBe(callsAfterStop)
  })

  it('fetchTasks: 从 {tasks:[...]} 抽取', async () => {
    const s = useTimelineStore()
    svc.photos.listTasks.mockResolvedValueOnce({ tasks: [{ id: 't1', type: 'index', status: 'running' }] })
    await s.fetchTasks()
    expect(s.tasks).toEqual([{ id: 't1', type: 'index', status: 'running' }])
  })

  it('fetchTasks: null/无 tasks 字段兜底为 []', async () => {
    const s = useTimelineStore()
    svc.photos.listTasks.mockResolvedValueOnce(undefined)
    await s.fetchTasks()
    expect(s.tasks).toEqual([])

    svc.photos.listTasks.mockResolvedValueOnce({})
    await s.fetchTasks()
    expect(s.tasks).toEqual([])
  })

  it('ingestTaskBus: unwrap 后同 id 合并更新字段,新 id 追加', () => {
    const s = useTimelineStore()
    s.ingestTaskBus({ id: 't1', type: 'index', status: 'running', current: 1, total: 10 })
    expect(s.tasks).toHaveLength(1)
    s.ingestTaskBus({ id: 't1', status: 'running', current: 5, total: 10 })
    expect(s.tasks).toHaveLength(1)
    expect(s.tasks[0]).toMatchObject({ id: 't1', type: 'index', current: 5, total: 10 })
    s.ingestTaskBus({ id: 't2', type: 'face', status: 'running' })
    expect(s.tasks).toHaveLength(2)
  })

  it('ingestTaskBus: unwrap 失败(非法 payload)静默丢弃', () => {
    const s = useTimelineStore()
    s.ingestTaskBus(null)
    s.ingestTaskBus('nope')
    s.ingestTaskBus({ SourceID: 'x' })
    expect(s.tasks).toHaveLength(0)
  })

  it('deleteAssets: 逐个调用 deleteAsset,计数成功数,之后 quiet 刷新', async () => {
    const s = useTimelineStore()
    svc.photos.deleteAsset.mockResolvedValueOnce(undefined)
    svc.photos.deleteAsset.mockRejectedValueOnce(new Error('boom'))
    svc.photos.deleteAsset.mockResolvedValueOnce(undefined)
    svc.photos.getTimeline.mockResolvedValueOnce([])
    const n = await s.deleteAssets(['a1', 'a2', 'a3'])
    expect(svc.photos.deleteAsset).toHaveBeenNthCalledWith(1, 'a1')
    expect(svc.photos.deleteAsset).toHaveBeenNthCalledWith(2, 'a2')
    expect(svc.photos.deleteAsset).toHaveBeenNthCalledWith(3, 'a3')
    expect(n).toBe(2)
    expect(svc.photos.getTimeline).toHaveBeenCalled()
  })

  it('deleteAssets: 全部失败仍不抛,返回 0,不触发刷新', async () => {
    const s = useTimelineStore()
    svc.photos.deleteAsset.mockRejectedValue(new Error('boom'))
    const n = await s.deleteAssets(['a1'])
    expect(n).toBe(0)
    expect(svc.photos.getTimeline).not.toHaveBeenCalled()
  })

  it('isIndexing getter:pending>0 或 queueLen>0 为真', async () => {
    const s = useTimelineStore()
    expect(s.isIndexing).toBe(false)
    svc.photos.getStatus.mockResolvedValueOnce({ pending: 1, indexed: 0, error: 0, queueLen: 0, totalBytes: 0, galleryDir: '', diskTotal: 0, diskAvail: 0, mlReady: null })
    await s.fetchIndexStatus()
    expect(s.isIndexing).toBe(true)
  })

  it('__resetForTest: 清 timer 且 $reset 状态', async () => {
    const s = useTimelineStore()
    svc.photos.getStatus.mockResolvedValue({ pending: 0, indexed: 0, error: 0, queueLen: 0, totalBytes: 0, galleryDir: '', diskTotal: 0, diskAvail: 0, mlReady: null })
    s.startIndexPoll()
    await Promise.resolve()
    s.ingestTaskBus({ id: 't1', type: 'index', status: 'running' })
    s.__resetForTest()
    expect(s.tasks).toEqual([])
    const callsAfterReset = svc.photos.getStatus.mock.calls.length
    await vi.advanceTimersByTimeAsync(20000)
    expect(svc.photos.getStatus.mock.calls.length).toBe(callsAfterReset)
  })
})
