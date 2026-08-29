import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createBatch } from './batch'

function mockHttp(cap: Record<string, unknown>) {
  return {
    get: async (url: string, cfg?: { params?: unknown }) => {
      cap.getUrl = url; cap.getParams = cfg?.params
      return { data: { success: 200, data: { ok: true } } }
    },
    post: async (url: string, body?: unknown) => {
      cap.postUrl = url; cap.postBody = body
      return { data: { success: 200, data: { id: 't1' } } }
    },
    delete: async (url: string, cfg?: { data?: unknown }) => {
      cap.delUrl = url; cap.delData = cfg?.data
      return { data: { success: 200, data: { ok: true } } }
    },
  } as unknown as AxiosInstance
}

describe('createBatch', () => {
  it('download passes format + files', async () => {
    const cap: Record<string, unknown> = {}
    await createBatch(mockHttp(cap), () => null).download('zip', '/DATA/a,/DATA/b')
    expect(cap.getUrl).toBe('/batch')
    expect(cap.getParams).toEqual({ format: 'zip', files: '/DATA/a,/DATA/b' })
  })

  it('task posts data body', async () => {
    const cap: Record<string, unknown> = {}
    await createBatch(mockHttp(cap), () => null).task({ op: 'copy', files: ['/DATA/a'] })
    expect(cap.postUrl).toBe('/batch/task')
    expect(cap.postBody).toEqual({ op: 'copy', files: ['/DATA/a'] })
  })

  it('deleteTask deletes /batch/{id}/task', async () => {
    const cap: Record<string, unknown> = {}
    await createBatch(mockHttp(cap), () => null).deleteTask('t9')
    expect(cap.delUrl).toBe('/batch/t9/task')
  })

  it('delete sends files in request body (data)', async () => {
    const cap: Record<string, unknown> = {}
    await createBatch(mockHttp(cap), () => null).delete(['/DATA/a', '/DATA/b'])
    expect(cap.delUrl).toBe('/batch')
    expect(cap.delData).toEqual(['/DATA/a', '/DATA/b'])
  })

  it('batchUrl builds /v1/batch with encoded token + files', () => {
    const b = createBatch(mockHttp({}), () => 'TK')
    expect(b.batchUrl('/DATA/a,/DATA/b')).toBe('/v1/batch?token=TK&files=%2FDATA%2Fa%2C%2FDATA%2Fb')
  })
})
