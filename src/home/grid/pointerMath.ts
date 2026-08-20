import type { Dims } from './types'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

// engine.js 796-797
export function dragCell(localX: number, localY: number, w: number, h: number, stride: number, dims: Dims): { c: number; r: number } {
  return {
    c: clamp(Math.round(localX / stride) + 1, 1, dims.cols - w + 1),
    r: clamp(Math.round(localY / stride) + 1, 1, dims.rows - h + 1),
  }
}

// engine.js 781-784 (excluding clampSize)
export function resizeSize(localX: number, localY: number, c: number, r: number, stride: number, dims: Dims): [number, number] {
  return [
    clamp(Math.round(localX / stride) - (c - 1), 1, dims.cols - c + 1),
    clamp(Math.round(localY / stride) - (r - 1), 1, dims.rows - r + 1),
  ]
}

/**
 * Pointer position to grid cell, or null when the pointer is not over the grid.
 *
 * Shared by the add-panel's spawn drag and the dock's drag-onto-the-desktop, which
 * must agree: both use the answer to decide whether a release counts as a
 * placement at all, and null is what "not over the grid" means. Clamping keeps a
 * multi-cell item from starting where it would hang off the edge.
 */
export function cellAtPointer(
  clientX: number, clientY: number,
  rect: { left: number; top: number; right: number; bottom: number },
  size: { w: number; h: number },
  grid: { cell: number; gap: number; cols: number; rows: number },
): { tc: number; tr: number } | null {
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null
  const step = grid.cell + grid.gap
  return {
    tc: clamp(Math.round((clientX - rect.left - grid.cell / 2) / step) + 1, 1, grid.cols - size.w + 1),
    tr: clamp(Math.round((clientY - rect.top - grid.cell / 2) / step) + 1, 1, grid.rows - size.h + 1),
  }
}
