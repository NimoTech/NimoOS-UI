import type { TerminalMode } from '@nimotech/nimoos-service'

/** HTTP status of an axios-shaped error; undefined for network/timeout errors. */
export function statusOf(e: unknown): number | undefined {
  return (e as { response?: { status?: number } } | undefined)?.response?.status
}

/** Bare-JSON error body of the terminal service (no Result envelope). */
export interface TerminalErrorBody {
  password_required?: boolean
  mode?: TerminalMode
  idle_minutes?: number
  retry_after_seconds?: number
}

export function errorBody(e: unknown): TerminalErrorBody | undefined {
  return (e as { response?: { data?: TerminalErrorBody } } | undefined)?.response?.data
}
