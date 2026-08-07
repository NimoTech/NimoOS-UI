import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createFile } from './file'

function mockHttp(capture: Record<string, unknown>) {
  return {
    get: async (url: string, cfg?: { params?: unknown }) => {
      capture.getUrl = url; capture.getParams = cfg?.params
      return { data: { success: 200, data: { content: 'hello' } } }
    },
    post: async (url: string, body?: unknown) => {
      capture.postUrl = url; capture.postBody = body
      return { data: { success: 200, data: { ok: true } } }
    },
    put: async (url: string, body?: unknown) => {
      capture.putUrl = url; capture.putBody = body
      return { data: { success: 200, data: { ok: true } } }
    },
  } as unknown as AxiosInstance
}

describe('createFile', () => {
  it('getContent passes path + timestamp and unwraps content', async () => {
    const cap: Record<string, unknown> = {}
    const f = createFile(mockHttp(cap), () => 'TKN')
    const res = await f.getContent('/DATA/a.txt')
    expect(cap.getUrl).toBe('/file/content')
    const p = cap.getParams as { path: string; timestamp: number }
    expect(p.path).toBe('/DATA/a.txt')
    expect(typeof p.timestamp).toBe('number')
    expect(res.content).toBe('hello')
  })

  it('create posts path', async () => {
    const cap: Record<string, unknown> = {}
    const f = createFile(mockHttp(cap), () => null)
    await f.create('/DATA/new.txt')
    expect(cap.postUrl).toBe('/file')
    expect(cap.postBody).toEqual({ path: '/DATA/new.txt' })
  })

  it('rename puts old/new path to /file/name', async () => {
    const cap: Record<string, unknown> = {}
    const f = createFile(mockHttp(cap), () => null)
    await f.rename('/DATA/a', '/DATA/b')
    expect(cap.putUrl).toBe('/file/name')
    expect(cap.putBody).toEqual({ old_path: '/DATA/a', new_path: '/DATA/b' })
  })

  it('update puts path + content', async () => {
    const cap: Record<string, unknown> = {}
    const f = createFile(mockHttp(cap), () => null)
    await f.update('/DATA/a.txt', 'body')
    expect(cap.putUrl).toBe('/file')
    expect(cap.putBody).toEqual({ path: '/DATA/a.txt', content: 'body' })
  })

  it('fileUrl builds /v3/file with encoded token + path', () => {
    const f = createFile(mockHttp({}), () => 'a b/c')
    expect(f.fileUrl('/DATA/x y.png')).toBe('/v3/file?token=a%20b%2Fc&path=%2FDATA%2Fx%20y.png')
  })

  it('fileUrl omits token when null', () => {
    const f = createFile(mockHttp({}), () => null)
    expect(f.fileUrl('/DATA/x.png')).toBe('/v3/file?path=%2FDATA%2Fx.png')
  })

  it('getBytes fetches /file as arraybuffer with real path, no unwrap', async () => {
    const cap: Record<string, unknown> = {}
    const buf = new ArrayBuffer(8)
    const http = {
      get: async (url: string, cfg?: { params?: unknown; responseType?: string }) => {
        cap.getUrl = url; cap.getParams = cfg?.params; cap.responseType = cfg?.responseType
        return { data: buf }
      },
    } as unknown as AxiosInstance
    const f = createFile(http, () => 'TKN')
    const res = await f.getBytes('/DATA/report.pdf')
    expect(cap.getUrl).toBe('/file')
    expect((cap.getParams as { path: string }).path).toBe('/DATA/report.pdf')
    expect(cap.responseType).toBe('arraybuffer')
    expect(res).toBe(buf)            // 原样透传,不 unwrap
  })

  it('getPreviewBytes fetches /file/preview as arraybuffer with long timeout, no unwrap', async () => {
    const cap: Record<string, unknown> = {}
    const buf = new ArrayBuffer(8)
    const http = {
      get: async (url: string, cfg?: { params?: unknown; responseType?: string; timeout?: number }) => {
        cap.getUrl = url; cap.getParams = cfg?.params; cap.responseType = cfg?.responseType; cap.timeout = cfg?.timeout
        return { data: buf }
      },
    } as unknown as AxiosInstance
    const f = createFile(http, () => 'TKN')
    const res = await f.getPreviewBytes('/DATA/a.doc')
    expect(cap.getUrl).toBe('/file/preview')
    expect((cap.getParams as { path: string }).path).toBe('/DATA/a.doc')
    expect(cap.responseType).toBe('arraybuffer')
    expect(cap.timeout).toBe(150000)
    expect(res).toBe(buf)
  })
})

// The core service returns RAW envelopes for these three endpoints
// ({results}/{tasks}/{canceled}) with NO standard `success` field, so they must
// NOT go through unwrap() (which throws unless success===200). This mirrors the
// /web/appgrid non-standard-envelope trap. Vue2 reads these raw too.
function rawHttp(resp: unknown, capture: Record<string, unknown> = {}) {
  return {
    get: async (url: string) => { capture.getUrl = url; return { data: resp } },
    post: async (url: string, body?: unknown) => { capture.postUrl = url; capture.postBody = body; return { data: resp } },
  } as unknown as AxiosInstance
}

describe('createFile upload helpers tolerate raw (non-standard) envelopes', () => {
  it('uploadPrecheck returns results from a raw {results} body (no success field)', async () => {
    const f = createFile(rawHttp({ results: [{ relativePath: 'a.txt', exists: true }] }), () => null)
    const res = await f.uploadPrecheck('/DATA/Documents', [{ relativePath: 'a.txt', size: 10 }])
    expect(res.results).toEqual([{ relativePath: 'a.txt', exists: true }])
  })

  it('uploadPrecheck also tolerates a standard {success,data:{results}} envelope', async () => {
    const f = createFile(rawHttp({ success: 200, data: { results: [{ relativePath: 'b', exists: false }] } }), () => null)
    const res = await f.uploadPrecheck('/DATA', [])
    expect(res.results).toEqual([{ relativePath: 'b', exists: false }])
  })

  it('uploadPrecheck degrades to empty results on an unexpected body', async () => {
    const f = createFile(rawHttp({}), () => null)
    const res = await f.uploadPrecheck('/DATA', [])
    expect(res.results).toEqual([])
  })

  it('listActiveUploads returns tasks from a raw {tasks} body', async () => {
    const f = createFile(rawHttp({ tasks: [{ id: 't1' }] }), () => null)
    const res = await f.listActiveUploads()
    expect(res.tasks).toEqual([{ id: 't1' }])
  })

  it('listActiveUploads degrades to empty tasks on a null/unexpected body', async () => {
    const f = createFile(rawHttp(null), () => null)
    const res = await f.listActiveUploads()
    expect(res.tasks).toEqual([])
  })

  it('cancelUpload returns the raw body without throwing', async () => {
    const f = createFile(rawHttp({ canceled: true }), () => null)
    const res = await f.cancelUpload('t1')
    expect(res).toEqual({ canceled: true })
  })
})
