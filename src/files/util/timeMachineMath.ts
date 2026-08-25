// DOM-free math backing the Vue2-parity Time Machine stage (see
// docs/superpowers/plans/2026-08-25-files-time-machine-vue2-parity.md, Task 2).
//
// This rewrite ports the "single camera-dolly slot model" from Vue2's
// components/filebrowser/components/timeMachineMath.js (Fix Round 9/13,
// see that file's own extensive header comment for the full history):
// fisheyeScale (cursor-distance tick magnification), resolveDollySlots
// (name-keyed depth-slot assignment) and resolveSlotPose (per-slot pose).
// New-UI adds clampStepIndex, a small helper Vue2 never had as a standalone
// function (Vue2 split "can I step" (resolveStepperBoundaries) and "do the
// step" across the component itself); here they are fused into one call
// that returns the next index or null when already at a boundary.
//
// Signature deviations from Vue2 (deliberate, see task-2-report.md):
// - fisheyeScale drops Vue2's generic `options` bag in favor of fixed
//   constants (FISHEYE_*) for new call sites, but keeps an OPTIONAL options
//   param purely for backward compatibility with computeFisheyeScales below
//   (kept-for-compat export, see that section).
// - resolveDollySlots takes `names: string[]` directly (not an array of
//   `{ name }` objects), unlike Vue2's `flatItems`. `pinNames` (Fix Round
//   11/M2-F15's multi-step-jump continuity fix) IS ported -- see below.
// - resolveSlotPose returns `{ x, y, scaleX, scaleY, dim, z }` (GSAP-native
//   property names -- `x`/`y`/`scaleX`/`scaleY` map straight onto
//   `gsap.set(el, pose)` in Task 3's choreography) instead of Vue2's
//   `{ offsetY, scaleX, scaleY, opacity, brightness }`. `dim` is
//   `1 - brightness` (the `__dim` overlay's own opacity, per the design
//   spec) rather than a brightness multiplier. `z` is an explicit stacking
//   value (nearer slot = higher z) so paint order no longer depends on
//   DOM/v-for order the way Vue2's "farthest first, nearest last" array
//   order did (resolveDollySlots still returns farthest-first for
//   compatibility/readability, but callers may now render in any order and
//   rely on `z` alone). There is no `opacity` field: Vue2's T(-1) opacity:0
//   existed only to hide a huge, off-screen offset before it starts a
//   transition -- the stage's own `overflow: hidden` plus the exit pose's
//   large `y` already keeps it out of view without needing a second signal.
//
// Review round 1 (2026-08-25): the controller ruled the spec's pixel/motion
// 1:1 mandate overrides the brief's sketched minimalism on three points, so
// scaleX/scaleY, the stageHeight param, and pinNames are now restored to
// Vue2's exact semantics (formulas/values below are byte-identical to
// timeMachineMath.js's own resolveSlotPose/resolveDollySlots) -- only the
// field names/shapes (x/y/scaleX/scaleY/dim/z vs offsetY/scaleX/scaleY/
// opacity/brightness) and the "plain params instead of one options bag"
// calling convention remain New-UI-specific.

// --- Kept for compat -------------------------------------------------------
// The colleague's earlier card-deck mockup variant (M2-F6/F7, see that
// version's own removed header comment) was also imported by
// TimeMachineDeck.vue / TimeMachineOverlay.vue -- both deleted in Task 6
// (Ruling P2) alongside their own imports (DECK_WINDOW / buildVisibleStack /
// StackEntry / stepSelectedIndex, removed here in the same commit since
// nothing else referenced them post-deletion, grepped). TimeMachineRail.vue
// is NOT deleted yet (outside Ruling P2's own file list -- Task 7 rebuilds
// the rail and decides its fate then), and it still imports the two exports
// below, so those -- and their own RailNode/LegacyFisheyeOptions types --
// stay. DO NOT extend or "fix" this section -- it is dead weight walking to
// the grave, not a second product.

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

interface LegacyFisheyeOptions { radius?: number; maxScale?: number; minScale?: number }

export function computeFisheyeScales(centers: number[], cursorY: number, options: LegacyFisheyeOptions = {}): number[] {
  return (centers || []).map((c) => fisheyeScale(c - cursorY, options))
}

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

// --- Vue2-parity math (this task's real deliverable) ------------------------

/** Cursor-distance falloff radius for tick magnification, px. Vue2's `radius` default. */
export const FISHEYE_RADIUS = 70
/** Tick scale at/beyond FISHEYE_RADIUS. Vue2's `minScale` default. */
export const FISHEYE_MIN_SCALE = 1
/** Tick scale exactly at the cursor. Vue2's `maxScale` default. */
export const FISHEYE_MAX_SCALE = 2.2
/** `.tm-fwin--active` uniform scale (transform-origin 50% 58%). Vue2's `$tm-window-scale`. */
export const TM_WINDOW_SCALE = 0.82
/** `.tm-rail`'s own fixed width, px. Vue2's `$tm-rail-width`. */
export const TM_RAIL_WIDTH = 220
/** Reserved band between the scaled window and the rail, px. Vue2's `$tm-stepper-band`. */
export const TM_STEPPER_BAND = 60
/** Per-depth-slot vertical offset step (pre-window-scale px). Vue2's `resolveSlotPose` `offsetStep` default. */
export const TM_DEPTH_STEP = 30

export interface DollySlot { name: string; depth: number }
export interface SlotPose { x: number; y: number; scaleX: number; scaleY: number; dim: number; z: number }

// Raised-cosine falloff of tick magnification around the cursor: eases from
// `maxScale` at distance 0 down to `minScale` at `radius`, staying at
// `minScale` beyond it. Slope is 0 at both t=0 and t=1 (no visible "kink"
// where neighbouring ticks blend in/out) -- ported verbatim from Vue2.
// `options` is accepted only so the kept-for-compat `computeFisheyeScales`
// above can still pass one through; every new call site uses one argument.
export function fisheyeScale(distancePx: number, options: LegacyFisheyeOptions = {}): number {
  const { radius = FISHEYE_RADIUS, maxScale = FISHEYE_MAX_SCALE, minScale = FISHEYE_MIN_SCALE } = options
  const d = Math.abs(distancePx)
  if (!Number.isFinite(d) || d >= radius) return minScale
  const t = 1 - d / radius // 0 at the radius edge, 1 directly under the cursor
  const eased = (1 - Math.cos(t * Math.PI)) / 2
  return minScale + (maxScale - minScale) * eased
}

const DEFAULT_MAX_SLOTS = 10

// Which snapshots occupy the visible depth slots for currentIndex in a
// newest-first `names` list. Ported from Vue2's resolveDollySlots (Fix
// Round 9/13): depth 0 is the selection itself, depth -1 is the one
// snapshot more recent than the selection (when one exists, unconditionally
// included -- never capped by `maxSlots`), depths 1..maxSlots are the
// receding older cascade. Returned farthest-first (depth descending) so a
// plain v-for keyed by `name` paints the nearest slot last/on top, and so
// the SAME name persists across a selection change (its depth simply
// shifts), which is what lets a CSS/GSAP transition animate it rather than
// tearing the node down and rebuilding one elsewhere.
//
// `pinNames` (ported from Vue2 Fix Round 11/M2-F15) force-includes specific
// names at their own real (unclamped) depth regardless of the `[-1,
// maxSlots]` window above. Without this, a multi-step tick/rail jump whose
// target lies beyond the visible window (or whose departure lands beyond
// depth -1 on the "more recent" side) has no rendered DOM node before/after
// the jump for a travel animation to run from/to -- it just hard-cuts at
// the final position. A caller pins exactly the travel's two endpoints
// (departure + target) right before starting a jump; this is per-name, not
// a wider window for everyone else.
export function resolveDollySlots(
  names: string[],
  currentIndex: number,
  maxSlots: number = DEFAULT_MAX_SLOTS,
  pinNames: string[] = [],
): DollySlot[] {
  const hasSelection = Array.isArray(names) && Number.isInteger(currentIndex) && currentIndex >= 0 && currentIndex < names.length
  if (!hasSelection) return []
  const pinSet = pinNames && pinNames.length ? new Set(pinNames) : null
  const slots: DollySlot[] = []
  for (let i = 0; i < names.length; i++) {
    const name = names[i]
    const depth = i - currentIndex
    if ((depth >= -1 && depth <= maxSlots) || (pinSet && pinSet.has(name))) slots.push({ name, depth })
  }
  slots.sort((a, b) => b.depth - a.depth)
  return slots
}

// Per-depth-slot pose knobs, pre-window-scale coordinates. Values mirror
// Vue2's resolveSlotPose defaults exactly (offsetStep/scaleStep/
// brightnessStep/floors/exitScale) -- only the field shapes differ, see this
// module's own header comment for why.
const SLOT_SCALE_STEP = 0.02 // narrower per depth (Vue2's scaleStep)
const SLOT_MIN_SCALE = 0.78 // Vue2's minScale floor
const SLOT_DIM_STEP = 0.06 // dimmer per depth (Vue2's brightnessStep, inverted: dim = 1 - brightness)
const SLOT_MAX_DIM = 0.55 // Vue2's minBrightness floor (0.45), inverted
const EXIT_SCALE = 1.2 // T(-1): uniform grow, "coming toward the viewer" (Vue2's exitScale)
const EXIT_OFFSET_FALLBACK = 1600 // px, pre-mount/unmeasured fallback (Vue2's exitOffsetFallback)
const EXIT_OFFSET_MULTIPLIER = 1.4 // stageHeight * this comfortably clears the real stage (Vue2's exitOffsetMultiplier)

// Pose (translate/scale/dim/z) for a slot at a given depth, pre-window-scale
// coordinates. T(0) (the selection itself) is the identity pose. T(<=-1)
// ("past the camera") grows UNIFORMLY (scaleX === scaleY, "the whole box
// grows/rests"), translates well past the stage, and is never dimmed (it is
// the exiting/incoming front layer, not a deep strip) -- every depth <= -1
// collapses to this SAME pose (there is only ever one past-the-camera slot
// rendered at a time, ported from Vue2's own invariant). Depths >= 1 recede:
// higher (more negative) y, narrower scaleX ONLY (scaleY stays 1 -- Vue2's
// deliberate "thin peeking sliver" look, not a uniform shrink), dimmer, all
// floored so nothing shrinks/darkens to nothing even far down the cascade.
//
// `stageHeight` (optional, ported from Vue2): when known, the T(-1) exit
// offset is `stageHeight * EXIT_OFFSET_MULTIPLIER` (Vue2's real production
// path, which measures the actual stage) rather than the fixed
// EXIT_OFFSET_FALLBACK -- a fixed fallback under-throws on any stage taller
// than ~1143px (1600 / 1.4), which can leave T(-1) visibly inside the clip
// box instead of safely off-screen. A non-finite/non-positive stageHeight
// (not yet measured, or this module's own test env) falls back to the fixed
// constant, same as Vue2.
export function resolveSlotPose(depth: number, stageHeight?: number): SlotPose {
  if (depth <= -1) {
    const exitOffset = Number.isFinite(stageHeight) && (stageHeight as number) > 0 ? (stageHeight as number) * EXIT_OFFSET_MULTIPLIER : EXIT_OFFSET_FALLBACK
    return { x: 0, y: exitOffset, scaleX: EXIT_SCALE, scaleY: EXIT_SCALE, dim: 0, z: 1 }
  }
  if (depth === 0) {
    return { x: 0, y: 0, scaleX: 1, scaleY: 1, dim: 0, z: 0 }
  }
  return {
    x: 0,
    y: -(depth * TM_DEPTH_STEP),
    scaleX: Math.max(SLOT_MIN_SCALE, 1 - depth * SLOT_SCALE_STEP),
    scaleY: 1,
    dim: Math.min(SLOT_MAX_DIM, depth * SLOT_DIM_STEP),
    z: -depth,
  }
}

// Clamp a step target into [0, count-1]; returns null when already at the
// boundary (or when there is no current selection / count is invalid) so
// callers can disable the stepper button rather than silently no-op-ing.
// Fuses Vue2's separate resolveStepperBoundaries (can-I-step booleans) and
// the component-level "do the step" arithmetic into one call.
export function clampStepIndex(current: number, delta: number, count: number): number | null {
  if (!Number.isInteger(current) || !Number.isInteger(count) || count <= 0) return null
  if (current < 0 || current >= count) return null
  const next = current + delta
  if (next < 0 || next >= count) return null
  return next
}

// Task 7 addition: ported from Vue2's own computeVisibleStripCap
// (timeMachineMath.js) -- how many OLDER-cascade depth-stack strips actually
// fit above `.tm-stage`'s own clip line, given the stage's real measured
// height. Without this, `resolveDollySlots`' own `maxSlots` stays a flat 10
// regardless of viewport height, and at ordinary window sizes most of that
// cascade renders clipped off-canvas against the stage's `overflow: hidden`
// (Vue2's own Fix Round 7b defect this fixed) -- see that fix round's header
// comment in the Vue2 authority file for the full trace.
//
// Geometry (byte-identical formula to Vue2's own, deliberately NOT re-using
// an options bag -- same "plain params over one bag" deviation this module's
// own header comment already documents for fisheyeScale/resolveSlotPose):
// the depth-stack wrapper shares `.tm-fwin`'s own scaled box (same
// `transform: scale(TM_WINDOW_SCALE)`, same `transform-origin` Y fraction),
// so the window's OWN rendered top edge -- the point every strip's
// `translateY` climbs away from -- sits `transformOriginY * (1 -
// TM_WINDOW_SCALE) * (stageHeight - bottomGap)` px down from the stage's own
// top. `margin` keeps the nearest clipped strip from touching that line
// exactly; `TM_DEPTH_STEP * TM_WINDOW_SCALE` is one strip's own on-screen
// (post-scale) vertical step. A non-finite/non-positive stageHeight (not yet
// measured, or this module's own test env) falls back to `maxSlots`
// unclamped -- Vue2's own "assume the historical, viewport-uncapped ceiling"
// choice, not "no headroom at all" (see resolveSlotPose's own stageHeight
// comment for the same fallback posture).
const VISIBLE_STRIP_BOTTOM_GAP = 80 // px, Vue2's $tm-bottom-gap
const VISIBLE_STRIP_TRANSFORM_ORIGIN_Y = 0.58 // Vue2's $tm-transform-origin Y fraction (50% 58%)
const VISIBLE_STRIP_MARGIN = 12 // px of clearance kept above the clip line

export function computeVisibleStripCap(stageHeight: number, maxSlots: number = DEFAULT_MAX_SLOTS): number {
  if (!Number.isFinite(stageHeight) || stageHeight <= 0) return maxSlots
  const unscaledHeight = stageHeight - VISIBLE_STRIP_BOTTOM_GAP
  if (unscaledHeight <= 0) return 0
  const windowTopY = VISIBLE_STRIP_TRANSFORM_ORIGIN_Y * (1 - TM_WINDOW_SCALE) * unscaledHeight
  const perSlotOnScreen = TM_DEPTH_STEP * TM_WINDOW_SCALE
  const cap = Math.floor((windowTopY - VISIBLE_STRIP_MARGIN) / perSlotOnScreen)
  return Math.max(0, Math.min(maxSlots, cap))
}
