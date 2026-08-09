import type { StdEnvelope } from './types.js'

// success===200 → 返回 data;否则抛带 message + code 的错误
export function unwrap<T>(body: StdEnvelope<T>): T {
  if (body && body.success === 200) return body.data as T
  const err = new Error(body?.message || `request failed (${body?.success})`)
  ;(err as Error & { code?: number }).code = body?.success
  // On failure the backend usually puts the real err.Error() text in `data` and
  // leaves `message` as a generic "Fail". Keep it so callers can show something
  // actionable; `message` stays untouched so existing consumers are unaffected.
  if (typeof body?.data === 'string') (err as Error & { detail?: string }).detail = body.data
  throw err
}
