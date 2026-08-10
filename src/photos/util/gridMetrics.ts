// SP15-P3 geometry. The photo grid is `repeat(auto-fill, minmax(Npx, 1fr))`, so
// its column count depends on the container width — an unloaded month's
// placeholder height can only be estimated, never read off a constant table.
// These are pure functions on purpose: jsdom has no layout engine, so geometry
// living inside the component could only ever be tested through its degenerate
// path.
//
// This table is the single source of truth for the numbers that also appear in
// PhotosGrid.vue's <style>. gridMetricsCssParity.test.ts fails if the two drift,
// because a silent drift here makes every placeholder the wrong height and no
// other gate can see it.
export const GRID_METRICS = {
  comfortable: { minColWidth: 140, gap: 4 },
  compact: { minColWidth: 96, gap: 2 },
  loose: { minColWidth: 200, gap: 10 },
} as const

export type Density = keyof typeof GRID_METRICS

// .photos-wrap has `padding-right: 68px` (the month scrubber floats over it), and
// clientWidth includes padding — subtract it to get the width the grid actually
// lays out in.
export const CONTENT_INSET = 68

// Used when the container reports width 0: jsdom always does, and a real
// container does momentarily while display:none. Estimating 0 there would give
// every skeleton zero height, leaving the page unscrollable and the on-demand
// loader with nothing to react to.
export const FALLBACK_CONTAINER_WIDTH = 1200

// .month-head is `padding: 4px 2px 10px` around a 15px/600 title — about 32px
// tall. Only an estimate, and only used until a section has rendered once: after
// that the grid remembers its measured height instead.
export const MONTH_HEAD_HEIGHT = 32

function metricsFor(density: string): { minColWidth: number; gap: number } {
  return GRID_METRICS[density as Density] ?? GRID_METRICS.comfortable
}

function usableWidth(containerWidth: number): number {
  const w = containerWidth > 0 ? containerWidth : FALLBACK_CONTAINER_WIDTH
  return Math.max(1, w - CONTENT_INSET)
}

export function columnsFor(containerWidth: number, density: string): number {
  const { minColWidth, gap } = metricsFor(density)
  const w = usableWidth(containerWidth)
  return Math.max(1, Math.floor((w + gap) / (minColWidth + gap)))
}

// Tiles are `aspect-ratio: 1`, so the edge length is also the row height.
export function tileEdge(containerWidth: number, density: string): number {
  const { gap } = metricsFor(density)
  const cols = columnsFor(containerWidth, density)
  const w = usableWidth(containerWidth)
  return (w - (cols - 1) * gap) / cols
}

export function estimateSectionBodyHeight(
  { containerWidth, density, itemCount }: { containerWidth: number; density: string; itemCount: number },
): number {
  if (itemCount <= 0) return 0
  const { gap } = metricsFor(density)
  const cols = columnsFor(containerWidth, density)
  const rows = Math.ceil(itemCount / cols)
  return rows * tileEdge(containerWidth, density) + (rows - 1) * gap
}

// How many tiles an unrendered section stands in for, on the current tab.
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
  // nothing OCR-specific, so this branch cannot estimate and returns 0, which
  // means an unloaded month never gets a skeleton on that tab and stays hidden
  // until it is actually loaded (registered limitation, see the P3 spec §5.4).
  return 0
}
