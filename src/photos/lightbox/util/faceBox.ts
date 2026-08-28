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

/**
 * box: normalized [x1, y1, x2, y2]. elemW/elemH: the <img>'s own rendered box (clientWidth/
 * clientHeight). natW/natH: the image's intrinsic pixel size (naturalWidth/naturalHeight).
 * Returns null whenever the box is malformed (wrong length, non-finite coordinate, reversed/
 * zero-area) or the element/natural dimensions can't produce a content frame -- callers treat
 * null exactly like "no bbox at all" (fail-open, no overlay rendered).
 */
export function mapFaceBoxToRect(
  box: number[], elemW: number, elemH: number, natW: number, natH: number,
): FaceRect | null {
  if (!Array.isArray(box) || box.length !== 4) return null
  const [x1, y1, x2, y2] = box
  if (![x1, y1, x2, y2].every((n) => typeof n === 'number' && Number.isFinite(n))) return null
  if (!(x1 < x2) || !(y1 < y2)) return null
  const content = containContentRect(elemW, elemH, natW, natH)
  if (!content) return null
  return {
    left: content.x + x1 * content.w,
    top: content.y + y1 * content.h,
    width: (x2 - x1) * content.w,
    height: (y2 - y1) * content.h,
  }
}
