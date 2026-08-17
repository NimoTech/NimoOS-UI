import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { LOCALES, isLocale, detectLocale, initialLocale } from './locale'

/** jsdom's navigator.language is read-only, so swap the whole accessor per case. */
function withNavigatorLanguage(lang: string | undefined, fn: () => void) {
  const original = Object.getOwnPropertyDescriptor(window.navigator, 'language')
  Object.defineProperty(window.navigator, 'language', { value: lang, configurable: true })
  try { fn() } finally {
    if (original) Object.defineProperty(window.navigator, 'language', original)
    else delete (window.navigator as unknown as Record<string, unknown>).language
  }
}

describe('locale detection', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('ships exactly the two locales the catalogues cover', () => {
    expect([...LOCALES]).toEqual(['zh_cn', 'en_us'])
    expect(isLocale('zh_cn')).toBe(true)
    expect(isLocale('en_us')).toBe(true)
    expect(isLocale('fr_fr')).toBe(false)
    expect(isLocale(undefined)).toBe(false)
  })

  it.each(['zh', 'zh-CN', 'zh-cn', 'ZH-Hant', 'zh-TW', 'zh-HK'])(
    'a browser reporting %s gets Chinese', (lang) => {
      withNavigatorLanguage(lang, () => expect(detectLocale()).toBe('zh_cn'))
    })

  it.each(['en', 'en-US', 'en-GB', 'fr-FR', 'de', 'ja-JP', 'pt-BR'])(
    'a browser reporting %s gets English', (lang) => {
      withNavigatorLanguage(lang, () => expect(detectLocale()).toBe('en_us'))
    })

  // A browser that reports nothing must not silently land on Chinese: this is the
  // exact case an English-speaking first-time visitor used to hit.
  it('falls back to English when the browser reports no language', () => {
    withNavigatorLanguage(undefined, () => expect(detectLocale()).toBe('en_us'))
    withNavigatorLanguage('', () => expect(detectLocale()).toBe('en_us'))
  })

  it('a stored choice wins over the browser, in both directions', () => {
    localStorage.setItem('lang', 'en_us')
    withNavigatorLanguage('zh-CN', () => expect(initialLocale()).toBe('en_us'))
    localStorage.setItem('lang', 'zh_cn')
    withNavigatorLanguage('en-US', () => expect(initialLocale()).toBe('zh_cn'))
  })

  it('a stored value outside the shipped locales is ignored, not trusted', () => {
    localStorage.setItem('lang', 'fr_fr')
    withNavigatorLanguage('en-US', () => expect(initialLocale()).toBe('en_us'))
    withNavigatorLanguage('zh-CN', () => expect(initialLocale()).toBe('zh_cn'))
  })

  it('with nothing stored, falls through to detection', () => {
    withNavigatorLanguage('zh-CN', () => expect(initialLocale()).toBe('zh_cn'))
    withNavigatorLanguage('en-GB', () => expect(initialLocale()).toBe('en_us'))
  })
})
