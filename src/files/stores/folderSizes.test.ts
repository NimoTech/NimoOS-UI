import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@nimotech/nimoos-service', () => ({
  service: { folder: { getFolderSize: vi.fn() } },
}))

import { useFolderSizesStore } from './folderSizes'
import { service } from '@nimotech/nimoos-service'

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('folderSizesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(service.folder.getFolderSize).mockReset()
  })

  it('compute resolves to done with the byte count', async () => {
    vi.mocked(service.folder.getFolderSize).mockResolvedValue(2048)
    const s = useFolderSizesStore()
    expect(s.statusOf('/DATA/Docs')).toBe('idle')
    await s.compute('/DATA/Docs')
    expect(s.statusOf('/DATA/Docs')).toBe('done')
    expect(s.bytesOf('/DATA/Docs')).toBe(2048)
  })

  it('deduplicates: no second request while loading or once done', async () => {
    const d = deferred<number>()
    vi.mocked(service.folder.getFolderSize).mockReturnValue(d.promise)
    const s = useFolderSizesStore()
    const first = s.compute('/DATA/Docs')
    await s.compute('/DATA/Docs') // still loading -> no-op
    expect(service.folder.getFolderSize).toHaveBeenCalledTimes(1)
    d.resolve(10)
    await first
    await s.compute('/DATA/Docs') // done -> cached, no-op
    expect(service.folder.getFolderSize).toHaveBeenCalledTimes(1)
  })

  it('failure lands in error, and compute after error retries the request', async () => {
    vi.mocked(service.folder.getFolderSize).mockRejectedValueOnce(new Error('boom'))
    const s = useFolderSizesStore()
    await s.compute('/DATA/Docs')
    expect(s.statusOf('/DATA/Docs')).toBe('error')
    vi.mocked(service.folder.getFolderSize).mockResolvedValueOnce(7)
    await s.compute('/DATA/Docs')
    expect(s.statusOf('/DATA/Docs')).toBe('done')
    expect(s.bytesOf('/DATA/Docs')).toBe(7)
  })

  it('epoch guard: a response arriving after reset() is silently dropped', async () => {
    const d = deferred<number>()
    vi.mocked(service.folder.getFolderSize).mockReturnValue(d.promise)
    const s = useFolderSizesStore()
    const inflight = s.compute('/DATA/Docs')
    s.reset() // listing reloaded while the walk was still running
    d.resolve(999)
    await inflight
    // The stale result must not be written back: the path stays idle.
    expect(s.statusOf('/DATA/Docs')).toBe('idle')
    expect(s.bytesOf('/DATA/Docs')).toBeUndefined()
  })

  it('epoch guard also drops stale failures', async () => {
    const d = deferred<number>()
    vi.mocked(service.folder.getFolderSize).mockReturnValue(d.promise)
    const s = useFolderSizesStore()
    const inflight = s.compute('/DATA/Docs')
    s.reset()
    d.reject(new Error('boom'))
    await inflight
    expect(s.statusOf('/DATA/Docs')).toBe('idle')
  })

  it('reset clears every path', async () => {
    vi.mocked(service.folder.getFolderSize).mockResolvedValue(1)
    const s = useFolderSizesStore()
    await s.compute('/DATA/A')
    await s.compute('/DATA/B')
    s.reset()
    expect(s.statusOf('/DATA/A')).toBe('idle')
    expect(s.statusOf('/DATA/B')).toBe('idle')
  })

  it('reset() aborts the in-flight request', async () => {
    let capturedSignal: AbortSignal | undefined
    const d = deferred<number>()
    vi.mocked(service.folder.getFolderSize).mockImplementation((_path, opts) => {
      capturedSignal = opts?.signal
      return d.promise
    })
    const s = useFolderSizesStore()
    const inflight = s.compute('/DATA/Docs')
    expect(capturedSignal?.aborted).toBe(false)
    s.reset()
    expect(capturedSignal?.aborted).toBe(true)
    // Simulate axios rejecting the in-flight call once the signal fires.
    // The epoch guard must drop this rejection: no error state resurrected
    // for a path the current view (post-reset) no longer cares about.
    d.reject(new DOMException('aborted', 'AbortError'))
    await inflight
    expect(s.statusOf('/DATA/Docs')).toBe('idle')
  })

  it('caps concurrency at 3 in-flight requests: a 4th compute() is queued and issued once one settles', async () => {
    const deferreds = [deferred<number>(), deferred<number>(), deferred<number>(), deferred<number>()]
    let callIndex = 0
    vi.mocked(service.folder.getFolderSize).mockImplementation(() => deferreds[callIndex++].promise)
    const s = useFolderSizesStore()

    const p1 = s.compute('/DATA/A')
    const p2 = s.compute('/DATA/B')
    const p3 = s.compute('/DATA/C')
    const p4 = s.compute('/DATA/D') // over the cap: must queue, not call the service

    expect(service.folder.getFolderSize).toHaveBeenCalledTimes(3)
    // Queued paths show 'loading' immediately, same as in-flight ones — the
    // UI does not distinguish "queued" from "running".
    expect(s.statusOf('/DATA/D')).toBe('loading')

    deferreds[0].resolve(10)
    await p1
    await Promise.resolve() // let the queue drain pick up the 4th

    expect(service.folder.getFolderSize).toHaveBeenCalledTimes(4)
    expect(s.statusOf('/DATA/D')).toBe('loading')

    deferreds[1].resolve(20)
    deferreds[2].resolve(30)
    deferreds[3].resolve(40)
    await Promise.all([p2, p3, p4])
    expect(s.statusOf('/DATA/D')).toBe('done')
    expect(s.bytesOf('/DATA/D')).toBe(40)
  })

  it('reset() clears the queue: a queued compute() never issues its request', async () => {
    const active = [deferred<number>(), deferred<number>(), deferred<number>()]
    let callIndex = 0
    vi.mocked(service.folder.getFolderSize).mockImplementation(() => active[callIndex++].promise)
    const s = useFolderSizesStore()

    const p1 = s.compute('/DATA/A')
    const p2 = s.compute('/DATA/B')
    const p3 = s.compute('/DATA/C')
    void s.compute('/DATA/D') // queued behind the cap; deliberately never awaited — reset() strands it

    expect(service.folder.getFolderSize).toHaveBeenCalledTimes(3)
    s.reset()
    active[0].resolve(1)
    active[1].resolve(2)
    active[2].resolve(3)
    await Promise.all([p1, p2, p3])

    // The queue was emptied by reset(), so draining a settled slot never
    // reaches the queued path's thunk.
    expect(service.folder.getFolderSize).toHaveBeenCalledTimes(3)
    expect(s.statusOf('/DATA/D')).toBe('idle')
  })
})
