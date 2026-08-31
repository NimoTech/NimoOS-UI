// The dock's fisheye magnification, switched off by design and kept
// rather than deleted so it can be restored. Its only caller was HomeDock's
// pointermove handler, which is commented out alongside it.
// const MAG_AMP = 0.55, MAG_SIGMA = 70
// // engine.js 1142-1148
// export function magScale(distance: number): number {
//   return 1 + MAG_AMP * Math.exp(-(distance * distance) / (2 * MAG_SIGMA * MAG_SIGMA))
// }

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
 * zone the icon lands before the first slot whose midpoint the pointer has not
 * yet passed, and at the end (`beforeKey === null`) once it has passed them all.
 *
 * That "first slot not yet passed" is the whole rule, and it is worth stating
 * because the obvious-looking alternative is wrong. This used to pick the
 * *nearest* slot and then ask whether the pointer was left or right of it,
 * appending whenever it was to the right — so standing in the right half of any
 * icon's cell sent the insertion point to the end of the zone rather than one
 * place further along, and every icon in between collapsed a slot leftwards. The
 * repo owner reported it as "the icons on the right get squeezed to the left" and
 * "it only makes room properly once you reach the gap between two icons". Every
 * test zone here held two slots, where "right of the last icon" and "the end"
 * coincide, which is why it survived.
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
  const next = slots.find((s) => clientX < s.midX)
  return { toZone, beforeKey: next ? next.key : null }
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

export interface DockShift { key: string; slots: -1 | 0 | 1 }

/**
 * How far each icon in one dock zone must move so a gap opens at `insertAt`.
 *
 * While a drag is live each zone has `keys.length + 1` slots and exactly one of
 * them is empty: the dragged icon's own former index in the zone it came from, or
 * an appended spare in the other zone. A hole at the end is the same thing as an
 * appended spare, which is why one formula serves both zones — and why the zones
 * can reflow independently, with nothing ever pushed across the divider.
 *
 * `insertAt` of null means the pointer is in the other zone: the hole stays where
 * it is and nothing moves. The result is a shift in whole slots, never more than
 * one, which the caller turns into pixels using the measured slot pitch.
 */
export function slotShifts(keys: string[], holeIndex: number, insertAt: number | null): DockShift[] {
  return keys.map((key, j) => {
    if (insertAt == null) return { key, slots: 0 as const }
    const to = j < insertAt ? j : j + 1
    const from = j < holeIndex ? j : j + 1
    return { key, slots: (to - from) as -1 | 0 | 1 }
  })
}
