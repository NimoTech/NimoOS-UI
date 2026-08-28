// Thin SSE transport for the sandbox skill-test runner (independent test panel outside of "try in conversation").
// Shape copied from ./agentTransport.ts:21-39 (SP8-P1b, reviewed) — sseRequest already owns
// Authorization injection, 401→refresh→reconnect-once, [DONE], 204, and AbortError semantics
// (@nimotech/nimoos-service; see the shared service package's src/sse.ts). This file re-implements
// none of that: it only builds the endpoint/body, calls sseRequest, and forwards each parsed
// event verbatim to onEvent. Event semantics (accumulating text deltas, step reduction, i18n
// error text) belong to the consumer (Task 4 TestPanel.vue via sandboxRun.ts), not here.
//
// Endpoint/body/headers ported from Vue2 src/service/ai.js:204-258 (streamSkillTest):
//   POST /v1/ai/skills/${encodeURIComponent(id)}/test, body { prompt, network: false }.
// Deliberately NOT sending a `Language` header: runAgentRun (agentTransport.ts:34) sends one
// only because its Vue2 counterpart agentStream.js does; streamSkillTest (ai.js:204-258) never
// sent one, so adding it here would be an unrequested deviation from the Vue2 blueprint.
//
// KNOWN BACKEND GAP — this endpoint returns 422 on a real device today. Not a bug in this
// file; it's a pre-existing backend ticket the user chose to defer past this sprint
// (2026-07-30: ship the frontend now, fix the backend later). Three-part root cause,
// verified against source on 2026-07-30:
//   1. NimoOS-AI/agent/main.py:2477-2484 — the Python `/agent/sandbox-run` endpoint declares
//      `x_agent_provider_key`/`x_agent_provider_url` as required FastAPI Header(...) params
//      (no default), so a request missing either header is rejected by FastAPI's own
//      validation with 422 before any handler code runs.
//   2. NimoOS-AI/route/v2/skills_files.go:154-160 — the Go `TestStream` handler only
//      forwards X-Agent-Provider-{Key,Url,Type} to the Python service *if the browser already
//      sent them*; it never resolves/injects a provider itself. Contrast route/v2/agent.go:
//      124-146, which the normal chat run path uses to resolve the active provider (OpenVINO
//      / Ollama / configured cloud key) and `c.Request().Header.Set(...)` it in before
//      proxying — TestStream has no equivalent step.
//   3. The Vue2 frontend (src/service/ai.js:204-258, streamSkillTest) never sent these headers
//      either, so this has never worked end-to-end in either UI generation.
// Net effect: with no browser-sent provider headers and no server-side injection, the Python
// endpoint's required-header validation always fails → 422. Do not "fix" this by fabricating
// provider headers client-side or by patching the backend as a side effect of this task —
// out of scope per p3b-common-constraints.md §4 and the user's 2026-07-30 decision.
import { sseRequest } from '@nimotech/nimoos-service'

export async function runSkillTest(
  skillId: string,
  prompt: string,
  signal: AbortSignal,
  onEvent: (ev: Record<string, unknown>) => void,
  onError: (e: unknown) => void,
): Promise<void> {
  const outcome = await sseRequest(`/v1/ai/skills/${encodeURIComponent(skillId)}/test`, {
    method: 'POST',
    body: { prompt, network: false },
    signal,
    onEvent: evt => onEvent(evt as Record<string, unknown>),
  }).catch(e => { if ((e as Error)?.name !== 'AbortError') onError(e); return null })
  if (!outcome) return // aborted, or a non-abort rejection already reported via onError
  if (!outcome.ok) onError({ status: outcome.status, body: outcome.errorBody })
}
