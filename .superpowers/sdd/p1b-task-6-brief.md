### Task 6: Transport — `runAgentRun` + `attachAgentStream` on `sseRequest`

**Files:**
- Create: `src/ai/services/agentTransport.ts` + `src/ai/services/agentTransport.test.ts`

**Interfaces:**
- Consumes: shared `sseRequest`/`SseOutcome` (Task 1), Task 5 `dispatchEvent`, Task 4 `StreamActions`.
- Produces:
  - `runAgentRun(sessionId, body, providerType, signal, actions, onError, extraHeaders): Promise<void>` — POST `/v1/ai/agent/sessions/{id}/run` via `sseRequest`; on `!ok` calls `onError({ status, body: outcome.errorBody })`; AbortError swallowed. Consumed by Task 7 `send`/`continueRun`.
  - `attachAgentStream(sessionId, signal, actions): Promise<{ attached: boolean; error?: unknown }>` — GET `/v1/ai/agent/sessions/{id}/run-stream` via `sseRequest`; `204`/non-ok → `{attached:false}`; ok → `{attached:true}`. Consumed by Task 7 `selectSession`.

- [ ] **Step 1: Write `agentTransport.test.ts`** with a mock `sseRequest` (via `vi.mock('@nimotech/nimoos-service', …)`). Cases:
  - `runAgentRun` builds `Language` header (from `localStorage.lang`/navigator), `X-Agent-Provider-Type`, spreads `extraHeaders`, POSTs JSON body, routes events to `dispatchEvent`.
  - `runAgentRun` on `sseRequest` returning `{ok:false,status:500,errorBody:{message:'x'}}` calls `onError({status:500, body:{message:'x'}})`.
  - `attachAgentStream` on `{ok:true,noContent:true,status:204}` → `{attached:false}`.
  - `attachAgentStream` on `{ok:true,status:200}` → `{attached:true}`.
  - AbortError from `sseRequest` (rethrown) → `runAgentRun` swallows; `attachAgentStream` → `{attached:false}`.

- [ ] **Step 2: Run, verify fail** — `pnpm test -- agentTransport` → FAIL.

- [ ] **Step 3: Implement `agentTransport.ts`.** Port the intent of `agentStream.js:570-650` but on `sseRequest` (the shared helper already does token/401/refresh/[DONE]/204/abort — so DROP `fetchWithAuthRetry`, `consumeSSE`, raw `fetch`). Skeleton:

```ts
import { sseRequest } from '@nimotech/nimoos-service'
import { dispatchEvent } from './dispatchEvent'
import type { StreamActions } from '../types'

function langHeader(): string {
  const raw = (localStorage.getItem('lang') || navigator.language || 'en')
  return raw.toLowerCase().replace(/-/g, '_')
}

export async function runAgentRun(
  sessionId: string | number, body: Record<string, unknown>, providerType: string,
  signal: AbortSignal, actions: StreamActions,
  onError: (e: unknown) => void, extraHeaders: Record<string, string> = {},
): Promise<void> {
  const outcome = await sseRequest(`/v1/ai/agent/sessions/${sessionId}/run`, {
    method: 'POST', body, signal,
    headers: { Language: langHeader(), 'X-Agent-Provider-Type': providerType, ...extraHeaders },
    onEvent: evt => dispatchEvent(evt as Record<string, unknown>, actions),
  }).catch(e => { if ((e as Error)?.name !== 'AbortError') onError(e); return null })
  if (!outcome) return                      // aborted or rejected non-abort (already reported)
  if (!outcome.ok) onError({ status: outcome.status, body: outcome.errorBody })
}

export async function attachAgentStream(
  sessionId: string | number, signal: AbortSignal, actions: StreamActions,
): Promise<{ attached: boolean; error?: unknown }> {
  try {
    const outcome = await sseRequest(`/v1/ai/agent/sessions/${sessionId}/run-stream`, {
      method: 'GET', signal,
      onEvent: evt => dispatchEvent(evt as Record<string, unknown>, actions),
    })
    if (outcome.noContent || !outcome.ok) return { attached: false, error: outcome.ok ? undefined : outcome.error ?? { status: outcome.status } }
    return { attached: true }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return { attached: false }
    return { attached: false, error: e }
  }
}
```

Note: `Authorization` + 401 refresh are handled inside `sseRequest` (Task 1) — do NOT re-add them here.

- [ ] **Step 4: Run, verify pass** — `pnpm test -- agentTransport` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ai/services/agentTransport.ts src/ai/services/agentTransport.test.ts
git commit -m "SP8-P1b: agentTransport run/attach on shared sseRequest (errorBody-aware)"
```

---

