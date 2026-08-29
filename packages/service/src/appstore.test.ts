import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createAppstore } from './appstore'

function httpMock(handlers: Record<string, (url: string, arg?: unknown, cfg?: unknown) => unknown>) {
  return {
    get: async (u: string, c?: unknown) => ({ data: handlers.get?.(u, c) }),
    post: async (u: string, b?: unknown, c?: unknown) => ({ data: handlers.post?.(u, b, c) }),
    delete: async (u: string, c?: unknown) => ({ data: handlers.delete?.(u, c) }),
  } as unknown as AxiosInstance
}

describe('createAppstore', () => {
  it('categories unwraps the v2 raw envelope into an array', async () => {
    const http = httpMock({ get: () => ({ message: '', data: [{ id: 1, name: 'Media', count: 3 }] }) })
    const cats = await createAppstore(http).categories()
    expect(cats).toEqual([{ id: 1, name: 'Media', count: 3 }])
  })
  it('listApps passes snake_case query params through and tolerates empty', async () => {
    let cfg: { params?: Record<string, unknown> } | undefined
    const http = httpMock({ get: (_u, c) => { cfg = c as typeof cfg; return { data: { installed: [], list: {} } } } })
    const r = await createAppstore(http).listApps({ category: 'Media', recommend: true })
    expect(cfg?.params).toEqual({ category: 'Media', author_type: undefined, recommend: true })
    expect(r).toEqual({ installed: [], list: {} })
  })
  it('listApps gives safe defaults when data is missing keys', async () => {
    const http = httpMock({ get: () => ({ message: '', data: {} }) })
    expect(await createAppstore(http).listApps()).toEqual({ installed: [], list: {} })
  })
  it('getApp encodes id into the path', async () => {
    let url = ''
    const http = httpMock({ get: (u) => { url = u; return { data: { title: { en_us: 'X' } } } } })
    await createAppstore(http).getApp('a b')
    expect(url).toBe('/v2/app_management/apps/a%20b')
  })
  it('getApp: returns undefined truthfully when data is missing (the type signature does not lie)', async () => {
    const http = httpMock({ get: () => ({ message: '', data: undefined }) })
    expect(await createAppstore(http).getApp('nope')).toBeUndefined()
  })
  it('getAppCompose sends Accept yaml and does not parse, returns the text as-is', async () => {
    let cfg: { headers?: Record<string, string> } | undefined
    const http = httpMock({ get: (_u, c) => { cfg = c as typeof cfg; return 'services:\n  app:\n' } })
    const yml = await createAppstore(http).getAppCompose('syncthing')
    expect(yml).toBe('services:\n  app:\n')
    expect(cfg?.headers?.Accept).toBe('application/yaml')
  })
  it('registerSource uses a query param url with no body; unregisterSource DELETE /appstore/{id}', async () => {
    let post: { u?: string; b?: unknown; cfg?: { params?: Record<string, unknown> } } = {}
    let delUrl = ''
    const http = httpMock({
      post: (u, b, c) => { post = { u, b, cfg: c as typeof post.cfg }; return { message: '' } },
      delete: (u) => { delUrl = u; return { message: '' } },
    })
    const s = createAppstore(http)
    await s.registerSource('https://example.com/store.zip')
    expect(post.u).toBe('/v2/app_management/appstore')
    expect(post.b).toBeUndefined()
    expect(post.cfg?.params).toEqual({ url: 'https://example.com/store.zip' })
    await s.unregisterSource(3)
    expect(delUrl).toBe('/v2/app_management/appstore/3')
  })
  it('stableTag unwraps the v2 envelope', async () => {
    const httpGet = (data: unknown) => ({ get: async () => ({ data }) }) as unknown as AxiosInstance
    const s = createAppstore(httpGet({ data: { tag: '26.5.2' } }))
    expect(await s.stableTag('actualbudget', 'actualbudget')).toBe('26.5.2')
  })
  it('stableTag returns null when the request fails', async () => {
    const s = createAppstore({ get: async () => { throw new Error('404') } } as unknown as AxiosInstance)
    expect(await s.stableTag('x', 'y')).toBeNull()
  })
})
