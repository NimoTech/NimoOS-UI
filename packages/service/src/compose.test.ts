import { describe, it, expect, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createCompose } from './compose.js'

interface Call { u?: string; b?: unknown; cfg?: { params?: Record<string, unknown>; headers?: Record<string, string> } }

function httpMock(reply: unknown = { message: '', data: {} }) {
  const calls: Record<string, Call> = {}
  const rec = (m: string) => (u: string, b?: unknown, c?: unknown) => {
    // get/delete signature is (url, config)
    const isBodyless = m === 'get' || m === 'delete'
    calls[m] = isBodyless ? { u, cfg: b as Call['cfg'] } : { u, b, cfg: c as Call['cfg'] }
    return Promise.resolve({ data: reply })
  }
  const http = { get: rec('get'), post: rec('post'), put: rec('put'), patch: rec('patch'), delete: rec('delete') } as unknown as AxiosInstance
  return { http, calls }
}

describe('createCompose', () => {
  it('list unwraps the map; missing data tolerates empty', async () => {
    const { http } = httpMock({ message: '', data: { jellyfin: { status: 'running' } } })
    expect(await createCompose(http).list()).toEqual({ jellyfin: { status: 'running' } })
    const empty = httpMock({ message: '' })
    expect(await createCompose(empty.http).list()).toEqual({})
  })
  it('list does not mistakenly drop an app whose id happens to be message (checks the raw envelope, not the post-unwrap key names)', async () => {
    const { http } = httpMock({ message: '', data: { message: { status: 'running' } } })
    expect(await createCompose(http).list()).toEqual({ message: { status: 'running' } })
  })
  it('get: returns undefined truthfully when data is missing (the type signature does not lie)', async () => {
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
  it('applySettings: PUT /compose/{id} uses the same body/params shape', async () => {
    const { http, calls } = httpMock({ message: '' })
    await createCompose(http).applySettings('jellyfin', 'services: {}', { dryRun: true })
    expect(calls.put?.u).toBe('/v2/app_management/compose/jellyfin')
    expect(calls.put?.cfg?.params).toEqual({ dry_run: true, check_port_conflict: undefined })
  })
  it('setStatus sends a JSON string body (echo Bind only accepts the quoted form "start")', async () => {
    const { http, calls } = httpMock({ message: '' })
    await createCompose(http).setStatus('jellyfin', 'restart')
    expect(calls.put?.u).toBe('/v2/app_management/compose/jellyfin/status')
    expect(calls.put?.b).toBe('"restart"')
    expect(calls.put?.cfg?.headers?.['Content-Type']).toBe('application/json')
  })
  it('update PATCH, uninstall DELETE + delete_config_folder', async () => {
    const { http, calls } = httpMock({ message: '' })
    const c = createCompose(http)
    await c.update('jellyfin')
    expect(calls.patch?.u).toBe('/v2/app_management/compose/jellyfin')
    await c.uninstall('jellyfin', { deleteConfigFolder: false })
    expect(calls.delete?.u).toBe('/v2/app_management/compose/jellyfin')
    expect(calls.delete?.cfg?.params).toEqual({ delete_config_folder: false })
  })
  it('update returns the backend message (toast text for check-and-update), missing message tolerates empty string', async () => {
    const { http } = httpMock({ message: 'compose app jellyfin is up to date' })
    expect(await createCompose(http).update('jellyfin')).toBe('compose app jellyfin is up to date')
    const bare = httpMock({})
    expect(await createCompose(bare.http).update('jellyfin')).toBe('')
  })
  it('logs unwraps data as a string and passes lines through', async () => {
    const { http, calls } = httpMock({ message: '', data: 'line1\nline2' })
    const out = await createCompose(http).logs('jellyfin', { lines: 200 })
    expect(out).toBe('line1\nline2')
    expect(calls.get?.cfg?.params).toEqual({ lines: 200 })
  })
  it('healthcheck: 2xx → true, reject → false', async () => {
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

describe('compose.get 404 semantics (root cause of the ghost progress-card bug)', () => {
  it('404 returns undefined (confirmed nonexistent), other errors still throw', async () => {
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
  it('unwraps the v2 envelope and keeps main and per-service container IDs', async () => {
    const { http } = httpMock({ message: '', data: {
      main: 'syncthing',
      containers: { syncthing: { ID: 'abc123', State: 'running' } },
    } })
    const r = await createCompose(http).containers('syncthing')
    expect(r).toEqual({ main: 'syncthing', containers: { syncthing: { ID: 'abc123', State: 'running' } } })
  })
  it('404 (app does not exist) returns undefined, does not throw', async () => {
    const err404 = Object.assign(new Error('404'), { response: { status: 404 } })
    const c404 = createCompose({ get: async () => { throw err404 } } as unknown as import('axios').AxiosInstance)
    await expect(c404.containers('gone')).resolves.toBeUndefined()
  })
  it('non-404 errors still throw', async () => {
    const err500 = Object.assign(new Error('500'), { response: { status: 500 } })
    const c500 = createCompose({ get: async () => { throw err500 } } as unknown as import('axios').AxiosInstance)
    await expect(c500.containers('x')).rejects.toThrow('500')
  })
  it('tolerates an empty table when data is missing containers', async () => {
    const { http } = httpMock({ message: '', data: { main: 'a' } })
    await expect(createCompose(http).containers('a')).resolves.toEqual({ main: 'a', containers: {} })
  })
})
