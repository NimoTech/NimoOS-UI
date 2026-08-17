// Locale identity + first-visit detection.
//
// Deliberately dependency-free and kept next to the catalogues rather than in
// stores/locale.ts: i18n/index.ts has to pick a locale while it is still being
// evaluated, and reaching into the pinia store from there would close a module
// cycle (i18n → store → i18n) at boot. The store re-exports these instead, so
// there is still only one definition of what a locale is.

export const LOCALES = ['zh_cn', 'en_us'] as const
export type Locale = (typeof LOCALES)[number]

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v)
}

/**
 * Locale for a visitor who has never chosen one: follow the browser, default to
 * English. Any Chinese tag (zh, zh-CN, zh-TW, zh-Hant…) maps to zh_cn — the app
 * only ships Simplified, and Chinese-in-Simplified beats English for those users.
 * Everything else, including a browser that reports nothing, gets en_us.
 *
 * This mirrors what main.ts already told the backend via getLang(), which read
 * navigator.language while the UI itself hardcoded zh_cn — so an English-speaking
 * user got an English Accept-Language header and a Chinese interface.
 */
export function detectLocale(): Locale {
  const tag = (typeof navigator === 'undefined' ? '' : navigator.language || '').toLowerCase()
  return tag.startsWith('zh') ? 'zh_cn' : 'en_us'
}

/** The user's stored choice if they have made one, otherwise detection. */
export function initialLocale(): Locale {
  let stored: string | null = null
  // Private-mode Safari and a few embedded webviews throw on localStorage access;
  // detection is a fine answer there, a boot-time crash is not.
  try { stored = localStorage.getItem('lang') } catch { /* fall through to detection */ }
  return isLocale(stored) ? stored : detectLocale()
}
