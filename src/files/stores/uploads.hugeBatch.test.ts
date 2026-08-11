import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@nimotech/nimoos-service', () => ({
  refreshAccessToken: vi.fn().mockResolvedValue('t'),
  service: {
    file: {
      uploadPrecheck: vi.fn().mockResolvedValue({ results: [] }),
      cancelUpload: vi.fn().mockResolvedValue(undefined),
      listActiveUploads: vi.fn().mockResolvedValue({ tasks: [] }),
    },
    uploadBatches: { createBatch: vi.fn().mockResolvedValue(undefined) },
  },
}))
// No-op scheduler: items stay pending so the enqueue itself is what's under test.
vi.mock('../upload/scheduler', () => ({
  BACKOFF_MS: [1000, 3000, 9000],
  createScheduler: () => ({ isRunning: () => false, abort: vi.fn(), pause: vi.fn(), run: async () => {} }),
}))
vi.mock('../stores/files', () => ({ useFilesStore: () => ({ currentPath: '/DATA/x', load: vi.fn() }) }))
vi.mock('../../stores/toast', () => ({ useToast: () => ({ show: vi.fn() }) }))
vi.mock('../../i18n', () => ({ i18n: { global: { t: (k: string) => k } } }))

import { useUploadsStore } from './uploads'

// A plain object stands in for File: the enqueue path only reads name/type/size,
// and building 200k real File instances would dominate the test's runtime.
const fakeFile = (name: string) => ({ name, type: 'application/octet-stream', size: 1 }) as unknown as File

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('uploads store: very large batches', () => {
  // Regression: queue.value.push(...items) passed one argument per file, and a
  // ~90k-file folder pick overflowed the call stack in Chrome (RangeError at
  // Proxy.push) — the rejection was unhandled, so the upload died silently:
  // no panel, no requests, no files. Reproduced 2026-08-11 on the live page
  // via CDP; 200k is used here because Node's default stack survives 90k.
  it('enqueues 200k files without overflowing the call stack', async () => {
    const s = useUploadsStore()
    const files = Array.from({ length: 200_000 }, (_, i) => ({
      file: fakeFile(`f${i}.bin`),
      targetPath: '/DATA/x',
      relativePath: `big/d${Math.floor(i / 1000)}/f${i}.bin`,
    }))
    const { rejected } = await s.addFilesToQueue(files)
    expect(rejected).toEqual([])
    expect(s.queue.length).toBe(200_000)
    expect(s.queue[199_999].relativePath).toBe('big/d199/f199999.bin')
  }, 60_000)
})
