import { defineStore } from 'pinia'
import { i18n } from '../i18n'
import { readSystemConfig, patchSystemConfig } from '../settings/util/systemConfig'
import { useToast } from './toast'

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
    } catch (e) {
      // 评审 fix round 2 · Important:此前只 console.warn —— 界面已经切换了语言,
      // 服务端却从没存过,用户毫无感知。persist() 被 LanguageRow.vue 和首次开机
      // Welcome.vue 的语言选择器两处调用,提示放在 store 里能同时覆盖两处调用方,
      // 不必改 persist() 的返回契约(不抛出,调用方不用各自 try/catch)。
      console.warn('[locale] server save failed', e)
      const toast = useToast()
      toast.show(i18n.global.t('settingsSaveFailed'))
    }
  }

  return { setLocale, loadFromServer, persist }
})
