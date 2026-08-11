// 智能视图「建议池 / 快速模板 / 条件建议」纯函数,照搬自 Vue2
// PhotosSmartViewsView.vue:198-242(POOL + inferChips)与
// PhotosSmartViewDetail.vue:334-343(condSuggestions)。

export interface SuggestRow {
  kw: string[]
  chips: string[]
}

// Every chip here must be executable by the backend parser (svparser.go):
// scene:/object: (CLIP semantic), ocr:, place:, person names, and date forms.
// Anything else gets silently dropped server-side — never suggest those.
//
// 注:chips 的值不进 i18n —— 'scene: sunset' / 'place: Japan' / 'Lily' 这些是要发给
// 后端 svparser 的字面量协议串,翻译了后端就不认;kw 是用来匹配用户输入的英文关键词,
// 同理不能本地化。两者都逐字照搬 Vue2 源码。
export const SV_SUGGEST_POOL: readonly SuggestRow[] = [
  { kw: ['sunset', 'golden', 'dusk'], chips: ['scene: sunset'] },
  { kw: ['beach', 'ocean', 'sea', 'coast'], chips: ['scene: beach'] },
  { kw: ['food', 'meal', 'dinner', 'lunch', 'restaurant'], chips: ['scene: food'] },
  { kw: ['tokyo', 'japan', 'kyoto', 'osaka'], chips: ['place: Japan'] },
  { kw: ['paris', 'france', 'french'], chips: ['place: France'] },
  { kw: ['lily'], chips: ['Lily'] },
  { kw: ['sara'], chips: ['Sara'] },
  { kw: ['family', 'mom', 'dad', 'kids', 'grandma'], chips: ['scene: family gathering'] },
  { kw: ['dog', 'puppy'], chips: ['object: dog'] },
  { kw: ['cat', 'kitten'], chips: ['object: cat'] },
  { kw: ['receipt', 'invoice', 'document'], chips: ['ocr: receipt | invoice'] },
  { kw: ['selfie', 'portrait'], chips: ['scene: portrait'] },
  { kw: ['wedding', 'bride', 'groom'], chips: ['scene: wedding'] },
  { kw: ['birthday', 'cake', 'party'], chips: ['scene: birthday party'] },
  { kw: ['travel', 'trip', 'vacation', 'holiday'], chips: ['scene: travel'] },
  { kw: ['landscape', 'mountain', 'nature'], chips: ['scene: landscape'] },
  { kw: ['night', 'city', 'skyline'], chips: ['scene: city at night'] },
  { kw: ['last week', 'recent', 'this week'], chips: ['captured: last 30 days'] },
  { kw: ['2025'], chips: ['year: 2025'] },
  { kw: ['2026'], chips: ['year: 2026'] },
]

// 遍历 POOL(而非遍历输入文本的 token),命中的行把 chips 逐条加入,Set 去重、保持首次
// 出现顺序,最多 8 条。逐字照搬 Vue2 :229-242。
export function inferChips(text: string): string[] {
  if (!text) return []
  const t = text.toLowerCase()
  const seen = new Set<string>()
  const out: string[] = []
  for (const row of SV_SUGGEST_POOL) {
    if (row.kw.some((k) => t.includes(k))) {
      for (const c of row.chips) {
        if (!seen.has(c)) {
          seen.add(c)
          out.push(c)
        }
      }
    }
  }
  return out.slice(0, 8)
}

export interface QuickTemplate {
  labelKey: string
  descKey: string
  // descEn:英文原文,专供 inferChips 匹配用(POOL 的 kw 是英文,拿 descKey/中文描述去匹配
  // 恒不中)。descKey 只给界面显示。Vue2 useTemplate(t)(:413-419)直接拿 t.desc(英文原文)
  // 喂 inferChips;New-UI 存的是 i18n 键,故拆出这个字段承接同样的调用需求。
  descEn: string
  thresh: number
}

// 照搬 Vue2 :221-227,label/desc 换成 i18n 键名(见上方 descEn 的说明)。
export const SV_QUICK_TEMPLATES: readonly QuickTemplate[] = [
  { labelKey: 'photosSvFamilyWeekends', descKey: 'photosSvFamilyWeekendsPark', descEn: 'Family weekends in the park', thresh: 75 },
  { labelKey: 'photosSvBestLastMonth', descKey: 'photosSvBestPhotosLast30', descEn: 'Best photos from the last 30 days', thresh: 88 },
  { labelKey: 'photosSvSunsetsRoad', descKey: 'photosSvSunsetsWhileTravelingNot', descEn: 'Sunsets while traveling, not at home', thresh: 80 },
  { labelKey: 'photosSvReceiptsFile', descKey: 'photosSvReceiptsInvoicesAmount', descEn: 'Receipts and invoices with an amount', thresh: 65 },
  { labelKey: 'photosSvPetPortraits', descKey: 'photosSvSharpDogCatPortraits', descEn: 'Sharp dog and cat portraits', thresh: 85 },
]

// COND_SUGGESTIONS / condSuggestionsFor (the "Add condition" popover's suggestion chips)
// were removed here in SP15-P2c Task 8, ported from Vue2 NimoOS-UI 33b05636
// PhotosSmartViewDetail.vue:26-30 ("用户追加需求") -- the popover they fed is gone and
// they had no other caller (grep confirmed zero remaining references before deletion).
