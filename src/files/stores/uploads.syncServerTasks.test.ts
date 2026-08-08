import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@nimotech/nimoos-service', () => ({
  refreshAccessToken: () => Promise.resolve(null),
  service: { file: { listActiveUploads: vi.fn(), cancelUpload: vi.fn(() => Promise.resolve()) } },
}))

import { service } from '@nimotech/nimoos-service'
import { useUploadsStore } from './uploads'

const task = (o = {}) => ({
  id: 'srv1', filename: 'a.txt', relative_path: 'a.txt', target_path: '/DATA/Documents',
  size: 100, mime: '', offset: 30, upload_url: '/v2/nimoos/file/upload-tus/srv1',
  retry_count: 0, created_at: 1700, batch_id: '', ...o,
})

describe('uploads.syncServerTasks', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('appends server-only tasks as needs_file rows', async () => {
    ;(service.file.listActiveUploads as any).mockResolvedValue({ tasks: [task()] })
    const s = useUploadsStore()
    await s.syncServerTasks()
    expect(s.queue).toHaveLength(1)
    expect(s.queue[0]).toMatchObject({ id: 'srv1', status: 'needs_file', bytesSent: 30 })
  })

  it('swallows a listActiveUploads error and leaves the queue untouched', async () => {
    ;(service.file.listActiveUploads as any).mockRejectedValue(new Error('offline'))
    const s = useUploadsStore()
    await s.syncServerTasks()
    expect(s.queue).toEqual([])
  })

  it('merges a server offset into a content-matched local item instead of duplicating', async () => {
    ;(service.file.listActiveUploads as any).mockResolvedValue({ tasks: [task({ id: 'srv1', offset: 55 })] })
    const s = useUploadsStore()
    // Seed a local item with the same content key (target+relative+size) but a different id.
    s.queue.push({
      id: 'fq_local', file: null, fileName: 'a.txt', fileType: '', size: 100,
      targetPath: '/DATA/Documents', relativePath: 'a.txt', status: 'needs_file',
      progress: 0, bytesSent: 10, speed: 0, tusUploadUrl: null, retryCount: 0, error: '',
      createdAt: 1, batchId: 'b', batchTotal: 1, conflictPolicy: '',
    })
    await s.syncServerTasks()
    expect(s.queue).toHaveLength(1) // no duplicate row
    expect(s.queue[0].bytesSent).toBe(55)
    expect(s.queue[0].tusUploadUrl).toBe('/v2/nimoos/file/upload-tus/srv1')
  })
})
