// Mirrors what `grid-template-columns: repeat(auto-fill, minmax(N, 1fr))` does,
// so the virtualized geometry lines up with what CSS actually lays out.
export function columnsFor(containerWidth: number, minColWidth: number, gap: number): number {
  if (!(containerWidth > 0) || !(minColWidth > 0)) return 1
  return Math.max(1, Math.floor((containerWidth + gap) / (minColWidth + gap)))
}

export function chunkRows<T>(list: T[], cols: number): T[][] {
  const n = Math.max(1, Math.floor(cols) || 1)
  const rows: T[][] = []
  if (!Array.isArray(list)) return rows
  for (let i = 0; i < list.length; i += n) rows.push(list.slice(i, i + n))
  return rows
}

// `end` is exclusive. A row height of 0 means "not measured yet": render the
// whole list in that case, because rendering nothing would leave a blank grid
// that never recovers -- the measurement itself comes from a rendered row.
export function computeVisibleRange({
  scrollTop,
  viewportHeight,
  rowHeight,
  rowCount,
  buffer,
}: {
  scrollTop: number
  viewportHeight: number
  rowHeight: number
  rowCount: number
  buffer: number
}): { start: number; end: number } {
  if (rowCount <= 0) return { start: 0, end: 0 }
  if (!(rowHeight > 0)) return { start: 0, end: rowCount }
  const top = Math.max(0, scrollTop)
  const first = Math.floor(top / rowHeight)
  const last = Math.ceil((top + Math.max(0, viewportHeight)) / rowHeight)
  return {
    start: Math.max(0, Math.min(rowCount, first - buffer)),
    end: Math.max(0, Math.min(rowCount, last + buffer)),
  }
}
