import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const h = vi.hoisted(() => ({ autoComplete: false, showSpy: vi.fn() }))

vi.mock('@nimotech/nimoos-service', () => ({
  refreshAccessToken: vi.fn().mockResolvedValue('t'),
  service: { file: { uploadPrecheck: vi.fn().mockResolvedValue({ results: [] }) } },
}))
// Scheduler stub. When h.autoComplete is true it drains the queue marking each
// claimed item done+100 (a real success); otherwise it's a no-op so items stay
// pending and enqueue assertions can observe them.
vi.mock('../upload/scheduler', () => ({
  BACKOFF_MS: [1000, 3000, 9000],
  createScheduler: (deps: any) => ({
    isRunning: () => false,
    abort: vi.fn(),
    run: async () => {
      if (!h.autoComplete) return
      let it
      while ((it = deps.claimNext())) deps.patch(it.id, { status: 'done', progress: 100 })
    },
  }),
}))
vi.mock('../stores/files', () => ({ useFilesStore: () => ({ currentPath: '/DATA/x', load: vi.fn() }) }))
vi.mock('../../stores/toast', () => ({ useToast: () => ({ show: h.showSpy }) }))
vi.mock('../../i18n', () => ({ i18n: { global: { t: (k: string, p?: any) => `${k}:${p?.name ?? ''}` } } }))

import { useUploadsStore } from './uploads'

const sel = (name: string, target = '/DATA/x') =>
  ({ file: new File(['x'], name), targetPath: target, relativePath: name })

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  h.autoComplete = false
  h.showSpy.mockClear()
})

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

  it('resolveConflict skip marks done (lingers for clearDone); overwrite re-queues with policy', async () => {
    const { service } = await import('@nimotech/nimoos-service') as any
    service.file.uploadPrecheck.mockResolvedValueOnce({ results: [{ relativePath: 'a.txt', exists: true }] })
    const s = useUploadsStore()
    await s.addFilesToQueue([sel('a.txt')])
    const id = s.queue[0].id
    s.resolveConflict(id, 'skip')
    // skip sets done WITHOUT progress 100 → not auto-removed, no success toast
    expect(s.queue[0].status).toBe('done')
    expect(h.showSpy).not.toHaveBeenCalled()
  })

  it('toasts success and auto-clears the row after 5s', async () => {
    vi.useFakeTimers()
    try {
      h.autoComplete = true
      const s = useUploadsStore()
      await s.addFilesToQueue([sel('a.txt')])
      // toast fires immediately (5s duration); row lingers 5s then clears
      expect(h.showSpy).toHaveBeenCalledWith('filesUploadDone:a.txt', 5000)
      expect(s.queue.some(i => i.relativePath === 'a.txt')).toBe(true)
      expect(s.queue[0].status).toBe('done')
      vi.advanceTimersByTime(5000)
      expect(s.queue.some(i => i.relativePath === 'a.txt')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('clearDone removes lingering (skip-done) items', async () => {
    const { service } = await import('@nimotech/nimoos-service') as any
    service.file.uploadPrecheck.mockResolvedValueOnce({ results: [{ relativePath: 'a.txt', exists: true }] })
    const s = useUploadsStore()
    await s.addFilesToQueue([sel('a.txt')])
    s.resolveConflict(s.queue[0].id, 'skip') // done, progress 0 → lingers
    s.clearDone()
    expect(s.queue.length).toBe(0)
  })

  // Regression: NAS is reached over plain HTTP at a LAN address (non-secure
  // context) where crypto.randomUUID is undefined. addFilesToQueue must NOT
  // throw before enqueuing — otherwise no panel appears and nothing uploads.
  it('still enqueues when crypto.randomUUID is unavailable (non-secure context)', async () => {
    const real = globalThis.crypto?.randomUUID
    try {
      ;(globalThis.crypto as { randomUUID?: unknown }).randomUUID = undefined
      const s = useUploadsStore()
      const { rejected } = await s.addFilesToQueue([sel('a.txt')])
      expect(rejected).toEqual([])
      expect(s.queue.some(i => i.relativePath === 'a.txt')).toBe(true)
      expect(s.queue[0].batchId).toBeTruthy()
    } finally {
      ;(globalThis.crypto as { randomUUID?: unknown }).randomUUID = real
    }
  })
})
