// SP8-P3b Task 2 — align with Vue2 src/views/AI/Skills/TestPanel.vue:160-172 SSE event reduction logic.
//
// Vue2 pushes a new string to output.steps every time it receives a message/message_delta/text chunk
// (:162 `this.output.steps.push(ev.content)`); when streaming word-by-word, the result list explodes
// with many individual characters/words on separate lines instead of continuous text. The backend sends
// message_delta word-by-word (NimoOS-AI/agent/agent.py:1266,1284), and Vue2 here has not adapted.
// [Agreed to deviate from D2, see p3b-common-constraints.md §3.1] This repo changes to: if a continuous
// text chunk follows a text step, append the new content to the same step; tool calls (tool_call) still
// start on separate lines.
//
// Pure function: does not read the clock (elapsedMs is passed by caller for testing convenience),
// does not modify the passed state in place. Returns a new object each time (including the steps
// array itself; returning a new reference even if content is unchanged is acceptable — but to avoid
// unnecessary object churn, the unchanged path returns the input s unchanged).
//
// Do not implement `tokens`: Vue2 template TestPanel.vue:70-73 has an `output.tokens != null` branch,
// but `output.tokens` is never assigned anywhere in the component (initialized to null in `data()` then
// no more writes) — it is a dead branch. Following the pattern of handling trigger_human in P3a, we do
// not replicate this field here; SandboxState type has no tokens, and .test.ts has a probe assertion
// pinning down this fact.

export type SandboxStep = { kind: 'text' | 'tool'; text: string }

// [P3b final review I2] `failed` and `error` decoupled. Design §5 states "error = String(ev.content
// ?? '') (empty leaves it empty, UI fills in localized fallback text)" — this reducer has always followed
// this, but before this change the state had no independent failure flag, so TestPanel could only use
// `sandbox.error` being non-empty to determine "failed". The backend sends `{"type":"error","content": str(e)}`
// (NimoOS-AI/agent/agent.py:999); for some exceptions (like exceptions constructed without a message),
// str(e) is an empty string — then `error === ''`, and consumers would misclassify a real failure as success.
// `failed` is set to true only when an `error` event is received, completely independent of whether the
// content text is empty; `error` continues to only carry "whether to display the raw backend response".
export type SandboxState = {
  steps: SandboxStep[]
  ms: number | null
  error: string
  failed: boolean
  done: boolean
}

export function initSandboxState(): SandboxState {
  return { steps: [], ms: null, error: '', failed: false, done: false }
}

/**
 * Align with Vue2 TestPanel.vue run() onEvent callback (:158-172).
 * Event selection/rejection: ignores thinking/tool_result/confirmation_required
 * and other event types. Returns a new SandboxState, does not modify input s or s.steps.
 */
export function reduceSandboxEvent(
  s: SandboxState,
  ev: Record<string, unknown>,
  elapsedMs: number
): SandboxState {
  const type = ev.type

  if (type === 'message_delta' || type === 'message' || type === 'text') {
    const content = ev.content
    if (typeof content !== 'string' || content === '') return s
    const steps = s.steps.slice()
    const last = steps[steps.length - 1]
    if (last && last.kind === 'text') {
      steps[steps.length - 1] = { kind: 'text', text: last.text + content }
    } else {
      steps.push({ kind: 'text', text: content })
    }
    return { ...s, steps }
  }

  if (type === 'tool_call') {
    const name = (ev.tool as string | undefined) ?? (ev.name as string | undefined) ?? 'tool'
    const steps = s.steps.slice()
    steps.push({ kind: 'tool', text: '→ ' + name })
    return { ...s, steps }
  }

  if (type === 'error') {
    // failed=true is set unconditionally (independent of whether content is empty, see type annotation above — P3b final review I2).
    return { ...s, error: String(ev.content ?? ''), failed: true }
  }

  if (type === 'done') {
    return { ...s, done: true, ms: elapsedMs }
  }

  return s
}
