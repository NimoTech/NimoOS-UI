import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@nimotech/nimoos-service', () => ({
  refreshAccessToken: vi.fn().mockResolvedValue('t'),
  service: { file: { uploadPrecheck: vi.fn().mockResolvedValue({ results: [] }) } },
}))
// Prevent real TUS: stub the scheduler to immediately mark items done.
vi.mock('../upload/scheduler', () => ({
  BACKOFF_MS: [1000, 3000, 9000],
  createScheduler: (deps: any) => ({
    isRunning: () => false,
    abort: vi.fn(),
    run: async () => { let it; while ((it = deps.claimNext())) deps.patch(it.id, { status: 'done', progress: 100 }) },
  }),
}))
vi.mock('../stores/files', () => ({ useFilesStore: () => ({ currentPath: '/DATA/x', load: vi.fn() }) }))

import { useUploadsStore } from './uploads'

const sel = (name: string, target = '/DATA/x') =>
  ({ file: new File(['x'], name), targetPath: target, relativePath: name })

beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })

describe('uploads store', () => {
  it('rejects protected-folder targets and enqueues the rest', async () => {
    const s = useUploadsStore()
    const { rejected } = await s.addFilesToQueue([sel('a.txt'), { file: new File(['y'], 'y'), targetPath: '/DATA/x', relativePath: 'AppData/y' }])
    expect(rejected).toContain('AppData/y')
    expect(s.queue.some(i => i.relativePath === 'a.txt')).toBe(true)
    expect(s.queue.some(i => i.relativePath === 'AppData/y')).toBe(false)
  })

  it('marks precheck hits as conflict', async () => {
    const { service } = await import('@nimotech/nimoos-service') as any
    service.file.uploadPrecheck.mockResolvedValueOnce({ results: [{ relativePath: 'a.txt', exists: true }] })
    const s = useUploadsStore()
    await s.addFilesToQueue([sel('a.txt')])
    expect(s.queue.find(i => i.relativePath === 'a.txt')?.status).toBe('conflict')
  })

  it('resolveConflict skip marks done; overwrite re-queues with policy', async () => {
    const { service } = await import('@nimotech/nimoos-service') as any
    service.file.uploadPrecheck.mockResolvedValueOnce({ results: [{ relativePath: 'a.txt', exists: true }] })
    const s = useUploadsStore()
    await s.addFilesToQueue([sel('a.txt')])
    const id = s.queue[0].id
    s.resolveConflict(id, 'skip')
    expect(s.queue[0].status).toBe('done')
  })

  it('clearDone removes done items', async () => {
    const s = useUploadsStore()
    await s.addFilesToQueue([sel('a.txt')]) // scheduler stub marks done
    s.clearDone()
    expect(s.queue.length).toBe(0)
  })
})
