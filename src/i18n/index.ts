import { createI18n } from 'vue-i18n'
import zh from './zh_cn'
import en from './en_us'
import zhSp9 from './zh_cn.sp9'
import enSp9 from './en_us.sp9'

// SP9 起文案走分片(spec §4.2):新 key 只落 *.sp9.ts,不再改 zh_cn.ts / en_us.ts,
// 以免与 sp7/sp8/时间机器三条并行线在同一文件上相撞。
const messages = { zh_cn: { ...zh, ...zhSp9 }, en_us: { ...en, ...enSp9 } }

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
