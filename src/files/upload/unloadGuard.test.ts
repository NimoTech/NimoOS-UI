import { describe, it, expect, vi } from 'vitest'
import { hasActiveUploads, installUnloadGuard } from './unloadGuard'
import type { UploadItem } from './types'
const mk = (p: Partial<UploadItem>): UploadItem => ({
  id: 'x', file: new Blob(['x']), fileName: 'f', fileType: '', size: 1, targetPath: '/DATA', relativePath: 'f',
  status: 'pending', progress: 0, bytesSent: 0, speed: 0, tusUploadUrl: null, retryCount: 0, error: '',
  createdAt: 0, batchId: 'b', batchTotal: 1, restored: false, conflictPolicy: '', oversize: false, ...p,
})
describe('hasActiveUploads', () => {
  it('true for uploading or pending-with-file, false for needs_file', () => {
    expect(hasActiveUploads([mk({ status: 'uploading' })])).toBe(true)
    expect(hasActiveUploads([mk({ status: 'pending', file: new Blob(['x']) })])).toBe(true)
    expect(hasActiveUploads([mk({ status: 'needs_file', file: null })])).toBe(false)
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
