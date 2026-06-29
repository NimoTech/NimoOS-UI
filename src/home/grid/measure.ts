// 移植 engine.js 367
export function computeCell(availW: number, availH: number, cols: number, rows: number, gap: number): number {
  return Math.max(
    40,
    Math.floor(Math.min((availW - (cols - 1) * gap) / cols, (availH - (rows - 1) * gap) / rows)),
  )
}
