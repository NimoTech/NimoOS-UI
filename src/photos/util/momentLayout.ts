// Moments mosaic layout engine — a pure function, no Date/random/DOM dependency.
// Ported line-by-line from the Vue 2 panel 899af59b:src/views/Photos/PhotosSmartViewsView.vue:322-357
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

// Masonry packer. Ported from no prior source (new-UI-
// only; Vue2's PhotosSmartViewsView.vue relies on the same CSS-only `grid-auto-flow: row dense`
// this replaces, so there is nothing to port here).
//
// Root cause it fixes: the `.mo-grid` CSS (photos-smartview.scss:132-146, byte-identical between
// Vue2 and this repo) sizes standard/wide/tall cards via `grid-row: span 3/5` + `grid-column:
// span 2`, and previously left the browser's own `grid-auto-flow: row dense` heuristic to pick
// each card's actual position. That heuristic places items strictly in DOM order and, for each
// one, claims the FIRST (leftmost, earliest-row) free slot it finds — once two columns become
// free at the same row, the leftmost one wins the tie even when a later item could have used
// either. A column that loses that tie can then sit completely empty for several rows, because
// nothing forces a *later* single-column item to backfill it over some other, also-free column
// — it only gets reclaimed once an item that specifically needs that exact column combination
// (e.g. a 2-column wide card) finally comes along needing both of its tracks free at once. The
// result: a large visible void above a card in one column while its neighbours look tightly (or,
// by contrast, oddly cramped) packed. Confirmed reproducible with `.mo-grid`'s exact production
// CSS via getBoundingClientRect measurement in an isolated repro (16 mock moments, realistic
// wide/tall spacing) — not a light/dark theme issue (both themes share the identical grid math);
// the reported light-theme screenshot just happened to be the one that got checked.
//
// This packer is a "shortest column" skyline bin-packer with backfill: for every item, in DOM
// order, it scans every valid column start (0..cols-colSpan) and picks whichever position has
// the LOWEST current height (ties keep the leftmost, matching the existing reading-order
// expectation), so a column that falls behind is always the next one reclaimed, by construction
// — this alone already eliminates the specific multi-row void the CSS-only version produced
// (confirmed: the realistic-mix test below never sees a gap anywhere close to that size).
//
// One residual case the plain shortest-column rule does NOT avoid on its own: placing a 2-column
// (wide) item forces BOTH of its columns to the taller of the two — the shorter one jumps
// straight to that height, leaving a small gap of its own underneath the wide card. This is
// recorded per column (`gaps`) and offered to every later SINGLE-column item first, before that
// item falls back to "shortest column" — so a small standard/tall card landing later can still
// backfill it. What backfill *cannot* do is manufacture a card small enough for a gap smaller
// than the smallest rowSpan actually in play (3, for a standard card) — a 1-2 row leftover is a
// genuine geometric remainder of this system's own discrete row units (rowSpan only ever 3 or
// 5), not a missed placement; it is bounded (never larger than one item's own rowSpan) and
// nowhere near the original bug's multi-row/many-hundred-pixel voids. Column heights are tracked
// in row-track units (`grid-auto-rows: 132px`), not pixels — the two-value inputs are exactly the
// same numbers the removed CSS spans encoded (colSpan 1|2, rowSpan 3|5), so visual card sizes
// stay pixel-identical to before; only each card's *position* changes from "browser's implicit
// guess" to "explicitly computed, backfilled". `numColumns` is supplied by the caller (measured
// from the live container width — see PhotosSmartViews.vue), since it depends on live layout, not
// something this pure module can know on its own.
export interface MasonrySpan { colSpan: 1 | 2; rowSpan: number }
export interface MasonryItem extends MasonrySpan { id: string }
// colSpan/rowSpan echo the SPAN ACTUALLY APPLIED (post narrow-container clamp — see the
// `Math.min(item.colSpan, cols)` below), not necessarily the input's own colSpan/rowSpan — the
// caller (PhotosSmartViews.vue) needs this to build each card's `grid-column`/`grid-row` CSS
// value without re-deriving the same clamp itself.
export interface MasonryPlacement { colStart: number; rowStart: number; colSpan: number; rowSpan: number }

/** size -> {colSpan, rowSpan}, the exact numbers `.mo-grid .mo-card`/`-wide`/`.mo-card-tall`
 *  (photos-smartview.scss:144-146) used to encode as CSS spans. */
export function spanForMomentSize(size: MomentSize): MasonrySpan {
  if (size === 'wide') return { colSpan: 2, rowSpan: 3 }
  if (size === 'tall') return { colSpan: 1, rowSpan: 5 }
  return { colSpan: 1, rowSpan: 3 }
}

export function packMasonry(items: MasonryItem[], numColumns: number): Record<string, MasonryPlacement> {
  const cols = Math.max(1, Math.floor(numColumns) || 1)
  const colHeights = new Array<number>(cols).fill(0)
  // Per-column list of unfilled row-intervals left behind by a wide item's shorter neighbour
  // (see the header comment above) — offered to later single-column items before they fall back
  // to "shortest column". Kept sorted by start; each column's list rarely holds more than one
  // entry in practice, but nothing here assumes that.
  const gaps: Array<{ start: number; end: number }>[] = Array.from({ length: cols }, () => [])
  const result: Record<string, MasonryPlacement> = {}

  for (const item of items) {
    // A wide card degrades to 1 column when the container can't offer 2 (same intent as the
    // deleted `@media (max-width: 1055px) { .mo-card-wide { grid-column: span 1 } }` fallback —
    // this is the exact replacement for that rule, now driven by the real measured column count
    // instead of a fixed viewport breakpoint approximating it).
    const span = Math.max(1, Math.min(item.colSpan, cols))

    if (span === 1) {
      const backfilled = tryBackfill(gaps, item.rowSpan)
      if (backfilled) {
        result[item.id] = { colStart: backfilled.col + 1, rowStart: backfilled.start + 1, colSpan: 1, rowSpan: item.rowSpan }
        continue
      }
    }

    let bestStart = 0
    let bestHeight = Infinity
    for (let c = 0; c <= cols - span; c++) {
      let h = 0
      for (let k = 0; k < span; k++) h = Math.max(h, colHeights[c + k])
      if (h < bestHeight) {
        bestHeight = h
        bestStart = c
      }
    }
    for (let k = 0; k < span; k++) {
      const c = bestStart + k
      // This column was shorter than its (wide) neighbour — the shortfall becomes a pending
      // backfill opportunity for a later single-column item, rather than a silent, permanent void.
      if (colHeights[c] < bestHeight) gaps[c].push({ start: colHeights[c], end: bestHeight })
      colHeights[c] = bestHeight + item.rowSpan
    }
    result[item.id] = { colStart: bestStart + 1, rowStart: bestHeight + 1, colSpan: span, rowSpan: item.rowSpan }
  }
  return result
}

/** Finds the earliest (leftmost column, then earliest row) pending gap that fits `rowSpan`,
 *  consumes (shrinks or removes) it, and returns where the item lands — or null if no gap fits,
 *  in which case the caller falls back to its normal shortest-column placement. */
function tryBackfill(
  gaps: Array<{ start: number; end: number }>[],
  rowSpan: number,
): { col: number; start: number } | null {
  for (let c = 0; c < gaps.length; c++) {
    const list = gaps[c]
    for (let i = 0; i < list.length; i++) {
      const g = list[i]
      if (g.end - g.start < rowSpan) continue
      const start = g.start
      const remainderStart = start + rowSpan
      if (remainderStart < g.end) list[i] = { start: remainderStart, end: g.end }
      else list.splice(i, 1)
      return { col: c, start }
    }
  }
  return null
}
