// Task 6 rewrite (网格重刻): the grid's column geometry follows Vue2 photos.scss:315-317
// exactly — `.grid[data-density]` is a FIXED column count per density
// (`repeat(10/7/4, 1fr)`), density-driven, not a viewport/container-width breakpoint. The
// old SP15-P3 model (`repeat(auto-fill, minmax(Npx, 1fr))`, columns derived from container
// width) is gone: PhotosGrid.vue no longer carries that CSS at all (single source of truth
// is now src/photos/styles/vue2-parity/photos.scss, ported verbatim from NimoOS-UI's
// photos.scss — see gridMetricsCssParity.test.ts, which scans THAT file, not this
// component's <style>, for the literal values below).
//
// These stay pure functions on purpose: jsdom has no layout engine, so an unloaded month's
// placeholder height can only be estimated from these numbers, never read off a real layout
// pass — geometry living inside the component could only ever be tested through its
// degenerate (0-height) path.
export const GRID_COLUMNS = { compact: 10, comfortable: 7, loose: 4 } as const
export const GRID_GAP = { compact: 2, comfortable: 3, loose: 6 } as const

export type Density = keyof typeof GRID_COLUMNS

// `.photos-root .grid` carries `padding: 0 20px 20px` (parity scss) — the fixed columns lay
// out inside that padded box, not across `.photos-wrap`'s full clientWidth. This constant is
// repointed, not new: the OLD CONTENT_INSET (68) used to net out `.photos-wrap`'s own
// `padding-right`, a gutter reserved for the month scrubber, which used to be an absolutely-
// positioned overlay floating ON TOP of `.photos-wrap`. The scrubber is now a separate CSS
// grid column instead (`.content { grid-template-columns: 1fr 66px }`, Vue2 photos.scss:307-
// 311, already the parity scss's structure) — `.photos-wrap` is its own grid track and its
// clientWidth no longer includes the scrubber's 66px at all, so there is nothing left to net
// out for that. What IS still left to net out is `.grid`'s own left+right padding (20+20).
export const CONTENT_INSET = 40

// Used when the container reports width 0: jsdom always does, and a real container does
// momentarily while display:none. Estimating 0 there would give every skeleton zero height,
// leaving the page unscrollable and the on-demand loader with nothing to react to.
export const FALLBACK_CONTAINER_WIDTH = 1200

function gapFor(density: Density | string): number {
  return GRID_GAP[density as Density] ?? GRID_GAP.comfortable
}

function usableWidth(containerWidth: number): number {
  const w = containerWidth > 0 ? containerWidth : FALLBACK_CONTAINER_WIDTH
  return Math.max(1, w - CONTENT_INSET)
}

// Pure lookup — the fixed column count for this density (Vue2 photos.scss:315-317's
// `repeat(10/7/4, 1fr)`). Container width plays no part any more: a density's column count
// is the same whether the grid is 400px or 4000px wide (that is the whole point of "fixed",
// vs. the old auto-fill/minmax model this replaces).
export function columnsFor(density: Density | string): number {
  return GRID_COLUMNS[density as Density] ?? GRID_COLUMNS.comfortable
}

// Tiles are `aspect-ratio: 1`, so the edge length is also the row height.
export function tileEdge(containerWidth: number, density: Density | string): number {
  const gap = gapFor(density)
  const cols = columnsFor(density)
  const w = usableWidth(containerWidth)
  return (w - (cols - 1) * gap) / cols
}

export function estimateSectionBodyHeight(
  count: number, containerWidth: number, density: Density | string,
): number {
  if (count <= 0) return 0
  const gap = gapFor(density)
  const cols = columnsFor(density)
  const rows = Math.ceil(count / cols)
  return rows * tileEdge(containerWidth, density) + (rows - 1) * gap
}

// How many tiles an unrendered section stands in for, on the current tab. Unchanged by this
// task's column-model rewrite: it has never taken a column count as input (it answers "how
// many items", not "how tall those items are") — see estimateSectionBodyHeight above for
// where the new fixed-column geometry actually applies.
export function skeletonItemCount(
  { tab, count, videoCount, loaded, loadedLength }:
  { tab: string; count?: number; videoCount?: number; loaded?: boolean; loadedLength: number },
): number {
  // Synthetic groups (favorites, place assets) and legacy timeline groups carry
  // no directory counts and are always already in hand — their real length is
  // the honest estimate, and using 0 would collapse their placeholder.
  if (count == null) return loaded === false ? 0 : Math.max(0, loadedLength)
  const total = Math.max(0, count)
  const videos = Math.max(0, videoCount ?? 0)
  if (tab === 'all') return total
  if (tab === 'video') return videos
  // The photo tab is this page's default. The directory has no photo-only
  // counter, so it is derived — estimating 0 would stop every month past the
  // first viewport from ever being requested.
  if (tab === 'photo') return Math.max(0, total - videos)
  // The OCR tab ('ocr' — see PhotosToolbar.vue's tab ids, there is no 'doc' tab)
  // has no directory counter at all: the bucket carries count/videoCount but
  // nothing OCR-specific. This function only ever reports what the directory
  // actually knows (the grid also prints it as the month's item count), so the
  // honest answer is 0 — inventing a number here would print a lie in the month
  // head. What the grid does with a 0 is its own decision: see
  // tabHasDirectoryEstimate below and PhotosGrid.vue's hasContent /
  // sectionBodyHeight (spec §5.4).
  return 0
}

// Does the directory carry a counter this tab can be sized from? The bucket
// directory has `count` and `videoCount` and nothing else, so 'all' / 'video' /
// 'photo' are sizable and every other tab (today: 'ocr') is not.
//
// Whole-branch review fix (Important 6): the grid needs this as a distinct
// question from "how many items". On an unsizable tab skeletonItemCount is 0 for
// an unloaded month, which used to make the grid render no container for it — and
// the container is the only thing the IntersectionObserver can watch, so the tab
// could never load anything and permanently claimed the library was empty. The
// grid now keeps the container (sized with a one-row stand-in) on such a tab, so
// loading is still driven and the tab converges.
export function tabHasDirectoryEstimate(tab: string): boolean {
  return tab === 'all' || tab === 'video' || tab === 'photo'
}
