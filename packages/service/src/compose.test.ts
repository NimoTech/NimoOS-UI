import { describe, it, expect, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createCompose } from './compose.js'

interface Call { u?: string; b?: unknown; cfg?: { params?: Record<string, unknown>; headers?: Record<string, string> } }

function httpMock(reply: unknown = { message: '', data: {} }) {
  const calls: Record<string, Call> = {}
  const rec = (m: string) => (u: string, b?: unknown, c?: unknown) => {
    // get/delete 签名是 (url, config)
    const isBodyless = m === 'get' || m === 'delete'
    calls[m] = isBodyless ? { u, cfg: b as Call['cfg'] } : { u, b, cfg: c as Call['cfg'] }
    return Promise.resolve({ data: reply })
  }
  const http = { get: rec('get'), post: rec('post'), put: rec('put'), patch: rec('patch'), delete: rec('delete') } as unknown as AxiosInstance
  return { http, calls }
}

describe('createCompose', () => {
  it('list 解映射,缺 data 容空', async () => {
    const { http } = httpMock({ message: '', data: { jellyfin: { status: 'running' } } })
    expect(await createCompose(http).list()).toEqual({ jellyfin: { status: 'running' } })
    const empty = httpMock({ message: '' })
    expect(await createCompose(empty.http).list()).toEqual({})
  })
  it('list 不误杀 id 叫 message 的应用(判原始信封而非解包后键名)', async () => {
    const { http } = httpMock({ message: '', data: { message: { status: 'running' } } })
    expect(await createCompose(http).list()).toEqual({ message: { status: 'running' } })
  })
  it('get:data 缺失时如实返回 undefined(签名不说谎)', async () => {
    const { http } = httpMock({ message: '', data: undefined })
    expect(await createCompose(http).get('jellyfin')).toBeUndefined()
  })
  it('install:YAML body + Content-Type yaml + snake_case query', async () => {
    const { http, calls } = httpMock({ message: '' })
    await createCompose(http).install('services: {}', { dryRun: true, checkPortConflict: false })
    expect(calls.post?.u).toBe('/v2/app_management/compose')
    expect(calls.post?.b).toBe('services: {}')
    expect(calls.post?.cfg?.headers?.['Content-Type']).toBe('application/yaml')
    expect(calls.post?.cfg?.params).toEqual({ dry_run: true, check_port_conflict: false })
  })
  it('applySettings:PUT /compose/{id} 同款 body/参数', async () => {
    const { http, calls } = httpMock({ message: '' })
    await createCompose(http).applySettings('jellyfin', 'services: {}', { dryRun: true })
    expect(calls.put?.u).toBe('/v2/app_management/compose/jellyfin')
    expect(calls.put?.cfg?.params).toEqual({ dry_run: true, check_port_conflict: undefined })
  })
  it('setStatus 发 JSON 字符串 body(echo Bind 只认 "start" 带引号形态)', async () => {
    const { http, calls } = httpMock({ message: '' })
    await createCompose(http).setStatus('jellyfin', 'restart')
    expect(calls.put?.u).toBe('/v2/app_management/compose/jellyfin/status')
    expect(calls.put?.b).toBe('"restart"')
    expect(calls.put?.cfg?.headers?.['Content-Type']).toBe('application/json')
  })
  it('update PATCH、uninstall DELETE + delete_config_folder', async () => {
    const { http, calls } = httpMock({ message: '' })
    const c = createCompose(http)
    await c.update('jellyfin')
    expect(calls.patch?.u).toBe('/v2/app_management/compose/jellyfin')
    await c.uninstall('jellyfin', { deleteConfigFolder: false })
    expect(calls.delete?.u).toBe('/v2/app_management/compose/jellyfin')
    expect(calls.delete?.cfg?.params).toEqual({ delete_config_folder: false })
  })
  it('update 返回后端 message(检查并更新的 toast 文案),缺 message 容空串', async () => {
    const { http } = httpMock({ message: 'compose app jellyfin is up to date' })
    expect(await createCompose(http).update('jellyfin')).toBe('compose app jellyfin is up to date')
    const bare = httpMock({})
    expect(await createCompose(bare.http).update('jellyfin')).toBe('')
  })
  it('logs 解 data 为字符串并透传 lines', async () => {
    const { http, calls } = httpMock({ message: '', data: 'line1\nline2' })
    const out = await createCompose(http).logs('jellyfin', { lines: 200 })
    expect(out).toBe('line1\nline2')
    expect(calls.get?.cfg?.params).toEqual({ lines: 200 })
  })
  it('healthcheck:2xx→true,reject→false', async () => {
    const ok = httpMock({ message: '' })
    expect(await createCompose(ok.http).healthcheck('jellyfin')).toBe(true)
    const bad = { get: () => Promise.reject(new Error('503')) } as unknown as AxiosInstance
    expect(await createCompose(bad).healthcheck('jellyfin')).toBe(false)
  })
})

describe('getYaml', () => {
  it('GET compose/{id} with Accept yaml, returns raw text untouched', async () => {
    const http = {
      get: vi.fn().mockResolvedValue({ data: 'name: syncthing\nservices: {}\nx-nimoos:\n  tips: {}\n' }),
    } as unknown as AxiosInstance
    const compose = createCompose(http)
    const y = await compose.getYaml('syncthing')
    expect(y).toContain('x-nimoos')
    expect(http.get).toHaveBeenCalledWith('/v2/app_management/compose/syncthing', expect.objectContaining({
      headers: { Accept: 'application/yaml' },
      responseType: 'text',
    }))
  })
})

describe('compose.get 404 语义(幽灵进度卡根因)', () => {
  it('404 返回 undefined(确定不存在),其它错误照抛', async () => {
    const err404 = Object.assign(new Error('404'), { response: { status: 404 } })
    const c404 = createCompose({ get: async () => { throw err404 } } as unknown as import('axios').AxiosInstance)
    await expect(c404.get('ghost')).resolves.toBeUndefined()

    const err500 = Object.assign(new Error('500'), { response: { status: 500 } })
    const c500 = createCompose({ get: async () => { throw err500 } } as unknown as import('axios').AxiosInstance)
    await expect(c500.get('x')).rejects.toThrow('500')

    const netErr = new Error('network down')
    const cNet = createCompose({ get: async () => { throw netErr } } as unknown as import('axios').AxiosInstance)
    await expect(cNet.get('x')).rejects.toThrow('network down')
  })
})

describe('containers', () => {
  it('解 v2 信封并保留 main 与 per-service 容器 ID', async () => {
    const { http } = httpMock({ message: '', data: {
      main: 'syncthing',
      containers: { syncthing: { ID: 'abc123', State: 'running' } },
    } })
    const r = await createCompose(http).containers('syncthing')
    expect(r).toEqual({ main: 'syncthing', containers: { syncthing: { ID: 'abc123', State: 'running' } } })
  })
  it('404(应用不存在)返回 undefined 不抛', async () => {
    const err404 = Object.assign(new Error('404'), { response: { status: 404 } })
    const c404 = createCompose({ get: async () => { throw err404 } } as unknown as import('axios').AxiosInstance)
    await expect(c404.containers('gone')).resolves.toBeUndefined()
  })
  it('非 404 错误照抛', async () => {
    const err500 = Object.assign(new Error('500'), { response: { status: 500 } })
    const c500 = createCompose({ get: async () => { throw err500 } } as unknown as import('axios').AxiosInstance)
    await expect(c500.containers('x')).rejects.toThrow('500')
  })
  it('data 缺 containers 时容忍为空表', async () => {
    const { http } = httpMock({ message: '', data: { main: 'a' } })
    await expect(createCompose(http).containers('a')).resolves.toEqual({ main: 'a', containers: {} })
  })
})
