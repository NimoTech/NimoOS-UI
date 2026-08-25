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
// component (Vue2 parity: "退出淡出 220ms 纯 CSS"), exported here purely as
// the single shared source of that number so the stage task and this module
// never drift apart on it. Not used by any GSAP call in this file.
export const EXIT_FADE_MS = 220

/**
 * Travel distance (in snapshot-index steps, any sign, any magnitude) -> the
 * shared duration (ms) every layer's tween in this travel uses. N=1 (and any
 * N <= TRAVEL_FLAT_STEPS) is exactly TRAVEL_BASE_DURATION_MS; beyond that it
 * grows asymptotically (1 - exp(-(n - flat) / growth)) toward
 * TRAVEL_MAX_DURATION_MS, ease-out, never exceeding it.
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
 */
export function playTravelTimeline(
  targets: TravelTarget[],
  opts: { steps: number, onComplete?: () => void },
): gsap.core.Timeline {
  registerTmEase()
  const reduced = prefersReducedMotion()
  const list = (targets || []).filter(target => target && target.pose && (target.el || target.dimEl))
  const durationMs = reduced ? 0 : travelDurationMs(opts?.steps)
  const durationSec = durationMs / 1000
  const total = list.length

  const tl = gsap.timeline({ onComplete: opts?.onComplete })

  list.forEach((target, i) => {
    const delaySec = reduced ? 0 : travelStaggerMs(total - 1 - i) / 1000
    const shared = { duration: durationSec, ease: TM_TRAVEL_EASE, overwrite: 'auto' as const }
    if (target.el) {
      // Stacking is discrete, not a tween-able quantity -- applied instantly,
      // independent of the shared timeline's own duration/stagger.
      gsap.set(target.el, { zIndex: target.pose.z })
      tl.to(target.el, { ...poseToGsapVars(target.pose), ...shared }, delaySec)
    }
    if (target.dimEl) {
      tl.to(target.dimEl, { ...dimGsapVars(target.pose), ...shared }, delaySec)
    }
  })

  return tl
}
