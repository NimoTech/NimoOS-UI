const MAG_AMP = 0.55, MAG_SIGMA = 70
// engine.js 1142-1148
export function magScale(distance: number): number {
  return 1 + MAG_AMP * Math.exp(-(distance * distance) / (2 * MAG_SIGMA * MAG_SIGMA))
}

export interface DockSlot { key: string; midX: number }

/**
 * One measurement of the dock's slot geometry: the separator's midpoint and the
 * midpoint of every slot in each zone, with the dragged icon left out.
 *
 * It exists as a value object because the drag must measure it exactly once, when
 * it starts, and then hand the same numbers to both the live preview and the drop.
 * Measuring per pointermove fed the insertion placeholder back into its own input
 * (see `dropTargetIn`).
 */
export interface DockGeometry {
  sepMidX: number | null
  favSlots: DockSlot[]
  moreSlots: DockSlot[]
}

export type DropDecision = { toZone: 'fav' | 'more'; beforeKey: string | null }

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
): DropDecision {
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

/**
 * `dropTarget` against one immutable geometry snapshot.
 *
 * The preview and the drop must be the same decision, and the only way to
 * guarantee that is to resolve both from geometry that the preview cannot change.
 * `.dock` is `position: fixed; left: 50%; transform: translateX(-50%)` with a
 * shrink-to-fit width, and the insertion placeholder is an in-flow `.dock-app`, so
 * showing it moves the very midpoints a live measurement would read. Driven
 * against real Chromium layout that feedback loop had no fixed point: at
 * `--app-size: 64px` with five icons in the "more" zone (pitch 83.2px, midpoints
 * 479 / 562 / 646 / 729 / 812) the decision alternated between "insert before the
 * third icon" and "append" on every pointermove for 12 of 38 sampled pointer
 * positions — and because the drop re-measured while the placeholder was still in
 * the DOM, it landed on the opposite of what had just been previewed.
 */
export function dropTargetIn(clientX: number, geom: DockGeometry): DropDecision {
  return dropTarget(clientX, geom.sepMidX, geom.favSlots, geom.moreSlots)
}
