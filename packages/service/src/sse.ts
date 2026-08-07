import { getConfig } from './config.js'
import { refreshAccessToken } from './http.js'

export interface SseOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
  onEvent: (evt: unknown) => void
  fetchImpl?: typeof fetch
}

export interface SseOutcome {
  ok: boolean
  status: number
  noContent?: boolean
  error?: unknown
  errorBody?: unknown   // parsed JSON (or raw text) of a non-2xx response body
}

/**
 * 通用 SSE fetch:裸 fetch 吃不到 axios 拦截器的 401 单飞刷新,这里补同一语义。
 * 401 → await refreshAccessToken() → 用新 token 整条重发一次(SSE 不能续流;
 * 401 时后端未开始处理,重发安全)。Authorization 为裸 token(后端约定,无 Bearer)。
 * 204 → {ok:true,noContent:true}(attach 类端点的"无内容"语义,由调用方解释)。
 * AbortError 向外抛,由调用方自理;其余网络错也向外抛(与 fetch 一致)。
 */
export async function sseRequest(path: string, opts: SseOptions): Promise<SseOutcome> {
  const { method = 'GET', body, headers, signal, onEvent } = opts
  const fetchImpl = opts.fetchImpl ?? fetch

  const doFetch = () => {
    const token = getConfig().getToken()
    return fetchImpl(path, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: token }),
        ...(headers || {}),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal,
    })
  }

  let resp = await doFetch()
  if (resp.status === 401) {
    try {
      await refreshAccessToken()
    } catch (error) {
      return { ok: false, status: 401, error }
    }
    resp = await doFetch()
  }

  if (resp.status === 204) return { ok: true, status: 204, noContent: true }
  if (!resp.ok || !resp.body) {
    let errorBody: unknown
    try { errorBody = await resp.json() } catch { try { errorBody = await resp.text() } catch { /* ignore */ } }
    return { ok: false, status: resp.status, errorBody }
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const payload = trimmed.slice(6)
        if (payload === '[DONE]') return { ok: true, status: resp.status }
        try {
          onEvent(JSON.parse(payload))
        } catch {
          // malformed JSON — skip(与 Vue2 consumeSSE 行为一致)
        }
      }
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    return { ok: true, status: resp.status, error }
  }
  return { ok: true, status: resp.status }
}
