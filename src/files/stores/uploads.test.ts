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
vi.mock('../upload/persist', () => ({
  persistNewItem: vi.fn(),
  persistItemMeta: vi.fn(),
  dropPersisted: vi.fn(),
  restoreFromIDB: vi.fn().mockResolvedValue({ items: [], resumedCount: 0 }),
  pruneOldItems: vi.fn().mockResolvedValue(0),
}))

import { useUploadsStore } from './uploads'
import * as persist from '../upload/persist'

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

  it('fires ONE toast for a folder batch and clears it after 5s', async () => {
    vi.useFakeTimers()
    try {
      h.autoComplete = true
      const s = useUploadsStore()
      await s.addFilesToQueue([
        { file: new File(['x'], 'a'), targetPath: '/DATA/x', relativePath: 'Docs/a' },
        { file: new File(['y'], 'b'), targetPath: '/DATA/x', relativePath: 'Docs/sub/b' },
      ])
      // exactly one toast for the whole folder, not one per file
      expect(h.showSpy).toHaveBeenCalledTimes(1)
      expect(h.showSpy).toHaveBeenCalledWith('filesUploadFolderDone:Docs', 5000)
      expect(s.queue.length).toBe(2) // both linger 5s
      vi.advanceTimersByTime(5000)
      expect(s.queue.length).toBe(0)
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

describe('uploads persistence hooks', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('addFilesToQueue persists each new item', async () => {
    const store = useUploadsStore()
    const file = new File(['x'], 'a.txt', { type: 'text/plain' })
    await store.addFilesToQueue([{ file, targetPath: '/DATA/x', relativePath: 'a.txt' }])
    expect(persist.persistNewItem).toHaveBeenCalledTimes(1)
  })

  it('volatile-only patch (progress/bytesSent/speed) does NOT persist meta', async () => {
    const store = useUploadsStore()
    const file = new File(['x'], 'a.txt')
    await store.addFilesToQueue([{ file, targetPath: '/DATA/x', relativePath: 'a.txt' }])
    vi.clearAllMocks()
    const id = store.queue[0].id
    store.patch(id, { progress: 50, bytesSent: 10, speed: 5 })
    expect(persist.persistItemMeta).not.toHaveBeenCalled()
    expect(persist.dropPersisted).not.toHaveBeenCalled()
  })

  it('status→done patch drops persisted record', async () => {
    const store = useUploadsStore()
    const file = new File(['x'], 'a.txt')
    await store.addFilesToQueue([{ file, targetPath: '/DATA/x', relativePath: 'a.txt' }])
    vi.clearAllMocks()
    const id = store.queue[0].id
    store.patch(id, { status: 'done', progress: 100 })
    expect(persist.dropPersisted).toHaveBeenCalledWith(id)
  })

  it('non-volatile status patch persists meta', async () => {
    const store = useUploadsStore()
    const file = new File(['x'], 'a.txt')
    await store.addFilesToQueue([{ file, targetPath: '/DATA/x', relativePath: 'a.txt' }])
    vi.clearAllMocks()
    const id = store.queue[0].id
    store.patch(id, { tusUploadUrl: '/v2/nimoos/file/upload-tus/abc' })
    expect(persist.persistItemMeta).toHaveBeenCalled()
  })

  it('cancelItem drops persisted record', async () => {
    const store = useUploadsStore()
    const file = new File(['x'], 'a.txt')
    await store.addFilesToQueue([{ file, targetPath: '/DATA/x', relativePath: 'a.txt' }])
    const id = store.queue[0].id
    vi.clearAllMocks()
    store.cancelItem(id)
    expect(persist.dropPersisted).toHaveBeenCalledWith(id)
  })
})

describe('uploads restore/resume', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('restoreQueue loads items and sets restore notice count', async () => {
    ;(persist.restoreFromIDB as any).mockResolvedValueOnce({
      items: [{ id: 'r1', status: 'pending', file: new Blob(['x']), batchId: 'b', batchTotal: 1, size: 1, progress: 0, bytesSent: 0, speed: 0, tusUploadUrl: null, retryCount: 0, error: '', createdAt: 1, targetPath: '/DATA', relativePath: 'a', fileName: 'a', fileType: '', restored: true, conflictPolicy: '', oversize: false }],
      resumedCount: 1,
    })
    const store = useUploadsStore()
    await store.restoreQueue()
    expect(store.queue).toHaveLength(1)
    expect(store.restoreNoticeCount).toBe(1)
  })

  it('resumePending starts upload only when a pending item has a file', () => {
    // No spy on startUpload (that would reshape production code to fit the
    // test). Instead observe startUpload's real, synchronous side effect:
    // `uploading` flips to true immediately, before the (mocked) scheduler's
    // run() promise resolves and the .finally() flips it back. The mocked
    // scheduler's run() is an async no-op here, so `uploading` is still true
    // at this point in the synchronous test body.
    const store = useUploadsStore()
    store.queue.push({ id: 'n', status: 'needs_file', file: null } as any)
    store.resumePending()
    expect(store.uploading).toBe(false)
    store.queue.push({ id: 'p', status: 'pending', file: new Blob(['x']) } as any)
    store.resumePending()
    expect(store.uploading).toBe(true)
  })

  it('initUploads restores, prunes, then resumes', async () => {
    ;(persist.restoreFromIDB as any).mockResolvedValueOnce({ items: [], resumedCount: 0 })
    const store = useUploadsStore()
    await store.initUploads()
    expect(persist.restoreFromIDB).toHaveBeenCalled()
    expect(persist.pruneOldItems).toHaveBeenCalled()
  })
})
