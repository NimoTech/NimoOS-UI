import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createStorage } from './storage'

describe('createStorage', () => {
  it('list forwards params (system=show) and unwraps', async () => {
    let seen: unknown
    const http = { get: async (_u: string, cfg?: { params?: unknown }) => { seen = cfg?.params; return { data: { success: 200, data: [{ mount_point: '/', label: 'NimoOS-HD' }] } } } } as unknown as AxiosInstance
    const res = await createStorage(http).list({ system: 'show' })
    expect(seen).toEqual({ system: 'show' })
    expect(Array.isArray(res)).toBe(true)
  })

  it('create posts, format puts, delete sends body', async () => {
    const log: Array<[string, string, unknown]> = []
    const http = {
      post: async (u: string, b?: unknown) => { log.push(['post', u, b]); return { data: { success: 200, data: {} } } },
      put: async (u: string, b?: unknown) => { log.push(['put', u, b]); return { data: { success: 200, data: {} } } },
      delete: async (u: string, cfg?: { data?: unknown }) => { log.push(['delete', u, cfg?.data]); return { data: { success: 200, data: {} } } },
    } as unknown as AxiosInstance
    const s = createStorage(http)
    await s.create({ a: 1 }); await s.format({ b: 2 }); await s.delete({ c: 3 })
    expect(log).toEqual([
      ['post', '/storage', { a: 1 }],
      ['put', '/storage', { b: 2 }],
      ['delete', '/storage', { c: 3 }],
    ])
  })
})
