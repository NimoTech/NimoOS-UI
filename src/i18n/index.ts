import { createI18n } from 'vue-i18n'
import { messages } from './zh_cn'

function initialLocale(): string {
  const stored = localStorage.getItem('lang')
  if (stored && stored in messages) return stored
  return 'zh_cn'
}

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: 'zh_cn',
  messages,
})
