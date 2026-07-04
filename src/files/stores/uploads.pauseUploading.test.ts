import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// vi.mock factories are hoisted above the module; a plain top-level `const`
// referenced inside one throws "Cannot access before initialization". vi.hoisted
// runs before that hoisting so the mock can safely close over it.
const { pauseSpy } = vi.hoisted(() => ({ pauseSpy: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({
  refreshAccessToken: () => Promise.resolve(null),
  service: { file: { cancelUpload: vi.fn(), listActiveUploads: vi.fn() } },
}))
vi.mock('../upload/persist', () => ({
  persistNewItem: () => {}, persistItemMeta: vi.fn(), dropPersisted: () => {},
  restoreFromIDB: () => Promise.resolve({ items: [], resumedCount: 0 }),
  pruneOldItems: () => Promise.resolve(0),
}))
// Fake scheduler with an observable `pause` handle — asserts pauseItem routes
// through the scheduler for an uploading item instead of patching status directly.
vi.mock('../upload/scheduler', () => ({
  BACKOFF_MS: [1000, 3000, 9000],
  createScheduler: () => ({ isRunning: () => false, abort: vi.fn(), pause: pauseSpy, run: async () => {} }),
}))

import { useUploadsStore } from './uploads'

function seedUploading(store: any, over: Record<string, unknown> = {}) {
  store.queue.push({
    id: 'u1', file: new Blob(['x']), fileName: 'a', fileType: '', size: 1, targetPath: '/DATA',
    relativePath: 'a', status: 'uploading', progress: 30, bytesSent: 3, speed: 5, tusUploadUrl: 'u',
    retryCount: 0, error: '', createdAt: 1, batchId: 'b', batchTotal: 1, restored: false,
    conflictPolicy: '', oversize: false, ...over,
  })
}

describe('pauseItem on an uploading item', () => {
  beforeEach(() => { setActivePinia(createPinia()); pauseSpy.mockClear() })

  it('routes through scheduler.pause(id), not a direct status patch', () => {
    const s = useUploadsStore()
    seedUploading(s)

    s.pauseItem('u1')

    expect(pauseSpy).toHaveBeenCalledWith('u1')
    expect(pauseSpy).toHaveBeenCalledTimes(1)
    // The uploading branch of pauseItem does not patch status itself — only the
    // (real, unmocked) scheduler flips it to 'paused' once the in-flight upload
    // handle actually pauses.
    expect(s.queue[0].status).toBe('uploading')
  })
})
