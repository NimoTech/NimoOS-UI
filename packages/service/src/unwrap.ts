import type { StdEnvelope } from './types.js'

// success===200 → 返回 data;否则抛带 message + code 的错误
export function unwrap<T>(body: StdEnvelope<T>): T {
  if (body && body.success === 200) return body.data as T
  const err = new Error(body?.message || `request failed (${body?.success})`)
  ;(err as Error & { code?: number }).code = body?.success
  throw err
}
