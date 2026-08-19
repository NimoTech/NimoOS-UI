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

  it('fetchTimeline: a bare array lands in state, wrapped by loading', async () => {
    const s = useTimelineStore()
    svc.photos.getTimeline.mockResolvedValueOnce([GROUP_A])
    const p = s.fetchTimeline()
    expect(s.loading).toBe(true)
    await p
    expect(s.loading).toBe(false)
    expect(s.timelineGroups).toEqual([GROUP_A])
  })

  it('fetchTimeline: null/undefined falls back to []', async () => {
    const s = useTimelineStore()
    svc.photos.getTimeline.mockResolvedValueOnce(undefined)
    await s.fetchTimeline()
    expect(s.timelineGroups).toEqual([])
  })

  it('refreshTimelineQuiet: does not change loading', async () => {
    const s = useTimelineStore()
    svc.photos.getTimeline.mockResolvedValueOnce([GROUP_A])
    await s.refreshTimelineQuiet()
    expect(s.loading).toBe(false)
    expect(s.timelineGroups).toEqual([GROUP_A])
  })

  it('months getter: groups correctly via groupToMonth (title/key/photo count)', async () => {
    const s = useTimelineStore()
    svc.photos.getTimeline.mockResolvedValueOnce([GROUP_A, GROUP_B])
    await s.fetchTimeline()
    expect(s.months.map(m => m.key)).toEqual(['2026-07', '2026-06'])
    expect(s.months[1].photos).toHaveLength(2)
    expect(s.months[1].photos[0].isVideo).toBe(true)
  })

  it('photoCount/videoCount: scans assets across every month', async () => {
    const s = useTimelineStore()
    svc.photos.getTimeline.mockResolvedValueOnce([GROUP_A, GROUP_B])
    await s.fetchTimeline()
    expect(s.photoCount).toBe(2)
    expect(s.videoCount).toBe(1)
  })

  it('fetchIndexStatus: growth in indexed triggers refreshTimelineQuiet (quietly refreshes the timeline, without flipping loading)', async () => {
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

  it('fetchIndexStatus: indexed unchanged/decreasing does not trigger a quiet refresh', async () => {
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

  it('fetchIndexStatus: idle (pending=0, queueLen=0) with no in-flight upload task → clears index tasks', async () => {
    const s = useTimelineStore()
    s.ingestTaskBus({ id: 'idx-1', type: 'index', status: 'done' })
    s.ingestTaskBus({ id: 'face-1', type: 'face', status: 'running' })
    svc.photos.getStatus.mockResolvedValueOnce({ pending: 0, indexed: 0, error: 0, queueLen: 0, totalBytes: 0, galleryDir: '', diskTotal: 0, diskAvail: 0, mlReady: null })
    await s.fetchIndexStatus()
    expect(s.tasks.some(t => t.type === 'index')).toBe(false)
    expect(s.tasks.some(t => t.type === 'face')).toBe(true)
  })

  it('fetchIndexStatus: idle but with an in-flight upload task → does not clear index tasks (avoids the task bar flickering out)', async () => {
    const s = useTimelineStore()
    s.ingestTaskBus({ id: 'idx-1', type: 'index', status: 'running' })
    s.ingestTaskBus({ id: 'up-1', type: 'upload', status: 'uploading' })
    svc.photos.getStatus.mockResolvedValueOnce({ pending: 0, indexed: 0, error: 0, queueLen: 0, totalBytes: 0, galleryDir: '', diskTotal: 0, diskAvail: 0, mlReady: null })
    await s.fetchIndexStatus()
    expect(s.tasks.some(t => t.type === 'index')).toBe(true)
  })

  it('fetchIndexStatus: not idle (pending>0) → does not clear index tasks', async () => {
    const s = useTimelineStore()
    s.ingestTaskBus({ id: 'idx-1', type: 'index', status: 'running' })
    svc.photos.getStatus.mockResolvedValueOnce({ pending: 2, indexed: 0, error: 0, queueLen: 0, totalBytes: 0, galleryDir: '', diskTotal: 0, diskAvail: 0, mlReady: null })
    await s.fetchIndexStatus()
    expect(s.tasks.some(t => t.type === 'index')).toBe(true)
  })

  it('startIndexPoll: fetches once immediately + polls every 5s; idempotent (calling again does not restart the timer)', async () => {
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

  it('stopIndexPoll: cleans up fully, advancing time afterward no longer calls it', async () => {
    const s = useTimelineStore()
    svc.photos.getStatus.mockResolvedValue({ pending: 0, indexed: 0, error: 0, queueLen: 0, totalBytes: 0, galleryDir: '', diskTotal: 0, diskAvail: 0, mlReady: null })
    s.startIndexPoll()
    await Promise.resolve()
    s.stopIndexPoll()
    const callsAfterStop = svc.photos.getStatus.mock.calls.length
    await vi.advanceTimersByTimeAsync(20000)
    expect(svc.photos.getStatus.mock.calls.length).toBe(callsAfterStop)
  })

  it('fetchTasks: extracts from {tasks:[...]}', async () => {
    const s = useTimelineStore()
    svc.photos.listTasks.mockResolvedValueOnce({ tasks: [{ id: 't1', type: 'index', status: 'running' }] })
    await s.fetchTasks()
    expect(s.tasks).toEqual([{ id: 't1', type: 'index', status: 'running' }])
  })

  it('fetchTasks: null / no tasks field falls back to []', async () => {
    const s = useTimelineStore()
    svc.photos.listTasks.mockResolvedValueOnce(undefined)
    await s.fetchTasks()
    expect(s.tasks).toEqual([])

    svc.photos.listTasks.mockResolvedValueOnce({})
    await s.fetchTasks()
    expect(s.tasks).toEqual([])
  })

  it('ingestTaskBus: after unwrap, same id merges updated fields, new id gets appended', () => {
    const s = useTimelineStore()
    s.ingestTaskBus({ id: 't1', type: 'index', status: 'running', current: 1, total: 10 })
    expect(s.tasks).toHaveLength(1)
    s.ingestTaskBus({ id: 't1', status: 'running', current: 5, total: 10 })
    expect(s.tasks).toHaveLength(1)
    expect(s.tasks[0]).toMatchObject({ id: 't1', type: 'index', current: 5, total: 10 })
    s.ingestTaskBus({ id: 't2', type: 'face', status: 'running' })
    expect(s.tasks).toHaveLength(2)
  })

  it('ingestTaskBus: unwrap failure (invalid payload) is silently dropped', () => {
    const s = useTimelineStore()
    s.ingestTaskBus(null)
    s.ingestTaskBus('nope')
    s.ingestTaskBus({ SourceID: 'x' })
    expect(s.tasks).toHaveLength(0)
  })

  it('deleteAssets: calls deleteAsset one by one, counts successes, then does a quiet refresh', async () => {
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

  it('deleteAssets: still does not throw when everything fails, returns 0, does not trigger a refresh', async () => {
    const s = useTimelineStore()
    svc.photos.deleteAsset.mockRejectedValue(new Error('boom'))
    const n = await s.deleteAssets(['a1'])
    expect(n).toBe(0)
    expect(svc.photos.getTimeline).not.toHaveBeenCalled()
  })

  it('isIndexing getter: true when pending>0 or queueLen>0', async () => {
    const s = useTimelineStore()
    expect(s.isIndexing).toBe(false)
    svc.photos.getStatus.mockResolvedValueOnce({ pending: 1, indexed: 0, error: 0, queueLen: 0, totalBytes: 0, galleryDir: '', diskTotal: 0, diskAvail: 0, mlReady: null })
    await s.fetchIndexStatus()
    expect(s.isIndexing).toBe(true)
  })

  it('__resetForTest: clears timers and $reset state', async () => {
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

  // P8a-T10 (P1 pending item): following Vue2's scheduleTaskRemove (store/modules/photos.js:50-58,
  // _onTaskBus :1388-1402) — a done task of a non-index type is automatically removed
  // from the list after 5s.
  it('ingestTaskBus: a non-index done task is removed from the list after 5s (boundary: still present at 4999ms, removed by +2ms)', () => {
    const s = useTimelineStore()
    s.ingestTaskBus({ id: 'ocr-1', type: 'ocr', status: 'done' })
    expect(s.tasks).toHaveLength(1)
    vi.advanceTimersByTime(4999)
    expect(s.tasks).toHaveLength(1)
    vi.advanceTimersByTime(2)
    expect(s.tasks).toHaveLength(0)
  })

  // Final review Minor 5: Vue2 :1403-1406 applies scheduleTaskRemove to error tasks too,
  // just with a 10s delay (not the 5s used for done). Previously only running/done were
  // ported over, leaving error tasks permanently stuck in the list — adding the matching
  // boundary cases here (still present at 9999ms / removed by +2ms), reusing the same
  // _doneRemovalTimers table.
  it('ingestTaskBus: an error task is removed from the list after 10s (boundary: still present at 9999ms, removed by +2ms)', () => {
    const s = useTimelineStore()
    s.ingestTaskBus({ id: 'ocr-err-1', type: 'ocr', status: 'error' })
    expect(s.tasks).toHaveLength(1)
    vi.advanceTimersByTime(9999)
    expect(s.tasks).toHaveLength(1)
    vi.advanceTimersByTime(2)
    expect(s.tasks).toHaveLength(0)
  })

  it('ingestTaskBus: an index-type done task does not go through the 5s expiry (left to fetchIndexStatus\'s idle reconciliation)', () => {
    const s = useTimelineStore()
    s.ingestTaskBus({ id: 'idx-1', type: 'index', status: 'done' })
    vi.advanceTimersByTime(5001)
    expect(s.tasks).toHaveLength(1) // the timer ignores index; only idle reconciliation removes it
  })

  it('ingestTaskBus: a done task\'s removal timer is cancelled when the same id goes running again', () => {
    const s = useTimelineStore()
    s.ingestTaskBus({ id: 'ocr-1', type: 'ocr', status: 'done' })
    vi.advanceTimersByTime(3000)
    s.ingestTaskBus({ id: 'ocr-1', type: 'ocr', status: 'running', current: 1, total: 10 })
    vi.advanceTimersByTime(5000) // if the old timer wasn't cancelled, this would incorrectly remove the revived task
    expect(s.tasks).toHaveLength(1)
    expect(s.tasks[0]).toMatchObject({ status: 'running' })
  })

  it('__resetForTest clears any pending done-removal timers (no potential cross-test contamination left behind)', () => {
    const s = useTimelineStore()
    s.ingestTaskBus({ id: 'ocr-1', type: 'ocr', status: 'done' })
    s.__resetForTest()
    expect(s.tasks).toEqual([])
    // The timer has already been cleared along with reset; advancing time further afterward
    // should not throw or access already-reset state.
    expect(() => vi.advanceTimersByTime(10000)).not.toThrow()
  })
})

const BUCKETS = [
  { year: 2026, month: 8, count: 12, videoCount: 3, ocrCount: 0 },
  { year: 2026, month: 7, count: 5, videoCount: 0, ocrCount: 0 },
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

  // Whole-branch review, Important 5: fetchTimeline runs on every mount of
  // /photos and on every socket reconnect, and it used to overwrite `buckets`
  // without the staleness diff that only refreshBuckets ran. So the caches it
  // invalidated were never dropped — and no later refresh could catch up, because
  // the next refreshBuckets diffs the new directory against the same new directory
  // and finds nothing stale.
  it('re-entering the page drops the cache of a month whose count moved while away', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([{ year: 2026, month: 8, count: 10, videoCount: 0 }])
    await s.fetchTimeline()
    svc.photos.getTimelineBucket.mockResolvedValueOnce(
      Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, mimeType: 'image/jpeg' })),
    )
    await s.fetchBucket('2026-08')
    expect(s.months[0].photos).toHaveLength(10)

    // Away on /photos/albums, a photo is added to August from somewhere else; the
    // user comes back and Photos.vue calls fetchTimeline() again.
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([{ year: 2026, month: 8, count: 11, videoCount: 0 }])
    await s.fetchTimeline()

    // The month must be unloaded, not left showing its cached 10 under a header
    // that says 11 (with any deleted asset still holding a tile that 404s).
    expect(s.months[0].loaded).toBe(false)
    expect(s.totalCount).toBe(11)

    // And a later refresh must not be the thing that was supposed to catch it.
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([{ year: 2026, month: 8, count: 11, videoCount: 0 }])
    await s.refreshBuckets()
    expect(s.months[0].loaded).toBe(false)
  })

  it('re-entering the page keeps an unchanged month byte-identical', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    svc.photos.getTimelineBucket.mockResolvedValueOnce([{ id: 'a1', mimeType: 'image/jpeg' }])
    await s.fetchBucket('2026-08')
    const before = s.months[0].photos
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    // The whole point of the diff: a re-entry must not throw away caches it did
    // not have to, or every navigation back to /photos refetches the library.
    expect(s.months[0].photos).toBe(before)
  })

  // Same finding, second half: a non-404 blip while ALREADY in bucket mode fell
  // through to the whole-library request this phase exists to eliminate, with
  // bucketMode still true — so `months` ignored the response (dead memory) and the
  // grid kept rendering a directory nothing was refreshing.
  //
  // Retitled for R2: the flag is flipped once the legacy call has ANSWERED, not
  // before it is made (see the next test for why). What matters to this one is
  // unchanged — the legacy answer must actually be what the page renders.
  it('leaves bucket mode once the legacy timeline answers', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    expect(s.bucketMode).toBe(true)

    svc.photos.getTimelineBuckets.mockRejectedValueOnce(new Error('network down'))
    svc.photos.getTimeline.mockResolvedValueOnce([GROUP_A])
    await s.fetchTimeline()

    expect(s.bucketMode).toBe(false)
    // The legacy answer is actually on screen, rather than being fetched and then
    // ignored while a stale directory keeps rendering.
    expect(s.months.map((m) => m.key)).toEqual(['2026-07'])
  })

  // R2: a backend restart mid-session fails BOTH endpoints. Flipping bucketMode off
  // before the legacy request meant `timelineGroups` was still the `[]` that
  // entering bucket mode wrote, so `months` came out empty and the page rendered
  // the "No photos" empty state over a library that exists — with no error branch
  // in Photos.vue (only `store.loading`) it stayed that way until the user
  // navigated away. Before the Important 5 fix the stale directory at least stayed
  // on screen; it has to stay on screen now too.
  it('keeps the previous directory on screen when both endpoints fail', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    expect(s.months.map((m) => m.key)).toEqual(['2026-08', '2026-07'])

    svc.photos.getTimelineBuckets.mockRejectedValueOnce(new Error('network down'))
    svc.photos.getTimeline.mockRejectedValueOnce(new Error('network down'))
    await s.fetchTimeline()

    expect(s.bucketMode).toBe(true)
    expect(s.months.map((m) => m.key)).toEqual(['2026-08', '2026-07'])
    expect(s.totalCount).toBe(17) // the directory's own counts, not a blank page
    expect(s.loading).toBe(false)
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

// Task 10: indexing polls index status every 5s, and every tick that saw progress
// used to refetch the whole timeline. In bucket mode the directory is cheap enough
// to poll instead, but a debounce keeps a burst of index progress from becoming a
// burst of directory requests.
describe('photos-timeline fetchIndexStatus directory refresh (bucket mode)', () => {
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

  it('refreshes only the directory while indexing progresses', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce(BUCKETS)
    await s.fetchTimeline()
    svc.photos.getTimelineBuckets.mockClear()
    svc.photos.getTimeline.mockClear()
    svc.photos.getStatus.mockResolvedValueOnce({ indexed: 1 })
    await s.fetchIndexStatus()
    svc.photos.getStatus.mockResolvedValueOnce({ indexed: 2 })
    await s.fetchIndexStatus()
    expect(svc.photos.getTimelineBuckets).toHaveBeenCalledTimes(1)
    expect(svc.photos.getTimeline).not.toHaveBeenCalled()
  })

  it('debounces the directory refresh to at most one per 3 seconds', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValue(BUCKETS)
    await s.fetchTimeline()
    svc.photos.getTimelineBuckets.mockClear()
    svc.photos.getStatus.mockResolvedValueOnce({ indexed: 1 })
    await s.fetchIndexStatus()
    svc.photos.getStatus.mockResolvedValueOnce({ indexed: 2 })
    await s.fetchIndexStatus()
    expect(svc.photos.getTimelineBuckets).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(3001)
    svc.photos.getStatus.mockResolvedValueOnce({ indexed: 3 })
    await s.fetchIndexStatus()
    expect(svc.photos.getTimelineBuckets).toHaveBeenCalledTimes(2)
  })

  it('keeps the legacy quiet refresh when buckets are unavailable', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockRejectedValueOnce(notFound())
    svc.photos.getTimeline.mockResolvedValue([GROUP_A])
    await s.fetchTimeline()
    svc.photos.getTimeline.mockClear()
    svc.photos.getStatus.mockResolvedValueOnce({ indexed: 1 })
    await s.fetchIndexStatus()
    expect(svc.photos.getTimeline).toHaveBeenCalledTimes(1)
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
    await enterBucketMode(s, [{ year: 0, month: 0, count: 1, videoCount: 0, ocrCount: 0 }])
    svc.photos.getTimelineBucket.mockResolvedValueOnce([asset('u1')])
    await s.fetchBucket('unknown')
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(0, 0, 500, 0)
  })

  it('pages until the directory count is covered', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s, [{ year: 2026, month: 8, count: 501, videoCount: 0, ocrCount: 0 }])
    svc.photos.getTimelineBucket
      .mockResolvedValueOnce(Array.from({ length: 500 }, (_, i) => asset(`p${i}`)))
      .mockResolvedValueOnce([asset('p500')])
    await s.fetchBucket('2026-08')
    expect(svc.photos.getTimelineBucket).toHaveBeenNthCalledWith(2, 2026, 8, 500, 500)
    expect(s.months[0].photos).toHaveLength(501)
  })

  it('stops paging early when a page comes back short', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s, [{ year: 2026, month: 8, count: 900, videoCount: 0, ocrCount: 0 }])
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

  // Retitled in the whole-branch review (Important 2): recovery does NOT depend on
  // the month leaving the window and coming back — the grid's request is
  // level-triggered, so a month that failed while it was on screen the whole time
  // is asked for again. All this store owes is: stay unloaded, and accept a retry.
  it('leaves a month unloaded on failure and accepts the next request for it', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s)
    svc.photos.getTimelineBucket.mockRejectedValueOnce(new Error('boom'))
    await s.fetchBucket('2026-08')
    expect(s.months[0].loaded).toBe(false)
    svc.photos.getTimelineBucket.mockResolvedValueOnce([asset('a1')])
    await s.fetchBucket('2026-08')
    expect(s.months[0].loaded).toBe(true)
  })

  // Whole-branch review, minor 10: the pages land after a refresh has already made
  // its staleness decision, so writing them would cache a month from a directory
  // that no longer exists — and the next refresh, diffing new against new, would
  // never clear it.
  it('drops its pages when the month it was loading changed under it', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s)
    let release: (v: unknown) => void = () => {}
    svc.photos.getTimelineBucket.mockImplementationOnce(() => new Promise((r) => { release = r }))
    const slow = s.fetchBucket('2026-08')

    svc.photos.getTimelineBuckets.mockResolvedValueOnce([
      { year: 2026, month: 8, count: 13, videoCount: 3 },
      { year: 2026, month: 7, count: 5, videoCount: 0 },
    ])
    await s.refreshBuckets()

    release([asset('a1')])
    await slow

    const aug = s.months.find((m) => m.key === '2026-08')
    expect(aug?.loaded).toBe(false)
    expect(s.bucketAssets.has('2026-08')).toBe(false)
  })

  it('drops its pages when the month it was loading vanished from the directory', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s)
    let release: (v: unknown) => void = () => {}
    svc.photos.getTimelineBucket.mockImplementationOnce(() => new Promise((r) => { release = r }))
    const slow = s.fetchBucket('2026-08')

    svc.photos.getTimelineBuckets.mockResolvedValueOnce([{ year: 2026, month: 7, count: 5, videoCount: 0 }])
    await s.refreshBuckets()

    release([asset('a1')])
    await slow

    // No orphan key surviving for the lifetime of the page.
    expect(s.bucketAssets.has('2026-08')).toBe(false)
    expect(s.months.map((m) => m.key)).toEqual(['2026-07'])
  })

  it('keeps its pages when the refresh left that month alone', async () => {
    const s = useTimelineStore()
    await enterBucketMode(s)
    let release: (v: unknown) => void = () => {}
    svc.photos.getTimelineBucket.mockImplementationOnce(() => new Promise((r) => { release = r }))
    const slow = s.fetchBucket('2026-08')

    // Only July moved. A global directory counter would drop August's pages here
    // too, and while indexing (a refresh every few seconds) a big month could then
    // never finish loading at all.
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([
      { year: 2026, month: 8, count: 12, videoCount: 3 },
      { year: 2026, month: 7, count: 9, videoCount: 1 },
    ])
    await s.refreshBuckets()

    release([asset('a1')])
    await slow

    const aug = s.months.find((m) => m.key === '2026-08')
    expect(aug?.loaded).toBe(true)
    expect(aug?.photos.map((p) => p.id)).toEqual(['a1'])
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

// Task 9: deleting an asset used to refetch the whole timeline. In bucket mode
// the loaded buckets are patched locally instead, so a delete costs zero
// directory/timeline requests.
describe('photos-timeline deleteAssets (bucket patching)', () => {
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

  it('deleteAssets patches the loaded buckets instead of refetching the timeline', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([{ year: 2026, month: 8, count: 2, videoCount: 1 }])
    await s.fetchTimeline()
    svc.photos.getTimelineBucket.mockResolvedValueOnce([
      { id: 'a1', mimeType: 'image/jpeg' }, { id: 'v1', mimeType: 'video/mp4' },
    ])
    await s.fetchBucket('2026-08')
    svc.photos.deleteAsset.mockResolvedValue(undefined)
    svc.photos.getTimelineBuckets.mockClear()
    svc.photos.getTimeline.mockClear()
    svc.photos.getTimelineBucket.mockClear()

    expect(await s.deleteAssets(['v1'])).toBe(1)
    expect(s.months[0].photos.map((p) => p.id)).toEqual(['a1'])
    expect(s.months[0].count).toBe(1)
    expect(s.months[0].videoCount).toBe(0)
    expect(svc.photos.getTimeline).not.toHaveBeenCalled()
    expect(svc.photos.getTimelineBuckets).not.toHaveBeenCalled()
    expect(svc.photos.getTimelineBucket).not.toHaveBeenCalled()
  })

  it('decrements by what actually got deleted, not by what was asked for', async () => {
    // A partial failure must not leave the directory count lying.
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([{ year: 2026, month: 8, count: 2, videoCount: 0 }])
    await s.fetchTimeline()
    svc.photos.getTimelineBucket.mockResolvedValueOnce([
      { id: 'a1', mimeType: 'image/jpeg' }, { id: 'a2', mimeType: 'image/jpeg' },
    ])
    await s.fetchBucket('2026-08')
    svc.photos.deleteAsset.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('nope'))
    expect(await s.deleteAssets(['a1', 'a2'])).toBe(1)
    expect(s.months[0].count).toBe(1)
    expect(s.months[0].photos.map((p) => p.id)).toEqual(['a2'])
  })

  it('still refetches the legacy timeline when buckets are unavailable', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockRejectedValueOnce(notFound())
    svc.photos.getTimeline.mockResolvedValue([GROUP_A])
    await s.fetchTimeline()
    svc.photos.deleteAsset.mockResolvedValue(undefined)
    svc.photos.getTimeline.mockClear()
    await s.deleteAssets(['a1'])
    expect(svc.photos.getTimeline).toHaveBeenCalledTimes(1)
  })

  it('leaves an unloaded bucket count alone (nothing local to patch)', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([{ year: 2026, month: 8, count: 5, videoCount: 0 }])
    await s.fetchTimeline()
    svc.photos.deleteAsset.mockResolvedValue(undefined)
    await s.deleteAssets(['whatever'])
    expect(s.months[0].count).toBe(5)
  })

  // A month decremented all the way to 0 must not linger as an empty row: the
  // scrubber and month list are both derived from `buckets`, so a bucket stuck
  // at count:0 would render an empty-but-present month forever (no assets to
  // load, nothing left to ever bring it back). The two existing tests above only
  // assert the decrement itself; this pins the follow-on removal.
  it('removes a month from buckets and months once its last assets are deleted', async () => {
    const s = useTimelineStore()
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([
      { year: 2026, month: 8, count: 2, videoCount: 0 },
      { year: 2026, month: 7, count: 1, videoCount: 0 },
    ])
    await s.fetchTimeline()
    svc.photos.getTimelineBucket.mockResolvedValueOnce([
      { id: 'a1', mimeType: 'image/jpeg' }, { id: 'a2', mimeType: 'image/jpeg' },
    ])
    await s.fetchBucket('2026-08')
    svc.photos.deleteAsset.mockResolvedValue(undefined)
    expect(await s.deleteAssets(['a1', 'a2'])).toBe(2)
    expect(s.months.map((m) => m.key)).toEqual(['2026-07'])
    expect(s.months.find((m) => m.key === '2026-08')).toBeUndefined()
  })
})
