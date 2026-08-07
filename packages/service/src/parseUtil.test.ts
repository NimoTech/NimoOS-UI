import { describe, it, expect } from 'vitest'
import { parseUtil } from './parseUtil'

describe('parseUtil', () => {
  it('reads HTTP shape (object values under bare keys)', () => {
    const out = parseUtil({ cpu: { percent: 42 }, mem: { usedPercent: 70 } })
    expect(out.cpu).toEqual({ percent: 42 })
    expect(out.mem).toEqual({ usedPercent: 70 })
    expect(out.disk).toBeNull()
  })

  it('reads socket shape (JSON strings under sys_* keys)', () => {
    const out = parseUtil({ sys_cpu: '{"percent":15}', sys_net: '{"rx":100}' })
    expect(out.cpu).toEqual({ percent: 15 })
    expect(out.net).toEqual({ rx: 100 })
  })

  it('prefers sys_* over bare key when both present', () => {
    const out = parseUtil({ sys_cpu: '{"percent":1}', cpu: { percent: 99 } })
    expect(out.cpu).toEqual({ percent: 1 })
  })

  it('returns nulls for missing or unparseable values', () => {
    const out = parseUtil({ sys_cpu: 'not-json' })
    expect(out.cpu).toBeNull()
    expect(out.gpu).toBeNull()
  })

  it('tolerates null/undefined input', () => {
    expect(parseUtil(null).cpu).toBeNull()
    expect(parseUtil(undefined).mem).toBeNull()
  })
})
