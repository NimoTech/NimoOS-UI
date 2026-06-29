import type { LayoutItem, Dims, Pos } from './types'

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

// 移植 engine.js 394-397
export function firstFree(w: number, h: number, layout: LayoutItem[], dims: Dims): Pos | null {
  for (let r = 1; r <= dims.rows - h + 1; r++)
    for (let c = 1; c <= dims.cols - w + 1; c++)
      if (fits(c, r, w, h, null, layout, dims)) return { c, r }
  return null
}

// 移植 engine.js 399-406
export function firstFreeIn(occ: Set<string>, w: number, h: number, dims: Dims): Pos | null {
  for (let r = 1; r <= dims.rows - h + 1; r++)
    for (let c = 1; c <= dims.cols - w + 1; c++) {
      let ok = true
      for (let x = 0; x < w && ok; x++) for (let y = 0; y < h && ok; y++) if (occ.has(`${c + x},${r + y}`)) ok = false
      if (ok) return { c, r }
    }
  return null
}
