import { describe, it, expect } from 'vitest'
import type { KvmVM } from '@nimotech/nimoos-service'
import { preserveSpice } from './spicePreserve'

const mk = (over: Partial<KvmVM>) => ({ id: 'a', name: 'vm', state: 'running',
  spicePort: 0, spiceTlsPort: 0, ...over } as KvmVM)

describe('preserveSpice —— 列表接口 spicePort 陈旧/归零时的保活合并', () => {
  it('新数据缺 spicePort、旧数据有 → 沿用旧值(含 TlsPort)', () => {
    const out = preserveSpice(mk({ spicePort: 0, spiceTlsPort: 0 }), { spicePort: 5901, spiceTlsPort: 5902 })
    expect(out.spicePort).toBe(5901)
    expect(out.spiceTlsPort).toBe(5902)
  })
  it('新数据自己有 spicePort → 以新数据为准,不被旧值覆盖', () => {
    const out = preserveSpice(mk({ spicePort: 5911, spiceTlsPort: 0 }), { spicePort: 5901, spiceTlsPort: 5902 })
    expect(out.spicePort).toBe(5911)
    expect(out.spiceTlsPort).toBe(0)
  })
  it('旧数据也没有 → 保持新数据的 0', () => {
    expect(preserveSpice(mk({}), { spicePort: 0, spiceTlsPort: 0 }).spicePort).toBe(0)
  })
  it('旧数据为 null / undefined → 原样返回', () => {
    expect(preserveSpice(mk({ spicePort: 7 }), null).spicePort).toBe(7)
    expect(preserveSpice(mk({ spicePort: 7 }), undefined).spicePort).toBe(7)
  })
  it('不修改入参,返回新对象(避免在 reactive 数组里就地改引发的连锁更新)', () => {
    const fresh = mk({ spicePort: 0 })
    const out = preserveSpice(fresh, { spicePort: 5901, spiceTlsPort: 0 })
    expect(fresh.spicePort).toBe(0)
    expect(out).not.toBe(fresh)
  })
  it('其余字段全部来自新数据', () => {
    const out = preserveSpice(mk({ state: 'stopped', name: 'new-name', spicePort: 0 }),
      { spicePort: 5901, spiceTlsPort: 0 })
    expect(out.state).toBe('stopped')
    expect(out.name).toBe('new-name')
  })
})
