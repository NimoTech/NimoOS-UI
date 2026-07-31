import { describe, it, expect } from 'vitest'
import zh from './zh_cn'
import en from './en_us'

describe('i18n locale parity', () => {
  it('en_us 与 zh_cn 顶层 key 集合完全一致', () => {
    const zhKeys = Object.keys(zh).sort()
    const enKeys = Object.keys(en).sort()
    expect(enKeys).toEqual(zhKeys)
  })

  it('en_us 值均为非空字符串', () => {
    for (const [k, v] of Object.entries(en)) {
      expect(typeof v, `key ${k}`).toBe('string')
      expect((v as string).length, `key ${k}`).toBeGreaterThan(0)
    }
  })

  it('抽查若干英文文案', () => {
    expect(en.cpu).toBe('CPU')
    expect(en.memory).toBe('Memory')
    expect(en.filesTitle).toBe('Files')
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
