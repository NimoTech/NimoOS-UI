// SP15-P1-T2: Moments mosaic layout engine — a pure function, no Date/random/DOM dependency.
// Ported line-by-line from Vue2 NimoOS-UI 899af59b:src/views/Photos/PhotosSmartViewsView.vue:322-357
// (that side was already a module-level `export function`, designed to be unit-testable as-is).
// The only changes are the snake_case → camelCase field rename and the type annotations; the
// rules themselves are unchanged.

export type MomentSize = 'standard' | 'wide' | 'tall'
export type MomentTemplate = 'T1' | 'T2' | 'T3' | 'T4' | 'single'

/** Layout only needs these five fields; deliberately not the whole Moment, so this module
 *  stays decoupled from the store and test fixtures are easy to construct. */
export interface MomentLayoutInput {
  id: string
  recipeKey: string
  assetCount: number
  /** Cover aspect ratio w/h. Backend convention: 0 = unknown (cover not yet EXIF-indexed), and
   *  does not participate in the classification. */
  coverRatio: number
  featuredAssetIds: string[]
}

/**
 * Size classification — looks only at a single moment's own content, checked in order with
 * the first match winning:
 *   tall:     coverRatio ∈ (0, 0.85) — portrait cover
 *   wide:     recipeKey starts with 'trip' AND assetCount >= 100 — a big trip
 *   standard: everything else
 * Does not include the "spacing quota" (that's a sequence-level rule, see assignMomentSizes).
 */
export function classifyMomentSize(moment: MomentLayoutInput): MomentSize {
  const ratio = typeof moment.coverRatio === 'number' ? moment.coverRatio : 0
  if (ratio > 0 && ratio < 0.85) return 'tall'
  const key = moment.recipeKey || ''
  const count = moment.assetCount || 0
  if (key.startsWith('trip') && count >= 100) return 'wide'
  return 'standard'
}

/**
 * Template selection — determined by size class + featured count n, falling back as n decreases:
 *   n >= 2 → the size class's own template (tall→T2 / wide→T4 / standard→T1)
 *   n == 1 → any size class falls to T3 (cover and the one featured asset side by side),
 *            rather than dropping straight to a single image
 *   n == 0 → single
 */
export function pickMomentTemplate(size: MomentSize, featuredCount: number): MomentTemplate {
  if (featuredCount >= 2) return size === 'tall' ? 'T2' : size === 'wide' ? 'T4' : 'T1'
  if (featuredCount === 1) return 'T3'
  return 'single'
}

/**
 * Main assignment function — walks the list in order, layering a "spacing quota" on top of
 * the content-driven candidate size to break up runs of the same size: if fewer than 3
 * positions have passed since the last wide, or fewer than 2 since the last tall, downgrade
 * to standard, so wide/tall cards don't cluster together.
 *
 * Key point: **only a size that survives the downgrade updates "the position of the last
 * one"** — if a downgraded item were also counted as the baseline, later items would be
 * downgraded in a cascading chain by mistake (one test pins this down specifically).
 */
export function assignMomentSizes(
  moments: MomentLayoutInput[],
): Record<string, { size: MomentSize; template: MomentTemplate }> {
  const map: Record<string, { size: MomentSize; template: MomentTemplate }> = {}
  let lastWideIdx = -Infinity
  let lastTallIdx = -Infinity
  ;(moments || []).forEach((m, idx) => {
    let size = classifyMomentSize(m)
    if (size === 'wide' && idx - lastWideIdx < 3) size = 'standard'
    else if (size === 'tall' && idx - lastTallIdx < 2) size = 'standard'
    if (size === 'wide') lastWideIdx = idx
    if (size === 'tall') lastTallIdx = idx
    const featuredCount = Array.isArray(m.featuredAssetIds) ? m.featuredAssetIds.length : 0
    map[m.id] = { size, template: pickMomentTemplate(size, featuredCount) }
  })
  return map
}
