import { describe, it, expect } from 'vitest'
import { initSandboxState, reduceSandboxEvent, type SandboxState } from './sandboxRun'

describe('sandboxRun', () => {
  it('initSandboxState starts empty/idle', () => {
    expect(initSandboxState()).toEqual({ steps: [], ms: null, error: '', done: false })
  })

  it('two consecutive message_delta merge into one step, text appended in order', () => {
    let s = initSandboxState()
    s = reduceSandboxEvent(s, { type: 'message_delta', content: 'Hel' }, 0)
    s = reduceSandboxEvent(s, { type: 'message_delta', content: 'lo' }, 0)
    expect(s.steps).toEqual([{ kind: 'text', text: 'Hello' }])
  })

  it('text and message also participate in the same accumulation', () => {
    let s = initSandboxState()
    s = reduceSandboxEvent(s, { type: 'message_delta', content: 'A' }, 0)
    s = reduceSandboxEvent(s, { type: 'message', content: 'B' }, 0)
    s = reduceSandboxEvent(s, { type: 'text', content: 'C' }, 0)
    expect(s.steps).toEqual([{ kind: 'text', text: 'ABC' }])
  })

  it('text -> tool_call -> text yields 3 steps, 3rd is a new text step', () => {
    let s = initSandboxState()
    s = reduceSandboxEvent(s, { type: 'text', content: 'before' }, 0)
    s = reduceSandboxEvent(s, { type: 'tool_call', tool: 'grep' }, 0)
    s = reduceSandboxEvent(s, { type: 'text', content: 'after' }, 0)
    expect(s.steps).toEqual([
      { kind: 'text', text: 'before' },
      { kind: 'tool', text: '→ grep' },
      { kind: 'text', text: 'after' },
    ])
  })

  it('tool_call without ev.tool falls back to ev.name', () => {
    let s = initSandboxState()
    s = reduceSandboxEvent(s, { type: 'tool_call', name: 'search_files' }, 0)
    expect(s.steps).toEqual([{ kind: 'tool', text: '→ search_files' }])
  })

  it('tool_call with neither tool nor name falls back to the literal "tool"', () => {
    let s = initSandboxState()
    s = reduceSandboxEvent(s, { type: 'tool_call' }, 0)
    expect(s.steps).toEqual([{ kind: 'tool', text: '→ tool' }])
  })

  it('error event writes error', () => {
    let s = initSandboxState()
    s = reduceSandboxEvent(s, { type: 'error', content: 'sandbox exploded' }, 0)
    expect(s.error).toBe('sandbox exploded')
  })

  it('error event with no content writes empty string, not "null"/"undefined"', () => {
    let s = initSandboxState()
    s = reduceSandboxEvent(s, { type: 'error' }, 0)
    expect(s.error).toBe('')
  })

  it('done event writes done and ms from the caller-supplied elapsedMs', () => {
    let s = initSandboxState()
    s = reduceSandboxEvent(s, { type: 'text', content: 'x' }, 0)
    s = reduceSandboxEvent(s, { type: 'done' }, 4242)
    expect(s.done).toBe(true)
    expect(s.ms).toBe(4242)
  })

  it('unknown event type leaves state unchanged (same reference)', () => {
    const s = initSandboxState()
    const next = reduceSandboxEvent(s, { type: 'thinking', content: 'hmm' }, 0)
    expect(next).toBe(s)
  })

  it('message_delta with empty string content leaves state unchanged', () => {
    const s = initSandboxState()
    const next = reduceSandboxEvent(s, { type: 'message_delta', content: '' }, 0)
    expect(next).toBe(s)
  })

  it('message_delta with non-string content leaves state unchanged', () => {
    const s = initSandboxState()
    const next = reduceSandboxEvent(s, { type: 'message_delta', content: 123 }, 0)
    expect(next).toBe(s)
  })

  it('does not mutate the input state object in place', () => {
    const s = initSandboxState()
    const originalSteps = s.steps
    reduceSandboxEvent(s, { type: 'text', content: 'hello' }, 0)
    // Original object passed in must be untouched: same array reference, still empty.
    expect(s.steps).toBe(originalSteps)
    expect(s.steps.length).toBe(0)
  })

  it('does not mutate an input state that already has steps (array not shared)', () => {
    let s = initSandboxState()
    s = reduceSandboxEvent(s, { type: 'text', content: 'first' }, 0)
    const before = s.steps
    const beforeLength = before.length
    reduceSandboxEvent(s, { type: 'text', content: 'more' }, 0)
    expect(s.steps).toBe(before)
    expect(s.steps.length).toBe(beforeLength)
  })

  // RED-probe style regression: Vue2 TestPanel.vue:70-73 has an `output.tokens != null`
  // template branch, but `output.tokens` is never assigned anywhere in that component —
  // a dead branch. We deliberately do not carry a `tokens` field on SandboxState. This
  // pins that decision: even if a `done` event arrives with a `tokens` payload, the
  // resulting state must not gain a `tokens` property.
  it('does not add a tokens field even if the done event carries one (dead Vue2 branch, not ported)', () => {
    let s = initSandboxState()
    s = reduceSandboxEvent(s, { type: 'done', tokens: 999 }, 10)
    expect('tokens' in (s as unknown as Record<string, unknown>)).toBe(false)
    // Type-level pin: SandboxState has no tokens field, so this would not compile if added.
    const check: SandboxState = s
    expect(check.done).toBe(true)
  })
})
