import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createTerminal } from './terminal'

// Recording http stub. The terminal service speaks bare JSON (no Result
// envelope), so the stub returns payloads directly under `data`.
function stub(map: Record<string, unknown> = {}) {
  const calls: { m: string; url: string; body?: unknown; cfg?: unknown }[] = []
  const get = async (url: string, cfg?: unknown) => { calls.push({ m: 'get', url, cfg }); return { data: map[url] } }
  const del = async (url: string, cfg?: unknown) => { calls.push({ m: 'delete', url, cfg }); return { data: map[url] } }
  const post = async (url: string, body?: unknown, cfg?: unknown) => { calls.push({ m: 'post', url, body, cfg }); return { data: map[url] } }
  const put = async (url: string, body?: unknown, cfg?: unknown) => { calls.push({ m: 'put', url, body, cfg }); return { data: map[url] } }
  const http = { get, post, put, delete: del } as unknown as AxiosInstance
  return { http, calls }
}

describe('createTerminal — bare JSON, no envelope unwrap', () => {
  it('createSession without password posts an empty body and allows the default 401 refresh-replay', async () => {
    const { http, calls } = stub({ '/terminal/session': { mode: 'idle', idle_minutes: 15 } })
    const t = createTerminal(http)
    const info = await t.createSession()
    expect(info).toEqual({ mode: 'idle', idle_minutes: 15 })
    expect(calls[0].body).toBeUndefined()
    expect((calls[0].cfg as { _noAuthRetry?: boolean } | undefined)?._noAuthRetry).toBeUndefined()
  })

  it('createSession with password opts out of the 401 refresh-replay', async () => {
    const { http, calls } = stub({ '/terminal/session': { mode: 'on_open', idle_minutes: 15 } })
    await createTerminal(http).createSession('s3cret')
    expect(calls[0].body).toEqual({ password: 's3cret' })
    expect((calls[0].cfg as { _noAuthRetry?: boolean })._noAuthRetry).toBe(true)
  })

  it('putSettings carries the password and opts out of the 401 refresh-replay', async () => {
    const { http, calls } = stub()
    await createTerminal(http).putSettings({ mode: 'idle', idle_minutes: 30, password: 'pw' })
    expect(calls[0]).toMatchObject({ m: 'put', url: '/terminal/settings', body: { mode: 'idle', idle_minutes: 30, password: 'pw' } })
    expect((calls[0].cfg as { _noAuthRetry?: boolean })._noAuthRetry).toBe(true)
  })

  it('getSettings and listWindows return the bare payload untouched', async () => {
    const { http } = stub({
      '/terminal/settings': { mode: 'off', idle_minutes: 15 },
      '/terminal/windows': [{ index: 0, name: 'zsh', active: true }],
    })
    const t = createTerminal(http)
    expect(await t.getSettings()).toEqual({ mode: 'off', idle_minutes: 15 })
    expect(await t.listWindows()).toEqual([{ index: 0, name: 'zsh', active: true }])
  })

  it('window mutations hit the documented routes', async () => {
    const { http, calls } = stub()
    const t = createTerminal(http)
    await t.newWindow(); await t.selectWindow(2); await t.closeWindow(2); await t.renameWindow(1, 'build')
    await t.keepalive(); await t.deleteSession()
    expect(calls.map((c) => [c.m, c.url])).toEqual([
      ['post', '/terminal/windows'],
      ['post', '/terminal/windows/2/select'],
      ['delete', '/terminal/windows/2'],
      ['put', '/terminal/windows/1'],
      ['post', '/terminal/keepalive'],
      ['delete', '/terminal/session'],
    ])
    expect(calls[3].body).toEqual({ name: 'build' })
  })
})
