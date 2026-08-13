// DOM-free math for the time machine. fisheyeScale / computeFisheyeScales / stepSelectedIndex are ported
// verbatim from Vue2 components/filebrowser/components/snapshotStackMath.js (curve parameters kept as-is);
// buildVisibleStack **extends** the Vue2 version with the past state (in the new visual design, cards newer
// than the selection fly off-screen toward the viewer; the Vue2 version only had the "recede backward"
// direction); buildRailNodes is newly written.
//
// Vue2's generateStarfieldShadow is deliberately not ported: in the new design the star dots are done in CSS, and the light theme has no starfield.

export interface StackEntry<T> {
  item: T
  /** Index in the flat list (newest-first), used to write the selection back when a card is clicked */
  index: number
  /** Layers away from the selected item: front is always 0; behind/past are 1, 2, 3... */
  depth: number
  state: 'front' | 'behind' | 'past'
}

export interface RailNode {
  type: 'day' | 'main' | 'sub'
  key: string
  /** Date label text when type === 'day' */
  label?: string
  /** The snapshot's flat index when type === 'main' */
  flatIndex?: number
  /** Index of the main tick this snaps to when type === 'sub' */
  anchorIndex?: number
}

interface FisheyeOptions { radius?: number; maxScale?: number; minScale?: number }

// Visible window size of the card deck: TimeMachineOverlay (decides which snapshots to fetch previews for)
// and TimeMachineDeck (decides which cards to render) must use the same window, or the frontmost card gets
// no thumbnail — previously both spots had their own (5, 2) literal, and changing one while forgetting the
// other raised no error and no red test. Hoisted into this one constant; both spots reference it.
export const DECK_WINDOW = { depth: 5, past: 2 } as const

// macOS Time Machine's tick strip (and the Dock it borrows from) scales **continuously** with cursor
// distance, not in hover/near/far steps — that can only be done by reading the cursor position and computing
// a real distance function; no pure CSS :hover rule can express it. This is that function: maxScale at
// distance 0, smoothly dropping to minScale at radius, staying at minScale beyond.
export function fisheyeScale(distance: number, options: FisheyeOptions = {}): number {
  const { radius = 70, maxScale = 2.2, minScale = 1 } = options
  const d = Math.abs(distance)
  if (!Number.isFinite(d) || d >= radius) return minScale
  const t = 1 - d / radius // 0 at the radius edge, 1 directly under the cursor
  // Raised-cosine easing: slope is 0 at both ends, so adjacent ticks "melt" into and out of the magnified zone with no corner kinks.
  const eased = (1 - Math.cos(t * Math.PI)) / 2
  return minScale + (maxScale - minScale) * eased
}

export function computeFisheyeScales(centers: number[], cursorY: number, options: FisheyeOptions = {}): number[] {
  return (centers || []).map((c) => fisheyeScale(c - cursorY, options))
}

// items is newest-first. The selected item is frontmost (front); older snapshots (larger index) recede
// backward in order (behind); snapshots newer than the selection (smaller index) have already been
// "flipped past" and fly off-screen toward the viewer (past).
export function buildVisibleStack<T>(
  items: T[],
  selectedIndex: number,
  maxDepth = 5,
  pastDepth = 2,
): StackEntry<T>[] {
  const list = items || []
  if (list.length === 0) return []
  const start = Math.min(Math.max(selectedIndex, 0), list.length - 1)
  const out: StackEntry<T>[] = []
  for (let depth = 0; depth < maxDepth && start + depth < list.length; depth++) {
    out.push({ item: list[start + depth], index: start + depth, depth, state: depth === 0 ? 'front' : 'behind' })
  }
  // Then place past. ⚠️ front-first invariant: callers (the T2 boundary cases) rely on arr[0] always being the front card —
  // this is exactly the bug fixed before (past was once inserted first, making arr[0] not front); front must be pushed first.
  // CSS decides stacking via z-index, but array order is not "irrelevant" — don't move this back in front of front.
  for (let depth = 1; depth <= pastDepth && start - depth >= 0; depth++) {
    out.push({ item: list[start - depth], index: start - depth, depth, state: 'past' })
  }
  return out
}

export function stepSelectedIndex(currentIndex: number, delta: number, length: number): number {
  if (!length || length <= 0) return 0
  const next = currentIndex + delta
  return Math.min(Math.max(next, 0), length - 1)
}

// Flatten day-grouped snapshots into the node sequence the rail renders: one date heading before each
// group, one main tick per snapshot, and subPerGap decorative sub-ticks between adjacent main ticks (the
// reference design's sub tick). Sub-ticks are not independently selectable; clicking one snaps to the main
// tick at anchorIndex.
export function buildRailNodes(
  groups: { dayKey: string; labelText: string; items: { flatIndex: number }[] }[],
  subPerGap = 2,
): RailNode[] {
  const nodes: RailNode[] = []
  const mains: number[] = []
  for (const g of groups || []) {
    nodes.push({ type: 'day', key: `day-${g.dayKey}`, label: g.labelText })
    for (const item of g.items) {
      nodes.push({ type: 'main', key: `main-${item.flatIndex}`, flatIndex: item.flatIndex })
      mains.push(nodes.length - 1)
    }
  }
  if (subPerGap <= 0 || mains.length < 2) return nodes
  // Insert back-to-front to avoid shifting the already-recorded indices while inserting
  const out = [...nodes]
  for (let i = mains.length - 2; i >= 0; i--) {
    const anchorNode = out[mains[i]]
    const subs: RailNode[] = []
    for (let j = 0; j < subPerGap; j++) {
      subs.push({ type: 'sub', key: `sub-${anchorNode.flatIndex}-${j}`, anchorIndex: anchorNode.flatIndex })
    }
    out.splice(mains[i] + 1, 0, ...subs)
  }
  return out
}
