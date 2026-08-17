import { describe, it, expect } from 'vitest'
import type { KvmVM } from '@nimotech/nimoos-service'
import { preserveSpice } from './spicePreserve'

const mk = (over: Partial<KvmVM>) => ({ id: 'a', name: 'vm', state: 'running',
  spicePort: 0, spiceTlsPort: 0, ...over } as KvmVM)

describe('preserveSpice — keep-alive merging when list API spicePort is stale/zeroed', () => {
  it('New data lacks spicePort, old data has it → reuse old value (including TlsPort)', () => {
    const out = preserveSpice(mk({ spicePort: 0, spiceTlsPort: 0 }), { spicePort: 5901, spiceTlsPort: 5902 })
    expect(out.spicePort).toBe(5901)
    expect(out.spiceTlsPort).toBe(5902)
  })
  it('New data has its own spicePort → use new data, not overwritten by old value', () => {
    const out = preserveSpice(mk({ spicePort: 5911, spiceTlsPort: 0 }), { spicePort: 5901, spiceTlsPort: 5902 })
    expect(out.spicePort).toBe(5911)
    expect(out.spiceTlsPort).toBe(0)
  })
  it('Old data also lacks it → keep the new data\'s 0', () => {
    expect(preserveSpice(mk({}), { spicePort: 0, spiceTlsPort: 0 }).spicePort).toBe(0)
  })
  it('Old data is null / undefined → return as-is', () => {
    expect(preserveSpice(mk({ spicePort: 7 }), null).spicePort).toBe(7)
    expect(preserveSpice(mk({ spicePort: 7 }), undefined).spicePort).toBe(7)
  })
  it('Do not modify input params, return new object (avoid cascading updates from in-place mutation in reactive arrays)', () => {
    const fresh = mk({ spicePort: 0 })
    const out = preserveSpice(fresh, { spicePort: 5901, spiceTlsPort: 0 })
    expect(fresh.spicePort).toBe(0)
    expect(out).not.toBe(fresh)
  })
  it('All other fields come from new data', () => {
    const out = preserveSpice(mk({ state: 'stopped', name: 'new-name', spicePort: 0 }),
      { spicePort: 5901, spiceTlsPort: 0 })
    expect(out.state).toBe('stopped')
    expect(out.name).toBe('new-name')
  })
})
