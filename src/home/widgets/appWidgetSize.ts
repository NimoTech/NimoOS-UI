import type { WidgetSize } from '../grid/types'

// 第三方应用 iframe 小组件的全局硬边界(spec §3 夹紧规则)——从 registry.ts 移入
export const APP_WIDGET_SIZE: WidgetSize = { min: [2, 1], max: [4, 4] }

export interface AppWidgetRangeDecl { minw?: number; minh?: number; maxw?: number; maxh?: number }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** label 声明的自定义可调整范围 → 有效范围:缺省轴补全局值,越界夹进全局,min>max 时 min 说了算。 */
export function appWidgetRange(w?: AppWidgetRangeDecl): WidgetSize {
  if (!w || (!w.minw && !w.minh && !w.maxw && !w.maxh)) return APP_WIDGET_SIZE
  const g = APP_WIDGET_SIZE
  const minw = clamp(w.minw || g.min[0], g.min[0], g.max[0])
  const minh = clamp(w.minh || g.min[1], g.min[1], g.max[1])
  const maxw = Math.max(minw, clamp(w.maxw || g.max[0], g.min[0], g.max[0]))
  const maxh = Math.max(minh, clamp(w.maxh || g.max[1], g.min[1], g.max[1]))
  return { min: [minw, minh], max: [maxw, maxh] }
}
