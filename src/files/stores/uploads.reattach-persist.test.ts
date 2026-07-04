import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// vi.mock factories are hoisted above the module; a plain top-level `const`
// referenced inside one throws "Cannot access before initialization". vi.hoisted
// runs before that hoisting so the mock can safely close over it.
const { persistNewItem } = vi.hoisted(() => ({ persistNewItem: vi.fn() }))
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
// Without this stub, startUpload() drives the REAL scheduler, whose claimNext()
// synchronously flips the just-reattached item to 'uploading' before this test's
// assertions run — masking the very persistence bug under test. A no-op run()
// keeps the item at whatever reattachFiles/patch left it, like the scheduler
// stub in uploads.retryBatch.test.ts.
vi.mock('../upload/scheduler', () => ({
  BACKOFF_MS: [1000, 3000, 9000],
  createScheduler: () => ({ isRunning: () => false, abort: vi.fn(), pause: vi.fn(), run: async () => {} }),
}))

import { useUploadsStore } from './uploads'

describe('reattachFiles re-persists the blob', () => {
  beforeEach(() => { setActivePinia(createPinia()); persistNewItem.mockClear() })

  it('stores the re-picked file so a second refresh keeps it resumable', async () => {
    const s = useUploadsStore()
    s.queue.push({
      id: 'nf', file: null, fileName: 'a.txt', fileType: '', size: 3, targetPath: '/DATA',
      relativePath: 'a.txt', status: 'needs_file', progress: 0, bytesSent: 0, speed: 0,
      tusUploadUrl: null, retryCount: 0, error: '', createdAt: 0, batchId: 'b', batchTotal: 1,
      restored: true, conflictPolicy: '', oversize: false,
    })
    const f = new File(['abc'], 'a.txt')
    await s.reattachFiles([{ file: f, targetPath: '/DATA', relativePath: 'a.txt' }])
    expect(persistNewItem).toHaveBeenCalled()
    expect(s.queue[0].status).toBe('pending')
  })
})
