import { describe, it, expect, vi } from 'vitest'
import { hasActiveUploads, installUnloadGuard, activeBatchIds } from './unloadGuard'
import type { UploadItem } from './types'
const mk = (p: Partial<UploadItem>): UploadItem => ({
  id: 'x', file: new Blob(['x']), fileName: 'f', fileType: '', size: 1, targetPath: '/DATA', relativePath: 'f',
  status: 'pending', progress: 0, bytesSent: 0, speed: 0, tusUploadUrl: null, retryCount: 0, error: '',
  createdAt: 0, batchId: 'b', batchTotal: 1, conflictPolicy: '', ...p,
})
describe('hasActiveUploads', () => {
  it('true for uploading or pending-with-file, false for paused/done', () => {
    expect(hasActiveUploads([mk({ status: 'uploading' })])).toBe(true)
    expect(hasActiveUploads([mk({ status: 'pending', file: new Blob(['x']) })])).toBe(true)
    expect(hasActiveUploads([mk({ status: 'paused', file: null })])).toBe(false)
    expect(hasActiveUploads([mk({ status: 'done' })])).toBe(false)
  })
})
describe('installUnloadGuard', () => {
  it('prevents unload only when active, and unsubscribes', () => {
    let queue: UploadItem[] = [mk({ status: 'uploading' })]
    const listeners: Record<string, any> = {}
    const win: any = { addEventListener: (k: string, f: any) => (listeners[k] = f), removeEventListener: (k: string) => delete listeners[k] }
    const off = installUnloadGuard(() => queue, win)
    const e: any = { preventDefault: vi.fn(), returnValue: undefined }
    listeners.beforeunload(e)
    expect(e.preventDefault).toHaveBeenCalled()
    queue = [mk({ status: 'done' })]
    const e2: any = { preventDefault: vi.fn(), returnValue: undefined }
    listeners.beforeunload(e2)
    expect(e2.preventDefault).not.toHaveBeenCalled()
    off()
    expect(listeners.beforeunload).toBeUndefined()
  })
})

describe('pagehide interrupt signal', () => {
  it('collects batch ids of unfinished items only, deduped', () => {
    const q = [
      { batchId: 'b1', status: 'uploading', file: new Blob() },
      { batchId: 'b1', status: 'pending', file: new Blob() },
      { batchId: 'b2', status: 'done', file: null },
      { batchId: '', status: 'uploading', file: new Blob() },
    ] as unknown as UploadItem[]
    expect(activeBatchIds(q)).toEqual(['b1'])
  })

  it('sends one interrupt per active batch on pagehide', () => {
    const interruptBatch = vi.fn()
    const listeners: Record<string, EventListener> = {}
    const win = {
      addEventListener: (t: string, h: EventListener) => { listeners[t] = h },
      removeEventListener: () => {},
    } as unknown as Window
    const q = [
      { batchId: 'b1', status: 'uploading', file: new Blob() },
      { batchId: 'b2', status: 'pending', file: new Blob() },
    ] as unknown as UploadItem[]

    installUnloadGuard(() => q, win, interruptBatch)
    listeners.pagehide(new Event('pagehide'))

    expect(interruptBatch.mock.calls.map((c) => c[0])).toEqual(['b1', 'b2'])
  })
})
