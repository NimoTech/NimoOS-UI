// GSAP travel choreography backing the Vue2-parity Time Machine stage (see
// docs/superpowers/sdd/2026-08-25-files-time-machine-vue2-parity/task-3-brief.md).
//
// This ports Vue2's components/filebrowser/components/timeMachineChoreo.js
// (Fix Round 13, GSAP migration -- see that file's own extensive header
// comment for the full design rationale: why duration scales with distance
// past a small flat zone, why stagger is tiny/front-led, and why the ease is
// a CustomEase reproducing the retired CSS `cubic-bezier(0.2, 0.7, 0.2, 1)`
// byte-for-byte). timeMachineMath.ts's pose math (resolveSlotPose) is the
// single source of "what pose should this layer be in"; this module only
// adds the orthogonal axis of "how long should getting there take, with how
// much stagger" plus the actual GSAP calls that interpolate a DOM node from
// its current pose to the target one.
//
// Signature deviation from Vue2 (documented per task-3-brief's own "follow
// Vue2, document" instruction): Vue2's resolveSlotPose returned a SEPARATE
// `brightness` field that playTravelTimeline inverted itself (`1 -
// brightness`) into the dim overlay's own opacity. New-UI's resolveSlotPose
// (Task 2) already returns `dim` as the final overlay opacity value directly
// (see timeMachineMath.ts's own header comment: "`dim` is `1 - brightness`
// ... rather than a brightness multiplier") -- so this module's own
// `dimGsapVars` is a straight passthrough, no inversion. Vue2 also drove the
// dim overlay off a `brightness`-shaped pose but the TRANSFORM element off
// `{ y, scaleX, scaleY, opacity }` -- New-UI's SlotPose adds `x` (Vue2's pose
// had no horizontal offset) and drops `opacity` entirely from the transform
// element (see timeMachineMath.ts: T(-1)'s exit is already hidden by the
// stage's own `overflow: hidden` plus its large `y`, no second opacity
// signal needed) while adding `z` (an explicit stacking value, applied via
// an immediate `gsap.set` -- z-index does not tween).
//
// API deviation from the brief's own sketch (documented, same "follow Vue2"
// instruction): the brief sketches `TravelTarget { el: Element; pose:
// SlotPose }` -- ONE element per target. Vue2's own `buildTravelPlan`/
// `playTravelTimeline` always animate TWO elements per layer (`transformEl`
// + `dimEl`) -- a separate overlay node for the dim/opacity tween, so a
// brightness change never repaints the transform element's own DOM subtree
// (Vue2's own M2-F12 perf rationale, still cited in its header comment).
// This module keeps the brief's `el` name for the transform element (the one
// every target must have) and adds an OPTIONAL `dimEl` alongside it, so a
// caller that only has one element (or wants to skip the dim overlay) still
// works, while the stage tasks that build TimeMachineStage.vue's two-node-
// per-layer DOM (matching Vue2's own markup) get the real dim tween.
//
// `playTravelTimeline` takes the array of targets directly (not a
// pre-flattened array of gsap vars) -- ordering is assumed farthest-first
// (Vue2's `resolveDollySlots`/New-UI's `resolveDollySlots`, Task 2, own DOM-
// order convention), and stagger order is assigned in REVERSE internally
// (nearest = last in the array = 0 delay, "the front leads, the depth
// follows by a hair" -- see Vue2's own header comment, point 2). All layers
// still share the SAME timeline and the SAME duration/ease.

import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

import type { SlotPose } from './timeMachineMath'

gsap.registerPlugin(CustomEase)

// The one motion curve every dolly-slot tween in this module uses -- exact
// GSAP equivalent of the retired CSS `cubic-bezier(0.2, 0.7, 0.2, 1)`
// (byte-for-byte, unlike GSAP's built-in power2.out, which is only a visual
// approximation -- see the gsap skill's own note on this).
export const TM_TRAVEL_EASE = 'tmTravelEase'

let easeRegistered = false

/** Registers the shared CustomEase once, idempotently (safe to call repeatedly, e.g. from tests). */
export function registerTmEase(): void {
  if (easeRegistered) return
  CustomEase.create(TM_TRAVEL_EASE, '0.2, 0.7, 0.2, 1')
  easeRegistered = true
}

// Register at module load so every consumer gets a ready-to-use ease without
// having to remember to call registerTmEase() first (Vue2's own module-load
// CustomEase.create call, preserved as a side effect); still exported so
// callers/tests can re-assert registration idempotently.
registerTmEase()

// Single-step (and any short, <= TRAVEL_FLAT_STEPS jump) duration -- the old,
// constant travel duration this migration preserves the "feel" of.
export const TRAVEL_BASE_DURATION_MS = 420
// The ceiling a very large jump asymptotically approaches -- never exceeded,
// regardless of step count.
export const TRAVEL_MAX_DURATION_MS = 900
// Every jump of this many steps or fewer takes EXACTLY TRAVEL_BASE_DURATION_MS
// -- chosen so every switch this codebase's own pre-GSAP behavior already
// exercised at a hardcoded "420ms" mark (single tick/stepper/keyboard steps,
// short multi-tick jumps) keeps that exact number after this migration.
export const TRAVEL_FLAT_STEPS = 3
// How quickly the duration approaches TRAVEL_MAX_DURATION_MS once distance
// exceeds TRAVEL_FLAT_STEPS -- a smaller value reaches the ceiling sooner.
export const TRAVEL_GROWTH_STEPS = 10
// Per-layer stagger step and cap (both milliseconds) -- small and front-led,
// never an unbounded "dragging tail" no matter how many layers are visible.
export const TRAVEL_STAGGER_STEP_MS = 6
export const TRAVEL_STAGGER_CAP_MS = 40
// Duration (ms) of the stage's own exit fade -- pure CSS in the stage
// component (Vue2 parity: a 220ms pure-CSS exit fade), exported here purely
// as the single shared source of that number so the stage task and this
// module never drift apart on it. Not used by any GSAP call in this file.
export const EXIT_FADE_MS = 220

// Safety-ceiling margin (ms) beyond a travel's own GSAP duration, past which the reveal-gate
// (TimeMachineDepthStack.vue's own armReveal/settle) reveals the real window unconditionally --
// Vue2's own TRAVEL_SAFETY_EXTRA_MS literal, same value. Exported here (rather than left as a
// local const in the depth-stack component) so the store's own tmTravelActive backstop
// (snapshotBrowse.ts's own switchTo) can share the identical number instead of drifting from it --
// see that store's own comment on why it needs a SECOND, independent safety cap.
export const TRAVEL_SAFETY_EXTRA_MS = 800

// Safety-ceiling timeout (ms) for the store's own exit-chrome hold (snapshotBrowse.ts's own
// tmChromeVisible) -- Vue2's own EXIT_CHROME_HOLD_SAFETY_TIMEOUT_MS literal (FilePanel.vue),
// same value: caps how long the Time Machine stage's decorative chrome can be held up waiting for
// the exit navigation's target directory listing to land, so a hung network request can never
// wedge it open forever.
export const EXIT_CHROME_HOLD_SAFETY_TIMEOUT_MS = 6000

/**
 * Travel distance (in snapshot-index steps, any sign, any magnitude) -> the
 * shared duration (ms) every layer's tween in this travel uses. N=1 (and any
 * N <= TRAVEL_FLAT_STEPS) is exactly TRAVEL_BASE_DURATION_MS; beyond that it
 * grows asymptotically (1 - exp(-(n - flat) / growth)) toward
 * TRAVEL_MAX_DURATION_MS, ease-out, never exceeding it.
 *
 * Ruling H-1 (owner acceptance 2026-08-26, fly-through redesign for long jumps): this growth
 * curve was Vue2's OWN answer to "a jump of many steps": stretch the SAME single stack-slide
 * tween out longer, up to a 900ms ceiling, so a 200-step jump did not visually snap in 420ms flat.
 * The owner judged that unreasonable on its own terms -- a long jump sliding the whole stack in
 * one smooth motion reads as "the view got dragged," not "time is passing" -- and ruled that any
 * jump beyond `TRAVEL_FLAT_STEPS` must instead become a sequential FLY-THROUGH of the intermediate
 * snapshots (Apple Time Machine's own "fly past the camera one after another" model), overriding
 * Vue2's design here the same way Ruling E-1'/F'-1/G-1 already override it elsewhere in this line.
 * `flyThroughPlan`/`flyThroughDurationMs` (below) are the new entry points a `steps >
 * TRAVEL_FLAT_STEPS` travel actually uses now (TimeMachineDepthStack.vue's own `runTravel`/
 * `armReveal`) -- this function's own growth branch (`n > TRAVEL_FLAT_STEPS`) is UNREACHABLE from
 * that real call site any more (a long jump never reaches `travelDurationMs` with `steps > 3`), but
 * is deliberately NOT deleted: it stays correct, still directly tested (this module's own test
 * file), and remains the exact duration every INDIVIDUAL leg of a `<= TRAVEL_FLAT_STEPS` travel
 * still uses (that path is completely unchanged by this wave -- see `flyThroughPlan`'s own header
 * comment for the explicit "byte-identical for short travel" contract).
 */
export function travelDurationMs(steps: number): number {
  const n = Math.max(1, Math.abs(Number(steps)) || 1)
  if (n <= TRAVEL_FLAT_STEPS) return TRAVEL_BASE_DURATION_MS
  const t = 1 - Math.exp(-(n - TRAVEL_FLAT_STEPS) / TRAVEL_GROWTH_STEPS) // 0 just past the flat zone, asymptotically -> 1
  return Math.round(TRAVEL_BASE_DURATION_MS + (TRAVEL_MAX_DURATION_MS - TRAVEL_BASE_DURATION_MS) * t)
}

/**
 * A layer's position in the travel's own ordering (0 = nearest/front, the
 * layer that leads) -> its start delay (ms) within the shared timeline.
 * Linear, capped -- never grows unbounded with layer count.
 */
export function travelStaggerMs(layerIndex: number): number {
  const n = Math.max(0, Number(layerIndex) || 0)
  return Math.min(TRAVEL_STAGGER_CAP_MS, n * TRAVEL_STAGGER_STEP_MS)
}

// --- Fix wave H (Ruling H-1, owner acceptance 2026-08-26): long-jump fly-through ----------------
// Apple Time Machine's own model for a jump of many steps: each snapshot BETWEEN the departure and
// the target flies past the camera one after another (chronological order), instead of one uniform
// stack-slide. See `travelDurationMs`'s own comment (above) for the full ruling this overrides
// Vue2's growth-curve design with, and TimeMachineDepthStack.vue's own header comment for how the
// depth-stack component actually wires this plan into real DOM/GSAP execution (this module stays
// pose-agnostic -- "what pose" is still entirely `resolveSlotPose`'s own job, timeMachineMath.ts;
// this section only adds the orthogonal "which names, in what order, launched when" plan, matching
// this module's own existing "duration/stagger, not pose" scope).

/** Per-layer launch cadence (ms) between two consecutive fly-through launches -- within the
 * dispatch's own 50-80ms range, tuned toward the brisk end (Apple's own fly-through reads as
 * quick, not leisurely) while still leaving each layer visually distinct, not a blur. */
export const TRAVEL_FLY_CADENCE_MS = 65
/** How long each individual fly-through leg (one intermediate's own launch-to-landing tween, or
 * the target's own final arrival tween) takes -- the dispatch's own "visible ~300ms" per-layer
 * hint, also reused as the WHOLE sequence's floor when there are zero intermediates (a >3-step
 * jump with every intermediate sampled away still needs to reach the target in a real duration,
 * not instantly). */
export const TRAVEL_FLY_LAYER_DURATION_MS = 300
/** Hard ceiling on a fly-through's own TOTAL duration (last launch + its own layer duration),
 * however many steps the jump spans or however many intermediates get sampled in -- a jump across
 * an entire multi-thousand-snapshot history must still resolve in a bounded, Apple-quick beat, not
 * stretch out proportionally to distance the way Vue2's own retired growth curve did. */
export const TRAVEL_FLY_MAX_DURATION_MS = 1400
/** Default cap on how many intermediates a fly-through ever mounts as real depth-stack strips --
 * "a 200-step jump must not mount 200 strips" (this wave's own dispatch, verbatim). Sampled evenly
 * across the full gap when the real intermediate count exceeds this (see `flyThroughPlan`'s own
 * comment on `sampleEvenly`), never a hard cutoff at one end. */
export const TRAVEL_FLY_MAX_INTERMEDIATES = 10

export interface FlyThroughStep {
  /** The snapshot's own stable name -- what TimeMachineDepthStack.vue pins/looks up strips by. */
  name: string
  /** When (ms after the fly-through starts) this layer's own launch tween should begin. Strictly
   *  non-decreasing across the returned array (monotonic) -- the LAST entry (always `role:
   *  'target'`) carries the largest delay, arriving last, "decelerates into depth 0 last" (this
   *  wave's own dispatch). */
  launchDelayMs: number
  /** `'intermediate'`: one of the sampled snapshots flying past on the way to the target.
   *  `'target'`: the travel's own destination, always the LAST (and only 'target') entry. */
  role: 'intermediate' | 'target'
}

// Picks up to `max` items from `items` (already ordered), spread as evenly as possible across the
// full span -- never clustering every sample at one end. `items.length <= max` returns every item
// unchanged (nothing to sample away). Rounding can occasionally collide two adjacent picks onto the
// same source index for a `max` close to `items.length`; de-duplicated (order-preserving) rather
// than padded back out to exactly `max` -- `flyThroughPlan`'s own `maxIntermediates` is a CAP, not
// a quota, so landing a couple short of it on a rounding coincidence is harmless.
function sampleEvenly<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items
  if (max <= 0) return []
  if (max === 1) return [items[Math.floor((items.length - 1) / 2)]]
  const picked: T[] = []
  const seen = new Set<number>()
  for (let i = 0; i < max; i++) {
    const idx = Math.round((i * (items.length - 1)) / (max - 1))
    if (seen.has(idx)) continue
    seen.add(idx)
    picked.push(items[idx])
  }
  return picked
}

/**
 * Builds the ordered fly-through launch sequence for a long jump from `names[fromIndex]` to
 * `names[toIndex]` (both index into the SAME newest-first `names` list `resolveDollySlots` already
 * uses) -- every snapshot strictly BETWEEN the two, in chronological travel order (the order they
 * are encountered walking from `fromIndex` toward `toIndex`), evenly sampled down to at most
 * `opts.maxIntermediates` (default `TRAVEL_FLY_MAX_INTERMEDIATES`) when the real gap is larger,
 * each assigned a launch delay `TRAVEL_FLY_CADENCE_MS` apart -- plus one final `role: 'target'`
 * entry, one cadence step past the last intermediate (or at delay 0 if there are none), always the
 * LAST array element.
 *
 * Pure and direction-agnostic in its OWN output shape: whether `toIndex > fromIndex` ("going back
 * in time", index growing -- older) or `toIndex < fromIndex` ("going forward in time", index
 * shrinking -- more recent), the plan is the SAME kind of "who launches when" list; the visual
 * DIRECTION of each launch (exit trajectory vs. entry trajectory) is a POSE concern, entirely owned
 * by the caller (TimeMachineDepthStack.vue, via `resolveSlotPose`) -- this function only ever
 * returns names/timing/role, never a pose.
 *
 * Defensive/degenerate inputs (out-of-range or equal `fromIndex`/`toIndex`, a non-array `names`)
 * return `[]` -- the caller's own `steps > TRAVEL_FLAT_STEPS` gate is what decides whether this
 * function is even called; a `steps <= TRAVEL_FLAT_STEPS` (or otherwise degenerate) travel never
 * reaches it, keeping that whole path byte-identical to before this wave (regression contract this
 * module's own test file pins directly).
 */
export function flyThroughPlan(
  names: string[],
  fromIndex: number,
  toIndex: number,
  opts: { maxIntermediates?: number } = {},
): FlyThroughStep[] {
  if (!Array.isArray(names) || !Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return []
  if (fromIndex < 0 || fromIndex >= names.length || toIndex < 0 || toIndex >= names.length) return []
  if (fromIndex === toIndex) return []
  const maxIntermediates = Math.max(0, opts.maxIntermediates ?? TRAVEL_FLY_MAX_INTERMEDIATES)
  const dir = toIndex > fromIndex ? 1 : -1
  const between: number[] = []
  for (let i = fromIndex + dir; i !== toIndex; i += dir) between.push(i)

  const sampled = sampleEvenly(between, maxIntermediates)
  const steps: FlyThroughStep[] = sampled.map((idx, i) => ({
    name: names[idx],
    launchDelayMs: i * TRAVEL_FLY_CADENCE_MS,
    role: 'intermediate' as const,
  }))
  const targetDelay = steps.length ? steps[steps.length - 1].launchDelayMs + TRAVEL_FLY_CADENCE_MS : 0
  steps.push({ name: names[toIndex], launchDelayMs: targetDelay, role: 'target' })
  return steps
}

/**
 * A `flyThroughPlan`'s own total duration (ms): the LAST entry's launch delay (always the target's
 * own, `TRAVEL_FLY_CADENCE_MS * (K - 1)` for a `K`-entry plan) plus one final layer's own settle
 * duration, capped at `TRAVEL_FLY_MAX_DURATION_MS` regardless of how large the jump or how many
 * intermediates were sampled in. `0` for an empty plan (nothing to animate -- the caller's own
 * `steps <= TRAVEL_FLAT_STEPS` short-circuit never produces one in practice).
 */
export function flyThroughDurationMs(plan: FlyThroughStep[]): number {
  if (!plan || plan.length === 0) return 0
  const last = plan[plan.length - 1]
  return Math.min(TRAVEL_FLY_MAX_DURATION_MS, last.launchDelayMs + TRAVEL_FLY_LAYER_DURATION_MS)
}

/** True when the user's OS/browser requests reduced motion (or matchMedia is unavailable -- defensively false). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  catch {
    return false
  }
}

/**
 * Pure: SlotPose -> the subset of GSAP vars that animate the transform
 * element itself. `x`/`y` (not `translateX`/`top`) and `scaleX`/`scaleY` (not
 * `scale`) are what let GSAP compose a single transform matrix under the
 * hood (GPU-composited) -- see the gsap skill's own "translation/scale
 * should always use x/y/xPercent/yPercent/scale/rotate" rule.
 */
export function poseToGsapVars(pose: SlotPose): { x: number, y: number, scaleX: number, scaleY: number } {
  return { x: pose.x, y: pose.y, scaleX: pose.scaleX, scaleY: pose.scaleY }
}

/**
 * Pure: the SAME pose -> the dim overlay's own opacity. `pose.dim` is
 * already the final opacity value (Task 2's resolveSlotPose already inverted
 * brightness into it) -- straight passthrough, no further inversion.
 */
export function dimGsapVars(pose: SlotPose): { opacity: number } {
  return { opacity: pose.dim }
}

export interface TravelTarget {
  /** The layer's own transform element (translate/scale tween target). Required. */
  el: Element
  /** The layer's own dim overlay element (opacity tween target), if the caller renders one. */
  dimEl?: Element | null
  pose: SlotPose
  /** Fix wave H (Ruling H-1): this layer's own stable snapshot name -- OPTIONAL, only read when
   *  the caller also supplies `opts.delayOverridesMs`/`opts.presetPoses` (fly-through mode) to
   *  look either up by name. A caller outside fly-through mode (every pre-wave-H call site) never
   *  sets this and nothing changes for it -- see this function's own comment below for the exact
   *  "byte-identical when neither option is passed" contract. */
  name?: string
}

/**
 * Builds and plays ONE gsap.timeline covering every target at once --
 * "how long/how staggered" comes from `opts.steps` (via travelDurationMs) and
 * each target's position in the (assumed farthest-first) `targets` array
 * (via travelStaggerMs, assigned in reverse -- nearest leads with 0 delay).
 * `prefersReducedMotion()` collapses every duration/delay to 0 -- "snap
 * straight to the final state", the exact effect of `gsap.set` (a
 * zero-duration tween renders identically, so this is one code path, not a
 * branch). Every tween carries `overwrite: 'auto'` (belt-and-braces against
 * any tween still targeting the same element/properties that the CALLER
 * failed to kill first -- see the gsap skill's own "interrupt and redirect"
 * note; the stage component itself is still responsible for killing the
 * PREVIOUS travel's timeline before calling this again).
 *
 * Fix wave H (Ruling H-1) additions, all OPTIONAL and additive -- omitting them (every call site
 * this module had before this wave) reproduces the EXACT prior behavior byte-for-byte, the
 * regression contract this module's own test file pins directly:
 * - `opts.delayOverridesMs`: per-NAME start delay (ms), overriding the default position-based
 *   `travelStaggerMs` for any target whose `name` has an entry here -- the fly-through's own real
 *   sequential cadence (`flyThroughPlan`) instead of the tight, position-only stagger a normal
 *   travel uses.
 * - `opts.presetPoses`: per-NAME pose applied via an IMMEDIATE `gsap.set` the moment this function
 *   runs -- same timing as the existing unconditional z-index `gsap.set` below, NOT scheduled
 *   inside the timeline at that target's own delay. This is deliberate, not an approximation: a
 *   newly-pinned fly-through intermediate has ALREADY been `gsap.set()` to its own natural resting
 *   pose by its `v-tm-pose` directive's `mounted` hook (TimeMachineDepthStack.vue) by the time this
 *   function runs -- an immediate preset overrides that BEFORE this target's own tween (below)
 *   captures its start value, so the tween animates FROM the preset (e.g. the exit pose, "arrives
 *   already at the camera") rather than from its natural mount pose (which would make the tween a
 *   near no-op for a forward-direction intermediate, since that natural pose is often already close
 *   to where it needs to end up). The preset itself is invisible regardless of exactly when it
 *   fires (it targets an off-screen/at-the-edge pose) -- what the viewer actually sees, the tween's
 *   own VISIBLE motion, still only starts at this target's own `delaySec`, same as every other
 *   target. See TimeMachineDepthStack.vue's own comment on building these for the full
 *   backward/forward derivation -- this function itself stays pose-agnostic, just applies whatever
 *   it is handed.
 * - `opts.durationMsOverride`: bypasses `travelDurationMs(opts.steps)` entirely when present --
 *   the fly-through's own individual leg duration (`TRAVEL_FLY_LAYER_DURATION_MS`) is a FLAT,
 *   distance-independent number, not the old growth-curve value `opts.steps` would otherwise
 *   produce for a long jump.
 */
export function playTravelTimeline(
  targets: TravelTarget[],
  opts: {
    steps: number
    onComplete?: () => void
    delayOverridesMs?: Record<string, number>
    presetPoses?: Record<string, SlotPose>
    durationMsOverride?: number
  },
): gsap.core.Timeline {
  registerTmEase()
  const reduced = prefersReducedMotion()
  const list = (targets || []).filter(target => target && target.pose && (target.el || target.dimEl))
  const durationMs = reduced ? 0 : (opts?.durationMsOverride ?? travelDurationMs(opts?.steps))
  const durationSec = durationMs / 1000
  const total = list.length

  const tl = gsap.timeline({ onComplete: opts?.onComplete })

  list.forEach((target, i) => {
    const overrideMs = target.name ? opts?.delayOverridesMs?.[target.name] : undefined
    const delaySec = reduced ? 0 : (overrideMs !== undefined ? overrideMs / 1000 : travelStaggerMs(total - 1 - i) / 1000)
    const shared = { duration: durationSec, ease: TM_TRAVEL_EASE, overwrite: 'auto' as const }
    const preset = !reduced && target.name ? opts?.presetPoses?.[target.name] : undefined
    if (target.el) {
      // Stacking is discrete, not a tween-able quantity -- applied instantly,
      // independent of the shared timeline's own duration/stagger.
      gsap.set(target.el, { zIndex: target.pose.z })
      // Fix wave H: an IMMEDIATE preset (not scheduled inside the timeline) -- see this function's
      // own comment on opts.presetPoses for why "immediate" is the correct timing, not "at delaySec".
      if (preset) gsap.set(target.el, poseToGsapVars(preset))
      tl.to(target.el, { ...poseToGsapVars(target.pose), ...shared }, delaySec)
    }
    if (target.dimEl) {
      if (preset) gsap.set(target.dimEl, dimGsapVars(preset))
      tl.to(target.dimEl, { ...dimGsapVars(target.pose), ...shared }, delaySec)
    }
  })

  return tl
}
