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

// --- Pruned kept-for-compat exports (history, for anyone grepping this area) -----------------
// The colleague's earlier card-deck mockup variant (M2-F6/F7) exported RailNode/
// LegacyFisheyeOptions/computeFisheyeScales/buildRailNodes, all consumed only by the colleague's
// own TimeMachineRail.vue. Task 6 (Ruling P2) already removed this section's siblings
// (DECK_WINDOW/buildVisibleStack/StackEntry/stepSelectedIndex) alongside TimeMachineDeck.vue/
// TimeMachineOverlay.vue. Task 8 rewrote TimeMachineRail.vue wholesale (new props/emits contract,
// day-grouping now owned by the component itself via storage/util/snapshotView's
// groupSnapshotsByDay, and its own name-keyed node-building rather than this module's numeric
// flatIndex-keyed one) -- confirmed by grep that nothing outside this module and its own test file
// referenced RailNode/LegacyFisheyeOptions/computeFisheyeScales/buildRailNodes any longer, so all
// four were deleted here in that same task. `LegacyFisheyeOptions` itself is NOT one of the four --
// fisheyeScale below still takes an optional `options` param of that shape (kept, still directly
// tested); only the type's "Legacy" name is a holdover from when it existed solely to serve
// computeFisheyeScales.

interface LegacyFisheyeOptions { radius?: number; maxScale?: number; minScale?: number }

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
// `options` is optional and unused by every real call site today (TimeMachineRail.vue's own
// updateScales() -- Task 8 -- calls this with one argument); it survives Task 8's pruning of
// computeFisheyeScales (its only former caller) purely because it is still directly tested and
// costs nothing to keep as a parameterization escape hatch.
export function fisheyeScale(distancePx: number, options: LegacyFisheyeOptions = {}): number {
  const { radius = FISHEYE_RADIUS, maxScale = FISHEYE_MAX_SCALE, minScale = FISHEYE_MIN_SCALE } = options
  const d = Math.abs(distancePx)
  if (!Number.isFinite(d) || d >= radius) return minScale
  const t = 1 - d / radius // 0 at the radius edge, 1 directly under the cursor
  const eased = (1 - Math.cos(t * Math.PI)) / 2
  return minScale + (maxScale - minScale) * eased
}

// --- Fix wave G (Ruling G-1, owner acceptance 2026-08-26): fisheye rail redesign --------------
// Owner design change, overriding Vue2's own scroll-based rail: the rail band is now a FIXED
// [top, bottom] region (TimeMachineRail.vue's own header comment has the full geometry/CSS
// derivation) with NO scrollbar, ever -- every snapshot's tick maps into that fixed extent instead
// of a scrolling list. "Evenly distribute every node across the fixed band" itself needs no
// function here: `.tm-rail-track`'s own `justify-content: space-between` (a plain CSS flex rule)
// already does exactly that with zero JS measurement, the same "let the browser do the layout
// math" posture this module's own header comment already praises for `.file-grid`'s `auto-fill`
// column mechanism -- a JS-computed "evenly spread N items across bandHeight" pure function was
// drafted for this during Fix wave G's own implementation but deleted before landing once the CSS
// mechanism turned out to cover the exact same requirement with less code and no ResizeObserver
// dependency; see this task's own fix-wave report for that trace, kept for anyone re-deriving why
// no such helper exists here.
//
// The genuinely new pure-math surface this wave DOES need: with enough snapshots, resting ticks
// can end up sitting very close together (nothing left to evenly space them further apart with);
// the fisheye no longer just SCALES a nearby tick in place (which alone does nothing to relieve
// that crowding -- a bigger tick sitting exactly where a small one used to sit still visually
// collides with its neighbors) -- it now also DISPLACES nearby ticks apart along the rail's own
// axis (translateY), the classic Apple/macOS-dock magnification kernel: icons near the cursor grow
// AND spread apart from each other; icons a little further out (still inside the effect's radius)
// compress slightly, pulled back toward the cursor to make room for that spread; icons beyond the
// radius do not move at all.

export interface FisheyeDisplacement { offset: number; scale: number }

/**
 * Per-tick `{ offset, scale }` for the Apple/macOS-dock-style fisheye kernel (Fix wave G, Ruling
 * G-1) -- `centers` are each tick's OWN resting Y position (px, any coordinate space, as long as
 * it is the SAME space `cursorY` is measured in -- TimeMachineRail.vue's own caller uses real
 * `getBoundingClientRect()` centers, matching `fisheyeScale`'s existing convention), sorted
 * ascending (top to bottom); `scale` is exactly `fisheyeScale(centers[i] - cursorY, { radius,
 * maxScale })` (unchanged formula, still floors at `FISHEYE_MIN_SCALE`); `offset` is how far tick
 * `i` should additionally translateY away from its OWN resting center, so a tick close to the
 * cursor visibly grows AND separates from its neighbors instead of just growing in place and
 * colliding with them.
 *
 * Design (documented -- not a literal port, Vue2 has no displacement at all, only scale): define a
 * SIGNED "kernel" at distance `d` (0..radius) from the cursor as `bulge(d) - avgBulge`, where
 * `bulge(d) = fisheyeScale(d, opts) - FISHEYE_MIN_SCALE` (>= 0, the tick's own "extra growth" at
 * that distance) and `avgBulge = (maxScale - FISHEYE_MIN_SCALE) / 2` -- the exact closed-form mean
 * of `bulge` over `[0, radius]` for this module's own raised-cosine easing (the average of
 * `(1 - cos(t)) / 2` over a half period is exactly `1/2`, so `avgBulge` needs no numeric
 * integration). This kernel is POSITIVE near the cursor (nearby ticks get pushed further apart) and
 * NEGATIVE further out but still inside the radius (those ticks compress slightly, pulled a little
 * back toward the cursor to compensate) -- by construction its definite integral over `[0, radius]`
 * is exactly zero, so the running (trapezoidal) integral from the cursor outward returns to exactly
 * zero right at the radius boundary, same place `bulge` itself already reaches zero. `offset` for
 * tick `i` is that running integral, evaluated from the cursor out to `centers[i]`, signed by which
 * side of the cursor the tick is on (ticks above the cursor get pushed further up, i.e. negative;
 * ticks below get pushed further down, i.e. positive) -- an EXPLICIT hard clamp to exactly `0` for
 * any tick at or beyond `radius` closes the loop precisely (the trapezoidal approximation of the
 * zero-integral property is only exact in the continuous limit; discrete sampling at real tick
 * positions can leave a tiny residual, and "ticks outside the fisheye's own radius do not move at
 * all" is a hard contract this function's own tests rely on, not an approximation).
 *
 * This construction has two provable properties that matter for a rail that no longer scrolls:
 * - SYMMETRY: `fisheyeScale`'s own distance argument is `Math.abs(...)`, so `bulge` (and therefore
 *   the kernel) is an EVEN function of distance from the cursor -- a layout mirror-symmetric around
 *   the cursor produces exactly mirror-symmetric (equal magnitude, opposite sign) offsets.
 * - NO REORDERING/OVERLAP: on either side of the cursor, `offset` is built as a running sum of
 *   trapezoid areas between consecutive same-side ticks; the DIFFERENCE in offset between two
 *   adjacent same-side ticks can only be as negative as `-avgBulge` (the kernel's own floor, since
 *   `bulge >= 0`), and for this module's own `FISHEYE_MAX_SCALE`/`FISHEYE_MIN_SCALE` defaults
 *   `avgBulge = 0.6` -- comfortably less than `1`, so `(gap + offsetDelta) > 0` always holds and two
 *   ticks can never cross. This bound is a property of the DEFAULT constants (documented, not
 *   defensively re-clamped here): a caller passing an exotic `maxScale` with `maxScale -
 *   FISHEYE_MIN_SCALE >= 2` could in principle violate it -- no real call site in this codebase ever
 *   does.
 */
export function fisheyeDisplacement(
  centers: number[],
  cursorY: number,
  radius: number = FISHEYE_RADIUS,
  maxScale: number = FISHEYE_MAX_SCALE,
): FisheyeDisplacement[] {
  const n = centers.length
  if (n === 0) return []
  const minScale = FISHEYE_MIN_SCALE
  const avgBulge = (maxScale - minScale) / 2 // closed-form mean of bulge(d) over [0, radius] -- see this function's own comment
  const kernelAt = (dist: number): number => {
    if (!Number.isFinite(dist) || dist >= radius) return 0
    return fisheyeScale(dist, { radius, maxScale, minScale }) - minScale - avgBulge
  }
  const scales = centers.map((c) => fisheyeScale(c - cursorY, { radius, maxScale, minScale }))
  const raw = new Array(n).fill(0)

  // Walk DOWNWARD from the cursor (centers[i] > cursorY): positive (pushed further away) offsets.
  let acc = 0, prevY = cursorY, prevK = kernelAt(0)
  for (let i = 0; i < n; i++) {
    if (centers[i] <= cursorY) continue
    const gap = centers[i] - prevY
    const k = kernelAt(centers[i] - cursorY)
    acc += gap * (prevK + k) / 2
    raw[i] = acc
    prevY = centers[i]
    prevK = k
  }
  // Walk UPWARD from the cursor (centers[i] <= cursorY): mirror image, negative offsets.
  acc = 0; prevY = cursorY; prevK = kernelAt(0)
  for (let i = n - 1; i >= 0; i--) {
    if (centers[i] > cursorY) continue
    const gap = prevY - centers[i]
    const k = kernelAt(cursorY - centers[i])
    acc -= gap * (prevK + k) / 2
    raw[i] = acc
    prevY = centers[i]
    prevK = k
  }

  return centers.map((c, i) => ({
    offset: Math.abs(c - cursorY) >= radius ? 0 : raw[i], // hard clamp -- see this function's own comment
    scale: scales[i],
  }))
}

/** Minimum resting spacing (px) between two consecutive MAIN ticks for their per-tick HH:MM label
 * to stay visible without asking (Fix wave G, Ruling G-1 -- see TimeMachineRail.vue's own template
 * comment on this override of wave A2's "resting labels always visible" rule). Chosen as the
 * label's own font-size (11.5px, `.tm-tick-label`) plus a little under one line of breathing room
 * (~6.5px) so two labels never visually touch/overlap at rest -- below this, a tick's label is
 * hidden unless the tick is inside the fisheye's own magnified zone (scale > 1) or is the current
 * selection. */
export const TM_RAIL_LABEL_MIN_GAP = 18

/**
 * Whether a MAIN tick's own per-tick HH:MM label should be visible right now (Fix wave G, Ruling
 * G-1 -- see this module's own header comment on this section, and `TM_RAIL_LABEL_MIN_GAP`'s own
 * comment for the threshold). Three independent reasons any one of which is enough:
 * - the rail is roomy enough at rest (average main-tick-to-main-tick spacing, `bandHeight /
 *   (mainCount - 1)`, is at or above `TM_RAIL_LABEL_MIN_GAP`) -- OR `bandHeight` has not been
 *   measured yet (`<= 0`/non-finite): fails OPEN (shows the label) rather than hiding everything
 *   until a real measurement lands, the same "unmeasured degrades to the generous default" posture
 *   `resolveSlotPose`/`computeVisibleStripCap` already take elsewhere in this module for their own
 *   "stageHeight unknown" case.
 * - the tick IS the current selection -- kept unconditionally, Ruling G-1's own UX call: the "you
 *   are here" tick's label should never disappear just because the rail got crowded.
 * - the tick is inside the fisheye's own magnified zone right now (`scale > 1`) -- the whole point
 *   of the magnified region is to reveal detail a crowded rest state hides; a hovered tick is, by
 *   construction, (almost) always the nearest one to the cursor and therefore already inside this
 *   zone, so no separate "hovered" case is needed on top of this one.
 */
export function shouldShowTickLabel(opts: { mainCount: number; bandHeight: number; isSelected: boolean; scale: number }): boolean {
  const { mainCount, bandHeight, isSelected, scale } = opts
  if (isSelected) return true
  if (!Number.isFinite(bandHeight) || bandHeight <= 0) return true // unmeasured -- fail open
  const restSpacing = mainCount <= 1 ? Infinity : bandHeight / (mainCount - 1)
  if (restSpacing >= TM_RAIL_LABEL_MIN_GAP) return true
  return scale > 1
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
const SLOT_SCALE_STEP = 0.02 // smaller per depth, BOTH axes uniformly (Vue2's scaleStep -- Vue2 applied this to X only, see the owner-ruling comment below on resolveSlotPose for why this port applies it to both)
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
// higher (more negative) y, smaller (UNIFORM scale, see below), dimmer, all
// floored so nothing shrinks/darkens to nothing even far down the cascade.
//
// Owner ruling E-1' (2026-08-26, supersedes an earlier same-day ruling that
// flattened resting-depth scale to 1 -- see this task's fix-wave report for
// the full back-and-forth): the owner's actual objection was never to
// per-depth SCALING itself -- a receding depth strip getting smaller *is*
// the camera-dolly illusion, "the front window seen from farther away". The
// objection was to Vue2's own ANISOTROPIC scaling: `scaleX` shrinking while
// `scaleY` stayed pinned to 1 (the "thin peeking sliver" look) DISTORTS the
// glyphs -- squishes them horizontally without shrinking them vertically to
// match -- which reads as "some other kind of movement", not a clean,
// undistorted "farther away" scale. The owner's binding rule: a promoted
// back panel must be exactly a transform-SCALED clone of the front window --
// same aspect ratio, same relative element positions, nothing reflowing or
// distorting, only uniformly smaller/larger and translated. So `scaleY` here
// is no longer hardcoded to `1` for depths >= 1: it now tracks `scaleX`
// exactly (both derived from the SAME formula Vue2 used for its own scaleX,
// `Math.max(SLOT_MIN_SCALE, 1 - depth * SLOT_SCALE_STEP)`) -- uniform scale,
// no distortion, still visibly "farther/smaller" per depth as the owner's
// dolly metaphor intends. The T(<=-1) exit pose was never anisotropic to
// begin with (`scaleX === scaleY` already, Vue2's own invariant) and is
// unaffected by this ruling either way.
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
  // Owner ruling E-1': uniform scale, both axes identical -- no anisotropic
  // X-only narrowing (was `scaleX: ..., scaleY: 1`). A single `scale` local
  // keeps the two fields byte-identical by construction, not by coincidence
  // of two separately-typed-out expressions drifting apart later.
  const scale = Math.max(SLOT_MIN_SCALE, 1 - depth * SLOT_SCALE_STEP)
  return {
    x: 0,
    y: -(depth * TM_DEPTH_STEP),
    scaleX: scale,
    scaleY: scale,
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
