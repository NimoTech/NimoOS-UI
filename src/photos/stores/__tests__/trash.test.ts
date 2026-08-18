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
// Stub the timeline store's fetchTimeline/refreshBuckets so these tests make
// no real request. bucketMode is mutable per-test (default false = legacy) so
// bucket-mode cases can flip it before calling the trash action under test.
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

  it('fetchTrash maps via trashAssetToPhoto, tolerates null', async () => {
    const s = usePhotosTrash()
    await s.fetchTrash()
    expect(s.items.length).toBe(1)
    expect(s.items[0].id).toBe('t1')
    ;(service.photos.listTrash as any).mockResolvedValueOnce(null)
    await s.fetchTrash()
    expect(s.items.length).toBe(0)
  })

  it('fetchTrash failure clears items but leaves loaded false (retryable)', async () => {
    const s = usePhotosTrash()
    ;(service.photos.listTrash as any).mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await s.fetchTrash()
    expect(s.items).toEqual([])
    expect(s.loaded).toBe(false)
    expect(spy).toHaveBeenCalledWith('[photos-trash] fetchTrash', expect.any(Error))
    spy.mockRestore()
  })

  it('fetchTrash success sets loaded=true', async () => {
    const s = usePhotosTrash()
    expect(s.loaded).toBe(false)
    await s.fetchTrash()
    expect(s.loaded).toBe(true)
  })

  it('restore re-fetches trash and, in legacy mode, refetches the full timeline', async () => {
    const s = usePhotosTrash()
    await s.restore(['t1'])
    expect(service.photos.restoreTrashBatch).toHaveBeenCalledWith(['t1'])
    expect(service.photos.listTrash).toHaveBeenCalled()
    expect(timelineStub.fetchTimeline).toHaveBeenCalledTimes(1)
    expect(timelineStub.refreshBuckets).not.toHaveBeenCalled()
  })

  it('restoreAll re-fetches trash and, in legacy mode, refetches the full timeline', async () => {
    const s = usePhotosTrash()
    await s.restoreAll()
    expect(service.photos.restoreAllTrash).toHaveBeenCalled()
    expect(service.photos.listTrash).toHaveBeenCalled()
    expect(timelineStub.fetchTimeline).toHaveBeenCalledTimes(1)
    expect(timelineStub.refreshBuckets).not.toHaveBeenCalled()
  })

  it('empty calls emptyTrash then re-fetches', async () => {
    const s = usePhotosTrash()
    await s.empty()
    expect(service.photos.emptyTrash).toHaveBeenCalled()
  })

  it('purge deletes one by one then re-fetches', async () => {
    const s = usePhotosTrash()
    await s.purge(['t1', 't2'])
    expect(service.photos.purgeTrash).toHaveBeenCalledTimes(2)
  })

  it('purge swallows and logs a single item failure without affecting the rest or the follow-up re-fetch', async () => {
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

  it('undoRestore deletes each asset and, in legacy mode, refetches the full timeline', async () => {
    const s = usePhotosTrash()
    await s.undoRestore(['t1'])
    expect(service.photos.deleteAsset).toHaveBeenCalledWith('t1')
    expect(timelineStub.fetchTimeline).toHaveBeenCalledTimes(1)
    expect(timelineStub.refreshBuckets).not.toHaveBeenCalled()
  })

  it('undoRestore swallows and logs a single item failure', async () => {
    const s = usePhotosTrash()
    ;(service.photos.deleteAsset as any).mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await s.undoRestore(['t1'])
    expect(spy).toHaveBeenCalledWith('[photos-trash] undoRestore', 't1', expect.any(Error))
    spy.mockRestore()
  })

  it('fetchRetention reads config', async () => {
    const s = usePhotosTrash()
    await s.fetchRetention()
    expect(s.retentionDays).toBe(15)
  })

  it('fetchRetention logs on failure and keeps the default value', async () => {
    const s = usePhotosTrash()
    ;(service.photos.getConfig as any).mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await s.fetchRetention()
    expect(s.retentionDays).toBe(30)
    expect(spy).toHaveBeenCalledWith('[photos-trash] fetchRetention', expect.any(Error))
    spy.mockRestore()
  })

  it('setRetention GETs watchDirs first, then PUTs', async () => {
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

// Task 12 (SP15-P3): NimoOS-Photos#54 turned an absent limit into 500, so trash has to be
// paged the same way Task 11 paged favorites — same seven shapes, see favorites.test.ts.
describe('photosTrash store — pagination (Task 12)', () => {
  const T = (id: string) => ({ id, mimeType: 'image/jpeg' })
  const page = (n: number, from = 0) => Array.from({ length: n }, (_, i) => T(`t${from + i}`))

  beforeEach(() => {
    setActivePinia(createPinia())
    timelineStub.bucketMode = false
    timelineStub.fetchTimeline.mockClear()
    timelineStub.refreshBuckets.mockClear()
    // These tests assert exact call counts / last-call args on listTrash, unlike the
    // toHaveBeenCalled()-only assertions above — the shared vi.fn() carries call history
    // across tests in this file, so it must be cleared per-test here.
    ;(service.photos.listTrash as any).mockClear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('fetchTrash asks for one page and reports exhaustion on a short page', async () => {
    const s = usePhotosTrash()
    ;(service.photos.listTrash as any).mockResolvedValueOnce(page(3))
    await s.fetchTrash()
    expect(service.photos.listTrash).toHaveBeenCalledWith(500, 0)
    expect(s.trashExhausted).toBe(true)
  })

  it('loadMoreTrash appends the next page and advances the offset', async () => {
    const s = usePhotosTrash()
    ;(service.photos.listTrash as any).mockResolvedValueOnce(page(500))
    await s.fetchTrash()
    expect(s.trashExhausted).toBe(false)
    ;(service.photos.listTrash as any).mockResolvedValueOnce(page(2, 500))
    await s.loadMoreTrash()
    expect(service.photos.listTrash).toHaveBeenLastCalledWith(500, 500)
    expect(s.items).toHaveLength(502)
    expect(s.trashExhausted).toBe(true)
  })

  it('refuses to page past the end', async () => {
    const s = usePhotosTrash()
    ;(service.photos.listTrash as any).mockResolvedValueOnce(page(3))
    await s.fetchTrash()
    await s.loadMoreTrash()
    expect(service.photos.listTrash).toHaveBeenCalledTimes(1)
  })

  it('does not run two loadMore requests at once', async () => {
    const s = usePhotosTrash()
    ;(service.photos.listTrash as any).mockResolvedValueOnce(page(500))
    await s.fetchTrash()
    ;(service.photos.listTrash as any).mockResolvedValue(page(500, 500))
    await Promise.all([s.loadMoreTrash(), s.loadMoreTrash()])
    // first page (fetchTrash) + exactly one loadMore — the second concurrent call must be a
    // no-op, not a second in-flight request.
    expect(service.photos.listTrash).toHaveBeenCalledTimes(2)
  })

  it('discards a stale in-flight page after a refresh (interleaved)', async () => {
    const s = usePhotosTrash()
    ;(service.photos.listTrash as any).mockResolvedValueOnce(page(500))
    await s.fetchTrash()
    let release: (v: unknown) => void = () => {}
    ;(service.photos.listTrash as any).mockImplementationOnce(
      () => new Promise((r) => { release = r }),
    )
    const slow = s.loadMoreTrash()
    ;(service.photos.listTrash as any).mockResolvedValueOnce(page(1))
    await s.fetchTrash() // generation bumps here
    release(page(500, 500)) // the slow page comes back afterwards
    await slow
    expect(s.items).toHaveLength(1)
    expect(s.loadingMore).toBe(false)
  })

  it('resets the cursor on a failed page so the next attempt does not skip rows', async () => {
    const s = usePhotosTrash()
    ;(service.photos.listTrash as any).mockResolvedValueOnce(page(500))
    await s.fetchTrash()
    ;(service.photos.listTrash as any).mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await s.loadMoreTrash()
    expect(s.loadingMore).toBe(false)
    ;(service.photos.listTrash as any).mockResolvedValueOnce(page(1, 500))
    await s.loadMoreTrash()
    expect(service.photos.listTrash).toHaveBeenLastCalledWith(500, 500)
    spy.mockRestore()
  })

  it('fetchTrash resets the cursor so a later refresh starts from page one', async () => {
    const s = usePhotosTrash()
    ;(service.photos.listTrash as any).mockResolvedValueOnce(page(500))
    await s.fetchTrash()
    ;(service.photos.listTrash as any).mockResolvedValueOnce(page(2, 500))
    await s.loadMoreTrash()
    expect(s.trashExhausted).toBe(true)
    // A second fetchTrash() (e.g. a full refresh) must ask page one again, not continue
    // from the offset the previous session left behind.
    ;(service.photos.listTrash as any).mockResolvedValueOnce(page(500))
    await s.fetchTrash()
    expect(service.photos.listTrash).toHaveBeenLastCalledWith(500, 0)
    expect(s.trashExhausted).toBe(false)
  })

  // Ownership case Task 11 needed: a refresh-triggered fetchTrash() racing an in-flight
  // loadMoreTrash() must not let the stale call clear the newer one's loadingMore flag.
  it('a restore-triggered fetchTrash landing mid-flight does not let the stale loadMoreTrash call clear a newer one\'s loadingMore', async () => {
    const s = usePhotosTrash()
    ;(service.photos.listTrash as any).mockResolvedValueOnce(page(500))
    await s.fetchTrash()

    // Call A: load-more starts, held open (simulates the network still in flight when the
    // user restores a batch out of the trash).
    let releaseA: (v: unknown) => void = () => {}
    ;(service.photos.listTrash as any).mockImplementationOnce(
      () => new Promise((r) => { releaseA = r }),
    )
    const a = s.loadMoreTrash()

    // The restore refreshes the list via fetchTrash(), completing fully while A is still
    // pending — this is what restore()/restoreAll()/purge()/empty()/undoRestore() do today.
    ;(service.photos.listTrash as any).mockResolvedValueOnce(page(500, 500))
    await s.fetchTrash()

    // The button is enabled again (fetchTrash forced loadingMore false); the user clicks it,
    // starting call B, itself held open too.
    let releaseB: (v: unknown) => void = () => {}
    ;(service.photos.listTrash as any).mockImplementationOnce(
      () => new Promise((r) => { releaseB = r }),
    )
    const b = s.loadMoreTrash()
    expect(s.loadingMore).toBe(true) // B owns the flag now

    // A's stale page finally lands. It must be dropped (generation mismatch) — and, the
    // point of this test, must NOT clear loadingMore out from under B.
    releaseA(page(1, 900))
    await a
    expect(s.loadingMore).toBe(true) // still B's flag, not reset by stale A

    // Clean up: let B settle too, restoring the normal end state.
    releaseB(page(1, 1000))
    await b
    expect(s.loadingMore).toBe(false)
  })
})
