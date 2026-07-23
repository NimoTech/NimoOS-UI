// Hoisted from the duplicated tab-filter predicate that used to live
// independently in PhotosGrid.vue's `filteredMonths` computed and
// src/views/Photos.vue's `matchesTab`/`filteredCount` — same logic, different
// branch order in each copy, a drift hazard (SP7-P1 review finding). Branch
// order here matches Vue2 NimoOS-UI src/views/Photos/PhotosGrid.vue:175 and
// src/views/Photos/PhotosTimeline.vue:194 (both identical in Vue2):
// `all ? true : video ? isVideo : ocr ? hasOcr : (!isVideo && !hasOcr)`.
import type { Photo } from './assetToPhoto'

export function matchesTab(p: Photo, tab: string): boolean {
  return tab === 'all' ? true
    : tab === 'video' ? p.isVideo
      : tab === 'ocr' ? p.hasOcr
        : (!p.isVideo && !p.hasOcr)
}
