import { createI18n } from 'vue-i18n'
import zh from './zh_cn'
import en from './en_us'
import zhSp9 from './zh_cn.sp9'
import enSp9 from './en_us.sp9'

// Since SP9, copy is sharded (spec §4.2): new keys go only into *.sp9.ts, never into
// zh_cn.ts / en_us.ts, to avoid collisions with the sp7/sp8/time-machine parallel lines on the same file.
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
