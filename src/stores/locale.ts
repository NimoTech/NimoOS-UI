import { defineStore } from 'pinia'
import { i18n } from '../i18n'
import { readSystemConfig, patchSystemConfig } from '../settings/util/systemConfig'

export const LOCALES = ['zh_cn', 'en_us'] as const
export type Locale = (typeof LOCALES)[number]

function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v)
}

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

  // 改走 systemConfig 的串行队列:设置页的时区/开关也写这一个 key,
  // 各自读改写会丢写(移植纪律 #3)。
  async function persist(lang: Locale): Promise<void> {
    setLocale(lang)
    try {
      await patchSystemConfig({ lang })
    } catch (e) { console.warn('[locale] server save failed', e) }
  }

  return { setLocale, loadFromServer, persist }
})
