// Ported verbatim (logic unchanged, types added) from the Vue 2 panel
// src/views/Photos/hoverScrub.js (whole file, 36 lines).

// Maps the pointer's horizontal position to a frame index [0, frameCount-1]
export function computeFrameFromX(clientX: number, rectLeft: number, rectWidth: number, frameCount: number): number {
  if (rectWidth <= 0 || frameCount <= 0) return 0
  const p = (clientX - rectLeft) / rectWidth
  const idx = Math.floor(p * frameCount)
  if (idx < 0) return 0
  if (idx > frameCount - 1) return frameCount - 1
  return idx
}

// Size of the window (exactly one frame) inside the square tile -- doesn't depend on pixel measurement.
//
// Key point: the overlay (.sprite-window) is shrunk via `contain` to exactly one frame and
// centered by its parent; the letterboxing bars come naturally from the underlying tile's
// #000 background -- rather than stretching the whole sprite strip across the tile (which
// would make portrait frames very narrow, letting adjacent frames leak into the window and
// "bleed through"). Window width = one frame -> the inner <img>'s translation only ever
// reveals the current frame, with neighboring frames landing outside the window and clipped.
//
// `contain` inside the square tile: landscape (ar>=1) fills the width, height scales
// proportionally; portrait (ar<1) fills the height, width scales proportionally.
export function computeWindowStyle(frameW: number, frameH: number): { width: string; height: string } {
  const ar = frameW / frameH
  return {
    width: ar >= 1 ? '100%' : `${100 * ar}%`,
    height: ar >= 1 ? `${100 / ar}%` : '100%',
  }
}

// The full sprite-strip <img>: width = N x window width (each frame exactly fills the window),
// shifted to frame i via translateX. The transform percentage is relative to the element's own
// width: frame i -> -i/N. transform is a compositor property, so switching frames never
// triggers a repaint (background-position is paint-level, and used to be the main cause of
// hover-scrub jank).
export function computeStripStyle(frameCount: number, currentFrame: number): { width: string; transform: string } {
  const N = Math.max(1, frameCount)
  return {
    width: `${N * 100}%`,
    transform: `translateX(${-(100 * currentFrame) / N}%)`,
  }
}
