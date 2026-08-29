import { describe, it, expect } from 'vitest'
import zhBase from './zh_cn'
import enBase from './en_us'
import zhSp9 from './zh_cn.sp9'
import enSp9 from './en_us.sp9'

// The catalogue is sharded; assertions run against the *merged* set -- checking the base
// alone would miss a key that is only missing from a shard.
const zh: Record<string, unknown> = { ...zhBase, ...zhSp9 }
const en: Record<string, unknown> = { ...enBase, ...enSp9 }

describe('i18n locale parity', () => {
  it('en_us and zh_cn have identical top-level key sets (shards included)', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })

  it('every en_us value is a non-empty string', () => {
    for (const [k, v] of Object.entries(en)) {
      expect(typeof v, `key ${k}`).toBe('string')
      expect((v as string).length, `key ${k}`).toBeGreaterThan(0)
    }
  })

  it('every zh_cn value is a non-empty string', () => {
    for (const [k, v] of Object.entries(zh)) {
      expect(typeof v, `key ${k}`).toBe('string')
      expect((v as string).length, `key ${k}`).toBeGreaterThan(0)
    }
  })

  it('a shard must not override a key the base already has (that silently rewrites copy)', () => {
    const dup = Object.keys(zhSp9).filter((k) => k in zhBase)
    expect(dup, `shard keys colliding with the base: ${dup.join(', ')}`).toEqual([])
  })

  it('spot-checks a few English strings', () => {
    expect(en.cpu).toBe('CPU')
    expect(en.memory).toBe('Memory')
    expect(en.filesTitle).toBe('Files')
    expect(en.settingsTitle).toBe('Settings')
  })
})

/* P6a-T4: completeness and terminology guard for the places-domain keys. */
describe('photosPlaces keys (SP7-P6a)', () => {
  it('all six continent keys are present, and every regionLabelKey return value has a translation', async () => {
    const { regionLabelKey } = await import('../photos/util/placesMap')
    for (const id of ['asia', 'americas', 'europe', 'africa', 'oceania', 'antarctica']) {
      const k = regionLabelKey(id)!
      expect(zh).toHaveProperty(k)
      expect(en).toHaveProperty(k)
    }
  })

  it('the Chinese copy avoids the engineering words 「簇」「聚类」「气泡」', () => {
    const bad = Object.entries(zh)
      .filter(([k]) => k.startsWith('photosPlaces'))
      .filter(([, v]) => typeof v === 'string' && /簇|聚类|气泡/.test(v))
    expect(bad).toEqual([])
  })

  /* P6b-T1: completeness and interpolation-slot guard for the place detail panel keys. */
  it('the P6b place keys exist in both locales with no empty values', () => {
    const keys = ['photosPlacesHomeBase', 'photosPlacesSpotResetName', 'photosPlacesCoverPageInfo',
      'photosPlacesInsightHome', 'photosPlacesInsightHomeBase', 'photosPlacesVisitHistory']
    for (const k of keys) {
      expect(String((zh as Record<string, unknown>)[k] ?? '')).not.toBe('')
      expect(String((en as Record<string, unknown>)[k] ?? '')).not.toBe('')
    }
  })
  it('insight keys have identical interpolation slots in both locales (a missing slot makes <i18n-t> silently drop content)', () => {
    const slots = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort()
    for (const k of ['photosPlacesInsightMostPhotographed', 'photosPlacesInsightTopSpot',
      'photosPlacesInsightCompanions', 'photosPlacesInsightHome']) {
      expect(slots(String((zh as Record<string, string>)[k]))).toEqual(slots(String((en as Record<string, string>)[k])))
    }
  })
})

// Domains the project does not own and that have never resolved. `nimoos.io` and
// its subdomains are artefacts of the CasaOS rename: nobody registered them, so
// copy naming one promised the user a fetch that could not happen — and the
// Vue2 UI deleted the RSS feature outright for that reason (BrandBar.vue: the
// request carried a base64 device fingerprint to a registrable domain). Copy is
// the last place these survive, because nothing fails when a string is wrong.
const DEAD_DOMAINS = /nimoos\.io|casaos\.io|zimaspace\.com|icewhale\.com/i

describe('i18n copy names no domain the project does not own', () => {
  it('en_us', () => {
    for (const [k, v] of Object.entries(en)) {
      expect(String(v), `key ${k}`).not.toMatch(DEAD_DOMAINS)
    }
  })

  it('zh_cn', () => {
    for (const [k, v] of Object.entries(zh)) {
      expect(String(v), `key ${k}`).not.toMatch(DEAD_DOMAINS)
    }
  })
})
