// Port of the intent of Vue2 src/views/AI/Agent/services/agentStream.js:570-650, but
// rebuilt on the shared sseRequest (Task 1) instead of hand-rolled fetchWithAuthRetry +
// consumeSSE. sseRequest already owns Authorization injection, 401→refresh→reconnect-once,
// [DONE], 204, and AbortError semantics — this file is intentionally thin: build
// headers/body, call sseRequest, route each event into the Task 5 reducer (dispatchEvent),
// and translate SseOutcome into the run/attach call sites' error shapes.
import { sseRequest } from '@nimotech/nimoos-service'
import { dispatchEvent } from './dispatchEvent'
import type { StreamActions } from '../types'

function langHeader(): string {
  const raw = (localStorage.getItem('lang') || navigator.language || 'en')
  return raw.toLowerCase().replace(/-/g, '_')
}

// Starts (or continues) an agent run and streams its SSE events into `actions` via
// dispatchEvent. Resolves once the stream ends (ok or not) — never rejects: sseRequest's
// AbortError is swallowed (caller aborted on purpose), and any other outcome/rejection is
// surfaced through `onError` instead of a thrown promise, so callers can `await` this in a
// fire-and-forget style without a try/catch.
export async function runAgentRun(
  sessionId: string | number,
  body: Record<string, unknown>,
  providerType: string,
  signal: AbortSignal,
  actions: StreamActions,
  onError: (e: unknown) => void,
  extraHeaders: Record<string, string> = {},
): Promise<void> {
  const outcome = await sseRequest(`/v1/ai/agent/sessions/${sessionId}/run`, {
    method: 'POST',
    body,
    signal,
    headers: { Language: langHeader(), 'X-Agent-Provider-Type': providerType, ...extraHeaders },
    onEvent: evt => dispatchEvent(evt as Record<string, unknown>, actions),
  }).catch(e => { if ((e as Error)?.name !== 'AbortError') onError(e); return null })
  if (!outcome) return // aborted, or a non-abort rejection already reported via onError
  if (!outcome.ok) onError({ status: outcome.status, body: outcome.errorBody })
}

// Attaches to an already-running agent run's SSE stream (page reload / session switch
// mid-run) and routes events into `actions`. 204/non-ok means "nothing to attach to" —
// not an error the caller needs to react to beyond not showing a live stream.
export async function attachAgentStream(
  sessionId: string | number,
  signal: AbortSignal,
  actions: StreamActions,
): Promise<{ attached: boolean; error?: unknown }> {
  try {
    const outcome = await sseRequest(`/v1/ai/agent/sessions/${sessionId}/run-stream`, {
      method: 'GET',
      signal,
      onEvent: evt => dispatchEvent(evt as Record<string, unknown>, actions),
    })
    if (outcome.noContent || !outcome.ok) {
      return { attached: false, error: outcome.ok ? undefined : outcome.error ?? { status: outcome.status } }
    }
    return { attached: true }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return { attached: false }
    return { attached: false, error: e }
  }
}
