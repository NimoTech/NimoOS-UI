# Task 3 review package — f4a859d..HEAD

## commits
e1a53c7 sp8-ai P3b Task 3: sandbox skill-test SSE transport (skillTestTransport)

## diff --stat
 src/ai/services/skillTestTransport.test.ts | 95 ++++++++++++++++++++++++++++++
 src/ai/services/skillTestTransport.ts      | 52 ++++++++++++++++
 2 files changed, 147 insertions(+)

## diff -U10
diff --git a/src/ai/services/skillTestTransport.test.ts b/src/ai/services/skillTestTransport.test.ts
new file mode 100644
index 0000000..70a6010
--- /dev/null
+++ b/src/ai/services/skillTestTransport.test.ts
@@ -0,0 +1,95 @@
+// Mock skeleton copied from ./agentTransport.test.ts:1-19 (SP8-P1b, reviewed) — mocks
+// sseRequest itself (not fetch), matching the "照它的形状写" instruction in
+// p3b-task-3-brief.md. sseRequest's own fetch/401/[DONE]/framing behavior is exercised by
+// .sp8/NimoOS-Service/src/sse.test.ts and is out of scope here.
+import { describe, it, expect, vi, beforeEach } from 'vitest'
+
+const sseRequestMock = vi.fn()
+vi.mock('@nimotech/nimoos-service', () => ({
+  sseRequest: (...args: unknown[]) => sseRequestMock(...args),
+}))
+
+import { runSkillTest } from './skillTestTransport'
+
+describe('runSkillTest', () => {
+  beforeEach(() => {
+    sseRequestMock.mockReset()
+  })
+
+  it('POSTs to the skill-test endpoint with encodeURIComponent(id), { prompt, network: false } body, and no Language header', async () => {
+    sseRequestMock.mockResolvedValue({ ok: true, status: 200 })
+    const onEvent = vi.fn()
+    const onError = vi.fn()
+    const signal = new AbortController().signal
+
+    await runSkillTest('my skill/id', 'hello there', signal, onEvent, onError)
+
+    expect(sseRequestMock).toHaveBeenCalledTimes(1)
+    const [path, opts] = sseRequestMock.mock.calls[0]
+    expect(path).toBe(`/v1/ai/skills/${encodeURIComponent('my skill/id')}/test`)
+    expect(opts.method).toBe('POST')
+    expect(opts.body).toEqual({ prompt: 'hello there', network: false })
+    expect(opts.signal).toBe(signal)
+    // 钉住"不无端偏离":Vue2 streamSkillTest (ai.js:204-258) 从未发过 Language 头,
+    // 本文件也不加(与 runAgentRun 不同,runAgentRun 加是因为它的 Vue2 蓝本加了)。
+    expect(opts.headers ?? {}).not.toHaveProperty('Language')
+    expect(onError).not.toHaveBeenCalled()
+  })
+
+  it('forwards every SSE event to onEvent verbatim, in order, with zero reduction', async () => {
+    let capturedOnEvent: ((evt: unknown) => void) | undefined
+    sseRequestMock.mockImplementation(async (_path: string, opts: any) => {
+      capturedOnEvent = opts.onEvent
+      return { ok: true, status: 200 }
+    })
+    const onEvent = vi.fn()
+    await runSkillTest('sk-1', 'p', new AbortController().signal, onEvent, vi.fn())
+
+    const e1 = { type: 'message_delta', content: 'a' }
+    const e2 = { type: 'message_delta', content: 'b' }
+    const e3 = { type: 'tool_call', name: 'run_shell' }
+    capturedOnEvent!(e1)
+    capturedOnEvent!(e2)
+    capturedOnEvent!(e3)
+
+    expect(onEvent).toHaveBeenCalledTimes(3)
+    expect(onEvent.mock.calls.map(c => c[0])).toEqual([e1, e2, e3])
+  })
+
+  it('on !ok calls onError with {status, body: errorBody} and never calls onEvent', async () => {
+    sseRequestMock.mockResolvedValue({ ok: false, status: 422, errorBody: { detail: 'missing provider header' } })
+    const onEvent = vi.fn()
+    const onError = vi.fn()
+    await runSkillTest('sk-1', 'p', new AbortController().signal, onEvent, onError)
+
+    expect(onError).toHaveBeenCalledWith({ status: 422, body: { detail: 'missing provider header' } })
+    expect(onEvent).not.toHaveBeenCalled()
+  })
+
+  it('swallows AbortError from sseRequest silently — onError never called, promise resolves (does not throw)', async () => {
+    const abortErr = new Error('aborted')
+    abortErr.name = 'AbortError'
+    sseRequestMock.mockRejectedValue(abortErr)
+    const onEvent = vi.fn()
+    const onError = vi.fn()
+
+    await expect(
+      runSkillTest('sk-1', 'p', new AbortController().signal, onEvent, onError),
+    ).resolves.toBeUndefined()
+    expect(onError).not.toHaveBeenCalled()
+    expect(onEvent).not.toHaveBeenCalled()
+  })
+
+  it('reports a non-abort rejection to onError and does not throw', async () => {
+    const err = new Error('network down')
+    sseRequestMock.mockRejectedValue(err)
+    const onEvent = vi.fn()
+    const onError = vi.fn()
+
+    await expect(
+      runSkillTest('sk-1', 'p', new AbortController().signal, onEvent, onError),
+    ).resolves.toBeUndefined()
+    expect(onError).toHaveBeenCalledWith(err)
+    expect(onEvent).not.toHaveBeenCalled()
+  })
+})
diff --git a/src/ai/services/skillTestTransport.ts b/src/ai/services/skillTestTransport.ts
new file mode 100644
index 0000000..ae747b3
--- /dev/null
+++ b/src/ai/services/skillTestTransport.ts
@@ -0,0 +1,52 @@
+// Thin SSE transport for the sandbox skill-test runner ("在对话中试用"以外的独立测试面板).
+// Shape copied from ./agentTransport.ts:21-39 (SP8-P1b, reviewed) — sseRequest already owns
+// Authorization injection, 401→refresh→reconnect-once, [DONE], 204, and AbortError semantics
+// (@nimotech/nimoos-service, see .sp8/NimoOS-Service/src/sse.ts). This file re-implements
+// none of that: it only builds the endpoint/body, calls sseRequest, and forwards each parsed
+// event verbatim to onEvent. Event semantics (accumulating text deltas, step reduction, i18n
+// error text) belong to the consumer (Task 4 TestPanel.vue via sandboxRun.ts), not here.
+//
+// Endpoint/body/headers ported from Vue2 src/service/ai.js:204-258 (streamSkillTest):
+//   POST /v1/ai/skills/${encodeURIComponent(id)}/test, body { prompt, network: false }.
+// Deliberately NOT sending a `Language` header: runAgentRun (agentTransport.ts:34) sends one
+// only because its Vue2 counterpart agentStream.js does; streamSkillTest (ai.js:204-258) never
+// sent one, so adding it here would be an unrequested deviation from the Vue2 blueprint.
+//
+// KNOWN BACKEND GAP — this endpoint returns 422 on a real device today. Not a bug in this
+// file; it's a pre-existing backend ticket the user chose to defer past this sprint
+// (2026-07-30: ship the frontend now, fix the backend later). Three-part root cause,
+// verified against source on 2026-07-30:
+//   1. NimoOS-AI/agent/main.py:2477-2484 — the Python `/agent/sandbox-run` endpoint declares
+//      `x_agent_provider_key`/`x_agent_provider_url` as required FastAPI Header(...) params
+//      (no default), so a request missing either header is rejected by FastAPI's own
+//      validation with 422 before any handler code runs.
+//   2. NimoOS-AI/route/v2/skills_files.go:154-160 — the Go `TestStream` handler only
+//      forwards X-Agent-Provider-{Key,Url,Type} to the Python service *if the browser already
+//      sent them*; it never resolves/injects a provider itself. Contrast route/v2/agent.go:
+//      124-146, which the normal chat run path uses to resolve the active provider (OpenVINO
+//      / Ollama / configured cloud key) and `c.Request().Header.Set(...)` it in before
+//      proxying — TestStream has no equivalent step.
+//   3. The Vue2 frontend (src/service/ai.js:204-258, streamSkillTest) never sent these headers
+//      either, so this has never worked end-to-end in either UI generation.
+// Net effect: with no browser-sent provider headers and no server-side injection, the Python
+// endpoint's required-header validation always fails → 422. Do not "fix" this by fabricating
+// provider headers client-side or by patching the backend as a side effect of this task —
+// out of scope per p3b-common-constraints.md §4 and the user's 2026-07-30 decision.
+import { sseRequest } from '@nimotech/nimoos-service'
+
+export async function runSkillTest(
+  skillId: string,
+  prompt: string,
+  signal: AbortSignal,
+  onEvent: (ev: Record<string, unknown>) => void,
+  onError: (e: unknown) => void,
+): Promise<void> {
+  const outcome = await sseRequest(`/v1/ai/skills/${encodeURIComponent(skillId)}/test`, {
+    method: 'POST',
+    body: { prompt, network: false },
+    signal,
+    onEvent: evt => onEvent(evt as Record<string, unknown>),
+  }).catch(e => { if ((e as Error)?.name !== 'AbortError') onError(e); return null })
+  if (!outcome) return // aborted, or a non-abort rejection already reported via onError
+  if (!outcome.ok) onError({ status: outcome.status, body: outcome.errorBody })
+}
