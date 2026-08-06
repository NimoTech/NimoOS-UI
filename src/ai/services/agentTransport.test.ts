// TDD spec for Task 6 (SP8-P1b): runAgentRun / attachAgentStream on shared sseRequest.
// sseRequest itself (token injection, 401→refresh→reconnect-once, [DONE], 204, AbortError
// semantics) is owned by @nimotech/nimoos-service (Task 1) — this transport is a thin
// wrapper: build headers/body, call sseRequest, route onEvent into dispatchEvent, and
// map SseOutcome → onError / {attached}. We mock sseRequest itself, not fetch.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const sseRequestMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  sseRequest: (...args: unknown[]) => sseRequestMock(...args),
}))

vi.mock('./dispatchEvent', () => ({
  dispatchEvent: vi.fn(),
}))

import { runAgentRun, attachAgentStream } from './agentTransport'
import { dispatchEvent } from './dispatchEvent'
import type { StreamActions } from '../types'

function makeActions(): StreamActions {
  return {
    pushUserMessage: vi.fn(),
    startAssistant: vi.fn(),
    appendBlock: vi.fn(),
    patchBlock: vi.fn(() => false),
    setStreamingDone: vi.fn(),
    setBusy: vi.fn(),
    patchAssistantStats: vi.fn(),
    pushActivityStep: vi.fn(),
    markRunningStepDone: vi.fn(),
  }
}

describe('agentTransport', () => {
  beforeEach(() => {
    sseRequestMock.mockReset()
    ;(dispatchEvent as ReturnType<typeof vi.fn>).mockReset()
    localStorage.clear()
  })

  describe('runAgentRun', () => {
    it('POSTs to the run endpoint with Language/provider-type headers, extraHeaders spread, and JSON body', async () => {
      localStorage.setItem('lang', 'en-US')
      sseRequestMock.mockResolvedValue({ ok: true, status: 200 })
      const actions = makeActions()
      const onError = vi.fn()
      const body = { message: 'hi' }
      const signal = new AbortController().signal

      await runAgentRun('sess-1', body, 'anthropic', signal, actions, onError, { 'X-Trace': 't1' })

      expect(sseRequestMock).toHaveBeenCalledTimes(1)
      const [path, opts] = sseRequestMock.mock.calls[0]
      expect(path).toBe('/v1/ai/agent/sessions/sess-1/run')
      expect(opts.method).toBe('POST')
      expect(opts.body).toBe(body)
      expect(opts.signal).toBe(signal)
      expect(opts.headers).toEqual({
        Language: 'en_us',
        'X-Agent-Provider-Type': 'anthropic',
        'X-Trace': 't1',
      })
      expect(typeof opts.onEvent).toBe('function')
      expect(onError).not.toHaveBeenCalled()
    })

    it('falls back to navigator.language when no lang is stored, lowercased with dashes to underscores', async () => {
      sseRequestMock.mockResolvedValue({ ok: true, status: 200 })
      const actions = makeActions()
      await runAgentRun('sess-1', {}, 'openai', new AbortController().signal, actions, vi.fn())
      const opts = sseRequestMock.mock.calls[0][1]
      const expected = (navigator.language || 'en').toLowerCase().replace(/-/g, '_')
      expect(opts.headers.Language).toBe(expected)
    })

    it('routes onEvent calls to dispatchEvent with the same actions', async () => {
      let capturedOnEvent: ((evt: unknown) => void) | undefined
      sseRequestMock.mockImplementation(async (_path: string, opts: any) => {
        capturedOnEvent = opts.onEvent
        return { ok: true, status: 200 }
      })
      const actions = makeActions()
      await runAgentRun('sess-1', {}, 'openai', new AbortController().signal, actions, vi.fn())

      const evt = { type: 'message_delta', content: 'hi' }
      capturedOnEvent!(evt)
      expect(dispatchEvent).toHaveBeenCalledWith(evt, actions)
    })

    it('on !ok calls onError with {status, body: errorBody}', async () => {
      sseRequestMock.mockResolvedValue({ ok: false, status: 500, errorBody: { message: 'x' } })
      const actions = makeActions()
      const onError = vi.fn()
      await runAgentRun('sess-1', {}, 'openai', new AbortController().signal, actions, onError)
      expect(onError).toHaveBeenCalledWith({ status: 500, body: { message: 'x' } })
    })

    it('swallows AbortError from sseRequest without calling onError', async () => {
      const abortErr = new Error('aborted')
      abortErr.name = 'AbortError'
      sseRequestMock.mockRejectedValue(abortErr)
      const actions = makeActions()
      const onError = vi.fn()
      await expect(
        runAgentRun('sess-1', {}, 'openai', new AbortController().signal, actions, onError),
      ).resolves.toBeUndefined()
      expect(onError).not.toHaveBeenCalled()
    })

    it('reports non-abort rejections to onError and does not throw', async () => {
      const err = new Error('network down')
      sseRequestMock.mockRejectedValue(err)
      const actions = makeActions()
      const onError = vi.fn()
      await expect(
        runAgentRun('sess-1', {}, 'openai', new AbortController().signal, actions, onError),
      ).resolves.toBeUndefined()
      expect(onError).toHaveBeenCalledWith(err)
    })
  })

  describe('attachAgentStream', () => {
    it('GETs the run-stream endpoint and routes events to dispatchEvent', async () => {
      let capturedOnEvent: ((evt: unknown) => void) | undefined
      sseRequestMock.mockImplementation(async (_path: string, opts: any) => {
        capturedOnEvent = opts.onEvent
        return { ok: true, status: 200 }
      })
      const actions = makeActions()
      const signal = new AbortController().signal
      const result = await attachAgentStream('sess-2', signal, actions)

      expect(sseRequestMock).toHaveBeenCalledTimes(1)
      const [path, opts] = sseRequestMock.mock.calls[0]
      expect(path).toBe('/v1/ai/agent/sessions/sess-2/run-stream')
      expect(opts.method).toBe('GET')
      expect(opts.signal).toBe(signal)
      expect(result).toEqual({ attached: true })

      const evt = { type: 'done' }
      capturedOnEvent!(evt)
      expect(dispatchEvent).toHaveBeenCalledWith(evt, actions)
    })

    it('204/noContent → {attached:false}', async () => {
      sseRequestMock.mockResolvedValue({ ok: true, noContent: true, status: 204 })
      const actions = makeActions()
      const result = await attachAgentStream('sess-2', new AbortController().signal, actions)
      expect(result).toEqual({ attached: false })
    })

    it('ok:true, status 200 → {attached:true}', async () => {
      sseRequestMock.mockResolvedValue({ ok: true, status: 200 })
      const actions = makeActions()
      const result = await attachAgentStream('sess-2', new AbortController().signal, actions)
      expect(result).toEqual({ attached: true })
    })

    it('non-ok outcome → {attached:false, error}', async () => {
      sseRequestMock.mockResolvedValue({ ok: false, status: 500, error: 'boom' })
      const actions = makeActions()
      const result = await attachAgentStream('sess-2', new AbortController().signal, actions)
      expect(result).toEqual({ attached: false, error: 'boom' })
    })

    it('non-ok outcome with no error field falls back to {status}', async () => {
      sseRequestMock.mockResolvedValue({ ok: false, status: 503 })
      const actions = makeActions()
      const result = await attachAgentStream('sess-2', new AbortController().signal, actions)
      expect(result).toEqual({ attached: false, error: { status: 503 } })
    })

    it('AbortError thrown by sseRequest → {attached:false} (no error field)', async () => {
      const abortErr = new Error('aborted')
      abortErr.name = 'AbortError'
      sseRequestMock.mockRejectedValue(abortErr)
      const actions = makeActions()
      const result = await attachAgentStream('sess-2', new AbortController().signal, actions)
      expect(result).toEqual({ attached: false })
    })

    it('non-abort rejection → {attached:false, error}', async () => {
      const err = new Error('network down')
      sseRequestMock.mockRejectedValue(err)
      const actions = makeActions()
      const result = await attachAgentStream('sess-2', new AbortController().signal, actions)
      expect(result).toEqual({ attached: false, error: err })
    })
  })
})
