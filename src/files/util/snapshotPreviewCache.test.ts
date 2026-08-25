import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSnapshotPreview, clearSnapshotPreviewCache } from './snapshotPreviewCache'

const getListMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { folder: { getList: (p: string) => getListMock(p) } },
}))

const CONTENT = [
  { name: 'a.jpg', path: '/x/a.jpg', is_dir: false, size: 100, date: '2026-01-01T00:00:00Z' },
  { name: 'sub', path: '/x/sub', is_dir: true, date: '2026-01-02T00:00:00Z' },
  { name: '.hidden', path: '/x/.hidden', is_dir: false },
  { name: 'lost+found', path: '/x/lost+found', is_dir: true },
]

beforeEach(() => {
  vi.clearAllMocks()
  clearSnapshotPreviewCache()
  getListMock.mockResolvedValue({ content: CONTENT })
})

describe('getSnapshotPreview', () => {
  it('fetches <mount>/.snapshots/<snapshotName>/<relPath>', async () => {
    await getSnapshotPreview('/DATA', 'snap1', 'Photos')
    expect(getListMock).toHaveBeenCalledWith('/DATA/.snapshots/snap1/Photos')
  })

  it('fetches the snapshot root when relPath is empty', async () => {
    await getSnapshotPreview('/DATA', 'snap1', '')
    expect(getListMock).toHaveBeenCalledWith('/DATA/.snapshots/snap1')
  })

  it('filters hidden/dot entries and maps to PreviewFile shape', async () => {
    const result = await getSnapshotPreview('/DATA', 'snap1', 'Photos')
    expect(result.error).toBe(false)
    expect(result.entries.map((e) => e.name)).toEqual(['a.jpg', 'sub'])
    expect(result.entries[0]).toEqual({
      name: 'a.jpg', isDir: false, size: 100, mtime: new Date('2026-01-01T00:00:00Z').getTime(),
    })
    expect(result.entries[1]).toEqual({
      name: 'sub', isDir: true, size: 0, mtime: new Date('2026-01-02T00:00:00Z').getTime(),
    })
  })

  it('dedupes concurrent requests for the same key: one fetch serves both callers', async () => {
    let resolveIt: (v: unknown) => void = () => {}
    getListMock.mockReturnValueOnce(new Promise((r) => { resolveIt = r }))
    const p1 = getSnapshotPreview('/DATA', 'snap1', 'Photos')
    const p2 = getSnapshotPreview('/DATA', 'snap1', 'Photos')
    resolveIt({ content: CONTENT })
    const [r1, r2] = await Promise.all([p1, p2])
    expect(getListMock).toHaveBeenCalledTimes(1)
    expect(r1).toBe(r2)
  })

  it('fetches distinct keys separately (different snapshotName)', async () => {
    await Promise.all([
      getSnapshotPreview('/DATA', 'snap1', 'Photos'),
      getSnapshotPreview('/DATA', 'snap2', 'Photos'),
    ])
    expect(getListMock).toHaveBeenCalledTimes(2)
  })

  it('fetches distinct keys separately (different relPath)', async () => {
    await Promise.all([
      getSnapshotPreview('/DATA', 'snap1', 'Photos'),
      getSnapshotPreview('/DATA', 'snap1', 'Docs'),
    ])
    expect(getListMock).toHaveBeenCalledTimes(2)
  })

  it('fetches distinct keys separately (different mount)', async () => {
    await Promise.all([
      getSnapshotPreview('/DATA', 'snap1', 'Photos'),
      getSnapshotPreview('/DATA2', 'snap1', 'Photos'),
    ])
    expect(getListMock).toHaveBeenCalledTimes(2)
  })

  // Vue2 parity (controller ruling: Vue2 source is authority over the task brief's prose,
  // which had this backwards). Verified against NimoOS-UI's snapshotPreviewCache.js: it never
  // caches an error for the session -- setCachedSnapshotPreview's `promise.catch(() => { if
  // (cache.get(key) === promise) cache.delete(key) })` evicts the entry on failure, so the next
  // mount/call for the same key fires a fresh request. Reproduced here as: a call that resolves
  // `{ entries: [], error: true }` gets its cache slot evicted immediately after settling, so a
  // second call for the same key is a genuine second fetch, not a cache hit.
  it('evicts a failed key so the next call for the same key triggers a second fetch (Vue2 semantics)', async () => {
    getListMock.mockRejectedValueOnce(new Error('boom'))
    const r1 = await getSnapshotPreview('/DATA', 'snap1', 'Photos')
    expect(r1).toEqual({ entries: [], error: true })
    getListMock.mockResolvedValueOnce({ content: CONTENT })
    const r2 = await getSnapshotPreview('/DATA', 'snap1', 'Photos')
    expect(r2.error).toBe(false)
    expect(getListMock).toHaveBeenCalledTimes(2)
  })

  it('clear() makes the next call refetch a previously-successful key too', async () => {
    await getSnapshotPreview('/DATA', 'snap1', 'Photos')
    clearSnapshotPreviewCache()
    await getSnapshotPreview('/DATA', 'snap1', 'Photos')
    expect(getListMock).toHaveBeenCalledTimes(2)
  })
})
