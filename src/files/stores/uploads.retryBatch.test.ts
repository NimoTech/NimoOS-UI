import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// vi.mock factories are hoisted above the module; a plain top-level `const`
// referenced inside one throws "Cannot access before initialization". vi.hoisted
// runs before that hoisting so the mock can safely close over it.
const { persistItemMeta } = vi.hoisted(() => ({ persistItemMeta: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({
  refreshAccessToken: () => Promise.resolve(null),
  service: { file: { cancelUpload: vi.fn(), listActiveUploads: vi.fn() } },
}))
vi.mock('../upload/persist', () => ({
  persistNewItem: () => {}, persistItemMeta, dropPersisted: () => {},
  restoreFromIDB: () => Promise.resolve({ items: [], resumedCount: 0 }),
  pruneOldItems: () => Promise.resolve(0),
}))
// Without this stub, startUpload() drives the REAL scheduler, whose claimNext()
// synchronously flips the just-reset item to 'uploading' (bypassing patch) before
// this test's assertions run — masking the very persistence bug under test. A
// no-op run() keeps the item at whatever retryBatch/patch left it, like the
// scheduler stub in uploads.test.ts.
vi.mock('../upload/scheduler', () => ({
  BACKOFF_MS: [1000, 3000, 9000],
  createScheduler: () => ({ isRunning: () => false, abort: vi.fn(), pause: vi.fn(), run: async () => {} }),
}))

import { useUploadsStore } from './uploads'

describe('retryBatch persists status via patch', () => {
  beforeEach(() => { setActivePinia(createPinia()); persistItemMeta.mockClear() })

  it('re-persists each retried error item (not just in-memory)', () => {
    const s = useUploadsStore()
    s.queue.push({
      id: 'e1', file: new Blob(['x']) as unknown as File, fileName: 'a', fileType: '', size: 1,
      targetPath: '/DATA', relativePath: 'a', status: 'error', progress: 50, bytesSent: 1, speed: 0,
      tusUploadUrl: null, retryCount: 1, error: 'server', createdAt: 0, batchId: 'b', batchTotal: 1,
      restored: false, conflictPolicy: '', oversize: false,
    })
    s.retryBatch('b')
    expect(s.queue[0].status).toBe('pending')
    expect(s.queue[0].error).toBe('')
    expect(persistItemMeta).toHaveBeenCalled() // proves it went through patch()
  })
})
