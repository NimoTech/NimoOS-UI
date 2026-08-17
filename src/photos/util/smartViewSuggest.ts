// Smart Views "suggestion pool / quick templates / condition suggestions" pure functions,
// ported verbatim from Vue2 PhotosSmartViewsView.vue:198-242 (POOL + inferChips) and
// PhotosSmartViewDetail.vue:334-343 (condSuggestions).

export interface SuggestRow {
  kw: string[]
  chips: string[]
}

// Every chip here must be executable by the backend parser (svparser.go):
// scene:/object: (CLIP semantic), ocr:, place:, person names, and date forms.
// Anything else gets silently dropped server-side — never suggest those.
//
// Note: chip values are NOT run through i18n -- 'scene: sunset' / 'place: Japan' / 'Lily' are
// literal protocol strings sent to the backend svparser; translating them makes the backend
// stop recognizing them. kw is the English keyword list used to match user input, and for the
// same reason it can't be localized either. Both are copied verbatim from the Vue2 source.
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

// Iterates over POOL (not over tokens of the input text); each matching row has its chips
// appended one by one, deduped via a Set while preserving first-seen order, capped at 8.
// Ported verbatim from Vue2 :229-242.
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
  // descEn: the original English text, used solely for inferChips matching (POOL's kw entries
  // are English, so matching against descKey / the Chinese description would never hit).
  // descKey is only for on-screen display. Vue2's useTemplate(t) (:413-419) feeds t.desc (the
  // original English text) straight into inferChips; New-UI stores i18n keys instead, so this
  // field is split out to carry the same call requirement.
  descEn: string
  thresh: number
}

// Ported verbatim from Vue2 :221-227, with label/desc swapped for i18n key names (see the descEn note above).
export const SV_QUICK_TEMPLATES: readonly QuickTemplate[] = [
  { labelKey: 'photosSvFamilyWeekends', descKey: 'photosSvFamilyWeekendsPark', descEn: 'Family weekends in the park', thresh: 75 },
  { labelKey: 'photosSvBestLastMonth', descKey: 'photosSvBestPhotosLast30', descEn: 'Best photos from the last 30 days', thresh: 88 },
  { labelKey: 'photosSvSunsetsRoad', descKey: 'photosSvSunsetsWhileTravelingNot', descEn: 'Sunsets while traveling, not at home', thresh: 80 },
  { labelKey: 'photosSvReceiptsFile', descKey: 'photosSvReceiptsInvoicesAmount', descEn: 'Receipts and invoices with an amount', thresh: 65 },
  { labelKey: 'photosSvPetPortraits', descKey: 'photosSvSharpDogCatPortraits', descEn: 'Sharp dog and cat portraits', thresh: 85 },
]

// COND_SUGGESTIONS / condSuggestionsFor (the "Add condition" popover's suggestion chips)
// were removed here in SP15-P2c Task 8, ported from Vue2 NimoOS-UI 33b05636
// PhotosSmartViewDetail.vue:26-30 ("user-appended requirements") -- the popover they fed is gone and
// they had no other caller (grep confirmed zero remaining references before deletion).
