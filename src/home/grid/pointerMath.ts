import type { Dims } from './types'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

// engine.js 796-797
export function dragCell(localX: number, localY: number, w: number, h: number, stride: number, dims: Dims): { c: number; r: number } {
  return {
    c: clamp(Math.round(localX / stride) + 1, 1, dims.cols - w + 1),
    r: clamp(Math.round(localY / stride) + 1, 1, dims.rows - h + 1),
  }
}

// engine.js 781-784 (不含 clampSize)
export function resizeSize(localX: number, localY: number, c: number, r: number, stride: number, dims: Dims): [number, number] {
  return [
    clamp(Math.round(localX / stride) - (c - 1), 1, dims.cols - c + 1),
    clamp(Math.round(localY / stride) - (r - 1), 1, dims.rows - r + 1),
  ]
}
