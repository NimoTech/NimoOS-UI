// T12b (merge-review face-locate line, 2026-08-27 addendum to the detector-gen6-static-faces
// plan): maps a merge-question preview face's normalized bbox [x1,y1,x2,y2] (backend T12a,
// clamped to [0,1] of the DISPLAYED image's aspect space) onto the pixel rect of the lightbox
// <img>'s rendered content frame -- i.e. the actual visible-photo rectangle inside the <img>
// element's own (possibly letterboxed, object-fit:contain) box. Reuses ocrHighlight.ts's
// containContentRect (same letterbox math the OCR highlight overlay already relies on) rather
// than duplicating it.
import { containContentRect } from './ocrHighlight'

export interface FaceRect {
  left: number
  top: number
  width: number
  height: number
}

// T12c (suggestion-card face-locate box, 2026-08-28 addendum): the suggestion card's INLINE
// context photo (`.prw-context-img`) is object-fit:cover, not the lightbox's object-fit:contain
// -- the rendered image fills its box edge-to-edge and overflows on one axis (clipped by the
// wrap's overflow:hidden) rather than letterboxing. Same centered-scale shape as
// containContentRect, just scale=max(...) instead of min(...), so the content frame's origin can
// legitimately land negative/beyond the element bounds (the overflow that gets clipped) --
// mapFaceBoxToRect below still composes it identically with the box coordinates.
function coverContentRect(elemW: number, elemH: number, natW: number, natH: number): { x: number; y: number; w: number; h: number } | null {
  if (!(elemW > 0) || !(elemH > 0) || !(natW > 0) || !(natH > 0)) return null
  const scale = Math.max(elemW / natW, elemH / natH)
  const w = natW * scale
  const h = natH * scale
  return { x: (elemW - w) / 2, y: (elemH - h) / 2, w, h }
}

/**
 * box: normalized [x1, y1, x2, y2]. elemW/elemH: the <img>'s own rendered box (clientWidth/
 * clientHeight). natW/natH: the image's intrinsic pixel size (naturalWidth/naturalHeight).
 * fit: which object-fit mode the <img> itself uses -- 'contain' (default, the lightbox's own
 * letterboxed frame) or 'cover' (T12c's inline context photo, see coverContentRect above).
 * Returns null whenever the box is malformed (wrong length, non-finite coordinate, reversed/
 * zero-area) or the element/natural dimensions can't produce a content frame -- callers treat
 * null exactly like "no bbox at all" (fail-open, no overlay rendered).
 */
export function mapFaceBoxToRect(
  box: number[], elemW: number, elemH: number, natW: number, natH: number, fit: 'contain' | 'cover' = 'contain',
): FaceRect | null {
  if (!Array.isArray(box) || box.length !== 4) return null
  const [x1, y1, x2, y2] = box
  if (![x1, y1, x2, y2].every((n) => typeof n === 'number' && Number.isFinite(n))) return null
  if (!(x1 < x2) || !(y1 < y2)) return null
  const content = fit === 'cover' ? coverContentRect(elemW, elemH, natW, natH) : containContentRect(elemW, elemH, natW, natH)
  if (!content) return null
  return {
    left: content.x + x1 * content.w,
    top: content.y + y1 * content.h,
    width: (x2 - x1) * content.w,
    height: (y2 - y1) * content.h,
  }
}
