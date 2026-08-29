import type { LayoutItem } from './types'

// Linearizes desktop layout in visual order (row first, then column) — source of phone
// launcher sort order. Does not mutate input; stable under ties (sort is stable in modern engines).
export function linearizeLayout(items: LayoutItem[]): LayoutItem[] {
  return [...items].sort((a, b) => a.r - b.r || a.c - b.c)
}
