import type { StdEnvelope } from './types.js'
import { unwrap } from './unwrap.js'

/** v2 app_management 的 BaseResponse 是 {message, data},没有 success 字段
 *  (openapi BaseResponse 实证;appgrid 2026-07-15 踩坑的全域版)。
 *  错误路径后端用真实 HTTP 状态码,axios 已 reject,到这里的都是 2xx。
 *  仅用于必带 data 的 2xx 信封;message-only 响应(如 dry_run 的 {message})
 *  勿过 v2Data——那类方法应忽略响应体或自行读原始信封。 */
export function v2Data<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    const body = raw as { data?: unknown; success?: number }
    if (body.success !== undefined) return unwrap(body as StdEnvelope<T>)
    return body.data as T
  }
  return raw as T
}
