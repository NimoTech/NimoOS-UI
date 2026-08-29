import { defineStore } from 'pinia'
import { i18n } from '../i18n'
import { readSystemConfig, patchSystemConfig } from '../settings/util/systemConfig'
import { useToast } from './toast'
import { LOCALES, isLocale, type Locale } from '../i18n/locale'

// Locale identity lives in i18n/locale.ts (it has to be reachable from i18n/index.ts
// without importing this store). Re-exported here so existing call sites keep working.
export { LOCALES, isLocale }
export type { Locale }

export const useLocaleStore = defineStore('locale', () => {
  function setLocale(lang: Locale) {
    i18n.global.locale.value = lang
    localStorage.setItem('lang', lang)
  }

  async function loadFromServer(): Promise<void> {
    try {
      const blob = await readSystemConfig()
      if (isLocale(blob.lang)) setLocale(blob.lang)
    } catch (e) { console.warn('[locale] server load failed', e) }
  }

  // Routed through systemConfig's serial queue instead: the settings page's timezone/toggles
  // also write this same key, and independent read-modify-write cycles would lose writes
  // (porting discipline #3).
  async function persist(lang: Locale): Promise<void> {
    setLocale(lang)
    try {
      await patchSystemConfig({ lang })
    } catch (e) {
      // review fix round 2 · Important: this used to only console.warn -- the UI had already
      // switched languages, but the server never actually saved it, and the user had no way
      // of knowing. persist() is called from both LanguageRow.vue and the first-boot
      // Welcome.vue language picker, so putting the toast in the store covers both call
      // sites at once, without changing persist()'s return contract (it still doesn't throw,
      // so callers don't each need their own try/catch).
      console.warn('[locale] server save failed', e)
      const toast = useToast()
      toast.show(i18n.global.t('settingsSaveFailed'))
    }
  }

  return { setLocale, loadFromServer, persist }
})
