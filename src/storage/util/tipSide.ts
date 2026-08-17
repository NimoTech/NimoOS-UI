// Which direction the drive-select card's hover tooltip expands toward.
//
// Why not upward: Vue2's tooltip expands above the card (RaidDriveCard.vue:174
// `bottom: calc(100% + 8px)`), but in the new UI the drive-select area sits right against the
// top bar inside the storage shell, so the first row of cards' tooltips get covered by the top
// bar (reported by a real user on 2026-07-30). Changed to **expand rightward, centered
// vertically**; if it doesn't fit on the right, it flips to the left — otherwise the rightmost
// column would replay the same "clipped by the boundary" problem.
// (`.st-body`'s overflow-y:auto also makes overflow-x count as auto, so any overflow drags in
// a horizontal scrollbar.)

// Reserved width for the tooltip (px). The tooltip is `white-space: nowrap` and the model-name
// line is `max-width: 160px`; adding left/right padding and offset, testing shows it never
// exceeds this number. We use a fixed integer constant rather than measuring offsetWidth for
// real — the tooltip is display:none, so its width can't be measured, and temporarily showing
// it just to measure would cause a visible flicker.
export const TIP_RESERVE = 210

// Decides which direction to expand. rect is the card's getBoundingClientRect(), viewportWidth
// is window.innerWidth. Returns 'right' when it doesn't fit on either side (flipping left would
// only be worse — the right side at least has a scrollbar to reach it).
export function tipSide(
  rect: { left: number; right: number },
  viewportWidth: number,
  reserve: number = TIP_RESERVE,
): 'left' | 'right' {
  const fitsRight = rect.right + reserve <= viewportWidth
  if (fitsRight) return 'right'
  const fitsLeft = rect.left - reserve >= 0
  return fitsLeft ? 'left' : 'right'
}
