// Radar circle geometry: character-by-character port of Vue2 DropItem.positionStyle and DropPage.resize math.
const RATIO = 1.86
const GAP = 120
const BOTTOM_GAP = 144

export const DISPLAY_ORDER = [8, 6, 2, 3, 1, 7, 4, 0, 9, 5] // Vue2 desktop initIndexArray

export function positionFor(index: number, radius: number, center: { x: number; y: number }): { left: string; top: string } {
  const angle = index < 5 ? 30 * (index + 1) : 45 * (index % 5)
  const realRadius = index < 5 ? radius : radius / RATIO
  return {
    left: center.x + (realRadius / 2) * Math.cos((angle * Math.PI) / 180) + 'px',
    top: center.y - (realRadius / 2) * Math.sin((angle * Math.PI) / 180) + 'px',
  }
}

export function contentsBox(areaW: number, areaH: number): {
  width: number; height: number; radius: number; center: { x: number; y: number }
} {
  const cWidth = areaW - GAP
  const cHeight = areaH - GAP / 2 - BOTTOM_GAP
  let width: number, height: number
  if (cWidth > cHeight * 2) { width = cHeight * 2; height = cHeight + BOTTOM_GAP }
  else { width = cWidth; height = cWidth / 2 + BOTTOM_GAP }
  return { width, height, radius: width, center: { x: width / 2, y: height - BOTTOM_GAP } }
}
