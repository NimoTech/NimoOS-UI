// 搜索结果排序 + 「最佳匹配 / 更多结果」双档切分。Ported from Vue2 NimoOS-UI
// src/views/Photos/PhotosSearchView.vue:374-391(sortedResults)、:397-404
// (bestTierResults/moreTierResults)、:675-678(matchPct)、
// src/store/modules/photos.js:32-33(searchStateMatchesQuery)。

import type { Photo } from './assetToPhoto'

export type SortKey = 'relevance' | 'newest' | 'oldest'

export interface ScoredPhoto {
  p: Photo
  score: number | null
}

// 按拍摄时间排序的比较器。Vue2→Vue3 铁律:「按 id 比」一律 String(a) === String(b)
// ——Photo.id 类型是 string | number,混合类型时用 > 直接比较会得到不符合直觉的
// 结果(以及 tie-break 排序不稳定跨类型的风险),统一转 String 再比。
function byTakenAt(desc: boolean) {
  return (a: ScoredPhoto, b: ScoredPhoto): number => {
    const ta = a.p.takenAt
    const tb = b.p.takenAt
    // 双 null → 按 id 比,保持排序稳定。
    if (ta == null && tb == null) return String(a.p.id) > String(b.p.id) ? 1 : -1
    // 单 null → 恒排末尾,不受方向影响(照搬 Vue2 行为)。
    if (ta == null) return 1
    if (tb == null) return -1
    if (ta === tb) return String(a.p.id) > String(b.p.id) ? 1 : -1
    return (ta > tb ? 1 : -1) * (desc ? -1 : 1)
  }
}

export function sortResults(rows: ScoredPhoto[], sort: SortKey): ScoredPhoto[] {
  // 必须拷贝后排序,不能原地改——调用方(store/组件)可能还持有原数组的引用
  // 做别的用途(如 filteredResults 的上游)。
  const arr = [...rows]
  if (sort === 'relevance') arr.sort((a, b) => (b.score || 0) - (a.score || 0))
  else if (sort === 'newest') arr.sort(byTakenAt(true))
  else arr.sort(byTakenAt(false))
  return arr
}

// 搜索结果分档(spec §4):只有 relevance 排序才有「最佳匹配 vs 长尾」的意义;
// newest/oldest 按时间排序,不分档,全部落 best。
export function splitTiers(sorted: ScoredPhoto[], sort: SortKey): { best: ScoredPhoto[]; more: ScoredPhoto[] } {
  if (sort !== 'relevance') return { best: sorted, more: [] }
  return {
    best: sorted.filter(r => !r.p.belowCut),
    more: sorted.filter(r => r.p.belowCut),
  }
}

// 后端已经把展示分数 recalibrate 到 [0,1](OCR 精确匹配固定 1.0),这里只做
// 夹紧 + 转百分比,不再做客户端二次缩放。
export function matchPct(score: number | null | undefined): number | null {
  if (score == null) return null
  return Math.round(Math.max(0, Math.min(1, score)) * 100)
}

// 当前 store 里已提交的搜索结果是否属于给定查询词。搜索视图据此决定渲染结果集
// 还是在途空态,消除「路由 q 已是新词、store 还是旧词/时间线兜底」窗口期的双
// 结果集闪烁。Ported verbatim from photos.js:32-33。
export function searchStateMatchesQuery(state: { isSearchMode: boolean; searchQuery: string }, query: string): boolean {
  return !!state.isSearchMode && state.searchQuery === (query || '').trim()
}
