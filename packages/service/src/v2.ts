import type { StdEnvelope } from './types.js'
import { unwrap } from './unwrap.js'

/** The v2 app_management BaseResponse is {message, data} with no success field
 *  (verified against openapi BaseResponse; the domain-wide version of the appgrid 2026-07-15 pitfall).
 *  On error paths the backend uses real HTTP status codes, so axios already rejected; anything reaching here is 2xx.
 *  Only for 2xx envelopes that must carry data; message-only responses (e.g. dry_run's {message})
 *  must not go through v2Data — those methods should ignore the body or read the raw envelope themselves. */
export function v2Data<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    const body = raw as { data?: unknown; success?: number }
    if (body.success !== undefined) return unwrap(body as StdEnvelope<T>)
    return body.data as T
  }
  return raw as T
}
