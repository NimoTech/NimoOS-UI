import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// vi.mock factories are hoisted above the module; a plain top-level `const`
// referenced inside one throws "Cannot access before initialization". vi.hoisted
// runs before that hoisting so the mock can safely close over it.
const { persistNewItem, runSpy } = vi.hoisted(() => ({
  persistNewItem: vi.fn(),
  runSpy: vi.fn(async () => {}),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  refreshAccessToken: () => Promise.resolve(null),
  service: { file: { cancelUpload: vi.fn(), listActiveUploads: vi.fn() } },
}))
vi.mock('../upload/persist', () => ({
  persistNewItem, persistItemMeta: () => {}, dropPersisted: () => {},
  restoreFromIDB: () => Promise.resolve({ items: [], resumedCount: 0 }),
  pruneOldItems: () => Promise.resolve(0),
}))
vi.mock('../upload/conflict', async (orig) => {
  const actual = await (orig as any)()
  return { ...actual, precheckExisting: () => Promise.resolve(new Set<string>()) }
})
// Fake scheduler whose run() is directly observable — this is the side effect
// we assert on instead of vi.spyOn(store, 'startUpload'), which can't intercept
// a Pinia setup-store's internal direct call to its own closure (P3b gotcha).
vi.mock('../upload/scheduler', () => ({
  BACKOFF_MS: [1000, 3000, 9000],
  createScheduler: () => ({ isRunning: () => false, abort: vi.fn(), pause: vi.fn(), run: runSpy }),
}))
vi.mock('../stores/files', () => ({ useFilesStore: () => ({ currentPath: '/DATA', load: vi.fn() }) }))

import { useUploadsStore } from './uploads'
import type { UploadItem } from '../upload/types'

function needsFileItem(over: Partial<UploadItem> = {}): UploadItem {
  return {
    id: 'nf', file: null, fileName: 'a.txt', fileType: '', size: 3, targetPath: '/DATA',
    relativePath: 'a.txt', status: 'needs_file', progress: 0, bytesSent: 0, speed: 0,
    tusUploadUrl: null, retryCount: 0, error: '', createdAt: 0, batchId: 'b', batchTotal: 1,
    restored: true, conflictPolicy: '', oversize: false, ...over,
  }
}

describe('reattachFiles auto-starts the upload when idle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    persistNewItem.mockClear()
    runSpy.mockClear()
  })

  it('matches a pending-restore item and triggers the scheduler while uploading===false', async () => {
    const s = useUploadsStore()
    s.queue.push(needsFileItem())
    expect(s.uploading).toBe(false)

    const f = new File(['abc'], 'a.txt')
    const { matched } = await s.reattachFiles([{ file: f, targetPath: '/DATA', relativePath: 'a.txt' }])

    expect(matched).toBe(1)
    expect(runSpy).toHaveBeenCalled() // the fake scheduler was actually driven
  })

  it('does not start a second run when an upload is already in flight', async () => {
    const s = useUploadsStore()
    s.queue.push(needsFileItem({ id: 'nf2' }))
    s.uploading = true // simulate an upload already running

    const f = new File(['abc'], 'a.txt')
    await s.reattachFiles([{ file: f, targetPath: '/DATA', relativePath: 'a.txt' }])

    expect(runSpy).not.toHaveBeenCalled()
  })
})
