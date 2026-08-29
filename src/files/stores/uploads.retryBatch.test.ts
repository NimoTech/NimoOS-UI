import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@nimotech/nimoos-service', () => ({
  refreshAccessToken: () => Promise.resolve(null),
  service: { file: { cancelUpload: vi.fn(), listActiveUploads: vi.fn() } },
}))
// Without this stub, startUpload() drives the REAL scheduler, whose claimNext()
// synchronously flips the just-reset item to 'uploading' (bypassing patch) before
// this test's assertions run — masking the reset under test. A no-op run() keeps
// the item at whatever retryBatch/patch left it, like the scheduler stub in
// uploads.test.ts.
vi.mock('../upload/scheduler', () => ({
  BACKOFF_MS: [1000, 3000, 9000],
  createScheduler: () => ({ isRunning: () => false, abort: vi.fn(), pause: vi.fn(), run: async () => {} }),
}))

import { useUploadsStore } from './uploads'
import type { UploadItem } from '../upload/types'

const mk = (p: Partial<UploadItem> & { id: string; batchId: string }): UploadItem => ({
  file: new Blob(['x']) as unknown as File, fileName: 'a', fileType: '', size: 1,
  targetPath: '/DATA', relativePath: 'a', status: 'error', progress: 50, bytesSent: 1, speed: 0,
  tusUploadUrl: null, retryCount: 1, error: 'server', createdAt: 0, batchTotal: 1,
  conflictPolicy: '', ...p,
})

describe('retryBatch resets error items back to pending', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('resets each retried error item to pending with a cleared error', () => {
    const s = useUploadsStore()
    s.queue.push({
      id: 'e1', file: new Blob(['x']) as unknown as File, fileName: 'a', fileType: '', size: 1,
      targetPath: '/DATA', relativePath: 'a', status: 'error', progress: 50, bytesSent: 1, speed: 0,
      tusUploadUrl: null, retryCount: 1, error: 'server', createdAt: 0, batchId: 'b', batchTotal: 1,
      conflictPolicy: '',
    })
    s.retryBatch('b')
    expect(s.queue[0].status).toBe('pending')
    expect(s.queue[0].error).toBe('')
  })

  it('retry clears the stale tus URL so a cleared staging area is recreated', () => {
    const s = useUploadsStore()
    s.queue.push(mk({ id: 'i1', status: 'error', tusUploadUrl: 'http://nas/upload-tus/gone', batchId: 'b1' }))
    s.retryBatch('b1')
    expect(s.queue[0].tusUploadUrl).toBeNull()
  })

  it('retryItem clears it too', () => {
    const s = useUploadsStore()
    s.queue.push(mk({ id: 'i2', status: 'error', tusUploadUrl: 'http://nas/upload-tus/gone', batchId: 'b2' }))
    s.retryItem('i2')
    expect(s.queue[0].tusUploadUrl).toBeNull()
  })
})
