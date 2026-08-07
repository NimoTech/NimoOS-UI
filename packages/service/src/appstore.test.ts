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
  it('categories 解 v2 裸信封为数组', async () => {
    const http = httpMock({ get: () => ({ message: '', data: [{ id: 1, name: 'Media', count: 3 }] }) })
    const cats = await createAppstore(http).categories()
    expect(cats).toEqual([{ id: 1, name: 'Media', count: 3 }])
  })
  it('listApps 透传 snake_case 查询参数并容空', async () => {
    let cfg: { params?: Record<string, unknown> } | undefined
    const http = httpMock({ get: (_u, c) => { cfg = c as typeof cfg; return { data: { installed: [], list: {} } } } })
    const r = await createAppstore(http).listApps({ category: 'Media', recommend: true })
    expect(cfg?.params).toEqual({ category: 'Media', author_type: undefined, recommend: true })
    expect(r).toEqual({ installed: [], list: {} })
  })
  it('listApps data 缺键时给安全默认', async () => {
    const http = httpMock({ get: () => ({ message: '', data: {} }) })
    expect(await createAppstore(http).listApps()).toEqual({ installed: [], list: {} })
  })
  it('getApp 编码 id 进路径', async () => {
    let url = ''
    const http = httpMock({ get: (u) => { url = u; return { data: { title: { en_us: 'X' } } } } })
    await createAppstore(http).getApp('a b')
    expect(url).toBe('/v2/app_management/apps/a%20b')
  })
  it('getApp:data 缺失时如实返回 undefined(签名不说谎)', async () => {
    const http = httpMock({ get: () => ({ message: '', data: undefined }) })
    expect(await createAppstore(http).getApp('nope')).toBeUndefined()
  })
  it('getAppCompose 带 Accept yaml 且不解析,原样返回文本', async () => {
    let cfg: { headers?: Record<string, string> } | undefined
    const http = httpMock({ get: (_u, c) => { cfg = c as typeof cfg; return 'services:\n  app:\n' } })
    const yml = await createAppstore(http).getAppCompose('syncthing')
    expect(yml).toBe('services:\n  app:\n')
    expect(cfg?.headers?.Accept).toBe('application/yaml')
  })
  it('registerSource 用 query 参数 url、无 body;unregisterSource DELETE /appstore/{id}', async () => {
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
  it('stableTag 解 v2 信封', async () => {
    const httpGet = (data: unknown) => ({ get: async () => ({ data }) }) as unknown as AxiosInstance
    const s = createAppstore(httpGet({ data: { tag: '26.5.2' } }))
    expect(await s.stableTag('actualbudget', 'actualbudget')).toBe('26.5.2')
  })
  it('stableTag 请求失败返 null', async () => {
    const s = createAppstore({ get: async () => { throw new Error('404') } } as unknown as AxiosInstance)
    expect(await s.stableTag('x', 'y')).toBeNull()
  })
})
