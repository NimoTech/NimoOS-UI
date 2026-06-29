import type { LayoutItem, Dims, Pos, PlanEntry } from './types'

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

// 移植 engine.js 410-428
export function planFootprint(
  c: number, r: number, w: number, h: number,
  movId: string | null, layout: LayoutItem[], dims: Dims,
): LayoutItem[] | null {
  if (c < 1 || r < 1 || c + w - 1 > dims.cols || r + h - 1 > dims.rows) return null
  const items = layout.filter((it) => it.id !== movId).map((it) => ({ ...it }))
  const occ = new Set<string>()
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) occ.add(`${c + x},${r + y}`)
  const displaced: LayoutItem[] = []
  items.forEach((it) => {
    const cs = cells(it)
    if (cs.some((k) => occ.has(k))) displaced.push(it)
    else cs.forEach((k) => occ.add(k))
  })
  for (const it of displaced) {
    const pos = firstFreeIn(occ, it.w, it.h, dims)
    if (!pos) return null
    it.c = pos.c; it.r = pos.r
    cells(it).forEach((k) => occ.add(k))
  }
  return items
}

// 移植 engine.js 430-434
export function planMove(
  movId: string, c: number, r: number, w: number, h: number,
  layout: LayoutItem[], dims: Dims,
): PlanEntry[] | null {
  const others = planFootprint(c, r, w, h, movId, layout, dims)
  if (!others) return null
  return (others as PlanEntry[]).concat([{ id: movId, c, r, w, h }])
}

// 纯:返回新数组,不改入参(原型 engine 436-439 是就地改;此处纯化由 store 替换)
export function applyPlan(plan: PlanEntry[], layout: LayoutItem[]): LayoutItem[] {
  const m = Object.fromEntries(plan.map((p) => [p.id, p]))
  return layout.map((it) => {
    const p = m[it.id]
    if (!p) return it
    return { ...it, c: p.c, r: p.r, ...(p.w ? { w: p.w } : {}), ...(p.h ? { h: p.h } : {}) }
  })
}
