import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createUploadBatches } from './uploadBatches'

function fakeHttp(response: unknown) {
  return {
    post: vi.fn().mockResolvedValue(response),
    get: vi.fn().mockResolvedValue(response),
  } as unknown as AxiosInstance
}

describe('upload batches REST', () => {
  it('createBatch posts the manifest', async () => {
    const http = fakeHttp({ data: { id: 'b1' } })
    const api = createUploadBatches(http, () => 'tok')
    await api.createBatch({ id: 'b1', targetPath: '/DATA/x', items: [{ relativePath: 'a.txt', size: 5 }] })
    expect(http.post).toHaveBeenCalledWith('/v2/nimoos/file/upload-batches', {
      id: 'b1',
      targetPath: '/DATA/x',
      items: [{ relativePath: 'a.txt', size: 5 }],
    })
  })

  it('getBatch returns the RAW envelope without unwrapping', async () => {
    // Backend returns raw JSON: {batch, missing}, no success/data envelope.
    const http = fakeHttp({
      data: {
        batch: { id: 'b1', target_path: '/DATA/x', status: 'interrupted', total: 3, done: 1 },
        missing: [{ batch_id: 'b1', relative_path: 'a.txt', size: 5, done: false }],
      },
    })
    const api = createUploadBatches(http, () => 'tok')
    const out = await api.getBatch('b1')
    expect(http.get).toHaveBeenCalledWith('/v2/nimoos/file/upload-batches/b1')
    expect(out.batch.done).toBe(1)
    expect(out.missing[0].relative_path).toBe('a.txt')
  })

  it('getBatch degrades to an empty manifest when the body has no batch', async () => {
    const http = fakeHttp({ data: {} })
    const api = createUploadBatches(http, () => 'tok')
    const out = await api.getBatch('b1')
    expect(out.batch).toBeNull()
    expect(out.missing).toEqual([])
  })

  it('abandonBatch posts to the abandon path', async () => {
    const http = fakeHttp({ data: {} })
    const api = createUploadBatches(http, () => 'tok')
    await api.abandonBatch('b1')
    expect(http.post).toHaveBeenCalledWith('/v2/nimoos/file/upload-batches/b1/abandon')
  })

  it('interruptBatch uses fetch keepalive with the bearer token, not axios', () => {
    const fetchSpy = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('fetch', fetchSpy)
    const http = fakeHttp({ data: {} })
    const api = createUploadBatches(http, () => 'tok')
    api.interruptBatch('b1')
    expect(http.post).not.toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledWith('/v2/nimoos/file/upload-batches/b1/interrupt', {
      method: 'POST',
      keepalive: true,
      headers: { Authorization: 'tok' },
    })
  })

  it('interruptBatch swallows a fetch that throws synchronously', () => {
    vi.stubGlobal('fetch', () => { throw new Error('no keepalive') })
    const api = createUploadBatches(fakeHttp({ data: {} }), () => 'tok')
    expect(() => api.interruptBatch('b1')).not.toThrow()
  })

  afterEach(() => vi.unstubAllGlobals())
  beforeEach(() => vi.clearAllMocks())
})
