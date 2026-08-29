import type { ItemRect } from './marquee'

// Marquee selection used to measure real DOM nodes. Once the grid is
// virtualized the off-screen rows have no nodes at all, so their rects have to
// be derived from the layout instead -- otherwise dragging past the viewport
// silently selects nothing.
//
// Coordinates are VIEWPORT coordinates, because the selection rectangle comes
// from pointer clientX/clientY. `originLeft`/`originTop` are the grid
// container's own getBoundingClientRect(), which already moves with scrolling.
//
// Note the asymmetry: `colWidth` is the card's own width so the horizontal step
// adds `gap`, while `rowHeight` is already the full vertical step (card + gap)
// because that is what the component measures.
export function rectsFromGeometry({
  paths,
  cols,
  colWidth,
  rowHeight,
  gap,
  originLeft,
  originTop,
}: {
  paths: string[]
  cols: number
  colWidth: number
  rowHeight: number
  gap: number
  originLeft: number
  originTop: number
}): ItemRect[] {
  const n = Math.max(1, Math.floor(cols) || 1)
  return paths.map((path, i) => {
    const row = Math.floor(i / n)
    const col = i % n
    const left = originLeft + col * (colWidth + gap)
    const top = originTop + row * rowHeight
    return { path, rect: { left, top, right: left + colWidth, bottom: top + rowHeight } }
  })
}
