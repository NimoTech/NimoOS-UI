export function containContentRect(elemW: number, elemH: number, natW: number, natH: number): { x: number; y: number; w: number; h: number } | null {
  if (!(elemW > 0) || !(elemH > 0) || !(natW > 0) || !(natH > 0)) return null
  const scale = Math.min(elemW / natW, elemH / natH)
  const w = natW * scale
  const h = natH * scale
  return { x: (elemW - w) / 2, y: (elemH - h) / 2, w, h }
}

export function quadBounds(box: number[]): { x0: number; y0: number; x1: number; y1: number } | null {
  if (!Array.isArray(box) || box.length !== 8) return null
  const xs = [box[0], box[2], box[4], box[6]]
  const ys = [box[1], box[3], box[5], box[7]]
  const x0 = Math.max(0, Math.min(...xs))
  const y0 = Math.max(0, Math.min(...ys))
  const x1 = Math.min(1, Math.max(...xs))
  const y1 = Math.min(1, Math.max(...ys))
  if (x1 <= x0 || y1 <= y0) return null
  return { x0, y0, x1, y1 }
}

export function mapOcrBoxesToRects(
  lines: Array<{ box: number[] }>,
  elemW: number, elemH: number, natW: number, natH: number,
): Array<{ left: number; top: number; width: number; height: number }> {
  const content = containContentRect(elemW, elemH, natW, natH)
  if (!content) return []
  const rects: Array<{ left: number; top: number; width: number; height: number }> = []
  for (const line of lines || []) {
    const b = quadBounds(line && line.box)
    if (!b) continue
    rects.push({
      left: content.x + b.x0 * content.w,
      top: content.y + b.y0 * content.h,
      width: (b.x1 - b.x0) * content.w,
      height: (b.y1 - b.y0) * content.h,
    })
  }
  return rects
}
