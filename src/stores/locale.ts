import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import { i18n } from '../i18n'

export const LOCALES = ['zh_cn', 'en_us'] as const
export type Locale = (typeof LOCALES)[number]
const SYSTEM_KEY = 'system'

function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v)
}

export const useLocaleStore = defineStore('locale', () => {
  function setLocale(lang: Locale) {
    i18n.global.locale.value = lang
    localStorage.setItem('lang', lang)
  }

  async function readSystemBlob(): Promise<Record<string, unknown>> {
    let data: unknown = await service.users.getCustomStorage(SYSTEM_KEY)
    if (typeof data === 'string') { try { data = JSON.parse(data) } catch { data = null } }
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  }

  async function loadFromServer(): Promise<void> {
    try {
      const blob = await readSystemBlob()
      if (isLocale(blob.lang)) setLocale(blob.lang)
    } catch (e) { console.warn('[locale] server load failed', e) }
  }

  async function persist(lang: Locale): Promise<void> {
    setLocale(lang)
    try {
      const blob = await readSystemBlob()
      blob.lang = lang
      await service.users.setCustomStorage(SYSTEM_KEY, blob)
    } catch (e) { console.warn('[locale] server save failed', e) }
  }

  return { setLocale, loadFromServer, persist }
})
