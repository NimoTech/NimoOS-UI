import axios, { type AxiosInstance, type AxiosAdapter, type AxiosError, AxiosError as AxiosErrorClass } from 'axios'
import type { ServiceConfig } from './config.js'
import { setConfig, getConfig } from './config.js'

// 默认 /v1;已带版本(/v1../v9..)或 http(s) 开头原样(对齐 api.js normalize)
function withVersion(url: string): string {
  if (/^https?:\/\//.test(url)) return url
  if (/^\/v[1-9]/.test(url)) return url
  return '/v1' + (url.startsWith('/') ? url : '/' + url)
}

function makeRefresher(instance: AxiosInstance, config: ServiceConfig): () => Promise<string> {
  let refreshing: Promise<string> | null = null

  async function doRefresh(): Promise<string> {
    const rt = config.getRefresh()
    if (!rt) { config.onAuthFail(); throw new Error('no refresh token') }
    try {
      const r = await instance.post('/v1/users/refresh', { refresh_token: rt })
      const body = r.data
      if (body && body.success === 200 && body.data && body.data.access_token) {
        config.setTokens(body.data.access_token, body.data.refresh_token, body.data.expires_at)
        return body.data.access_token
      }
    } catch {
      // 刷新请求自身失败 → 落到下方 onAuthFail
    }
    config.onAuthFail()
    throw new Error('token refresh failed')
  }

  return () => {
    if (!refreshing) refreshing = doRefresh().finally(() => { refreshing = null })
    return refreshing
  }
}

export function createHttp(config: ServiceConfig, adapter?: AxiosAdapter): AxiosInstance {
  const wrappedAdapter: AxiosAdapter | undefined = adapter ? async (cfg) => {
    const response = await adapter(cfg)
    const validateStatus = cfg.validateStatus || ((s) => s >= 200 && s < 300)
    if (!validateStatus(response.status)) {
      const code = response.status >= 400 && response.status < 500 ? 'ERR_BAD_REQUEST' : 'ERR_BAD_RESPONSE'
      throw new AxiosErrorClass('Request failed', code, cfg, undefined, response)
    }
    return response
  } : undefined

  const instance = axios.create({
    timeout: 60000,
    headers: { 'Content-Type': 'application/json' },
    ...(wrappedAdapter ? { adapter: wrappedAdapter } : {}),
  })

  instance.interceptors.request.use((cfg) => {
    if (cfg.url) cfg.url = withVersion(cfg.url)
    cfg.headers = cfg.headers ?? {}
    cfg.headers.Language = config.getLang()
    const token = config.getToken()
    if (token) cfg.headers.Authorization = token
    return cfg
  })

  const refresh = makeRefresher(instance, config)
  ;(instance as unknown as { __refresh: () => Promise<string> }).__refresh = refresh

  instance.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
      const original = error.config as (typeof error.config & { _retried?: boolean }) | undefined
      const status = error.response?.status
      if (status === 401 && original && !original._retried && original.url !== '/v1/users/refresh') {
        original._retried = true
        try {
          const token = await refresh()
          original.headers = original.headers ?? {}
          original.headers.Authorization = token
          return instance(original)
        } catch (e) {
          return Promise.reject(e)
        }
      }
      const serverMsg = (error.response?.data as { message?: string } | undefined)?.message
      if (serverMsg) error.message = serverMsg
      return Promise.reject(error)
    },
  )

  return instance
}

let singleton: AxiosInstance | null = null
let singletonRefresh: (() => Promise<string>) | null = null

export function initService(config: ServiceConfig, adapter?: AxiosAdapter): void {
  setConfig(config)
  singleton = createHttp(getConfig(), adapter)
  singletonRefresh = (singleton as unknown as { __refresh: () => Promise<string> }).__refresh
}

export function getHttp(): AxiosInstance {
  if (!singleton) throw new Error('@nimotech/nimoos-service: initService() not called')
  return singleton
}

export function refreshAccessToken(): Promise<string> {
  if (!singletonRefresh) throw new Error('@nimotech/nimoos-service: initService() not called')
  return singletonRefresh()
}
