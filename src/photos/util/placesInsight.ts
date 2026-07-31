// 后端 insights 的 i18n key 是 Vue2 时代的点分嵌套键(NimoOS-Photos/service/places.go:526-560
// 恰好四条),New-UI 用扁平驼峰键,故需一张映射表(照 P6a regionLabelKey 的先例)。
// 偏离登记 8:Vue2 `pt(ins.key)` 对未知 key 会把 key 原文渲染给用户;这里返回 null,
// 由调用方跳过该卡片并 console.warn —— 后端加了新 insight 时界面不会漏出内部 key。
export const INSIGHT_KEY_MAP: Readonly<Record<string, string>> = Object.freeze({
  'photos.places.insight.mostPhotographed': 'photosPlacesInsightMostPhotographed',
  'photos.places.insight.topSpot': 'photosPlacesInsightTopSpot',
  'photos.places.insight.companions': 'photosPlacesInsightCompanions',
  'photos.places.insight.home': 'photosPlacesInsightHome',
})

export function insightKey(backendKey: string): string | null {
  return INSIGHT_KEY_MAP[backendKey] ?? null
}

// 偏离登记 9:后端 params.names 是 Go []string(places.go:550-551),Vue2 直接插值 →
// 渲染成逗号无空格连接。这里显式用 ' · ' 拼,与同页到访记录 faces 的拼法(Vue2 :1229
// `(v.faces || []).join(' · ')`)同口径。
export function joinCompanionNames(names: unknown): string {
  if (Array.isArray(names)) {
    return names.map((n) => String(n ?? '')).filter((s) => s !== '').join(' · ')
  }
  return typeof names === 'string' ? names : ''
}
