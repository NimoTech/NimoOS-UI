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
  it('按 service / ui / external 顺序分组', () => {
    expect(groupComponents(REAL).map((g) => g.key)).toEqual(['service', 'ui', 'external'])
  })
  it('组内保持后端返回顺序', () => {
    expect(groupComponents(REAL)[0].items.map((c) => c.name)).toEqual(['Gateway', 'User Service'])
  })
  it('空组不渲染', () => {
    expect(groupComponents([REAL[0]]).map((g) => g.key)).toEqual(['service'])
  })
  it('未知 category 被丢弃(不炸)', () => {
    const odd = [{ ...REAL[0], category: 'whatever' }]
    expect(groupComponents(odd)).toEqual([])
  })
})

describe('statusHint', () => {
  it('有 error 时给 error + 探测时间', () => {
    expect(statusHint(REAL[1])).toBe('unexpected status Internal Server Error (2026-08-01T02:15:55Z)')
  })
  it('无 error 时只给探测时间', () => {
    expect(statusHint({ ...REAL[1], error: '' })).toBe('(2026-08-01T02:15:55Z)')
  })
  it('连 probed_at 都没有时返回空串', () => {
    expect(statusHint({ ...REAL[1], error: '', probed_at: '' })).toBe('')
  })
})
