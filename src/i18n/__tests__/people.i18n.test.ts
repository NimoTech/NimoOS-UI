import { describe, it, expect } from 'vitest'
import zh from '../zh_cn'
import en from '../en_us'

describe('people i18n keys', () => {
  const sample = [
    'photosPeople', 'photosPeopleUnnamedSection', 'photosPeopleUnnamedHint',
    'photosPersonNameThis', 'photosPersonDeletedToast', 'photosPersonUndo',
    'photosPersonTabRelations', 'photosPersonInsightWith', 'photosPersonShowAll',
    'photosPeopleEmptyTitle', 'photosPersonNotFound',
  ]
  it.each(sample)('%s has a non-empty value in both locales', (k) => {
    expect(String((zh as Record<string, unknown>)[k] ?? '')).not.toBe('')
    expect(String((en as Record<string, unknown>)[k] ?? '')).not.toBe('')
  })
  it('keys with interpolation have matching placeholders on both sides', () => {
    for (const k of ['photosPeopleNamed', 'photosPersonNamedToast', 'photosPersonInsightWith', 'photosPersonShowAll']) {
      const ph = (s: string) => (s.match(/\{[a-zA-Z0-9]+\}/g) ?? []).sort()
      expect(ph(String((zh as Record<string, string>)[k]))).toEqual(ph(String((en as Record<string, string>)[k])))
    }
  })
})
