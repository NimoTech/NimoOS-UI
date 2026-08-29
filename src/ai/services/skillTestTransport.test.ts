// Mock skeleton copied from ./agentTransport.test.ts:1-19 (SP8-P1b, reviewed) — mocks
// sseRequest itself (not fetch), matching the "follow its shape" instruction in
// p3b-task-3-brief.md. sseRequest's own fetch/401/[DONE]/framing behavior is exercised by
// `the shared service package's src/sse.test.ts` and is out of scope here.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const sseRequestMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  sseRequest: (...args: unknown[]) => sseRequestMock(...args),
}))

import { runSkillTest } from './skillTestTransport'

describe('runSkillTest', () => {
  beforeEach(() => {
    sseRequestMock.mockReset()
  })

  it('POSTs to the skill-test endpoint with encodeURIComponent(id), { prompt, network: false } body, and no Language header', async () => {
    sseRequestMock.mockResolvedValue({ ok: true, status: 200 })
    const onEvent = vi.fn()
    const onError = vi.fn()
    const signal = new AbortController().signal

    await runSkillTest('my skill/id', 'hello there', signal, onEvent, onError)

    expect(sseRequestMock).toHaveBeenCalledTimes(1)
    const [path, opts] = sseRequestMock.mock.calls[0]
    expect(path).toBe(`/v1/ai/skills/${encodeURIComponent('my skill/id')}/test`)
    expect(opts.method).toBe('POST')
    expect(opts.body).toEqual({ prompt: 'hello there', network: false })
    expect(opts.signal).toBe(signal)
    // Pin down "does not diverge without reason": Vue2 streamSkillTest (ai.js:204-258) never sent
    // Language header, this file doesn't add one either (unlike runAgentRun, which adds it because
    // its Vue2 blueprint did).
    expect(opts.headers ?? {}).not.toHaveProperty('Language')
    expect(onError).not.toHaveBeenCalled()
  })

  it('forwards every SSE event to onEvent verbatim, in order, with zero reduction', async () => {
    let capturedOnEvent: ((evt: unknown) => void) | undefined
    sseRequestMock.mockImplementation(async (_path: string, opts: any) => {
      capturedOnEvent = opts.onEvent
      return { ok: true, status: 200 }
    })
    const onEvent = vi.fn()
    await runSkillTest('sk-1', 'p', new AbortController().signal, onEvent, vi.fn())

    const e1 = { type: 'message_delta', content: 'a' }
    const e2 = { type: 'message_delta', content: 'b' }
    const e3 = { type: 'tool_call', name: 'run_shell' }
    capturedOnEvent!(e1)
    capturedOnEvent!(e2)
    capturedOnEvent!(e3)

    expect(onEvent).toHaveBeenCalledTimes(3)
    expect(onEvent.mock.calls.map(c => c[0])).toEqual([e1, e2, e3])
  })

  it('on !ok calls onError with {status, body: errorBody} and never calls onEvent', async () => {
    sseRequestMock.mockResolvedValue({ ok: false, status: 422, errorBody: { detail: 'missing provider header' } })
    const onEvent = vi.fn()
    const onError = vi.fn()
    await runSkillTest('sk-1', 'p', new AbortController().signal, onEvent, onError)

    expect(onError).toHaveBeenCalledWith({ status: 422, body: { detail: 'missing provider header' } })
    expect(onEvent).not.toHaveBeenCalled()
  })

  it('swallows AbortError from sseRequest silently — onError never called, promise resolves (does not throw)', async () => {
    const abortErr = new Error('aborted')
    abortErr.name = 'AbortError'
    sseRequestMock.mockRejectedValue(abortErr)
    const onEvent = vi.fn()
    const onError = vi.fn()

    await expect(
      runSkillTest('sk-1', 'p', new AbortController().signal, onEvent, onError),
    ).resolves.toBeUndefined()
    expect(onError).not.toHaveBeenCalled()
    expect(onEvent).not.toHaveBeenCalled()
  })

  it('reports a non-abort rejection to onError and does not throw', async () => {
    const err = new Error('network down')
    sseRequestMock.mockRejectedValue(err)
    const onEvent = vi.fn()
    const onError = vi.fn()

    await expect(
      runSkillTest('sk-1', 'p', new AbortController().signal, onEvent, onError),
    ).resolves.toBeUndefined()
    expect(onError).toHaveBeenCalledWith(err)
    expect(onEvent).not.toHaveBeenCalled()
  })
})
