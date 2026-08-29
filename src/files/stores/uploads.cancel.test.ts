import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// vi.mock factories are hoisted above the module; a plain top-level `const`
// referenced inside one throws "Cannot access before initialization". vi.hoisted
// runs before that hoisting so the mock can safely close over it.
const { cancelUpload, abandonBatch, removeBatchItems } = vi.hoisted(() => ({
  cancelUpload: vi.fn(() => Promise.resolve()),
  abandonBatch: vi.fn((_id: string) => Promise.resolve()),
  removeBatchItems: vi.fn((_id: string, _paths: string[]) => Promise.resolve()),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  refreshAccessToken: () => Promise.resolve(null),
  service: {
    file: { cancelUpload, listActiveUploads: vi.fn() },
    uploadBatches: { abandonBatch, removeBatchItems },
  },
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

// Canceling must also clean the server-side batch ledger: the ledger is what
// draws the broken badge, so a cancel that only clears the local queue leaves
// an orphan batch that the sweeper marks interrupted two minutes later — the
// badge then appears on a folder the user explicitly gave up on.
describe('cancel cleans the server-side batch ledger', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  function batchRow(id: string, batchId: string, rel: string, status: 'paused' | 'done' = 'paused') {
    return { ...serverRow(id, ''), batchId, relativePath: rel, status }
  }

  it('cancelItem drops the file from the batch manifest', () => {
    const s = useUploadsStore()
    s.queue.push(batchRow('i1', 'b1', 'Trip/a.jpg'))
    s.cancelItem('i1')
    expect(removeBatchItems).toHaveBeenCalledWith('b1', ['Trip/a.jpg'])
  })

  it('cancelItem on a done item leaves the manifest alone', () => {
    const s = useUploadsStore()
    s.queue.push(batchRow('i1', 'b1', 'Trip/a.jpg', 'done'))
    s.cancelItem('i1')
    expect(removeBatchItems).not.toHaveBeenCalled()
  })

  it('cancelItem without a batchId stays local-only', () => {
    const s = useUploadsStore()
    s.queue.push(batchRow('i1', '', 'a.jpg'))
    s.cancelItem('i1')
    expect(removeBatchItems).not.toHaveBeenCalled()
  })

  it('cancelBatch abandons the whole batch server-side', () => {
    const s = useUploadsStore()
    s.queue.push(batchRow('i1', 'b1', 'Trip/a.jpg'), batchRow('i2', 'b1', 'Trip/b.jpg'))
    s.cancelBatch('b1')
    expect(abandonBatch).toHaveBeenCalledTimes(1)
    expect(abandonBatch).toHaveBeenCalledWith('b1')
  })

  it('cancelAll abandons each distinct batch once', () => {
    const s = useUploadsStore()
    s.queue.push(
      batchRow('i1', 'b1', 'a.jpg'), batchRow('i2', 'b1', 'b.jpg'), batchRow('i3', 'b2', 'c.jpg'),
      batchRow('i4', '', 'd.jpg'),
    )
    s.cancelAll()
    expect(abandonBatch.mock.calls.map((c) => c[0]).sort()).toEqual(['b1', 'b2'])
  })
})
