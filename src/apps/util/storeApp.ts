import type { StoreAppInfo } from '@nimotech/nimoos-service'
import { resolveAppText } from './appTitle'

/** Normalized entry for store list/Featured cards (detail page uses raw StoreAppInfo directly, without this mapping) */
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

/** Vue2 filteredPageList equivalent: space-delimited tokenization, matches in title+tagline OR mode, case-insensitive (AppPanel.vue:269-281) */
export function filterStoreApps(items: StoreApp[], key: string): StoreApp[] {
  const tokens = key.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!tokens.length) return items
  return items.filter((a) => {
    const hay = `${a.title} ${a.tagline}`.toLowerCase()
    return tokens.some((tk) => hay.includes(tk))
  })
}
