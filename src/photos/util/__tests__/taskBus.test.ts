import { describe, it, expect } from 'vitest'
import { unwrapTaskBusPayload } from '../taskBus'

describe('unwrapTaskBusPayload', () => {
  it('returns null for non-object / nullish input', () => {
    expect(unwrapTaskBusPayload(null)).toBeNull()
    expect(unwrapTaskBusPayload(undefined)).toBeNull()
    expect(unwrapTaskBusPayload('nope')).toBeNull()
    expect(unwrapTaskBusPayload(42)).toBeNull()
  })

  it('returns the payload as-is when already flat (has id+status, no Properties envelope)', () => {
    const flat = { id: 't1', status: 'running', current: 3, total: 10 }
    expect(unwrapTaskBusPayload(flat)).toBe(flat)
  })

  it('returns null when Properties is missing or not an object', () => {
    expect(unwrapTaskBusPayload({ SourceID: 'x', Name: 'y' })).toBeNull()
    expect(unwrapTaskBusPayload({ Properties: 'not-an-object' })).toBeNull()
  })

  it('converts numeric string fields to numbers from a MessageBus envelope', () => {
    const evt = {
      SourceID: 'photos',
      Name: 'task:progress',
      Properties: {
        id: 'idx-1',
        type: 'index',
        label: 'Indexing',
        status: 'running',
        started_at: '2026-07-23T00:00:00Z',
        current: '42',
        total: '100',
        added: '7',
        progress: '0.42',
        eta_seconds: '30',
      },
    }
    const out = unwrapTaskBusPayload(evt)
    expect(out).toEqual({
      id: 'idx-1',
      type: 'index',
      label: 'Indexing',
      status: 'running',
      started_at: '2026-07-23T00:00:00Z',
      current: 42,
      total: 100,
      added: 7,
      progress: 0.42,
      eta_seconds: 30,
    })
  })

  it('omits numeric fields entirely when absent from Properties (not coerced to NaN/0)', () => {
    const out = unwrapTaskBusPayload({ Properties: { id: 'x', status: 'done' } })
    expect(out).not.toBeNull()
    expect(out).not.toHaveProperty('current')
    expect(out).not.toHaveProperty('total')
    expect(out).not.toHaveProperty('added')
    expect(out).not.toHaveProperty('progress')
    expect(out).not.toHaveProperty('eta_seconds')
  })

  it('passes through error/errorKey only when truthy', () => {
    const withError = unwrapTaskBusPayload({ Properties: { id: 'x', status: 'error', error: 'boom' } })
    expect(withError?.error).toBe('boom')

    const withoutError = unwrapTaskBusPayload({ Properties: { id: 'x', status: 'done', error: '' } })
    expect(withoutError).not.toHaveProperty('error')
  })

  it('JSON-parses errorParams, and drops it (sets undefined) on invalid JSON', () => {
    const ok = unwrapTaskBusPayload({
      Properties: { id: 'x', status: 'error', errorParams: '{"count":3}' },
    })
    expect(ok?.errorParams).toEqual({ count: 3 })

    const bad = unwrapTaskBusPayload({
      Properties: { id: 'x', status: 'error', errorParams: '{not-json' },
    })
    expect(bad).toHaveProperty('errorParams')
    expect(bad?.errorParams).toBeUndefined()
  })
})
