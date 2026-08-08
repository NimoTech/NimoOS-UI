import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// vi.mock factories are hoisted above the module; a plain top-level `const`
// referenced inside one throws "Cannot access before initialization". vi.hoisted
// runs before that hoisting so the mock can safely close over it.
const { cancelUpload } = vi.hoisted(() => ({ cancelUpload: vi.fn(() => Promise.resolve()) }))
vi.mock('@nimotech/nimoos-service', () => ({
  refreshAccessToken: () => Promise.resolve(null),
  service: { file: { cancelUpload, listActiveUploads: vi.fn() } },
}))
import { service } from '@nimotech/nimoos-service'
import { useUploadsStore } from './uploads'

function serverRow(id: string, url: string) {
  return {
    id, file: null, fileName: 'a', fileType: '', size: 1, targetPath: '/DATA', relativePath: 'a',
    status: 'paused' as const, progress: 0, bytesSent: 0, speed: 0, tusUploadUrl: url,
    retryCount: 0, error: '', createdAt: 0, batchId: '', batchTotal: 1,
    conflictPolicy: '' as const,
  }
}

describe('cancel resolves the tus id for server-origin rows', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('uses item.id when there is no upload_url and id is not an fq_ id', () => {
    const s = useUploadsStore()
    s.queue.push(serverRow('srvHex', ''))
    s.cancelItem('srvHex')
    expect(service.file.cancelUpload).toHaveBeenCalledWith('srvHex')
  })

  it('parses the id out of upload_url when present', () => {
    const s = useUploadsStore()
    s.queue.push(serverRow('srvHex', '/v2/nimoos/file/upload-tus/theTusId'))
    s.cancelItem('srvHex')
    expect(service.file.cancelUpload).toHaveBeenCalledWith('theTusId')
  })

  it('does not cancel for a fresh fq_ item with no url', () => {
    const s = useUploadsStore()
    s.queue.push(serverRow('fq_1_0_0.2', ''))
    s.cancelItem('fq_1_0_0.2')
    expect(service.file.cancelUpload).not.toHaveBeenCalled()
  })
})
