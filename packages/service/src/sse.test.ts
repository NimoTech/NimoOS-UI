import { describe, it, expect, vi, beforeEach } from 'vitest'

const refreshMock = vi.fn()
vi.mock('./http.js', () => ({ refreshAccessToken: (...a: unknown[]) => refreshMock(...a) }))

import { setConfig } from './config.js' // same import as http.ts:3, confirmed exported
import { sseRequest } from './sse.js'

let token = 'OLD'
beforeEach(() => {
  refreshMock.mockReset()
  token = 'OLD'
  setConfig({
    getToken: () => token,
    getRefresh: () => 'R',
    setTokens: () => {},
    onAuthFail: () => {},
    getLang: () => 'zh_cn',
  })
})

function sseResp(lines: string[], status = 200) {
  const payload = new TextEncoder().encode(lines.map(l => `data: ${l}\n`).join(''))
  let served = false
  return {
    ok: status >= 200 && status < 300,
    status,
    body: {
      getReader: () => ({
        read: async () => (served ? { done: true } : ((served = true), { done: false, value: payload })),
      }),
    },
  } as unknown as Response
}

describe('sseRequest', () => {
  it('parses data: lines and stops at [DONE]', async () => {
    const fetchImpl = vi.fn(async () => sseResp(['{"a":1}', '[DONE]', '{"a":2}']))
    const evts: unknown[] = []
    const out = await sseRequest('/v1/x', { onEvent: e => evts.push(e), fetchImpl })
    expect(out).toEqual({ ok: true, status: 200 })
    expect(evts).toEqual([{ a: 1 }])
  })

  it('401 → refreshAccessToken → retries once with the new token', async () => {
    const auths: unknown[] = []
    const fetchImpl = vi.fn(async (_u: string, init: RequestInit) => {
      auths.push((init.headers as Record<string, string>).Authorization)
      return auths.length === 1 ? sseResp([], 401) : sseResp(['[DONE]'])
    })
    refreshMock.mockImplementation(async () => { token = 'NEW'; return 'NEW' })
    const out = await sseRequest('/v1/x', { onEvent: () => {}, fetchImpl })
    expect(auths).toEqual(['OLD', 'NEW'])
    expect(out.ok).toBe(true)
  })

  it('401 refresh fails → {ok:false,status:401,error}, sent only once', async () => {
    const fetchImpl = vi.fn(async () => sseResp([], 401))
    refreshMock.mockRejectedValue(new Error('dead'))
    const out = await sseRequest('/v1/x', { onEvent: () => {}, fetchImpl })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(out).toMatchObject({ ok: false, status: 401 })
  })

  it('204 → noContent, does not read the stream', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 204 }) as unknown as Response)
    const out = await sseRequest('/v1/x', { onEvent: () => {}, fetchImpl })
    expect(out).toEqual({ ok: true, status: 204, noContent: true })
  })

  it('non-2xx, non-401/204 (e.g. 500, with body) → {ok:false,status:500}, does not read the stream (getReader is never called)', async () => {
    const getReaderSpy = vi.fn()
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 500,
      body: { getReader: getReaderSpy },
    }) as unknown as Response)
    const out = await sseRequest('/v1/x', { onEvent: () => {}, fetchImpl })
    expect(out).toEqual({ ok: false, status: 500 })
    expect(getReaderSpy).not.toHaveBeenCalled()
  })

  it('POST with body and custom headers; Authorization is a bare token', async () => {
    let init: RequestInit | undefined
    const fetchImpl = vi.fn(async (_u: string, i: RequestInit) => { init = i; return sseResp(['[DONE]']) })
    await sseRequest('/v1/x', {
      method: 'POST', body: { q: 1 }, headers: { 'X-Extra': 'y' }, onEvent: () => {}, fetchImpl,
    })
    const h = init!.headers as Record<string, string>
    expect(h.Authorization).toBe('OLD')
    expect(h['Content-Type']).toBe('application/json')
    expect(h['X-Extra']).toBe('y')
    expect(init!.body).toBe(JSON.stringify({ q: 1 }))
  })

  it('stream errors mid-way (reader.read rejects, not AbortError) → {ok:true,status:200,error}, already-received events are not lost', async () => {
    const err = new Error('network drop')
    let calls = 0
    const chunk = new TextEncoder().encode('data: {"a":1}\n')
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: async () => {
            calls++
            if (calls === 1) return { done: false, value: chunk }
            throw err
          },
        }),
      },
    }) as unknown as Response)
    const evts: unknown[] = []
    const out = await sseRequest('/v1/x', { onEvent: e => evts.push(e), fetchImpl })
    expect(out).toEqual({ ok: true, status: 200, error: err })
    expect(evts).toEqual([{ a: 1 }])
  })

  it('AbortError propagates outward', async () => {
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' })
    const fetchImpl = vi.fn(async () => { throw abortErr })
    await expect(sseRequest('/v1/x', { onEvent: () => {}, fetchImpl })).rejects.toBe(abortErr)
  })

  it('retry still gets 401 → refresh succeeds but the reconnect still gets 401, retries exactly once without looping, surfaces as {ok:false,status:401}', async () => {
    const auths: (string | null)[] = []
    refreshMock.mockImplementation(async () => { token = 'NEW' })
    let calls = 0
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      calls++
      auths.push((init.headers as Record<string, string>).Authorization ?? null)
      return sseResp([], 401)          // BOTH attempts return 401
    }) as unknown as typeof fetch
    const out = await sseRequest('/x', { onEvent: () => {}, fetchImpl })
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(calls).toBe(2)                       // retried exactly once — did NOT loop
    expect(auths).toEqual(['OLD', 'NEW'])
    expect(out).toMatchObject({ ok: false, status: 401 })
  })

  it('non-2xx with a JSON body → errorBody carries the parsed body', async () => {
    const resp = {
      status: 500, ok: false,
      body: { getReader: () => ({ read: async () => ({ done: true }) }) },
      json: async () => ({ message: 'boom', code: 20001 }),
      text: async () => '{"message":"boom","code":20001}',
    } as unknown as Response
    const fetchImpl = (async () => resp) as unknown as typeof fetch
    const out = await sseRequest('/x', { onEvent: () => {}, fetchImpl })
    expect(out.ok).toBe(false)
    expect(out.status).toBe(500)
    expect(out.errorBody).toMatchObject({ message: 'boom', code: 20001 })
  })
})
