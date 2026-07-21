import type { StoreAppInfo } from '@nimotech/nimoos-service'
import { resolveAppText } from './appTitle'

/** 商店列表/Featured 卡片用的归一化条目(详情页直接用原始 StoreAppInfo,不走此映射) */
export interface StoreApp {
  id: string
  title: string
  tagline: string
  icon: string
  thumbnail: string
  category: string
  architectures: string[]
  tips: unknown
}

export function mapStoreApp(id: string, raw: StoreAppInfo, lang: string): StoreApp {
  return {
    id,
    title: resolveAppText(raw.title, lang, id),
    tagline: resolveAppText(raw.tagline, lang, ''),
    icon: typeof raw.icon === 'string' ? raw.icon : '',
    thumbnail: typeof raw.thumbnail === 'string' ? raw.thumbnail : '',
    category: typeof raw.category === 'string' ? raw.category : '',
    architectures: Array.isArray(raw.architectures) ? raw.architectures.filter((x): x is string => typeof x === 'string') : [],
    tips: raw.tips ?? undefined,
  }
}

/** Vue2 filteredPageList 同款:空格分词,title+tagline OR 命中,大小写不敏感(AppPanel.vue:269-281) */
export function filterStoreApps(items: StoreApp[], key: string): StoreApp[] {
  const tokens = key.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!tokens.length) return items
  return items.filter((a) => {
    const hay = `${a.title} ${a.tagline}`.toLowerCase()
    return tokens.some((tk) => hay.includes(tk))
  })
}
