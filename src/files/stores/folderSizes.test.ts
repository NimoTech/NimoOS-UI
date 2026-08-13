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
})
