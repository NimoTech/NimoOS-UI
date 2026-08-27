<!--
  Task 7 (Files Time Machine Vue2-parity line): the Apple-style depth-stack cascade that sits
  behind the real, live window while Time Machine mode is active -- one real, static
  <snapshot-preview-window> per visible dolly slot (Task 2's resolveDollySlots/resolveSlotPose),
  plus a separate `__dim` overlay per strip for the brightness falloff. See timeMachineMath.ts's
  own header comment and TimeMachineStage.vue's own header comment (z-tier chart) for the model
  this ports byte-for-byte from Vue2's TimeMachineStage.vue depth-stack region (Fix Rounds 5-13,
  "single camera-dolly slot model" + GSAP migration -- see that file's own extensive header
  comment for the full history this component's own comments below cite by fix-round name).

  Ownership split (deliberately mirrors Vue2's own module boundary): timeMachineMath.ts owns "what
  pose should slot N have" (pure, DOM-free); timeMachineChoreo.ts (Task 3) owns "how long should
  getting there take, with how much stagger" plus the actual GSAP calls; THIS component owns "which
  slots are visible right now, keyed by which snapshot name" (reactive, DOM-bound) and "when does a
  travel start" (the store's own tmTravel transition -> this component's own watcher, below).

  Poses are applied two different ways, exactly matching Vue2's own Fix Round 13 split:
  - On INSERT (a strip appearing in the DOM for the first time -- initial mount, or a Fix Round 11
    pinned travel endpoint that was not already part of the cascade): the two custom directives
    below (`v-tm-pose`/`v-tm-dim`, Vue3's `mounted` hook -- Vue2's own `inserted` hook under the
    same name) fire exactly once, `gsap.set()`-ing the element straight to its pose with NO
    animation. This is the correct behavior for a brand-new node: it simply appears already sitting
    at wherever it logically belongs (possibly far/dim/off-screen-clipped), the same as any other
    newly-mounted decorative element.
  - On TRAVEL (an already-rendered strip's target slot changing because the selection moved): the
    watcher below builds and plays ONE `playTravelTimeline` covering every currently-rendered
    layer at once (Task 3) -- see `runTravel` below for the full trigger chain.

  Stage-height measurement (Task 7's own addition -- Vue2's own `measureStageHeight`/
  `onWindowResize`/`ResizeObserver`-equivalent, ported as a REAL `ResizeObserver` rather than a
  rAF-throttled `window resize` listener, since New-UI already has a same-shape precedent for this
  exact pattern in FileGridView.vue: guard `typeof ResizeObserver !== 'undefined'`) feeds BOTH
  `resolveSlotPose`'s T(-1) exit-offset formula and `computeVisibleStripCap`'s own strip-count
  ceiling -- see timeMachineMath.ts's own header comments on each for why a stale/unmeasured
  height degrades safely (fixed fallback / uncapped ceiling) rather than clipping everything to
  nothing.

  Fix round (review finding 2): the measured element is the STAGE ROOT (`.tm-stage`,
  TimeMachineStage.vue's own element, injected via tmStageRoot.ts), NOT this component's own
  `.tm-depth-stack` wrapper -- that wrapper's CSS already reserves the bottom 80px band
  (`bottom: 80px`, matching computeVisibleStripCap's own bottomGap constant), so its OWN
  clientHeight is already `stageHeight - 80`; feeding that into functions that subtract 80
  internally themselves double-subtracts it. See tmStageRoot.ts's own header comment for the full
  rationale and why provide/inject (not `offsetParent`) is the mechanism.

  Reveal-gate (Task 7 fix round, review finding 1 -- Vue2's own armReveal/reveal, ported): the
  REAL window's own `.tm-fwin--traveling` hard-hide (TimeMachineStage.vue) must not release just
  because the store's own navigation settled (tmTravel clearing, milliseconds) -- it must wait for
  the travel to actually finish. Deliberately NOT hooked to the GSAP timeline's own onComplete
  (same posture Vue2 takes, see that file's own header comment on this exact point): a plain
  `setTimeout(travelDurationMs(steps))` runs in parallel with the GSAP call, then checks the
  target's own preview promise (`getSnapshotPreview`, Task 4) before calling `browse.settleTravel()`
  -- which flips `tmTravelActive` back off, releasing the real window. A `travelSafetyTimer`
  (Vue2's own TRAVEL_SAFETY_EXTRA_MS, 800ms beyond the travel duration) guarantees a reveal
  regardless of a preview fetch that never appears, never settles, or rejects. A `travelToken`,
  bumped every time a NEW travel is armed, guards `settle()` so a superseded travel's own
  (eventually-firing) timers become safe no-ops rather than clobbering a NEWER travel's still
  in-flight wait -- Vue2's own token guard, ported verbatim in spirit (object-identity-per-call
  replaced with a plain incrementing counter, since JS closures already give each armed travel its
  own captured `{from,to}`, unlike Vue2's single shared `this.travelPinNames`).

  Simplification vs Vue2 (documented, not an oversight): Vue2's own armReveal polls
  (TRAVEL_READY_POLL_MS) because its cache module (snapshotPreviewCache.js) only wraps a promise
  the consumer already built -- there is nothing to look up until the target's own
  `<snapshot-preview-window>` has mounted and registered one. New-UI's own
  `getSnapshotPreview(mount, name, relPath)` (Task 4) both looks up AND fetches atomically, so
  calling it here either returns the SAME in-flight/settled promise the target's own preview
  component already triggered (the common case, since pinning already mounted it), or triggers
  the fetch itself if nothing has yet -- either way, one direct call replaces Vue2's whole
  poll-until-cached loop, no separate TRAVEL_READY_POLL_MS timer needed.

  Vue2 also arms this SAME reveal-gate timer twice per switch (once at click time, in `switchTo`,
  BEFORE the async navigation even starts; a second time, re-arming/restarting it, once the
  `activeSnapshotName` watcher confirms navigation actually landed) -- belt-and-suspenders against
  a SLOW navigation letting the click-time timer fire and reveal a real window that still shows
  stale content. That double-arm is not needed here: this component's own reveal-gate is armed
  ONLY once navigation has already landed (the SAME trigger `runTravel`'s own watcher already
  uses, below) -- there is no click-time timer that could fire early, so there is nothing to
  re-arm against.
-->
<template>
  <div ref="rootEl" class="tm-depth-stack" :style="stackStyle" aria-hidden="true">
    <div
      v-for="slot in dollySlots"
      :key="slot.name"
      class="tm-depth-strip"
      :data-snapshot="slot.name"
      :data-depth="slot.depth"
      v-tm-pose="slot.pose"
      :ref="(el) => setStripRef(slot.name, el as Element | null)"
    >
      <SnapshotPreviewWindow
        :mount="mount"
        :snapshot-name="slot.name"
        :rel-path="relPath"
        :view-mode="viewMode"
        :volume-label="volumeLabel"
      />
      <div
        class="tm-depth-strip__dim"
        v-tm-dim="slot.pose"
        :ref="(el) => setDimRef(slot.name, el as Element | null)"
        aria-hidden="true"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import gsap from 'gsap'
import { useSnapshotBrowseStore } from '../stores/snapshotBrowse'
import { useFilesStore } from '../stores/files'
import { resolveDollySlots, resolveSlotPose, computeVisibleStripCap, travelStackPlan, TM_WINDOW_SCALE, type SlotPose, type TravelStackEntry } from '../util/timeMachineMath'
import {
  playTravelTimeline, poseToGsapVars, dimGsapVars, travelDurationMs, TRAVEL_SAFETY_EXTRA_MS,
  TRAVEL_FLAT_STEPS, flyThroughPlan, flyThroughDurationMs, TRAVEL_FLY_MAX_INTERMEDIATES, TRAVEL_FLY_LAYER_DURATION_MS,
  type TravelTarget, type FlyThroughStep,
} from '../util/timeMachineChoreo'
import { getSnapshotPreview } from '../util/snapshotPreviewCache'
import { snapshotBrowsePath } from '../util/snapshotPath'
import { tmDebugLog } from '../util/tmDebug'
import { injectTmStageRoot } from './tmStageRoot'
import SnapshotPreviewWindow from './SnapshotPreviewWindow.vue'

defineOptions({ name: 'TimeMachineDepthStack' })

const browse = useSnapshotBrowseStore()
const files = useFilesStore()

// Fix round (review finding 2): the STAGE root (`.tm-stage`), not this component's own
// `.tm-depth-stack` wrapper -- see tmStageRoot.ts's own header comment and this file's own
// header comment for why. `rootEl` (this component's own root) stays -- it is still the correct
// scale/transform-origin host for the cascade itself, just not the measurement source.
const stageRootRef = injectTmStageRoot()
const rootEl = ref<HTMLElement | null>(null)
const stageHeight = ref(0)

// Task 7 addition, resolved here (not in SnapshotPreviewWindow -- see that file's own header
// comment on `volumeLabel`): the volume's user-facing display name, when one exists.
const mount = computed(() => browse.browseInfo?.mount ?? '')
const relPath = computed(() => browse.browseInfo?.relPath ?? '')
const volumeLabel = computed(() => (mount.value ? files.displayNames[mount.value] : undefined))
const viewMode = computed(() => files.viewMode)

const names = computed(() => browse.snapshotList.map((s) => s.name))
const currentIndex = computed(() => {
  const name = browse.currentSnapshotName
  if (!name) return -1
  return names.value.indexOf(name)
})
const visibleStripCap = computed(() => computeVisibleStripCap(stageHeight.value))

// Fix Round 11 (M2-F15, ported, see resolveDollySlots' own header comment): force-includes the
// travel's two endpoints at their own real slot regardless of the normal window, so a distant
// jump has a real "before" DOM node to animate from and a real "after" one to animate to, exactly
// like a single-step switch already did. Set by the `browse.tmTravel` watcher below, cleared by
// `settle()` (the reveal-gate below) once the travel actually lands OR is superseded -- NOT by
// the GSAP timeline's own onComplete (fix round, review finding 3: a superseded travel's timeline
// gets `.kill()`ed, which never fires onComplete, so a completion-driven clear would leak the
// pin until this component remounts).
const pinNames = ref<string[]>([])

const dollySlots = computed(() =>
  resolveDollySlots(names.value, currentIndex.value, visibleStripCap.value, pinNames.value).map((slot) => ({
    ...slot,
    pose: resolveSlotPose(slot.depth, stageHeight.value),
  })),
)

// A resize/late-measurement is NOT a travel -- the only dolly-slot pose that can actually depend
// on `stageHeight` is T(-1)'s own exit offset (resolveSlotPose) -- so an already-rendered slot's
// `gsap.set()`-applied inline style (from its own `v-tm-pose`/`v-tm-dim` `mounted` hook, possibly
// captured back when `stageHeight` was still its unmeasured 0 default -- the FIRST render always
// happens before `onMounted`'s own measurement, see `measureHeight` below) can otherwise go
// quietly stale with no travel ever happening to correct it (a directive's `mounted` hook fires
// exactly ONCE, unlike a bound `:style`, which would have re-applied on every render for free).
// Re-applies (via `gsap.set`, no animation) every CURRENTLY rendered layer's own pose from the
// freshly recomputed `dollySlots` -- a no-op `gsap.set` for any layer whose pose did not actually
// change (Vue2's own syncDollyPosesInstant, ported verbatim).
function syncDollyPosesInstant() {
  dollySlots.value.forEach((slot) => {
    const el = stripRefs.get(slot.name)
    const dim = dimRefs.get(slot.name)
    if (el) gsap.set(el, poseToGsapVars(slot.pose))
    if (dim) gsap.set(dim, dimGsapVars(slot.pose))
  })
}

// Fix round (review finding 2): measures `stageRootRef.value` (the injected `.tm-stage` element),
// NOT `rootEl.value` (this component's own `.tm-depth-stack` wrapper) -- see this file's own
// header comment for why the wrapper's own clientHeight is already reduced by the bottom-gap
// band `resolveSlotPose`/`computeVisibleStripCap` subtract themselves.
function measureHeight() {
  stageHeight.value = stageRootRef.value ? stageRootRef.value.clientHeight : 0
  syncDollyPosesInstant()
}

let resizeObserver: ResizeObserver | null = null

// Fix Round 13 (GSAP migration, ported): one gsap.context() per component instance, opened
// immediately (not in onMounted) so even a strip inserted during THIS component's own initial
// mount patch already has a real context to route its v-tm-pose/v-tm-dim gsap.set() through --
// see the Vue2 authority file's own header comment, Fix Round 13 section, "Cleanup", for why the
// `scope` argument is unnecessary here (every lookup goes through the local ref Maps below, never
// ctx.selector()).
const gsapCtx = gsap.context(() => {})
let travelTimeline: gsap.core.Timeline | null = null

const stripRefs = new Map<string, HTMLElement>()
const dimRefs = new Map<string, HTMLElement>()

function setStripRef(name: string, el: Element | null) {
  if (el) stripRefs.set(name, el as HTMLElement)
  else stripRefs.delete(name)
}
function setDimRef(name: string, el: Element | null) {
  if (el) dimRefs.set(name, el as HTMLElement)
  else dimRefs.delete(name)
}

// Fix Round 13 (GSAP migration, ported): each directive's `mounted` hook (Vue3's name for Vue2's
// `inserted`) fires exactly once, the instant Vue inserts THAT specific node -- gsap.set()-ing it
// straight to the pose bound at insert time, no animation. The ACTUAL travel tween is built
// separately, once per switch, in `runTravel` below.
const vTmPose = {
  mounted(el: HTMLElement, binding: { value: SlotPose }) {
    const vars = poseToGsapVars(binding.value)
    gsapCtx.add(() => gsap.set(el, vars))
  },
}
const vTmDim = {
  mounted(el: HTMLElement, binding: { value: SlotPose }) {
    const vars = dimGsapVars(binding.value)
    gsapCtx.add(() => gsap.set(el, vars))
  },
}

const stackStyle = computed(() => ({ transform: `scale(${TM_WINDOW_SCALE})` }))

// The travel this component is currently waiting to animate, captured the instant the store's own
// tmTravel becomes non-null (see the watcher below) -- BEFORE `browse.currentSnapshotName` has
// actually changed. `runTravel` fires once that name change actually lands (the second watcher
// below), mirroring Vue2's own two-step split ("pin at click time" / "animate once the prop change
// lands", see resolveDollySlots' own header comment on pinNames for why that ordering matters).
let pendingTravel: { from: string, to: string } | null = null

// Fix wave D (D2, owner acceptance 2026-08-26 -- reveal-time scale stutter): a monotonic counter
// bumped every time the `currentSnapshotName` watcher below starts processing a NEW travel.
// `armReveal`'s own setTimeout used to arm SYNCHRONOUSLY, one tick before `runTravel`'s GSAP
// timeline (deferred into `nextTick`, see that call's own comment) actually started ticking --
// `travelDurationMs(steps)` being identical on both sides only guaranteed the two countdowns were
// the same LENGTH, never that they started from the same INSTANT. That one-tick head start let the
// reveal-gate's timer fire, and the real window swap in, strictly BEFORE the incoming depth-0
// strip's tween had actually finished interpolating to its resting `{x:0,y:0,scale:1}` pose --
// the promoted depth-0 layer and the just-revealed real window pop instead of coincide, exactly
// the "whole view stutters and changes scale" symptom reported. This is Vue2's own Fix Round 15
// regression (TimeMachineStage.vue's own header comment on `beginTravel`, "Fix Round 15 (2026-07,
// problem 2c root cause)") reintroduced here -- ported the identical fix: `armReveal` is called
// from the SAME `nextTick` callback `runTravel` already uses (not merely "the same Vue flush
// batch" the way Vue2's two SEPARATE `$nextTick` calls rely on -- calling both from one shared
// callback pins them to the exact same synchronous instant, tighter than Vue2's own two-call
// arrangement), so both countdowns now start from the same zero point and finish together (mod
// sub-frame GSAP/rAF quantization, the same residual Vue2's own comment accepts). `myToken` mirrors
// Vue2's own `token !== this.travelToken` re-check inside its deferred callback: it guards the case
// where a LATER travel supersedes this one before this deferred callback has even run.
let travelRunToken = 0

// Fix wave H (Ruling H-1, owner acceptance 2026-08-26): long-jump fly-through. Owner design
// change overriding Vue2's own "just slide the whole stack, stretched out longer" answer for a
// jump of many steps -- see timeMachineChoreo.ts's own header comment on `travelDurationMs` for
// the full ruling, and `flyThroughPlan`'s own comment there for the plan shape this pins. A jump
// beyond `TRAVEL_FLAT_STEPS` (3) now flies SEQUENTIALLY through a sampled set of the intermediate
// snapshots (Apple Time Machine's own model) instead of one uniform slide; below is how that plan
// gets wired into THIS component's own pin/pose/timeline machinery:
// - `flyThroughPlan(...)`'s own names (intermediates + the target itself) are pinned here, in the
//   SAME watcher and at the SAME click-time moment `val.from`/`val.to` already are (this function's
//   own header comment on `pinNames` explains why that timing matters: a name must be pinned
//   BEFORE the DOM patch that would otherwise exclude it from `dollySlots`, not after). `settle()`'s
//   own unconditional `pinNames.value = []` (below) already covers unpinning every one of them once
//   the travel lands -- no separate fly-through-specific unpin path needed (this wave's own
//   dispatch: "the existing full pin reset covers it").
// - `runTravel`/`armReveal` (below) each independently recompute the SAME plan (pure, cheap, no
//   extra state to keep in sync) from `names.value`/the resolved indices -- see `runTravel`'s own
//   comment for how the plan turns into real per-name delay/preset overrides, and `armReveal`'s own
//   comment for how `flyThroughDurationMs` replaces `travelDurationMs(steps)` as the reveal-gate's
//   own timing floor once a plan exists.
function computeFlyThroughPlan(fromName: string, toName: string): FlyThroughStep[] {
  const fromIdx = names.value.indexOf(fromName)
  const toIdx = names.value.indexOf(toName)
  if (fromIdx < 0 || toIdx < 0) return []
  const steps = Math.abs(toIdx - fromIdx)
  if (steps <= TRAVEL_FLAT_STEPS) return [] // unchanged, byte-identical short-travel path
  return flyThroughPlan(names.value, fromIdx, toIdx, { maxIntermediates: TRAVEL_FLY_MAX_INTERMEDIATES })
}

// Fix wave I (Ruling I-1, owner acceptance 2026-08-26): linked-cascade travel. Owner report on a
// mid-flight screenshot of a big jump -- the fly-through intermediate itself moved, but the
// RESIDENT stack of receding slivers behind it sat static, and strips newly entering the visible
// window popped in already at their final pose. Root cause: `dollySlots` windows around the NEW
// current index -- an OLD-window resident that falls outside the new window (near-certain for a
// big jump) simply drops out of `dollySlots`' own v-for and unmounts with no animation at all,
// while a name newly entering the new window mounts fresh, and `v-tm-pose`'s own `mounted` hook
// (fires once, at insert, with NO animation by design) sets it directly to its FINAL resting pose.
// Owner ruling: EVERY travel (short steps AND a wave-H fly-through alike) must move the WHOLE
// visible stack as one linked cascade -- nothing pops or vanishes at rest mid-travel. See
// timeMachineMath.ts's own header comment on `travelStackPlan` for the full pure-function design
// this wires in, and `runTravel`'s own comment below for how the resulting `fromPose`s become real
// `presetPoses` (generalizing wave H's own fly-through-only preset mechanism to every strip
// entering the window during ANY travel, per the dispatch's own point 1).
//
// This watcher's own job (dispatch point 3): pin the UNION of the OLD window, the NEW window, and
// the fly-through plan's own names (when one exists) -- computed HERE, at the SAME click-time
// moment `val.from`/`val.to` themselves get pinned (pinNames' own header comment explains why that
// timing matters: a name must be pinned BEFORE the DOM patch that would otherwise exclude it).
// Without this, an OLD-window resident whose real NEW depth falls outside the natural window would
// unmount the instant `currentSnapshotName` changes -- before `runTravel` even gets a chance to
// animate it leaving. `settle()`'s own existing unconditional `pinNames.value = []` (below) already
// covers unpinning this whole (now larger) union once the travel lands -- no separate wave-I unpin
// path needed, same "the existing full pin reset covers it" reasoning wave H's own pinning already
// relies on.
function windowNames(atIndex: number): string[] {
  return atIndex >= 0 ? resolveDollySlots(names.value, atIndex, visibleStripCap.value).map((s) => s.name) : []
}

watch(
  () => browse.tmTravel,
  (val) => {
    if (!val || !val.from || !val.to) {
      tmDebugLog('watcher tmTravel: ignored (transient/null)', val)
      return
    }
    tmDebugLog('watcher tmTravel: armed', val)
    const fromIdx = names.value.indexOf(val.from)
    const toIdx = names.value.indexOf(val.to)
    const flyNames = computeFlyThroughPlan(val.from, val.to).map((step) => step.name)
    const oldWindowNames = windowNames(fromIdx)
    const newWindowNames = windowNames(toIdx)
    pinNames.value = Array.from(new Set([...pinNames.value, val.from, val.to, ...flyNames, ...oldWindowNames, ...newWindowNames]))
    pendingTravel = { from: val.from, to: val.to }
  },
)

watch(
  () => browse.currentSnapshotName,
  (newName, oldName) => {
    // Fix wave K (owner acceptance 2026-08-26): traced end to end -- see the guard immediately
    // below for the exact fix (files.ts's own load() epoch guard, snapshotBrowse.ts's stores/
    // files.ts) that keeps this watcher from ever observing a STALE, out-of-order value in the
    // first place; the `pendingTravel.to` comparison here is the second, independent line of
    // defense this dispatch asked for -- any fire whose value is null/transient, or does not match
    // the travel this component is actually waiting on, is ignored rather than treated as a new
    // travel (which would otherwise bump travelRunToken and kill an in-flight timeline for nothing).
    tmDebugLog('watcher currentSnapshotName:', oldName, '->', newName, 'pendingTravel=', pendingTravel)
    if (!pendingTravel || newName !== pendingTravel.to) {
      tmDebugLog('watcher currentSnapshotName: ignored (no matching pending travel -- not a genuinely new travel)')
      return
    }
    const travel = pendingTravel
    pendingTravel = null
    const fromIdx = names.value.indexOf(travel.from)
    const toIdx = names.value.indexOf(travel.to)
    const steps = fromIdx >= 0 && toIdx >= 0 ? Math.abs(toIdx - fromIdx) || 1 : 1
    // Fix wave H (Ruling H-1): recomputed here (same pure inputs as the `tmTravel` watcher's own
    // call, above) rather than threaded through as extra mutable state -- see that watcher's own
    // comment for why recomputing is safe/cheap. `durationMs` feeds BOTH `runTravel` (the GSAP
    // side) and `armReveal` (the reveal-gate) from this ONE shared value, so the two can never
    // disagree the way a `steps`-vs-recomputed-duration split could.
    const plan = computeFlyThroughPlan(travel.from, travel.to)
    const durationMs = plan.length ? flyThroughDurationMs(plan) : travelDurationMs(steps)
    const myToken = ++travelRunToken
    tmDebugLog('travelRunToken bump ->', myToken, 'for a genuinely new travel', travel, `(steps=${steps}, planLen=${plan.length}, durationMs=${durationMs})`)
    // $nextTick equivalent (Vue2's own playDollyTravel): a name that is entering `dollySlots` for
    // the FIRST time on this exact render (a pinned endpoint that was not already part of the
    // cascade) needs its own v-tm-pose/v-tm-dim `mounted` hook to have actually run -- i.e. the DOM
    // patch from the `currentIndex` change above must have landed -- before `stripRefs`/`dimRefs`
    // lookups below can find it. `armReveal` now runs from THIS SAME callback (see `travelRunToken`'s
    // own comment above) rather than synchronously alongside it.
    nextTick(() => {
      if (myToken !== travelRunToken) {
        tmDebugLog('runTravel skipped -- superseded before its own nextTick ran (token', myToken, '!=', travelRunToken, ')')
        return
      }
      runTravel(steps, travel, plan, fromIdx, toIdx)
      armReveal(travel, durationMs)
    })
  },
)

// Fix wave H (Ruling H-1): builds the per-name `delayOverridesMs`/`presetPoses` a non-empty `plan`
// needs -- see `playTravelTimeline`'s own comment (timeMachineChoreo.ts) for what each one does
// mechanically. Every plan member (intermediates AND the target) gets its own launch delay
// (`step.launchDelayMs`, the plan's own sequential cadence, overriding the default position-based
// stagger). Only INTERMEDIATES get a preset pose -- the target's own tween already starts from
// wherever it was last pinned/rendered and arrives at the identity (depth 0) pose, the same
// "arrival" motion every ordinary travel already has, no override needed:
// - BACKWARD (`toIdx > fromIdx`, going deeper/older): an intermediate's OWN `target.pose` (from
//   `dollySlots.value`, unmodified) is ALREADY the correct exit pose -- once `currentSnapshotName`
//   has landed on `to` (true by the time this runs), every intermediate's depth relative to the
//   NEW current is negative (it is chronologically BEFORE the new selection), and `resolveSlotPose`
//   already collapses every depth <= -1 to the exit pose. What is NOT already correct is the
//   tween's own STARTING point: this intermediate was just newly pinned, so its `v-tm-pose`
//   `mounted` hook already `gsap.set()` it to that SAME (already-arrived) exit pose the instant it
//   was inserted -- a direct tween from there to `target.pose` would be a no-op, no visible motion
//   at all. The preset fixes the START, not the destination: its OWN pose relative to the OLD
//   `fromIdx` (a normal, positive-depth receding pose -- where it "actually" was, position-wise,
//   before this jump), so the tween now visibly travels from there to the exit pose -- "flies past
//   the camera".
// - FORWARD (`toIdx < fromIdx`, going shallower/more recent): the mirror image. An intermediate's
//   own `target.pose` (relative to the NEW current) is a normal, positive-depth RECEDING pose (not
//   an exit pose -- these intermediates end up chronologically AFTER the new selection) -- already
//   the correct "where it settles" destination, including the natural "later-launched ones (closer
//   to the target) land at a SMALLER depth than earlier-launched ones" ordering that alone produces
//   the dispatch's own "push back to depth 1, 2… as the next arrives" visual, with no extra
//   per-intermediate depth bookkeeping needed. What is missing is the START, for a genuinely NEW
//   entrant: without a preset, its tween would start from that SAME natural resting pose (a near
//   no-op). The preset for a new entrant is the exit pose -- "arrives already at the camera, then
//   glides to its natural resting spot".
//
//   Fix wave I follow-up (re-review, 2026-08-26): the FORWARD branch used to apply that exit-pose
//   preset to EVERY sampled intermediate unconditionally -- wrong for a jump just past
//   `TRAVEL_FLAT_STEPS` (e.g. 4-5 steps at the default window), where a sampled intermediate can
//   be a genuine, ALREADY-VISIBLE RESIDENT of the OLD window (or already leaving it), not a new
//   entrant -- for that strip, the unconditional preset SNAPS it from its own correct current
//   pose to the exit pose right before its tween begins, a visible pop of exactly the kind Ruling
//   I-1 exists to eliminate. The BACKWARD branch (below) never had this problem: it recomputes the
//   real old-relative pose directly, which is IDEMPOTENT for an already-resident intermediate (its
//   "preset" and its actual current pose are the same value, so nothing visibly snaps). The fix:
//   reuse `travelStackPlan`'s own per-name role (`stackPlan`, computed once in `runTravel` and
//   passed in here rather than re-derived) -- a forward intermediate only gets the exit-pose preset
//   when its role is `'entering'`/`'pinned'` (genuinely NOT in the old window); a `'resident'`/
//   `'leaving'` intermediate gets NO preset at all, exactly `travelStackPlan`'s own base rule for
//   every other strip in the cascade -- its own current, already-correct pose IS its `fromPose`,
//   and its existing `target.pose` (the normal receding destination derived above) is already the
//   right "fly out as part of the cascade" trajectory; no separate destination override needed.
function buildFlyThroughOverrides(
  plan: FlyThroughStep[],
  fromIdx: number,
  toIdx: number,
  stackPlan: TravelStackEntry[],
): { delayOverridesMs: Record<string, number>, presetPoses: Record<string, SlotPose> } {
  const delayOverridesMs: Record<string, number> = {}
  const presetPoses: Record<string, SlotPose> = {}
  const forward = toIdx < fromIdx
  const exitPose = resolveSlotPose(-1, stageHeight.value)
  const roleByName = new Map(stackPlan.map((entry) => [entry.name, entry.role]))
  for (const step of plan) {
    delayOverridesMs[step.name] = step.launchDelayMs
    if (step.role !== 'intermediate') continue
    if (forward) {
      // Fix wave I follow-up: only a genuinely NEW entrant (not naturally in the old window) needs
      // the "arrives from the camera" preset -- see this function's own header comment above.
      const role = roleByName.get(step.name)
      if (role !== 'resident' && role !== 'leaving') presetPoses[step.name] = exitPose
    }
    else {
      const idx = names.value.indexOf(step.name)
      presetPoses[step.name] = idx >= 0 ? resolveSlotPose(idx - fromIdx, stageHeight.value) : exitPose
    }
  }
  return { delayOverridesMs, presetPoses }
}

// Fix wave J (owner acceptance 2026-08-26): single source of truth for BOTH the timeline's own
// `targets` (what actually gets a tween) and `presetPoses` (what gets a corrective starting
// `gsap.set()`). Before this wave, the two were built from TWO INDEPENDENTLY-COMPUTED lists --
// `targets` from `dollySlots.value` (natural window around the new current index, unioned with
// whatever `pinNames.value` happens to force-include), `presetPoses` from a SEPARATE
// `travelStackPlan(...)` call whose own `extraNames` only covered THIS travel's own fly-through
// plan (not the full, possibly-larger accumulated `pinNames.value`, e.g. leftover pins from a
// just-superseded travel). Nothing in this codebase's own tests ever forced these two lists to
// actually disagree (see this file's own extensive "Fix wave J" root-cause investigation in
// final-fix-report.md -- an owner screenshot reported a strip stuck mid-flight with no tween, a
// symptom this exact "two parallel lists" shape is the textbook way to produce), but relying on
// two independently-derived lists staying in sync by coincidence is exactly the kind of
// architectural risk the dispatch asked to close STRUCTURALLY, not just patch around. Fixed by
// computing `stackPlan` ONCE, with `extraNames: pinNames.value` (the FULL, accumulated pin set,
// not just this one travel's own old∪new∪plan names) -- this makes `stackPlan`'s own union a
// PROVABLE superset of `dollySlots.value`'s own rendered set (natural-new-window ∪ pinNames.value,
// and natural-new-window is exactly the same `resolveDollySlots` call `stackPlan`'s own internal
// new-window computation already makes) -- and deriving BOTH `targets` and `presetPoses` from that
// ONE list. A strip present in `stackPlan` but with no mounted ref yet (defensive only) is dropped
// by the same `.filter()` this always had.
function buildStackPlan(fromIdx: number, toIdx: number): TravelStackEntry[] {
  return travelStackPlan(names.value, fromIdx, toIdx, {
    maxSlots: visibleStripCap.value,
    stageHeight: stageHeight.value,
    extraNames: pinNames.value,
  })
}

function runTravel(steps: number, travel: { from: string, to: string }, plan: FlyThroughStep[], fromIdx: number, toIdx: number) {
  const stackPlan = buildStackPlan(fromIdx, toIdx)
  const targets = stackPlan
    .map((entry) => ({ el: stripRefs.get(entry.name) ?? null, dimEl: dimRefs.get(entry.name) ?? null, pose: entry.toPose, name: entry.name }))
    .filter((target) => target.el !== null) as TravelTarget[]
  tmDebugLog('runTravel start', travel, `(targets=${targets.length}, planLen=${plan.length})`)
  if (travelTimeline) {
    tmDebugLog('timeline killed (source: superseded by a new, genuinely different travel -- runTravel called again before the previous one settled)')
    travelTimeline.kill()
    travelTimeline = null
  }
  // Fix round (review finding 1/3): no `onComplete` here any more -- the GSAP timeline's own
  // completion no longer drives anything observable (not the real window's reveal, not pin
  // clearing). See this file's own header comment for why that gate is a SEPARATE, plain-timer
  // mechanism (`armReveal`/`settle` below) rather than hooked to this timeline.

  // Fix wave I (Ruling I-1, owner acceptance 2026-08-26): linked-cascade preset poses -- see the
  // `tmTravel` watcher's own header comment above for the full root-cause trace and
  // `travelStackPlan`'s own comment (timeMachineMath.ts) for the role/pose derivation. Every strip
  // whose role is 'entering' or 'pinned' (not naturally in the OLD window -- it was just newly
  // mounted this render, already `gsap.set()` to its FINAL pose by `v-tm-pose`'s own `mounted`
  // hook) gets an IMMEDIATE preset back to its own edge-clamped implied pre-travel pose, so its
  // regular tween (below, same as every other target) actually has visible distance to cover
  // instead of animating a no-op. 'resident'/'leaving' strips get NO preset here -- their own
  // current, already-rendered position (from their LAST completed tween, or their original mount)
  // already IS their correct `fromPose` (they were genuinely there), so the default "tween from
  // wherever gsap currently has it" behavior is already correct for them, unchanged.
  const presetPoses: Record<string, SlotPose> = {}
  for (const entry of stackPlan) {
    if (entry.role === 'entering' || entry.role === 'pinned') presetPoses[entry.name] = entry.fromPose
  }

  // Fix wave H (Ruling H-1): a non-empty `plan` (steps > TRAVEL_FLAT_STEPS) ALSO switches this call
  // to fly-through mode -- see `buildFlyThroughOverrides`' own comment for the full backward/
  // forward derivation. Its own per-intermediate presets are MORE SPECIFIC than travelStackPlan's
  // generic edge-clamped ones (they encode the real backward/forward exit-trajectory pose, not
  // just "just past the window edge") and therefore WIN via `Object.assign` running after the
  // generic map above -- every other field (delayOverridesMs, durationMsOverride) stays exactly
  // as wave H left it. An EMPTY plan (steps <= TRAVEL_FLAT_STEPS) leaves delayOverridesMs/
  // durationMsOverride unset -- unchanged, "1-position cascade is what it always did" (this wave's
  // own explicit regression contract) -- `presetPoses` is the ONLY thing that can now be non-empty
  // for a short travel, exactly the generalization the dispatch's own point 1 asks for.
  let delayOverridesMs: Record<string, number> | undefined
  let durationMsOverride: number | undefined
  if (plan.length) {
    const fly = buildFlyThroughOverrides(plan, fromIdx, toIdx, stackPlan)
    delayOverridesMs = fly.delayOverridesMs
    Object.assign(presetPoses, fly.presetPoses)
    durationMsOverride = TRAVEL_FLY_LAYER_DURATION_MS
  }

  tmDebugLog('runTravel presets applied:', Object.keys(presetPoses).length, 'of', targets.length, 'targets')
  const build = () => playTravelTimeline(targets, { steps, delayOverridesMs, presetPoses, durationMsOverride })
  travelTimeline = gsapCtx.add(build)
}

// --- Reveal-gate (Task 7 fix round, review finding 1 -- Vue2's own armReveal/reveal) ------------
// Ported verbatim in mechanism (see this file's own header comment for the full model and the
// one deliberate simplification vs Vue2's own poll-based cache lookup).
// Final review (folded minor #7): TRAVEL_SAFETY_EXTRA_MS now lives in timeMachineChoreo.ts (single
// shared source, same "so the two never drift apart" reasoning EXIT_FADE_MS's own comment there
// already established) -- snapshotBrowse.ts's own switchTo() safety backstop for tmTravelActive
// reuses the identical constant, rather than each maintaining its own copy of "Vue2's own literal,
// same value".

let travelToken = 0
let travelTimer: ReturnType<typeof setTimeout> | null = null
let travelSafetyTimer: ReturnType<typeof setTimeout> | null = null

function clearTravelTimers() {
  if (travelTimer !== null) { clearTimeout(travelTimer); travelTimer = null }
  if (travelSafetyTimer !== null) { clearTimeout(travelSafetyTimer); travelSafetyTimer = null }
  // Fix wave B (B3b): a still-pending waitForFilesLoad() watcher (armed by an EARLIER travel,
  // superseded before the files-store load it was waiting on ever completed) must stop here too --
  // clearTravelTimers() already runs on every new armReveal() call and on settle(), the same two
  // places that already retire the timers above; leaving this watcher running would keep it
  // observing files.loading/currentPath forever for a travel nothing cares about any more.
  if (pendingFilesLoadStop) { pendingFilesLoadStop(); pendingFilesLoadStop = null }
}

// Fix wave B (B3b, owner acceptance 2026-08-26): armReveal's own preview-cache wait (below) says
// nothing about whether the REAL window's own listing for the target path has actually loaded --
// only that a `getSnapshotPreview` promise (feeding the DECORATIVE preview layers, not the real
// window) has settled. The real window's own data comes from `useFilesStore().load()` (see
// files.ts), triggered fire-and-forget by Files.vue's own `watch(() => [route.params.path, ...])`
// -- `switchTo`'s own `await navigateReal(...)` (snapshotBrowse.ts) only awaits the ROUTER
// navigation promise, not that watcher's own async `sync()`/`files.load()` call, so nothing in the
// chain up to here actually waits for the real listing to be ready. In practice `browse.
// currentSnapshotName` (this component's own travel-trigger watcher, below) is itself DERIVED from
// `files.currentPath` (via browseInfo/parsed, snapshotBrowse.ts), which `files.load()` only sets
// once its own fetch has resolved -- so by construction this condition is normally already true by
// the time armReveal runs. This waiter makes that invariant EXPLICIT and load-bearing rather than
// an accidental byproduct of two unrelated computeds happening to chain together (a future refactor
// of either one could silently break it): the reveal-gate should not just assume the real window's
// entries are ready, it should check. The extra `nextTick()` once the condition holds gives
// FileGridView.vue's own entries-watcher (`await nextTick(); measure()`) a render tick to actually
// lay out the new rows before the real window is allowed to reveal -- the fast path (condition
// already true) still resolves in well under a frame, so this adds no perceptible delay to the
// common case. Capped the same way the preview-cache wait already is: armReveal's own safety timer
// (below) reveals unconditionally regardless of whether this ever resolves.
let pendingFilesLoadStop: (() => void) | null = null
function waitForFilesLoad(targetRealPath: string): Promise<void> {
  return new Promise((resolve) => {
    const ready = () => !files.loading && files.currentPath === targetRealPath
    const finish = () => { pendingFilesLoadStop = null; nextTick().then(() => resolve()) }
    if (ready()) { finish(); return }
    const stop = watch(() => [files.loading, files.currentPath] as const, () => {
      if (ready()) { stop(); finish() }
    })
    pendingFilesLoadStop = stop
  })
}

// The ONE place the reveal actually happens. Guarded by `token`: a reveal armed for an EARLIER
// travel (its preview promise settling late, or its own safety timer) can never clobber a LATER
// travel's own still-in-progress wait, because a newer `armReveal` call already bumped
// `travelToken` and cleared every timer this one could still be holding -- the only way a stale
// callback can still run at all is an already-queued Promise microtask (a timer clear cannot
// cancel that), and this guard is what makes that a safe no-op (Vue2's own `reveal(token)` --
// see this file's own header comment).
function settle(token: number, path: 'legit' | 'depthstack-safety' = 'legit') {
  if (token !== travelToken) return
  tmDebugLog('settle (path:', path, ')')
  clearTravelTimers()
  // Fix round 2 (review finding 3, re-review): resets the WHOLE pin array unconditionally, not
  // just the settling travel's own {from,to} (that was fix round 1's own mistake -- see this
  // function's git history/PR for the filter() version this replaced). pinNames accumulates via
  // Set-union across EVERY travel whose `tmTravel` watcher fired (see that watcher, above), but
  // only the ONE winning travel's settle() ever runs (a superseded travel's own settle() is the
  // token-guard no-op right above) -- filtering only the winner's own pair left every OTHER
  // superseded travel's names stuck in `pinNames` forever. Repro that caught this: s0->s15 lands
  // and pins {s0,s15}; before its gate fires, s15->s29 supersedes and settles filtering only
  // {s15,s29} -- s0 (never part of that pair) stayed pinned 29 slots away permanently. Vue2's own
  // reveal() (TimeMachineStage.vue) resets the array unconditionally too
  // (`this.travelPinNames = []`) -- ported verbatim. A full reset is safe here precisely because
  // settle() only ever fires (past the token guard) for the ONE travel legitimately settling
  // right now, and nothing needs to stay pinned once ANY travel has settled -- the current
  // selection is already covered by dollySlots' own depth-0 slot unconditionally, same reasoning
  // Vue2's own comment there gives.
  pinNames.value = []
  browse.settleTravel()
}

// Arms the reveal for `travel`, bumping `travelToken` so any STILL-pending earlier reveal becomes
// a no-op once its own timer/promise eventually fires. `durationMs` is computed ONCE by the
// `currentSnapshotName` watcher (above) and passed to BOTH this function and `runTravel` -- the
// SAME `travelDurationMs(steps)` the GSAP timeline itself uses for an ordinary (<= TRAVEL_FLAT_STEPS)
// travel, or `flyThroughDurationMs(plan)` (Fix wave H, Ruling H-1) for a long-jump fly-through, so
// the reveal-gate's own timing floor can never disagree with what the timeline is actually doing --
// see that watcher's own comment for why a single shared value (not two independent computations)
// is what makes that guarantee real. Deliberately NOT collapsed under `prefers-reduced-motion`
// (Vue2's own explicit choice, ported: "the readiness gate is unaffected... never whether the real
// window waits for the target's own preview to be ready" -- only the depth-stack's own visual
// motion degrades under reduced motion, not this timing floor).
function armReveal(travel: { from: string, to: string }, durationMs: number) {
  travelToken += 1
  const token = travelToken
  tmDebugLog('armReveal', travel, `(durationMs=${durationMs}, token=${token})`)
  clearTravelTimers()
  // Safety ceiling: reveals unconditionally once durationMs + TRAVEL_SAFETY_EXTRA_MS has passed,
  // regardless of whether the target's own preview promise ever appears, settles, or rejects.
  travelSafetyTimer = setTimeout(() => {
    travelSafetyTimer = null
    settle(token, 'depthstack-safety')
  }, durationMs + TRAVEL_SAFETY_EXTRA_MS)
  travelTimer = setTimeout(() => {
    travelTimer = null
    // Fix wave B (B3b): reveal now waits for BOTH the preview cache promise (decorative layers)
    // AND the real window's own files-store load of the target path (waitForFilesLoad, above) --
    // see that function's own comment for the full rationale. root = snapshotBrowsePath(mount,
    // name) [+ '/' + relPath] mirrors snapshotBrowse.ts's own switchTo() target-path construction
    // byte-for-byte (the SAME string files.currentPath lands on once its own load() resolves).
    const targetRoot = snapshotBrowsePath(mount.value, travel.to)
    const targetPath = relPath.value ? `${targetRoot}/${relPath.value}` : targetRoot
    // getSnapshotPreview both looks up AND fetches (see this file's own header comment) -- no
    // separate "not cached yet, poll again shortly" loop needed, unlike Vue2's own armReveal.
    Promise.all([getSnapshotPreview(mount.value, travel.to, relPath.value), waitForFilesLoad(targetPath)]).then(
      () => settle(token),
      // Deliberately a no-op, not `() => settle(token)` too -- a REJECTED preview fetch does
      // not reveal early on its own; the safety timer above still guarantees "reveal anyway"
      // for it. This handler exists so a rejection never surfaces as an unhandled promise
      // rejection (getSnapshotPreview's own contract never actually rejects and waitForFilesLoad
      // never rejects either, but this stays defensive against either contract changing).
      () => {},
    )
  }, durationMs)
}

onMounted(() => {
  nextTick(() => measureHeight())
  if (typeof ResizeObserver !== 'undefined') {
    // Fix round (review finding 2): observes `stageRootRef.value` (the injected `.tm-stage`
    // element), not this component's own root -- see measureHeight's own comment.
    resizeObserver = new ResizeObserver(() => measureHeight())
    if (stageRootRef.value) resizeObserver.observe(stageRootRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  clearTravelTimers()
  if (travelTimeline) {
    travelTimeline.kill()
    travelTimeline = null
  }
  // Fix Round 13 (GSAP migration, ported): kills every tween/timeline this component ever tracked
  // (both directives' gsap.set() calls and every travel timeline) and restores the touched
  // elements' pre-GSAP inline styles.
  gsapCtx.revert()
})
</script>

<style scoped>
/* Deliberately congruent with `.tm-fwin`'s own scaled geometry (Vue2 parity, M2-F10): same
   right/bottom reserved bands as `.tm-stage__hold--active` (TM_RAIL_WIDTH + TM_STEPPER_BAND =
   280px, timeMachineMath.ts), same window scale/origin -- everything positioned inside inherits
   the real window's own rendered top/right edges for free. `right`/`bottom` stay plain literals
   here (not bound), matching this same file family's own existing precedent
   (TimeMachineStage.vue's `.tm-stage__hold--active`, `padding-right: 280px`) rather than a second
   independent derivation. */
.tm-depth-stack {
  position: absolute;
  top: 0;
  left: 0;
  right: 280px; /* TM_RAIL_WIDTH (220) + TM_STEPPER_BAND (60) */
  bottom: 80px; /* matches computeVisibleStripCap's own bottomGap constant */
  transform-origin: 50% 58%;
  pointer-events: none;
  z-index: 3;
}

/* Full window-sized box hosting one real <snapshot-preview-window> per dolly slot -- this rule
   only carries the shared, slot-INDEPENDENT geometry; transform/z-index are GSAP-driven (see
   v-tm-pose above), never a CSS transition (Fix Round 13 -- GSAP is the only writer). */
.tm-depth-strip {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  overflow: hidden;
  /* Fix wave B (B1, Ruling B-1): was `var(--tm-panel-bg-solid)` (TM chrome's own literal white,
     same-in-both-themes token) -- this strip hosts a real, full-size clone of the New-UI Files
     window (SnapshotPreviewWindow.vue), which paints its own text in New-UI's theme tokens. See
     TimeMachineStage.vue's own `.tm-fwin--active` comment for the full rationale this mirrors:
     the WINDOW must follow the app's theme, not TM's own fixed-white chrome literal. */
  background: var(--panel-bg-solid);
  /* Fix wave A2 (audit-stage.md #5): Vue2's own `.tm-stage__depth-strip` box-shadow is a single
     layer (TimeMachineStage.vue:3042) -- `--card-shadow-hi`'s 3-layer shadow (with an inset
     highlight Vue2 never has on this element) was a substitution error, not an approved token
     reuse.
     Fix wave F (Ruling F'-1, owner acceptance 2026-08-26, shadow pop at the reveal swap): this
     used to be a DEDICATED `--tm-depth-shadow` token pinning Vue2's own (weaker) literal for this
     element specifically -- now retired in favor of `--tm-fwin-shadow`, the SAME token
     `.tm-fwin--active` (TimeMachineStage.vue) uses for the real window's own shadow. The owner
     reported the shadow visibly SNAPPING from weak to strong the instant a promoted strip becomes
     the real window: this strip sits pixel-for-pixel underneath the fwin (D2's own geometry-parity
     tests) and is only ever exposed while the fwin is hidden mid-travel, so at depth 0 the strip's
     shadow must already read as the fwin's own for the swap to be paint-invisible. See theme.css's
     own comment on `--tm-fwin-shadow` for the full Ruling F'-1 trace (why retiring the token
     outright, not aliasing it, was the right call) and timeMachineDepthStackGeometryParity.test.ts
     for the CI guard pinning this exact reference. */
  box-shadow: var(--tm-fwin-shadow);
  transform-origin: 50% 0%;
  pointer-events: none;
}

/* The per-slot "dimmer with depth" falloff lives on this separate overlay (rather than a `filter`
   on the strip itself) -- a `filter` on a box wrapping a real DOM subtree can force a repaint of
   it on every value change; an overlay's own `opacity` never does (Vue2's own M2-F12 perf
   rationale). Fix wave A2 (audit-stage.md #6): Vue2's own literal is PURE black
   (`.tm-stage__depth-strip__dim`'s own `background`, TimeMachineStage.vue:3081) -- the previous
   `--tm-text` token (a navy-grey ink color, see theme.css) was a substitution error that tinted
   every strip in the receding stack blue-grey instead of neutrally darkening it; `--tm-depth-dim`
   pins the exact Vue2 literal instead (see theme.css's own comment on that token for the value,
   not repeated here to avoid writing a bare color literal in this style block). */
.tm-depth-strip__dim {
  position: absolute;
  inset: 0;
  background: var(--tm-depth-dim);
  pointer-events: none;
}
</style>
