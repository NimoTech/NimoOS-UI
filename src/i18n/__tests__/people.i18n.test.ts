import { describe, it, expect } from 'vitest'
import zh from '../zh_cn'
import en from '../en_us'

describe('SP7-P5 人物 i18n 键', () => {
  const sample = [
    'photosPeople', 'photosPeopleUnnamedSection', 'photosPeopleConfidence',
    'photosPersonNameThis', 'photosPersonDeletedToast', 'photosPersonUndo',
    'photosPersonTabRelations', 'photosPersonInsightWith', 'photosPersonShowAll',
    'photosPeopleEmptyTitle', 'photosPersonNotFound',
  ]
  it.each(sample)('%s 两个 locale 都有非空值', (k) => {
    expect(String((zh as Record<string, unknown>)[k] ?? '')).not.toBe('')
    expect(String((en as Record<string, unknown>)[k] ?? '')).not.toBe('')
  })
  it('带插值的键两边占位符一致', () => {
    for (const k of ['photosPeopleNamed', 'photosPersonNamedToast', 'photosPersonInsightWith', 'photosPersonShowAll']) {
      const ph = (s: string) => (s.match(/\{[a-zA-Z0-9]+\}/g) ?? []).sort()
      expect(ph(String((zh as Record<string, string>)[k]))).toEqual(ph(String((en as Record<string, string>)[k])))
    }
  })
})
