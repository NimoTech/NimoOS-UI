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

/* P6a-T4:地点域键的完整性与术语守卫。 */
describe('photosPlaces 键(SP7-P6a)', () => {
  it('六个大洲键齐备,且 regionLabelKey 的返回值全部有译文', async () => {
    const { regionLabelKey } = await import('../photos/util/placesMap')
    for (const id of ['asia', 'americas', 'europe', 'africa', 'oceania', 'antarctica']) {
      const k = regionLabelKey(id)!
      expect(zh).toHaveProperty(k)
      expect(en).toHaveProperty(k)
    }
  })

  it('中文文案不含工程词「簇」「聚类」「气泡」', () => {
    const bad = Object.entries(zh)
      .filter(([k]) => k.startsWith('photosPlaces'))
      .filter(([, v]) => typeof v === 'string' && /簇|聚类|气泡/.test(v))
    expect(bad).toEqual([])
  })

  /* P6b-T1:地点详情面板键的完整性与插值槽守卫。 */
  it('P6b 地点键在两个 locale 都存在且无空值', () => {
    const keys = ['photosPlacesHomeBase', 'photosPlacesSpotResetName', 'photosPlacesCoverPageInfo',
      'photosPlacesInsightHome', 'photosPlacesInsightHomeBase', 'photosPlacesVisitHistory']
    for (const k of keys) {
      expect(String((zh as Record<string, unknown>)[k] ?? '')).not.toBe('')
      expect(String((en as Record<string, unknown>)[k] ?? '')).not.toBe('')
    }
  })
  it('insight 键的插值占位符两个 locale 完全一致(漏一个槽 <i18n-t> 会静默丢内容)', () => {
    const slots = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort()
    for (const k of ['photosPlacesInsightMostPhotographed', 'photosPlacesInsightTopSpot',
      'photosPlacesInsightCompanions', 'photosPlacesInsightHome']) {
      expect(slots(String((zh as Record<string, string>)[k]))).toEqual(slots(String((en as Record<string, string>)[k])))
    }
  })
})
