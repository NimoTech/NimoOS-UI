import { describe, it, expect } from 'vitest'
import zhBase from './zh_cn'
import enBase from './en_us'
import zhSp9 from './zh_cn.sp9'
import enSp9 from './en_us.sp9'

// SP9 起文案分片(spec §4.2)。断言对象是「合并后」的集合 —— 只测基座会漏掉分片里的缺键。
const zh: Record<string, unknown> = { ...zhBase, ...zhSp9 }
const en: Record<string, unknown> = { ...enBase, ...enSp9 }

describe('i18n locale parity', () => {
  it('en_us 与 zh_cn 顶层 key 集合完全一致(含 sp9 分片)', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })

  it('en_us 值均为非空字符串', () => {
    for (const [k, v] of Object.entries(en)) {
      expect(typeof v, `key ${k}`).toBe('string')
      expect((v as string).length, `key ${k}`).toBeGreaterThan(0)
    }
  })

  it('zh_cn 值均为非空字符串', () => {
    for (const [k, v] of Object.entries(zh)) {
      expect(typeof v, `key ${k}`).toBe('string')
      expect((v as string).length, `key ${k}`).toBeGreaterThan(0)
    }
  })

  it('分片不得覆盖基座已有 key(静默改文案)', () => {
    const dup = Object.keys(zhSp9).filter((k) => k in zhBase)
    expect(dup, `sp9 分片与基座 key 冲突: ${dup.join(', ')}`).toEqual([])
  })

  it('抽查若干英文文案', () => {
    expect(en.cpu).toBe('CPU')
    expect(en.memory).toBe('Memory')
    expect(en.filesTitle).toBe('Files')
    expect(en.settingsTitle).toBe('Settings')
  })
})
