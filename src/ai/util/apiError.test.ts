import { describe, it, expect } from 'vitest'
import { apiErrorMessage } from './apiError'

describe('apiErrorMessage', () => {
  it('prioritize response.data.message', () => {
    const e = { response: { data: { message: 'backend failed' } }, message: 'axios failed' }
    expect(apiErrorMessage(e, 'fallback')).toBe('backend failed')
  })

  it('use response.data directly when it is a string', () => {
    expect(apiErrorMessage({ response: { data: 'plain text error' } }, 'fallback')).toBe('plain text error')
  })

  // [Fixed after an earlier reported defect] Original assertion pinned Vue2
  // BlacklistSection.vue:82 "object = JSON.stringify" behavior — when user failed to add a bot in Channels,
  // the interface directly showed the raw `{"detail":"bot token rejected"}`, explicitly requesting "do not
  // directly put the returned JSON on screen". **Intentionally different from Vue2**: completely remove the
  // path of serializing the entire response body, recognize unrecognized cases, then fall to error.message,
  // and finally fall to the caller's localized fallback text.
  it('when response.data is an unrecognized object, do not JSON serialize, fall to fallback (intentionally different from Vue2 :82)', () => {
    expect(apiErrorMessage({ response: { data: { code: 42 } } }, 'fallback')).toBe('fallback')
    // When axios has its own message, use it first (call chain order unchanged)
    expect(apiErrorMessage({ response: { data: { code: 42 } }, message: 'Request failed' }, 'fallback'))
      .toBe('Request failed')
  })

  // FastAPI (Python agent, `:8282`) puts errors in `detail`, while Go services use `message`.
  // Original implementation only recognized message, so detail always fell into JSON serialization fallback — this was the direct cause of the defect.
  it('recognize FastAPI detail field (Python agent error shape)', () => {
    expect(apiErrorMessage({ response: { data: { detail: 'instance not found' } } }, 'fallback'))
      .toBe('instance not found')
  })

  it('when both message and detail exist, message takes precedence (Go service priority)', () => {
    expect(apiErrorMessage({ response: { data: { message: 'from Go', detail: 'from py' } } }, 'fallback'))
      .toBe('from Go')
  })

  it('when there is no response, fall back to error.message', () => {
    expect(apiErrorMessage(new Error('network dropped'), 'fallback')).toBe('network dropped')
  })

  it('use fallback when nothing else is available', () => {
    expect(apiErrorMessage({}, 'fallback')).toBe('fallback')
    expect(apiErrorMessage(null, 'fallback')).toBe('fallback')
    expect(apiErrorMessage(undefined, 'fallback')).toBe('fallback')
  })

  it('empty string is not a valid message, fall back to the next level', () => {
    expect(apiErrorMessage({ response: { data: '' }, message: 'axios failed' }, 'fallback')).toBe('axios failed')
    expect(apiErrorMessage({ message: '' }, 'fallback')).toBe('fallback')
  })
})
