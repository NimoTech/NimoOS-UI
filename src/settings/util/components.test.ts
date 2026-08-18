import { describe, it, expect } from 'vitest'
import { groupComponents, statusHint } from './components'
import type { GatewayComponent } from '@nimotech/nimoos-service'

// Real-device fixture (2026-08-01 curl GET /v1/gateway/components, excerpt verbatim)
const REAL: GatewayComponent[] = [
  { name: 'Gateway', category: 'service', version: '1.9.3-alpha1+28.g0dc16d6', status: 'online', error: '', probed_at: '2026-08-01T02:15:55Z' },
  { name: 'User Service', category: 'service', version: '', status: 'offline', error: 'unexpected status Internal Server Error', probed_at: '2026-08-01T02:15:55Z' },
  { name: 'NimoOS UI', category: 'ui', version: '1.9.3-alpha1+20.g5c325a42-dirty', status: 'online', error: '', probed_at: '2026-08-01T02:15:55Z' },
  { name: 'Qdrant', category: 'external', version: '1.18.1', status: 'online', error: '', probed_at: '2026-08-01T02:15:55Z' },
]

describe('groupComponents', () => {
  it('groups in service / ui / external order', () => {
    expect(groupComponents(REAL).map((g) => g.key)).toEqual(['service', 'ui', 'external'])
  })
  it('keeps the backend return order within a group', () => {
    expect(groupComponents(REAL)[0].items.map((c) => c.name)).toEqual(['Gateway', 'User Service'])
  })
  it('does not render an empty group', () => {
    expect(groupComponents([REAL[0]]).map((g) => g.key)).toEqual(['service'])
  })
  it('drops an unknown category (no crash)', () => {
    const odd = [{ ...REAL[0], category: 'whatever' }]
    expect(groupComponents(odd)).toEqual([])
  })
})

describe('statusHint', () => {
  it('gives error + probed time when there is an error', () => {
    expect(statusHint(REAL[1])).toBe('unexpected status Internal Server Error (2026-08-01T02:15:55Z)')
  })
  it('gives only the probed time when there is no error', () => {
    expect(statusHint({ ...REAL[1], error: '' })).toBe('(2026-08-01T02:15:55Z)')
  })
  it('returns an empty string when there is not even a probed_at', () => {
    expect(statusHint({ ...REAL[1], error: '', probed_at: '' })).toBe('')
  })
})
