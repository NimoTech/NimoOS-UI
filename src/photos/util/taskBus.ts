// Ported verbatim (logic unchanged, types added) from the Vue 2 panel
// src/views/Photos/photosTaskBusAdapter.js (unwrapTaskBusPayload, :9-39).
//
// Unwrap NimoOS-MessageBus socket envelope ({SourceID,Name,Properties,...})
// into a flat Task object (id/type/label/status/progress/current/total/...).
//
// MessageBus Properties is map[string]string, so this module converts
// numeric fields back to numbers. Already-flat objects (test / direct REST
// injection path) are returned as-is.

export interface TaskBusPayload {
  id?: string | number
  type?: string
  label?: string
  status?: string
  started_at?: string
  current?: number
  total?: number
  added?: number
  progress?: number
  eta_seconds?: number
  error?: string
  errorKey?: string
  errorParams?: unknown
  [key: string]: unknown
}

export function unwrapTaskBusPayload(payload: unknown): TaskBusPayload | null {
  if (!payload || typeof payload !== 'object') return null
  const envelope = payload as Record<string, unknown>
  // Already-flat path: has id + status but no Properties envelope
  if (envelope.id && envelope.status && envelope.Properties === undefined) {
    return envelope as TaskBusPayload
  }
  const p = envelope.Properties as Record<string, unknown> | undefined
  if (!p || typeof p !== 'object') return null
  const out: TaskBusPayload = {
    id: p.id as string | number | undefined,
    type: p.type as string | undefined,
    label: p.label as string | undefined,
    status: p.status as string | undefined,
    started_at: p.started_at as string | undefined,
  }
  if (p.current !== undefined) out.current = Number(p.current)
  if (p.total !== undefined) out.total = Number(p.total)
  if (p.added !== undefined) out.added = Number(p.added)
  if (p.progress !== undefined) out.progress = Number(p.progress)
  if (p.eta_seconds !== undefined) out.eta_seconds = Number(p.eta_seconds)
  if (p.error) out.error = p.error as string
  if (p.errorKey) out.errorKey = p.errorKey as string
  if (p.errorParams) {
    try {
      out.errorParams = JSON.parse(p.errorParams as string)
    } catch {
      out.errorParams = undefined
    }
  }
  return out
}
