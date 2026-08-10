import { describe, it, expect, vi } from 'vitest'
import type { AxiosAdapter, AxiosRequestConfig } from 'axios'
import { createHttp, initService, refreshAccessToken } from './http'
import type { ServiceConfig } from './config'

function makeConfig(over: Partial<ServiceConfig> = {}): ServiceConfig {
  return {
    getToken: () => 'tok-abc',
    getRefresh: () => 'refresh-xyz',
    setTokens: vi.fn(),
    onAuthFail: vi.fn(),
    getLang: () => 'zh_cn',
    ...over,
  }
}

// 一个可编程的 axios adapter:按 url 返回预设响应
function makeAdapter(handler: (cfg: AxiosRequestConfig) => { status: number; data: unknown }): AxiosAdapter {
  return async (cfg) => {
    const { status, data } = handler(cfg)
    return { status, statusText: '', headers: {}, config: cfg, data }
  }
}

describe('createHttp', () => {
  it('attaches bare token and Language header, prefixes /v1', async () => {
    let seen: AxiosRequestConfig | null = null
    const adapter = makeAdapter((cfg) => { seen = cfg; return { status: 200, data: { success: 200, data: { ok: 1 } } } })
    const http = createHttp(makeConfig(), adapter)
    const res = await http.get('/sys/utilization')
    expect(seen!.url).toBe('/v1/sys/utilization')
    expect(seen!.headers!.Authorization).toBe('tok-abc')
    expect(seen!.headers!.Language).toBe('zh_cn')
    expect(res.data).toEqual({ success: 200, data: { ok: 1 } })
  })

  it('does not prefix /v2 or absolute urls', async () => {
    const seen: string[] = []
    const adapter = makeAdapter((cfg) => { seen.push(cfg.url!); return { status: 200, data: {} } })
    const http = createHttp(makeConfig(), adapter)
    await http.get('/v2/users/events')
    await http.get('https://x/y')
    expect(seen).toEqual(['/v2/users/events', 'https://x/y'])
  })

  it('on 401 refreshes once then replays the original request', async () => {
    const cfg = makeConfig()
    let calls = 0
    const adapter = makeAdapter((c) => {
      if (c.url === '/v1/users/refresh') {
        return { status: 200, data: { success: 200, data: { access_token: 'NEW', refresh_token: 'NEWR', expires_at: '999' } } }
      }
      calls++
      if (calls === 1) return { status: 401, data: { success: 401, message: 'expired' } }
      return { status: 200, data: { success: 200, data: { replayed: true } } }
    })
    const http = createHttp(cfg, adapter)
    const res = await http.get('/sys/utilization')
    expect(cfg.setTokens).toHaveBeenCalledWith('NEW', 'NEWR', '999')
    expect(res.data).toEqual({ success: 200, data: { replayed: true } })
  })

  it('calls onAuthFail when refresh itself fails', async () => {
    const cfg = makeConfig()
    const adapter = makeAdapter((c) => {
      if (c.url === '/v1/users/refresh') return { status: 401, data: { success: 401 } }
      return { status: 401, data: { success: 401 } }
    })
    const http = createHttp(cfg, adapter)
    await expect(http.get('/sys/utilization')).rejects.toThrow()
    expect(cfg.onAuthFail).toHaveBeenCalled()
  })

  it('does not refresh-replay a 401 when the request opts out via _noAuthRetry', async () => {
    const cfg = makeConfig()
    let attempts = 0
    let refreshCalls = 0
    const adapter = makeAdapter((c) => {
      if (c.url === '/v1/users/refresh') { refreshCalls++; return { status: 200, data: { success: 200, data: { access_token: 'NEW', refresh_token: 'NEWR', expires_at: '999' } } } }
      attempts++
      return { status: 401, data: { password_required: true } }
    })
    const http = createHttp(cfg, adapter)
    await expect(http.post('/terminal/session', { password: 'x' }, { _noAuthRetry: true } as never)).rejects.toBeTruthy()
    expect(attempts).toBe(1) // never replayed
    expect(refreshCalls).toBe(0) // never refreshed
  })
})

describe('refreshAccessToken (module-level single-flight)', () => {
  it('collapses concurrent refreshes into a single POST', async () => {
    const cfg = makeConfig()
    let refreshCalls = 0
    const adapter = makeAdapter((c) => {
      if (c.url === '/v1/users/refresh') {
        refreshCalls++
        return { status: 200, data: { success: 200, data: { access_token: 'NEW', refresh_token: 'NEWR', expires_at: '1' } } }
      }
      return { status: 200, data: {} }
    })
    initService(cfg, adapter)
    const [a, b, c] = await Promise.all([refreshAccessToken(), refreshAccessToken(), refreshAccessToken()])
    expect(refreshCalls).toBe(1)
    expect([a, b, c]).toEqual(['NEW', 'NEW', 'NEW'])
    expect(cfg.setTokens).toHaveBeenCalledWith('NEW', 'NEWR', '1')
  })

  it('calls onAuthFail and rejects when refresh fails', async () => {
    const cfg = makeConfig()
    const adapter = makeAdapter(() => ({ status: 401, data: { success: 401 } }))
    initService(cfg, adapter)
    await expect(refreshAccessToken()).rejects.toThrow()
    expect(cfg.onAuthFail).toHaveBeenCalled()
  })
})
