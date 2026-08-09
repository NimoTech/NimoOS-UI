import { describe, it, expect, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createFile, UPLOAD_TUS_ENDPOINT } from './file'

function fakeHttp(response: unknown) {
  return { post: vi.fn().mockResolvedValue(response), get: vi.fn().mockResolvedValue(response) } as unknown as AxiosInstance
}

describe('file upload REST', () => {
  it('exposes the TUS creation endpoint constant', () => {
    expect(UPLOAD_TUS_ENDPOINT).toBe('/v2/nimoos/file/upload-tus/')
  })

  it('uploadPrecheck posts targetPath+files and returns results', async () => {
    const http = fakeHttp({ data: { success: 200, data: { results: [{ relativePath: 'a.txt', exists: true }] } } })
    const file = createFile(http, () => 'tok')
    const out = await file.uploadPrecheck('/DATA/x', [{ relativePath: 'a.txt', size: 5 }])
    expect(http.post).toHaveBeenCalledWith('/v2/nimoos/file/upload-precheck', {
      targetPath: '/DATA/x',
      files: [{ relativePath: 'a.txt', size: 5 }],
    })
    expect(out.results[0]).toEqual({ relativePath: 'a.txt', exists: true })
  })

  it('listActiveUploads GETs uploads?status=active and returns tasks', async () => {
    const http = fakeHttp({ data: { success: 200, data: { tasks: [{ id: 'h1', filename: 'a.txt' }] } } })
    const file = createFile(http, () => 'tok')
    const out = await file.listActiveUploads()
    expect(http.get).toHaveBeenCalledWith('/v2/nimoos/file/uploads?status=active')
    expect(out.tasks[0].id).toBe('h1')
  })

  it('cancelUpload POSTs to the cancel path', async () => {
    const http = fakeHttp({ data: { success: 200, data: { canceled: true } } })
    const file = createFile(http, () => 'tok')
    await file.cancelUpload('h1')
    expect(http.post).toHaveBeenCalledWith('/v2/nimoos/file/uploads/h1/cancel')
  })

  it('uploadPrecheck passes through size_match and is_dir', async () => {
    const http = fakeHttp({ data: { success: 200, data: { results: [{ relativePath: 'a.txt', exists: true, size_match: true, is_dir: false }] } } })
    const file = createFile(http, () => 'tok')
    const out = await file.uploadPrecheck('/DATA/x', [{ relativePath: 'a.txt', size: 5 }])
    expect(out.results[0].size_match).toBe(true)
    expect(out.results[0].is_dir).toBe(false)
  })
})
