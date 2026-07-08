import { createI18n } from 'vue-i18n'
import { messages as zhMessages } from './zh_cn'
import { messages as enMessages } from './en_us'

const messages = { ...zhMessages, ...enMessages }

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
