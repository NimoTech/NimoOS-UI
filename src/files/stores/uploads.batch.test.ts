import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUploadsStore } from './uploads'

const createBatch = vi.fn().mockResolvedValue(undefined)
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    uploadBatches: { createBatch: (...a: unknown[]) => createBatch(...a) },
    file: { cancelUpload: vi.fn(), uploadPrecheck: vi.fn().mockResolvedValue({ results: [] }) },
  },
  refreshAccessToken: vi.fn().mockResolvedValue(null),
}))
// This test only cares about the manifest report and the resulting queue
// state, not the actual transfer — stub the scheduler to a no-op so items
// stay 'pending' instead of driving a real tus upload against no server.
vi.mock('../upload/scheduler', () => ({
  createScheduler: () => ({ run: vi.fn().mockResolvedValue(undefined), isRunning: () => false, abort: vi.fn(), pause: vi.fn() }),
}))

function pick(name: string, size: number) {
  return { file: new File(['x'.repeat(size)], name), targetPath: '/DATA/x', relativePath: name }
}

describe('addFilesToQueue reports the batch manifest', () => {
  beforeEach(() => { setActivePinia(createPinia()); createBatch.mockClear() })

  it('posts one manifest carrying every surviving item', async () => {
    const s = useUploadsStore()
    await s.addFilesToQueue([pick('a.txt', 3), pick('b.txt', 4)])
    expect(createBatch).toHaveBeenCalledTimes(1)
    const arg = createBatch.mock.calls[0][0] as { id: string; targetPath: string; items: unknown[] }
    expect(arg.targetPath).toBe('/DATA/x')
    expect(arg.items).toEqual([
      { relativePath: 'a.txt', size: 3 },
      { relativePath: 'b.txt', size: 4 },
    ])
    expect(arg.id).toBe(s.queue[0].batchId)
  })

  it('still queues the upload when the manifest call fails', async () => {
    createBatch.mockRejectedValueOnce(new Error('offline'))
    const s = useUploadsStore()
    await s.addFilesToQueue([pick('a.txt', 3)])
    // Reconciliation being unavailable is not a reason to refuse the upload: the
    // manifest call failing must only warn, never block queuing.
    expect(s.queue).toHaveLength(1)
    expect(s.queue[0].status).toBe('pending')
  })

  it('reports the manifest before the items are queued', async () => {
    // Pins the ordering invariant itself, not just the final state: capture the
    // queue's length synchronously inside the mock, at the exact moment
    // createBatch is invoked — before any of its internal awaits run. If the
    // manifest call were moved after `queue.value.push(...items)`, this would
    // observe length 1 instead of 0.
    const s = useUploadsStore()
    let queueLengthAtCallTime = -1
    createBatch.mockImplementationOnce(() => {
      queueLengthAtCallTime = s.queue.length
      return Promise.resolve(undefined)
    })
    await s.addFilesToQueue([pick('a.txt', 3)])
    expect(queueLengthAtCallTime).toBe(0)
  })

  it('does not report a manifest when every file was rejected as protected', async () => {
    const s = useUploadsStore()
    await s.addFilesToQueue([{ file: new File(['x'], 'a'), targetPath: '/DATA', relativePath: 'AppData/a' }])
    expect(createBatch).not.toHaveBeenCalled()
  })
})
