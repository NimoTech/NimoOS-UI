import type { StoreAppInfo } from '@nimotech/nimoos-service'
import { resolveAppText } from './appTitle'

/** 商店列表/Featured 卡片用的归一化条目(详情页直接用原始 StoreAppInfo,不走此映射) */
export interface StoreApp {
  id: string
  title: string
  tagline: string
  icon: string
  category: string
}

export function mapStoreApp(id: string, raw: StoreAppInfo, lang: string): StoreApp {
  return {
    id,
    title: resolveAppText(raw.title, lang, id),
    tagline: resolveAppText(raw.tagline, lang, ''),
    icon: typeof raw.icon === 'string' ? raw.icon : '',
    category: typeof raw.category === 'string' ? raw.category : '',
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
