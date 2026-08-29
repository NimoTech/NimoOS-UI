import { describe, it, expect, vi } from 'vitest'
import { dispatchEvent } from './dispatchEvent'

function actions() {
  return {
    appendBlock: vi.fn(), patchBlock: vi.fn(() => true), pushActivityStep: vi.fn(),
    markRunningStepDone: vi.fn(), setStreamingDone: vi.fn(), pushUserMessage: vi.fn(),
    startAssistant: vi.fn(),
  } as never
}

describe('dispatchEvent -- MCP elicitation', () => {
  it('mcp_elicit_form maps to a form block (field names match the backend _form_card)', () => {
    const a = actions()
    dispatchEvent({
      type: 'confirmation_required', kind: 'mcp_elicit_form',
      confirm_id: 'c1', server: 'brave', message: 'please fill in',
      fields: [{ key: 'name', type: 'string' }], error: 'too short',
    }, a)
    expect((a as any).appendBlock).toHaveBeenCalledWith({
      type: 'mcp_elicit_form', confirmId: 'c1', server: 'brave', message: 'please fill in',
      fields: [{ key: 'name', type: 'string' }], error: 'too short',
    })
  })

  it('normalizes a non-array fields to an empty array', () => {
    const a = actions()
    dispatchEvent({ type: 'confirmation_required', kind: 'mcp_elicit_form', confirm_id: 'c1' }, a)
    expect((a as any).appendBlock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mcp_elicit_form', fields: [], error: '' }),
    )
  })

  it('mcp_elicit_url maps to a URL block, renaming host_ascii to hostAscii', () => {
    const a = actions()
    dispatchEvent({
      type: 'confirmation_required', kind: 'mcp_elicit_url',
      confirm_id: 'c2', server: 'notion', message: 'please authorize',
      url: 'https://x.example/a', host: 'x.example',
      punycode: true, host_ascii: 'xn--x.example', insecure: false,
    }, a)
    expect((a as any).appendBlock).toHaveBeenCalledWith({
      type: 'mcp_elicit_url', confirmId: 'c2', server: 'notion', message: 'please authorize',
      url: 'https://x.example/a', host: 'x.example',
      hostAscii: 'xn--x.example', punycode: true, insecure: false,
    })
  })

  it('an unknown kind still falls through to the existing generic confirm branch (not swallowed by the two new branches)', () => {
    const a = actions()
    dispatchEvent({ type: 'confirmation_required', kind: 'something_else', confirm_id: 'c3' }, a)
    expect((a as any).appendBlock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'confirm', confirmId: 'c3' }),
    )
  })
})
