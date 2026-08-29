import { describe, it, expect, vi, beforeEach } from 'vitest'

const uploadInstances: any[] = []
const abortSpy = vi.fn()
vi.mock('tus-js-client', () => {
  class Upload {
    file: any; options: any; url: string | null = null
    constructor(file: any, options: any) { this.file = file; this.options = options; uploadInstances.push(this) }
    start() {}
    abort(shouldTerminate?: boolean) { abortSpy(shouldTerminate); return Promise.resolve() }
  }
  return { Upload }
})
vi.mock('@nimotech/nimoos-service', () => ({ UPLOAD_TUS_ENDPOINT: '/v2/nimoos/file/upload-tus/' }))

import { tusUpload, isRetryableTusError, tusErrorStatus } from './tusClient'

beforeEach(() => { uploadInstances.length = 0; abortSpy.mockClear(); localStorage.clear(); localStorage.setItem('access_token', 'TOK') })

describe('isRetryableTusError', () => {
  it('retries network + 5xx + 408/429, not 401/other 4xx', () => {
    const withStatus = (s: number) => ({ originalResponse: { getStatus: () => s } })
    expect(isRetryableTusError({})).toBe(true) // no response
    expect(isRetryableTusError(withStatus(503))).toBe(true)
    expect(isRetryableTusError(withStatus(429))).toBe(true)
    expect(isRetryableTusError(withStatus(408))).toBe(true)
    expect(isRetryableTusError(withStatus(401))).toBe(false)
    expect(isRetryableTusError(withStatus(409))).toBe(false)
  })
})

describe('tusUpload config', () => {
  it('builds endpoint/chunk/metadata and injects raw auth header', () => {
    tusUpload({ file: new Blob(['x']), fileName: 'a.txt', fileType: 'text/plain', targetPath: '/DATA/x',
      relativePath: 'a.txt', batchId: 'b1', batchTotal: 2, resumed: false, conflictPolicy: 'overwrite' })
    const opt = uploadInstances[0].options
    expect(opt.endpoint).toBe('/v2/nimoos/file/upload-tus/')
    expect(opt.chunkSize).toBe(5 * 1024 * 1024)
    expect(opt.storeFingerprintForResuming).toBe(false)
    expect(opt.metadata.filename).toBe('a.txt')
    expect(opt.metadata.batch_total).toBe('2')
    expect(opt.metadata.conflictPolicy).toBe('overwrite')
    const headers: Record<string, string> = {}
    opt.onBeforeRequest({ setHeader: (k: string, v: string) => { headers[k] = v } })
    expect(headers.Authorization).toBe('TOK')
  })

  it('exposes abort via onStart that rejects with isAbort', async () => {
    let handle: any
    const p = tusUpload({ file: new Blob(['x']), fileName: 'a', fileType: '', targetPath: '/DATA', relativePath: 'a',
      batchId: 'b', batchTotal: 1, resumed: false, conflictPolicy: '', onStart: (h) => { handle = h } })
    await handle.abort()
    await expect(p).rejects.toMatchObject({ isAbort: true })
    expect(abortSpy).toHaveBeenCalledWith(true)
  })

  it('pause() calls upload.abort(false) and rejects with isPause (no DELETE)', async () => {
    let handle: { abort: () => Promise<void>; pause: () => Promise<void> } | null = null
    const p = tusUpload({
      file: new Blob(['x']), fileName: 'a', fileType: '', targetPath: '/DATA', relativePath: 'a',
      batchId: 'b', batchTotal: 1, resumed: false, conflictPolicy: '',
      onStart: (h: { abort: () => Promise<void>; pause: () => Promise<void> }) => { handle = h },
    } as any)
    await handle!.pause()
    await expect(p).rejects.toMatchObject({ isPause: true })
    expect(abortSpy).toHaveBeenCalledWith(false)
  })
})
