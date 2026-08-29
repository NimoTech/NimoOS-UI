// 1:1 ported from Vue2 src/views/AI/Agent/blocks/ContextUsageBar.vue:2-28
// Pure geometry/formatting for the context-usage ring, extracted so the
// component (a later task) only wires props → these functions.

/** SVG ring radius (viewBox 0 0 36 36, matches ContextUsageBar.vue's <circle r="15.5">). */
export const RING_R = 15.5

/** Ring circumference. */
export const RING_C = 2 * Math.PI * RING_R

/** '1.2K' style compaction for token counts >= 1000; plain digits below that. */
export function formatTokens(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
  }
  return String(n)
}

/** Usage-severity bucket for the ring color (>=90 danger, >=70 warn, else ok). */
export function levelFor(pct: number): 'ok' | 'warn' | 'danger' {
  return pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : 'ok'
}

/** `stroke-dasharray` value: "<filled> <circumference>", pct clamped to [0,100]. */
export function dashArrayFor(pct: number): string {
  const p = Math.min(100, Math.max(0, pct))
  const filled = (p / 100) * RING_C
  return `${filled.toFixed(2)} ${RING_C.toFixed(2)}`
}
