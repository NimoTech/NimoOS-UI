const MAG_AMP = 0.55, MAG_SIGMA = 70
// engine.js 1142-1148
export function magScale(distance: number): number {
  return 1 + MAG_AMP * Math.exp(-(distance * distance) / (2 * MAG_SIGMA * MAG_SIGMA))
}

export interface DockSlot { key: string; midX: number }

/**
 * Decides where a dragged dock icon would land.
 *
 * `sepMidX` is the midpoint of the separator between the favourites and "more"
 * zones: a drop to its left targets 'fav', otherwise 'more'. Within the chosen
 * zone the nearest slot by midX wins, and the icon goes before it when the
 * pointer is to its left, otherwise to the end (`beforeKey === null`).
 *
 * Lifted out of HomeDock's computeDropTarget so the insertion preview and the
 * drop itself are driven by one decision, and so the decision is testable at all
 * — jsdom reports every getBoundingClientRect as 0.
 */
export function dropTarget(
  clientX: number,
  sepMidX: number | null,
  favSlots: DockSlot[],
  moreSlots: DockSlot[],
): { toZone: 'fav' | 'more'; beforeKey: string | null } {
  const toZone: 'fav' | 'more' = sepMidX != null && clientX < sepMidX ? 'fav' : 'more'
  const slots = toZone === 'fav' ? favSlots : moreSlots
  if (slots.length === 0) return { toZone, beforeKey: null }
  let best = slots[0]
  let bestDist = Math.abs(clientX - best.midX)
  for (const s of slots) {
    const d = Math.abs(clientX - s.midX)
    if (d < bestDist) { bestDist = d; best = s }
  }
  return { toZone, beforeKey: clientX < best.midX ? best.key : null }
}
