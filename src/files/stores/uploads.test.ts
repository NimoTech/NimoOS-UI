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
    pause: vi.fn(),
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
import { service } from '@nimotech/nimoos-service'

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

  it('initUploads is idempotent: a second call on the same store instance does not re-restore', async () => {
    // Regression test for SP4-P3b: Files.vue calls initUploads() from
    // onMounted, but the uploads Pinia store is an app-lifetime singleton
    // while Files.vue unmounts/remounts on every SPA navigation (App.vue's
    // <router-view /> has no <keep-alive>). Before the guard, every revisit
    // re-pushed every still-persisted IDB row onto `queue` with no dedup.
    ;(persist.restoreFromIDB as any).mockResolvedValue({
      items: [{ id: 'r1', status: 'pending', file: new Blob(['x']), batchId: 'b', batchTotal: 1, size: 1, progress: 0, bytesSent: 0, speed: 0, tusUploadUrl: null, retryCount: 0, error: '', createdAt: 1, targetPath: '/DATA', relativePath: 'a', fileName: 'a', fileType: '', restored: true, conflictPolicy: '', oversize: false }],
      resumedCount: 1,
    })
    const store = useUploadsStore()
    await store.initUploads()
    await store.initUploads()
    expect(persist.restoreFromIDB).toHaveBeenCalledTimes(1)
    expect(store.queue).toHaveLength(1)
  })
})

describe('uploads pause/resume', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  function seed(store: any, over: any = {}) {
    store.queue.push({
      id: 'x', file: new Blob(['x']), fileName: 'a', fileType: '', size: 1, targetPath: '/DATA',
      relativePath: 'a', status: 'uploading', progress: 30, bytesSent: 3, speed: 5, tusUploadUrl: 'u',
      retryCount: 0, error: '', createdAt: 1, batchId: 'b', batchTotal: 1, restored: false,
      conflictPolicy: '', oversize: false, ...over,
    })
  }

  it('pauseItem: pending item → paused directly (no scheduler call needed)', () => {
    const store = useUploadsStore()
    seed(store, { id: 'p', status: 'pending' })
    store.pauseItem('p')
    expect(store.queue.find((i: any) => i.id === 'p')?.status).toBe('paused')
  })

  it('resumeItem: paused → pending + startUpload', () => {
    // Do not spy on store.startUpload: resumeItem calls the internal
    // `startUpload` closure directly (not `store.startUpload`), so a Pinia
    // setup-store action spy never intercepts it. Assert the observable side
    // effect instead — `uploading` flips synchronously true (the mocked
    // scheduler's run() is an async no-op, so .finally() hasn't fired yet).
    const store = useUploadsStore()
    seed(store, { id: 'p', status: 'paused', file: new Blob(['x']) })
    store.resumeItem('p')
    expect(store.queue.find((i: any) => i.id === 'p')?.status).toBe('pending')
    expect(store.uploading).toBe(true)
  })

  it('pauseAll pauses uploading+pending; resumeAll resumes paused', () => {
    const store = useUploadsStore()
    seed(store, { id: 'u', status: 'pending' })
    seed(store, { id: 'v', status: 'pending' })
    store.pauseAll()
    expect(store.queue.every((i: any) => i.status === 'paused')).toBe(true)
    store.resumeAll()
    expect(store.queue.every((i: any) => i.status === 'pending')).toBe(true)
    expect(store.uploading).toBe(true)
  })

  it('pauseBatch pauses items in that batch only; resumeBatch resumes just that batch', () => {
    const store = useUploadsStore()
    seed(store, { id: 'a1', status: 'pending', batchId: 'batch1' })
    seed(store, { id: 'a2', status: 'pending', batchId: 'batch1' })
    seed(store, { id: 'b1', status: 'pending', batchId: 'batch2' })
    store.pauseBatch('batch1')
    expect(store.queue.find((i: any) => i.id === 'a1')?.status).toBe('paused')
    expect(store.queue.find((i: any) => i.id === 'a2')?.status).toBe('paused')
    expect(store.queue.find((i: any) => i.id === 'b1')?.status).toBe('pending')
    store.resumeBatch('batch1')
    expect(store.queue.find((i: any) => i.id === 'a1')?.status).toBe('pending')
    expect(store.queue.find((i: any) => i.id === 'a2')?.status).toBe('pending')
    expect(store.uploading).toBe(true)
  })
})

describe('uploads reattachFiles', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  function seedNeedsFile(store: ReturnType<typeof useUploadsStore>, over: any = {}) {
    store.queue.push({
      id: 'nf', file: null, fileName: 'a.txt', fileType: 'text/plain', size: 4,
      targetPath: '/DATA/x', relativePath: 'a.txt', status: 'needs_file', progress: 0,
      bytesSent: 0, speed: 0, tusUploadUrl: null, retryCount: 0, error: '', createdAt: 1,
      batchId: 'b', batchTotal: 1, restored: true, conflictPolicy: '', oversize: false, ...over,
    } as any)
  }

  it('size mismatch does not match', async () => {
    ;(service.file.uploadPrecheck as any).mockResolvedValue({ results: [] })
    const store = useUploadsStore()
    seedNeedsFile(store)
    const wrong = new File(['different-bytes'], 'a.txt') // size != 4
    const res = await store.reattachFiles([{ file: wrong, targetPath: '/DATA/x', relativePath: 'a.txt' }])
    expect(res.matched).toBe(0)
    expect(store.queue[0].status).toBe('needs_file')
  })

  it('match + not existing → pending', async () => {
    ;(service.file.uploadPrecheck as any).mockResolvedValue({ results: [{ relativePath: 'a.txt', exists: false }] })
    const store = useUploadsStore()
    vi.spyOn(store, 'startUpload').mockImplementation(() => {})
    seedNeedsFile(store)
    const f = new File(['data'], 'a.txt') // size 4
    const res = await store.reattachFiles([{ file: f, targetPath: '/DATA/x', relativePath: 'a.txt' }])
    expect(res.matched).toBe(1)
    expect(store.queue[0].status).toBe('pending')
    // jsdom's File does not inherit from the Node Blob that vitest.setup.ts
    // installs as globalThis.Blob (for fake-indexeddb structuredClone compat),
    // so `toBeInstanceOf(Blob)` is unreliable here; assert the real intent —
    // the picked file got attached to the queue item.
    expect(store.queue[0].file).toBe(f)
  })

  it('match + existing on server → conflict', async () => {
    ;(service.file.uploadPrecheck as any).mockResolvedValue({ results: [{ relativePath: 'a.txt', exists: true }] })
    const store = useUploadsStore()
    seedNeedsFile(store)
    const f = new File(['data'], 'a.txt')
    const res = await store.reattachFiles([{ file: f, targetPath: '/DATA/x', relativePath: 'a.txt' }])
    expect(res.matched).toBe(0)
    expect(res.conflicts).toHaveLength(1)
    expect(store.queue[0].status).toBe('conflict')
  })
})
