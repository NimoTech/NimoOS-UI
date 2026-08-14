import type { WidgetSize } from '../grid/types'

// Global hard bounds for third-party app iframe widgets (spec §3 clamping rules) — moved in from registry.ts
export const APP_WIDGET_SIZE: WidgetSize = { min: [2, 1], max: [4, 4] }

export interface AppWidgetRangeDecl { minw?: number; minh?: number; maxw?: number; maxh?: number }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Custom resizable range declared via labels → effective range: missing axes fall back to global values, out-of-range values are clamped into the global bounds, and when min>max the min wins. */
export function appWidgetRange(w?: AppWidgetRangeDecl): WidgetSize {
  if (!w || (!w.minw && !w.minh && !w.maxw && !w.maxh)) return APP_WIDGET_SIZE
  const g = APP_WIDGET_SIZE
  const minw = clamp(w.minw || g.min[0], g.min[0], g.max[0])
  const minh = clamp(w.minh || g.min[1], g.min[1], g.max[1])
  const maxw = Math.max(minw, clamp(w.maxw || g.max[0], g.min[0], g.max[0]))
  const maxh = Math.max(minh, clamp(w.maxh || g.max[1], g.min[1], g.max[1]))
  return { min: [minw, minh], max: [maxw, maxh] }
}
