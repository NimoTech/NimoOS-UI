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
 * Generic SSE fetch: a bare fetch doesn't get axios interceptor's single-flight
 * 401 refresh, so this fills in the same semantics.
 * 401 → await refreshAccessToken() → resend the whole request once with the new
 * token (SSE can't resume a stream; at 401 the backend hasn't started processing
 * yet, so resending is safe). Authorization is a bare token (backend convention, no Bearer).
 * 204 → {ok:true,noContent:true} (the "no content" semantics for attach-type
 * endpoints, interpreted by the caller).
 * AbortError propagates out for the caller to handle; other network errors also
 * propagate out (consistent with fetch).
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
          // malformed JSON — skip (consistent with Vue2 consumeSSE behavior)
        }
      }
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    return { ok: true, status: resp.status, error }
  }
  return { ok: true, status: resp.status }
}
