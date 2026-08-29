export interface Rect { left: number; top: number; right: number; bottom: number }
export interface ItemRect { path: string; rect: Rect }

export function rectFromPoints(x1: number, y1: number, x2: number, y2: number): Rect {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    right: Math.max(x1, x2),
    bottom: Math.max(y1, y2),
  }
}

// Standard AABB strict intersection (edge touching does not count)
function overlaps(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

export function marqueeSelect(items: ItemRect[], selRect: Rect): string[] {
  return items.filter((it) => overlaps(it.rect, selRect)).map((it) => it.path)
}
