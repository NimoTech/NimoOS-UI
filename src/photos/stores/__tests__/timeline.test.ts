import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const svc = vi.hoisted(() => ({
  photos: {
    getTimeline: vi.fn(),
    getStatus: vi.fn(),
    listTasks: vi.fn(),
    deleteAsset: vi.fn(),
    getTimelineBuckets: vi.fn(),
    getTimelineBucket: vi.fn(),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import { useTimelineStore, __resetBucketProbeForTest } from '../timeline'

const GROUP_A = { year: 2026, month: 7, assets: [{ id: 'a1', mimeType: 'image/jpeg', originalName: 'a1.jpg' }] }
const GROUP_B = {
  year: 2026,
  month: 6,
  assets: [
    { id: 'v1', mimeType: 'video/mp4', originalName: 'v1.mp4' },
    { id: 'a2', mimeType: 'image/png', originalName: 'a2.png' },
  ],
}

function notFound() {
  return Object.assign(new Error('Request failed with status code 404'), { response: { status: 404 } })
}

describe('photos-timeline store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
    // fetchTimeline now probes the bucket directory before falling back to the
    // legacy endpoint. These pre-existing tests model a backend that predates
    // the bucket endpoints, so the probe must 404 by default — otherwise an
    // unconfigured getTimelineBuckets() mock resolves to `undefined` (not a
    // rejection), which normalizeBuckets() reads as "zero buckets, but a real
    // directory" and incorrectly flips bucketMode on, short-circuiting the
    // legacy getTimeline() call these tests assert on.
    svc.photos.getTimelineBuckets.mockRejectedValue(notFound())
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

  // P8a-T10(P1 挂账):照 Vue2 scheduleTaskRemove(store/modules/photos.js:50-58,
  // _onTaskBus :1388-1402)——非 index 类型的 done 任务 5s 后自动从列表移除。
  it('ingestTaskBus: 非 index 类型 done 任务 5s 后从列表移除(边界:4999ms 仍在,+2ms 已移除)', () => {
    const s = useTimelineStore()
    s.ingestTaskBus({ id: 'ocr-1', type: 'ocr', status: 'done' })
    expect(s.tasks).toHaveLength(1)
    vi.advanceTimersByTime(4999)
    expect(s.tasks).toHaveLength(1)
    vi.advanceTimersByTime(2)
    expect(s.tasks).toHaveLength(0)
  })

  // 终审 Minor 5:Vue2 :1403-1406 对 error 任务同样 scheduleTaskRemove,只是延迟 10s
  // (不是 done 的 5s)。此前只搬了 running/done,error 任务永久留在列表——补上同款
  // 边界用例(9999ms 仍在 / +2ms 已移除),复用同一张 _doneRemovalTimers 表。
  it('ingestTaskBus: error 任务 10s 后从列表移除(边界:9999ms 仍在,+2ms 已移除)', () => {
    const s = useTimelineStore()
    s.ingestTaskBus({ id: 'ocr-err-1', type: 'ocr', status: 'error' })
    expect(s.tasks).toHaveLength(1)
    vi.advanceTimersByTime(9999)
    expect(s.tasks).toHaveLength(1)
    vi.advanceTimersByTime(2)
    expect(s.tasks).toHaveLength(0)
  })

  it('ingestTaskBus: index 类型的 done 任务不走 5s 过期(留给 fetchIndexStatus 的 idle 对账)', () => {
    const s = useTimelineStore()
    s.ingestTaskBus({ id: 'idx-1', type: 'index', status: 'done' })
    vi.advanceTimersByTime(5001)
    expect(s.tasks).toHaveLength(1) // 计时器不管 index,只有 idle 对账才会摘掉它
  })

  it('ingestTaskBus: done 任务的移除计时器在同 id 再次 running 时取消', () => {
    const s = useTimelineStore()
    s.ingestTaskBus({ id: 'ocr-1', type: 'ocr', status: 'done' })
    vi.advanceTimersByTime(3000)
    s.ingestTaskBus({ id: 'ocr-1', type: 'ocr', status: 'running', current: 1, total: 10 })
    vi.advanceTimersByTime(5000) // 若旧计时器没被取消,这里会把复活的任务错误摘掉
    expect(s.tasks).toHaveLength(1)
    expect(s.tasks[0]).toMatchObject({ status: 'running' })
  })

  it('__resetForTest 清掉挂起的 done 移除计时器(不留潜在的跨测试污染)', () => {
    const s = useTimelineStore()
    s.ingestTaskBus({ id: 'ocr-1', type: 'ocr', status: 'done' })
    s.__resetForTest()
    expect(s.tasks).toEqual([])
    // 计时器已随 reset 清掉;之后即使继续推进时间也不该抛错或访问已重置的 state。
    expect(() => vi.advanceTimersByTime(10000)).not.toThrow()
  })
})

const BUCKETS = [
  { year: 2026, month: 8, count: 12, videoCount: 3 },
  { year: 2026, month: 7, count: 5, videoCount: 0 },
]

describe('photos-timeline bucket mode', () => {
  beforeEach(() => {
    // Same isolation as the describe block above (fresh Pinia + cleared mocks +
    // fake timers) — this suite makes exact call-count assertions per test, and
    // one test's leftover store/mock state would corrupt the next test's count.
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
    __resetBucketProbeForTest()
  })
  afterEach(() => {
    useTimelineStore().__resetForTest()
    vi.useRealTimers()
  })

  it('fetchTimeline probes the directory and enters bucket mode', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    expect(s.bucketMode).toBe(true)
    expect(s.buckets).toEqual(BUCKETS)
    expect(svc.photos.getTimeline).not.toHaveBeenCalled()
    expect(s.loading).toBe(false)
  })

  it('exposes every directory month as an unloaded group, newest first', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    expect(s.months.map((m) => m.key)).toEqual(['2026-08', '2026-07'])
    expect(s.months.every((m) => m.loaded === false && m.photos.length === 0)).toBe(true)
    expect(s.months[0]).toMatchObject({ count: 12, videoCount: 3 })
  })

  it('counts from the directory, so the totals are exact before anything loads', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    expect(s.totalCount).toBe(17)
    expect(s.videoCount).toBe(3)
    expect(s.photoCount).toBe(14)
  })

  it('falls back to the legacy timeline on 404 and stays out of bucket mode', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockRejectedValueOnce(notFound())
    svc.photos.getTimeline.mockResolvedValueOnce([GROUP_A])
    await s.fetchTimeline()
    expect(s.bucketMode).toBe(false)
    expect(s.timelineGroups).toEqual([GROUP_A])
    expect(s.months.map((m) => m.key)).toEqual(['2026-07'])
    expect(s.months[0].loaded).toBeUndefined()
  })

  it('does not re-probe the directory for 10 minutes after a 404', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockRejectedValueOnce(notFound())
    svc.photos.getTimeline.mockResolvedValue([GROUP_A])
    await s.fetchTimeline()
    await s.fetchTimeline()
    expect(svc.photos.getTimelineBuckets).toHaveBeenCalledTimes(1)
    expect(svc.photos.getTimeline).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(10 * 60_000 + 1)
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    expect(svc.photos.getTimelineBuckets).toHaveBeenCalledTimes(2)
    expect(s.bucketMode).toBe(true)
  })

  it('keeps probing after a non-404 failure — a blip must not pin the user on the legacy path', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockRejectedValueOnce(new Error('network down'))
    svc.photos.getTimeline.mockResolvedValue([GROUP_A])
    await s.fetchTimeline()
    expect(s.bucketMode).toBe(false)
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    expect(svc.photos.getTimelineBuckets).toHaveBeenCalledTimes(2)
    expect(s.bucketMode).toBe(true)
  })

  it('drops legacy groups when it switches into bucket mode', async () => {
    // Both sources feeding `months` at once would double every month.
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockRejectedValueOnce(notFound())
    svc.photos.getTimeline.mockResolvedValueOnce([GROUP_A])
    await s.fetchTimeline()
    __resetBucketProbeForTest()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    expect(s.timelineGroups).toEqual([])
    expect(s.months.map((m) => m.key)).toEqual(['2026-08', '2026-07'])
  })
})

describe('photos-timeline fetchBucket', () => {
  // Same isolation as the "photos-timeline bucket mode" describe above: a fresh
  // Pinia + cleared mocks per test, so one test's paging/dedupe call counts
  // (and its bucketAssets cache) cannot leak into the next test's assertions.
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
    __resetBucketProbeForTest()
  })
  afterEach(() => {
    useTimelineStore().__resetForTest()
    vi.useRealTimers()
  })

  async function enterBucketMode(s: ReturnType<typeof useTimelineStore>, list = BUCKETS) {
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(list)
    await s.fetchTimeline()
  }
  const asset = (id: string, video = false) => ({ id, mimeType: video ? 'video/mp4' : 'image/jpeg' })

  it('fetches one month and marks it loaded', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s)
    svc.photos.getTimelineBucket.mockResolvedValueOnce([asset('a1'), asset('a2')])
    await s.fetchBucket('2026-08')
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(2026, 8, 500, 0)
    const aug = s.months.find((m) => m.key === '2026-08')
    expect(aug?.loaded).toBe(true)
    expect(aug?.photos.map((p) => p.id)).toEqual(['a1', 'a2'])
  })

  it('sends the unknown bucket as a zero pair, never a half-zero key', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s, [{ year: 0, month: 0, count: 1, videoCount: 0 }])
    svc.photos.getTimelineBucket.mockResolvedValueOnce([asset('u1')])
    await s.fetchBucket('unknown')
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(0, 0, 500, 0)
  })

  it('pages until the directory count is covered', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s, [{ year: 2026, month: 8, count: 501, videoCount: 0 }])
    svc.photos.getTimelineBucket
      .mockResolvedValueOnce(Array.from({ length: 500 }, (_, i) => asset(`p${i}`)))
      .mockResolvedValueOnce([asset('p500')])
    await s.fetchBucket('2026-08')
    expect(svc.photos.getTimelineBucket).toHaveBeenNthCalledWith(2, 2026, 8, 500, 500)
    expect(s.months[0].photos).toHaveLength(501)
  })

  it('stops paging early when a page comes back short', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s, [{ year: 2026, month: 8, count: 900, videoCount: 0 }])
    svc.photos.getTimelineBucket.mockResolvedValueOnce([asset('p0')])
    await s.fetchBucket('2026-08')
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledTimes(1)
    expect(s.months[0].loaded).toBe(true)
  })

  it('dedupes concurrent requests for the same month', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s)
    svc.photos.getTimelineBucket.mockResolvedValue([asset('a1')])
    await Promise.all([s.fetchBucket('2026-08'), s.fetchBucket('2026-08')])
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledTimes(1)
  })

  it('does not refetch a month it already holds', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s)
    svc.photos.getTimelineBucket.mockResolvedValueOnce([asset('a1')])
    await s.fetchBucket('2026-08')
    await s.fetchBucket('2026-08')
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledTimes(1)
  })

  it('leaves a month unloaded on failure so scrolling back retries it', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s)
    svc.photos.getTimelineBucket.mockRejectedValueOnce(new Error('boom'))
    await s.fetchBucket('2026-08')
    expect(s.months[0].loaded).toBe(false)
    svc.photos.getTimelineBucket.mockResolvedValueOnce([asset('a1')])
    await s.fetchBucket('2026-08')
    expect(s.months[0].loaded).toBe(true)
  })

  it('ignores an unknown key instead of firing a request with NaN', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s)
    await s.fetchBucket('search')
    expect(svc.photos.getTimelineBucket).not.toHaveBeenCalled()
  })

  it('does nothing outside bucket mode', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockRejectedValueOnce(notFound())
    svc.photos.getTimeline.mockResolvedValueOnce([GROUP_A])
    await s.fetchTimeline()
    await s.fetchBucket('2026-07')
    expect(svc.photos.getTimelineBucket).not.toHaveBeenCalled()
  })
})

describe('photos-timeline refreshBuckets', () => {
  // Same isolation rationale as the fetchBucket describe above.
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
    __resetBucketProbeForTest()
  })
  afterEach(() => {
    useTimelineStore().__resetForTest()
    vi.useRealTimers()
  })
  const asset = (id: string) => ({ id, mimeType: 'image/jpeg' })

  it('keeps an unchanged month byte-identical so the grid does not flash', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    svc.photos.getTimelineBucket.mockResolvedValueOnce([asset('a1')])
    await s.fetchBucket('2026-08')
    const before = s.months[0].photos
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.refreshBuckets()
    expect(s.months[0].photos).toBe(before)
  })

  it('drops the cache for a month whose count changed', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    svc.photos.getTimelineBucket.mockResolvedValueOnce([asset('a1')])
    await s.fetchBucket('2026-08')
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([{ year: 2026, month: 8, count: 13, videoCount: 3 }, BUCKETS[1]])
    await s.refreshBuckets()
    expect(s.months[0].loaded).toBe(false)
    expect(s.months[0].count).toBe(13)
  })

  it('drops a month that vanished entirely', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    svc.photos.getTimelineBucket.mockResolvedValueOnce([asset('a1')])
    await s.fetchBucket('2026-08')
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([BUCKETS[1]])
    await s.refreshBuckets()
    expect(s.months.map((m) => m.key)).toEqual(['2026-07'])
  })

  it('is a no-op outside bucket mode', async () => {
    const s = useTimelineStore()
    await s.refreshBuckets()
    expect(svc.photos.getTimelineBuckets).not.toHaveBeenCalled()
  })

  it('keeps the old directory when the refresh fails', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    svc.photos.getTimelineBuckets.mockRejectedValueOnce(new Error('boom'))
    await s.refreshBuckets()
    expect(s.buckets).toEqual(BUCKETS)
  })
})

// Task 8b: two real consumers (the "make an album from the last 30 days" flow and the
// library picker) flatten `allPhotos` and used to assume "months is non-empty" implies
// "allPhotos is non-empty" — an invariant bucket mode breaks, since the directory arrives
// before any bucket's photos do. fetchNewestBuckets(n) is what lets them ask for actual
// photos rather than just directory structure.
describe('photos-timeline fetchNewestBuckets', () => {
  // Same isolation as the other bucket-mode describes above.
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
    __resetBucketProbeForTest()
  })
  afterEach(() => {
    useTimelineStore().__resetForTest()
    vi.useRealTimers()
  })

  it('fetchNewestBuckets loads the newest N dated buckets', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([
      { year: 2026, month: 8, count: 1, videoCount: 0 },
      { year: 2026, month: 7, count: 1, videoCount: 0 },
      { year: 2026, month: 6, count: 1, videoCount: 0 },
    ])
    await s.fetchTimeline()
    svc.photos.getTimelineBucket.mockResolvedValue([{ id: 'a1', mimeType: 'image/jpeg' }])
    await s.fetchNewestBuckets(2)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledTimes(2)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(2026, 8, 500, 0)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(2026, 7, 500, 0)
  })

  it('skips the unknown-date bucket when picking the newest', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([
      { year: 2026, month: 8, count: 1, videoCount: 0 },
      { year: 0, month: 0, count: 5, videoCount: 0 },
    ])
    await s.fetchTimeline()
    svc.photos.getTimelineBucket.mockResolvedValue([{ id: 'a1', mimeType: 'image/jpeg' }])
    await s.fetchNewestBuckets(2)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledTimes(1)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(2026, 8, 500, 0)
  })

  it('does not refetch a bucket it already holds', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([{ year: 2026, month: 8, count: 1, videoCount: 0 }])
    await s.fetchTimeline()
    svc.photos.getTimelineBucket.mockResolvedValue([{ id: 'a1', mimeType: 'image/jpeg' }])
    await s.fetchBucket('2026-08')
    await s.fetchNewestBuckets(3)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledTimes(1)
  })

  it('is a no-op outside bucket mode', async () => {
    const s = useTimelineStore()
    await s.fetchNewestBuckets(2)
    expect(svc.photos.getTimelineBucket).not.toHaveBeenCalled()
  })
})
