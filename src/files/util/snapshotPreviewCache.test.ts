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

  it('caches a failed result for the session -- no retry on a later call with the same key', async () => {
    getListMock.mockRejectedValueOnce(new Error('boom'))
    const r1 = await getSnapshotPreview('/DATA', 'snap1', 'Photos')
    expect(r1).toEqual({ entries: [], error: true })
    const r2 = await getSnapshotPreview('/DATA', 'snap1', 'Photos')
    expect(r2).toEqual({ entries: [], error: true })
    expect(getListMock).toHaveBeenCalledTimes(1)
  })

  it('clear() makes the next call refetch, including for a previously-errored key', async () => {
    getListMock.mockRejectedValueOnce(new Error('boom'))
    await getSnapshotPreview('/DATA', 'snap1', 'Photos')
    clearSnapshotPreviewCache()
    getListMock.mockResolvedValueOnce({ content: CONTENT })
    const result = await getSnapshotPreview('/DATA', 'snap1', 'Photos')
    expect(result.error).toBe(false)
    expect(getListMock).toHaveBeenCalledTimes(2)
  })
})
