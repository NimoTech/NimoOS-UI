import type { LayoutItem, Dims } from './types'

// 移植 engine.js 386
export function cells(it: { c: number; r: number; w: number; h: number }): string[] {
  const out: string[] = []
  for (let x = 0; x < it.w; x++) for (let y = 0; y < it.h; y++) out.push(`${it.c + x},${it.r + y}`)
  return out
}

// 移植 engine.js 387
export function occupiedSet(layout: LayoutItem[], exceptId: string | null): Set<string> {
  const s = new Set<string>()
  layout.forEach((it) => { if (it.id !== exceptId) cells(it).forEach((k) => s.add(k)) })
  return s
}

// 移植 engine.js 388-393
export function fits(
  c: number, r: number, w: number, h: number,
  exceptId: string | null, layout: LayoutItem[], dims: Dims,
): boolean {
  if (c < 1 || r < 1 || c + w - 1 > dims.cols || r + h - 1 > dims.rows) return false
  const occ = occupiedSet(layout, exceptId)
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (occ.has(`${c + x},${r + y}`)) return false
  return true
}
